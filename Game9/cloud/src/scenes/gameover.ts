import { mobilePointer } from '../mobile.js';
// Final standings.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteB } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
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
    const won = session.results[0]?.you;
    this.sound.play(won ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = mobilePointer(this.input.pointer), c = this.click.poll(p);
    if (this.t < 0.8) return;
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    const rs = session.results, place = rs.findIndex((r) => r.you) + 1;
    label(d, g, place === 1 ? '恭喜！你是萌友小鎮首富！' : `你獲得第 ${place} 名`, cx, 58, { size: 50, color: place === 1 ? '#ffe066' : '#ffffff', stroke: '#5a2a6a', strokeWidth: 9, weight: 900 });
    label(d, g, session.reason, cx, 108, { size: 22, color: '#ffffff', stroke: '#123049', strokeWidth: 4 });
    if (rs[0]) {
      d.circle(cx - 330, H - 150, 120, '#ffd44a', 0.25);
      spriteB(d, g, this.f[rs[0].id], cx - 330, H - 110 - Math.abs(Math.sin(this.t * 5)) * 16, 280);
      label(d, g, '★ 首富 ★', cx - 330, H - 90, { size: 26, color: '#ffe066', stroke: '#123049', strokeWidth: 5 });
    }
    panel(d, { x: cx - 170, y: 146, w: 520, h: 30 + rs.length * 76 }, '#0d2438ee', '#ffffff55');
    rs.forEach((r, i) => {
      const y = 184 + i * 76;
      d.rect(cx - 160, y - 30, 500, 66, r.you ? '#2f6b8f' : '#173a57');
      d.rect(cx - 160, y - 30, 8, 66, r.color);
      spriteB(d, g, this.f[r.id], cx - 110, y + 32, 62);
      label(d, g, `${i + 1}. ${r.name}${r.you ? '（你）' : ''}`, cx - 70, y - 10, { size: 22, color: '#ffffff' }, 0, 0.5);
      label(d, g, r.alive ? `地產 ${r.props} 塊` : '已破產', cx - 70, y + 18, { size: 15, color: r.alive ? '#bfe6ff' : '#ff8a8a' }, 0, 0.5);
      label(d, g, `$${r.worth}`, cx + 325, y, { size: 26, color: '#ffe066' }, 1, 0.5);
    });
    this.again = { x: cx - 250, y: H - 80, w: 230, h: 58 };
    this.menu = { x: cx + 20, y: H - 80, w: 230, h: 58 };
    button(d, g, this.again, '再玩一局', mobilePointer(this.input.pointer), { color: '#e0567f', hover: '#ff7aa0', size: 26 });
    button(d, g, this.menu, '換角色', mobilePointer(this.input.pointer), { size: 26 });
  }
}
