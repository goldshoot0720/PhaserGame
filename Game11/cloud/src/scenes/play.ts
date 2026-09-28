import { mobilePointer } from '../mobile.js';
// The sortie: a vertical-scrolling arcade shooter across two stages (2026 ocean, 2027 space).
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { label, panel, clamp } from '../ui.js';
import { preloadMenu, menuFrames, spriteC } from '../menu.js';
import {
  ART, PILOTS, PF_W, PF_H, SPEED, FOCUS_SPEED, HITBOX, FIRE_RATE, MISSILE_RATE, MAX_POWER, START_LIVES, START_BOMBS, MAX_BOMBS, INVULN, BOMB_TIME, BOMB_DMG,
  COLLECT_LINE, ENEMY, STAGES, BOSS_T, volley, missiles, orbiters, pathPos, stageWaves, ring, fan, aimAt, hit, bossPhase, extendsBetween,
  type Pilot, type EnemyKind, type Path, type Wave, type BulletKind,
} from '../rules.js';
import { session, saveHi } from '../session.js';

interface PB { x: number; y: number; vx: number; vy: number; dmg: number; r: number; pierce: boolean; homing: boolean; life: number; kind: BulletKind; color: string; hits: Set<Enemy> | null; }
interface EB { x: number; y: number; vx: number; vy: number; r: number; color: string; }
interface Enemy { kind: EnemyKind; path: Path; x0: number; idx: number; x: number; y: number; hp: number; max: number; r: number; age: number; fire: number; flash: number; boss: boolean; spin: number; t2: number; }
interface Item { x: number; y: number; vy: number; kind: 'P' | 'B' | 'M'; t: number; }
type Phase = 'intro' | 'play' | 'warning' | 'clear' | 'over' | 'win';
/** Test hook: ?god makes the ship untouchable (used by the headless play-test). */
const GOD = typeof location !== 'undefined' && location.search.includes('god');

export class Play extends Scene {
  private f: Record<string, number> = {};
  private pilot!: Pilot;
  private px = PF_W / 2;
  private py = PF_H - 100;
  private lives = START_LIVES;
  private bombs = START_BOMBS;
  private power = 1;
  private score = 0;
  private invuln = 2;
  private dead = 0;
  private bombT = 0;
  private fireT = 0;
  private missileT = 0;
  private pbs: PB[] = [];
  private ebs: EB[] = [];
  private enemies: Enemy[] = [];
  private items: Item[] = [];
  private waves: Wave[] = [];
  private spawnQ: { at: number; w: Wave; idx: number }[] = [];
  private stage = 0;
  private st = 0; // stage clock
  private phase: Phase = 'intro';
  private timer = 2.8;
  private kills = 0;
  private boss: Enemy | null = null;
  private scroll = 0;
  private t = 0;
  private x0 = 0;
  private bonus = 0;
  private focus = false;

  override preload(load: Preload): void { preloadMenu(load); for (const u of [ART.drone, ART.fighter, ART.bomber, ART.boss1, ART.boss2, ART.ocean, ART.space]) load.image(u); }

