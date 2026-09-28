import { mobilePointer } from '../mobile.js';
// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, Clicker } from '../ui.js';
import { HEROES, ART, TANK_COLORS } from '../rules.js';
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
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.28 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    // A row of tanks with riders.
    HEROES.forEach((h, i) => {
      const x = cx + (i - 3.5) * Math.min(145, W / 8.6), y = H - 70 + Math.sin(this.t * 3 + i) * 4, flip = i >= 4;
      spriteB(d, g, this.f[h.id], x, y - 34, 84, { flipX: flip });
      const hs = g.assets.frameSize(this.f.hull), hw = 100, hh = (hs.h / hs.w) * hw;
      d.sprite(this.f.hull, x - hw / 2, y - hh + 8, { w: hw, h: hh, flipX: flip, tint: TANK_COLORS[i % 4] });
    });
    const sz = g.assets.frameSize(this.f.logo), lh = Math.min(300, H * 0.42), lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 16 + Math.sin(this.t * 2) * 5, { w: lw, h: lh });
    label(d, g, 'Moe Tank Wars', cx, lh + 34, { size: 30, color: '#ffe066', stroke: '#3a2a6a', strokeWidth: 6, weight: 900 });
    label(d, g, '四輛坦克輪流開砲・地形會被炸掉・注意風向與水坑，活到最後就贏！', cx, lh + 76, { size: 22, color: '#ffffff', stroke: '#1a2a4a', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, lh + 122, { size: 30, color: '#ffe066', stroke: '#1a2a4a', strokeWidth: 6 });
  }
}
