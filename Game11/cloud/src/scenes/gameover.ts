import { mobilePointer } from '../mobile.js';
// Results.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, menuFrames, backdrop, spriteC } from '../menu.js';
import { label, panel, button, inside, Clicker, type Rect } from '../ui.js';
import { PILOTS, STAGES } from '../rules.js';
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
    this.sound.play(session.won ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
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
    backdrop(d, g, this.f, W, H, this.t);
    const p = PILOTS.find((x) => x.id === session.pilot) ?? PILOTS[0];
    label(d, g, session.won ? '任務完成！兩年戰役全勝！' : 'GAME OVER', cx, 70, { size: 50, color: session.won ? '#ffe066' : '#ff7a9a', stroke: '#1a1050', strokeWidth: 9, weight: 900 });
    spriteC(d, g, this.f[p.id], cx - 260, H / 2 + 20 - Math.abs(Math.sin(this.t * 4)) * 10, 320);
    panel(d, { x: cx - 60, y: 150, w: 420, h: 300 }, '#12143aee', '#ffffff55');
    label(d, g, `${p.name}・${p.shotName}`, cx + 150, 190, { size: 22, color: '#ffffff' });
    label(d, g, '最終得分', cx + 150, 240, { size: 18, color: '#9fc3ff' });
    label(d, g, `${session.score}`, cx + 150, 285, { size: 48, color: '#ffe066', weight: 900 });
    label(d, g, session.score >= session.hi && session.score > 0 ? '★ 新紀錄！' : `最高分 ${session.hi}`, cx + 150, 335, { size: 20, color: session.score >= session.hi ? '#ff7ab0' : '#ffffff' });
    label(d, g, session.won ? '打倒 2026 戰艦與 2027 母艦' : `到達 ${STAGES[session.stage].year} 年・${STAGES[session.stage].name}`, cx + 150, 390, { size: 17, color: '#aac4ff' });
    this.again = { x: cx - 250, y: H - 84, w: 230, h: 58 };
    this.menu = { x: cx + 20, y: H - 84, w: 230, h: 58 };
    button(d, g, this.again, '再次出擊', mobilePointer(this.input.pointer), { color: '#e0567f', hover: '#ff7aa0', size: 26 });
    button(d, g, this.menu, '換飛行員', mobilePointer(this.input.pointer), { size: 26 });
  }
}
