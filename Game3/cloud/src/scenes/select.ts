// Pick a racer, then a track.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawBottom, cover, type Frames } from '../art.js';
import { label, panel, button, inside, Clicker, fmtTime, type Rect } from '../ui.js';
import { RACERS, TRACKS } from '../data.js';
import { session, loadBest } from '../session.js';

export class Select extends Scene {
  private f!: Frames;
  private t = 0;
  private step: 'racer' | 'track' = 'racer';
  private ri = 0;
  private ti = 0;
  private cards: Rect[] = [];
  private go: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private click = new Clicker();

  override preload(load: Preload): void { preloadArt(load); }
  override setup(): void {
    this.f = registerArt(this.game);
    this.ri = Math.max(0, RACERS.findIndex((r) => r.id === session.racer));
    this.ti = session.track;
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter'], back: ['Escape'] });
  }

  private confirm(): void {
    this.sound.play({ notes: 'G5 C6', step: 0.06, type: 'square', volume: 0.3 });
    if (this.step === 'racer') { session.racer = RACERS[this.ri].id; this.step = 'track'; }
    else { session.track = this.ti; this.game.go('race'); }
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys;
    const n = this.step === 'racer' ? 8 : 3;
    let i = this.step === 'racer' ? this.ri : this.ti;
    if (k.left.pressed) i = (i + n - 1) % n;
    if (k.right.pressed) i = (i + 1) % n;
    if (this.step === 'racer' && (k.up.pressed || k.down.pressed)) i = (i + 4) % 8;
    if (this.step === 'racer') this.ri = i; else this.ti = i;
    if (k.ok.pressed) this.confirm();
    if (k.back.pressed) { if (this.step === 'track') this.step = 'racer'; else this.gotoTitle(); }
    const p = this.input.pointer;
    if (this.click.poll(p)) {
      this.cards.forEach((r, j) => { if (inside(p, r)) { if (this.step === 'racer') { if (this.ri === j) this.confirm(); else this.ri = j; } else { if (this.ti === j) this.confirm(); else this.ti = j; } } });
      if (inside(p, this.go)) this.confirm();
    }
  }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    cover(d, g, this.f.sky[this.step === 'track' ? this.ti : 0], W, H, 0.55);
    this.cards = [];
    if (this.step === 'racer') {
      label(d, g, '選擇車手', cx, 44, { size: 42, color: '#ffffff', stroke: '#3a1250', strokeWidth: 7 });
      const cw = Math.min(260, (W - 80) / 4 - 16), ch = 270;
      RACERS.forEach((r, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const rc: Rect = { x: cx - 2 * (cw + 16) + 8 + col * (cw + 16), y: 84 + row * (ch + 14), w: cw, h: ch };
        this.cards.push(rc);
        const sel = i === this.ri;
        panel(d, rc, sel ? '#3a2a70ee' : '#0d1433cc', sel ? '#ffe066' : '#ffffff44');
        drawBottom(d, g, this.f.kart[r.id], rc.x + cw / 2, rc.y + 170 + (sel ? Math.sin(this.t * 8) * 3 : 0), 150);
        label(d, g, `${r.name}｜${r.title}`, rc.x + cw / 2, rc.y + 190, { size: 19, color: '#ffffff' });
        const bars: [string, number][] = [['極速', r.speed], ['加速', r.accel], ['操控', r.handling]];
        bars.forEach(([nm, v], j) => {
          const y = rc.y + 216 + j * 18;
          label(d, g, nm, rc.x + 40, y, { size: 14, color: '#cccccc' });
          d.rect(rc.x + 64, y - 5, cw - 84, 10, '#ffffff22');
          d.rect(rc.x + 64, y - 5, (cw - 84) * ((v - 0.85) / 0.3), 10, v >= 1.05 ? '#ff9a3c' : '#5cc8ff');
        });
      });
    } else {
      label(d, g, '選擇賽道', cx, 44, { size: 42, color: '#ffffff', stroke: '#3a1250', strokeWidth: 7 });
      const cw = Math.min(360, (W - 80) / 3 - 20), ch = 440;
      TRACKS.forEach((tr, i) => {
        const rc: Rect = { x: cx - 1.5 * (cw + 20) + 10 + i * (cw + 20), y: 100, w: cw, h: ch };
        this.cards.push(rc);
        const sel = i === this.ti;
        panel(d, rc, sel ? '#3a2a70ee' : '#0d1433cc', sel ? '#ffe066' : '#ffffff44');
        const sky = this.f.sky[i], sz = g.assets.frameSize(sky);
        d.sprite(sky, rc.x + 10, rc.y + 10, { w: cw - 20, h: ((cw - 20) * sz.h) / sz.w });
        label(d, g, tr.name, rc.x + cw / 2, rc.y + 270, { size: 32, color: sel ? '#ffe066' : '#ffffff' });
        label(d, g, tr.subtitle, rc.x + cw / 2, rc.y + 312, { size: 18, color: '#9fe3ff' });
        label(d, g, tr.grip < 0.9 ? '路面滑：提早漂移！' : '抓地力良好', rc.x + cw / 2, rc.y + 346, { size: 16, color: '#dddddd' });
        const best = loadBest(i);
        label(d, g, best ? `最佳時間 ${fmtTime(best)}` : '尚無紀錄', rc.x + cw / 2, rc.y + 390, { size: 18, color: '#ffffff' });
      });
    }
    this.go = { x: cx - 150, y: H - 84, w: 300, h: 58 };
    button(d, g, this.go, this.step === 'racer' ? '決定車手' : '出發！', this.input.pointer, { color: '#d9452b', hover: '#ff6a47', size: 28 });
    label(d, g, '方向鍵選擇　Space 確認　Esc 返回', cx, H - 12, { size: 16, color: '#dddddd' });
  }
}
