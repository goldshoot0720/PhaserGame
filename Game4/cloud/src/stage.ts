// The stage: tile platforming, enemies, weapons and the boss room.
import { Scene, type Draw, type Preload } from '../engine/webgpu.js';
import {
  TILE, ROWS, GRAVITY, PLAYER, BOSS, CHARACTERS, FINAL, CITADEL, FINAL_BOSS_PHASES, finalBossDamage, BUSTER, E_TANK, M_TANK, citadelTankGrant, FORTRESS_REWARDS, fortressBossReward, getHero, bossDamage, BG_URLS, CAST_URLS, ART,
  type Hero, type WeaponKind, type Palette,
} from './data.js';
import { buildLevel, isSolid, isOneWay, isLadder, T_SPIKE, T_WALL, T_EMPTY, T_TOP, T_LADDER, T_LADDER_TOP, T_PLATFORM, ROOM_COLS, type Level } from './levels.js';
import { Progress, run } from './progress.js';
import { label, clamp } from './ui.js';

const rng = Math.random;

interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; hitWall: boolean; }
interface Mover { x: number; y: number; w: number; x0: number; y0: number; range: number; axis: 'x' | 'y'; t: number; dx: number; dy: number; }
interface Shot {
  x: number; y: number; vx: number; vy: number; r: number; kind: WeaponKind; dmg: number; pierce: boolean;
  enemy: boolean; life: number; t: number; color: string; charge: number; baseY: number; weapon: string; hits: Set<object>;
}
interface Enemy { type: string; b: Body; hp: number; dir: number; t: number; fire: number; baseY: number; spawn: number; flash: number; }
interface Pickup { x: number; y: number; kind: 'h' | 'a' | 'e' | 'm'; big: boolean; t: number; spawn: number; }
interface Boss { hero: Hero; b: Body; hp: number; state: string; t: number; facing: number; iframes: number; shotsLeft: number; phase: number; }

