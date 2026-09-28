import { mobilePointer } from '../mobile.js';
// Results: finishing order and times.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawBottom, cover, type Frames } from '../art.js';
import { label, panel, button, inside, Clicker, fmtTime, type Rect } from '../ui.js';
import { RACERS, TRACKS } from '../data.js';
import { session } from '../session.js';

export class GameOver extends Scene {
  private f!: Frames;
  private t = 0;
  private click = new Clicker();
  private again: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private menu: Rect = { x: 0, y: 0, w: 0, h: 0 };

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ again: ['Space', 'Enter'], menu: ['Escape'] });
    const p = session.result?.place ?? 7;
    this.sound.play(p < 3 ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = mobilePointer(this.input.pointer), c = this.click.poll(p);
    if (this.input.keys.again.pressed || (c && inside(p, this.again))) this.game.go('race');
    else if (this.input.keys.menu.pressed || (c && inside(p, this.menu))) this.game.go('select');
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    const r = session.result;
    cover(d, g, this.f.sky[r?.track ?? 0], W, H, 0.55);
    if (!r) return;
    const medal = ['冠軍！', '亞軍！', '季軍！'][r.place] ?? `第 ${r.place + 1} 名`;
    label(d, g, `${TRACKS[r.track].name}　${medal}`, cx, 64, { size: 56, color: r.place === 0 ? '#ffe066' : '#ffffff', stroke: '#3a1250', strokeWidth: 8, weight: 900 });
    label(d, g, `你的時間 ${fmtTime(r.time)}　最佳 ${fmtTime(r.best)}`, cx, 120, { size: 24, color: '#9fe3ff' });
    // Podium.
    const pod = [1, 0, 2];
    pod.forEach((pi, j) => {
      const e = r.order[pi];
      if (!e) return;
      const x = cx + (j - 1) * 170, h = [110, 150, 80][j];
      d.rect(x - 70, 420 - h, 140, h, ['#c0c0c0', '#ffd23f', '#cd7f32'][j]);
      label(d, g, String(pi + 1), x, 420 - h / 2, { size: 40, color: '#3a2400' });
      drawBottom(d, g, this.f.kart[e.id], x, 420 - h + Math.sin(this.t * 6 + j) * 3, 130);
    });
    panel(d, { x: cx - 260, y: 440, w: 520, h: 200 });
    r.order.forEach((e, i) => {
      const col = i < 4 ? 0 : 1, row = i % 4;
      const x = cx - 250 + col * 260, y = 466 + row * 44;
      const rc = RACERS.find((q) => q.id === e.id)!;
      label(d, g, `${i + 1}. ${rc.name}${e.you ? '（你）' : ''}`, x + 10, y, { size: 20, color: e.you ? '#ffe066' : '#ffffff' }, 0, 0.5);
      label(d, g, fmtTime(e.time), x + 240, y, { size: 18, color: '#cccccc' }, 1, 0.5);
    });
    this.again = { x: cx - 250, y: H - 104, w: 230, h: 60 };
    this.menu = { x: cx + 20, y: H - 104, w: 230, h: 60 };
    button(d, g, this.again, '再跑一次', mobilePointer(this.input.pointer), { color: '#d9452b', hover: '#ff6a47', size: 26 });
    button(d, g, this.menu, '更換車手/賽道', mobilePointer(this.input.pointer), { size: 24 });
  }
}
