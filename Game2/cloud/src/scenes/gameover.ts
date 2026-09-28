import { mobilePointer } from '../mobile.js';
// Result screen.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawCourt, drawChar, type Frames } from '../art.js';
import { label, button, inside, Clicker, type Rect } from '../ui.js';
import { session } from '../session.js';

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
    const win = session.result?.win;
    this.sound.play(win ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'G4 F4 E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = mobilePointer(this.input.pointer);
    const c = this.click.poll(p);
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    drawCourt(d, this.f, W, H, 0.55);
    const r = session.result ?? { score: [0, 0] as [number, number], win: false };
    const draw = r.score[0] === r.score[1];
    label(d, g, draw ? '平手' : r.win ? '勝利！街頭王者！' : '落敗…下次再戰！', cx, 100, { size: 64, color: r.win ? '#ffe066' : '#ffffff', stroke: '#3a1250', strokeWidth: 9, weight: 900 });
    label(d, g, `${r.score[0]}  :  ${r.score[1]}`, cx, 190, { size: 72, color: '#ffffff', stroke: '#000000', strokeWidth: 8, weight: 900 });
    const ids = r.win ? session.team : session.cpu;
    ids.forEach((id, i) => drawChar(d, g, this.f.cast[id], cx + (i - 1) * 170, 520 - Math.abs(Math.sin(this.t * 5 + i)) * 20, 250));
    this.again = { x: cx - 250, y: H - 110, w: 230, h: 62 };
    this.menu = { x: cx + 20, y: H - 110, w: 230, h: 62 };
    button(d, g, this.again, '再戰一場', mobilePointer(this.input.pointer), { color: '#d9452b', hover: '#ff6a47', size: 28 });
    button(d, g, this.menu, '重選隊員', mobilePointer(this.input.pointer), { size: 28 });
  }
}
