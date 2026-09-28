// Ending.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, frames, cover, portrait } from '../common.js';
import { label, Clicker } from '../ui.js';
import { CHARACTERS, getHero } from '../data.js';
import { run } from '../progress.js';

export class GameOver extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void {
    this.f = frames(this.game);
    this.input.bind({ ok: ['Space', 'Enter', 'KeyZ'] });
    this.sound.play({ notes: 'C5 E5 G5 C6 G5 E5 G5 C6:4', step: 0.14, type: 'square', volume: 0.35 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.t > 2 && (this.input.keys.ok.pressed || this.click.poll(this.input.pointer))) this.gotoTitle();
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.bg_sailor, W, H, 0.35);
    const h = getHero(run.hero);
    label(d, g, '恭喜通關！', cx, 50, { size: 44, color: '#ffe066', stroke: '#2a1040', strokeWidth: 7, weight: 900 });
    label(d, g, `${h.name}突破七連戰，擊敗終焉守護者的三段變形，萌友們又能一起玩了！`, cx, 100, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    CHARACTERS.forEach((c, i) => portrait(d, g, this.f[c.key], cx + (i - 3.5) * Math.min(95, W / 8.6), H - 40 - Math.abs(Math.sin(this.t * 4 + i)) * 16, 140));
    if (this.t > 2) label(d, g, '按 Z 回到標題', cx, H - 14, { size: 14, color: '#cccccc' });
  }
}
