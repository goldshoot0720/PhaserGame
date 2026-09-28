// Results scoreboard.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { FIGHTERS } from '../data.js';
import { session } from '../session.js';

export class GameOver extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private click = new Clicker();
  private again: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private menu: Rect = { x: 0, y: 0, w: 0, h: 0 };
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void {
    this.f = menuFrames(this.game);
    this.input.bind({ again: ['Space', 'Enter'], menu: ['Escape'] });
    const won = session.stats[0]?.you;
    this.sound.play(won ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = this.input.pointer, c = this.click.poll(p);
    if (this.t < 0.8) return;
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    const st = session.stats;
    const place = st.findIndex((s) => s.you) + 1;
    label(d, g, place === 1 ? '冠軍！你是大亂鬥之王！' : `第 ${place} 名`, cx, 60, { size: 54, color: place === 1 ? '#ffe066' : '#ffffff', stroke: '#6b2a8a', strokeWidth: 9, weight: 900 });
    label(d, g, session.reason, cx, 112, { size: 22, color: '#ffffff', stroke: '#2a2140', strokeWidth: 4 });
    if (st[0]) spriteB(d, g, this.f[st[0].id], cx - 330, H - 120 - Math.abs(Math.sin(this.t * 5)) * 16, 280);
    panel(d, { x: cx - 160, y: 150, w: 480, h: 40 + st.length * 44 }, '#2a2140ee', '#ffffff55');
    st.forEach((s, i) => {
      const y = 190 + i * 44, fi = FIGHTERS.find((x) => x.id === s.id)!;
      spriteB(d, g, this.f[s.id], cx - 120, y + 18, 38);
      label(d, g, `${i + 1}. ${fi.name}${s.you ? '（你）' : ''}`, cx - 90, y, { size: 20, color: s.you ? '#39c6ff' : '#ffffff' }, 0, 0.5);
      label(d, g, `${s.kills} 殺　${s.deaths} 死`, cx + 300, y, { size: 20, color: '#ffe8a0' }, 1, 0.5);
    });
    this.again = { x: cx - 250, y: H - 84, w: 230, h: 60 };
    this.menu = { x: cx + 20, y: H - 84, w: 230, h: 60 };
    button(d, g, this.again, '再戰一場', this.input.pointer, { color: '#d9458b', hover: '#ff6aa8', size: 26 });
    button(d, g, this.menu, '換角色', this.input.pointer, { size: 26 });
  }
}
