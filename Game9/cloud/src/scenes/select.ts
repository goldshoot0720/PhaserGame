import { mobilePointer } from '../mobile.js';
// Pick a hero — each one has a perk.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { HEROES, START_CASH } from '../rules.js';
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
    label(d, g, '選擇你的角色', cx, 40, { size: 38, color: '#ffe066', stroke: '#5a2a6a', strokeWidth: 7, weight: 900 });
    label(d, g, `每人起始資金 $${START_CASH}，每位角色都有獨特能力`, cx, 78, { size: 18, color: '#ffffff' });
    const cw = Math.min(270, (W - 60) / 4 - 14), ch = 260;
    this.cards = [];
    HEROES.forEach((h, j) => {
      const r: Rect = { x: cx - 2 * (cw + 14) + 7 + (j % 4) * (cw + 14), y: 102 + Math.floor(j / 4) * (ch + 12), w: cw, h: ch };
      this.cards.push(r);
      const sel = j === this.i;
      panel(d, r, sel ? '#2f6b8fee' : '#0d2438dd', sel ? '#ffe066' : '#ffffff44');
      spriteB(d, g, this.f[h.id], r.x + cw / 2, r.y + 190 + (sel ? Math.sin(this.t * 8) * 3 : 0), 170);
      label(d, g, `${h.name}・${h.title}`, r.x + cw / 2, r.y + 212, { size: 20, color: '#ffffff', stroke: '#0d2438', strokeWidth: 4 });
      d.rect(r.x + 10, r.y + 228, cw - 20, 24, '#ffd44a', sel ? 0.95 : 0.7);
      label(d, g, h.perkText, r.x + cw / 2, r.y + 240, { size: 15, color: '#4a2a00' });
    });
    this.go = { x: cx - 150, y: H - 76, w: 300, h: 58 };
    button(d, g, this.go, `以 ${HEROES[this.i].name} 出發！`, mobilePointer(this.input.pointer), { color: '#e0567f', hover: '#ff7aa0', size: 26 });
  }
}
