import { mobilePointer } from '../mobile.js';
// Result screen: line score, winner, replay.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawStadium, drawChar, type Frames } from '../art.js';
import { label, panel, button, inside, type Rect } from '../ui.js';
import { session } from '../session.js';
import type { GameState } from '../rules.js';

export class GameOver extends Scene {
  private f!: Frames;
  private gs: GameState | null = null;
  private t = 0;
  private wasDown = false;
  private again: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private menu: Rect = { x: 0, y: 0, w: 0, h: 0 };

  override preload(load: Preload): void { preloadArt(load); }

  override setup(result?: unknown): void {
    this.f = registerArt(this.game);
    this.gs = (result as { state?: GameState } | undefined)?.state ?? session.last;
    this.input.bind({ again: ['Space', 'Enter'], menu: ['Escape'] });
    const won = this.userWon();
    this.sound.play(won ? { notes: 'C5 E5 G5 C6 G5 C6:3', step: 0.1, type: 'square', volume: 0.4 } : { notes: 'G4 F4 E4 D4 C4:3', step: 0.14, type: 'triangle', volume: 0.4 });
  }

  private userWon(): boolean {
    const gs = this.gs;
    if (!gs) return false;
    const w = gs.winner();
    return w !== 'tie' && (w === 'home' ? gs.home : gs.away).id === session.team;
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const p = mobilePointer(this.input.pointer);
    const down = !!p?.isDown;
    if (this.input.keys.again.pressed || (down && !this.wasDown && inside(p, this.again))) this.gotoPlay();
    else if (this.input.keys.menu.pressed || (down && !this.wasDown && inside(p, this.menu))) this.gotoTitle();
    this.wasDown = down;
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    drawStadium(d, this.f, W, H, 0.5);
    const gs = this.gs;
    if (!gs) return;
    const w = gs.winner();
    const won = this.userWon();
    const head = w === 'tie' ? '平手！' : won ? '比賽獲勝！' : '惜敗……';
    label(d, g, head, cx, 90, { size: 72, color: won ? '#ffe066' : '#ffffff', stroke: '#1b2a6b', strokeWidth: 9, weight: 900 });
    const winTeam = w === 'tie' ? null : w === 'home' ? gs.home : gs.away;
    if (winTeam) {
      const members = [winTeam.pitcher, ...winTeam.lineup.filter((m) => m !== winTeam.pitcher)];
      members.forEach((m, i) => drawChar(d, g, this.f.cast[m], cx + (i - 1.5) * 130, 420 + Math.abs(Math.sin(this.t * 5 + i)) * -18, 190));
    }
    // Line score.
    const cols = Math.max(gs.line.away.length, gs.line.home.length, gs.innings);
    const cw = 52, tw = 200 + cols * cw + 2 * cw + 20;
    const x0 = cx - tw / 2, y0 = 470;
    panel(d, { x: x0, y: y0, w: tw, h: 130 });
    for (let i = 0; i < cols; i++) label(d, g, String(i + 1), x0 + 200 + i * cw + cw / 2, y0 + 24, { size: 20, color: '#9fd2ff' });
    label(d, g, 'R', x0 + 200 + cols * cw + cw / 2, y0 + 24, { size: 20, color: '#ffe066' });
    label(d, g, 'H', x0 + 200 + (cols + 1) * cw + cw / 2, y0 + 24, { size: 20, color: '#9fd2ff' });
    (['away', 'home'] as const).forEach((side, r) => {
      const y = y0 + 64 + r * 40;
      const team = side === 'away' ? gs.away : gs.home;
      d.rect(x0 + 14, y - 13, 8, 26, team.color);
      label(d, g, team.name, x0 + 30, y, { size: 22, color: '#ffffff' }, 0, 0.5);
      for (let i = 0; i < cols; i++) {
        const v = gs.line[side][i];
        label(d, g, v === undefined ? (side === 'home' && i === gs.innings - 1 ? 'X' : '-') : String(v), x0 + 200 + i * cw + cw / 2, y, { size: 22, color: '#ffffff' });
      }
      label(d, g, String(gs.runs[side]), x0 + 200 + cols * cw + cw / 2, y, { size: 26, color: '#ffe066' });
      label(d, g, String(gs.hits[side]), x0 + 200 + (cols + 1) * cw + cw / 2, y, { size: 22, color: '#ffffff' });
    });
    this.again = { x: cx - 250, y: 640, w: 230, h: 62 };
    this.menu = { x: cx + 20, y: 640, w: 230, h: 62 };
    button(d, g, this.again, '再比一場', mobilePointer(this.input.pointer), { color: '#d9452b', hover: '#ff6a47', size: 28 });
    button(d, g, this.menu, '回到標題', mobilePointer(this.input.pointer), { size: 28 });
  }
}
