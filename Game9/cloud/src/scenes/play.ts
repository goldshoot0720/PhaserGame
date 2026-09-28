// The board: four players take turns rolling, moving, buying, building and paying tolls.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { preloadMenu, menuFrames, spriteB } from '../menu.js';
import {
  ART, BOARD_SIZE, REST_TILE, MAX_ROUNDS, MAX_LEVEL, GROUPS, CARDS, makeBoard, createPlayers, hop, passBonus, landCost, upgradeCost,
  rentOf, buy, upgrade, charge, payRent, taxFor, worth, ranking, aiWantsBuy, aiWantsUpgrade, cardCash, gridOf,
  type Tile, type Player, type Card,
} from '../rules.js';
import { session } from '../session.js';

type Phase = 'await' | 'rolling' | 'moving' | 'decide' | 'card' | 'end' | 'over';
interface Offer { kind: 'buy' | 'upgrade'; tile: Tile; cost: number; }
interface Float { x: number; y: number; text: string; color: string; t: number; }

const HOP = 0.17;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export class Play extends Scene {
  private f: Record<string, number> = {};
  private board: Tile[] = [];
  private ps: Player[] = [];
  private cur = 0;
  private round = 1;
  private phase: Phase = 'await';
  private timer = 0;
  private dice: [number, number] = [3, 4];
  private hops = 0;
  private dir = 1;
  private hopT = 0;
  private hopFrom = 0;
  private offer: Offer | null = null;
  private card: Card | null = null;
  private pot = 100;
  private log: string[] = [];
  private floats: Float[] = [];
  private t = 0;
  private click = new Clicker();
  private btns: { r: Rect; id: string }[] = [];
  private cell = 80;
  private x0 = 0;
  private y0 = 40;
  private hover = -1;

  override preload(load: Preload): void { preloadMenu(load); }

  override setup(): void {
    this.f = menuFrames(this.game);
    this.input.bind({ act: ['Space', 'Enter'], no: ['KeyN', 'Backspace'], quit: ['Escape'] });
    const sd = this.sound;
    sd.define('dice', { type: 'noise', duration: 0.25, volume: 0.25, filter: { type: 'bandpass', freq: 2400, freqEnd: 900, q: 2 } });
    sd.define('hop', { type: 'square', freq: 520, freqEnd: 780, duration: 0.05, volume: 0.12 });
    sd.define('coin', { notes: 'B5 E6', step: 0.06, type: 'square', volume: 0.22 });
    sd.define('pay', { notes: 'E5 C5', step: 0.07, type: 'triangle', volume: 0.3 });
    sd.define('build', { notes: 'C5 E5 G5 C6', step: 0.05, type: 'square', volume: 0.25 });
    sd.define('card', { notes: 'G5 A5 B5 D6', step: 0.05, type: 'triangle', volume: 0.25 });
    sd.define('bust', { notes: 'C4 B3 A#3 A3:3', step: 0.12, type: 'sawtooth', volume: 0.25 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
    this.board = makeBoard();
    this.ps = createPlayers(session.hero);
    this.say(`遊戲開始！你是 ${this.ps[0].name}，對手：${this.ps.slice(1).map((p) => p.name).join('、')}`);
    this.startTurn();
  }

  private get p(): Player { return this.ps[this.cur]; }
  private say(s: string): void { this.log.push(s); if (this.log.length > 40) this.log.shift(); }
  private pn(p: Player): string { return p.ai ? p.name : `你（${p.name}）`; }

  private center(i: number): { x: number; y: number } {
    const g = gridOf(i);
    return { x: this.x0 + g.gx * this.cell + this.cell / 2, y: this.y0 + g.gy * this.cell + this.cell / 2 };
  }
  private float(p: Player, text: string, color: string): void {
    const c = this.center(p.pos);
    this.floats.push({ x: c.x, y: c.y - 50, text, color, t: 1.6 });
  }

  // ── turn flow ──
  private startTurn(): void {
    const p = this.p;
    this.offer = null; this.card = null;
    if (p.skip > 0) {
      p.skip--;
      this.say(`${this.pn(p)}在警局反省，暫停一回合。`);
      this.endTurn();
      return;
    }
    this.phase = 'await';
    this.timer = p.ai ? 0.7 : 0;
  }

  private roll(): void {
    this.phase = 'rolling';
    this.timer = 0.75;
    this.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    this.sound.play('dice');
  }

  private startMove(steps: number): void {
    this.hops = Math.abs(steps); this.dir = steps < 0 ? -1 : 1;
    this.hopT = 0; this.hopFrom = this.p.pos;
    this.phase = 'moving';
  }

  private land(): void {
    const p = this.p, t = this.board[p.pos];
    switch (t.kind) {
      case 'prop': {
        if (t.owner < 0) {
          const cost = landCost(t, p.hero.perk);
          if (p.cash >= cost) { this.offer = { kind: 'buy', tile: t, cost }; this.phase = 'decide'; this.timer = 0.9; return; }
          this.say(`${this.pn(p)}來到 ${t.name}，可惜錢不夠買地。`);
        } else if (t.owner === p.id) {
          const cost = upgradeCost(t, p.hero.perk);
          if (t.level < MAX_LEVEL && p.cash >= cost) { this.offer = { kind: 'upgrade', tile: t, cost }; this.phase = 'decide'; this.timer = 0.9; return; }
          this.say(`${this.pn(p)}回到自己的 ${t.name}。`);
        } else {
          const owner = this.ps[t.owner];
          const r = payRent(p, owner, t, this.board);
          this.say(`${this.pn(p)}在 ${t.name} 付給 ${owner.name} 過路費 $${r.paid}${r.sold.length ? `（變賣：${r.sold.join('、')}）` : ''}`);
          this.float(p, `-$${r.paid}`, '#ff6b6b');
          this.sound.play('pay');
          if (r.bankrupt) this.bust(p);
        }
        break;
      }
      case 'chance': {
        this.card = CARDS[Math.floor(Math.random() * CARDS.length)];
        this.phase = 'card';
        this.timer = p.ai ? 1.8 : 3.5;
        this.sound.play('card');
        return;
      }
      case 'tax': {
        const r = charge(p, taxFor(p), this.board);
        this.pot += r.paid;
        this.say(`${this.pn(p)}繳了 ${t.name} $${r.paid}，錢進了幸運池。`);
        this.float(p, `-$${r.paid}`, '#ff6b6b');
        this.sound.play('pay');
        if (r.bankrupt) this.bust(p);
        break;
      }
      case 'pot': {
        const got = this.pot;
        p.cash += got; this.pot = 0;
        this.say(`${this.pn(p)}拿走幸運池裡的 $${got}！`);
        this.float(p, `+$${got}`, '#ffe066');
        this.sound.play('coin');
        break;
      }
      case 'jail': this.toJail(p); break;
      case 'rest': this.say(`${this.pn(p)}在露營區烤棉花糖。`); break;
      case 'start': this.say(`${this.pn(p)}剛好停在起點。`); break;
    }
    this.endTurn();
  }

  private toJail(p: Player): void {
    p.pos = REST_TILE; p.skip = 1;
    this.say(`${this.pn(p)}被帶到警局，下回合暫停！`);
    this.float(p, '暫停一回合', '#ffb0b0');
    this.sound.play('bust');
  }

  private decide(yes: boolean): void {
    const p = this.p, o = this.offer;
    this.offer = null;
    if (o && yes) {
      if (o.kind === 'buy' && buy(p, o.tile)) {
        this.say(`${this.pn(p)}以 $${o.cost} 買下 ${o.tile.name}！`);
        this.float(p, `-$${o.cost}`, '#ffd0a0');
        this.sound.play('coin');
      } else if (o.kind === 'upgrade' && upgrade(p, o.tile)) {
        this.say(`${this.pn(p)}在 ${o.tile.name} 蓋了${o.tile.level === MAX_LEVEL ? '飯店' : `第 ${o.tile.level} 棟房子`}！`);
        this.float(p, `-$${o.cost}`, '#ffd0a0');
        this.sound.play('build');
      }
    } else if (o) this.say(`${this.pn(p)}決定先不${o.kind === 'buy' ? '買' : '蓋'}。`);
    this.endTurn();
  }

  private applyCard(): void {
    const p = this.p, c = this.card;
    this.card = null;
    if (!c) { this.endTurn(); return; }
    this.say(`${this.pn(p)}抽到卡片：${c.text}`);
    switch (c.kind) {
      case 'cash': {
        const amt = cardCash(c.amount, p);
        if (amt >= 0) { p.cash += amt; this.float(p, `+$${amt}`, '#ffe066'); this.sound.play('coin'); }
        else { const r = charge(p, -amt, this.board); this.pot += r.paid; this.float(p, `-$${r.paid}`, '#ff6b6b'); if (r.bankrupt) this.bust(p); }
        break;
      }
      case 'move': this.startMove(c.steps); return;
      case 'toStart': {
        p.pos = 0; const b = passBonus(p); p.cash += b;
        this.float(p, `+$${b}`, '#ffe066'); this.sound.play('coin');
        break;
      }
      case 'collect': {
        let got = 0;
        for (const o of this.ps) if (o !== p && o.alive) { const r = charge(o, c.amount, this.board); got += r.paid; if (r.bankrupt) this.bust(o); }
        p.cash += got; this.float(p, `+$${got}`, '#ffe066'); this.sound.play('coin');
        break;
      }
      case 'repair': {
        const n = this.board.filter((t) => t.owner === p.id).reduce((s, t) => s + t.level, 0);
        if (n > 0) { const r = charge(p, n * c.per, this.board); this.pot += r.paid; this.float(p, `-$${r.paid}`, '#ff6b6b'); if (r.bankrupt) this.bust(p); }
        else this.say('還好你還沒蓋房子，不用付錢！');
        break;
      }
      case 'jail': this.toJail(p); break;
      case 'freeBuild': {
        const t = this.board.filter((x) => x.owner === p.id && x.level < MAX_LEVEL).sort((a, b) => b.price - a.price)[0];
        if (t) { t.level++; this.say(`${t.name} 升到 ${t.level} 級！`); this.sound.play('build'); }
        else { p.cash += 100; this.float(p, '+$100', '#ffe066'); this.say('沒有可以蓋的地，改領 $100。'); }
        break;
      }
    }
    this.endTurn();
  }

  private bust(p: Player): void {
    this.say(`${this.pn(p)}破產了！所有地產收回。`);
    this.float(p, '破產！', '#ff4a4a');
    this.sound.play('bust');
    this.camera.shake(6, 0.3);
  }

  private endTurn(): void { this.phase = 'end'; this.timer = this.p.ai ? 0.7 : 1.3; }

  private nextTurn(): void {
    const alive = this.ps.filter((p) => p.alive);
    if (!this.ps[0].alive) return this.finish('你破產了……下次再加油！');
    if (alive.length <= 1) return this.finish('對手全部破產，你獨佔整個小鎮！');
    do { this.cur = (this.cur + 1) % this.ps.length; if (this.cur === 0) this.round++; } while (!this.p.alive);
    if (this.round > MAX_ROUNDS) return this.finish(`${MAX_ROUNDS} 回合結束，以總資產決定名次。`);
    this.startTurn();
  }

  private finish(reason: string): void {
    this.phase = 'over'; this.timer = 2.4;
    this.round = Math.min(this.round, MAX_ROUNDS);
    session.reason = reason;
    session.results = ranking(this.ps, this.board).map((p) => ({
      id: p.hero.id, name: p.name, worth: worth(p, this.board), props: this.board.filter((t) => t.owner === p.id).length, alive: p.alive, you: !p.ai, color: p.color,
    }));
    this.say(reason);
  }

  /** The main action a Space press / big button triggers in this phase. */
  private primary(): string | null {
    if (this.p.ai) return null;
    return this.phase === 'await' ? 'roll' : this.phase === 'decide' ? 'yes' : this.phase === 'card' ? 'ok' : this.phase === 'end' ? 'end' : null;
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.timer -= dt;
    for (const fl of this.floats) { fl.t -= dt; fl.y -= 28 * dt; }
    this.floats = this.floats.filter((fl) => fl.t > 0);
    const k = this.input.keys, ptr = this.input.pointer;
    if (k.quit.pressed) { this.gotoTitle(); return; }
    let action: string | null = null;
    if (this.click.poll(ptr)) for (const b of this.btns) if (inside(ptr, b.r)) action = b.id;
    if (k.act.pressed) action = this.primary();
    if (k.no.pressed && this.phase === 'decide' && !this.p.ai) action = 'no';
    this.hover = -1;
    if (ptr) for (let i = 0; i < BOARD_SIZE; i++) {
      const c = this.center(i);
      if (Math.abs(ptr.x - c.x) < this.cell / 2 && Math.abs(ptr.y - c.y) < this.cell / 2) this.hover = i;
    }
    const p = this.p;
    switch (this.phase) {
      case 'await': if (p.ai ? this.timer <= 0 : action === 'roll') this.roll(); break;
      case 'rolling':
        if (this.timer <= 0) {
          const s = this.dice[0] + this.dice[1];
          this.say(`${this.pn(p)}擲出 ${this.dice[0]} + ${this.dice[1]} = ${s}`);
          this.startMove(s);
        }
        break;
      case 'moving':
        this.hopT += dt / HOP;
        if (this.hopT >= 1) {
          if (hop(p, this.dir)) { this.float(p, `起點 +$${passBonus(p)}`, '#ffe066'); this.sound.play('coin'); }
          else this.sound.play('hop');
          this.hops--; this.hopT = 0; this.hopFrom = p.pos;
          if (this.hops <= 0) this.land();
        }
        break;
      case 'decide':
        if (p.ai) { if (this.timer <= 0 && this.offer) this.decide(this.offer.kind === 'buy' ? aiWantsBuy(p, this.offer.tile, this.board) : aiWantsUpgrade(p, this.offer.tile)); }
        else if (action === 'yes') this.decide(true);
        else if (action === 'no') this.decide(false);
        break;
      case 'card': if (this.timer <= 0 || action === 'ok') this.applyCard(); break;
      case 'end': if (this.timer <= 0 || action === 'end') this.nextTurn(); break;
      case 'over': if (this.timer <= 0) this.gotoGameOver(); break;
    }
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game;
    const PW = 400;
    this.cell = Math.min(82, (H - 40) / 8, (W - PW - 44) / 8);
    const bw = this.cell * 8;
    this.x0 = Math.max(12, (W - (bw + 24 + PW)) / 2);
    this.y0 = (H - bw) / 2;
    const { x0, y0, cell } = this;
    d.rect(0, 0, W, H, '#123049');
    for (let y = 0; y < H; y += 60) for (let x = (y / 60) % 2 ? 0 : 60; x < W; x += 120) d.rect(x, y, 60, 60, '#15375a');
    // Board frame + centre.
    d.rect(x0 - 10, y0 - 10, bw + 20, bw + 20, '#0a1d2e');
    d.rect(x0 - 6, y0 - 6, bw + 12, bw + 12, '#ffd44a');
    d.rect(x0 + cell, y0 + cell, bw - 2 * cell, bw - 2 * cell, '#7fd0a8');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) d.rect(x0 + cell * (1 + i), y0 + cell * (1 + j), cell, cell, '#8adbb3');
    this.drawCentre(d);
    for (const t of this.board) this.drawTile(d, t);
    // Current-player highlight on their tile.
    const cc = this.center(this.p.pos);
    d.ring(cc.x, cc.y, cell * 0.55 + Math.sin(this.t * 6) * 3, 4, this.p.color, 0.8);
    // Tokens (others first, current on top).
    const order = this.ps.map((p, i) => ({ p, i })).filter((o) => o.p.alive).sort((a, b) => Number(a.i === this.cur) - Number(b.i === this.cur));
    for (const { p, i } of order) this.drawToken(d, p, i);
    for (const fl of this.floats) label(d, g, fl.text, fl.x, fl.y, { size: 24, color: fl.color, stroke: '#0a1d2e', strokeWidth: 5, weight: 900 }, 0.5, 0.5, Math.min(1, fl.t * 2));
    this.drawPanel(d, x0 + bw + 24, PW);
    if (this.card) this.drawCard(d);
  }

  private drawTile(d: Draw, t: Tile): void {
    const g = this.game, { cell } = this, c = this.center(t.i), x = c.x - cell / 2 + 2, y = c.y - cell / 2 + 2, s = cell - 4;
    const hov = this.hover === t.i;
    const bg: Record<string, string> = { prop: '#fff7ea', chance: '#fff0a8', tax: '#dfe6f0', start: '#ffd6e8', rest: '#d6f5cf', pot: '#ffe9a8', jail: '#ffc9c9' };
    d.rect(x, y, s, s, hov ? '#ffffff' : bg[t.kind]);
    const fs = Math.max(11, cell * 0.17);
    if (t.kind === 'prop') {
      const gc = GROUPS[t.group].color;
      d.rect(x, y, s, s * 0.2, gc);
      label(d, g, t.name, c.x, y + s * 0.33, { size: fs, color: '#3a2a20' });
      if (t.owner >= 0) {
        const o = this.ps[t.owner];
        d.rect(x, y + s - 8, s, 8, o.color);
        if (t.level === MAX_LEVEL) spriteB(d, g, this.f.hotel, c.x, y + s - 8, s * 0.5);
        else for (let k = 0; k < t.level; k++) spriteB(d, g, this.f.house, c.x + (k - (t.level - 1) / 2) * s * 0.26, y + s - 8, s * 0.4);
        if (t.level === 0) label(d, g, `過路 $${rentOf(t, this.board)}`, c.x, y + s * 0.62, { size: fs * 0.8, color: '#7a4a20' });
      } else label(d, g, `$${t.price}`, c.x, y + s * 0.62, { size: fs * 0.9, color: '#2a7a4a' });
    } else if (t.kind === 'chance') {
      label(d, g, '？', c.x, c.y - 4, { size: cell * 0.46, color: '#ff8a00', stroke: '#ffffff', strokeWidth: 4, weight: 900 });
      label(d, g, t.name, c.x, y + s - 12, { size: fs * 0.85, color: '#7a4a00' });
    } else if (t.kind === 'tax') {
      label(d, g, '稅', c.x, c.y - 6, { size: cell * 0.36, color: '#4a5a70', weight: 900 });
      label(d, g, `${t.name} $150`, c.x, y + s - 12, { size: fs * 0.8, color: '#4a5a70' });
    } else {
      const title: Record<string, [string, string]> = { start: ['起點', '經過 +$200'], rest: ['露營區', '警局在這裡'], pot: ['幸運池', `$${this.pot}`], jail: ['前往警局', '暫停一回合'] };
      const [a, b] = title[t.kind];
      label(d, g, a, c.x, c.y - 10, { size: fs * 1.15, color: '#3a2a20', weight: 900 });
      label(d, g, b, c.x, c.y + 16, { size: fs * 0.85, color: t.kind === 'pot' ? '#b06a00' : '#6a4a3a' });
      if (t.kind === 'start') label(d, g, '→', c.x + s * 0.3, y + 12, { size: fs * 1.2, color: '#e0567f', weight: 900 });
    }
  }

  private drawToken(d: Draw, p: Player, i: number): void {
    const g = this.game;
    let c = this.center(p.pos), lift = 0;
    if (i === this.cur && this.phase === 'moving') {
      const a = this.center(this.hopFrom), b = this.center((this.hopFrom + this.dir + BOARD_SIZE) % BOARD_SIZE), k = Math.min(1, this.hopT);
      c = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      lift = Math.sin(Math.PI * k) * 26;
    }
    const ox = (i - 1.5) * this.cell * 0.2, oy = this.cell * 0.44;
    const bx = c.x + ox, by = c.y + oy;
    d.fill(Array.from({ length: 12 }, (_, k) => ({ x: bx + Math.cos((k / 12) * Math.PI * 2) * 10, y: by + Math.sin((k / 12) * Math.PI * 2) * 4 })), '#000000', 0.3);
    d.ring(bx, by, 10, 3, p.color);
    const bob = i === this.cur && this.phase === 'await' ? Math.abs(Math.sin(this.t * 6)) * 5 : 0;
    spriteB(d, g, this.f[p.hero.id], bx, by - lift - bob, this.cell * 0.6, { flipX: gridOf(p.pos).gy === 7 });
  }

  private drawDie(d: Draw, x: number, y: number, s: number, n: number): void {
    d.rect(x - s / 2 + 3, y - s / 2 + 4, s, s, '#000000', 0.3);
    d.rect(x - s / 2, y - s / 2, s, s, '#ffffff');
    d.rect(x - s / 2, y - s / 2, s, 5, '#e8eef5');
    for (const [px, py] of PIPS[n]) d.circle(x + px * s * 0.27, y + py * s * 0.27, s * 0.09, n === 1 ? '#e0304a' : '#2a2a3a');
  }

  private drawCentre(d: Draw): void {
    const g = this.game, { x0, y0, cell } = this, cx = x0 + cell * 4, inner = cell * 6;
    const sz = g.assets.frameSize(this.f.logo), lw = inner * 0.86, lh = (sz.h / sz.w) * lw;
    d.sprite(this.f.logo, cx - lw / 2, y0 + cell + 10, { w: lw, h: lh });
    label(d, g, `第 ${this.round} / ${MAX_ROUNDS} 回合`, cx, y0 + cell + lh + 26, { size: 22, color: '#0d3a2a', weight: 900 });
    // Dice.
    const rolling = this.phase === 'rolling';
    const dy = y0 + cell + lh + 88 + (rolling ? -Math.abs(Math.sin(this.t * 20)) * 10 : 0);
    const a = rolling ? 1 + (Math.floor(this.t * 17) % 6) : this.dice[0], b = rolling ? 1 + (Math.floor(this.t * 13 + 3) % 6) : this.dice[1];
    this.drawDie(d, cx - 42, dy, 64, a);
    this.drawDie(d, cx + 42, dy, 64, b);
    // Hover info or latest message.
    const boxY = dy + 52, boxW = inner - 40;
    panel(d, { x: cx - boxW / 2, y: boxY, w: boxW, h: y0 + cell * 7 - boxY - 14 }, '#0d2438dd', '#ffffff66');
    const ht = this.hover >= 0 ? this.board[this.hover] : null;
    if (ht && ht.kind === 'prop') {
      label(d, g, `${GROUPS[ht.group].name}・${ht.name}`, cx, boxY + 22, { size: 20, color: GROUPS[ht.group].color, weight: 900 });
      label(d, g, `地價 $${ht.price}　蓋房 $${upgradeCost(ht)}　${ht.owner >= 0 ? `地主：${this.ps[ht.owner].name}` : '尚未出售'}`, cx, boxY + 50, { size: 15, color: '#ffffff' });
      const base = Math.round(ht.price * 0.1 / 5) * 5;
      label(d, g, `過路費：空地 $${base}（同區全拿加倍）・1棟 $${base * 4}・2棟 $${base * 9}・飯店 $${base * 16}`, cx, boxY + 78, { size: 13, color: '#ffe8a0', maxWidth: boxW - 20 });
    } else {
      const lines = this.log.slice(-3);
      lines.forEach((s, i) => label(d, g, s, cx, boxY + 24 + i * 30, { size: i === lines.length - 1 ? 16 : 14, color: i === lines.length - 1 ? '#ffffff' : '#9fc3dd', maxWidth: boxW - 20 }, 0.5, 0.5));
    }
  }

  private drawPanel(d: Draw, px: number, pw: number): void {
    const g = this.game, H = this.height, ptr = this.input.pointer;
    this.btns = [];
    let y = this.y0;
    this.ps.forEach((p, i) => {
      const act = i === this.cur, h = 86;
      panel(d, { x: px, y, w: pw, h }, act ? '#2f6b8fee' : '#0d2438dd', act ? '#ffe066' : '#ffffff33');
      d.rect(px, y, 8, h, p.color);
      d.rect(px + 16, y + 8, 70, 70, '#ffffff', 0.12);
      spriteB(d, g, this.f[p.hero.id], px + 51, y + 80, 76, { alpha: p.alive ? 1 : 0.35 });
      label(d, g, `${p.ai ? '電腦' : '你'}・${p.name}${act ? '　◀ 行動中' : ''}`, px + 96, y + 18, { size: 18, color: act ? '#ffe066' : '#ffffff' }, 0, 0.5);
      if (!p.alive) label(d, g, '已破產', px + 96, y + 48, { size: 20, color: '#ff6b6b' }, 0, 0.5);
      else {
        label(d, g, `現金 $${p.cash}　總資產 $${worth(p, this.board)}`, px + 96, y + 44, { size: 16, color: '#ffe8a0' }, 0, 0.5);
        label(d, g, `${p.hero.perkText}${p.skip ? '　（暫停中）' : ''}`, px + 96, y + 68, { size: 13, color: '#9fd8ff' }, 0, 0.5);
        const owned = this.board.filter((t) => t.owner === p.id);
        owned.forEach((t, k) => d.rect(px + pw - 14 - (owned.length - k) * 9, y + 10, 7, 12, GROUPS[t.group].color));
      }
      y += h + 8;
    });
    // Actions.
    const ay = y + 6, p = this.p;
    panel(d, { x: px, y: ay, w: pw, h: H - ay - this.y0 * 0.5 - 6 }, '#0d2438ee', '#ffffff44');
    const bx = px + 16, bw = pw - 32;
    const add = (id: string, r: Rect, text: string, color?: string, hover?: string): void => { this.btns.push({ r, id }); button(d, g, r, text, ptr, { color, hover, size: 22 }); };
    if (p.ai) {
      label(d, g, this.phase === 'over' ? '遊戲結束！' : `${p.name} 思考中${'.'.repeat(1 + (Math.floor(this.t * 3) % 3))}`, px + pw / 2, ay + 40, { size: 22, color: '#ffffff' });
      if (this.offer) label(d, g, this.offer.kind === 'buy' ? `要不要買 ${this.offer.tile.name}？` : `要不要在 ${this.offer.tile.name} 蓋房？`, px + pw / 2, ay + 76, { size: 16, color: '#ffe8a0' });
    } else if (this.phase === 'await') {
      add('roll', { x: bx, y: ay + 16, w: bw, h: 64 }, '擲骰子（Space）', '#e0567f', '#ff7aa0');
    } else if (this.phase === 'decide' && this.offer) {
      const o = this.offer, t = o.tile;
      label(d, g, o.kind === 'buy' ? `買下 ${t.name}？花費 $${o.cost}` : `在 ${t.name} ${t.level === MAX_LEVEL - 1 ? '蓋飯店' : '蓋房子'}？花費 $${o.cost}`, px + pw / 2, ay + 24, { size: 18, color: '#ffe066' });
      const after = o.kind === 'buy' ? Math.round(t.price * 0.1 / 5) * 5 : Math.round(t.price * 0.1 / 5) * 5 * [1, 4, 9, 16][t.level + 1];
      label(d, g, `之後過路費 $${after}`, px + pw / 2, ay + 50, { size: 14, color: '#bfe6ff' });
      add('yes', { x: bx, y: ay + 66, w: bw / 2 - 6, h: 56 }, o.kind === 'buy' ? '買！' : '蓋！', '#2aa36a', '#3ed688');
      add('no', { x: bx + bw / 2 + 6, y: ay + 66, w: bw / 2 - 6, h: 56 }, '不要（N）');
    } else if (this.phase === 'card') {
      add('ok', { x: bx, y: ay + 16, w: bw, h: 64 }, '好的（Space）', '#e0a030', '#ffc050');
    } else if (this.phase === 'end') {
      add('end', { x: bx, y: ay + 16, w: bw, h: 64 }, '結束回合（Space）');
    } else label(d, g, this.phase === 'over' ? '遊戲結束！' : '移動中…', px + pw / 2, ay + 40, { size: 22, color: '#ffffff' });
    label(d, g, `幸運池 $${this.pot}　滑鼠移到格子上查看資訊　Esc 離開`, px + pw / 2, ay + 146, { size: 13, color: '#9fc3dd' });
  }

  private drawCard(d: Draw): void {
    const g = this.game, c = this.card!, { x0, y0, cell } = this, cx = x0 + cell * 4, cy = y0 + cell * 4;
    const pop = Math.min(1, (this.p.ai ? 1.8 : 3.5) - this.timer) * 6;
    const s = Math.min(1, pop);
    const w = 380 * s, h = 230 * s;
    d.rect(cx - w / 2 + 6, cy - h / 2 + 8, w, h, '#000000', 0.35);
    d.rect(cx - w / 2, cy - h / 2, w, h, '#ff9a3c');
    d.rect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16, '#fff6e0');
    if (s < 1) return;
    label(d, g, '★ 機會卡 ★', cx, cy - 72, { size: 28, color: '#e0567f', weight: 900 });
    label(d, g, `${this.p.name} 抽到：`, cx, cy - 30, { size: 17, color: '#6a4a3a' });
    label(d, g, c.text, cx, cy + 20, { size: 22, color: '#3a2a20', maxWidth: 330, weight: 900 });
    if (c.kind === 'cash' && cardCash(c.amount, this.p) !== c.amount) label(d, g, '（角色能力發動！）', cx, cy + 74, { size: 15, color: '#2a7a4a' });
  }
}

