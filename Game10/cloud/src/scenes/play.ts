// The battle: four tanks take turns on destructible terrain. Hold Space to charge, release to fire.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { label, panel, clamp } from '../ui.js';
import { preloadMenu, menuFrames, spriteB } from '../menu.js';
import {
  HEROES, BASE_WEAPONS, TANK_COLORS, ART, FIELD_W, FIELD_H, WATER_Y, GRAVITY, WIND_ACC, MAX_WIND, MAX_HP, FUEL, DRIVE_SPEED, TURN_TIME, TANK_R,
  MAPS, CRATE_CHANCE, AMMO_SHARE, makeTerrain, surface, carve, spawnXs, launchVelocity, blastDamage, fallDamage, canDrive, aiAim, standings, resupply, autoSupplySlots,
  type Hero, type Weapon, type MapId,
} from '../rules.js';
import { session } from '../session.js';

interface Tank {
  i: number; hero: Hero; you: boolean; color: string; x: number; y: number; hp: number; alive: boolean; facing: number; elev: number; power: number;
  lastPower: number; fuel: number; frozen: boolean; weapons: Weapon[]; uses: number[]; weapon: number; diedAt: number; fallFrom: number; dmg: number; flash: number; turns: number;
}
interface Shell { x: number; y: number; vx: number; vy: number; w: Weapon; owner: Tank; trail: { x: number; y: number }[]; split: boolean; age: number; }
interface Crate { x: number; y: number; vy: number; landed: boolean; kind: 'heal' | 'ammo'; }
interface Float { x: number; y: number; text: string; color: string; t: number; }
interface AiPlan { think: number; elev: number; power: number; facing: number; weapon: number; charging: boolean; }
type Phase = 'intro' | 'aim' | 'flight' | 'settle' | 'over';

export class Play extends Scene {
  private f: Record<string, number> = {};
  private terrain: number[] = [];
  private map: MapId = 'grass';
  private tanks: Tank[] = [];
  private cur = 0;
  private turn = 1;
  private wind = 0;
  private phase: Phase = 'intro';
  private timer = 0;
  private clock = TURN_TIME;
  private shells: Shell[] = [];
  private crates: Crate[] = [];
  private floats: Float[] = [];
  private charging = false;
  private plan: AiPlan | null = null;
  private ranging = new Map<string, number>();
  private camX = 0;
  private look = 0;
  private t = 0;
  private msg = '';
  private msgT = 0;

  override preload(load: Preload): void { preloadMenu(load); }

