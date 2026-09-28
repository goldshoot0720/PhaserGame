// The duel table: click cards to play, click a ready minion then a target to attack.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, fit, ART, session } from '../art.js';
import { label, panel, button, inside, clamp, lerp, type Rect } from '../ui.js';
import { Battle, chooseAction, applyAction, heroId, RULES, type Ev, type Minion } from '../battle.js';
import { getCard, type Card } from '../cards.js';

const YOU = 0, CPU = 1;
const CW = 108, CH = 144;

export class Duel extends Scene {
  private f: Record<string, number> = {};
  private b!: Battle;
  private sel: string | null = null;
  private rects = new Map<string, Rect>();
  private floats: { x: number; y: number; text: string; color: string; t: number }[] = [];
  private lunge: { uid: string; tx: number; ty: number; t: number } | null = null;
  private cpuT = 0;
  private busy = 0;
  private endBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private handRects: { uid: string; r: Rect }[] = [];
  private hover: string | null = null;
  private banner = '';
  private bannerT = 0;
  private wasDown = false;
  private t = 0;
  private endT = -1;

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.b = new Battle(Math.random, session.first);
    session.first = 1 - session.first;
    const sd = this.sound;
    sd.define('card', { type: 'noise', duration: 0.08, volume: 0.25, filter: { type: 'bandpass', freq: 2500, q: 2 } });
    sd.define('play', { notes: 'C5 G5', step: 0.05, type: 'triangle', volume: 0.3 });
    sd.define('hit', [{ type: 'noise', duration: 0.12, curve: 'exponential', volume: 0.5, filter: { type: 'lowpass', freq: 1400 } }, { type: 'square', freq: 220, freqEnd: 90, duration: 0.1, volume: 0.25 }]);
    sd.define('heal', { notes: 'E5 G5 C6', step: 0.06, type: 'triangle', volume: 0.3 });
    sd.define('die', { type: 'square', freq: 500, freqEnd: 80, duration: 0.35, volume: 0.25 });
    sd.define('turn', { notes: 'G4 C5 E5', step: 0.08, type: 'square', volume: 0.3 });
    if (!session.musicOn) { sd.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
    this.input.bind({ end: ['Space', 'KeyE'], cancel: ['Escape'] });
    this.replay(this.b.start());
  }

