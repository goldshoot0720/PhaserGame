// Hero select: the other seven become bosses.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, frames, cover, portrait } from '../common.js';
import { label, panel, inside, Clicker, type Rect } from '../ui.js';
import { CHARACTERS } from '../data.js';
import { Progress, run } from '../progress.js';

export class Select extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private i = 0;
  private cards: Rect[] = [];
  private click = new Clicker();
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void {
    this.f = frames(this.game);
    this.i = Math.max(0, CHARACTERS.findIndex((c) => c.key === (Progress.lastHero ?? 'whale')));
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter', 'KeyZ'], back: ['Escape'] });
  }
  private pick(): void {
    const h = CHARACTERS[this.i];
    Progress.setHero(h.key);
    run.hero = h.key;
    run.outcome = 'none';
    this.sound.play({ notes: 'G5 C6', step: 0.06, type: 'square', volume: 0.3 });
    this.game.go('stages');
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.left.pressed) this.i = (this.i + 7) % 8;
    if (k.right.pressed) this.i = (this.i + 1) % 8;
    if (k.up.pressed || k.down.pressed) this.i = (this.i + 4) % 8;
    if (k.ok.pressed) this.pick();
    if (k.back.pressed) this.gotoTitle();
    const p = this.input.pointer;
    if (this.click.poll(p)) this.cards.forEach((r, j) => { if (inside(p, r)) { if (this.i === j) this.pick(); else this.i = j; } });
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f['bg_' + CHARACTERS[this.i].key], W, H, 0.55);
    label(d, g, '選擇你的英雄', cx, 26, { size: 26, color: '#ffffff', stroke: '#2a1040', strokeWidth: 5 });
    const cw = Math.min(170, (W - 40) / 4 - 10), ch = 170;
    this.cards = [];
    CHARACTERS.forEach((c, j) => {
      const col = j % 4, row = Math.floor(j / 4);
      const r: Rect = { x: cx - 2 * (cw + 10) + 5 + col * (cw + 10), y: 50 + row * (ch + 8), w: cw, h: ch };
      this.cards.push(r);
      const sel = j === this.i;
      panel(d, r, sel ? '#3a2a70ee' : '#0d1433cc', sel ? '#ffe066' : '#ffffff44');
      portrait(d, g, this.f[c.key], r.x + cw / 2, r.y + ch - 34 + (sel ? Math.sin(this.t * 8) * 2 : 0), 120);
      label(d, g, c.name, r.x + cw / 2, r.y + ch - 22, { size: 16, color: sel ? '#ffe066' : '#ffffff' });
      label(d, g, c.weapon.name, r.x + cw / 2, r.y + ch - 7, { size: 11, color: c.weapon.color });
      if (Progress.isCleared(c.key)) label(d, g, '★通關', r.x + 8, r.y + 12, { size: 12, color: '#ffe066' }, 0, 0.5);
    });
    const h = CHARACTERS[this.i];
    label(d, g, `${h.name}｜${h.title}　招牌武器：${h.weapon.name} — ${h.weapon.desc}`, cx, H - 16, { size: 13, color: '#ffffff', stroke: '#000000', strokeWidth: 3 });
  }
}
