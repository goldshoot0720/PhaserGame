// The arena: four players drop water balloons on a 15×13 grid. Soaked players are trapped in a bubble —
// a rival touching the bubble pops it, a needle frees you, otherwise it bursts after a few seconds.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { label, panel, clamp } from '../ui.js';
import { preloadMenu, menuFrames, spriteB } from '../menu.js';
import {
  ART, HEROES, PLAYER_COLORS, COLS, ROWS, EMPTY, SOLID, BOX, FUSE, WATER_TIME, TRAP_TIME, MAX_BALLOONS, MAX_RANGE, MAX_SPEED_LV, ROUND_TIME, SPAWNS,
  ITEM_NAMES, makeGrid, passable, chain, dropFor, key, botDecide, speedOf, matchWinner, type Cell, type Hero, type ItemKind,
} from '../rules.js';
import { session } from '../session.js';

interface Balloon { c: number; r: number; t: number; range: number; owner: number; }
interface Player {
  i: number; hero: Hero; you: boolean; color: string; x: number; y: number; face: number; dead: boolean; deadT: number; trapped: number;
  max: number; range: number; speedLv: number; needles: number; wins: number; path: [number, number][]; think: number; stuck: number; lastX: number; lastY: number; walk: number;
}
interface Float { x: number; y: number; text: string; color: string; t: number; }
type Phase = 'intro' | 'play' | 'end';

export class Play extends Scene {
  private f: Record<string, number> = {};
  private grid: Cell[][] = [];
  private balloons: Balloon[] = [];
  private water = new Map<number, number>();
  private items = new Map<number, { kind: ItemKind; safe: number }>();
  private ps: Player[] = [];
  private round = 0;
  private clock = ROUND_TIME;
  private phase: Phase = 'intro';
  private timer = 0;
  private t = 0;
  private floats: Float[] = [];
  private roundMsg = '';
  private T = 48;
  private bx = 0;
  private by = 0;

  override preload(load: Preload): void { preloadMenu(load); }

