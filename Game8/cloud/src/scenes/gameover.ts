import { mobilePointer } from '../mobile.js';
// Result.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, fit, session } from '../art.js';
import { label, button, inside, Clicker, type Rect } from '../ui.js';
import { CARDS } from '../cards.js';

export class GameOver extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  private again: Rect = { x: 0, y: 0, w: 0, h: 0 };
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ again: ['Space', 'Enter'] });
    this.sound.play(session.result?.win ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'G4 F4 E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = mobilePointer(this.input.pointer), c = this.click.poll(p);
    if (this.t > 0.8 && (this.input.keys.again.pressed || (c && inside(p, this.again)))) this.gotoPlay();
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.table, W, H, 0.5);
    const r = session.result;
    const text = !r ? '' : r.win === null ? '平手！' : r.win ? '勝利！' : '敗北…';
    label(d, g, text, cx, 150, { size: 96, color: r?.win ? '#ffe066' : '#ffffff', stroke: '#3a2a1a', strokeWidth: 10, weight: 900 });
    label(d, g, `共 ${r?.turns ?? 0} 回合`, cx, 240, { size: 28, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    CARDS.forEach((c, i) => fit(d, g, this.f[c.id], cx + (i - 3.5) * 110, 520 - Math.abs(Math.sin(this.t * 4 + i)) * 16, 170));
    this.again = { x: cx - 130, y: H - 110, w: 260, h: 62 };
    button(d, g, this.again, '再來一局', mobilePointer(this.input.pointer), { color: '#b8742a', hover: '#e0923a', size: 28 });
  }
}
