// Title screen.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawCourt, drawCentered, drawChar, type Frames } from '../art.js';
import { label, Clicker } from '../ui.js';
import { ART, BALLERS } from '../data.js';
import { session } from '../session.js';

export class Title extends Scene {
  private f!: Frames;
  private t = 0;
  private click = new Clicker();

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ start: ['Space', 'Enter'] });
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(this.input.pointer)) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3, fadeIn: 1 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 G5 C6', step: 0.07, type: 'square', volume: 0.35 });
      this.game.go('select');
    }
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2;
    drawCourt(d, this.f, W, H, 0.3);
    BALLERS.forEach((b, i) => {
      const x = cx + (i - 3.5) * Math.min(150, W / 8.5);
      drawChar(d, this.game, this.f.cast[b.id], x, H - 30 + Math.sin(this.t * 4 + i) * 5, 190);
    });
    drawCentered(d, this.game, this.f.logo, cx, H * 0.25, H * 0.34);
    label(d, this.game, '萌友街頭 3x3', cx, H * 0.47, { size: 60, color: '#ffe8a0', stroke: '#3a1250', strokeWidth: 9, weight: 900 });
    label(d, this.game, '三對三半場鬥牛｜先得 21 分獲勝', cx, H * 0.54, { size: 26, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, this.game, '點擊或按 Space 開始', cx, H * 0.61, { size: 30, color: '#7ff0ff', stroke: '#101030', strokeWidth: 6 });
  }
}
