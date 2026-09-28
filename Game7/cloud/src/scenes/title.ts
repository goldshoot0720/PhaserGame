import { mobilePointer } from '../mobile.js';
// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, Clicker } from '../ui.js';
import { FIGHTERS, ART } from '../data.js';
import { session } from '../session.js';

export class Title extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void { this.f = menuFrames(this.game); this.input.bind({ start: ['Space', 'Enter'] }); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(mobilePointer(this.input.pointer))) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    FIGHTERS.forEach((fi, i) => spriteB(d, g, this.f[fi.id], cx + (i - 3.5) * Math.min(140, W / 8.5), H - 24 + Math.sin(this.t * 5 + i) * 8, 170, i >= 4));
    const sz = g.assets.frameSize(this.f.logo), lh = H * 0.26, lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 30, { w: lw, h: lh });
    label(d, g, '萌友大亂鬥', cx, H * 0.42, { size: 64, color: '#ffffff', stroke: '#6b2a8a', strokeWidth: 10, weight: 900 });
    label(d, g, '八人混戰｜先拿 10 殺或 3 分鐘內最多擊殺者獲勝', cx, H * 0.5, { size: 24, color: '#ffffff', stroke: '#2a2140', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, H * 0.58, { size: 30, color: '#ffe066', stroke: '#2a2140', strokeWidth: 6 });
  }
}
