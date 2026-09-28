// Match result.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawFighter, type Frames } from '../art.js';
import { label, button, inside, Clicker, type Rect } from '../ui.js';
import { ROSTER } from '../roster.js';
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
    this.input.bind({ again: ['Space', 'Enter', 'KeyJ'], menu: ['Escape'] });
    const youWin = session.mode === 'vs' || session.winner === 0;
    this.sound.play(youWin ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'G4 F4 E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = this.input.pointer, c = this.click.poll(p);
    if (this.t < 0.8) return;
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.stages[session.stage], W, H, 0.5);
    const wi = session.winner === 0 ? session.p1 : session.p2;
    const r = ROSTER[wi];
    const head = session.mode === 'cpu' ? (session.winner === 0 ? '你贏了！' : '你輸了……') : `${session.winner === 0 ? '1P' : '2P'} 獲勝！`;
    label(d, g, head, cx, 90, { size: 72, color: '#ffe066', stroke: '#6a1010', strokeWidth: 10, weight: 900 });
    label(d, g, `${session.score[0]} - ${session.score[1]}`, cx, 170, { size: 44, color: '#ffffff', stroke: '#000000', strokeWidth: 6 });
    drawFighter(d, g, this.f.fighters[wi], cx, H - 130 - Math.abs(Math.sin(this.t * 4)) * 14, r.height * 1.3, 1, r.faceLeft);
    label(d, g, `「${r.name}：還要再來一場嗎？」`, cx, H - 110, { size: 26, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    this.again = { x: cx - 250, y: H - 84, w: 230, h: 58 };
    this.menu = { x: cx + 20, y: H - 84, w: 230, h: 58 };
    button(d, g, this.again, '再戰一場', this.input.pointer, { color: '#d9452b', hover: '#ff6a47', size: 26 });
    button(d, g, this.menu, '重選角色', this.input.pointer, { size: 26 });
  }
}
