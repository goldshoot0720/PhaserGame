import { mobilePointer } from '../mobile.js';
// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, frames, cover, portrait } from '../common.js';
import { label, Clicker } from '../ui.js';
import { CHARACTERS, ART } from '../data.js';
import { run } from '../progress.js';

export class Title extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void { this.f = frames(this.game); this.input.bind({ start: ['Space', 'Enter', 'KeyZ'] }); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(mobilePointer(this.input.pointer))) {
      this.sound.music(ART.stageMusic, { loop: true, volume: 0.25 });
      run.musicOn = true;
      this.sound.play({ notes: 'C5 G5 C6', step: 0.07, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.bg_final, W, H, 0.2);
    CHARACTERS.forEach((c, i) => portrait(d, g, this.f[c.key], cx + (i - 3.5) * Math.min(95, W / 8.6), H - 8 + Math.sin(this.t * 3 + i) * 4, 120));
    const lf = this.f.logo, sz = g.assets.frameSize(lf), lh = H * 0.3, lw = (sz.w / sz.h) * lh;
    d.sprite(lf, cx - lw / 2, H * 0.04, { w: lw, h: lh });
    label(d, g, '萌友洛克英雄', cx, H * 0.4, { size: 40, color: '#fff3a0', stroke: '#2a1040', strokeWidth: 6, weight: 900 });
    label(d, g, '擊敗七位頭目，奪取她們的武器！', cx, H * 0.48, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '按 Z / Space 或點擊開始', cx, H * 0.56, { size: 20, color: '#7ff0ff', stroke: '#101030', strokeWidth: 4 });
  }
}