  override setup(): void {
    this.f = menuFrames(this.game);
    this.input.bind({
      left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], fire: ['Space'],
      w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], w4: ['Digit4'], panL: ['KeyQ'], panR: ['KeyE'], quit: ['Escape'],
    });
    const sd = this.sound;
    sd.define('fire', { type: 'noise', duration: 0.25, volume: 0.35, filter: { type: 'lowpass', freq: 1800, freqEnd: 300 } });
    sd.define('boom', { type: 'noise', duration: 0.5, curve: 'exponential', distortion: 0.3, volume: 0.5, filter: { type: 'lowpass', freq: 1200, freqEnd: 80 } });
    sd.define('hurt', { type: 'square', freq: 320, freqEnd: 110, duration: 0.14, volume: 0.25 });
    sd.define('heal', { notes: 'C5 E5 G5 C6', step: 0.06, type: 'triangle', volume: 0.3 });
    sd.define('freeze', { notes: 'E6 B5 G#5', step: 0.05, type: 'triangle', volume: 0.3 });
    sd.define('splash', { type: 'noise', duration: 0.6, volume: 0.35, filter: { type: 'bandpass', freq: 900, freqEnd: 300, q: 1 } });
    sd.define('tick', { type: 'square', freq: 880, duration: 0.03, volume: 0.1 });
    sd.define('pick', { notes: 'G5 C6 E6', step: 0.05, type: 'square', volume: 0.25 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.28 }); session.musicOn = true; }

    const seed = 1 + Math.floor(Math.random() * 1e6);
    this.terrain = makeTerrain(seed);
    this.map = (['grass', 'snow', 'desert'] as MapId[])[seed % 3];
    const me = HEROES.find((h) => h.id === session.hero) ?? HEROES[0];
    const rivals = HEROES.filter((h) => h !== me).sort(() => Math.random() - 0.5).slice(0, 3);
    const heroes = [me, ...rivals];
    const xs = spawnXs(this.terrain, 4);
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5); // random spawn columns
    this.tanks = heroes.map((hero, i) => {
      const x = xs[order[i]];
      const weapons = [...BASE_WEAPONS, hero.special];
      return {
        i, hero, you: i === 0, color: TANK_COLORS[i], x, y: surface(this.terrain, x), hp: MAX_HP, alive: true, facing: x < FIELD_W / 2 ? 1 : -1, elev: 45, power: 0,
        lastPower: 0, fuel: FUEL, frozen: false, weapons, uses: weapons.map((w) => w.uses), weapon: 0, diedAt: 0, fallFrom: 0, dmg: 0, flash: 0, turns: 0,
      };
    });
    this.cur = 0;
    this.newWind();
    this.phase = 'intro'; this.timer = 2;
    this.camX = clamp(this.tanks[0].x - this.width / 2, 0, FIELD_W - this.width);
  }

  private get tk(): Tank { return this.tanks[this.cur]; }
  private say(s: string, t = 2.5): void { this.msg = s; this.msgT = t; }
  private float(x: number, y: number, text: string, color: string): void { this.floats.push({ x, y, text, color, t: 1.6 }); }
  private newWind(): void { this.wind = Math.round((Math.random() * 2 - 1) * MAX_WIND); }

  // ── turn flow ──
  private startTurn(): void {
    const t = this.tk;
    t.fuel = FUEL; t.power = 0; t.turns++;
    const auto = resupply(t.uses, autoSupplySlots(t.turns));
    if (auto.length) { this.float(t.x, t.y - 130, `定期補給：${auto.map((s) => t.weapons[s].name + ' +1').join('、')}`, '#ffe066'); this.sound.play('pick'); }
    this.clock = TURN_TIME; this.charging = false; this.look = 0;
    if (t.uses[t.weapon] === 0) t.weapon = 0;
    this.phase = 'aim';
    this.plan = null;
    if (!t.you) this.planAi(t);
    this.say(t.you ? '輪到你了！按住 Space 蓄力，放開發射' : `${t.hero.name} 的回合`, 2);
    if (Math.random() < CRATE_CHANCE) this.crates.push({ x: 150 + Math.random() * (FIELD_W - 300), y: -40, vy: 0, landed: false, kind: Math.random() < AMMO_SHARE ? 'ammo' : 'heal' });
  }

  private nextTurn(): void {
    const alive = this.tanks.filter((t) => t.alive);
    if (!this.tanks[0].alive) return this.finish('你的坦克被擊毀了……');
    if (alive.length <= 1) return this.finish('最後的坦克就是你！');
    if (this.turn >= 48) return this.finish('回合用完，依剩餘血量排名');
    this.turn++;
    this.newWind();
    for (let k = 0; k < 8; k++) {
      this.cur = (this.cur + 1) % this.tanks.length;
      const t = this.tk;
      if (!t.alive) continue;
      if (t.frozen) { t.frozen = false; this.float(t.x, t.y - 110, '凍結中，跳過！', '#bff4ff'); continue; }
      break;
    }
    this.startTurn();
  }

  private finish(reason: string): void {
    this.phase = 'over'; this.timer = 2.6;
    session.reason = reason;
    session.results = standings(this.tanks).map((t) => ({ id: t.hero.id, name: t.hero.name, you: t.you, alive: t.alive, hp: Math.max(0, t.hp), dmg: t.dmg, color: t.color }));
  }

  // ── firing ──
  private fire(t: Tank): void {
    const w = t.weapons[t.weapon];
    if (t.uses[t.weapon] === 0) { t.weapon = 0; return this.fire(t); }
    if (t.uses[t.weapon] > 0) t.uses[t.weapon]--;
    t.lastPower = t.power;
    this.charging = false; this.look = 0;
    if (w.kind === 'heal') {
      const before = t.hp; t.hp = Math.min(MAX_HP, t.hp + w.dmg);
      this.float(t.x, t.y - 110, `+${t.hp - before} HP`, '#8dff9a');
      this.game.fx.emit({ x: t.x, y: t.y - 40, count: 30, speed: 120, life: 0.8, size: 6, colors: ['#8dff9a', '#ffffff'], add: true });
      this.sound.play('heal');
      this.phase = 'settle'; this.timer = 1.0;
      return;
    }
    const a = (t.elev * Math.PI) / 180;
    const mx = t.x + t.facing * Math.cos(a) * 34, my = t.y - 34 - Math.sin(a) * 34;
    for (let k = 0; k < w.count; k++) {
      const off = w.count > 1 ? (k - (w.count - 1) / 2) * w.spread * (180 / Math.PI) : 0;
      const v = launchVelocity(t.facing, t.elev + off, t.power, w.kind);
      this.shells.push({ x: mx, y: my, vx: v.vx, vy: v.vy, w, owner: t, trail: [], split: false, age: 0 });
    }
    this.sound.play('fire');
    this.game.fx.emit({ x: mx, y: my, count: 14, speed: 160, life: 0.35, size: 6, colors: ['#ffffff', '#ffe08a', '#bbbbbb'] });
    this.phase = 'flight';
  }

  private explode(s: Shell, x: number, y: number, hit: number): void {
    const w = s.w, r = w.radius;
    carve(this.terrain, x, y, w.kind === 'digger' ? r * 0.8 : r * 0.75, w.kind === 'digger' ? 2.4 : 1);
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const dmg = blastDamage(w, x, y, t.x, t.y, hit === t.i);
      if (dmg <= 0) continue;
      t.hp -= dmg; t.flash = 0.25;
      if (t !== s.owner) s.owner.dmg += dmg;
      this.float(t.x, t.y - 100, `-${dmg}`, '#ff5a5a');
      if (t.you) this.sound.play('hurt');
      if (w.kind === 'freeze') { t.frozen = true; this.float(t.x, t.y - 130, '凍結！', '#bff4ff'); this.sound.play('freeze'); }
      if (w.kind === 'wave') {
        const dx = t.x - x || 1, push = (1 - Math.min(1, Math.abs(dx) / (r + 40))) * 130 * Math.sign(dx);
        t.x = clamp(t.x + push, 20, FIELD_W - 20);
      }
    }
    if (w.kind === 'teleport' && s.owner.alive) { s.owner.x = clamp(x, 30, FIELD_W - 30); s.owner.y = Math.min(s.owner.y, y); this.float(x, y - 60, '傳送！', '#c9a0ff'); }
    for (const c of this.crates) if (Math.hypot(c.x - x, c.y - y) < r + 20) this.pickCrate(c, s.owner);
    this.crates = this.crates.filter((c) => c.y > -1000);
    const colors = w.kind === 'freeze' ? ['#ffffff', '#bff4ff', '#6fd0ff'] : w.kind === 'wave' ? ['#ffffff', '#6fd0ff', '#2a7fff'] : ['#ffffff', '#ffe08a', w.color, '#ff7a3a'];
    this.game.fx.emit({ x, y, count: 20 + Math.round(r / 2), speed: 90 + r * 2.4, life: 0.6, size: 7, colors, add: true });
    this.game.fx.emit({ x, y, count: 18, speed: 160, life: 0.9, size: 4, colors: [MAPS[this.map].dirt, MAPS[this.map].top] });
    this.sound.play('boom');
    this.camera.shake(Math.min(10, r / 8), 0.3);
  }

  private pickCrate(c: Crate, t: Tank): void {
    if (!t.alive) return;
    if (c.kind === 'ammo') {
      const got = resupply(t.uses, [1, 2, 3]);
      this.float(c.x, c.y - 40, got.length ? `${t.hero.name} 彈藥補給：${got.map((s) => t.weapons[s].name).join('、')} +1` : `${t.hero.name} 彈藥已滿`, '#ffe066');
    } else {
      const before = t.hp; t.hp = Math.min(MAX_HP, t.hp + 30);
      this.float(c.x, c.y - 40, `${t.hero.name} +${t.hp - before} HP`, '#8dff9a');
    }
    this.sound.play('pick');
    c.y = -5000;
  }

  // ── AI ──
  private planAi(t: Tank): void {
    const foes = this.tanks.filter((o) => o.alive && o !== t);
    const target = foes.sort((a, b) => (Math.abs(a.x - t.x) - (a.you ? 250 : 0) + a.hp * 3) - (Math.abs(b.x - t.x) - (b.you ? 250 : 0) + b.hp * 3))[0];
    let weapon = 0;
    const sp = t.weapons[3];
    if (t.uses[3] > 0 && ((sp.kind === 'heal' && t.hp < 60) || (sp.kind !== 'heal' && sp.kind !== 'teleport' && Math.random() < 0.4))) weapon = 3;
    else if (t.uses[2] > 0 && target.hp > 40 && Math.random() < 0.45) weapon = 2;
    else if (t.uses[1] > 0 && Math.random() < 0.35) weapon = 1;
    const w = t.weapons[weapon];
    if (w.kind === 'heal') { this.plan = { think: 1.1, elev: t.elev, power: 0, facing: t.facing, weapon, charging: false }; return; }
    const aim = aiAim(this.terrain, this.tanks, t.i, target.i, this.wind, w.radius, w.kind === 'laser');
    // Bots "range in": the first shot at a target is loose, each follow-up tightens (never perfect).
    const key = `${t.i}>${target.i}`, n = this.ranging.get(key) ?? 0;
    this.ranging.set(key, n + 1);
    const err = Math.max(0.35, 1.3 - n * 0.35) * (target.you ? 1.15 : 1);
    this.plan = {
      think: 1.1 + Math.random() * 0.6, elev: clamp(aim.elev + (Math.random() - 0.5) * 6 * err, 0, 88),
      power: clamp(aim.power + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6) * err, 5, 100), facing: aim.facing, weapon, charging: false,
    };
  }

  private runAi(t: Tank, dt: number): void {
    const p = this.plan;
    if (!p) return;
    if (p.think > 0) { p.think -= dt; return; }
    t.weapon = p.weapon; t.facing = p.facing;
    if (t.weapons[t.weapon].kind === 'heal') { this.fire(t); return; }
    if (Math.abs(t.elev - p.elev) > 0.8) { t.elev += Math.sign(p.elev - t.elev) * Math.min(Math.abs(p.elev - t.elev), 50 * dt); return; }
    t.elev = p.elev;
    if (t.weapons[t.weapon].kind === 'laser') { t.power = 100; this.fire(t); return; }
    p.charging = true;
    t.power = Math.min(p.power, t.power + 62 * dt);
    if (t.power >= p.power) this.fire(t);
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    this.t += dt; this.timer -= dt; this.msgT -= dt;
    const k = this.input.keys;
    if (k.quit.pressed) { this.gotoTitle(); return; }
    for (const fl of this.floats) { fl.t -= dt; fl.y -= 30 * dt; }
    this.floats = this.floats.filter((fl) => fl.t > 0);
    for (const t of this.tanks) if (t.flash > 0) t.flash -= dt;
    this.updateCrates(dt);
    const t = this.tk;
    switch (this.phase) {
      case 'intro': if (this.timer <= 0) this.startTurn(); break;
      case 'aim': {
        this.clock -= dt;
        if (t.you) this.control(t, dt); else this.runAi(t, dt);
        if (this.clock <= 0 && this.phase === 'aim') {
          if (t.you && this.charging) this.fire(t);
          else { this.say(`${t.hero.name} 時間到，跳過回合`); this.phase = 'settle'; this.timer = 0.5; }
        }
        break;
      }
      case 'flight': this.updateShells(dt); if (!this.shells.length) { this.phase = 'settle'; this.timer = 0.9; } break;
      case 'settle': if (this.settle(dt) && this.timer <= 0) { this.checkDeaths(); if (this.phase === 'settle') this.nextTurn(); } break;
      case 'over': this.settle(dt); if (this.timer <= 0) this.gotoGameOver(); break;
    }
    // Camera.
    const W = this.width;
    let focus = t.x + this.look;
    if (this.shells.length) focus = this.shells[0].x;
    const target = clamp(focus - W / 2, 0, Math.max(0, FIELD_W - W));
    this.camX += (target - this.camX) * Math.min(1, dt * (this.shells.length ? 6 : 3));
    this.camera.x = this.camX; this.camera.y = 0;
  }

  private control(t: Tank, dt: number): void {
    const k = this.input.keys;
    if (k.w1.pressed) this.pick(t, 0);
    if (k.w2.pressed) this.pick(t, 1);
    if (k.w3.pressed) this.pick(t, 2);
    if (k.w4.pressed) this.pick(t, 3);
    if (k.panL.held) this.look -= 700 * dt;
    if (k.panR.held) this.look += 700 * dt;
    this.look = clamp(this.look, -FIELD_W, FIELD_W);
    if (!this.charging) {
      const dir = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0);
      if (dir) {
        t.facing = dir; this.look = 0;
        if (t.fuel > 0) {
          const nx = t.x + dir * DRIVE_SPEED * dt;
          if (canDrive(this.terrain, t.x, nx)) { t.x = nx; t.y = surface(this.terrain, t.x); t.fuel = Math.max(0, t.fuel - DRIVE_SPEED * dt); }
        }
      }
      if (k.up.held) t.elev = Math.min(88, t.elev + 40 * dt);
      if (k.down.held) t.elev = Math.max(0, t.elev - 40 * dt);
    }
    if (k.fire.pressed) { this.charging = true; t.power = 0; }
    if (this.charging && k.fire.held) t.power = Math.min(100, t.power + 62 * dt);
    if (this.charging && !k.fire.held) this.fire(t);
  }

  private pick(t: Tank, i: number): void {
    if (t.uses[i] === 0) { this.say('這個武器用完了！', 1.2); return; }
    t.weapon = i; this.sound.play('tick');
  }

  private updateShells(dt: number): void {
    const sub = 4, h = dt / sub;
    for (let n = 0; n < sub; n++) {
      for (let i = this.shells.length - 1; i >= 0; i--) {
        const s = this.shells[i];
        s.age += h;
        if (s.w.kind !== 'laser') { s.vx += this.wind * WIND_ACC * h; s.vy += GRAVITY * h; }
        s.x += s.vx * h; s.y += s.vy * h;
        if (s.w.kind === 'cluster' && !s.split && s.vy > 0) {
          s.split = true;
          for (let c = 0; c < 5; c++) this.shells.push({ x: s.x, y: s.y, vx: s.vx + (c - 2) * 70, vy: -60 + Math.abs(c - 2) * 20, w: { ...s.w, kind: 'normal' }, owner: s.owner, trail: [], split: true, age: 0 });
          this.shells.splice(i, 1);
          this.game.fx.emit({ x: s.x, y: s.y, count: 16, speed: 140, life: 0.4, size: 5, colors: ['#ff6a3a', '#ffe08a'], add: true });
          continue;
        }
        let hit = -3;
        if (s.x < -60 || s.x > FIELD_W + 60 || s.y > FIELD_H + 40) hit = -2;
        else if (s.x >= 0 && s.x <= FIELD_W && s.y >= surface(this.terrain, s.x)) hit = -1;
        else for (const t of this.tanks) if (t.alive && !(t === s.owner && s.age < 0.35) && Math.hypot(s.x - t.x, s.y - (t.y - 18)) < TANK_R) { hit = t.i; break; }
        if (hit === -2) { if (s.y > WATER_Y) { this.sound.play('splash'); this.game.fx.emit({ x: s.x, y: WATER_Y, count: 16, speed: 150, life: 0.6, size: 5, colors: ['#ffffff', '#6fd0ff'] }); } this.shells.splice(i, 1); continue; }
        if (hit >= -1) { this.explode(s, s.x, s.y, hit); this.shells.splice(i, 1); }
      }
    }
    for (const s of this.shells) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 14) s.trail.shift(); }
  }

  private updateCrates(dt: number): void {
    for (const c of this.crates) {
      if (c.landed) { c.y = surface(this.terrain, c.x); } else {
        c.vy = Math.min(300, c.vy + 400 * dt); c.y += c.vy * dt;
        if (c.y >= surface(this.terrain, c.x)) { c.y = surface(this.terrain, c.x); c.landed = true; }
      }
      if (c.y > WATER_Y - 4) c.y = -5000;
      for (const t of this.tanks) if (t.alive && c.y > 0 && Math.abs(t.x - c.x) < 34 && Math.abs(t.y - c.y) < 40) this.pickCrate(c, t);
    }
    this.crates = this.crates.filter((c) => c.y > -1000);
  }

  /** Drop tanks onto the (possibly blasted) ground; returns true when everyone has landed. */
  private settle(dt: number): boolean {
    let done = true;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const g = surface(this.terrain, t.x);
      if (t.y < g - 0.5) {
        if (!t.fallFrom) t.fallFrom = t.y;
        t.y = Math.min(g, t.y + 360 * dt); done = false;
      } else {
        t.y = g;
        if (t.fallFrom) {
          const dmg = fallDamage(g - t.fallFrom);
          if (dmg) { t.hp -= dmg; this.float(t.x, t.y - 100, `摔落 -${dmg}`, '#ffb06a'); }
          t.fallFrom = 0;
        }
      }
    }
    return done;
  }

  private checkDeaths(): void {
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const drowned = t.y >= WATER_Y - 4;
      if (t.hp > 0 && !drowned) continue;
      t.alive = false; t.hp = Math.max(0, t.hp); t.diedAt = this.turn;
      this.say(drowned ? `${t.hero.name} 掉進水裡了！` : `${t.hero.name} 的坦克被擊毀！`, 2.5);
      this.game.fx.emit({ x: t.x, y: t.y - 20, count: 60, speed: 300, life: 0.9, size: 9, colors: ['#ffffff', '#ffe08a', '#ff7a3a', t.color], add: true });
      this.sound.play(drowned ? 'splash' : 'boom');
      this.camera.shake(10, 0.4);
    }
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = this.camX, m = MAPS[this.map];
    // Sky gradient + sun + clouds + far hills (parallax).
    const bands = 18;
    for (let i = 0; i < bands; i++) d.rect(cx - 20, (i * H) / bands, W + 40, H / bands + 1, mix(m.sky[0], m.sky[1], i / (bands - 1)));
    d.circle(cx + W * 0.8 - cx * 0.05, 110, 50, '#fff6c0', 0.9);
    for (let i = 0; i < 9; i++) {
      const px = ((i * 420 - cx * 0.3 + this.t * 12) % (FIELD_W * 0.6 + 400) + FIELD_W * 0.6 + 400) % (FIELD_W * 0.6 + 400) - 200;
      const x = cx + px * (W / (FIELD_W * 0.6)), y = 80 + (i * 53) % 150;
      for (const [ox, oy, r] of [[0, 0, 34], [30, 8, 28], [-30, 8, 26], [12, -16, 26]]) d.circle(x + ox, y + oy, r, '#ffffff', 0.8);
    }
    const hills: { x: number; y: number }[] = [{ x: cx - 20, y: H + 20 }];
    for (let sx = -20; sx <= W + 20; sx += 24) hills.push({ x: cx + sx, y: 400 + 50 * Math.sin((sx + cx * 0.4) / 170) + 30 * Math.sin((sx + cx * 0.4) / 61) });
    hills.push({ x: cx + W + 20, y: H + 20 });
    d.fill(hills, m.deep, 0.35);
    // Terrain.
    const x0 = Math.max(0, Math.floor(cx / 8) * 8 - 8), x1 = Math.min(FIELD_W, cx + W + 16);
    const top: { x: number; y: number }[] = [];
    for (let x = x0; x <= x1; x += 8) top.push({ x, y: surface(this.terrain, x) });
    d.fill([{ x: x0, y: FIELD_H + 30 }, ...top, { x: top[top.length - 1].x, y: FIELD_H + 30 }], m.dirt);
    d.fill([{ x: x0, y: FIELD_H + 30 }, ...top.map((p) => ({ x: p.x, y: p.y + 46 })), { x: top[top.length - 1].x, y: FIELD_H + 30 }], m.deep);
    d.poly(top, 10, m.top);
    // Water.
    const wave: { x: number; y: number }[] = [{ x: cx - 20, y: FIELD_H + 30 }];
    for (let sx = -20; sx <= W + 20; sx += 20) wave.push({ x: cx + sx, y: WATER_Y + Math.sin((cx + sx) / 40 + this.t * 2) * 4 });
    wave.push({ x: cx + W + 20, y: FIELD_H + 30 });
    d.fill(wave, '#3a9dff', 0.8);
    // Crates.
    for (const c of this.crates) if (c.y > -500) this.drawCrate(d, c);
    // Aim guide for your tank.
    const t = this.tk;
    if (this.phase === 'aim' && t.you) this.drawGuide(d, t);
    for (const tank of this.tanks) if (tank.alive) this.drawTank(d, tank);
    // Shells.
    for (const s of this.shells) {
      s.trail.forEach((p, i) => d.circle(p.x, p.y, 2 + i * 0.35, s.w.color, (i / s.trail.length) * 0.6));
      d.circle(s.x, s.y, s.w.kind === 'laser' ? 7 : 8, s.w.color);
      d.ring(s.x, s.y, 8, 2, '#3a2a20');
    }
    for (const fl of this.floats) label(d, this.game, fl.text, fl.x, fl.y, { size: 24, color: fl.color, stroke: '#1a1a2a', strokeWidth: 5, weight: 900 }, 0.5, 0.5, Math.min(1, fl.t * 2));
    this.drawOverlay(d, W, H);
  }

  private drawCrate(d: Draw, c: Crate): void {
    const sz = 44, top = c.y - sz + 4;
    if (!c.landed) {
      const cy = top - 46;
      d.fill(Array.from({ length: 13 }, (_, i) => ({ x: c.x + Math.cos(Math.PI + (i / 12) * Math.PI) * 34, y: cy + Math.sin(Math.PI + (i / 12) * Math.PI) * 24 })), c.kind === 'ammo' ? '#ffcf4a' : '#ff8fb0', 0.95);
      for (const ox of [-30, 0, 30]) d.line(c.x + ox, cy, c.x, top + 4, 2, '#ffffff', 0.8);
    }
    if (c.kind === 'heal') { d.sprite(this.f.barrel, c.x - sz / 2, top, { w: sz, h: sz }); return; }
    // Ammo box: olive crate with three brass shells.
    d.rect(c.x - sz / 2, top + 6, sz, sz - 6, '#3a3a2a');
    d.rect(c.x - sz / 2 + 3, top + 9, sz - 6, sz - 12, '#6b7a3a');
    for (const ox of [-11, 0, 11]) { d.rect(c.x + ox - 4, top + 14, 8, 18, '#ffcf4a'); d.circle(c.x + ox, top + 14, 4, '#ff9a3a'); }
    d.rect(c.x - sz / 2 + 3, top + sz - 12, sz - 6, 5, '#3a3a2a');
  }

  private drawGuide(d: Draw, t: Tank): void {
    const w = t.weapons[t.weapon];
    if (w.kind === 'heal') return;
    const a = (t.elev * Math.PI) / 180, laser = w.kind === 'laser';
    const power = this.charging ? t.power : t.lastPower || 50;
    let x = t.x + t.facing * Math.cos(a) * 34, y = t.y - 34 - Math.sin(a) * 34;
    let { vx, vy } = launchVelocity(t.facing, t.elev, power, w.kind);
    const dt = 1 / 30;
    for (let i = 0; i < (laser ? 26 : 16); i++) {
      if (!laser) vy += GRAVITY * dt;
      x += vx * dt; y += vy * dt;
      if (i % 2 === 0) d.circle(x, y, 3.5, '#ffffff', 0.75 - i * 0.03);
    }
  }

  private drawTank(d: Draw, t: Tank): void {
    const g = this.game, act = t === this.tk && this.phase !== 'over';
    const a = (t.elev * Math.PI) / 180, tint = t.flash > 0 ? '#ff8080' : t.color;
    // Barrel.
    d.line(t.x, t.y - 32, t.x + t.facing * Math.cos(a) * 38, t.y - 32 - Math.sin(a) * 38, 9, '#3a3a4a');
    d.line(t.x, t.y - 32, t.x + t.facing * Math.cos(a) * 36, t.y - 32 - Math.sin(a) * 36, 5, tint);
    // Rider then hull.
    spriteB(d, g, this.f[t.hero.id], t.x - t.facing * 4, t.y - 30 + (act ? -Math.abs(Math.sin(this.t * 5)) * 3 : 0), 56, { flipX: t.facing < 0 });
    const hs = g.assets.frameSize(this.f.hull), hw = 74, hh = (hs.h / hs.w) * hw;
    d.sprite(this.f.hull, t.x - hw / 2, t.y - hh + 6, { w: hw, h: hh, flipX: t.facing < 0, tint });
    if (t.frozen) { d.rect(t.x - 40, t.y - 96, 80, 100, '#bff4ff', 0.45); d.ring(t.x, t.y - 46, 46, 3, '#ffffff', 0.8); }
    // HP bar + name.
    d.rect(t.x - 31, t.y - 104, 62, 9, '#000000', 0.6);
    d.rect(t.x - 30, t.y - 103, 60 * clamp(t.hp / MAX_HP, 0, 1), 7, t.hp > 50 ? '#5cffb0' : t.hp > 25 ? '#ffd23f' : '#ff5f3a');
    label(d, g, t.you ? `▼${t.hero.name}` : t.hero.name, t.x, t.y - 118, { size: 15, color: t.you ? '#ffffff' : '#ffffff', stroke: t.color, strokeWidth: 4 });
    if (act) d.circle(t.x, t.y - 140 + Math.sin(this.t * 6) * 4, 7, '#ffe066');
  }

  private drawOverlay(d: Draw, W: number, H: number): void {
    const g = this.game, cx = this.camX, t = this.tk;
    // Tank cards.
    this.tanks.forEach((tk, i) => {
      const x = cx + 12 + i * 158, y = 10, act = tk === t;
      panel(d, { x, y, w: 150, h: 54 }, act ? '#2f4f7fee' : '#0d1a33cc', act ? '#ffe066' : '#ffffff44');
      d.rect(x, y, 5, 54, tk.color);
      spriteB(d, g, this.f[tk.hero.id], x + 26, y + 52, 48, { alpha: tk.alive ? 1 : 0.3 });
      label(d, g, `${tk.hero.name}${tk.you ? '（你）' : ''}`, x + 50, y + 15, { size: 14, color: '#ffffff' }, 0, 0.5);
      if (tk.alive) {
        d.rect(x + 50, y + 30, 92, 9, '#000000', 0.5);
        d.rect(x + 51, y + 31, 90 * clamp(tk.hp / MAX_HP, 0, 1), 7, tk.hp > 50 ? '#5cffb0' : tk.hp > 25 ? '#ffd23f' : '#ff5f3a');
        label(d, g, `${Math.max(0, Math.round(tk.hp))}${tk.frozen ? '　凍結' : ''}`, x + 50, y + 46, { size: 11, color: '#dddddd' }, 0, 0.5);
      } else label(d, g, '擊毀', x + 50, y + 38, { size: 16, color: '#ff6b6b' }, 0, 0.5);
    });
    // Turn, clock, wind.
    const mx = cx + W / 2;
    panel(d, { x: mx - 140, y: 74, w: 280, h: 60 }, '#0d1a33cc', '#ffffff44');
    label(d, g, `第 ${this.turn} 回合・${MAPS[this.map].name}`, mx, 90, { size: 15, color: '#ffe8a0' });
    const wl = Math.abs(this.wind) * 9, dir = Math.sign(this.wind);
    label(d, g, '風', mx - 110, 116, { size: 16, color: '#ffffff' });
    d.rect(mx - 90, 113, 120, 6, '#ffffff', 0.2);
    if (dir) { d.rect(dir > 0 ? mx - 30 : mx - 30 - wl, 112, wl, 8, '#6fd0ff'); d.fill([{ x: mx - 30 + dir * (wl + 12), y: 116 }, { x: mx - 30 + dir * wl, y: 108 }, { x: mx - 30 + dir * wl, y: 124 }], '#6fd0ff'); }
    label(d, g, `${this.wind > 0 ? '→' : this.wind < 0 ? '←' : ''} ${Math.abs(this.wind)}`, mx + 50, 116, { size: 16, color: '#6fd0ff' }, 0, 0.5);
    if (this.phase === 'aim') {
      const c = Math.ceil(Math.max(0, this.clock));
      d.circle(mx + 116, 104, 20, c <= 5 ? '#ff5a5a' : '#2f4f7f');
      label(d, g, `${c}`, mx + 116, 104, { size: 18, color: '#ffffff' });
    }
    // Minimap.
    const mw = 260, mh = 64, mmx = cx + W - mw - 14, mmy = 10;
    d.rect(mmx - 2, mmy - 2, mw + 4, mh + 4, '#ffffff', 0.5); d.rect(mmx, mmy, mw, mh, '#0d1a33', 0.85);
    const pts: { x: number; y: number }[] = [];
    for (let x = 0; x <= FIELD_W; x += 40) pts.push({ x: mmx + (x / FIELD_W) * mw, y: mmy + (surface(this.terrain, x) / FIELD_H) * mh });
    d.fill([{ x: mmx, y: mmy + mh }, ...pts, { x: mmx + mw, y: mmy + mh }], MAPS[this.map].dirt, 0.9);
    d.rect(mmx, mmy + (WATER_Y / FIELD_H) * mh, mw, mh - (WATER_Y / FIELD_H) * mh, '#3a9dff', 0.7);
    d.rect(mmx + (this.camX / FIELD_W) * mw, mmy, (W / FIELD_W) * mw, mh, '#ffffff', 0.15);
    for (const tk of this.tanks) if (tk.alive) d.circle(mmx + (tk.x / FIELD_W) * mw, mmy + (tk.y / FIELD_H) * mh - 3, tk === t ? 5 : 4, tk.color);
    for (const s of this.shells) d.circle(mmx + (s.x / FIELD_W) * mw, mmy + (clamp(s.y, 0, FIELD_H) / FIELD_H) * mh, 2, '#ffffff');
    // Bottom bar: weapons + angle + power.
    const by = H - 78;
    panel(d, { x: cx + W / 2 - 430, y: by, w: 860, h: 68 }, '#0d1a33dd', '#ffffff44');
    t.weapons.forEach((w, i) => {
      const x = cx + W / 2 - 420 + i * 118, sel = i === t.weapon, empty = t.uses[i] === 0;
      d.rect(x, by + 8, 110, 52, sel ? '#ffcf4a' : '#1f3057', empty ? 0.4 : 1);
      label(d, g, `${i + 1} ${w.name}`, x + 55, by + 24, { size: 14, color: sel ? '#3a2400' : '#ffffff' });
      label(d, g, t.uses[i] < 0 ? '∞' : `剩 ${t.uses[i]}`, x + 55, by + 45, { size: 12, color: sel ? '#6a4400' : '#aac4ff' });
    });
    const px = cx + W / 2 + 60;
    label(d, g, `角度 ${Math.round(t.elev)}°`, px, by + 20, { size: 16, color: '#ffffff' }, 0, 0.5);
    label(d, g, `油量 ${Math.round((t.fuel / FUEL) * 100)}%`, px + 110, by + 20, { size: 13, color: '#aac4ff' }, 0, 0.5);
    d.rect(px, by + 38, 300, 16, '#000000', 0.5);
    d.rect(px + 1, by + 39, 298 * (t.power / 100), 14, t.power > 80 ? '#ff5a5a' : '#ffcf4a');
    if (t.lastPower) d.rect(px + 298 * (t.lastPower / 100), by + 34, 3, 24, '#ffffff');
    label(d, g, `力道 ${Math.round(t.power)}`, px + 300, by + 20, { size: 14, color: '#ffe8a0' }, 1, 0.5);
    // Messages / hints.
    if (this.phase === 'intro') label(d, g, `${MAPS[this.map].name}　準備開戰！`, cx + W / 2, H * 0.4, { size: 44, color: '#ffffff', stroke: '#1a1a2a', strokeWidth: 8, weight: 900 });
    else if (this.msgT > 0) label(d, g, this.msg, cx + W / 2, 160, { size: 22, color: '#ffffff', stroke: '#1a1a2a', strokeWidth: 5 }, 0.5, 0.5, Math.min(1, this.msgT * 2));
    if (this.phase === 'aim' && !t.you) label(d, g, `${t.hero.name} 瞄準中……`, cx + W / 2, by - 22, { size: 18, color: '#ffffff', stroke: '#1a1a2a', strokeWidth: 4 });
    if (this.phase === 'aim' && t.you) label(d, g, 'A/D 移動　W/S 角度　按住 Space 蓄力放開發射　1-4 換彈　Q/E 看地圖　開車撿空投補給', cx + W / 2, by - 22, { size: 15, color: '#ffffff', stroke: '#1a1a2a', strokeWidth: 4 });
    if (this.phase === 'over') label(d, g, session.reason, cx + W / 2, H * 0.4, { size: 40, color: '#ffe066', stroke: '#1a1a2a', strokeWidth: 8, weight: 900 });
  }
}

/** Blend two #rrggbb colours. */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}