  override setup(): void {
    this.f = menuFrames(this.game);
    this.input.bind({ up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], drop: ['Space'], needle: ['ShiftLeft', 'ShiftRight', 'KeyE'], quit: ['Escape'] });
    const sd = this.sound;
    sd.define('place', { type: 'sine', freq: 300, freqEnd: 520, duration: 0.09, volume: 0.25 });
    sd.define('splash', { type: 'noise', duration: 0.45, volume: 0.4, filter: { type: 'bandpass', freq: 1400, freqEnd: 300, q: 0.9 } });
    sd.define('trap', { notes: 'C6 G5 E5', step: 0.06, type: 'sine', volume: 0.3 });
    sd.define('popped', { notes: 'G5 C5 G4', step: 0.06, type: 'square', volume: 0.3 });
    sd.define('item', { notes: 'E6 G6 C7', step: 0.05, type: 'square', volume: 0.22 });
    sd.define('free', { notes: 'C5 E5 G5 C6', step: 0.05, type: 'triangle', volume: 0.3 });
    sd.define('go', { notes: 'C5 C5 C5 G5:2', step: 0.12, type: 'square', volume: 0.3 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.28 }); session.musicOn = true; }
    const me = HEROES.find((h) => h.id === session.hero) ?? HEROES[0];
    const rivals = HEROES.filter((h) => h !== me).sort(() => Math.random() - 0.5).slice(0, 3);
    this.ps = [me, ...rivals].map((hero, i) => ({
      i, hero, you: i === 0, color: PLAYER_COLORS[i], x: 0, y: 0, face: 1, dead: false, deadT: 0, trapped: 0, max: 1, range: 1, speedLv: 0, needles: 0, wins: 0,
      path: [], think: 0, stuck: 0, lastX: 0, lastY: 0, walk: 0,
    }));
    this.newRound();
  }

  private newRound(): void {
    this.round++;
    this.grid = makeGrid(1 + Math.floor(Math.random() * 1e6));
    this.balloons = []; this.water.clear(); this.items.clear(); this.floats = [];
    this.ps.forEach((p, i) => {
      const [c, r] = SPAWNS[i];
      Object.assign(p, { x: c, y: r, dead: false, deadT: 0, trapped: 0, max: p.hero.balloons, range: p.hero.range, speedLv: p.hero.speed, needles: 1, path: [], think: 0.3 + i * 0.1, stuck: 0 });
    });
    this.clock = ROUND_TIME; this.phase = 'intro'; this.timer = 2.2;
    this.sound.play('go');
  }

  // ── helpers ──
  private open(c: number, r: number): boolean { return passable(this.grid, this.balloons, c, r); }
  private tileOf(p: Player): [number, number] { return [Math.round(p.x), Math.round(p.y)]; }
  private float(c: number, r: number, text: string, color: string): void { this.floats.push({ x: c, y: r, text, color, t: 1.4 }); }
  private active(p: Player): number { return this.balloons.filter((b) => b.owner === p.i).length; }

  /** Grid movement with corner sliding: align to the lane first, then advance until the next cell is blocked. */
  private move(p: Player, dx: number, dy: number, dt: number): void {
    if (!dx && !dy) return;
    let sp = (p.trapped > 0 ? 0.55 : speedOf(p.speedLv)) * dt;
    const cc = Math.round(p.x), cr = Math.round(p.y);
    if (dx) p.face = dx;
    const along = dx ? 'x' : 'y', across = dx ? 'y' : 'x', d = dx || dy;
    const cur = along === 'x' ? cc : cr, lane = across === 'y' ? cr : cc;
    const off = p[across] - lane;
    const ahead = (ln: number): boolean => (along === 'x' ? this.open(cc + d, ln) : this.open(ln, cr + d));
    const here = (ln: number): boolean => (along === 'x' ? this.open(cc, ln) : this.open(ln, cr));
    let target = lane;
    if (!ahead(lane) && Math.abs(off) > 0.12) { const alt = lane + Math.sign(off); if (ahead(alt) && here(alt)) target = alt; }
    const gap = target - p[across];
    if (Math.abs(gap) > 0.001) {
      if (!ahead(target) && target === lane) { /* blocked straight ahead: just re-centre */ }
      const m = Math.min(Math.abs(gap), sp);
      p[across] += Math.sign(gap) * m; sp -= m;
      if (Math.abs(target - p[across]) > 0.001) return;
      p[across] = target;
    }
    let n = p[along] + d * sp;
    const laneNow = Math.round(p[across]);
    const blocked = along === 'x' ? !this.open(cur + d, laneNow) : !this.open(laneNow, cur + d);
    if (blocked) n = d > 0 ? Math.min(n, cur) : Math.max(n, cur);
    p[along] = clamp(n, 0, along === 'x' ? COLS - 1 : ROWS - 1);
    p.walk += dt;
  }

  private drop(p: Player): void {
    const [c, r] = this.tileOf(p);
    if (p.trapped > 0 || p.dead || this.active(p) >= p.max || this.grid[r][c] !== EMPTY || this.balloons.some((b) => b.c === c && b.r === r)) return;
    this.balloons.push({ c, r, t: FUSE, range: p.range, owner: p.i });
    this.sound.play('place');
  }

  private explode(i: number): void {
    const res = chain(this.grid, this.balloons, i);
    for (const [c, r] of res.tiles) {
      this.water.set(key(c, r), WATER_TIME);
      const it = this.items.get(key(c, r));
      if (it && it.safe <= 0) this.items.delete(key(c, r));
    }
    for (const [c, r] of res.boxes) {
      this.grid[r][c] = EMPTY;
      const k = dropFor(Math.random());
      if (k) this.items.set(key(c, r), { kind: k, safe: WATER_TIME + 0.05 });
      this.game.fx.emit({ x: this.bx + (c + 0.5) * this.T, y: this.by + (r + 0.5) * this.T, count: 12, speed: 140, life: 0.5, size: 5, colors: ['#c98a4a', '#ffe0a0', '#5ab0a0'] });
    }
    const gone = new Set(res.balloons);
    this.balloons = this.balloons.filter((_, j) => !gone.has(j));
    this.sound.play('splash');
    this.camera.shake(3, 0.12);
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    this.t += dt; this.timer -= dt;
    const k = this.input.keys;
    if (k.quit.pressed) { this.gotoTitle(); return; }
    for (const fl of this.floats) { fl.t -= dt; fl.y -= 0.6 * dt; }
    this.floats = this.floats.filter((fl) => fl.t > 0);
    if (this.phase === 'intro') { if (this.timer <= 0) this.phase = 'play'; return; }
    if (this.phase === 'end') {
      this.stepWorld(dt);
      if (this.timer <= 0) {
        const w = matchWinner(this.ps.map((p) => p.wins), this.round);
        if (w === null) this.newRound();
        else this.finish(w);
      }
      return;
    }
    this.clock -= dt;
    // You.
    const me = this.ps[0];
    if (!me.dead) {
      const dx = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0), dy = (k.down.held ? 1 : 0) - (k.up.held ? 1 : 0);
      if (dx) this.move(me, dx, 0, dt); else if (dy) this.move(me, 0, dy, dt);
      if (k.drop.pressed) this.drop(me);
      if (k.needle.pressed) this.useNeedle(me);
    }
    for (const p of this.ps) if (!p.you && !p.dead) this.bot(p, dt);
    this.stepWorld(dt);
    this.checkRoundEnd();
  }

  private stepWorld(dt: number): void {
    // Fuses.
    for (const b of this.balloons) b.t -= dt;
    for (let guard = 0; guard < 20; guard++) { const i = this.balloons.findIndex((b) => b.t <= 0); if (i < 0) break; this.explode(i); }
    for (const [k2, v] of this.water) { if (v - dt <= 0) this.water.delete(k2); else this.water.set(k2, v - dt); }
    for (const it of this.items.values()) it.safe -= dt;
    for (const p of this.ps) {
      if (p.dead) { p.deadT += dt; continue; }
      const [c, r] = this.tileOf(p);
      if (p.trapped > 0) {
        p.trapped -= dt;
        if (p.trapped <= 0) this.kill(p, null);
        continue;
      }
      if (this.water.has(key(c, r))) { p.trapped = TRAP_TIME; p.path = []; this.sound.play('trap'); this.float(c, r, '被水泡困住！', '#9fe3ff'); continue; }
      const it = this.items.get(key(c, r));
      if (it) {
        this.items.delete(key(c, r));
        if (it.kind === 'balloon') p.max = Math.min(MAX_BALLOONS, p.max + 1);
        else if (it.kind === 'potion') p.range = Math.min(MAX_RANGE, p.range + 1);
        else if (it.kind === 'ultra') p.range = MAX_RANGE;
        else if (it.kind === 'skate') p.speedLv = Math.min(MAX_SPEED_LV, p.speedLv + 1);
        else p.needles++;
        this.float(c, r, ITEM_NAMES[it.kind], '#ffe066');
        if (p.you) this.sound.play('item');
      }
    }
    // Rivals touching a bubble pop it.
    for (const p of this.ps) {
      if (p.dead || p.trapped <= 0) continue;
      for (const q of this.ps) if (q !== p && !q.dead && q.trapped <= 0 && Math.hypot(q.x - p.x, q.y - p.y) < 0.7) { this.kill(p, q); break; }
    }
  }

  private useNeedle(p: Player): void {
    if (p.trapped <= 0 || p.needles <= 0) return;
    p.needles--; p.trapped = 0;
    const [c, r] = this.tileOf(p);
    this.float(c, r, '用針脫困！', '#ffb0d0');
    this.sound.play('free');
  }

  private kill(p: Player, by: Player | null): void {
    p.dead = true; p.trapped = 0; p.deadT = 0;
    const [c, r] = this.tileOf(p);
    this.float(c, r, by ? `被 ${by.hero.name} 戳破！` : '水泡爆掉了！', '#ff8aa0');
    this.game.fx.emit({ x: this.bx + (p.x + 0.5) * this.T, y: this.by + (p.y + 0.5) * this.T - 10, count: 40, speed: 220, life: 0.7, size: 7, colors: ['#ffffff', '#9fe3ff', '#6fb8ff', p.color], add: true });
    this.sound.play('popped');
  }

  private checkRoundEnd(): void {
    const alive = this.ps.filter((p) => !p.dead);
    let winner: Player | null | undefined;
    if (alive.length === 0) winner = null;
    else if (alive.length === 1 && alive[0].trapped <= 0) winner = alive[0];
    else if (this.clock <= 0) winner = null;
    if (winner === undefined) return;
    if (winner) { winner.wins++; this.roundMsg = winner.you ? '你贏了這一回合！' : `${winner.hero.name} 贏得這一回合`; }
    else this.roundMsg = this.clock <= 0 ? '時間到，平手！' : '同歸於盡，平手！';
    this.phase = 'end'; this.timer = 3;
    this.sound.play(winner?.you ? 'free' : 'trap');
  }

  private finish(w: number): void {
    session.winner = w;
    session.results = [...this.ps].sort((a, b) => b.wins - a.wins).map((p) => ({ id: p.hero.id, name: p.hero.name, you: p.you, wins: p.wins, color: p.color }));
    session.rounds = this.round;
    this.gotoGameOver();
  }

  // ── bots ──
  private bot(p: Player, dt: number): void {
    if (p.trapped > 0) { if (p.needles > 0 && p.trapped < TRAP_TIME - 0.6) this.useNeedle(p); return; }
    p.think -= dt;
    const [c, r] = this.tileOf(p);
    if (p.think <= 0 || !p.path.length) {
      p.think = 0.35 + Math.random() * 0.2;
      const act = botDecide({
        grid: this.grid, balloons: this.balloons, wet: [...this.water.keys()], items: [...this.items.keys()].map((k2) => ({ c: k2 % COLS, r: Math.floor(k2 / COLS) })),
        me: { c, r, left: p.max - this.active(p), range: p.range, speed: speedOf(p.speedLv) },
        foes: this.ps.filter((o) => o !== p && !o.dead).map((o) => ({ c: Math.round(o.x), r: Math.round(o.y), trapped: o.trapped > 0 })),
      }, Math.random());
      if (act.kind === 'bomb') { this.drop(p); p.path = act.path; p.think = 0.6; }
      else if (act.kind === 'move') p.path = act.path;
      else p.path = [];
    }
    const next = p.path[0];
    if (!next) return;
    const [tc, tr] = next;
    if (Math.abs(tc - p.x) > 0.05) this.move(p, Math.sign(tc - p.x), 0, dt);
    else if (Math.abs(tr - p.y) > 0.05) this.move(p, 0, Math.sign(tr - p.y), dt);
    else { p.x = tc; p.y = tr; p.path.shift(); }
    // Unstick if blocked (a balloon or box appeared on the route).
    if (Math.hypot(p.x - p.lastX, p.y - p.lastY) < 0.001) { p.stuck += dt; if (p.stuck > 0.4) { p.path = []; p.stuck = 0; } } else p.stuck = 0;
    p.lastX = p.x; p.lastY = p.y;
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game;
    this.T = Math.floor(Math.min((H - 70) / ROWS, (W - 40) / COLS, 52));
    const T = this.T;
    this.bx = Math.round((W - COLS * T) / 2); this.by = H - ROWS * T - 12;
    const { bx, by } = this;
    d.rect(0, 0, W, H, '#2a6a8f');
    for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) d.rect(x, y, 40, 40, '#2f7399');
    d.rect(bx - 10, by - 10, COLS * T + 20, ROWS * T + 20, '#1a3a5a');
    d.rect(bx - 6, by - 6, COLS * T + 12, ROWS * T + 12, '#ffd46a');
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) d.rect(bx + c * T, by + r * T, T, T, (r + c) % 2 ? '#bfeaa0' : '#aee08c');
    // Water streams.
    for (const [k2, v] of this.water) {
      const c = k2 % COLS, r = Math.floor(k2 / COLS), x = bx + (c + 0.5) * T, y = by + (r + 0.5) * T, a = Math.min(1, v / WATER_TIME * 1.6);
      d.circle(x, y, T * 0.46, '#3aa8ff', a);
      for (const [dc, dr] of [[1, 0], [0, 1]] as [number, number][]) if (this.water.has(key(c + dc, r + dr)) && c + dc < COLS) d.rect(x + (dc ? 0 : -T * 0.42), y + (dr ? 0 : -T * 0.42), dc ? T : T * 0.84, dr ? T : T * 0.84, '#3aa8ff', a);
      d.circle(x - T * 0.12, y - T * 0.12, T * 0.14, '#ffffff', a * 0.7);
    }
    // Items.
    for (const [k2, it] of this.items) {
      const c = k2 % COLS, r = Math.floor(k2 / COLS), x = bx + (c + 0.5) * T, y = by + (r + 0.5) * T + Math.sin(this.t * 4 + c) * 3;
      d.circle(x, y, T * 0.42, '#ffffff', 0.55);
      const fr = it.kind === 'balloon' ? this.f.balloon : it.kind === 'skate' ? this.f.skate : it.kind === 'needle' ? this.f.needle : this.f.potion;
      spriteB(d, g, fr, x, y + T * 0.32, T * 0.66, { tint: it.kind === 'ultra' ? '#ff7a9a' : undefined });
    }
    // Row-sorted blocks, balloons and players.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (cell === SOLID) spriteB(d, g, this.f.house, bx + (c + 0.5) * T, by + (r + 1) * T, T * 1.22);
        else if (cell === BOX) spriteB(d, g, this.f.crate, bx + (c + 0.5) * T, by + (r + 1) * T, T * 1.1);
      }
      for (const b of this.balloons) if (b.r === r) {
        const pulse = 1 + Math.sin(this.t * (b.t < 0.8 ? 22 : 9)) * 0.06;
        d.fill(Array.from({ length: 10 }, (_, i) => ({ x: bx + (b.c + 0.5) * T + Math.cos((i / 10) * Math.PI * 2) * T * 0.34, y: by + (b.r + 0.9) * T + Math.sin((i / 10) * Math.PI * 2) * T * 0.1 })), '#000000', 0.25);
        spriteB(d, g, this.f.balloon, bx + (b.c + 0.5) * T, by + (b.r + 0.95) * T, T * 0.92 * pulse, { tint: b.t < 0.6 && Math.floor(this.t * 12) % 2 ? '#ff9ab0' : undefined });
      }
      for (const p of this.ps) if (Math.round(p.y) === r) this.drawPlayer(d, p);
    }
    for (const fl of this.floats) label(d, g, fl.text, bx + (fl.x + 0.5) * T, by + fl.y * T - 10, { size: 17, color: fl.color, stroke: '#1a2a4a', strokeWidth: 4, weight: 900 }, 0.5, 0.5, Math.min(1, fl.t * 2));
    this.drawHudBar(d, W, H);
  }

  private drawPlayer(d: Draw, p: Player): void {
    const g = this.game, T = this.T, x = this.bx + (p.x + 0.5) * T, foot = this.by + (p.y + 0.5) * T + T * 0.38;
    if (p.dead) {
      if (p.deadT < 1.2) spriteB(d, g, this.f[p.hero.id], x, foot - p.deadT * 40, T * 1.3, { alpha: 1 - p.deadT / 1.2, tint: '#9fb4d8' });
      return;
    }
    d.fill(Array.from({ length: 10 }, (_, i) => ({ x: x + Math.cos((i / 10) * Math.PI * 2) * T * 0.3, y: foot + Math.sin((i / 10) * Math.PI * 2) * T * 0.1 })), '#000000', 0.25);
    d.ring(x, foot, T * 0.3, 3, p.color, 0.9);
    const bob = p.trapped > 0 ? Math.sin(this.t * 3) * 4 - 8 : -Math.abs(Math.sin(p.walk * 12)) * 3;
    spriteB(d, g, this.f[p.hero.id], x, foot + bob, T * 1.32, { flipX: p.face < 0 });
    if (p.trapped > 0) {
      const cy = foot - T * 0.6 + bob, rr = T * 0.78;
      d.circle(x, cy, rr, '#9fe3ff', 0.38);
      d.ring(x, cy, rr, 3, '#ffffff', 0.9);
      d.circle(x - rr * 0.4, cy - rr * 0.45, rr * 0.16, '#ffffff', 0.85);
      label(d, g, `${Math.ceil(p.trapped)}`, x, cy - rr - 8, { size: 16, color: '#ffffff', stroke: '#1a4a8a', strokeWidth: 4 });
    }
    if (p.you) label(d, g, '▼', x, foot - T * 1.5 + Math.sin(this.t * 5) * 3, { size: 16, color: '#ffe066', stroke: '#1a2a4a', strokeWidth: 3 });
  }

  private drawHudBar(d: Draw, W: number, H: number): void {
    const g = this.game, top = 6;
    const m = Math.max(0, Math.floor(this.clock / 60)), s = Math.max(0, Math.floor(this.clock % 60));
    panel(d, { x: W / 2 - 110, y: top, w: 220, h: 42 }, '#1a3a5aee', '#ffffff55');
    label(d, g, `第 ${this.round} 回合　${m}:${s < 10 ? '0' : ''}${s}`, W / 2, top + 21, { size: 20, color: this.clock < 20 ? '#ff8a8a' : '#ffffff' });
    // Player cards on the sides (two left, two right).
    const cw = Math.min(230, (W - COLS * this.T) / 2 - 26);
    this.ps.forEach((p, i) => {
      const left = i % 2 === 0, x = left ? 12 : W - cw - 12, y = 70 + Math.floor(i / 2) * 250;
      if (cw < 120) return;
      panel(d, { x, y, w: cw, h: 230 }, p.dead ? '#2a2a3acc' : '#1a3a5acc', p.you ? '#ffe066' : '#ffffff44');
      d.rect(x, y, cw, 6, p.color);
      spriteB(d, g, this.f[p.hero.id], x + cw / 2, y + 128, 110, { alpha: p.dead ? 0.35 : 1 });
      label(d, g, `${p.hero.name}${p.you ? '（你）' : ''}`, x + cw / 2, y + 146, { size: 18, color: '#ffffff' });
      label(d, g, `勝場 ${'★'.repeat(p.wins)}${'☆'.repeat(Math.max(0, 2 - p.wins))}`, x + cw / 2, y + 170, { size: 16, color: '#ffe066' });
      label(d, g, `水球 ${p.max}　水柱 ${p.range}　速度 ${p.speedLv}　針 ${p.needles}`, x + cw / 2, y + 196, { size: 13, color: '#bfe6ff' });
      label(d, g, p.dead ? '出局' : p.trapped > 0 ? '被困住！' : '活躍中', x + cw / 2, y + 216, { size: 13, color: p.dead ? '#ff8a8a' : p.trapped > 0 ? '#9fe3ff' : '#8dff9a' });
    });
    if (this.phase === 'intro') {
      label(d, g, this.timer > 0.8 ? `第 ${this.round} 回合　READY?` : 'GO!', W / 2, H / 2, { size: 60, color: '#ffe066', stroke: '#1a3a6a', strokeWidth: 10, weight: 900 });
      if (this.round === 1) label(d, g, '方向鍵移動　Space 放水球　被困住時按 Shift 用針　碰到被困住的對手就能戳破他！', W / 2, H / 2 + 60, { size: 18, color: '#ffffff', stroke: '#1a3a6a', strokeWidth: 5 });
    }
    if (this.phase === 'end') label(d, g, this.roundMsg, W / 2, H / 2, { size: 48, color: '#ffffff', stroke: '#1a3a6a', strokeWidth: 9, weight: 900 });
  }
}
