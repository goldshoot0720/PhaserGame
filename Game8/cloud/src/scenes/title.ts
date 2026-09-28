import { mobilePointer } from '../mobile.js';
// Title with a card fan.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, fit, ART, session } from '../art.js';
import { label, Clicker } from '../ui.js';
import { CARDS } from '../cards.js';

export class Title extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void { this.f = registerArt(this.game); this.input.bind({ start: ['Space', 'Enter'] }); }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keys.start.pressed || this.click.poll(mobilePointer(this.input.pointer))) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
      this.gotoPlay();
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.table, W, H, 0.35);
    CARDS.forEach((c, i) => {
      const x = cx + (i - 3.5) * Math.min(130, W / 9), y = H - 190 + Math.abs(i - 3.5) * 10 + Math.sin(this.t * 2 + i) * 4;
      d.rect(x - 52, y - 4, 104, 148, '#c9a46a'); d.rect(x - 49, y - 1, 98, 142, c.color, 0.5);
      fit(d, g, this.f[c.id], x, y + 136, 130);
    });
    const sz = g.assets.frameSize(this.f.logo), lh = H * 0.3, lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 20, { w: lw, h: lh });
    label(d, g, '萌友卡牌對決', cx, H * 0.43, { size: 56, color: '#ffe8a0', stroke: '#3a2a1a', strokeWidth: 8, weight: 900 });
    label(d, g, '出牌、交換、打倒對手英雄！嘲諷 / 衝鋒 / 登場效果', cx, H * 0.5, { size: 22, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始對決', cx, H * 0.57, { size: 28, color: '#5cffb0', stroke: '#000000', strokeWidth: 5 });
  }
}
