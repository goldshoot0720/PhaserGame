// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, Clicker } from '../ui.js';
import { HEROES, ART } from '../rules.js';
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
    if (this.input.keys.start.pressed || this.click.poll(this.input.pointer)) {
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.28 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 E5 G5 C6', step: 0.06, type: 'sine', volume: 0.35 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    d.rect(0, H - 130, W, 130, '#aee08c');
    for (let x = 0; x < W; x += 60) d.rect(x, H - 130, 30, 130, '#bfeaa0');
    for (let i = 0; i < 6; i++) spriteB(d, g, i % 2 ? this.f.crate : this.f.house, 60 + i * (W - 120) / 5, H - 110, 90, { alpha: 0.9 });
    HEROES.forEach((h, i) => {
      const x = cx + (i - 3.5) * Math.min(135, W / 8.5), y = H - 22 - Math.abs(Math.sin(this.t * 4 + i * 0.7)) * 18;
      spriteB(d, g, this.f[h.id], x, y, 140, { flipX: i >= 4 });
      if (i % 3 === 0) spriteB(d, g, this.f.balloon, x + 40, H - 20, 44);
    });
    const sz = g.assets.frameSize(this.f.logo), lh = Math.min(280, H * 0.4), lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 14 + Math.sin(this.t * 2) * 5, { w: lw, h: lh });
    label(d, g, 'Moe Balloon Battle', cx, lh + 30, { size: 30, color: '#ffffff', stroke: '#1a4a8a', strokeWidth: 6, weight: 900 });
    label(d, g, '四人水球大亂鬥・被水柱打中會困在泡泡裡・先拿下 2 回合的人獲勝', cx, lh + 70, { size: 21, color: '#ffffff', stroke: '#1a4a8a', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, lh + 116, { size: 30, color: '#ffe066', stroke: '#1a4a8a', strokeWidth: 6 });
  }
}
