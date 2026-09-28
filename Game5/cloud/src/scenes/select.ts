// Character + stage select for P1 and P2/CPU.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawFighter, type Frames } from '../art.js';
import { label, panel, inside, Clicker, type Rect } from '../ui.js';
import { ROSTER, STAGES, hex } from '../roster.js';
import { MOTIONS } from '../moves.js';
import { session } from '../session.js';

export class Select extends Scene {
  private f!: Frames;
  private t = 0;
  private step: 0 | 1 | 2 = 0;   // 0 = P1 picks, 1 = P2 picks, 2 = stage
  private cur: [number, number] = [0, 1];
  private cards: Rect[] = [];
  private click = new Clicker();
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.cur = [session.p1, session.p2];
    this.input.bind({
      l1: ['KeyA'], r1: ['KeyD'], u1: ['KeyW'], d1: ['KeyS'], ok1: ['KeyJ', 'Space', 'Enter', 'KeyZ'],
      l2: ['ArrowLeft'], r2: ['ArrowRight'], u2: ['ArrowUp'], d2: ['ArrowDown'], ok2: ['Numpad1', 'Comma'], back: ['Escape'],
    });
  }
  private who(): number { return this.step === 1 && session.mode === 'vs' ? 1 : 0; }
  private confirm(): void {
    this.sound.play({ notes: 'E5 A5', step: 0.06, type: 'square', volume: 0.3 });
    if (this.step === 0) {
      session.p1 = this.cur[0];
      if (session.mode === 'cpu') { this.step = 1; this.cur[1] = (session.p1 + 1 + Math.floor(Math.random() * 7)) % 8; }
      else this.step = 1;
    } else if (this.step === 1) { session.p2 = this.cur[1]; this.step = 2; }
    else this.gotoPlay();
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.back.pressed) { if (this.step > 0) this.step = (this.step - 1) as 0 | 1; else this.gotoTitle(); return; }
    if (this.step === 2) {
      if (k.l1.pressed || k.l2.pressed) session.stage = (session.stage + STAGES.length - 1) % STAGES.length;
      if (k.r1.pressed || k.r2.pressed) session.stage = (session.stage + 1) % STAGES.length;
      if (k.ok1.pressed || k.ok2.pressed) this.confirm();
    } else {
      const w = this.who();
      const solo = session.mode === 'cpu';
      const L = w === 0 ? k.l1.pressed || (solo && k.l2.pressed) : k.l2.pressed, R = w === 0 ? k.r1.pressed || (solo && k.r2.pressed) : k.r2.pressed;
      const U = w === 0 ? k.u1.pressed || (solo && k.u2.pressed) : k.u2.pressed, D = w === 0 ? k.d1.pressed || (solo && k.d2.pressed) : k.d2.pressed;
      const ci = this.step === 1 && solo ? 1 : w;
      if (L) this.cur[ci] = (this.cur[ci] + 7) % 8;
      if (R) this.cur[ci] = (this.cur[ci] + 1) % 8;
      if (U || D) this.cur[ci] = (this.cur[ci] + 4) % 8;
      if ((w === 0 && k.ok1.pressed) || (w === 1 && k.ok2.pressed) || (solo && k.ok2.pressed)) this.confirm();
    }
    const p = this.input.pointer;
    if (this.click.poll(p)) {
      if (this.step === 2) this.confirm();
      else this.cards.forEach((r, j) => { if (inside(p, r)) { const ci = this.step === 0 ? 0 : 1; if (this.cur[ci] === j) this.confirm(); else this.cur[ci] = j; } });
    }
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.stages[this.step === 2 ? session.stage : 0], W, H, this.step === 2 ? 0.1 : 0.55);
    if (this.step === 2) {
      label(d, g, `舞台：${STAGES[session.stage].name}`, cx, 60, { size: 44, color: '#ffffff', stroke: '#000000', strokeWidth: 7 });
      label(d, g, '← → 切換舞台　J / Space 開戰！', cx, H - 40, { size: 24, color: '#ffe066', stroke: '#000000', strokeWidth: 5 });
      [session.p1, session.p2].forEach((pi, s) => drawFighter(d, g, this.f.fighters[pi], s === 0 ? W * 0.3 : W * 0.7, H - 90, ROSTER[pi].height, s === 0 ? 1 : -1, ROSTER[pi].faceLeft));
      return;
    }
    const title = this.step === 0 ? '1P 選擇角色' : session.mode === 'cpu' ? '選擇對手（電腦）' : '2P 選擇角色';
    label(d, g, title, cx, 40, { size: 40, color: this.step === 0 ? '#5cc8ff' : '#ff6b6b', stroke: '#000000', strokeWidth: 6 });
    const cw = 120, ch = 130, gx = cx - 2 * (cw + 10);
    this.cards = [];
    ROSTER.forEach((r, j) => {
      const rc: Rect = { x: gx + (j % 4) * (cw + 10), y: 80 + Math.floor(j / 4) * (ch + 10), w: cw, h: ch };
      this.cards.push(rc);
      const s1 = this.cur[0] === j, s2 = this.step >= 1 && this.cur[1] === j;
      panel(d, rc, '#0d1433cc', s1 && s2 ? '#ffe066' : s1 ? '#5cc8ff' : s2 ? '#ff6b6b' : '#ffffff44');
      drawFighter(d, g, this.f.fighters[j], rc.x + cw / 2, rc.y + ch - 20, 100, 1, r.faceLeft);
      label(d, g, r.name, rc.x + cw / 2, rc.y + ch - 10, { size: 16, color: '#ffffff' });
    });
    // Big previews.
    const show = (idx: number, side: number): void => {
      const r = ROSTER[idx];
      const x = side === 0 ? W * 0.13 : W * 0.87;
      drawFighter(d, g, this.f.fighters[idx], x, H - 150, r.height * 1.1, side === 0 ? 1 : -1, r.faceLeft);
      label(d, g, `${r.name}｜${r.title}`, x, H - 126, { size: 24, color: hex(r.color), stroke: '#000000', strokeWidth: 5 });
    };
    show(this.cur[0], 0);
    if (this.step >= 1) show(this.cur[1], 1);
    const r = ROSTER[this.cur[this.step === 0 ? 0 : 1]];
    panel(d, { x: cx - 330, y: 380, w: 660, h: 150 });
    label(d, g, r.desc, cx, 410, { size: 20, color: '#ffffff', maxWidth: 620 });
    const mo = r.special.motion ? `${MOTIONS[r.special.motion].label}+${r.special.button === 'P' ? '拳' : '腳'}` : '';
    label(d, g, `必殺技「${r.special.name}」${mo}（捷徑鍵 L/B）`, cx, 460, { size: 19, color: '#ffe066' });
    label(d, g, `超必殺「${r.super.name}」${MOTIONS.super.label}+拳腳（滿氣，O/N）`, cx, 496, { size: 19, color: '#5cffb0' });
    label(d, g, session.mode === 'vs' && this.step === 1 ? '2P：方向鍵選擇　, 或 Numpad1 確認' : '方向鍵 / WASD 選擇　J / Space 確認　Esc 返回', cx, H - 24, { size: 18, color: '#cccccc', stroke: '#000000', strokeWidth: 3 });
  }
}
