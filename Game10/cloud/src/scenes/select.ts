// Pick a driver — each brings one special shell.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { HEROES } from '../rules.js';
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
    this.i = Math.max(0, HEROES.findIndex((h) => h.id === session.hero));
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter'], back: ['Escape'] });
  }
  private start(): void { session.hero = HEROES[this.i].id; this.sound.play({ notes: 'G4 C5 E5 G5', step: 0.06, type: 'square', volume: 0.3 }); this.gotoPlay(); }
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
    backdrop(d, W, H, this.t);
    label(d, g, '選擇你的駕駛員', cx, 40, { size: 38, color: '#ffe066', stroke: '#3a2a6a', strokeWidth: 7, weight: 900 });
    label(d, g, '人人都有標準彈、三連彈、重砲，再加上一發角色專屬特殊彈', cx, 78, { size: 18, color: '#ffffff', stroke: '#1a2a4a', strokeWidth: 4 });
    const cw = Math.min(270, (W - 60) / 4 - 14), ch = 262;
    this.cards = [];
    HEROES.forEach((h, j) => {
      const r: Rect = { x: cx - 2 * (cw + 14) + 7 + (j % 4) * (cw + 14), y: 100 + Math.floor(j / 4) * (ch + 12), w: cw, h: ch };
      this.cards.push(r);
      const sel = j === this.i;
      panel(d, r, sel ? '#2f4f7fee' : '#0d1a33dd', sel ? '#ffe066' : '#ffffff44');
      spriteB(d, g, this.f[h.id], r.x + cw / 2, r.y + 176 + (sel ? Math.sin(this.t * 8) * 3 : 0), 160);
      label(d, g, `${h.name}・${h.title}`, r.x + cw / 2, r.y + 196, { size: 19, color: '#ffffff', stroke: '#0d1a33', strokeWidth: 4 });
      d.rect(r.x + 10, r.y + 212, cw - 20, 42, h.special.color, sel ? 0.9 : 0.6);
      label(d, g, h.special.name, r.x + cw / 2, r.y + 224, { size: 16, color: '#1a1a2a', weight: 900 });
      label(d, g, h.special.desc, r.x + cw / 2, r.y + 243, { size: 13, color: '#1a1a2a' });
    });
    this.go = { x: cx - 150, y: H - 74, w: 300, h: 58 };
    button(d, g, this.go, `駕駛坦克出擊！`, this.input.pointer, { color: '#e0567f', hover: '#ff7aa0', size: 26 });
  }
}
