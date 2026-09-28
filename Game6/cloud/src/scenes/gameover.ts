// Result.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawChar, session, type Frames } from '../art.js';
import { label, button, inside, Clicker, type Rect } from '../ui.js';

export class GameOver extends Scene {
  private f!: Frames;
  private t = 0;
  private click = new Clicker();
  private again: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private menu: Rect = { x: 0, y: 0, w: 0, h: 0 };
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ again: ['Space', 'Enter'], menu: ['Escape'] });
    this.sound.play(session.result?.win ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'G4 F4 E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = this.input.pointer, c = this.click.poll(p);
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    const r = session.result ?? { win: false, turns: 0, survivors: [] };
    cover(d, g, this.f.bg, W, H, 0.5);
    label(d, g, r.win ? '勝利！' : '戰敗…', cx, 110, { size: 90, color: r.win ? '#ffd23f' : '#ff8a80', stroke: '#000000', strokeWidth: 10, weight: 900 });
    label(d, g, `共 ${r.turns} 回合　存活 ${r.survivors.length} 人`, cx, 200, { size: 28, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    r.survivors.forEach((k, i) => drawChar(d, g, this.f[k], cx + (i - (r.survivors.length - 1) / 2) * 170, 500 - Math.abs(Math.sin(this.t * 4 + i)) * 16, 240, { flipX: !r.win }));
    this.again = { x: cx - 250, y: H - 110, w: 230, h: 60 };
    this.menu = { x: cx + 20, y: H - 110, w: 230, h: 60 };
    button(d, g, this.again, '再戰一次', this.input.pointer, { color: '#b8742a', hover: '#e0923a', size: 26 });
    button(d, g, this.menu, '重新編隊', this.input.pointer, { size: 26 });
  }
}
