import { mobilePointer } from '../mobile.js';
// Title screen.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawCentered, drawBottom, cover, type Frames } from '../art.js';
import { label, Clicker } from '../ui.js';
import { ART, RACERS } from '../data.js';
import { session } from '../session.js';

export class Title extends Scene {
  private f!: Frames;
  private t = 0;
  private click = new Clicker();

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void { this.f = registerArt(this.game); this.input.bind({ start: ['Space', 'Enter'] }); }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(mobilePointer(this.input.pointer))) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3, fadeIn: 1 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 E5 G5 C6', step: 0.06, type: 'square', volume: 0.35 });
      this.game.go('select');
    }
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.sky[0], W, H, 0.1);
    d.rect(0, H * 0.72, W, H * 0.28, '#5a6474');
    for (let i = 0; i < 12; i++) d.rect(((i * 160 - this.t * 900) % (W + 160) + W + 160) % (W + 160) - 160, H * 0.85, 80, 10, '#ffffff');
    RACERS.forEach((r, i) => {
      const x = ((i + 0.5) / 8) * W + Math.sin(this.t * 2 + i) * 20;
      drawBottom(d, g, this.f.kart[r.id], x, H - 20 - (i % 2) * 70, 150);
    });
    drawCentered(d, g, this.f.logo, cx, H * 0.2, H * 0.2);
    label(d, g, '萌友卡丁車 GP', cx, H * 0.38, { size: 64, color: '#fff3a0', stroke: '#3a1250', strokeWidth: 9, weight: 900 });
    label(d, g, '八人同場｜三條賽道｜漂移加速與道具大戰', cx, H * 0.46, { size: 26, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, H * 0.54, { size: 30, color: '#7ff0ff', stroke: '#101030', strokeWidth: 6 });
  }
}
