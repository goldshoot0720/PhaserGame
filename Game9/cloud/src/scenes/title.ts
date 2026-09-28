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
      if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }
      this.sound.play({ notes: 'C5 E5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    // Little town skyline.
    for (let i = 0; i < 9; i++) {
      const x = cx + (i - 4) * Math.min(150, W / 9), hotel = i % 3 === 1;
      spriteB(d, g, hotel ? this.f.hotel : this.f.house, x, H - 150, hotel ? 170 : 120, { alpha: 0.55 });
    }
    d.rect(0, H - 150, W, 150, '#0d2438', 0.9);
    HEROES.forEach((h, i) => spriteB(d, g, this.f[h.id], cx + (i - 3.5) * Math.min(135, W / 8.5), H - 18 - Math.abs(Math.sin(this.t * 4 + i * 0.8)) * 16, 150, { flipX: i >= 4 }));
    const sz = g.assets.frameSize(this.f.logo), lw = Math.min(W * 0.8, 820), lh = (sz.h / sz.w) * lw;
    d.sprite(this.f.logo, cx - lw / 2, 40 + Math.sin(this.t * 2) * 6, { w: lw, h: lh });
    label(d, g, 'Moe Monopoly', cx, 70 + lh, { size: 30, color: '#ffe066', stroke: '#5a2a6a', strokeWidth: 6, weight: 900 });
    label(d, g, '擲骰子走遍萌友小鎮・買地蓋房收過路費・20 回合後資產最多者獲勝', cx, 118 + lh, { size: 22, color: '#ffffff', stroke: '#123049', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 開始', cx, 170 + lh, { size: 30, color: '#ffe066', stroke: '#123049', strokeWidth: 6 });
  }
}
