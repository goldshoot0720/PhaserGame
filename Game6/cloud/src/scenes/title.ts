// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawChar, session, ART, type Frames } from '../art.js';
import { label, Clicker } from '../ui.js';
import { CHARS } from '../tactics.js';

export class Title extends Scene {
  private f!: Frames;
  private t = 0;
  private click = new Clicker();
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void { this.f = registerArt(this.game); this.input.bind({ start: ['Space', 'Enter'] }); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(this.input.pointer)) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 E5 G5', step: 0.07, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.bg, W, H, 0.25);
    CHARS.forEach((c, i) => drawChar(d, g, this.f[c.key], cx + (i - 3.5) * Math.min(140, W / 8.5), H - 20 + Math.sin(this.t * 3 + i) * 5, 200, { flipX: i >= 4 }));
    const sz = g.assets.frameSize(this.f.logo), lh = H * 0.32, lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 16, { w: lw, h: lh });
    label(d, g, '萌友戰棋・八方對決', cx, H * 0.45, { size: 56, color: '#ffe8b0', stroke: '#4a2a10', strokeWidth: 8, weight: 900 });
    label(d, g, '回合制戰略　四對四戰棋', cx, H * 0.52, { size: 24, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, H * 0.59, { size: 28, color: '#ffe066', stroke: '#2a1c10', strokeWidth: 5 });
  }
}