  private pos(id: string): { x: number; y: number } {
    const r = this.rects.get(id);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: this.width / 2, y: this.height / 2 };
  }
  private float(id: string, text: string, color: string): void { const p = this.pos(id); this.floats.push({ x: p.x, y: p.y, text, color, t: 1.2 }); }

  /** Turn rule events into feedback. */
  private replay(ev: Ev[]): void {
    for (const e of ev) {
      switch (e.type) {
        case 'turnStart': {
          const mine = e.player === YOU;
          this.banner = mine ? '你的回合' : '對手回合';
          this.bannerT = 1.1;
          this.sound.play('turn');
          if (!mine) this.cpuT = 1.4;
          break;
        }
        case 'play': this.sound.play('play'); break;
        case 'draw': if (e.player === YOU) this.sound.play('card'); break;
        case 'attack': { const t = this.pos(e.target as string); this.lunge = { uid: e.attacker as string, tx: t.x, ty: t.y, t: 0 }; break; }
        case 'damage': { this.float(e.target as string, `-${e.amount}`, '#ff6b6b'); this.sound.play('hit'); const p = this.pos(e.target as string); this.game.fx.emit({ x: p.x, y: p.y, count: 14, speed: 160, life: 0.35, size: 5, colors: ['#ffffff', '#ffb347'], add: true }); break; }
        case 'heal': if ((e.amount as number) > 0) { this.float(e.target as string, `+${e.amount}`, '#5cffb0'); this.sound.play('heal'); } break;
        case 'buff': this.float(e.target as string, '攻擊 +1', '#ffe066'); break;
        case 'ability': { const c = getCard(e.cardId as string); this.float(e.source as string, c.text.replace(/^.*：/, ''), '#ffe8a0'); break; }
        case 'death': { const p = this.pos(e.target as string); this.game.fx.emit({ x: p.x, y: p.y, count: 30, speed: 200, life: 0.6, size: 6, colors: ['#ffffff', '#c9a46a', '#6a4a8a'], add: true }); this.sound.play('die'); break; }
        case 'fatigue': this.float(heroId(e.player as number), `牌庫耗盡 -${e.amount}`, '#ff6b6b'); break;
        case 'burn': if (e.player === YOU) this.float(heroId(YOU), '手牌滿了，卡被燒掉', '#ff9a3c'); break;
        case 'gameOver': this.endT = 0; break;
      }
    }
    this.busy = 0.35;
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    for (const f of this.floats) { f.t -= dt; f.y -= 34 * dt; }
    this.floats = this.floats.filter((f) => f.t > 0);
    if (this.lunge) { this.lunge.t += dt * 3; if (this.lunge.t >= 1) this.lunge = null; }
    if (this.busy > 0) this.busy -= dt;
    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 2) { session.result = { win: this.b.winner === 'draw' ? null : this.b.winner === YOU, turns: this.b.turn }; this.gotoGameOver(session.result); }
      return;
    }
    // CPU plays one action at a time.
    if (this.b.current === CPU) {
      this.cpuT -= dt;
      if (this.cpuT <= 0 && this.busy <= 0) {
        const a = chooseAction(this.b, CPU);
        this.replay(applyAction(this.b, CPU, a));
        this.cpuT = a.type === 'end' ? 0 : 0.9;
      }
      return;
    }
    const p = this.input.pointer;
    const down = !!p?.isDown, click = down && !this.wasDown;
    this.wasDown = down;
    this.hover = null;
    for (const h of this.handRects) if (inside(p, h.r)) this.hover = h.uid;
    if (this.input.keys.cancel.pressed) this.sel = null;
    if (this.input.keys.end.pressed) this.endTurn();
    if (!click || !p || this.busy > 0) return;
    if (inside(p, this.endBtn)) { this.endTurn(); return; }
    // Hand.
    for (const h of [...this.handRects].reverse()) if (inside(p, h.r)) {
      if (this.b.canPlay(YOU, h.uid)) { this.replay(this.b.playCard(YOU, h.uid)); this.sel = null; }
      else {
        const own = this.b.players[YOU];
        const card = own.hand.find((c) => c.uid === h.uid);
        const message = own.board.length >= RULES.BOARD_MAX ? '場上已滿' : card ? `需要 ${getCard(card.cardId).cost} 法力／目前 ${own.mana}` : '無法出牌';
        this.float(heroId(YOU), message, '#9fd2ff');
      }
      return;
    }
    // Board / heroes.
    let hit: string | null = null;
    for (const [id, r] of this.rects) if (inside(p, r)) hit = id;
    if (!hit) { this.sel = null; return; }
    if (this.sel && this.b.validTargets(YOU, this.sel).includes(hit)) { this.replay(this.b.attack(YOU, this.sel, hit)); this.sel = null; return; }
    if (this.b.canAttack(YOU, hit)) { this.sel = hit; this.sound.play('card'); return; }
    if (this.sel && hit === heroId(CPU) && this.b.players[CPU].board.length) this.float(hit, '請先清除對手場上的卡牌', '#ffe066');
    else if (this.sel && this.b.players[CPU].board.some((m) => m.uid === hit) && this.b.players[CPU].board.some((m) => m.taunt)) this.float(hit, '請先攻擊嘲諷角色', '#ffe066');
    this.sel = null;
  }

  private endTurn(): void {
    if (this.b.current !== YOU || this.busy > 0 || this.b.isOver) return;
    this.sel = null;
    this.replay(this.b.endTurn(YOU));
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game, b = this.b;
    cover(d, g, this.f.table, W, H, 0.2);
    this.rects.clear();
    const cx = W / 2;
    // Heroes.
    this.drawHero(d, CPU, cx, 78);
    this.drawHero(d, YOU, cx - 380, H - 92);
    // Boards.
    const drawRow = (p: number, y: number): void => {
      const board = b.players[p].board;
      const tot = board.length * (CW + 14) - 14;
      board.forEach((m, i) => this.drawMinion(d, m, cx - tot / 2 + i * (CW + 14), y, p));
    };
    drawRow(CPU, 176);
    drawRow(YOU, 350);
    d.rect(cx - 380, 338, 760, 2, '#ffe8a0', 0.25);
    // Enemy hand (backs) and decks.
    const eh = b.players[CPU].hand.length;
    for (let i = 0; i < eh; i++) d.sprite(this.f.back, W - 90 - i * 22, 12, { w: 50, h: 68 });
    label(d, g, `牌庫 ${b.players[CPU].deck.length}`, W - 60, 96, { size: 14, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
    label(d, g, `牌庫 ${b.players[YOU].deck.length}`, W - 60, H - 20, { size: 14, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
    // My hand.
    this.handRects = [];
    const hand = b.players[YOU].hand;
    label(d, g, `目前法力 ${b.players[YOU].mana}/${b.players[YOU].maxMana}　｜　卡牌左上藍色數字是所需法力`, cx, H - CH - 26, { size: 18, color: '#9fd2ff', stroke: '#000000', strokeWidth: 4, weight: 900 });
    const hw = Math.min(CW + 8, (W - 560) / Math.max(1, hand.length));
    const hx = cx - 160 - ((hand.length - 1) * hw) / 2 + 160;
    hand.forEach((hc, i) => {
      const x = hx + i * hw - CW / 2 + 60, y = H - CH - 12 + (this.hover === hc.uid ? -40 : 0);
      const r: Rect = { x, y, w: CW, h: CH };
      this.handRects.push({ uid: hc.uid, r });
      this.drawCard(d, getCard(hc.cardId), x, y, 1, b.canPlay(YOU, hc.uid));
    });
    // End turn.
    this.endBtn = { x: W - 190, y: H / 2 - 30, w: 160, h: 56 };
    const mine = b.current === YOU;
    const noMoves = mine && !b.hasAnyAction(YOU);
    button(d, g, this.endBtn, mine ? '結束回合' : '對手思考中…', this.input.pointer, { color: !mine ? '#555a70' : noMoves ? (Math.floor(this.t * 3) % 2 ? '#2f9e5a' : '#3fbf70') : '#b8742a', hover: mine ? '#e0923a' : '#555a70', size: 22 });
    // Hover preview.
    if (this.hover) { const hc = hand.find((h) => h.uid === this.hover); if (hc) this.drawCard(d, getCard(hc.cardId), W - 230, 110, 1.6, b.canPlay(YOU, hc.uid)); }
    for (const fl of this.floats) label(d, g, fl.text, fl.x, fl.y, { size: 22, color: fl.color, stroke: '#000000', strokeWidth: 5, weight: 900 }, 0.5, 0.5, clamp(fl.t * 2, 0, 1));
    if (this.sel) label(d, g, '選擇攻擊目標（Esc 取消）', cx, 334, { size: 16, color: '#ffe066', stroke: '#000000', strokeWidth: 4 });
    if (this.bannerT > 0) {
      const a = clamp(this.bannerT * 3, 0, 1);
      d.rect(0, H / 2 - 40, W, 80, '#1a2a3a', 0.8 * a);
      label(d, g, this.banner, cx, H / 2, { size: 44, color: '#ffe8a0', stroke: '#000000', strokeWidth: 6, weight: 900 }, 0.5, 0.5, a);
    }
  }

  private drawHero(d: Draw, p: number, x: number, y: number): void {
    const g = this.game, st = this.b.players[p], id = heroId(p);
    const r: Rect = { x: x - 70, y: y - 60, w: 140, h: 120 };
    this.rects.set(id, r);
    const targetable = this.sel && this.b.validTargets(YOU, this.sel).includes(id);
    panel(d, r, '#2a1c10ee', targetable ? '#ff5f5f' : '#c9a46a');
    label(d, g, p === YOU ? '你的生命' : '對手生命', x, y - 28, { size: 22, color: '#ffe8a0' });
    d.circle(x, y + 18, 30, '#b82e2e'); d.ring(x, y + 18, 30, 3, '#ffe8a0');
    label(d, g, String(Math.max(0, st.hp)), x, y + 18, { size: 26, color: '#ffffff', weight: 900 });
    // Mana crystals.
    const mx = p === YOU ? x + 90 : x - 70 - 10 * 22 - 20, my = p === YOU ? y + 40 : y - 50;
    for (let i = 0; i < RULES.MAX_MANA; i++) d.fill([{ x: mx + i * 22, y: my - 9 }, { x: mx + i * 22 + 8, y: my }, { x: mx + i * 22, y: my + 9 }, { x: mx + i * 22 - 8, y: my }], i < st.mana ? '#39a8ff' : i < st.maxMana ? '#1d4a7a' : '#ffffff22');
    label(d, g, `法力 ${st.mana}/${st.maxMana}`, mx + 10 * 22 + 8, my, { size: 16, color: '#9fd2ff', stroke: '#000000', strokeWidth: 3 }, 0, 0.5);
  }

  private drawMinion(d: Draw, m: Minion, x: number, y: number, owner: number): void {
    const g = this.game, c = getCard(m.cardId);
    let ox = 0, oy = 0;
    if (this.lunge && this.lunge.uid === m.uid) { const k = Math.sin(this.lunge.t * Math.PI) * 0.6; ox = (this.lunge.tx - (x + CW / 2)) * k; oy = (this.lunge.ty - (y + CH / 2)) * k; }
    const r: Rect = { x: x + ox, y: y + oy, w: CW, h: CH };
    this.rects.set(m.uid, { x, y, w: CW, h: CH });
    const ready = owner === YOU && this.b.current === YOU && this.b.canAttack(YOU, m.uid);
    const targetable = !!this.sel && this.b.validTargets(YOU, this.sel).includes(m.uid);
    const border = this.sel === m.uid ? '#ffe066' : targetable ? '#ff5f5f' : ready ? '#5cffb0' : m.taunt ? '#c9c9c9' : '#6a4a2a';
    d.rect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, border, m.taunt || ready || targetable || this.sel === m.uid ? 1 : 0.6);
    d.rect(r.x, r.y, r.w, r.h, '#3a2a1a');
    d.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 36, c.color, 0.35);
    fit(d, g, this.f[c.id], r.x + r.w / 2, r.y + r.h - 30, r.h - 40);
    if (m.taunt) label(d, g, '嘲諷', r.x + r.w / 2, r.y + 14, { size: 13, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
    if (m.sleeping && owner === YOU) label(d, g, 'Zzz', r.x + r.w - 18, r.y + 16, { size: 14, color: '#9fd2ff', stroke: '#000000', strokeWidth: 3 });
    this.stat(d, r.x + 14, r.y + r.h - 14, m.atk, '#e0a020', m.atk > c.atk ? '#5cffb0' : '#ffffff');
    this.stat(d, r.x + r.w - 14, r.y + r.h - 14, m.hp, '#c03030', m.hp < m.maxHp ? '#ff9a9a' : '#ffffff');
  }

  private stat(d: Draw, x: number, y: number, v: number, bg: string, fg: string): void {
    d.circle(x, y, 15, bg); d.ring(x, y, 15, 2, '#000000');
    label(d, this.game, String(v), x, y, { size: 17, color: fg, weight: 900, stroke: '#000000', strokeWidth: 3 });
  }

  private drawCard(d: Draw, c: Card, x: number, y: number, s: number, playable: boolean): void {
    const g = this.game, w = CW * s, h = CH * s;
    d.rect(x - 3, y - 3, w + 6, h + 6, playable ? '#5cffb0' : '#6a4a2a');
    d.rect(x, y, w, h, '#f4e4c0');
    d.rect(x + 4 * s, y + 4 * s, w - 8 * s, h * 0.5, c.color, 0.45);
    fit(d, g, this.f[c.id], x + w / 2, y + h * 0.52, h * 0.48);
    d.rect(x, y + h * 0.53, w, 18 * s, '#6a4a2a');
    label(d, g, c.name.split(' ').pop() ?? c.name, x + w / 2, y + h * 0.53 + 9 * s, { size: Math.round(13 * s), color: '#ffe8a0' });
    label(d, g, c.text, x + w / 2, y + h * 0.78, { size: Math.round(10 * s), color: '#3a2a1a', maxWidth: Math.round(w - 12 * s), align: 'center' });
    d.circle(x + 12 * s, y + 12 * s, 13 * s, '#2a6fdb'); label(d, g, String(c.cost), x + 12 * s, y + 12 * s, { size: Math.round(15 * s), color: '#ffffff', weight: 900 });
    this.statS(d, x + 12 * s, y + h - 12 * s, c.atk, '#e0a020', s);
    this.statS(d, x + w - 12 * s, y + h - 12 * s, c.hp, '#c03030', s);
    void lerp;
  }
  private statS(d: Draw, x: number, y: number, v: number, bg: string, s: number): void {
    d.circle(x, y, 12 * s, bg);
    label(d, this.game, String(v), x, y, { size: Math.round(14 * s), color: '#ffffff', weight: 900, stroke: '#000000', strokeWidth: 3 });
  }
}
