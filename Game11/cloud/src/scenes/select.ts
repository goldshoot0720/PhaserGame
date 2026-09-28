// Pick a pilot — each one flies a different shot type.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteC } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { PILOTS, dps } from '../rules.js';
import { session } from '../session.js';

export class Select extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private i = 0;
  private cards: Rect[] = [];
  private go: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private click = new Clicker();
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void {
    this.f = menuFrames(this.game);
    this.i = Math.max(0, PILOTS.findIndex((p) => p.id === session.pilot));
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter'], back: ['Escape'] });
  }
  private start(): void { session.pilot = PILOTS[this.i].id; this.sound.play({ notes: 'G4 C5 E5 G5', step: 0.06, type: 'square', volume: 0.3 }); this.gotoPlay(); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.left.pressed) this.i = (this.i + 7) % 8;
    if (k.right.pressed) this.i = (this.i + 1) % 8;
    if (k.up.pressed || k.down.pressed) this.i = (this.i + 4) % 8;
    if (k.ok.pressed) this.start();
    if (k.back.pressed) this.gotoTitle();
    const p = this.input.pointer;
    if (this.click.poll(p)) {
      this.cards.forEach((r, j) => { if (inside(p, r)) { if (this.i === j) this.start(); else this.i = j; } });
      if (inside(p, this.go)) this.start();
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, g, this.f, W, H, this.t);
    label(d, g, '選擇飛行員', cx, 40, { size: 38, color: '#ffe066', stroke: '#1a1050', strokeWidth: 7, weight: 900 });
    label(d, g, '每位飛行員的射擊方式都不同，吃「P」升級火力（最高 Lv.4）', cx, 78, { size: 18, color: '#ffffff', stroke: '#1a1050', strokeWidth: 4 });
    const cw = Math.min(270, (W - 60) / 4 - 14), ch = 262, maxDps = Math.max(...PILOTS.map((p) => dps(p.shot, 4)));
    this.cards = [];
    PILOTS.forEach((p, j) => {
      const r: Rect = { x: cx - 2 * (cw + 14) + 7 + (j % 4) * (cw + 14), y: 100 + Math.floor(j / 4) * (ch + 12), w: cw, h: ch };
      this.cards.push(r);
      const sel = j === this.i;
      panel(d, r, sel ? '#2a2f7aee' : '#12143add', sel ? '#ffe066' : '#ffffff44');
      spriteC(d, g, this.f[p.id], r.x + cw * 0.32, r.y + 104 + (sel ? Math.sin(this.t * 8) * 3 : 0), 170);
      spriteC(d, g, this.f.jet, r.x + cw * 0.78, r.y + 90 - (sel ? Math.abs(Math.sin(this.t * 6)) * 8 : 0), 64);
      label(d, g, `${p.name}・${p.title}`, r.x + cw / 2, r.y + 200, { size: 18, color: '#ffffff', stroke: '#12143a', strokeWidth: 4 });
      label(d, g, p.shotName, r.x + cw / 2, r.y + 224, { size: 17, color: '#ffe066', weight: 900 });
      label(d, g, p.desc, r.x + cw / 2, r.y + 246, { size: 13, color: '#aac4ff' });
      d.rect(r.x + 12, r.y + 12, (cw - 24) * (dps(p.shot, 4) / maxDps), 5, '#ff4a6a', 0.8);
    });
    this.go = { x: cx - 150, y: H - 74, w: 300, h: 58 };
    button(d, g, this.go, `${PILOTS[this.i].name}，出擊！`, this.input.pointer, { color: '#e0567f', hover: '#ff7aa0', size: 26 });
  }
}
