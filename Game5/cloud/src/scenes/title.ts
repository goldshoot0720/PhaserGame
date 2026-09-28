// Title: choose 1P vs CPU (with difficulty) or 2P versus.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawFighter, type Frames } from '../art.js';
import { label, button, inside, Clicker, type Rect } from '../ui.js';
import { ROSTER, MUSIC } from '../roster.js';
import { session, DIFFS } from '../session.js';

export class Title extends Scene {
  private f!: Frames;
  private t = 0;
  private sel = 0;
  private btns: Rect[] = [];
  private click = new Clicker();
  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.input.bind({ up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], ok: ['Space', 'Enter', 'KeyJ', 'KeyZ'] });
  }
  private choose(i: number): void {
    if (!session.musicOn) { this.sound.music(MUSIC, { loop: true, volume: 0.3 }); session.musicOn = true; }
    if (i === 2) { session.difficulty = (session.difficulty + 1) % 3; this.sound.play({ type: 'square', freq: 660, duration: 0.05, volume: 0.2 }); return; }
    session.mode = i === 0 ? 'cpu' : 'vs';
    this.sound.play({ notes: 'C5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
    this.game.go('select');
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    if (k.up.pressed) this.sel = (this.sel + 2) % 3;
    if (k.down.pressed) this.sel = (this.sel + 1) % 3;
    if (this.sel === 2 && (k.left.pressed || k.right.pressed)) this.choose(2);
    if (k.ok.pressed) this.choose(this.sel);
    const p = this.input.pointer;
    if (this.click.poll(p)) this.btns.forEach((r, i) => { if (inside(p, r)) { this.sel = i; this.choose(i); } });
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.stages[2], W, H, 0.35);
    ROSTER.forEach((r, i) => {
      const left = i < 4, k = i % 4;
      drawFighter(d, g, this.f.fighters[i], left ? 90 + k * 110 : W - 90 - k * 110, H - 20, 230 - k * 12, left ? 1 : -1, r.faceLeft);
    });
    const sz = g.assets.frameSize(this.f.logo), lh = H * 0.3, lw = (sz.w / sz.h) * lh;
    d.sprite(this.f.logo, cx - lw / 2, 20, { w: lw, h: lh });
    label(d, g, '萌友格鬥王', cx, H * 0.46, { size: 60, color: '#fff3a0', stroke: '#6a1010', strokeWidth: 9, weight: 900 });
    const labels = ['單人對戰電腦', '雙人對戰', `電腦難度：${DIFFS[session.difficulty]}`];
    this.btns = labels.map((_, i) => ({ x: cx - 170, y: H * 0.55 + i * 70, w: 340, h: 56 }));
    labels.forEach((l, i) => button(d, g, this.btns[i], l, this.input.pointer, { selected: i === this.sel, size: 26 }));
  }
}
