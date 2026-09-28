// Pick three players; the CPU fields three of the rest.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawCourt, drawChar, type Frames } from '../art.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { BALLERS } from '../data.js';
import { session } from '../session.js';

export class Select extends Scene {
  private f!: Frames;
  private t = 0;
  private cursor = 0;
  private picks: string[] = [];
  private cards: Rect[] = [];
  private go: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private click = new Clicker();

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], pick: ['Space', 'Enter'], back: ['Escape'] });
  }

  private toggle(i: number): void {
    const id = BALLERS[i].id;
    const at = this.picks.indexOf(id);
    if (at >= 0) this.picks.splice(at, 1);
    else if (this.picks.length < 3) this.picks.push(id);
    this.sound.play({ type: 'square', freq: at >= 0 ? 440 : 660, duration: 0.06, volume: 0.25 });
  }

  private start(): void {
    if (this.picks.length !== 3) return;
    const rest = BALLERS.map((b) => b.id).filter((id) => !this.picks.includes(id));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    session.team = [...this.picks];
    session.cpu = rest.slice(0, 3);
    this.sound.play({ notes: 'G4 C5 E5 G5', step: 0.06, type: 'square', volume: 0.35 });
    this.gotoPlay();
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.left.pressed) this.cursor = (this.cursor + 7) % 8;
    if (k.right.pressed) this.cursor = (this.cursor + 1) % 8;
    if (k.up.pressed || k.down.pressed) this.cursor = (this.cursor + 4) % 8;
    if (k.pick.pressed) { if (this.picks.length === 3 && this.picks.includes(BALLERS[this.cursor].id)) this.start(); else this.toggle(this.cursor); }
    if (k.back.pressed) this.gotoTitle();
    const p = this.input.pointer;
    if (this.click.poll(p)) {
      this.cards.forEach((r, i) => { if (inside(p, r)) { this.cursor = i; this.toggle(i); } });
      if (inside(p, this.go)) this.start();
    }
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    drawCourt(d, this.f, W, H, 0.6);
    label(d, g, `選出 3 名隊員（${this.picks.length}/3）`, cx, 46, { size: 40, color: '#ffffff', stroke: '#3a1250', strokeWidth: 7 });
    const cw = Math.min(250, (W - 80) / 4 - 16), ch = 290;
    this.cards = [];
    BALLERS.forEach((b, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const r: Rect = { x: cx - 2 * (cw + 16) + 8 + col * (cw + 16), y: 86 + row * (ch + 14), w: cw, h: ch };
      this.cards.push(r);
      const picked = this.picks.indexOf(b.id);
      const hover = i === this.cursor;
      panel(d, r, picked >= 0 ? '#1d5a7aee' : '#0d1433cc', hover ? '#ffe066' : picked >= 0 ? '#39c6ff' : '#ffffff44');
      drawChar(d, g, this.f.cast[b.id], r.x + 70, r.y + ch - 20 + (hover ? Math.sin(this.t * 6) * 4 : 0), 200);
      label(d, g, b.name, r.x + cw - 12, r.y + 30, { size: 26, color: '#ffffff' }, 1, 0.5);
      label(d, g, b.title, r.x + cw - 12, r.y + 58, { size: 15, color: '#9fd2ff' }, 1, 0.5);
      const stats: [string, number][] = [['投籃', b.shoot], ['外線', b.three], ['速度', b.speed], ['防守', b.defense], ['彈跳', b.jump]];
      stats.forEach(([n, v], j) => {
        const y = r.y + 92 + j * 30;
        label(d, g, n, r.x + cw - 104, y, { size: 15, color: '#ffffff' }, 1, 0.5);
        d.rect(r.x + cw - 96, y - 6, 84, 12, '#ffffff22');
        d.rect(r.x + cw - 96, y - 6, 8.4 * v, 12, v >= 8 ? '#ff9a3c' : '#5cc8ff');
      });
      if (picked >= 0) {
        d.circle(r.x + 22, r.y + 24, 16, '#39c6ff');
        label(d, g, String(picked + 1), r.x + 22, r.y + 24, { size: 20, color: '#ffffff' });
      }
    });
    this.go = { x: cx - 150, y: H - 86, w: 300, h: 60 };
    button(d, g, this.go, this.picks.length === 3 ? '上場比賽！' : '請選滿 3 人', this.input.pointer, { color: this.picks.length === 3 ? '#d9452b' : '#555a70', hover: this.picks.length === 3 ? '#ff6a47' : '#555a70', size: 28 });
    label(d, g, '點擊卡片或方向鍵＋Space 選擇　Esc 返回', cx, H - 14, { size: 16, color: '#dddddd' });
  }
}
