import { mobilePointer } from '../mobile.js';
// Pick four units (the other four are the enemy) and a map.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawChar, session, type Frames } from '../art.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { CHARS, MAPS } from '../tactics.js';

export class Select extends Scene {
  private f!: Frames;
  private t = 0;
  private picks: string[] = [];
  private hover = -1;
  private cards: Rect[] = [];
  private mapBtns: Rect[] = [];
  private go: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private click = new Clicker();
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void { this.f = registerArt(this.game); this.picks = []; this.input.bind({ back: ['Escape'], ok: ['Enter'] }); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.back.pressed) { this.gotoTitle(); return; }
    const p = mobilePointer(this.input.pointer);
    this.hover = this.cards.findIndex((r) => inside(p, r));
    const ready = this.picks.length === 4;
    if (this.click.poll(p)) {
      if (this.hover >= 0) {
        const k = CHARS[this.hover].key, at = this.picks.indexOf(k);
        if (at >= 0) this.picks.splice(at, 1); else if (this.picks.length < 4) this.picks.push(k);
        this.sound.play({ type: 'square', freq: at >= 0 ? 440 : 700, duration: 0.05, volume: 0.2 });
      }
      this.mapBtns.forEach((r, i) => { if (inside(p, r)) session.map = i; });
      if (ready && inside(p, this.go)) this.start();
    }
    if (ready && this.input.keys.ok.pressed) this.start();
  }
  private start(): void {
    session.team = [...this.picks];
    this.sound.play({ notes: 'G4 C5 E5 G5', step: 0.07, type: 'square', volume: 0.3 });
    this.gotoPlay();
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.bg, W, H, 0.55);
    label(d, g, `選出 4 名出戰角色（${this.picks.length}/4）— 其餘四位將成為對手`, cx, 40, { size: 30, color: '#ffe8b0', stroke: '#2a1c10', strokeWidth: 6 });
    const cw = Math.min(280, (W - 80) / 4 - 14), ch = 200;
    this.cards = [];
    CHARS.forEach((c, i) => {
      const r: Rect = { x: cx - 2 * (cw + 14) + 7 + (i % 4) * (cw + 14), y: 76 + Math.floor(i / 4) * (ch + 12), w: cw, h: ch };
      this.cards.push(r);
      const pk = this.picks.indexOf(c.key);
      panel(d, r, pk >= 0 ? '#1d4a7aee' : '#1c1428dd', pk >= 0 ? '#5cc8ff' : i === this.hover ? '#ffe066' : '#c9a46a88');
      drawChar(d, g, this.f[c.key], r.x + 64, r.y + ch - 10 + (i === this.hover ? Math.sin(this.t * 8) * 3 : 0), 170);
      label(d, g, `${c.name}｜${c.role}`, r.x + 130, r.y + 26, { size: 20, color: '#ffffff' }, 0, 0.5);
      label(d, g, `HP ${c.hp}　攻 ${c.atk}　防 ${c.def}`, r.x + 130, r.y + 58, { size: 15, color: '#ffe8b0' }, 0, 0.5);
      label(d, g, `移動 ${c.mov}　射程 ${c.rmin}-${c.rmax}`, r.x + 130, r.y + 82, { size: 15, color: '#ffe8b0' }, 0, 0.5);
      label(d, g, c.desc, r.x + 130, r.y + 140, { size: 13, color: '#cccccc', maxWidth: cw - 140 }, 0, 0.5);
      if (pk >= 0) { d.circle(r.x + 20, r.y + 20, 15, '#5cc8ff'); label(d, g, String(pk + 1), r.x + 20, r.y + 20, { size: 18, color: '#ffffff' }); }
    });
    label(d, g, '戰場：', cx - 330, H - 120, { size: 22, color: '#ffffff' }, 1, 0.5);
    this.mapBtns = MAPS.map((_, i) => ({ x: cx - 320 + i * 220, y: H - 146, w: 200, h: 52 }));
    MAPS.forEach((m, i) => button(d, g, this.mapBtns[i], m.name, mobilePointer(this.input.pointer), { selected: session.map === i, size: 22 }));
    this.go = { x: cx - 150, y: H - 78, w: 300, h: 58 };
    const ready = this.picks.length === 4;
    button(d, g, this.go, ready ? '出擊！' : '請選滿 4 人', mobilePointer(this.input.pointer), { color: ready ? '#b8742a' : '#555a70', hover: ready ? '#e0923a' : '#555a70', size: 28 });
  }
}
