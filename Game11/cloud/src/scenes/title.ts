// Title.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteC } from '../menu.js';
import { label, Clicker } from '../ui.js';
import { PILOTS, ART } from '../rules.js';
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
      this.sound.play({ notes: 'C5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
      this.game.go('select');
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, g, this.f, W, H, this.t);
    // A formation of jets flying past.
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * 110, y = H - 120 - Math.abs(i - 2) * 40 + Math.sin(this.t * 2 + i) * 8;
      spriteC(d, g, this.f.jet, x, y, 80);
      d.circle(x, y + 44, 6 + Math.random() * 4, '#7fd8ff', 0.8);
    }
    PILOTS.forEach((p, i) => spriteC(d, g, this.f[p.id], (i < 4 ? 90 + i * 70 : W - 90 - (7 - i) * 70), H - 90 + Math.sin(this.t * 3 + i) * 5, 130));
    const sz = g.assets.frameSize(this.f.logo), lw = Math.min(W * 0.7, 720), lh = (sz.h / sz.w) * lw;
    d.sprite(this.f.logo, cx - lw / 2, 30 + Math.sin(this.t * 2) * 5, { w: lw, h: lh });
    label(d, g, 'MOE STRIKERS', cx, lh + 46, { size: 30, color: '#7fd8ff', stroke: '#1a1050', strokeWidth: 6, weight: 900 });
    label(d, g, '縱向捲軸街機射擊・八位飛行員・2026 海洋航線 → 2027 銀河決戰', cx, lh + 86, { size: 20, color: '#ffffff', stroke: '#1a1050', strokeWidth: 5 });
    label(d, g, `最高分 ${session.hi}`, cx, lh + 120, { size: 20, color: '#ffe066', stroke: '#1a1050', strokeWidth: 5 });
    if (Math.sin(this.t * 5) > -0.3) label(d, g, '點擊或按 Space 出擊', cx, lh + 164, { size: 30, color: '#ffe066', stroke: '#1a1050', strokeWidth: 6 });
  }
}
