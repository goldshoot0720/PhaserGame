// Match results.
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
    const won = session.winner === 0;
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
    const rs = session.results, top = rs[0], won = session.winner === 0;
    const title = session.winner < 0 ? '平手！不分勝負' : won ? '你贏得水球大作戰！' : `${top?.name ?? ''} 獲得勝利`;
    label(d, g, title, cx, 60, { size: 50, color: won ? '#ffe066' : '#ffffff', stroke: '#1a4a8a', strokeWidth: 9, weight: 900 });
    label(d, g, `共進行 ${session.rounds} 回合`, cx, 108, { size: 22, color: '#ffffff', stroke: '#1a4a8a', strokeWidth: 4 });
    if (top && session.winner >= 0) {
      d.circle(cx - 330, H - 190, 120, '#ffffff', 0.25);
      spriteB(d, g, this.f[top.id], cx - 330, H - 110 - Math.abs(Math.sin(this.t * 5)) * 16, 280);
    }
    panel(d, { x: cx - 170, y: 146, w: 520, h: 30 + rs.length * 76 }, '#1a3a5aee', '#ffffff66');
    rs.forEach((r, i) => {
      const y = 184 + i * 76;
      d.rect(cx - 160, y - 30, 500, 66, r.you ? '#2f6b9f' : '#244a6a');
      d.rect(cx - 160, y - 30, 8, 66, r.color);
      spriteB(d, g, this.f[r.id], cx - 110, y + 32, 62);
      label(d, g, `${r.name}${r.you ? '（你）' : ''}`, cx - 70, y, { size: 22, color: '#ffffff' }, 0, 0.5);
      label(d, g, `${'★'.repeat(r.wins)}${r.wins ? '' : '—'}`, cx + 325, y, { size: 26, color: '#ffe066' }, 1, 0.5);
    });
    this.again = { x: cx - 250, y: H - 80, w: 230, h: 58 };
    this.menu = { x: cx + 20, y: H - 80, w: 230, h: 58 };
    button(d, g, this.again, '再來一場', this.input.pointer, { color: '#e0567f', hover: '#ff7aa0', size: 26 });
    button(d, g, this.menu, '換角色', this.input.pointer, { size: 26 });
  }
}