  override setup(): void {
    const a = this.game.assets;
    this.f = menuFrames(this.game);
    this.f.drone = a.framesOf(ART.drone); this.f.fighter = a.framesOf(ART.fighter, 58, 60); this.f.bomber = a.framesOf(ART.bomber, 101, 60);
    this.f.boss1 = a.framesOf(ART.boss1); this.f.boss2 = a.framesOf(ART.boss2); this.f.ocean = a.framesOf(ART.ocean); this.f.space = a.framesOf(ART.space);
    this.input.bind({ up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], slow: ['ShiftLeft', 'ShiftRight'], bomb: ['KeyX', 'Space'], quit: ['Escape'] });
    const sd = this.sound;
    sd.define('shot', { type: 'square', freq: 1400, freqEnd: 900, duration: 0.03, volume: 0.04 });
    sd.define('boom', { type: 'noise', duration: 0.35, curve: 'exponential', distortion: 0.3, volume: 0.35, filter: { type: 'lowpass', freq: 1600, freqEnd: 100 } });
    sd.define('big', { type: 'noise', duration: 1.1, curve: 'exponential', distortion: 0.4, volume: 0.6, filter: { type: 'lowpass', freq: 900, freqEnd: 60 } });
    sd.define('pop', { type: 'square', freq: 600, freqEnd: 200, duration: 0.06, volume: 0.12 });
    sd.define('item', { notes: 'E6 B6', step: 0.05, type: 'square', volume: 0.22 });
    sd.define('power', { notes: 'C5 E5 G5 C6 E6', step: 0.05, type: 'square', volume: 0.28 });
    sd.define('bomb', { type: 'noise', duration: 1.4, volume: 0.5, filter: { type: 'bandpass', freq: 300, freqEnd: 2000, q: 0.8 } });
    sd.define('die', { notes: 'G4 D4 A3 D3:3', step: 0.08, type: 'sawtooth', volume: 0.35 });
    sd.define('warn', { notes: 'A5 E5 A5 E5 A5 E5', step: 0.16, type: 'square', volume: 0.3 });
    sd.define('extend', { notes: 'C6 G5 C6 E6 G6 C7', step: 0.07, type: 'square', volume: 0.35 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
    this.pilot = PILOTS.find((p) => p.id === session.pilot) ?? PILOTS[0];
    this.startStage(0);
  }

  private startStage(s: number): void {
    this.stage = s; this.st = 0; this.waves = stageWaves(s); this.spawnQ = [];
    this.phase = 'intro'; this.timer = 2.8; this.boss = null;
    this.ebs = []; this.enemies = [];
    this.px = PF_W / 2; this.py = PF_H - 110;
  }

  // ── spawning ──
  private spawn(w: Wave, idx: number): void {
    const e = ENEMY[w.kind], boss = w.kind === 'boss1' || w.kind === 'boss2' || w.kind === 'midboss';
    const x = w.path === 'down' && w.count > 1 ? clamp(w.x + (idx - (w.count - 1) / 2) * 0.14, 0.08, 0.92) : w.x;
    const en: Enemy = { kind: w.kind, path: w.path, x0: x, idx, x: x * PF_W, y: -60, hp: e.hp * (1 + this.stage * 0.25), max: e.hp * (1 + this.stage * 0.25), r: e.r, age: 0, fire: 1 + Math.random(), flash: 0, boss, spin: 0, t2: 0 };
    this.enemies.push(en);
    if (w.kind === 'boss1' || w.kind === 'boss2') this.boss = en;
  }

  private eShoot(x: number, y: number, ang: number, speed: number, color = '#ff5ad0', r = 6): void {
    if (this.ebs.length > 700) return;
    const sp = speed * STAGES[this.stage].bulletSpeed;
    this.ebs.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r, color });
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    this.t += dt; this.timer -= dt;
    this.scroll += dt * (STAGES[this.stage].bg === 'space' ? 55 : 40);
    if (this.input.keys.quit.pressed) { this.gotoTitle(); return; }
    switch (this.phase) {
      case 'intro': if (this.timer <= 0) this.phase = 'play'; break;
      case 'warning': this.st += dt; if (this.timer <= 0) this.phase = 'play'; break;
      case 'clear':
        if (this.timer <= 0) {
          if (this.stage + 1 < STAGES.length) this.startStage(this.stage + 1);
          else { this.phase = 'win'; this.timer = 3; this.finish(true); }
        }
        break;
      case 'over': case 'win': if (this.timer <= 0) this.gotoGameOver(); break;
      case 'play': this.st += dt; this.schedule(); break;
    }
    this.updatePlayer(dt);
    this.updatePlayerBullets(dt);
    this.updateEnemies(dt);
    this.updateEnemyBullets(dt);
    this.updateItems(dt);
  }

  private schedule(): void {
    while (this.waves.length && this.waves[0].t <= this.st) {
      const w = this.waves.shift()!;
      if (w.t >= BOSS_T) { this.phase = 'warning'; this.timer = 2.4; this.sound.play('warn'); }
      for (let i = 0; i < w.count; i++) this.spawnQ.push({ at: this.st + (w.t >= BOSS_T ? 2.4 : 0) + i * w.gap, w, idx: i });
    }
    for (let i = this.spawnQ.length - 1; i >= 0; i--) if (this.spawnQ[i].at <= this.st) { this.spawn(this.spawnQ[i].w, this.spawnQ[i].idx); this.spawnQ.splice(i, 1); }
  }

  private get alive(): boolean { return this.dead <= 0 && this.phase !== 'over'; }

  private updatePlayer(dt: number): void {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.bombT > 0) this.bombT -= dt;
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) { this.px = PF_W / 2; this.py = PF_H - 90; this.invuln = INVULN; }
      return;
    }
    if (this.phase === 'over') return;
    const k = this.input.keys;
    this.focus = k.slow.held;
    const sp = this.focus ? FOCUS_SPEED : SPEED;
    let dx = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0), dy = (k.down.held ? 1 : 0) - (k.up.held ? 1 : 0);
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    this.px += dx * sp * dt; this.py += dy * sp * dt;
    // Touch / mouse: drag the ship (it sits a little above the finger).
    const ptr = mobilePointer(this.input.pointer);
    if (ptr?.isDown) {
      const tx = ptr.x - this.x0, ty = ptr.y - 70, ddx = tx - this.px, ddy = ty - this.py, d = Math.hypot(ddx, ddy);
      if (d > 2) { const m = Math.min(d, SPEED * 1.3 * dt); this.px += (ddx / d) * m; this.py += (ddy / d) * m; }
    }
    this.px = clamp(this.px, 16, PF_W - 16); this.py = clamp(this.py, 30, PF_H - 24);
    if (k.bomb.pressed) this.useBomb();
    // Auto-fire.
    if (this.phase === 'play' || this.phase === 'warning') {
      this.fireT -= dt; this.missileT -= dt;
      if (this.fireT <= 0) {
        this.fireT += FIRE_RATE;
        for (const s of volley(this.pilot.shot, this.power)) this.addShot(s);
        if (Math.floor(this.t / FIRE_RATE) % 2 === 0) this.sound.play('shot');
      }
      if (this.missileT <= 0) { this.missileT = MISSILE_RATE; for (const s of missiles(this.pilot.shot, this.power)) this.addShot(s); }
    }
  }

  private addShot(s: ReturnType<typeof volley>[number]): void {
    const a = (s.ang * Math.PI) / 180;
    const sx = this.px + s.dx, sy = this.py + (s.ang > 90 ? -s.dy : s.dy);
    this.pbs.push({ x: sx, y: sy, vx: Math.sin(a) * s.speed, vy: -Math.cos(a) * s.speed, dmg: s.dmg, r: s.r, pierce: s.pierce, homing: s.homing, life: s.life, kind: s.kind, color: s.color, hits: s.pierce ? new Set() : null });
  }

  private useBomb(): void {
    if (this.bombs <= 0 || this.bombT > 0 || !this.alive) return;
    this.bombs--; this.bombT = BOMB_TIME; this.invuln = Math.max(this.invuln, BOMB_TIME + 0.3);
    for (const b of this.ebs) if (Math.random() < 0.25) this.items.push({ x: b.x, y: b.y, vy: 0, kind: 'M', t: 0 });
    this.ebs = [];
    for (const e of this.enemies) if (e.y > -20) this.damage(e, e.boss ? BOMB_DMG * 1.5 : BOMB_DMG);
    this.sound.play('bomb');
    this.camera.shake(8, 0.6);
  }

  private updatePlayerBullets(dt: number): void {
    for (let i = this.pbs.length - 1; i >= 0; i--) {
      const b = this.pbs[i];
      b.life -= dt;
      if (b.homing) {
        let best: Enemy | null = null, bd = Infinity;
        for (const e of this.enemies) { if (e.y < -10) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          const want = Math.atan2(best.y - b.y, best.x - b.x), cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
          const na = cur + clamp(diff, -6 * dt, 6 * dt), sp = Math.hypot(b.vx, b.vy) + 500 * dt;
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      let gone = b.life <= 0 || b.y < -30 || b.y > PF_H + 30 || b.x < -30 || b.x > PF_W + 30;
      if (!gone) for (const e of this.enemies) {
        if (e.hp <= 0 || e.y < -e.r) continue;
        if (b.hits?.has(e)) continue;
        if (hit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          this.damage(e, b.dmg);
          if (b.pierce) b.hits!.add(e); else { gone = true; break; }
        }
      }
      if (gone) this.pbs.splice(i, 1);
    }
    // Orbiting pages chew through bullets and enemies.
    const n = orbiters(this.pilot.shot, this.power);
    if (n && this.alive) for (let k = 0; k < n; k++) {
      const a = this.t * 3.2 + (k * Math.PI * 2) / n, ox = this.px + Math.cos(a) * 48, oy = this.py + Math.sin(a) * 48;
      this.ebs = this.ebs.filter((b) => !hit(b.x, b.y, b.r, ox, oy, 11));
      for (const e of this.enemies) if (hit(ox, oy, 12, e.x, e.y, e.r)) this.damage(e, 14 * dt);
    }
  }

  private damage(e: Enemy, amt: number): void {
    if (e.hp <= 0) return;
    e.hp -= amt; e.flash = 0.05;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private addScore(n: number): void {
    const before = this.score; this.score += n;
    const ex = extendsBetween(before, this.score);
    if (ex) { this.lives += ex; this.sound.play('extend'); }
  }

  private killEnemy(e: Enemy): void {
    const info = ENEMY[e.kind];
    this.addScore(info.score); this.kills++;
    const big = e.boss || e.kind === 'bomber';
    this.game.fx.emit({ x: this.x0 + e.x, y: e.y, count: big ? 90 : 22, speed: big ? 360 : 200, life: big ? 1.0 : 0.5, size: big ? 10 : 6, colors: ['#ffffff', '#ffe08a', '#ff9a3a', '#ff4a4a'], add: true });
    this.sound.play(big ? 'big' : 'boom');
    if (big) this.camera.shake(e.boss ? 12 : 6, e.boss ? 0.8 : 0.3);
    const drop = (kind: Item['kind'], n = 1): void => { for (let i = 0; i < n; i++) this.items.push({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y, vy: -120, kind, t: 0 }); };
    if (e.kind === 'fighter' && Math.random() < 0.12) drop('P');
    if (e.kind === 'bomber') { drop('P'); if (Math.random() < 0.5) drop('B'); drop('M', 4); }
    if (e.kind === 'midboss') { drop('P', 2); drop('B'); drop('M', 10); }
    if (e.kind === 'drone' && Math.random() < 0.25) drop('M');
    if (this.kills % 30 === 0) drop('P');
    if (e === this.boss) {
      this.ebs = [];
      for (const o of this.enemies) if (o !== e) o.hp = 0;
      this.enemies = [];
      this.bonus = 20000 * (this.stage + 1) + this.lives * 10000 + this.bombs * 5000;
      this.addScore(this.bonus);
      this.phase = 'clear'; this.timer = 5;
      this.boss = null;
    }
  }

  private updateEnemies(dt: number): void {
    const st = STAGES[this.stage];
    for (const e of this.enemies) {
      e.age += dt; e.flash -= dt;
      if (e.boss) this.moveBoss(e, dt);
      else { const p = pathPos(e.path, e.x0, e.age, e.idx); e.x = p.x; e.y = p.y; }
      if (e.y < 0 || e.y > PF_H - 60 || !this.alive && this.dead > 0.8) continue;
      e.fire -= dt * st.fireMul;
      if (e.fire > 0) continue;
      const aim = aimAt(e.x, e.y, this.px, this.py);
      switch (e.kind) {
        case 'drone': e.fire = 2.4 + Math.random() * 2; if (Math.random() < 0.5 + this.stage * 0.2) this.eShoot(e.x, e.y, aim, 190); break;
        case 'fighter': e.fire = 1.6 + Math.random(); for (const a of fan(3, aim, 0.4)) this.eShoot(e.x, e.y, a, 220, '#ffb0ff'); break;
        case 'bomber': e.fire = 1.5; for (const a of ring(12, e.age)) this.eShoot(e.x, e.y, a, 150, '#ff7a5a', 7); for (const a of fan(5, aim, 0.6)) this.eShoot(e.x, e.y, a, 230); break;
        default: this.bossFire(e, aim); break;
      }
    }
    // Leftover off-screen or dead enemies.
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y < PF_H + 120 && e.x > -140 && e.x < PF_W + 140 && !(e.age > 3 && e.y < -80));
    // Body contact.
    if (this.alive && this.invuln <= 0) for (const e of this.enemies) if (hit(this.px, this.py, HITBOX + 6, e.x, e.y, e.r * 0.8)) { this.playerHit(); break; }
  }

  private moveBoss(e: Enemy, dt: number): void {
    const targetY = e.kind === 'midboss' ? 150 : 160;
    if (e.y < targetY) { e.y = Math.min(targetY, e.y + 90 * dt); e.x = PF_W / 2; return; }
    if (e.kind === 'midboss') { e.x = PF_W / 2 + Math.sin(e.age * 0.8) * 150; if (e.age > 26) e.y += 120 * dt; }
    else if (e.kind === 'boss1') e.x = PF_W / 2 + Math.sin(e.age * 0.45) * 120;
    else { e.x = PF_W / 2 + Math.sin(e.age * 0.6) * 130; e.y = targetY + Math.sin(e.age * 1.2) * 30; }
  }

  private bossFire(e: Enemy, aim: number): void {
    if (e.y < 100) { e.fire = 0.5; return; }
    const ph = bossPhase(e.hp, e.max);
    e.t2 += 1;
    if (e.kind === 'midboss') {
      e.fire = 1.2;
      for (const a of ring(16, e.t2 * 0.2)) this.eShoot(e.x, e.y, a, 150, '#ff7a5a', 7);
      for (const a of fan(5, aim, 0.5)) this.eShoot(e.x, e.y + 30, a, 240);
      return;
    }
    if (e.kind === 'boss1') {
      if (ph === 0) {
        e.fire = 0.9;
        for (const a of fan(5, aim, 0.55)) this.eShoot(e.x, e.y + 60, a, 230);
        if (e.t2 % 3 === 0) for (const side of [-1, 1]) for (const a of ring(14, e.t2)) this.eShoot(e.x + side * 60, e.y, a, 140, '#ffb03a', 7);
      } else if (ph === 1) {
        e.fire = 0.08; e.spin += 0.19;
        for (const a of [e.spin, e.spin + Math.PI]) this.eShoot(e.x, e.y + 20, a, 170, '#ff5ad0');
        if (e.t2 % 15 === 0) for (const a of fan(3, aim, 0.3)) this.eShoot(e.x, e.y + 60, a, 280, '#ffffff');
      } else {
        e.fire = 0.65;
        for (const a of ring(22, (e.t2 % 2) * 0.14)) this.eShoot(e.x, e.y + 20, a, 160, '#ff4a4a', 7);
        for (const a of fan(3, aim, 0.18)) this.eShoot(e.x, e.y + 60, a, 320, '#ffffff');
      }
      return;
    }
    // boss2 — the 2027 mothership.
    if (ph === 0) {
      e.fire = 0.12; e.spin += 0.12;
      for (const a of ring(5, e.spin)) this.eShoot(e.x, e.y, a, 160, '#c87aff');
    } else if (ph === 1) {
      e.fire = 1.3;
      for (let k = 0; k < 9; k++) this.eShoot(e.x, e.y + 40, aim, 200 + k * 26, '#7ad8ff');
      for (const a of ring(18, e.t2 * 0.1)) this.eShoot(e.x, e.y, a, 130, '#ff5ad0', 7);
    } else {
      e.fire = 0.09; e.spin += 0.23;
      for (const a of [e.spin, e.spin + (Math.PI * 2) / 3, e.spin + (Math.PI * 4) / 3]) this.eShoot(e.x, e.y, a, 175, '#ff5ad0');
      for (const a of [-e.spin, -e.spin + Math.PI]) this.eShoot(e.x, e.y, a, 140, '#7ad8ff');
      if (e.t2 % 14 === 0) for (const a of ring(24, 0)) this.eShoot(e.x, e.y, a, 120, '#ffffff', 7);
    }
  }

  private updateEnemyBullets(dt: number): void {
    for (const b of this.ebs) { b.x += b.vx * dt; b.y += b.vy * dt; }
    this.ebs = this.ebs.filter((b) => b.x > -20 && b.x < PF_W + 20 && b.y > -20 && b.y < PF_H + 20);
    if (this.alive && this.invuln <= 0) for (const b of this.ebs) if (hit(this.px, this.py, HITBOX, b.x, b.y, b.r * 0.8)) { this.playerHit(); break; }
  }

  private playerHit(): void {
    if (GOD) { this.invuln = 0.5; return; }
    this.lives--;
    this.dead = 1.3;
    this.sound.play('die');
    this.camera.shake(10, 0.5);
    this.game.fx.emit({ x: this.x0 + this.px, y: this.py, count: 80, speed: 320, life: 0.9, size: 8, colors: ['#ffffff', '#7fd8ff', '#ffe08a'], add: true });
    this.ebs = this.ebs.filter((b) => Math.hypot(b.x - this.px, b.y - this.py) > 160);
    if (this.power > 1) { this.power--; this.items.push({ x: this.px, y: this.py - 20, vy: -160, kind: 'P', t: 0 }); }
    this.bombs = Math.max(this.bombs, START_BOMBS);
    if (this.lives < 0) { this.lives = 0; this.phase = 'over'; this.timer = 2.5; this.finish(false); }
  }

  private updateItems(dt: number): void {
    const collectAll = this.alive && this.py < COLLECT_LINE;
    for (const it of this.items) {
      it.t += dt;
      const d = Math.hypot(this.px - it.x, this.py - it.y);
      if (this.alive && (collectAll || d < 70 || it.t > 0 && this.bombT > 0)) { const s = Math.max(500, d * 6) * dt; it.x += ((this.px - it.x) / (d || 1)) * s; it.y += ((this.py - it.y) / (d || 1)) * s; }
      else { it.vy = Math.min(110, it.vy + 260 * dt); it.y += it.vy * dt; it.x += Math.sin(it.t * 3) * 20 * dt; }
      if (this.alive && d < 26) {
        it.y = PF_H + 999;
        if (it.kind === 'P') { if (this.power < MAX_POWER) { this.power++; this.sound.play('power'); } else { this.addScore(5000); this.sound.play('item'); } }
        else if (it.kind === 'B') { this.bombs = Math.min(MAX_BOMBS, this.bombs + 1); this.sound.play('power'); }
        else { this.addScore(500); this.sound.play('item'); }
      }
    }
    this.items = this.items.filter((it) => it.y < PF_H + 30);
  }

  private finish(won: boolean): void {
    session.score = this.score; session.won = won; session.stage = this.stage; session.hi = Math.max(session.hi, this.score); saveHi(session.hi);
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game;
    this.x0 = Math.round((W - PF_W) / 2);
    const x0 = this.x0;
    d.rect(0, 0, W, H, '#07071a');
    // Mirror-tiled scrolling background (normal / vertically flipped alternate so seams always match).
    const bg = STAGES[this.stage].bg === 'space' ? this.f.space : this.f.ocean;
    const off = this.scroll % (PF_H * 2);
    for (let k = -1; k < 2; k++) {
      const y = off + k * PF_H * 2 - PF_H;
      d.sprite(bg, x0, y, { w: PF_W, h: PF_H, rot: Math.PI, flipX: true });
      d.sprite(bg, x0, y + PF_H, { w: PF_W, h: PF_H });
    }
    if (STAGES[this.stage].bg === 'space') for (let i = 0; i < 40; i++) { const sy = (i * 97 + this.t * (120 + (i % 3) * 90)) % PF_H; d.rect(x0 + (i * 131) % PF_W, sy, 2, 6 + (i % 3) * 4, '#ffffff', 0.5); }
    else for (let i = 0; i < 5; i++) { const cy = ((i * 173 + this.t * 130) % (PF_H + 200)) - 100, cx = x0 + (i * 211) % PF_W; for (const [ox, oy, r] of [[0, 0, 40], [34, 10, 32], [-34, 10, 30]]) d.circle(cx + ox, cy + oy, r, '#ffffff', 0.35); }
    // Items.
    for (const it of this.items) {
      const x = x0 + it.x, y = it.y, c = it.kind === 'P' ? '#ff4a6a' : it.kind === 'B' ? '#3aa0ff' : '#ffd23a';
      if (it.kind === 'M') { d.circle(x, y, 9, c); d.ring(x, y, 9, 2, '#ffffff'); label(d, g, '★', x, y, { size: 11, color: '#8a5a00' }); }
      else { d.rect(x - 13, y - 11, 26, 22, c, 1, Math.sin(it.t * 4) * 0.2); d.rect(x - 11, y - 9, 22, 18, '#ffffff', 0.25); label(d, g, it.kind, x, y, { size: 16, color: '#ffffff', weight: 900, stroke: '#00000088', strokeWidth: 3 }); }
    }
    // Enemies.
    for (const e of this.enemies) {
      const sz = ENEMY[e.kind].size, fr = e.kind === 'boss1' ? this.f.boss1 : e.kind === 'boss2' ? this.f.boss2 : e.kind === 'drone' ? this.f.drone : e.kind === 'fighter' ? this.f.fighter : this.f.bomber;
      spriteC(d, g, fr, x0 + e.x, e.y, sz, { tint: e.flash > 0 ? '#ff9090' : undefined, rot: e.kind === 'drone' ? Math.sin(e.age * 3) * 0.2 : 0 });
      if (e.boss || e.kind === 'bomber') { d.rect(x0 + e.x - 40, e.y - sz / 2 - 12, 80, 5, '#000000', 0.5); d.rect(x0 + e.x - 40, e.y - sz / 2 - 12, 80 * clamp(e.hp / e.max, 0, 1), 5, '#ff5a5a'); }
    }
    // Player bullets.
    for (const b of this.pbs) {
      const x = x0 + b.x;
      if (b.kind === 'laser') d.rect(x - 3, b.y - 14, 6, 28, b.color, 0.95);
      else if (b.kind === 'missile') d.rect(x - 3, b.y - 7, 6, 14, b.color, 1, Math.atan2(b.vy, b.vx) + Math.PI / 2);
      else if (b.kind === 'flame') d.circle(x, b.y, b.r * (1.4 - b.life), b.life > 0.2 ? '#ffd23a' : b.color, clamp(b.life * 3, 0, 0.9));
      else if (b.kind === 'bubble') { d.circle(x, b.y, b.r, b.color, 0.6); d.ring(x, b.y, b.r, 2, '#ffffff', 0.9); }
      else d.rect(x - 2.5, b.y - 9, 5, 18, b.color);
    }
    // Player ship + helpers.
    if (this.alive) {
      const blink = this.invuln > 0 && Math.floor(this.t * 16) % 2 === 0;
      if (this.pilot.shot === 'options') for (const s of [-1, 1]) { d.circle(x0 + this.px + s * 42, this.py + 6, 10, '#ffb347'); d.ring(x0 + this.px + s * 42, this.py + 6, 10, 2, '#5a3a1a'); }
      const n = orbiters(this.pilot.shot, this.power);
      for (let k = 0; k < n; k++) { const a = this.t * 3.2 + (k * Math.PI * 2) / n; d.rect(x0 + this.px + Math.cos(a) * 48 - 8, this.py + Math.sin(a) * 48 - 10, 16, 20, '#f2e2b6', 1, a); }
      d.circle(x0 + this.px, this.py + 36, 6 + Math.random() * 4, '#7fd8ff', 0.8);
      if (!blink) spriteC(d, g, this.f.jet, x0 + this.px, this.py, 62);
      if (this.focus || this.invuln <= 0 && this.ebs.some((b) => Math.hypot(b.x - this.px, b.y - this.py) < 60)) { d.circle(x0 + this.px, this.py, HITBOX + 2, '#ffffff'); d.ring(x0 + this.px, this.py, HITBOX + 3, 2, '#ff3a6a'); }
    }
    // Enemy bullets on top.
    for (const b of this.ebs) { d.circle(x0 + b.x, b.y, b.r, b.color); d.circle(x0 + b.x, b.y, b.r * 0.45, '#ffffff'); }
    // Bomb flash.
    if (this.bombT > 0) { const k = 1 - this.bombT / BOMB_TIME; d.ring(x0 + this.px, this.py, k * 900, 40, '#bfe8ff', 0.5 * (1 - k)); d.rect(x0, 0, PF_W, PF_H, '#ffffff', Math.max(0, 0.5 - k * 2)); }
    this.drawSide(d, W, H, x0);
    this.drawBanner(d, x0);
  }

  private drawSide(d: Draw, W: number, H: number, x0: number): void {
    const g = this.game, sw = x0;
    // Frame the playfield.
    d.rect(0, 0, x0, H, '#0d1030'); d.rect(x0 + PF_W, 0, W - x0 - PF_W, H, '#0d1030');
    d.rect(x0 - 4, 0, 4, H, '#ffcf4a'); d.rect(x0 + PF_W, 0, 4, H, '#ffcf4a');
    const narrow = sw < 170;
    if (narrow) {
      label(d, g, `${this.score}`, x0 + 10, 18, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 }, 0, 0.5);
      label(d, g, `殘機 ${this.lives}　炸彈 ${this.bombs}　火力 ${this.power}`, x0 + PF_W - 10, 18, { size: 15, color: '#ffe066', stroke: '#000000', strokeWidth: 4 }, 1, 0.5);
      return;
    }
    const lx = x0 / 2, st = STAGES[this.stage];
    const sz = g.assets.frameSize(this.f.logo), lw = Math.min(sw - 30, 300), lh = (sz.h / sz.w) * lw;
    d.sprite(this.f.logo, lx - lw / 2, 14, { w: lw, h: lh });
    panel(d, { x: lx - (sw - 40) / 2, y: 30 + lh, w: sw - 40, h: 150 }, '#16204acc', '#ffffff33');
    label(d, g, '得分', lx, 52 + lh, { size: 16, color: '#9fc3ff' });
    label(d, g, `${this.score}`, lx, 82 + lh, { size: 30, color: '#ffffff', weight: 900 });
    label(d, g, `最高分 ${Math.max(session.hi, this.score)}`, lx, 118 + lh, { size: 15, color: '#ffe066' });
    label(d, g, `${st.year} 年・${st.name}`, lx, 150 + lh, { size: 15, color: '#9fc3ff' });
    // Pilot.
    spriteC(d, g, this.f[this.pilot.id], lx, H - 170, 230);
    label(d, g, `${this.pilot.name}・${this.pilot.shotName}`, lx, H - 34, { size: 18, color: '#ffffff', stroke: '#0d1030', strokeWidth: 4 });
    // Right side: lives, bombs, power, boss.
    const rx = x0 + PF_W + (W - x0 - PF_W) / 2;
    panel(d, { x: rx - (sw - 40) / 2, y: 30, w: sw - 40, h: 250 }, '#16204acc', '#ffffff33');
    label(d, g, '殘機', rx, 54, { size: 16, color: '#9fc3ff' });
    for (let i = 0; i < Math.min(8, this.lives); i++) spriteC(d, g, this.f.jet, rx + (i - (Math.min(8, this.lives) - 1) / 2) * 30, 84, 28);
    label(d, g, '炸彈（X / Space）', rx, 120, { size: 15, color: '#9fc3ff' });
    for (let i = 0; i < this.bombs; i++) { const bx = rx + (i - (this.bombs - 1) / 2) * 28; d.circle(bx, 148, 11, '#3aa0ff'); label(d, g, 'B', bx, 148, { size: 13, color: '#ffffff', weight: 900 }); }
    label(d, g, `火力 Lv.${this.power}${this.power === MAX_POWER ? ' MAX' : ''}`, rx, 186, { size: 16, color: '#9fc3ff' });
    for (let i = 0; i < MAX_POWER; i++) d.rect(rx - 90 + i * 46, 202, 40, 14, i < this.power ? '#ff4a6a' : '#ffffff22');
    label(d, g, '方向鍵移動・Shift 精準慢速', rx, 244, { size: 13, color: '#aab4d4' });
    label(d, g, '自動射擊・也可用滑鼠拖曳', rx, 264, { size: 13, color: '#aab4d4' });
    if (this.boss) {
      panel(d, { x: rx - (sw - 40) / 2, y: 300, w: sw - 40, h: 70 }, '#3a1030cc', '#ff5a8a88');
      label(d, g, this.boss.kind === 'boss1' ? '鐵壁戰艦「海王」' : '星雲母艦「茉莉」', rx, 320, { size: 16, color: '#ffb0c8' });
      d.rect(rx - 110, 340, 220, 14, '#000000', 0.6);
      d.rect(rx - 109, 341, 218 * clamp(this.boss.hp / this.boss.max, 0, 1), 12, ['#ff5a5a', '#ffb03a', '#ff3aa0'][bossPhase(this.boss.hp, this.boss.max)]);
    }
  }

  private drawBanner(d: Draw, x0: number): void {
    const g = this.game, cx = x0 + PF_W / 2, st = STAGES[this.stage];
    if (this.phase === 'intro') {
      d.rect(x0, 250, PF_W, 150, '#000000', 0.45);
      label(d, g, `STAGE ${this.stage + 1}　${st.year}`, cx, 295, { size: 40, color: '#ffe066', stroke: '#3a1060', strokeWidth: 8, weight: 900 });
      label(d, g, st.name, cx, 350, { size: 28, color: '#ffffff', stroke: '#3a1060', strokeWidth: 6 });
    } else if (this.phase === 'warning') {
      d.rect(x0, 280, PF_W, 100, '#ff0030', 0.25 + Math.abs(Math.sin(this.t * 8)) * 0.25);
      label(d, g, 'WARNING', cx, 315, { size: 50, color: '#ffffff', stroke: '#a00020', strokeWidth: 8, weight: 900 });
      label(d, g, '巨大敵機接近中！', cx, 358, { size: 22, color: '#ffe0e0' });
    } else if (this.phase === 'clear') {
      d.rect(x0, 230, PF_W, 200, '#000000', 0.5);
      label(d, g, `${st.year} 年關卡完成！`, cx, 280, { size: 40, color: '#ffe066', stroke: '#3a1060', strokeWidth: 8, weight: 900 });
      label(d, g, `過關獎勵 +${this.bonus}`, cx, 340, { size: 26, color: '#ffffff' });
      label(d, g, this.stage + 1 < STAGES.length ? '前往 2027 年……' : '兩年戰役全勝！', cx, 390, { size: 22, color: '#9fe3ff' });
    } else if (this.phase === 'over') {
      label(d, g, 'GAME OVER', cx, 330, { size: 54, color: '#ff5a7a', stroke: '#200010', strokeWidth: 9, weight: 900 });
    } else if (this.phase === 'win') {
      label(d, g, '任務完成！', cx, 330, { size: 54, color: '#ffe066', stroke: '#3a1060', strokeWidth: 9, weight: 900 });
    }
    if (this.dead > 0 && this.phase === 'play' || this.dead > 0 && this.phase === 'warning') label(d, g, '被擊墜！', cx, 420, { size: 30, color: '#ffffff', stroke: '#000000', strokeWidth: 6 });
  }
}