export class Stage extends Scene {
  private hero!: Hero;
  private stageKey = 'penguin';
  private lv!: Level;
  private pal!: Palette;
  private fr: Record<string, number> = {};
  private p!: Body;
  private facing = 1;
  private hp = PLAYER.maxHp;
  private lives = PLAYER.lives;
  private eTanks = 0;
  private mTanks = 0;
  private paused = false;
  private pending: { left: number; callback: () => void }[] = [];
  private ammo: Record<string, number> = {};
  private weapons: string[] = ['buster'];
  private wi = 0;
  private climbing = false;
  private slideT = 0;
  private coyote = 0;
  private charge = 0;
  private iframes = 0;
  private knock = 0;
  private dead = 0;
  private shootAnim = 0;
  private checkpoint = { x: 0, y: 0 };
  private movers: Mover[] = [];
  private shots: Shot[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private killed = new Set<number>();
  private taken = new Set<number>();
  private boss: Boss | null = null;
  private bossQueue: string[] = [];
  private finalPhase = 0;
  private finalPhaseDone = 0;
  private inRoom = false;
  private doorClosed = false;
  private bossBar = 0;
  private msg = '';
  private msgT = 0;
  private rewardMsg = '';
  private rewardT = 0;
  private endT = -1;
  private t = 0;
  private camX = 0;

  override preload(load: Preload): void {
    for (const u of [...Object.values(CAST_URLS), ...Object.values(BG_URLS), ...ART.bossForms, ART.walker, ART.flyer, ART.turret]) load.image(u);
  }

  override setup(): void {
    const a = this.game.assets;
    for (const [k, u] of Object.entries(CAST_URLS)) this.fr[k] = a.framesOf(u);
    for (const [k, u] of Object.entries(BG_URLS)) this.fr['bg_' + k] = a.framesOf(u);
    this.fr.walker = a.framesOf(ART.walker); this.fr.flyer = a.framesOf(ART.flyer); this.fr.turret = a.framesOf(ART.turret);
    ART.bossForms.forEach((u, i) => { this.fr['boss' + (i + 1)] = a.framesOf(u); });

    this.hero = getHero(run.hero);
    this.stageKey = run.stage;
    const resumeGuardian = this.stageKey === 'citadel' && !run.fortressCarry && Progress.citadelCheckpoint(this.hero.key) >= 0;
    if (this.stageKey === 'citadel') {
      Progress.markCitadelReached(this.hero.key);
      this.finalPhaseDone = Math.max(0, Progress.citadelCheckpoint(this.hero.key));
      this.finalPhase = this.finalPhaseDone;
    }
    this.lv = buildLevel(this.stageKey);
    this.pal = this.stageKey === 'final' ? FINAL.palette : this.stageKey === 'citadel' ? CITADEL.palette : getHero(this.stageKey).palette;
    // Weapons: buster + every beaten boss's weapon.
    for (const b of Progress.beaten(this.hero.key)) this.weapons.push(b);
    for (const w of this.weapons) this.ammo[w] = PLAYER.maxAmmo;

    this.input.bind({
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      jump: ['KeyZ', 'Space', 'KeyK'], shoot: ['KeyX', 'KeyJ'], prev: ['KeyQ'], next: ['KeyE', 'Tab'], useTank: ['KeyR'], useMTank: ['KeyM'], pause: ['KeyP'], quit: ['Escape'],
    });
    this.sound.define('shoot', { type: 'square', freq: 900, freqEnd: 500, duration: 0.06, volume: 0.2 });
    this.sound.define('charged', { type: 'sawtooth', freq: 300, freqEnd: 1200, duration: 0.25, volume: 0.25 });
    this.sound.define('hit', { type: 'square', freq: 300, freqEnd: 120, duration: 0.08, volume: 0.25 });
    this.sound.define('hurt', { type: 'square', freq: 500, freqEnd: 90, duration: 0.25, volume: 0.35 });
    this.sound.define('jump', { type: 'square', freq: 300, freqEnd: 600, duration: 0.08, volume: 0.12 });
    this.sound.define('land', { type: 'noise', duration: 0.05, volume: 0.15, filter: { type: 'lowpass', freq: 500 } });
    this.sound.define('pick', { notes: 'C6 E6 G6 C7', step: 0.04, type: 'square', volume: 0.2 });
    this.sound.define('boom', { type: 'noise', duration: 0.5, curve: 'exponential', distortion: 0.4, volume: 0.5, filter: { type: 'lowpass', freq: 1600, freqEnd: 100 } });
    this.sound.define('door', { type: 'sawtooth', freq: 80, duration: 0.5, volume: 0.3 });
    this.sound.music(ART.stageMusic, { loop: true, volume: 0.3 });

    this.lv.entities.forEach((e, i) => {
      if (e.type === 'M' || e.type === 'N' || e.type === 'V') {
        const axis = e.type === 'V' ? 'y' : 'x';
        const range = e.type === 'M' ? 7 * TILE : e.type === 'N' ? 12 * TILE : 5 * TILE;
        this.movers.push({ x: e.col * TILE, y: e.row * TILE, w: 3 * TILE, x0: e.col * TILE, y0: e.row * TILE, range, axis, t: 0, dx: 0, dy: 0 });
      } else if (e.type === 'h' || e.type === 'a') {
        this.pickups.push({ x: e.col * TILE + 16, y: e.row * TILE + 16, kind: e.type, big: true, t: 0, spawn: i });
      }
    });
    if (this.stageKey === 'final') this.bossQueue = CHARACTERS.filter((c) => c.key !== this.hero.key).map((c) => c.key);
    else if (this.stageKey === 'citadel') this.bossQueue = [];
    else this.bossQueue = [this.stageKey];
    this.checkpoint = { x: this.lv.start.col * TILE, y: this.lv.start.row * TILE };
    // Debug: ?boss starts at the boss door.
    if (typeof location !== 'undefined' && location.search.includes('boss')) this.checkpoint = { x: (this.lv.roomCol - 4) * TILE, y: 10 * TILE };
    if (resumeGuardian) this.checkpoint = { x: (this.lv.roomCol + 3) * TILE, y: 10 * TILE };
    this.spawnPlayer();
    if (this.stageKey === 'citadel' && run.fortressCarry) {
      this.hp = run.fortressCarry.hp;
      this.lives = run.fortressCarry.lives;
      this.ammo = { ...run.fortressCarry.ammo };
      this.eTanks = run.fortressCarry.eTanks ?? 0;
      this.mTanks = run.fortressCarry.mTanks ?? 0;
      run.fortressCarry = null;
    }
    if (this.stageKey === 'citadel') {
      const tanks = citadelTankGrant(this.eTanks, this.mTanks);
      this.eTanks = tanks.eTanks;
      this.mTanks = tanks.mTanks;
    }
    this.say(this.stageKey === 'final' ? `${FINAL.stage}　READY` : this.stageKey === 'citadel' ? `${CITADEL.stage}　READY` : `${getHero(this.stageKey).stage}　READY`, 1.6);
  }

  private say(s: string, t = 1.4): void { this.msg = s; this.msgT = t; }
  private schedule(delay: number, callback: () => void): void { this.pending.push({ left: delay, callback }); }
  private tickPending(dt: number): void {
    for (const timer of [...this.pending]) timer.left -= dt;
    const due = this.pending.filter((timer) => timer.left <= 0);
    this.pending = this.pending.filter((timer) => timer.left > 0);
    for (const timer of due) timer.callback();
  }
  private useTank(): void {
    if (this.eTanks <= 0 || this.hp >= PLAYER.maxHp || this.dead > 0 || this.endT >= 0) return;
    this.eTanks--;
    this.hp = PLAYER.maxHp;
    this.rewardMsg = 'E 罐：生命全滿';
    this.rewardT = 1.5;
    this.sound.play('pick');
  }
  private useMTank(): void {
    if (this.mTanks <= 0 || this.dead > 0 || this.endT >= 0) return;
    const needsAmmo = this.weapons.some((w) => w !== 'buster' && this.ammo[w] < PLAYER.maxAmmo);
    if (this.hp >= PLAYER.maxHp && !needsAmmo) return;
    this.mTanks--;
    this.hp = PLAYER.maxHp;
    for (const w of this.weapons) if (w !== 'buster') this.ammo[w] = PLAYER.maxAmmo;
    this.rewardMsg = 'M 罐：生命與武器全滿';
    this.rewardT = 1.8;
    this.sound.play('pick');
  }
  private get W(): number { return this.width; }
  private get levelW(): number { return this.lv.cols * TILE; }

  private spawnPlayer(): void {
    this.p = { x: this.checkpoint.x + 6, y: this.checkpoint.y + TILE - PLAYER.hitH, w: PLAYER.hitW, h: PLAYER.hitH, vx: 0, vy: 0, onGround: false, hitWall: false };
    this.hp = PLAYER.maxHp;
    this.iframes = 1; this.knock = 0; this.slideT = 0; this.climbing = false; this.charge = 0; this.dead = 0;
    this.enemies = []; this.shots = []; this.killed.clear();
    this.inRoom = false; this.doorClosed = false; this.boss = null; this.bossBar = 0;
    this.rewardT = 0;
    // Refill the boss queue on every (re)spawn so dying in the boss room never loses the boss.
    if (this.stageKey === 'final') this.bossQueue = CHARACTERS.filter((c) => c.key !== this.hero.key && !this.rushDone.has(c.key)).map((c) => c.key);
    else if (this.stageKey === 'citadel') { this.bossQueue = []; this.finalPhase = this.finalPhaseDone; }
    else this.bossQueue = [this.stageKey];
    this.life++;
    // Reopen the door.
    for (const r of this.lv.doorRows) this.lv.tiles[r][this.lv.roomCol] = T_EMPTY;
  }
  private rushDone = new Set<string>();
  /** Bumped on each respawn; delayed calls from an older life are ignored. */
  private life = 0;

  // ── tiles ──
  private tile(c: number, r: number): number {
    if (c < 0 || c >= this.lv.cols) return T_WALL;
    if (r < 0 || r >= ROWS) return T_EMPTY;
    return this.lv.tiles[r][c];
  }
  private solidAt(x: number, y: number): boolean { return isSolid(this.tile(Math.floor(x / TILE), Math.floor(y / TILE))); }

  private move(b: Body, dt: number, drop = false): number {
    b.hitWall = false;
    // X
    b.x += b.vx * dt;
    const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.01) / TILE);
    if (b.vx > 0) {
      const c = Math.floor((b.x + b.w - 0.01) / TILE);
      for (let r = r0; r <= r1; r++) if (isSolid(this.tile(c, r))) { b.x = c * TILE - b.w; b.vx = 0; b.hitWall = true; break; }
    } else if (b.vx < 0) {
      const c = Math.floor(b.x / TILE);
      for (let r = r0; r <= r1; r++) if (isSolid(this.tile(c, r))) { b.x = (c + 1) * TILE; b.vx = 0; b.hitWall = true; break; }
    }
    // Y
    const prevBottom = b.y + b.h;
    b.y += b.vy * dt;
    const wasGround = b.onGround;
    b.onGround = false;
    const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.01) / TILE);
    let carry = 0;
    if (b.vy >= 0) {
      const r = Math.floor((b.y + b.h - 0.01) / TILE);
      for (let c = c0; c <= c1; c++) {
        const t = this.tile(c, r);
        if (isSolid(t) || (!drop && isOneWay(t) && prevBottom <= r * TILE + 0.5)) { b.y = r * TILE - b.h; b.vy = 0; b.onGround = true; break; }
      }
      for (const m of this.movers) {
        if (b.x + b.w > m.x && b.x < m.x + m.w && prevBottom <= m.y + 1 + Math.max(0, m.dy) && b.y + b.h >= m.y) {
          b.y = m.y - b.h; b.vy = 0; b.onGround = true; carry = m.dx;
        }
      }
    } else {
      const r = Math.floor(b.y / TILE);
      for (let c = c0; c <= c1; c++) if (isSolid(this.tile(c, r))) { b.y = (r + 1) * TILE; b.vy = 0; break; }
    }
    if (carry) b.x += carry;
    return b.onGround && !wasGround ? 1 : 0;
  }

  private overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    if (this.input.keys.pause.pressed) { this.paused = !this.paused; return; }
    if (this.paused) return;
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.rewardT > 0) this.rewardT -= dt;
    if (this.input.keys.quit.pressed) { run.outcome = 'none'; this.game.go('stages'); return; }
    this.tickPending(dt);

    for (const m of this.movers) {
      m.t += dt;
      const k = (1 - Math.cos((m.t / 4) * Math.PI * 2)) / 2;
      const nx = m.axis === 'x' ? m.x0 + k * m.range : m.x0;
      const ny = m.axis === 'y' ? m.y0 - k * m.range : m.y0;
      m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
    }

    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 3.5) this.finish();
      this.updateShots(dt);
      return;
    }

    if (this.dead > 0) {
      this.dead += dt;
      if (this.dead > 2.2) {
        this.lives--;
        if (this.lives < 0) { run.outcome = 'lose'; run.message = 'GAME OVER'; this.game.go('stages'); return; }
        this.spawnPlayer();
      }
      return;
    }

    if (this.input.keys.useTank.pressed) this.useTank();
    if (this.input.keys.useMTank.pressed) this.useMTank();
    this.updatePlayer(dt);
    this.spawnEnemies();
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updatePickups(dt);

    // Camera.
    const W = this.W;
    if (this.inRoom) {
      const roomX = this.lv.roomCol * TILE;
      this.camX += (clamp(roomX + (ROOM_COLS * TILE - W) / 2, 0, this.levelW - W) - this.camX) * Math.min(1, dt * 6);
    } else {
      this.camX = clamp(this.p.x + this.p.w / 2 - W / 2, 0, Math.max(0, this.lv.roomCol * TILE + 4 * TILE - W));
    }
    this.camera.x = this.camX;
    this.camera.y = 0;
  }

  private get weaponKey(): string { return this.weapons[this.wi]; }

  private updatePlayer(dt: number): void {
    const k = this.input.keys, p = this.p;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.shootAnim > 0) this.shootAnim -= dt;
    if (k.prev.pressed) { this.wi = (this.wi + this.weapons.length - 1) % this.weapons.length; this.sound.play('pick'); }
    if (k.next.pressed) { this.wi = (this.wi + 1) % this.weapons.length; this.sound.play('pick'); }

    const dir = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0);
    const cx = Math.floor((p.x + p.w / 2) / TILE);
    const midR = Math.floor((p.y + p.h / 2) / TILE);
    const footR = Math.floor((p.y + p.h + 2) / TILE);

    if (this.knock > 0) {
      this.knock -= dt;
      p.vx = -this.facing * 70;
      p.vy = Math.min(p.vy + GRAVITY * dt, 600);
      this.move(p, dt);
    } else if (this.climbing) {
      p.vx = 0;
      p.vy = (k.down.held ? 1 : 0) * PLAYER.climb - (k.up.held ? 1 : 0) * PLAYER.climb;
      p.y += p.vy * dt;
      const onLadder = isLadder(this.tile(cx, midR)) || isLadder(this.tile(cx, Math.floor((p.y + p.h - 1) / TILE)));
      if (!onLadder || k.jump.pressed) this.climbing = false;
      if (p.vy > 0 && isSolid(this.tile(cx, Math.floor((p.y + p.h) / TILE)))) { this.climbing = false; p.y = Math.floor((p.y + p.h) / TILE) * TILE - p.h; }
      // Climbed out of the top.
      if (p.vy < 0 && !isLadder(this.tile(cx, Math.floor((p.y + p.h - 4) / TILE)))) {
        this.climbing = false;
        p.y = Math.floor((p.y + p.h) / TILE) * TILE - p.h;
      }
    } else if (this.slideT > 0) {
      this.slideT -= dt;
      p.vx = this.facing * PLAYER.slideSpeed;
      p.vy = Math.min(p.vy + GRAVITY * dt, 600);
      this.move(p, dt);
      const blocked = this.solidAt(p.x + 1, p.y + p.h - PLAYER.hitH) || this.solidAt(p.x + p.w - 1, p.y + p.h - PLAYER.hitH);
      if ((this.slideT <= 0 || !p.onGround || (k.jump.pressed && !k.down.held)) && !blocked) {
        this.slideT = 0;
        p.y = p.y + p.h - PLAYER.hitH; p.h = PLAYER.hitH;
      } else if (this.slideT <= 0) this.slideT = 0.05;
    } else {
      // Ladders.
      if ((k.up.held && isLadder(this.tile(cx, midR))) || (k.down.held && p.onGround && this.tile(cx, footR) === T_LADDER_TOP)) {
        this.climbing = true;
        p.x = cx * TILE + TILE / 2 - p.w / 2;
        if (k.down.held && p.onGround) p.y += 10;
        p.vy = 0;
        return;
      }
      p.vx = dir * PLAYER.run;
      if (dir) this.facing = dir;
      if (p.onGround) this.coyote = PLAYER.coyote; else this.coyote -= dt;
      if (k.jump.pressed) {
        if (k.down.held && p.onGround) {
          this.slideT = PLAYER.slideTime;
          p.y = p.y + p.h - PLAYER.slideH; p.h = PLAYER.slideH;
        } else if (this.coyote > 0) { p.vy = -PLAYER.jump; this.coyote = 0; this.sound.play('jump'); }
      }
      if (!k.jump.held && p.vy < -PLAYER.jumpCut) p.vy = -PLAYER.jumpCut;
      p.vy = Math.min(p.vy + GRAVITY * dt, 620);
      if (this.move(p, dt)) this.sound.play('land');
    }
    // Keep out of the closed boss door / level edges.
    p.x = clamp(p.x, 0, this.levelW - p.w);
    if (this.inRoom) p.x = Math.max(p.x, (this.lv.roomCol + 1) * TILE);

    // Shooting.
    const wk = this.weaponKey;
    if (k.shoot.pressed && this.slideT <= 0) this.fire(0);
    if (wk === 'buster') {
      if (k.shoot.held) this.charge += dt;
      else {
        if (this.charge >= PLAYER.chargeMid) this.fire(this.charge >= PLAYER.chargeFull ? 2 : 1);
        this.charge = 0;
      }
    } else this.charge = 0;

    // Hazards.
    const feetT = this.tile(Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + p.h - 2) / TILE));
    if (feetT === T_SPIKE || this.tile(Math.floor((p.x + 3) / TILE), Math.floor((p.y + p.h + 1) / TILE)) === T_SPIKE && p.onGround) this.die();
    if (p.y > ROWS * TILE + 40) this.die();

    // Checkpoints.
    for (const c of this.lv.checkpoints) if (p.x > c.col * TILE && this.checkpoint.x < c.col * TILE) { this.checkpoint = { x: c.col * TILE, y: c.row * TILE }; this.say('中繼點', 0.8); }

    // Boss room entry.
    if (!this.inRoom && p.x > (this.lv.roomCol + 2) * TILE) this.enterRoom();
  }

  private fire(charge: number): void {
    const p = this.p, wk = this.weaponKey;
    const hx = this.facing > 0 ? p.x + p.w + 6 : p.x - 6;
    const hy = p.y + 22;
    const mk = (kind: WeaponKind, vx: number, vy: number, r: number, dmg: number, color: string, pierce = false): Shot =>
      ({ x: hx, y: hy, vx, vy, r, kind, dmg, pierce, enemy: false, life: 1.6, t: 0, color, charge, baseY: hy, weapon: wk, hits: new Set() });
    if (wk === 'buster') {
      if (charge === 0 && this.shots.filter((s) => !s.enemy && s.kind === 'buster').length >= 3) return;
      const s = mk('buster', this.facing * 430, 0, charge === 2 ? 14 : charge === 1 ? 9 : 5, charge === 2 ? 3 : charge === 1 ? 2 : 1, charge ? '#9ff7ff' : BUSTER.color, charge === 2);
      this.shots.push(s);
      this.sound.play(charge ? 'charged' : 'shoot');
    } else {
      const h = getHero(wk);
      if (this.ammo[wk] < h.weapon.cost) return;
      if (h.weapon.kind === 'rapid' && this.shots.filter((s) => !s.enemy && s.kind === 'rapid').length >= 6) return;
      this.ammo[wk] -= h.weapon.cost;
      this.shots.push(...this.weaponShots(h, hx, hy, this.facing, false));
      this.sound.play('shoot');
    }
    this.shootAnim = 0.2;
  }

  /** Shots for a boss weapon (used by both the player and the bosses). */
  private weaponShots(h: Hero, x: number, y: number, dir: number, enemy: boolean): Shot[] {
    const c = h.weapon.color, k = h.weapon.kind;
    const base = (vx: number, vy: number, r: number, dmg: number, pierce: boolean, life = 1.8): Shot =>
      ({ x, y, vx, vy, r, kind: k, dmg, pierce, enemy, life, t: 0, color: c, charge: 0, baseY: y, weapon: h.key, hits: new Set() });
    const sp = enemy ? 0.75 : 1;
    switch (k) {
      case 'bubble': return [base(dir * 170 * sp, 0, 10, 2, false, 3)];
      case 'ice': return [base(dir * 520 * sp, 0, 7, 2, true)];
      case 'bounce': return [base(dir * 260 * sp, -220, 8, 2, false, 2.6)];
      case 'rapid': return [base(dir * 480 * sp, (rng() - 0.5) * 30, 4, 1, false)];
      case 'claw': return [base(dir * 330 * sp, 0, 14, 3, true, 1.6)];
      case 'book': return [base(dir * 380 * sp, 0, 10, 2, true, 1.6)];
      case 'fire3': return [-0.25, 0, 0.25].map((a) => base(Math.cos(a) * dir * 360 * sp, Math.sin(a) * 360 * sp, 7, 2, false));
      case 'whirl': return [base(dir * 220 * sp, -170 * sp, 12, 2, true, 1.8)];
      default: return [base(dir * 430, 0, 5, 1, false)];
    }
  }

  private hurt(dmg: number, fromX: number): void {
    if (this.iframes > 0 || this.dead > 0 || this.endT >= 0) return;
    this.hp -= dmg;
    this.iframes = PLAYER.iframes;
    this.knock = PLAYER.knockback;
    this.facing = fromX > this.p.x ? 1 : -1;
    this.climbing = false;
    this.sound.play('hurt');
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (this.dead > 0) return;
    this.hp = 0;
    this.dead = 0.001;
    this.sound.play('boom');
    const cx = this.p.x + this.p.w / 2, cy = this.p.y + this.p.h / 2;
    this.game.fx.emit({ x: cx, y: cy, count: 16, speed: 200, speedVar: 0, even: true, life: 1.2, size: 10, shrink: false, colors: ['#9ff7ff', '#ffffff'], add: true });
    this.game.fx.emit({ x: cx, y: cy, count: 16, speed: 110, speedVar: 0, even: true, life: 1.2, size: 8, shrink: false, colors: ['#9ff7ff'], add: true });
    this.sound.stopMusic({ fadeOut: 0.3 });
    this.schedule(2.3, () => this.sound.music(ART.stageMusic, { loop: true, volume: 0.3 }));
  }

  // ── enemies ──
  private spawnEnemies(): void {
    const x0 = this.camX - TILE, x1 = this.camX + this.W + TILE;
    this.lv.entities.forEach((e, i) => {
      if (e.type !== 'W' && e.type !== 'F' && e.type !== 'T') return;
      const ex = e.col * TILE;
      if (ex < x0 || ex > x1 || this.killed.has(i) || this.enemies.some((q) => q.spawn === i)) return;
      // Only spawn at the screen edge (classic), not in the player's face.
      if (ex > this.camX + TILE * 2 && ex < this.camX + this.W - TILE * 2 && this.t > 0.2) return;
      const size = e.type === 'W' ? { w: 30, h: 34 } : e.type === 'F' ? { w: 34, h: 26 } : { w: 32, h: 30 };
      const b: Body = { x: ex, y: e.row * TILE + TILE - size.h, w: size.w, h: size.h, vx: 0, vy: 0, onGround: false, hitWall: false };
      if (e.type === 'F') b.y = e.row * TILE;
      this.enemies.push({ type: e.type, b, hp: e.type === 'W' ? 2 : e.type === 'F' ? 1 : 3, dir: -1, t: rng() * 3, fire: 1 + rng(), baseY: b.y, spawn: i, flash: 0 });
    });
  }

  private updateEnemies(dt: number): void {
    const p = this.p;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i], b = e.b;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (b.x < this.camX - this.W || b.x > this.camX + this.W * 2) { this.enemies.splice(i, 1); continue; }
      if (e.type === 'W') {
        b.vx = e.dir * 60;
        b.vy = Math.min(b.vy + GRAVITY * dt, 600);
        this.move(b, dt);
        const aheadX = e.dir > 0 ? b.x + b.w + 2 : b.x - 2;
        const ledge = b.onGround && !isSolid(this.tile(Math.floor(aheadX / TILE), Math.floor((b.y + b.h + 2) / TILE))) && !isOneWay(this.tile(Math.floor(aheadX / TILE), Math.floor((b.y + b.h + 2) / TILE)));
        if (b.hitWall || ledge) e.dir = -e.dir;
        if (b.y > ROWS * TILE) { this.enemies.splice(i, 1); continue; }
      } else if (e.type === 'F') {
        const dx = p.x - b.x, dy = p.y - b.y;
        if (Math.abs(dx) < 260) { b.x += Math.sign(dx) * 70 * dt; b.y += Math.sign(dy) * 40 * dt; }
        else b.y = e.baseY + Math.sin(e.t * 2.5) * 20;
        e.dir = dx > 0 ? 1 : -1;
      } else {
        e.dir = p.x > b.x ? 1 : -1;
        e.fire -= dt;
        if (e.fire <= 0 && Math.abs(p.x - b.x) < 420) {
          e.fire = 1.8;
          const ang = Math.atan2(p.y + 20 - (b.y + 10), p.x - b.x);
          this.shots.push({ x: b.x + b.w / 2, y: b.y + 10, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, r: 5, kind: 'buster', dmg: 3, pierce: false, enemy: true, life: 3, t: 0, color: '#ff6b6b', charge: 0, baseY: 0, weapon: 'enemy', hits: new Set() });
        }
      }
      if (this.dead <= 0 && this.overlaps(b, p)) this.hurt(3, b.x);
    }
  }

  private killEnemy(i: number): void {
    const e = this.enemies[i];
    this.killed.add(e.spawn);
    this.enemies.splice(i, 1);
    this.sound.play('boom');
    this.game.fx.emit({ x: e.b.x + e.b.w / 2, y: e.b.y + e.b.h / 2, count: 14, speed: 140, life: 0.4, size: 5, ramp: 'fire', add: true });
    const r = rng();
    if (r < 0.01) this.pickups.push({ x: e.b.x + e.b.w / 2, y: e.b.y, kind: 'm', big: true, t: 0, spawn: -1 });
    else if (r < 0.04) this.pickups.push({ x: e.b.x + e.b.w / 2, y: e.b.y, kind: 'e', big: true, t: 0, spawn: -1 });
    else if (r < 0.29) this.pickups.push({ x: e.b.x + e.b.w / 2, y: e.b.y, kind: r < 0.17 ? 'h' : 'a', big: false, t: 0, spawn: -1 });
  }

  // ── boss ──
  private enterRoom(): void {
    this.inRoom = true;
    if (this.stageKey === 'citadel') this.checkpoint = { x: (this.lv.roomCol + 3) * TILE, y: 10 * TILE };
    this.sound.play('door');
    const life = this.life;
    this.schedule(0.6, () => {
      if (life !== this.life || this.dead > 0) return;
      for (const r of this.lv.doorRows) this.lv.tiles[r][this.lv.roomCol] = T_WALL;
      this.doorClosed = true;
      this.sound.music(ART.bossMusic, { loop: true, volume: 0.32 });
      this.nextBoss();
    });
  }

  private nextBoss(): void {
    let h: Hero;
    let phase = 0;
    let hp: number;
    if (this.stageKey === 'citadel') {
      if (this.finalPhase >= FINAL_BOSS_PHASES.length) return;
      phase = ++this.finalPhase;
      const form = FINAL_BOSS_PHASES[phase - 1];
      h = {
        key: 'citadelBoss', name: '終焉守護者', title: form.name, stage: CITADEL.stage,
        weakTo: form.weakTo, palette: CITADEL.palette,
        weapon: { name: form.name, kind: form.attackKind, color: form.color, cost: 0, desc: '' },
      };
      hp = form.hp;
      this.shots = this.shots.filter((s) => !s.enemy);
    } else {
      const key = this.bossQueue.shift();
      if (!key) return;
      h = getHero(key);
      hp = this.stageKey === 'final' ? BOSS.rushBossHp : BOSS.maxHp;
    }
    const roomX = this.lv.roomCol * TILE;
    this.boss = { hero: h, b: { x: roomX + ROOM_COLS * TILE - 5 * TILE, y: TILE + 2, w: BOSS.hitW, h: BOSS.hitH, vx: 0, vy: 0, onGround: false, hitWall: false }, hp, state: 'intro', t: 0, facing: -1, iframes: 0, shotsLeft: 0, phase };
    this.bossBar = 0;
    this.say(phase ? `${h.name}　第${phase}形態・${h.title}` : `${h.name}　${h.title}`, 1.8);
  }

  private updateBoss(dt: number): void {
    const B = this.boss;
    if (!B) return;
    const b = B.b, p = this.p;
    B.t += dt;
    if (B.iframes > 0) B.iframes -= dt;
    const maxHp = B.phase ? FINAL_BOSS_PHASES[B.phase - 1].hp : this.stageKey === 'final' ? BOSS.rushBossHp : BOSS.maxHp;
    const rush = B.hp <= maxHp / 2;
    const speed = (rush ? 1.35 : 1) * (B.phase ? 1 + (B.phase - 1) * 0.15 : 1);
    if (B.state === 'intro') {
      b.vy = Math.min(b.vy + GRAVITY * dt, 700);
      this.move(b, dt);
      if (b.onGround) this.bossBar = Math.min(maxHp, this.bossBar + dt * 30);
      if (this.bossBar >= maxHp) { B.state = 'idle'; B.t = 0; }
      return;
    }
    if (B.state === 'dead') return;
    B.facing = p.x > b.x ? 1 : -1;
    b.vy = Math.min(b.vy + GRAVITY * dt, 700);
    switch (B.state) {
      case 'idle':
        b.vx = 0;
        if (B.t > 0.8 / speed) {
          const r = rng();
          B.t = 0;
          if (r < 0.4) { B.state = 'jump'; b.vy = -560; b.vx = B.facing * (140 + rng() * 120) * speed; }
          else if (r < 0.8) { B.state = 'shoot'; B.shotsLeft = rush ? 3 : 2; }
          else { B.state = 'dash'; b.vx = B.facing * 300 * speed; }
        }
        break;
      case 'jump':
        if (b.onGround && B.t > 0.2) { B.state = 'idle'; B.t = 0; if (rng() < 0.5) { B.state = 'shoot'; B.shotsLeft = 1; } }
        break;
      case 'shoot':
        b.vx = 0;
        if (B.t > 0.45 / speed) {
          B.t = 0;
          this.shots.push(...this.weaponShots(B.hero, b.x + b.w / 2 + B.facing * 20, b.y + 40, B.facing, true));
          this.sound.play('shoot');
          if (--B.shotsLeft <= 0) B.state = 'idle';
        }
        break;
      case 'dash':
        if (b.hitWall || B.t > 0.9) { B.state = 'idle'; B.t = 0; b.vx = 0; }
        break;
    }
    this.move(b, dt);
    const roomX = this.lv.roomCol * TILE;
    b.x = clamp(b.x, roomX + TILE, roomX + (ROOM_COLS - 1) * TILE - b.w);
    if (this.dead <= 0 && this.overlaps(b, p)) this.hurt(BOSS.contact + (B.phase ? B.phase - 1 : 0), b.x);
  }

  private hitBoss(s: Shot): void {
    const B = this.boss;
    if (!B || B.state === 'intro' || B.state === 'dead' || B.iframes > 0) return;
    const dmg = B.phase ? finalBossDamage(B.phase, s.weapon, s.charge) : bossDamage(B.hero.key, this.hero.key, s.weapon === 'buster' ? 'buster' : s.weapon, s.charge);
    B.hp -= dmg;
    B.iframes = BOSS.iframes;
    this.sound.play('hit');
    if (dmg >= 4) { this.say('弱點命中！', 0.6); this.camera.shake(4, 0.2); }
    if (B.hp <= 0) {
      B.hp = 0; B.state = 'dead';
      this.sound.play('boom');
      const cx = B.b.x + B.b.w / 2, cy = B.b.y + B.b.h / 2;
      for (let i = 0; i < 3; i++) this.schedule(i * 0.25, () => this.game.fx.emit({ x: cx, y: cy, count: 20, speed: 120 + i * 60, speedVar: 0, even: true, life: 1.4, size: 10, shrink: false, colors: [B.hero.weapon.color, '#ffffff'], add: true }));
      const life = this.life;
      this.schedule(1.2, () => {
        if (life !== this.life) return;
        if (this.stageKey === 'citadel') {
          this.finalPhaseDone = Math.max(this.finalPhaseDone, B.phase);
          if (this.finalPhaseDone < FINAL_BOSS_PHASES.length) Progress.markCitadelPhase(this.hero.key, this.finalPhaseDone);
          this.boss = null;
          if (this.finalPhaseDone < FINAL_BOSS_PHASES.length) { this.nextBoss(); return; }
          this.win();
          return;
        }
        const wasDefeated = this.rushDone.has(B.hero.key);
        this.rushDone.add(B.hero.key);
        if (this.stageKey === 'final' && !wasDefeated) {
          const reward = fortressBossReward(this.hp, this.lives, this.rushDone.size);
          this.hp = reward.hp;
          this.lives = reward.lives;
          this.rewardMsg = `生命 +${FORTRESS_REWARDS.heal}${reward.extraLife ? '　殘機 +1' : ''}`;
          this.rewardT = 2.4;
          this.sound.play('pick');
        }
        this.boss = null;
        if (this.bossQueue.length) { this.nextBoss(); return; }
        if (this.stageKey === 'final') {
          Progress.markCitadelReached(this.hero.key);
          run.fortressCarry = { hp: this.hp, lives: this.lives, ammo: { ...this.ammo }, eTanks: this.eTanks, mTanks: this.mTanks };
          run.stage = 'citadel';
          this.sound.stopMusic({ fadeOut: 0.3 });
          this.game.go('play');
          return;
        }
        this.win();
      });
    }
  }

  private win(): void {
    this.sound.stopMusic({ fadeOut: 0.5 });
    this.sound.play({ notes: 'C5 E5 G5 C6 E6 G6 C7:4', step: 0.1, type: 'square', volume: 0.35 });
    this.endT = 0;
    if (this.stageKey === 'citadel') {
      Progress.markCleared(this.hero.key);
      run.outcome = 'ending';
      this.say('要塞攻破！', 3);
    } else {
      Progress.markBeaten(this.hero.key, this.stageKey);
      const h = getHero(this.stageKey);
      run.outcome = 'win';
      run.message = `取得武器：${h.weapon.name}！`;
      this.say(run.message, 3);
    }
  }

  private finish(): void {
    if (run.outcome === 'ending') this.gotoGameOver({ ending: true });
    else this.game.go('stages');
  }

  // ── shots & pickups ──
  private updateShots(dt: number): void {
    const p = this.p;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt; s.life -= dt;
      switch (s.kind) {
        case 'bubble': s.x += s.vx * dt; s.y = s.baseY + Math.sin(s.t * 6) * 14; break;
        case 'bounce':
          s.vy += 500 * dt;
          s.x += s.vx * dt; if (this.solidAt(s.x, s.y)) { s.vx = -s.vx; s.x += s.vx * dt * 2; }
          s.y += s.vy * dt; if (this.solidAt(s.x, s.y + s.r)) { s.vy = -Math.abs(s.vy) * 0.9 - 120; s.y -= 2; }
          break;
        case 'claw': {
          s.x += s.vx * dt;
          let gy = s.y;
          for (let r = Math.floor(s.baseY / TILE); r < ROWS; r++) if (isSolid(this.tile(Math.floor(s.x / TILE), r)) || this.tile(Math.floor(s.x / TILE), r) === T_TOP) { gy = r * TILE - s.r; break; }
          s.y += (gy - s.y) * Math.min(1, dt * 12);
          break;
        }
        case 'book':
          if (s.t > 0.5) { const tx = s.enemy && this.boss ? this.boss.b.x : p.x; s.vx += Math.sign(tx - s.x) * 1400 * dt; s.vx = clamp(s.vx, -420, 420); }
          s.x += s.vx * dt;
          if (!s.enemy && s.t > 0.8 && Math.abs(s.x - p.x) < 20) s.life = 0;
          break;
        default: s.x += s.vx * dt; s.y += s.vy * dt;
      }
      if (s.kind !== 'bounce' && s.kind !== 'book' && s.kind !== 'claw' && s.kind !== 'whirl' && this.solidAt(s.x, s.y)) s.life = 0;
      if (s.x < this.camX - 60 || s.x > this.camX + this.W + 60) s.life = 0;
      if (s.life <= 0) { this.shots.splice(i, 1); continue; }

      const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.enemy) {
        if (this.dead <= 0 && this.overlaps(box, p)) { this.hurt(s.dmg + (this.boss ? 1 : 0), s.x); this.shots.splice(i, 1); }
        continue;
      }
      let used = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (s.hits.has(e) || !this.overlaps(box, e.b)) continue;
        s.hits.add(e);
        e.hp -= s.dmg; e.flash = 0.1;
        this.sound.play('hit');
        if (e.hp <= 0) this.killEnemy(j);
        if (!s.pierce) { used = true; break; }
      }
      if (!used && this.boss && !s.hits.has(this.boss) && this.overlaps(box, this.boss.b)) {
        s.hits.add(this.boss);
        this.hitBoss(s);
        if (!s.pierce) used = true;
      }
      if (used) this.shots.splice(i, 1);
    }
  }

  private updatePickups(dt: number): void {
    const p = this.p;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      if (k.spawn >= 0 && this.taken.has(k.spawn)) { this.pickups.splice(i, 1); continue; }
      if (k.spawn < 0) {
        // Dropped pickups fall to the floor and fade after 6 s.
        if (!this.solidAt(k.x, k.y + 8) && !isOneWay(this.tile(Math.floor(k.x / TILE), Math.floor((k.y + 8) / TILE)))) k.y += 200 * dt;
        if (k.t > 6) { this.pickups.splice(i, 1); continue; }
      }
      if (this.overlaps({ x: k.x - 10, y: k.y - 10, w: 20, h: 20 }, p)) {
        const amt = k.big ? 10 : 4;
        if (k.kind === 'h') this.hp = Math.min(PLAYER.maxHp, this.hp + amt);
        else if (k.kind === 'e') this.eTanks = Math.min(E_TANK.max, this.eTanks + 1);
        else if (k.kind === 'm') this.mTanks = Math.min(M_TANK.max, this.mTanks + 1);
        else { const w = this.weaponKey !== 'buster' ? this.weaponKey : this.weapons.find((x) => x !== 'buster' && this.ammo[x] < PLAYER.maxAmmo); if (w) this.ammo[w] = Math.min(PLAYER.maxAmmo, this.ammo[w] + amt); }
        if (k.spawn >= 0) this.taken.add(k.spawn);
        this.pickups.splice(i, 1);
        this.sound.play('pick');
      }
    }
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.W, H = this.height, g = this.game, pal = this.pal, cx = this.camX;
    // Parallax background.
    const bg = this.fr['bg_' + this.stageKey];
    const bw = 800 * (H / 448);
    const off = (cx * 0.3) % bw;
    for (let x = cx - off; x < cx + W; x += bw) d.sprite(bg, x, 0, { w: bw, h: H });
    d.rect(cx, 0, W, H, pal.sky, 0.25);

    // Tiles.
    const c0 = Math.max(0, Math.floor(cx / TILE)), c1 = Math.min(this.lv.cols - 1, Math.ceil((cx + W) / TILE));
    for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
      const t = this.lv.tiles[r][c];
      if (t === T_EMPTY) continue;
      const x = c * TILE, y = r * TILE;
      if (t === T_TOP || t === 0 || t === T_WALL) {
        d.rect(x, y, TILE, TILE, t === T_WALL ? pal.detail : pal.ground);
        d.rect(x + 2, y + 2, TILE - 4, TILE - 4, t === T_WALL ? pal.ground : pal.detail, 0.35);
        if (t === T_TOP) { d.rect(x, y, TILE, 8, pal.top); d.rect(x, y + 8, TILE, 2, pal.accent, 0.6); }
      } else if (t === T_SPIKE) {
        for (let k = 0; k < 4; k++) d.fill([{ x: x + k * 8, y: y + TILE }, { x: x + k * 8 + 4, y: y + 8 }, { x: x + k * 8 + 8, y: y + TILE }], '#e6e6f0');
      } else if (t === T_LADDER || t === T_LADDER_TOP) {
        d.rect(x + 6, y, 4, TILE, pal.accent); d.rect(x + TILE - 10, y, 4, TILE, pal.accent);
        for (let k = 4; k < TILE; k += 9) d.rect(x + 6, y + k, TILE - 12, 3, pal.accent);
      } else if (t === T_PLATFORM) {
        d.rect(x, y, TILE, 10, pal.top); d.rect(x, y + 10, TILE, 3, pal.detail);
      }
    }
    for (const m of this.movers) { d.rect(m.x, m.y, m.w, 14, pal.accent); d.rect(m.x, m.y + 14, m.w, 4, pal.detail); d.rect(m.x + 4, m.y + 3, m.w - 8, 3, '#ffffff', 0.5); }
    // Checkpoints.
    for (const c of this.lv.checkpoints) {
      const x = c.col * TILE + 14, y = c.row * TILE + TILE;
      d.rect(x, y - 48, 4, 48, '#dddddd');
      d.fill([{ x: x + 4, y: y - 48 }, { x: x + 28, y: y - 40 }, { x: x + 4, y: y - 32 }], this.checkpoint.x >= c.col * TILE ? '#5cffb0' : '#ff6b6b');
    }
    // Pickups.
    for (const k of this.pickups) {
      const s = k.big ? 1 : 0.65, bob = Math.sin(k.t * 5) * 2;
      const col = k.kind === 'h' ? '#ff5f7a' : k.kind === 'e' ? '#65ffc4' : k.kind === 'm' ? '#e8aaff' : '#5cc8ff';
      d.rect(k.x - 9 * s, k.y - 7 * s + bob, 18 * s, 14 * s, '#ffffff');
      d.rect(k.x - 7 * s, k.y - 5 * s + bob, 14 * s, 10 * s, col);
      if (k.kind === 'e' || k.kind === 'm') label(d, g, k.kind.toUpperCase(), k.x, k.y + bob, { size: 12, color: '#102b2b', weight: 900 });
    }
    // Enemies.
    for (const e of this.enemies) {
      const f = e.type === 'W' ? this.fr.walker : e.type === 'F' ? this.fr.flyer : this.fr.turret;
      const sz = g.assets.frameSize(f);
      const h = e.type === 'W' ? 40 : e.type === 'F' ? 30 : 34;
      const w = (sz.w / sz.h) * h;
      d.sprite(f, e.b.x + e.b.w / 2 - w / 2, e.b.y + e.b.h - h + (e.type === 'F' ? 4 : 0), { w, h, flipX: e.type === 'W' ? e.dir > 0 : e.dir > 0, tint: e.flash > 0 ? '#ff8080' : undefined });
    }
    // Boss.
    const B = this.boss;
    if (B && !(B.state === 'dead')) {
      const f = B.phase ? this.fr['boss' + B.phase] : this.fr[B.hero.key];
      const sz = g.assets.frameSize(f), h = BOSS.h * (B.phase ? 1 + (B.phase - 1) * 0.12 : 1), w = (sz.w / sz.h) * h;
      const blink = B.iframes > 0 && Math.floor(this.t * 20) % 2 === 0;
      if (!blink) d.sprite(f, B.b.x + B.b.w / 2 - w / 2, B.b.y + B.b.h - h + 6, { w, h, flipX: B.facing < 0, tint: B.state === 'shoot' ? '#ffe0e0' : undefined });
    }
    // Player.
    if (this.dead <= 0) {
      const p = this.p;
      const blink = this.iframes > 0 && Math.floor(this.t * 20) % 2 === 0;
      if (!blink) {
        const f = this.fr[this.hero.key];
        const sz = g.assets.frameSize(f);
        const sliding = this.slideT > 0;
        // Full-size sprite; sliding lies it down feet-first (head low behind) instead of squashing.
        const h = PLAYER.h, w = (sz.w / sz.h) * PLAYER.h;
        const bob = p.onGround && Math.abs(p.vx) > 1 && !sliding ? Math.abs(Math.sin(this.t * 14)) * -3 : 0;
        const rot = sliding ? -1.35 * this.facing : this.climbing ? Math.sin(p.y * 0.1) * 0.08 : !p.onGround ? this.facing * -0.08 : 0;
        const chargeTint = this.charge > PLAYER.chargeFull ? (Math.floor(this.t * 16) % 2 ? '#9ff7ff' : undefined) : this.charge > PLAYER.chargeMid ? (Math.floor(this.t * 10) % 2 ? '#fff3a0' : undefined) : undefined;
        // Rotation is about the sprite centre: when sliding, park that centre low so the body hugs the floor.
        const cxp = p.x + p.w / 2 - (sliding ? this.facing * 6 : 0);
        const cyp = sliding ? p.y + p.h - 17 : p.y + p.h - h / 2 + 4 + bob;
        d.sprite(f, cxp - w / 2, cyp - h / 2, { w, h, flipX: this.facing < 0, rot, tint: chargeTint });
        if (sliding && Math.floor(this.t * 30) % 3 === 0) this.game.fx.emit({ x: p.x + p.w / 2 - this.facing * 12, y: p.y + p.h - 2, count: 1, speed: 40, angle: this.facing > 0 ? Math.PI : 0, spread: 0.6, life: 0.3, size: 4, color: '#ffffff', alpha: 0.7 });
        if (this.shootAnim > 0) d.circle(this.facing > 0 ? p.x + p.w + 6 : p.x - 6, p.y + 22, 6, '#ffffff', 0.8);
      }
    }
    // Shots.
    for (const s of this.shots) {
      if (s.kind === 'book') { d.rect(s.x - s.r, s.y - s.r * 0.7, s.r * 2, s.r * 1.4, s.color, 1, s.t * 12); continue; }
      if (s.kind === 'claw') { for (let k = -1; k <= 1; k++) d.line(s.x - 8 + k * 7, s.y + 10, s.x + 4 + k * 7, s.y - 12, 3, s.color); continue; }
      if (s.kind === 'whirl') { d.ring(s.x, s.y, s.r, 3, s.color); d.ring(s.x, s.y, s.r * 0.55, 2, '#ffffff'); continue; }
      d.circle(s.x, s.y, s.r, s.color);
      d.circle(s.x, s.y, s.r * 0.5, '#ffffff', 0.8);
    }
    this.drawBars(d, cx, W, H);
    if (this.paused) {
      d.rect(cx, 0, W, H, '#070b20', 0.78);
      label(d, g, '遊戲暫停', cx + W / 2, H * 0.42, { size: 42, color: '#ffe8a0', stroke: '#1b1040', strokeWidth: 6, weight: 900 });
      label(d, g, '按 P 繼續', cx + W / 2, H * 0.56, { size: 22, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    }
  }

  private drawBars(d: Draw, cx: number, W: number, H: number): void {
    const g = this.game;
    const bar = (x: number, v: number, max: number, col: string): void => {
      d.rect(x - 2, 14, 16, 116, '#000000', 0.75);
      const n = 28, seg = 112 / n;
      for (let i = 0; i < n; i++) {
        const on = i < Math.round((v / max) * n);
        d.rect(x, 16 + (n - 1 - i) * seg, 12, seg - 1, on ? col : '#ffffff', on ? 1 : 0.12);
      }
    };
    bar(cx + 18, Math.max(0, this.hp), PLAYER.maxHp, '#fff3a0');
    const wk = this.weaponKey;
    if (wk !== 'buster') bar(cx + 38, this.ammo[wk], PLAYER.maxAmmo, getHero(wk).weapon.color);
    if (this.stageKey === 'citadel') {
      FINAL_BOSS_PHASES.forEach((form, i) => {
        const phase = i + 1;
        const v = phase <= this.finalPhaseDone ? 0 : phase === this.boss?.phase
          ? this.boss.state === 'intro' ? this.bossBar : this.boss.hp : form.hp;
        bar(cx + W - 34 - i * 22, v, form.hp, form.color);
      });
      if (this.boss) label(d, g, `終焉守護者 ${this.boss.phase}/3`, cx + W - 125, 144, { size: 13, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
    } else if (this.boss && this.boss.state !== 'dead') {
      bar(cx + W - 34, this.boss.state === 'intro' ? this.bossBar : this.boss.hp, this.stageKey === 'final' ? BOSS.rushBossHp : BOSS.maxHp, '#ff6b6b');
    }
    const wname = wk === 'buster' ? BUSTER.name : getHero(wk).weapon.name;
    label(d, g, `${wname}　殘機 ×${Math.max(0, this.lives)}　E ×${this.eTanks}　M ×${this.mTanks}`, cx + 64, 20, { size: 14, color: '#ffffff', stroke: '#000000', strokeWidth: 3 }, 0, 0.5);
    if (this.weapons.length > 1) label(d, g, 'Q/E 切換武器　R E 罐　M M 罐　P 暫停', cx + 64, 40, { size: 11, color: '#cccccc', stroke: '#000000', strokeWidth: 3 }, 0, 0.5);
    if (this.msgT > 0) label(d, g, this.msg, cx + W / 2, H * 0.35, { size: 30, color: '#ffe066', stroke: '#1b1040', strokeWidth: 5, weight: 900 }, 0.5, 0.5, clamp(this.msgT * 2, 0, 1));
    if (this.rewardT > 0) label(d, g, this.rewardMsg, cx + W / 2, H * 0.45, { size: 24, color: '#96ffbf', stroke: '#1b1040', strokeWidth: 5, weight: 900 }, 0.5, 0.5, clamp(this.rewardT * 2, 0, 1));
    if (this.t < 6) label(d, g, '←→ 移動　Z 跳　X 射擊　↓+Z 滑行　R E 罐　M M 罐　P 暫停', cx + W / 2, H - 14, { size: 13, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
  }
}
