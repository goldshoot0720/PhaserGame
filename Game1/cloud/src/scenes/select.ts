// Team select: pick 藍鯨隊 or 貓咪隊; the user bats last (home team).
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawStadium, drawChar, type Frames } from '../art.js';
import { label, button, panel, inside, type Rect } from '../ui.js';
import { TEAMS, PLAYERS, PITCH_TYPES } from '../data.js';
import { session } from '../session.js';

export class Select extends Scene {
  private f!: Frames;
  private t = 0;
  private wasDown = false;
  private boxes: { id: 'whale' | 'cat'; r: Rect }[] = [];
  private goBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], go: ['Space', 'Enter'], back: ['Escape'] });
  }

  private confirm(): void {
    this.sound.play({ notes: 'G4 C5 E5 G5:2', step: 0.07, type: 'square', volume: 0.4 });
    this.gotoPlay();
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.left.pressed) session.team = 'whale';
    if (k.right.pressed) session.team = 'cat';
    if (k.go.pressed) this.confirm();
    if (k.back.pressed) this.gotoTitle();
    const p = this.input.pointer;
    const down = !!p?.isDown;
    if (down && !this.wasDown) {
      for (const b of this.boxes) if (inside(p, b.r)) { session.team = b.id; this.sound.play({ type: 'square', freq: 660, duration: 0.06, volume: 0.3 }); }
      if (inside(p, this.goBtn)) this.confirm();
    }
    this.wasDown = down;
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2;
    drawStadium(d, this.f, W, H, 0.55);
    label(d, this.game, '選擇你的球隊', cx, 60, { size: 44, color: '#ffffff', stroke: '#1b2a6b', strokeWidth: 7 });
    const bw = Math.min(560, W * 0.44), bh = 520;
    this.boxes = [];
    (['whale', 'cat'] as const).forEach((id, i) => {
      const team = TEAMS[id];
      const r: Rect = { x: cx + (i === 0 ? -bw - 16 : 16), y: 110, w: bw, h: bh };
      this.boxes.push({ id, r });
      const sel = session.team === id;
      panel(d, r, sel ? team.dark + 'ee' : '#0d1433cc', sel ? '#ffe066' : '#ffffff44');
      label(d, this.game, team.name, r.x + r.w / 2, r.y + 36, { size: 38, color: sel ? '#ffe066' : '#ffffff', stroke: '#000', strokeWidth: 5 });
      const members = [team.pitcher, ...team.lineup.filter((m) => m !== team.pitcher)];
      members.forEach((m, j) => {
        const x = r.x + (r.w / 4) * (j + 0.5);
        const bob = sel ? Math.sin(this.t * 4 + j) * 5 : 0;
        drawChar(d, this.game, this.f.cast[m], x, r.y + 280 + bob, 190);
        const pl = PLAYERS[m];
        label(d, this.game, pl.name, x, r.y + 302, { size: 24, color: '#ffffff' });
        label(d, this.game, m === team.pitcher ? '投手' : `第${team.lineup.indexOf(m) + 1}棒`, x, r.y + 330, { size: 18, color: '#9fd2ff' });
        label(d, this.game, `巧${pl.meet} 力${pl.power}`, x, r.y + 356, { size: 17, color: '#dddddd' });
      });
      const ace = PLAYERS[team.pitcher];
      label(d, this.game, `王牌投手 ${ace.name}｜${ace.velo} km/h｜控球 ${ace.control}`, r.x + r.w / 2, r.y + 410, { size: 20, color: '#ffffff' });
      label(d, this.game, `球種：${ace.pitches.join('、')}`, r.x + r.w / 2, r.y + 440, { size: 20, color: PITCH_TYPES[ace.pitches[1]].color });
      if (sel) label(d, this.game, '▲ 已選擇 ▲', r.x + r.w / 2, r.y + 490, { size: 22, color: '#ffe066' });
    });
    this.goBtn = { x: cx - 150, y: 660, w: 300, h: 66 };
    button(d, this.game, this.goBtn, '比賽開始！', this.input.pointer, { color: '#d9452b', hover: '#ff6a47', size: 30 });
    label(d, this.game, '← → 選擇　Space 確認　Esc 返回', cx, 748, { size: 18, color: '#cccccc' });
  }
}
