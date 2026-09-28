// The match: 8-player free-for-all in a top-down arena. The player aims with the mouse.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { label, panel, clamp } from '../ui.js';
import {
  CAST_URLS, ART, FIGHTERS, ARENA_W, ARENA_H, CRATES, BUSHES, SPAWNS, PICKUP_SPOTS, MAX_HP, SPEED, RADIUS,
  DASH_SPEED, DASH_TIME, DASH_CD, RESPAWN, SHIELD, KILL_TARGET, MATCH_TIME, PICKUP_RESPAWN, POWER_TIME,
  circleBox, blocked, ranking, type Fighter,
} from '../data.js';
import { session } from '../session.js';

const rng = Math.random;
interface P {
  f: Fighter; you: boolean; x: number; y: number; vx: number; vy: number; aim: number;
  hp: number; dead: number; shield: number; cd: number; dash: number; dashCd: number; dashDir: { x: number; y: number };
  power: number; kills: number; deaths: number; flash: number;
  // bot brain
  target: P | null; think: number; goal: { x: number; y: number }; strafe: number; lastHit: P | null;
}
interface Shot { owner: P; x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; kind: string; color: string; t: number; hits: Set<P>; back: boolean; }
interface Pickup { x: number; y: number; kind: 'heart' | 'bolt'; wait: number; }

export class Arena extends Scene {
  private fr: Record<string, number> = {};
  private ps: P[] = [];
  private me!: P;
  private shots: Shot[] = [];
  private pickups: Pickup[] = [];
  private feed: { a: P | null; b: P; t: number }[] = [];
  private clock = MATCH_TIME;
  private over = -1;
  private t = 0;
  private camX = 0;
  private camY = 0;
  private mouseDown = false;

  override preload(load: Preload): void {
    for (const u of [...Object.values(CAST_URLS), ART.crate, ART.bush, ART.heart, ART.bolt]) load.image(u);
  }

