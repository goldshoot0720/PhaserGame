import { WIDTH, HEIGHT, METER_MAX, ROUNDS_TO_WIN } from '../config.js';
import { makeText as text } from '../ui.js';

const BAR_W = 500;
const BAR_H = 30;
const BAR_Y = 40;
const MARGIN = 40;
const METER_W = 300;

/** Health bars, super meters, names, timer, round markers, combo counters and banners. */
export class Hud {
  constructor(scene, fighters) {
    this.scene = scene;
    this.fighters = fighters;
    this.g = scene.add.graphics().setDepth(100);
    this.lagHealth = fighters.map((f) => f.def.health);
    fighters.forEach((f, i) => {
      const x = i === 0 ? MARGIN + 70 : WIDTH - MARGIN - 70;
      scene.add.image(i === 0 ? MARGIN + 30 : WIDTH - MARGIN - 30, BAR_Y + 22, f.def.portrait).setDisplaySize(64, 64).setDepth(101).setFlipX(i === 1);
      text(scene, x, BAR_Y + BAR_H + 6, f.def.name, 24).setOrigin(i === 0 ? 0 : 1, 0).setDepth(101);
    });
    this.timer = text(scene, WIDTH / 2, BAR_Y + 14, '99', 52, '#ffe45c').setOrigin(0.5).setDepth(101);
    this.combos = fighters.map((f, i) =>
      text(scene, i === 0 ? 60 : WIDTH - 60, 250, '', 44, '#ffd23f').setOrigin(i === 0 ? 0 : 1, 0.5).setDepth(101).setAlpha(0));
    this.superLabels = fighters.map((f, i) =>
      text(scene, i === 0 ? MARGIN : WIDTH - MARGIN, HEIGHT - 70, '超必殺 OK！', 22, '#7ff5ff').setOrigin(i === 0 ? 0 : 1, 0.5).setDepth(101).setVisible(false));
    this.wins = [0, 0];
  }

  setWins(wins) {
    this.wins = wins;
  }

  setTime(seconds) {
    this.timer.setText(String(Math.max(0, seconds)).padStart(2, '0'));
  }

  showCombo(index, count) {
    if (count < 2) return;
    const t = this.combos[index];
    t.setText(`${count} 連擊！`).setAlpha(1).setScale(1.3);
    this.scene.tweens.killTweensOf(t);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120 });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300 });
  }

  update() {
    const g = this.g;
    g.clear();
    this.fighters.forEach((f, i) => {
      const left = i === 0;
      const x = left ? MARGIN + 70 : WIDTH - MARGIN - 70 - BAR_W;
      const ratio = f.health / f.def.health;
      this.lagHealth[i] = Math.max(f.health, this.lagHealth[i] - f.def.health * 0.004);
      const lagRatio = this.lagHealth[i] / f.def.health;
      g.fillStyle(0x000000, 0.7).fillRect(x - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8);
      g.fillStyle(0x7a0d0d, 1).fillRect(x, BAR_Y, BAR_W, BAR_H);
      // bars drain toward the centre of the screen (the timer)
      const lagW = BAR_W * lagRatio;
      const w = BAR_W * ratio;
      g.fillStyle(0xff4b3a, 1).fillRect(left ? x : x + BAR_W - lagW, BAR_Y, lagW, BAR_H);
      g.fillStyle(ratio > 0.3 ? 0xffd93b : 0xff9f1a, 1).fillRect(left ? x : x + BAR_W - w, BAR_Y, w, BAR_H);
      g.fillStyle(0xffffff, 0.35).fillRect(left ? x : x + BAR_W - w, BAR_Y + 3, w, 6);
      g.lineStyle(3, 0xffffff, 1).strokeRect(x - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4);

      // round wins
      for (let r = 0; r < ROUNDS_TO_WIN; r++) {
        const cx = left ? x + BAR_W - 16 - r * 30 : x + 16 + r * 30;
        g.fillStyle(r < this.wins[i] ? 0xffd23f : 0x333333, 1).fillCircle(cx, BAR_Y + BAR_H + 22, 10);
        g.lineStyle(2, 0xffffff, 1).strokeCircle(cx, BAR_Y + BAR_H + 22, 10);
      }

      // super meter
      const mx = left ? MARGIN : WIDTH - MARGIN - METER_W;
      const my = HEIGHT - 50;
      const m = f.meter / METER_MAX;
      const full = m >= 1;
      g.fillStyle(0x000000, 0.7).fillRect(mx - 3, my - 3, METER_W + 6, 22);
      const pulse = full ? (Math.sin(this.scene.time.now / 90) > 0 ? 0x7ff5ff : 0x2e9bff) : 0x2e7bff;
      g.fillStyle(pulse, 1).fillRect(left ? mx : mx + METER_W * (1 - m), my, METER_W * m, 16);
      g.lineStyle(2, 0xffffff, 1).strokeRect(mx - 1, my - 1, METER_W + 2, 18);
      this.superLabels[i].setVisible(full);
    });
  }

  /** Big genre-style banner text (第一回合 / 開始！ / K.O.). */
  banner(str, { color = '#ffffff', stroke = '#c0161b', size = 110, hold = 900 } = {}) {
    const t = text(this.scene, WIDTH / 2, HEIGHT / 2 - 40, str, size, color, { stroke, strokeThickness: 12 })
      .setOrigin(0.5).setDepth(200).setScale(2.5).setAlpha(0);
    t.setShadow(6, 6, '#000000', 0, true, true);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, scale: 1.3, delay: hold, duration: 250, onComplete: () => t.destroy() });
    return t;
  }
}
