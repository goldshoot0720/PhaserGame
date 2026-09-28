import { mobilePointer } from '../mobile.js';
// Pick a fighter.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { FIGHTERS } from '../data.js';
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
    this.i = Math.max(0, FIGHTERS.findIndex((x) => x.id === session.hero));
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter'], back: ['Escape'] });
  }
  private start(): void { session.hero = FIGHTERS[this.i].id; this.sound.play({ notes: 'G4 C5 E5 G5', step: 0.06, type: 'square', volume: 0.3 }); this.gotoPlay(); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.left.pressed) this.i = (this.i + 7) % 8;
    if (k.right.pressed) this.i = (this.i + 1) % 8;
    if (k.up.pressed || k.down.pressed) this.i = (this.i + 4) % 8;
    if (k.ok.pressed) this.start();
    if (k.back.pressed) this.gotoTitle();
    const p = mobilePointer(this.input.pointer);
    if (this.click.poll(p)) {
      this.cards.forEach((r, j) => { if (inside(p, r)) { if (this.i === j) this.start(); else this.i = j; } });
      if (inside(p, this.go)) this.start();
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    label(d, g, '選擇你的鬥士', cx, 44, { size: 40, color: '#ffffff', stroke: '#6b2a8a', strokeWidth: 7 });
    const cw = Math.min(260, (W - 80) / 4 - 14), ch = 250;
    this.cards = [];
    FIGHTERS.forEach((fi, j) => {
      const r: Rect = { x: cx - 2 * (cw + 14) + 7 + (j % 4) * (cw + 14), y: 84 + Math.floor(j / 4) * (ch + 12), w: cw, h: ch };
      this.cards.push(r);
      const sel = j === this.i;
      panel(d, r, sel ? '#4a2a7aee' : '#2a2140dd', sel ? '#ffe066' : '#ffffff44');
      spriteB(d, g, this.f[fi.id], r.x + 62, r.y + ch - 16 + (sel ? Math.sin(this.t * 8) * 3 : 0), 190);
      const w = fi.weapon;
      label(d, g, fi.name, r.x + cw - 14, r.y + 30, { size: 24, color: '#ffffff' }, 1, 0.5);
      label(d, g, w.name, r.x + cw - 14, r.y + 62, { size: 16, color: w.color }, 1, 0.5);
      const bars: [string, number][] = [['威力', Math.min(1, (w.dmg * w.pellets) / 50)], ['射速', Math.min(1, 0.1 / w.rate * 1.2)], ['射程', Math.min(1, w.range / 1100)]];
      bars.forEach(([n, v], k) => {
        const y = r.y + 100 + k * 30;
        label(d, g, n, r.x + cw - 100, y, { size: 13, color: '#dddddd' }, 1, 0.5);
        d.rect(r.x + cw - 94, y - 5, 80, 10, '#ffffff22');
        d.rect(r.x + cw - 94, y - 5, 80 * Math.max(0.08, v), 10, '#ff7ab0');
      });
    });
    this.go = { x: cx - 150, y: H - 84, w: 300, h: 60 };
    button(d, g, this.go, '進入競技場！', mobilePointer(this.input.pointer), { color: '#d9458b', hover: '#ff6aa8', size: 28 });
  }
}