  override setup(): void {
    const a = this.game.assets;
    for (const [k, u] of Object.entries(CAST_URLS)) this.fr[k] = a.framesOf(u);
    this.fr.crate = a.framesOf(ART.crate); this.fr.bush = a.framesOf(ART.bush); this.fr.heart = a.framesOf(ART.heart); this.fr.bolt = a.framesOf(ART.bolt);
    this.input.bind({ up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], dash: ['Space', 'ShiftLeft'], fire: ['KeyJ'], board: ['Tab'], quit: ['Escape'] });
    this.input.onPointerDown?.(() => { this.mouseDown = true; });
    this.input.onPointerUp?.(() => { this.mouseDown = false; });
    const sd = this.sound;
    sd.define('pew', { type: 'square', freq: 900, freqEnd: 400, duration: 0.06, volume: 0.12 });
    sd.define('boom', { type: 'noise', duration: 0.35, curve: 'exponential', distortion: 0.3, volume: 0.45, filter: { type: 'lowpass', freq: 1400, freqEnd: 100 } });
    sd.define('hurt', { type: 'square', freq: 300, freqEnd: 120, duration: 0.1, volume: 0.25 });
    sd.define('ko', { notes: 'G5 C5', step: 0.08, type: 'square', volume: 0.3 });
    sd.define('pick', { notes: 'C6 E6 G6', step: 0.05, type: 'square', volume: 0.25 });
    sd.define('dash', { type: 'noise', duration: 0.15, volume: 0.2, filter: { type: 'bandpass', freq: 800, freqEnd: 2400, q: 1.5 } });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }

    const order = [FIGHTERS.find((f) => f.id === session.hero) ?? FIGHTERS[0], ...FIGHTERS.filter((f) => f.id !== session.hero)];
    this.ps = order.map((f, i) => {
      const s = SPAWNS[i % SPAWNS.length];
      return { f, you: i === 0, x: s[0], y: s[1], vx: 0, vy: 0, aim: 0, hp: MAX_HP, dead: 0, shield: SHIELD, cd: 0, dash: 0, dashCd: 0, dashDir: { x: 0, y: 0 }, power: 0, kills: 0, deaths: 0, flash: 0, target: null, think: rng(), goal: { x: s[0], y: s[1] }, strafe: rng() < 0.5 ? 1 : -1, lastHit: null };
    });
    this.me = this.ps[0];
    this.pickups = PICKUP_SPOTS.map((p) => ({ ...p, wait: 0 }));
  }

  // ── movement & collisions ──
  private collide(p: { x: number; y: number }, r: number): void {
    for (const c of CRATES) { const push = circleBox(p.x, p.y, r, c); if (push) { p.x += push.x; p.y += push.y; } }
    p.x = clamp(p.x, r, ARENA_W - r); p.y = clamp(p.y, r, ARENA_H - r);
  }

  private respawnPoint(): { x: number; y: number } {
    let best = SPAWNS[0], bd = -1;
    for (const s of SPAWNS) {
      let m = Infinity;
      for (const p of this.ps) if (p.dead <= 0) m = Math.min(m, Math.hypot(p.x - s[0], p.y - s[1]));
      m += rng() * 200;
      if (m > bd) { bd = m; best = s; }
    }
    return { x: best[0], y: best[1] };
  }

  private fire(p: P): void {
    const w = p.f.weapon;
    if (p.cd > 0 || p.dead > 0) return;
    p.cd = w.rate * (p.power > 0 ? 0.6 : 1);
    p.shield = 0;
    const mx = p.x + Math.cos(p.aim) * 30, my = p.y + Math.sin(p.aim) * 30;
    const dmg = w.dmg * (p.power > 0 ? 1.5 : 1);
    for (let i = 0; i < w.pellets; i++) {
      const a = w.pellets > 1 ? p.aim + (i / (w.pellets - 1) - 0.5) * w.spread * 2 + (w.kind === 'shotgun' ? (rng() - 0.5) * 0.1 : 0) : p.aim + (rng() - 0.5) * w.spread;
      this.shots.push({ owner: p, x: mx, y: my, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, r: w.r, dmg, life: w.range / w.speed, kind: w.kind, color: w.color, t: 0, hits: new Set(), back: false });
    }
    if (p.you || Math.hypot(p.x - this.me.x, p.y - this.me.y) < 700) this.sound.play('pew');
  }

  private damage(v: P, amt: number, by: P): void {
    if (v.dead > 0 || v.shield > 0 || v === by) return;
    v.hp -= amt;
    v.flash = 0.12;
    v.lastHit = by;
    if (v.you) { this.sound.play('hurt'); this.camera.shake(4, 0.15); }
    if (v.hp <= 0) this.kill(v, by);
  }

  private kill(v: P, by: P | null): void {
    v.hp = 0; v.dead = RESPAWN; v.deaths++;
    if (by && by !== v) { by.kills++; if (by.you) this.sound.play('ko'); }
    this.feed.unshift({ a: by, b: v, t: 5 });
    if (this.feed.length > 5) this.feed.pop();
    this.game.fx.emit({ x: v.x, y: v.y, count: 34, speed: 260, life: 0.6, size: 7, colors: [v.f.color, '#ffffff', '#ffe066'], add: true });
    this.sound.play('boom');
    if (by && by.kills >= KILL_TARGET) this.endMatch(`${by.f.name} 先拿到 ${KILL_TARGET} 殺！`);
  }

  private endMatch(reason: string): void {
    if (this.over >= 0) return;
    this.over = 0;
    session.reason = reason;
    session.stats = ranking(this.ps).map((p) => ({ id: p.f.id, kills: p.kills, deaths: p.deaths, you: p.you }));
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    if (this.input.keys.quit.pressed) { this.gotoTitle(); return; }
    if (this.over >= 0) { this.over += dt; if (this.over > 2.5) this.gotoGameOver(); }
    else {
      this.clock -= dt;
      if (this.clock <= 0) { this.clock = 0; this.endMatch('時間到！'); }
    }
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);

    for (const p of this.ps) {
      if (p.flash > 0) p.flash -= dt;
      if (p.cd > 0) p.cd -= dt;
      if (p.dashCd > 0) p.dashCd -= dt;
      if (p.power > 0) p.power -= dt;
      if (p.shield > 0) p.shield -= dt;
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { const s = this.respawnPoint(); p.x = s.x; p.y = s.y; p.hp = MAX_HP; p.shield = SHIELD; p.power = 0; }
        continue;
      }
      if (this.over >= 0) continue;
      if (p.you) this.controlPlayer(p); else this.bot(p, dt);
      if (p.dash > 0) { p.dash -= dt; p.vx = p.dashDir.x * DASH_SPEED; p.vy = p.dashDir.y * DASH_SPEED; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      this.collide(p, RADIUS);
    }
    // Players push apart.
    for (let i = 0; i < this.ps.length; i++) for (let j = i + 1; j < this.ps.length; j++) {
      const a = this.ps[i], b = this.ps[j];
      if (a.dead > 0 || b.dead > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < RADIUS * 2) { const k = (RADIUS * 2 - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
    this.updateShots(dt);
    this.updatePickups(dt);
    // Camera.
    const W = this.width, H = this.height;
    this.camX = clamp(this.me.x - W / 2, Math.min(0, (ARENA_W - W) / 2), Math.max(ARENA_W - W, (ARENA_W - W) / 2));
    this.camY = clamp(this.me.y - H / 2, Math.min(0, (ARENA_H - H) / 2), Math.max(ARENA_H - H, (ARENA_H - H) / 2));
    this.camera.x = this.camX; this.camera.y = this.camY;
  }

  private controlPlayer(p: P): void {
    const k = this.input.keys;
    let dx = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0), dy = (k.down.held ? 1 : 0) - (k.up.held ? 1 : 0);
    const n = Math.hypot(dx, dy) || 1;
    dx /= n; dy /= n;
    p.vx = dx * SPEED; p.vy = dy * SPEED;
    const ptr = this.input.pointer;
    if (ptr) {
      // Pointer is in world units of the view; add the camera offset if the engine reports view-relative coordinates.
      const wx = ptr.x, wy = ptr.y;
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    }
    if (k.dash.pressed && p.dashCd <= 0) {
      const dir = dx || dy ? { x: dx, y: dy } : { x: Math.cos(p.aim), y: Math.sin(p.aim) };
      p.dash = DASH_TIME; p.dashCd = DASH_CD; p.dashDir = dir;
      this.sound.play('dash');
    }
    if (this.mouseDown || ptr?.isDown || k.fire.held) this.fire(p);
  }

  private bot(p: P, dt: number): void {
    const w = p.f.weapon;
    p.think -= dt;
    if (p.think <= 0) {
      p.think = 0.25 + rng() * 0.2;
      // Pick the nearest visible enemy (prefer whoever just hit me).
      let best: P | null = null, bd = Infinity;
      for (const o of this.ps) {
        if (o === p || o.dead > 0) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y) - (o === p.lastHit ? 250 : 0) - (o.you ? 60 : 0);
        if (d < bd && d < 900 && !blocked(p.x, p.y, o.x, o.y)) { bd = d; best = o; }
      }
      p.target = best;
      if (!best) {
        // Wander toward a pickup (hearts when hurt) or a random spot.
        const want = this.pickups.filter((q) => q.wait <= 0 && (q.kind === 'bolt' || p.hp < 70));
        const q = want.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (q && rng() < 0.7) p.goal = { x: q.x, y: q.y };
        else if (Math.hypot(p.goal.x - p.x, p.goal.y - p.y) < 60 || rng() < 0.1) p.goal = { x: 150 + rng() * (ARENA_W - 300), y: 150 + rng() * (ARENA_H - 300) };
      }
      if (rng() < 0.15) p.strafe = -p.strafe;
    }
    const t = p.target;
    if (t && t.dead <= 0) {
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
      const lead = d / w.speed;
      const ax = t.x + t.vx * lead * 0.7, ay = t.y + t.vy * lead * 0.7;
      p.aim = Math.atan2(ay - p.y, ax - p.x) + (rng() - 0.5) * 0.3;
      const fwd = d > w.pref + 60 ? 1 : d < w.pref - 60 ? -1 : 0;
      p.vx = ((dx / d) * fwd + (-dy / d) * p.strafe * 0.8) * SPEED * 0.9;
      p.vy = ((dy / d) * fwd + (dx / d) * p.strafe * 0.8) * SPEED * 0.9;
      if (d < w.range * 0.9 && rng() < 0.8) this.fire(p);
      if (p.hp < 35 && p.dashCd <= 0 && rng() < 0.03) { p.dash = DASH_TIME; p.dashCd = DASH_CD; p.dashDir = { x: -dx / d, y: -dy / d }; }
    } else {
      const dx = p.goal.x - p.x, dy = p.goal.y - p.y, d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * SPEED * 0.8; p.vy = (dy / d) * SPEED * 0.8;
      p.aim = Math.atan2(dy, dx);
    }
    // Nudge around crates.
    for (const c of CRATES) {
      const cx = c[0] + c[2] / 2, cy = c[1] + c[3] / 2;
      const ox = p.x - cx, oy = p.y - cy, od = Math.hypot(ox, oy);
      if (od < 110) { p.vx += (ox / od) * 90; p.vy += (oy / od) * 90; }
    }
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt; s.life -= dt;
      if (s.kind === 'boomerang' && !s.back && s.life < 0.35) { s.back = true; s.life = 1.2; }
      if (s.back) {
        const o = s.owner, dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy) || 1;
        s.vx += (dx / d) * 2600 * dt; s.vy += (dy / d) * 2600 * dt;
        const sp = Math.hypot(s.vx, s.vy); if (sp > 700) { s.vx *= 700 / sp; s.vy *= 700 / sp; }
        if (d < 30) s.life = 0;
      }
      if (s.kind === 'grenade') { s.vx *= 1 - 1.4 * dt; s.vy *= 1 - 1.4 * dt; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > ARENA_W || s.y > ARENA_H;
      if (!dead && s.kind !== 'boomerang') for (const c of CRATES) if (s.x > c[0] && s.x < c[0] + c[2] && s.y > c[1] && s.y < c[1] + c[3]) { dead = true; break; }
      if (!dead) {
        for (const p of this.ps) {
          if (p === s.owner || p.dead > 0 || s.hits.has(p)) continue;
          if (Math.hypot(p.x - s.x, p.y - s.y) < RADIUS + s.r) {
            if (s.kind === 'grenade') { dead = true; break; }
            s.hits.add(p);
            this.damage(p, s.dmg, s.owner);
            this.game.fx.emit({ x: s.x, y: s.y, count: 8, speed: 120, life: 0.25, size: 4, color: s.color, add: true });
            if (s.kind !== 'boomerang' && s.kind !== 'sniper') { dead = true; break; }
          }
        }
      }
      if (dead) {
        if (s.kind === 'grenade') {
          this.game.fx.emit({ x: s.x, y: s.y, count: 40, speed: 240, life: 0.45, size: 9, ramp: 'ice', add: true });
          this.sound.play('boom');
          for (const p of this.ps) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < 110) this.damage(p, s.dmg * (1 - d / 220), s.owner); }
        }
        this.shots.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number): void {
    for (const q of this.pickups) {
      if (q.wait > 0) { q.wait -= dt; continue; }
      for (const p of this.ps) {
        if (p.dead > 0 || Math.hypot(p.x - q.x, p.y - q.y) > 40) continue;
        if (q.kind === 'heart') { if (p.hp >= MAX_HP) continue; p.hp = Math.min(MAX_HP, p.hp + 40); }
        else p.power = POWER_TIME;
        q.wait = PICKUP_RESPAWN;
        if (p.you) this.sound.play('pick');
        break;
      }
    }
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const g = this.game, W = this.width, H = this.height;
    // Floor: pastel tiles.
    d.rect(this.camX - 50, this.camY - 50, W + 100, H + 100, '#2a2140');
    const T = 80;
    const x0 = Math.max(0, Math.floor(this.camX / T)), x1 = Math.min(ARENA_W / T - 1, Math.ceil((this.camX + W) / T));
    const y0 = Math.max(0, Math.floor(this.camY / T)), y1 = Math.min(ARENA_H / T - 1, Math.ceil((this.camY + H) / T));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) d.rect(tx * T, ty * T, T, T, (tx + ty) % 2 ? '#fde7ef' : '#f8dbe8');
    d.rect(ARENA_W / 2 - 200, ARENA_H / 2 - 200, 400, 400, '#ffd6e4', 0.6);
    d.ring(ARENA_W / 2, ARENA_H / 2, 180, 6, '#ff9fc4', 0.6);
    // Border.
    d.rect(-20, -20, ARENA_W + 40, 20, '#6b4a9a'); d.rect(-20, ARENA_H, ARENA_W + 40, 20, '#6b4a9a');
    d.rect(-20, 0, 20, ARENA_H, '#6b4a9a'); d.rect(ARENA_W, 0, 20, ARENA_H, '#6b4a9a');
    for (const [bx, by] of BUSHES) this.spriteC(d, this.fr.bush, bx, by, 110);
    for (const q of this.pickups) if (q.wait <= 0) this.spriteC(d, q.kind === 'heart' ? this.fr.heart : this.fr.bolt, q.x, q.y + Math.sin(this.t * 4 + q.x) * 5, 48);
    // Crates & players depth-sorted by y.
    type It = { y: number; fn: () => void };
    const items: It[] = CRATES.map((c) => ({ y: c[1] + c[3], fn: () => d.sprite(this.fr.crate, c[0], c[1] - 16, { w: c[2], h: c[3] + 16 }) }));
    for (const p of this.ps) {
      if (p.dead > 0) continue;
      items.push({ y: p.y + 20, fn: () => this.drawP(d, p) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();
    for (const s of this.shots) {
      if (s.kind === 'sniper') { d.line(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.x, s.y, 4, s.color); continue; }
      if (s.kind === 'boomerang') { d.rect(s.x - 10, s.y - 4, 20, 8, s.color, 1, s.t * 18); continue; }
      if (s.kind === 'book') { d.rect(s.x - 7, s.y - 5, 14, 10, s.color, 1, s.t * 10); continue; }
      d.circle(s.x, s.y, s.r, s.color, s.kind === 'bubble' ? 0.75 : 1);
      if (s.kind === 'bubble' || s.kind === 'grenade') d.ring(s.x, s.y, s.r, 2, '#ffffff');
    }
    // Aim reticle.
    if (this.me.dead <= 0) {
      const ax = this.me.x + Math.cos(this.me.aim) * 70, ay = this.me.y + Math.sin(this.me.aim) * 70;
      d.ring(ax, ay, 8, 2, '#ff3b7a');
    }
    this.drawHud2(d, W, H);
  }

  private spriteC(d: Draw, f: number, x: number, y: number, h: number, opts: { flipX?: boolean; tint?: string; alpha?: number } = {}): void {
    const sz = this.game.assets.frameSize(f), w = (sz.w / sz.h) * h;
    d.sprite(f, x - w / 2, y - h / 2, { w, h, ...opts });
  }

  private drawP(d: Draw, p: P): void {
    d.fill(Array.from({ length: 14 }, (_, i) => ({ x: p.x + Math.cos((i / 14) * Math.PI * 2) * 22, y: p.y + 22 + Math.sin((i / 14) * Math.PI * 2) * 8 })), '#000000', 0.25);
    d.ring(p.x, p.y + 22, 24, 3, p.you ? '#39c6ff' : p.f.color, 0.9);
    const bob = Math.hypot(p.vx, p.vy) > 10 ? Math.abs(Math.sin(this.t * 14)) * -4 : 0;
    const f = this.fr[p.f.id], sz = this.game.assets.frameSize(f), h = 72, w = (sz.w / sz.h) * h;
    const tint = p.flash > 0 ? '#ff8080' : p.power > 0 && Math.floor(this.t * 10) % 2 ? '#fff3a0' : undefined;
    d.sprite(f, p.x - w / 2, p.y + 24 - h + bob, { w, h, flipX: Math.cos(p.aim) < 0, tint, alpha: p.shield > 0 ? 0.6 : 1 });
    if (p.shield > 0) d.ring(p.x, p.y - 10, 40, 3, '#9fe3ff', 0.7);
    // Weapon line.
    d.line(p.x, p.y - 6, p.x + Math.cos(p.aim) * 30, p.y - 6 + Math.sin(p.aim) * 30, 6, p.f.weapon.color);
    // HP bar + name.
    d.rect(p.x - 26, p.y - 64, 52, 7, '#000000', 0.6);
    d.rect(p.x - 25, p.y - 63, 50 * clamp(p.hp / MAX_HP, 0, 1), 5, p.hp > 50 ? '#5cffb0' : p.hp > 25 ? '#ffd23f' : '#ff5f3a');
    label(d, this.game, p.you ? `▼${p.f.name}` : p.f.name, p.x, p.y - 76, { size: 14, color: p.you ? '#39c6ff' : '#ffffff', stroke: '#000000', strokeWidth: 3 });
  }

  private drawHud2(d: Draw, W: number, H: number): void {
    const g = this.game, cx = this.camX, cy = this.camY, me = this.me;
    // Top bar.
    panel(d, { x: cx + W / 2 - 120, y: cy + 10, w: 240, h: 56 });
    const m = Math.floor(this.clock / 60), s = Math.floor(this.clock % 60);
    label(d, g, `${m}:${s < 10 ? '0' : ''}${s}`, cx + W / 2, cy + 30, { size: 26, color: '#ffe066' });
    const lead = ranking(this.ps)[0];
    label(d, g, `領先：${lead.f.name} ${lead.kills} 殺（目標 ${KILL_TARGET}）`, cx + W / 2, cy + 55, { size: 14, color: '#ffffff' });
    // Player card.
    panel(d, { x: cx + 16, y: cy + H - 96, w: 300, h: 80 });
    this.spriteC(d, this.fr[me.f.id], cx + 52, cy + H - 56, 70);
    label(d, g, `${me.f.name}｜${me.f.weapon.name}`, cx + 90, cy + H - 80, { size: 16, color: '#ffffff' }, 0, 0.5);
    d.rect(cx + 90, cy + H - 64, 210, 12, '#000000', 0.6);
    d.rect(cx + 91, cy + H - 63, 208 * clamp(me.hp / MAX_HP, 0, 1), 10, '#5cffb0');
    label(d, g, `擊殺 ${me.kills}　死亡 ${me.deaths}${me.power > 0 ? '　⚡強化中' : ''}${me.dashCd > 0 ? '' : '　衝刺 OK'}`, cx + 90, cy + H - 34, { size: 14, color: '#ffe8a0' }, 0, 0.5);
    // Kill feed.
    this.feed.forEach((f, i) => {
      const y = cy + 20 + i * 34, x = cx + W - 20;
      const txt = f.a && f.a !== f.b ? `${f.a.f.name}  →  ${f.b.f.name}` : `${f.b.f.name} 倒下了`;
      const involved = f.a?.you || f.b.you;
      d.rect(x - 250, y - 14, 250, 28, involved ? '#39c6ff' : '#000000', involved ? 0.5 : 0.45);
      if (f.a) this.spriteC(d, this.fr[f.a.f.id], x - 236, y, 26);
      this.spriteC(d, this.fr[f.b.f.id], x - 16, y, 26);
      label(d, g, txt, x - 125, y, { size: 14, color: '#ffffff' }, 0.5, 0.5, clamp(f.t, 0, 1));
    });
    // Minimap.
    const mw = 180, mh = 120, mx = cx + W - mw - 16, my = cy + H - mh - 16;
    d.rect(mx - 2, my - 2, mw + 4, mh + 4, '#ffffff', 0.5); d.rect(mx, my, mw, mh, '#2a2140', 0.85);
    for (const c of CRATES) d.rect(mx + (c[0] / ARENA_W) * mw, my + (c[1] / ARENA_H) * mh, (c[2] / ARENA_W) * mw, (c[3] / ARENA_H) * mh, '#b58a5a');
    for (const p of this.ps) if (p.dead <= 0) d.circle(mx + (p.x / ARENA_W) * mw, my + (p.y / ARENA_H) * mh, p.you ? 4 : 3, p.you ? '#39c6ff' : p.f.color);
    // Death / scoreboard.
    if (me.dead > 0 && this.over < 0) label(d, g, `被擊倒了！${Math.ceil(me.dead)} 秒後復活`, cx + W / 2, cy + H * 0.4, { size: 36, color: '#ff6b6b', stroke: '#000000', strokeWidth: 6 });
    if (this.input.keys.board.held || this.over >= 0) {
      panel(d, { x: cx + W / 2 - 230, y: cy + 110, w: 460, h: 60 + this.ps.length * 38 });
      label(d, g, this.over >= 0 ? session.reason : '記分板', cx + W / 2, cy + 138, { size: 22, color: '#ffe066' });
      ranking(this.ps).forEach((p, i) => {
        const y = cy + 184 + i * 38;
        this.spriteC(d, this.fr[p.f.id], cx + W / 2 - 190, y, 32);
        label(d, g, `${i + 1}. ${p.f.name}${p.you ? '（你）' : ''}`, cx + W / 2 - 160, y, { size: 18, color: p.you ? '#39c6ff' : '#ffffff' }, 0, 0.5);
        label(d, g, `${p.kills} 殺 / ${p.deaths} 死`, cx + W / 2 + 200, y, { size: 18, color: '#ffe8a0' }, 1, 0.5);
      });
    }
    if (this.t < 5) label(d, g, 'WASD 移動　滑鼠瞄準　按住左鍵射擊　Space 衝刺　Tab 記分板', cx + W / 2, cy + H - 120, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
  }
}
