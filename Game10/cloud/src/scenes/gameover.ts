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
    const p = this.input.pointer, c = this.click.poll(p);
    if (this.t < 0.8) return;
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    backdrop(d, W, H, this.t);
    const rs = session.results, place = rs.findIndex((r) => r.you) + 1;
    label(d, g, place === 1 ? '勝利！你是最後的坦克王！' : `你是第 ${place} 名`, cx, 56, { size: 50, color: place === 1 ? '#ffe066' : '#ffffff', stroke: '#3a2a6a', strokeWidth: 9, weight: 900 });
    label(d, g, session.reason, cx, 106, { size: 22, color: '#ffffff', stroke: '#1a2a4a', strokeWidth: 4 });
    if (rs[0]) {
      const hs = g.assets.frameSize(this.f.hull), hw = 220, hh = (hs.h / hs.w) * hw, x = cx - 330, y = H - 120;
      spriteB(d, g, this.f[rs[0].id], x, y - 70 - Math.abs(Math.sin(this.t * 5)) * 12, 200);
      d.sprite(this.f.hull, x - hw / 2, y - hh + 10, { w: hw, h: hh, tint: rs[0].color });
    }
    panel(d, { x: cx - 170, y: 146, w: 520, h: 30 + rs.length * 76 }, '#0d1a33ee', '#ffffff55');
    rs.forEach((r, i) => {
      const y = 184 + i * 76;
      d.rect(cx - 160, y - 30, 500, 66, r.you ? '#2f4f7f' : '#16264a');
      d.rect(cx - 160, y - 30, 8, 66, r.color);
      spriteB(d, g, this.f[r.id], cx - 110, y + 32, 62);
      label(d, g, `${i + 1}. ${r.name}${r.you ? '（你）' : ''}`, cx - 70, y - 10, { size: 22, color: '#ffffff' }, 0, 0.5);
      label(d, g, r.alive ? `存活・HP ${Math.round(r.hp)}` : '已被擊毀', cx - 70, y + 18, { size: 15, color: r.alive ? '#8dff9a' : '#ff8a8a' }, 0, 0.5);
      label(d, g, `輸出傷害 ${r.dmg}`, cx + 325, y, { size: 20, color: '#ffe066' }, 1, 0.5);
    });
    this.again = { x: cx - 250, y: H - 80, w: 230, h: 58 };
    this.menu = { x: cx + 20, y: H - 80, w: 230, h: 58 };
    button(d, g, this.again, '再戰一場', this.input.pointer, { color: '#e0567f', hover: '#ff7aa0', size: 26 });
    button(d, g, this.menu, '換駕駛員', this.input.pointer, { size: 26 });
  }
}
