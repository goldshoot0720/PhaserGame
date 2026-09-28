// Title: stadium, logo, Chinese title, start.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawStadium, drawCentered, drawChar, type Frames } from '../art.js';
import { label, button } from '../ui.js';
import { ART, CAST_URLS } from '../data.js';
import { session } from '../session.js';

export class Title extends Scene {
  private f!: Frames;
  private t = 0;
  private wasDown = false;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ start: ['Space', 'Enter'] });
  }

  private start(): void {
    if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.35, fadeIn: 1 }); session.musicOn = true; }
    this.sound.play({ notes: 'C5 E5 G5 C6:2', step: 0.07, type: 'square', volume: 0.4 });
    this.game.go('select');
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = this.input.pointer;
    const down = !!p?.isDown;
    if (this.input.keys.start.pressed || (down && !this.wasDown)) this.start();
    this.wasDown = down;
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2;
    drawStadium(d, this.f, W, H, 0.25);
    const ids = Object.keys(CAST_URLS);
    ids.forEach((id, i) => {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const x = cx + side * (W * 0.18 + k * W * 0.075);
      const bob = Math.sin(this.t * 3 + i) * 6;
      drawChar(d, this.game, this.f.cast[id], x, H - 40 + bob, 210);
    });
    drawCentered(d, this.game, this.f.logo, cx, H * 0.26, H * 0.36);
    label(d, this.game, '萌友棒球對決', cx, H * 0.49, { size: 58, color: '#fff6c8', stroke: '#1b2a6b', strokeWidth: 8, weight: 900 });
    label(d, this.game, '藍鯨隊 vs 貓咪隊　三局制一球決勝負', cx, H * 0.56, { size: 26, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    const blink = Math.sin(this.t * 5) > -0.3;
    if (blink) label(d, this.game, '點擊或按 Space 開始', cx, H * 0.64, { size: 30, color: '#ffe066', stroke: '#402000', strokeWidth: 6 });
    void button;
  }
}
