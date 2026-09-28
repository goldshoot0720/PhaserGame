// Stage select: seven bosses around the hero; the fortress unlocks when all are beaten.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadMenu, frames, cover, portrait } from '../common.js';
import { label, panel, inside, Clicker, type Rect } from '../ui.js';
import { getHero, bossesFor, weaknessFor, FINAL, CITADEL, ART } from '../data.js';
import { Progress, run } from '../progress.js';

export class Stages extends Scene {
  private f: Record<string, number> = {};
  private t = 0;
  private i = 0;
  private slots: { key: string; r: Rect }[] = [];
  private click = new Clicker();
  private note = '';
  override preload(load: Preload): void { preloadMenu(load); }
  override setup(): void {
    this.f = frames(this.game);
    this.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], ok: ['Space', 'Enter', 'KeyZ'], back: ['Escape'], reset: ['KeyR'] });
    this.note = run.outcome === 'win' ? run.message : run.outcome === 'lose' ? 'GAME OVER……再挑戰一次！' : '';
    run.outcome = 'none';
    this.sound.music(ART.stageMusic, { loop: true, volume: 0.22 });
  }
  private keys(): string[] {
    return [...bossesFor(run.hero).map((b) => b.key), 'final'];
  }
  private unlocked(key: string): boolean {
    if (key !== 'final') return true;
    return bossesFor(run.hero).every((b) => Progress.isBeaten(run.hero, b.key));
  }
  private go(key: string): void {
    if (!this.unlocked(key)) { this.note = '先擊敗全部七位頭目！'; this.sound.play({ type: 'square', freq: 200, duration: 0.15, volume: 0.25 }); return; }
    run.stage = key === 'final' && Progress.citadelCheckpoint(run.hero) >= 0 ? 'citadel' : key;
    this.sound.play({ notes: 'C5 E5 G5 C6', step: 0.06, type: 'square', volume: 0.3 });
    this.gotoPlay();
  }
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const k = this.input.keys, n = 8;
    if (k.left.pressed) this.i = (this.i + n - 1) % n;
    if (k.right.pressed) this.i = (this.i + 1) % n;
    if (k.up.pressed) this.i = (this.i + n - 3) % n;
    if (k.down.pressed) this.i = (this.i + 3) % n;
    if (k.ok.pressed) this.go(this.keys()[this.i]);
    if (k.back.pressed) this.game.go('select');
    if (k.reset.pressed) { Progress.reset(run.hero); this.note = '進度已重置'; }
    const p = this.input.pointer;
    if (this.click.poll(p)) this.slots.forEach((s, j) => { if (inside(p, s.r)) { if (this.i === j) this.go(s.key); else this.i = j; } });
  }
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, cx = W / 2, g = this.game;
    const keys = this.keys();
    const sel = keys[this.i];
    cover(d, g, this.f['bg_' + sel], W, H, 0.5);
    label(d, g, 'STAGE SELECT', cx, 20, { size: 22, color: '#ffe066', stroke: '#2a1040', strokeWidth: 5 });
    // 3×3 grid, hero in the centre.
    const cw = 140, ch = 112, gap = 10;
    const gx = cx - (3 * cw + 2 * gap) / 2, gy = 38;
    const order = [0, 1, 2, 3, -1, 4, 5, 6, 7];
    this.slots = [];
    order.forEach((ki, cell) => {
      const r: Rect = { x: gx + (cell % 3) * (cw + gap), y: gy + Math.floor(cell / 3) * (ch + gap), w: cw, h: ch };
      if (ki < 0) {
        panel(d, r, '#1d3a6acc', '#9ff7ff');
        portrait(d, g, this.f[run.hero], r.x + cw / 2, r.y + ch - 6, 100);
        return;
      }
      const key = keys[ki];
      this.slots[ki] = { key, r };
      const isSel = ki === this.i;
      const beaten = key !== 'final' && Progress.isBeaten(run.hero, key);
      const locked = !this.unlocked(key);
      panel(d, r, isSel ? '#3a2a70ee' : '#0d1433cc', isSel ? (Math.floor(this.t * 6) % 2 ? '#ffe066' : '#ffffff') : '#ffffff44');
      if (key === 'final') {
        label(d, g, locked ? '🔒' : '☠', r.x + cw / 2, r.y + 44, { size: 40, color: locked ? '#888888' : '#ff5fd2' });
        label(d, g, Progress.citadelCheckpoint(run.hero) >= 0 ? CITADEL.stage : FINAL.stage, r.x + cw / 2, r.y + ch - 18, { size: 15, color: locked ? '#888888' : '#ffffff' });
      } else {
        const h = getHero(key);
        portrait(d, g, this.f[key], r.x + cw / 2, r.y + ch - 26, 84, { tint: beaten ? '#666666' : undefined });
        label(d, g, h.name, r.x + cw / 2, r.y + ch - 14, { size: 14, color: '#ffffff' });
        if (beaten) label(d, g, '擊敗', r.x + cw / 2, r.y + 40, { size: 22, color: '#ff6b6b', stroke: '#000000', strokeWidth: 4 });
      }
    });
    // Info line.
    let info = '';
    if (sel === 'final') {
      const phase = Progress.citadelCheckpoint(run.hero);
      info = phase >= 0 ? `${CITADEL.stage}：從終焉守護者第 ${phase + 1} 形態續戰` : `${FINAL.stage}：${FINAL.title}（七位頭目連戰）`;
    }
    else {
      const h = getHero(sel), weak = weaknessFor(sel, run.hero);
      const beaten = Progress.isBeaten(run.hero, weak);
      const hint = weak === 'charge' ? '蓄力射擊' : beaten ? getHero(weak).weapon.name : '？？？';
      info = `${h.stage}　頭目：${h.name}　弱點：${hint}`;
    }
    label(d, g, info, cx, H - 34, { size: 15, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    label(d, g, this.note || '方向鍵選擇　Z 出擊　Esc 換英雄　R 重置進度', cx, H - 12, { size: 13, color: this.note ? '#ffe066' : '#cccccc', stroke: '#000000', strokeWidth: 3 });
  }
}
