// Battle: player phase (select → move → act) and animated enemy phase.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawChar, session, ART, type Frames } from '../art.js';
import { label, panel, button, inside, clamp, lerp, type Rect } from '../ui.js';
import { Board, MAPS, COLS, ROWS, type Unit, type Node } from '../tactics.js';

const TILE = 64;
type Mode = 'idle' | 'moving' | 'menu' | 'target' | 'busy' | 'over';
interface Anim { u: Unit; path: { x: number; y: number }[]; t: number; done: () => void; }
interface Float { x: number; y: number; text: string; color: string; t: number; }

export class Battle extends Scene {
  private f!: Frames;
  private b!: Board;
  private mode: Mode = 'idle';
  private sel: Unit | null = null;
  private reach: Map<string, Node> | null = null;
  private origin = { x: 0, y: 0 };
  private phase: 'P' | 'E' = 'P';
  private turn = 1;
  private anim: Anim | null = null;
  private bump: { u: Unit; dx: number; dy: number; t: number } | null = null;
  private floats: Float[] = [];
  private shots: { x0: number; y0: number; x1: number; y1: number; t: number; color: string }[] = [];
  private bannerText = '';
  private bannerT = 0;
  private bannerCol = '#3b6fd8';
  private menuBtns: { r: Rect; text: string; fn: () => void; enabled: boolean }[] = [];
  private endBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private hover: { x: number; y: number } | null = null;
  private hint = '';
  private wasDown = false;
  private t = 0;
  private bx = 24;
  private by = 100;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    const rest = ['whale', 'penguin', 'glasses', 'tshirt', 'calico', 'whitecat', 'redcat', 'sailor'].filter((k) => !session.team.includes(k));
    session.enemy = rest.slice(0, 4);
    this.b = Board.create(MAPS[session.map] ?? MAPS[0], session.team, session.enemy);
    this.input.bind({ cancel: ['Escape'], end: ['KeyE'] });
    const sd = this.sound;
    sd.define('sel', { type: 'square', freq: 880, duration: 0.05, volume: 0.2 });
    sd.define('step', { type: 'triangle', freq: 300, duration: 0.04, volume: 0.15 });
    sd.define('hit', [{ type: 'noise', duration: 0.12, curve: 'exponential', volume: 0.5, filter: { type: 'lowpass', freq: 1500 } }, { type: 'square', freq: 200, freqEnd: 90, duration: 0.1, volume: 0.25 }]);
    sd.define('crit', { notes: 'C6 G6', step: 0.05, type: 'square', volume: 0.3 });
    sd.define('heal', { notes: 'E5 G5 C6', step: 0.07, type: 'triangle', volume: 0.3 });
    sd.define('ko', { type: 'square', freq: 400, freqEnd: 60, duration: 0.5, volume: 0.3 });
    sd.define('phase', { notes: 'C5 E5 G5', step: 0.08, type: 'square', volume: 0.3 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
    this.startPlayerPhase();
  }

  // ── helpers ──
  private wait(s: number): Promise<void> { return new Promise((r) => this.delayedCall(s, r)); }
  private tileXY(x: number, y: number): { x: number; y: number } { return { x: this.bx + x * TILE + TILE / 2, y: this.by + y * TILE + TILE / 2 }; }
  private pickTile(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.bx) / TILE), y = Math.floor((py - this.by) / TILE);
    return this.b.inBounds(x, y) ? { x, y } : null;
  }
  private float(x: number, y: number, text: string, color: string): void { const p = this.tileXY(x, y); this.floats.push({ x: p.x, y: p.y - 30, text, color, t: 1.2 }); }
  private banner(text: string, col: string): Promise<void> { this.bannerText = text; this.bannerT = 1.2; this.bannerCol = col; this.sound.play('phase'); return this.wait(1.1); }
  private moveAlong(u: Unit, path: { x: number; y: number }[]): Promise<void> {
    if (path.length <= 1) return Promise.resolve();
    return new Promise((done) => { this.anim = { u, path, t: 0, done }; });
  }

  private async startPlayerPhase(): Promise<void> {
    this.phase = 'P';
    this.mode = 'busy';
    for (const u of this.b.units) u.acted = false;
    await this.banner(`第 ${this.turn} 回合　我方行動`, '#3b6fd8');
    for (const h of this.b.phaseHeal('P')) { this.float(h.u.x, h.u.y, `+${h.amt}`, '#5cffb0'); this.sound.play('heal'); }
    this.mode = 'idle';
    this.hint = '點選我方角色開始行動';
  }

  private select(u: Unit): void {
    this.sel = u;
    this.reach = this.b.reachable(u);
    this.origin = { x: u.x, y: u.y };
    this.mode = 'moving';
    this.sound.play('sel');
    this.hint = '點藍色格子移動（點自己 = 原地）　右鍵/Esc 取消';
  }
  private deselect(): void { this.sel = null; this.reach = null; this.mode = 'idle'; this.menuBtns = []; this.hint = '點選我方角色開始行動'; }

  private targets(u: Unit, kind: 'atk' | 'heal'): Unit[] {
    if (kind === 'atk') return this.b.team(u.team === 'P' ? 'E' : 'P').filter((e) => this.b.inRange(u, e));
    if (!u.c.heal) return [];
    return this.b.team(u.team).filter((a) => a !== u && a.hp < a.c.hp && this.b.inRange(u, a));
  }

  private openMenu(): void {
    const u = this.sel!;
    this.mode = 'menu';
    const atk = this.targets(u, 'atk'), heal = this.targets(u, 'heal');
    const p = this.tileXY(u.x, u.y);
    const items: { text: string; fn: () => void; enabled: boolean }[] = [
      { text: '攻擊', fn: () => { this.mode = 'target'; this.targetKind = 'atk'; this.hint = '點選紅框內的敵人'; }, enabled: atk.length > 0 },
    ];
    if (u.c.heal) items.push({ text: '治療', fn: () => { this.mode = 'target'; this.targetKind = 'heal'; this.hint = '點選要治療的隊友'; }, enabled: heal.length > 0 });
    items.push({ text: '待命', fn: () => this.finishUnit(u), enabled: true });
    const mx = p.x + 50 + 130 > this.bx + COLS * TILE ? p.x - 180 : p.x + 50;
    this.menuBtns = items.map((it, i) => ({ ...it, r: { x: mx, y: clamp(p.y - 60 + i * 52, this.by, this.by + ROWS * TILE - 48), w: 130, h: 44 } }));
    this.hint = '選擇行動　右鍵/Esc 返回移動';
  }
  private targetKind: 'atk' | 'heal' = 'atk';

  private finishUnit(u: Unit): void {
    u.acted = true;
    this.deselect();
    if (this.checkEnd()) return;
    if (this.b.team('P').every((q) => q.acted)) void this.enemyPhase();
  }

  private async doCombat(a: Unit, d: Unit): Promise<void> {
    const pa = this.tileXY(a.x, a.y), pd = this.tileXY(d.x, d.y);
    const ranged = this.b.dist(a, d) > 1;
    if (ranged) { this.shots.push({ x0: pa.x, y0: pa.y, x1: pd.x, y1: pd.y, t: 0, color: a.c.color }); await this.wait(0.25); }
    else { this.bump = { u: a, dx: d.x - a.x, dy: d.y - a.y, t: 0 }; await this.wait(0.15); }
    const r = this.b.combat(a, d, Math.random);
    this.sound.play(r.crit ? 'crit' : 'hit');
    this.float(d.x, d.y, r.crit ? `爆擊！-${r.dmg}` : `-${r.dmg}`, r.crit ? '#ffb13d' : '#ff6b6b');
    this.game.fx.emit({ x: pd.x, y: pd.y, count: r.crit ? 30 : 16, speed: 180, life: 0.4, size: 5, colors: ['#ffffff', a.c.color], add: true });
    if (r.crit) this.camera.shake(5, 0.2);
    await this.wait(0.45);
    if (r.killed) { this.sound.play('ko'); this.float(d.x, d.y, '擊倒！', '#ffe066'); await this.wait(0.4); return; }
    if (r.counter) {
      if (this.b.dist(a, d) > 1) { this.shots.push({ x0: pd.x, y0: pd.y, x1: pa.x, y1: pa.y, t: 0, color: d.c.color }); await this.wait(0.25); }
      else { this.bump = { u: d, dx: a.x - d.x, dy: a.y - d.y, t: 0 }; await this.wait(0.15); }
      this.sound.play(r.counterCrit ? 'crit' : 'hit');
      this.float(a.x, a.y, `反擊 -${r.counter}`, '#ff6b6b');
      this.game.fx.emit({ x: pa.x, y: pa.y, count: 14, speed: 160, life: 0.4, size: 5, colors: ['#ffffff', d.c.color], add: true });
      await this.wait(0.45);
      if (r.died) { this.sound.play('ko'); this.float(a.x, a.y, '擊倒！', '#ffe066'); await this.wait(0.4); }
    }
  }

  private async doHeal(a: Unit, t: Unit): Promise<void> {
    const amt = this.b.heal(a, t);
    this.sound.play('heal');
    const p = this.tileXY(t.x, t.y);
    this.game.fx.emit({ x: p.x, y: p.y, count: 20, speed: 60, gravity: -80, life: 0.8, size: 4, colors: ['#5cffb0', '#ffffff'], add: true });
    this.float(t.x, t.y, `+${amt}`, '#5cffb0');
    await this.wait(0.6);
  }

  private async playerAct(target: Unit): Promise<void> {
    const u = this.sel!;
    this.mode = 'busy';
    this.menuBtns = [];
    if (this.targetKind === 'atk') await this.doCombat(u, target); else await this.doHeal(u, target);
    this.finishUnit(u);
  }

  private async enemyPhase(): Promise<void> {
    if (this.mode === 'over') return;
    this.phase = 'E';
    this.mode = 'busy';
    this.deselect();
    this.mode = 'busy';
    this.hint = '';
    await this.banner('敵方回合', '#b83a36');
    for (const h of this.b.phaseHeal('E')) { this.float(h.u.x, h.u.y, `+${h.amt}`, '#5cffb0'); }
    for (const e of this.b.team('E')) {
      if (e.hp <= 0) continue;
      const plan = this.b.aiPlan(e);
      this.sel = e; this.reach = this.b.reachable(e);
      await this.wait(0.35);
      this.reach = null;
      await this.moveAlong(e, plan.path);
      if (plan.target) { await this.wait(0.1); if (plan.type === 'atk') await this.doCombat(e, plan.target); else await this.doHeal(e, plan.target); }
      this.sel = null;
      if (this.checkEnd()) return;
      await this.wait(0.15);
    }
    this.turn++;
    void this.startPlayerPhase();
  }

  private checkEnd(): boolean {
    const w = this.b.winner();
    if (!w) return false;
    this.mode = 'over';
    session.result = { win: w === 'P', turns: this.turn, survivors: this.b.team(w).map((u) => u.c.key) };
    this.delayedCall(1.2, () => this.gotoGameOver(session.result));
    return true;
  }

  // ── input ──
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    for (const f of this.floats) { f.t -= dt; f.y -= 30 * dt; }
    this.floats = this.floats.filter((f) => f.t > 0);
    for (const s of this.shots) s.t += dt * 4;
    this.shots = this.shots.filter((s) => s.t < 1);
    if (this.bump) { this.bump.t += dt * 6; if (this.bump.t >= 1) this.bump = null; }
    if (this.anim) {
      const a = this.anim;
      a.t += dt * 7;
      const i = Math.floor(a.t);
      if (i >= a.path.length - 1) { const last = a.path[a.path.length - 1]; a.u.x = last.x; a.u.y = last.y; this.anim = null; a.done(); }
      else if (Math.floor(a.t - dt * 7) !== i) this.sound.play('step');
    }

    const p = this.input.pointer;
    this.hover = p ? this.pickTile(p.x, p.y) : null;
    const down = !!p?.isDown;
    const click = down && !this.wasDown;
    this.wasDown = down;
    const right = click && (p as unknown as { button?: number })?.button === 2;
    const cancel = this.input.keys.cancel.pressed || right;
    if (this.phase !== 'P' || this.mode === 'busy' || this.mode === 'over' || this.anim) return;
    if (this.input.keys.end.pressed) { this.endTurn(); return; }

    if (cancel) {
      if (this.mode === 'target') { this.openMenu(); return; }
      if (this.mode === 'menu' && this.sel) { this.sel.x = this.origin.x; this.sel.y = this.origin.y; this.select(this.sel); return; }
      this.deselect();
      return;
    }
    if (!click || !p) return;
    if (inside(p, this.endBtn)) { this.endTurn(); return; }
    if (this.mode === 'menu') {
      for (const m of this.menuBtns) if (m.enabled && inside(p, m.r)) { m.fn(); return; }
      return;
    }
    const tile = this.hover;
    if (!tile) return;
    const u = this.b.unitAt(tile.x, tile.y);
    if (this.mode === 'idle') {
      if (u && u.team === 'P' && !u.acted) this.select(u);
      return;
    }
    if (this.mode === 'moving' && this.sel) {
      if (u && u.team === 'P' && u !== this.sel && !u.acted) { this.select(u); return; }
      const n = this.reach?.get(`${tile.x},${tile.y}`);
      if (!n || n.blocked) return;
      const path = this.b.pathTo(this.reach!, tile.x, tile.y);
      const s = this.sel;
      this.mode = 'busy';
      void this.moveAlong(s, path).then(() => { this.reach = null; this.openMenu(); });
      return;
    }
    if (this.mode === 'target' && this.sel && u) {
      const list = this.targets(this.sel, this.targetKind);
      if (list.includes(u)) void this.playerAct(u);
    }
  }

  private endTurn(): void {
    if (this.phase !== 'P' || this.mode === 'busy') return;
    if (this.sel && (this.mode === 'menu' || this.mode === 'target')) this.sel.acted = true;
    else if (this.sel) { this.sel.x = this.origin.x; this.sel.y = this.origin.y; }
    void this.enemyPhase();
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game, f = this.f;
    cover(d, g, f.bg, W, H, 0.45);
    const boardW = COLS * TILE;
    this.bx = Math.max(16, Math.min(40, (W - boardW - 440) / 2));
    this.by = 100;
    panel(d, { x: this.bx - 6, y: this.by - 6, w: boardW + 12, h: ROWS * TILE + 12 }, '#2a1c10', '#c9a46a');
    // Terrain.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = this.b.map.rows[y][x];
      const px = this.bx + x * TILE, py = this.by + y * TILE;
      d.sprite(ch === 'W' ? f.water : f.grass, px, py, { w: TILE, h: TILE });
      if (ch === 'F') d.sprite(f.forest, px + 2, py + 2, { w: TILE - 4, h: TILE - 4 });
      if (ch === 'M') d.sprite(f.mountain, px + 2, py + 2, { w: TILE - 4, h: TILE - 4 });
      if (ch === 'H') d.sprite(f.house, px + 2, py + 6, { w: TILE - 4, h: TILE - 10 });
      d.rect(px, py, TILE, 1, '#000000', 0.15); d.rect(px, py, 1, TILE, '#000000', 0.15);
    }
    // Move / attack ranges.
    const showFor = this.sel && (this.mode === 'moving' || this.phase === 'E') ? this.sel : null;
    if (showFor && this.reach) {
      const atkTiles = new Set<string>();
      for (const n of this.reach.values()) {
        if (n.blocked) continue;
        d.rect(this.bx + n.x * TILE + 2, this.by + n.y * TILE + 2, TILE - 4, TILE - 4, showFor.team === 'P' ? '#3b8dff' : '#ff5a5a', 0.38);
        for (let yy = 0; yy < ROWS; yy++) for (let xx = 0; xx < COLS; xx++) if (this.b.inRange(showFor, { x: xx, y: yy }, n.x, n.y) && !this.reach.has(`${xx},${yy}`)) atkTiles.add(`${xx},${yy}`);
      }
      for (const k of atkTiles) { const [xx, yy] = k.split(',').map(Number); d.rect(this.bx + xx * TILE + 6, this.by + yy * TILE + 6, TILE - 12, TILE - 12, '#ff5a5a', 0.22); }
    }
    if (this.mode === 'target' && this.sel) {
      for (const t of this.targets(this.sel, this.targetKind)) {
        const px = this.bx + t.x * TILE, py = this.by + t.y * TILE;
        const c = this.targetKind === 'atk' ? '#ff3b3b' : '#5cffb0';
        d.rect(px, py, TILE, 4, c); d.rect(px, py + TILE - 4, TILE, 4, c); d.rect(px, py, 4, TILE, c); d.rect(px + TILE - 4, py, 4, TILE, c);
      }
    }
    if (this.hover && this.phase === 'P') d.rect(this.bx + this.hover.x * TILE, this.by + this.hover.y * TILE, TILE, TILE, '#ffffff', 0.15);
    // Units.
    const sorted = [...this.b.units].filter((u) => u.hp > 0).sort((a, c) => a.y - c.y);
    for (const u of sorted) {
      let ux = u.x, uy = u.y;
      if (this.anim && this.anim.u === u) {
        const a = this.anim, i = Math.min(Math.floor(a.t), a.path.length - 2), k = a.t - i;
        ux = lerp(a.path[i].x, a.path[i + 1].x, k); uy = lerp(a.path[i].y, a.path[i + 1].y, k);
      }
      if (this.bump && this.bump.u === u) { const k = Math.sin(this.bump.t * Math.PI) * 0.35; ux += this.bump.dx * k; uy += this.bump.dy * k; }
      const cx = this.bx + ux * TILE + TILE / 2, by2 = this.by + uy * TILE + TILE - 4;
      d.circle(cx, by2 - 2, 22, u.team === 'P' ? '#3b8dff' : '#ff4d4d', 0.55);
      const idle = u === this.sel ? Math.abs(Math.sin(this.t * 6)) * 4 : 0;
      drawChar(d, g, f[u.c.key], cx, by2 - idle, 76, { tint: u.acted && u.team === 'P' ? '#777777' : undefined, flipX: u.team === 'E' });
      // HP bar.
      const r = u.hp / u.c.hp;
      d.rect(cx - 24, by2 + 1, 48, 6, '#000000', 0.7);
      d.rect(cx - 23, by2 + 2, 46 * r, 4, r > 0.5 ? '#5cffb0' : r > 0.25 ? '#ffd23f' : '#ff5f3a');
    }
    for (const s of this.shots) d.circle(lerp(s.x0, s.x1, s.t), lerp(s.y0, s.y1, s.t) - Math.sin(s.t * Math.PI) * 30, 8, s.color);
    for (const fl of this.floats) label(d, g, fl.text, fl.x, fl.y, { size: 24, color: fl.color, stroke: '#000000', strokeWidth: 5, weight: 900 }, 0.5, 0.5, clamp(fl.t * 2, 0, 1));
    for (const m of this.menuBtns) button(d, g, m.r, m.text, this.input.pointer, { color: m.enabled ? '#3b6fd8' : '#4a4f5a', hover: m.enabled ? '#5a8cf0' : '#4a4f5a', size: 22 });
    this.drawPanel(d, W, H);
  }

  private drawPanel(d: Draw, W: number, H: number): void {
    const g = this.game;
    const px = this.bx + COLS * TILE + 24, pw = Math.max(320, W - px - 20);
    label(d, g, `${this.b.map.name}　第 ${this.turn} 回合　${this.phase === 'P' ? '我方行動' : '敵方行動'}`, this.bx, 50, { size: 30, color: '#ffe8b0', stroke: '#2a1c10', strokeWidth: 6 }, 0, 0.5);
    // Info card for the hovered or selected unit.
    const hov = this.hover ? this.b.unitAt(this.hover.x, this.hover.y) : undefined;
    const u = hov ?? this.sel;
    panel(d, { x: px, y: this.by, w: pw, h: 250 }, '#1c1428ee', '#c9a46a');
    if (u) {
      drawChar(d, g, this.f[u.c.key], px + 70, this.by + 230, 200, { flipX: u.team === 'E' });
      const tx = px + 150;
      label(d, g, `${u.c.name}｜${u.c.title}`, tx, this.by + 30, { size: 24, color: u.team === 'P' ? '#9fd2ff' : '#ffb0b0' }, 0, 0.5);
      label(d, g, `${u.c.role}　HP ${u.hp}/${u.c.hp}`, tx, this.by + 64, { size: 20, color: '#ffffff' }, 0, 0.5);
      label(d, g, `攻 ${u.c.atk}　防 ${u.c.def}　移 ${u.c.mov}　射程 ${u.c.rmin}-${u.c.rmax}`, tx, this.by + 96, { size: 18, color: '#ffe8b0' }, 0, 0.5);
      label(d, g, u.c.desc, tx, this.by + 150, { size: 16, color: '#dddddd', maxWidth: pw - 170 }, 0, 0.5);
      const tr = this.b.terrain(u.x, u.y);
      label(d, g, `地形：${tr.name}（防禦 +${tr.def}）`, tx, this.by + 212, { size: 16, color: '#b8e0a0' }, 0, 0.5);
    } else if (this.hover) {
      const tr = this.b.terrain(this.hover.x, this.hover.y);
      label(d, g, `${tr.name}　移動消耗 ${tr.cost >= 99 ? '不可通行' : tr.cost}　防禦 +${tr.def}${tr.heal ? `　每回合恢復 ${tr.heal}` : ''}`, px + 20, this.by + 40, { size: 18, color: '#ffffff', maxWidth: pw - 40 }, 0, 0.5);
    }
    // Forecast.
    let fc = '';
    if (this.mode === 'target' && this.sel && hov) {
      const a = this.sel;
      if (this.targetKind === 'atk' && hov.team !== a.team && this.b.inRange(a, hov)) {
        const dmg = this.b.calcDamage(a, hov).dmg, kill = dmg >= hov.hp;
        const counter = !kill && this.b.inRange(hov, a) ? this.b.calcDamage(hov, a).dmg : 0;
        fc = `預測：造成 ${dmg} 傷害${kill ? '（擊倒！）' : ''}${a.c.crit ? '、30% 爆擊' : ''}\n${counter ? `反擊：受到 ${counter} 傷害` : '對方無法反擊'}`;
      } else if (this.targetKind === 'heal' && hov.team === a.team) fc = `治療：恢復 ${Math.min(a.c.heal ?? 0, hov.c.hp - hov.hp)} HP`;
    }
    panel(d, { x: px, y: this.by + 266, w: pw, h: 130 }, '#1c1428ee', '#c9a46a');
    label(d, g, fc || this.hint, px + 16, this.by + 330, { size: 18, color: fc ? '#ffe066' : '#ffffff', maxWidth: pw - 32 }, 0, 0.5);
    // Team roster.
    const pt = this.b.team('P'), et = this.b.team('E');
    label(d, g, `我方 ${pt.length} 人　敵方 ${et.length} 人`, px + 16, this.by + 420, { size: 20, color: '#ffffff' }, 0, 0.5);
    this.endBtn = { x: px, y: this.by + 450, w: pw, h: 56 };
    button(d, g, this.endBtn, '結束回合（E）', this.input.pointer, { color: '#b8742a', hover: '#e0923a', size: 24 });
    label(d, g, '森林 +2、山岳 +3、民房 +1 防禦；民房每回合恢復 5 HP', px + 16, this.by + 540, { size: 15, color: '#cccccc', maxWidth: pw - 20 }, 0, 0.5);
    if (this.bannerT > 0) {
      const a = clamp(this.bannerT * 3, 0, 1);
      d.rect(0, H / 2 - 50, W, 100, this.bannerCol, 0.85 * a);
      label(d, g, this.bannerText, W / 2, H / 2, { size: 48, color: '#ffffff', stroke: '#000000', strokeWidth: 6, weight: 900 }, 0.5, 0.5, a);
    }
  }
}
