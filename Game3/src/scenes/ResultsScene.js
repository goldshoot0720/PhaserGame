import Phaser from 'phaser';
import { GAME_W, GAME_H, textStyle, formatTime, hexStr } from '../config.js';
import { getCharacter } from '../data/characters.js';
import { makeButton, gradientBg } from '../systems/UI.js';
import { Sound } from '../systems/Sound.js';
import { getRecords } from '../systems/Storage.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  init(data) {
    this.data_ = data;
  }

  create() {
    this.leaving = false;
    const d = this.data_;
    gradientBg(this, 0xff8fb1, 0x3b2a8f);

    const player = d.standings.find((s) => s.isPlayer);
    const rank = player ? player.rank : 8;
    const headline = rank === 1 ? '冠軍！' : rank <= 3 ? `第 ${rank} 名！好厲害！` : `第 ${rank} 名　再接再厲！`;
    this.add.text(GAME_W / 2, 48, `${d.trackName}・比賽結果`, textStyle(26, '#ffffff', { stroke: '#1b2a6b', strokeThickness: 5 })).setOrigin(0.5);
    const hl = this.add.text(GAME_W / 2, 100, headline, textStyle(54, '#ffe066', { stroke: '#1b2a6b', strokeThickness: 10 })).setOrigin(0.5);
    this.tweens.add({ targets: hl, scale: { from: 0.4, to: 1 }, duration: 500, ease: 'Back.Out' });

    // 左：大頭像
    if (player) {
      const ch = getCharacter(player.charId);
      const img = this.add.image(220, 330, `pround_${ch.id}`).setScale(1.05);
      this.tweens.add({ targets: img, y: 320, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
      this.add.text(220, 480, ch.name, textStyle(28, '#ffffff', { stroke: '#000', strokeThickness: 5 })).setOrigin(0.5);
      const laps = (d.playerLaps || []).map((t, i) => `第${i + 1}圈  ${formatTime(t)}`).join('\n');
      this.add.text(220, 520, laps, textStyle(18, '#ffffff', { align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
      const rec = getRecords(d.trackId);
      const recLines = [];
      if (d.records.newLap) recLines.push('★ 新的最佳單圈紀錄！');
      if (d.records.newRace) recLines.push('★ 新的最佳總時間紀錄！');
      recLines.push(`紀錄：單圈 ${formatTime(rec.bestLap)}`);
      const rt = this.add.text(220, 620, recLines.join('\n'), textStyle(17, '#fff3bf', { align: 'center' })).setOrigin(0.5, 0);
      if (d.records.newLap || d.records.newRace) {
        this.tweens.add({ targets: rt, alpha: 0.5, yoyo: true, repeat: -1, duration: 500 });
      }
    }

    // 右：名次表
    const tx = 440;
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1026, 0.55);
    panel.fillRoundedRect(tx, 150, 800, 460, 20);
    this.add.text(tx + 30, 170, '名次', textStyle(18, '#cdd8ff'));
    this.add.text(tx + 150, 170, '選手', textStyle(18, '#cdd8ff'));
    this.add.text(tx + 520, 170, '總時間', textStyle(18, '#cdd8ff'));
    this.add.text(tx + 680, 170, '最佳單圈', textStyle(18, '#cdd8ff'));
    d.standings.forEach((s, i) => {
      const y = 222 + i * 48;
      const row = this.add.container(tx + 900, y);
      const bg = this.add.graphics();
      bg.fillStyle(s.isPlayer ? 0xffe066 : 0xffffff, s.isPlayer ? 0.35 : i % 2 ? 0.05 : 0.1);
      bg.fillRoundedRect(10, -21, 780, 42, 10);
      const medal = ['#ffd43b', '#dee2e6', '#e8a86b'][i] || '#ffffff';
      const r = this.add.text(50, 0, `${i + 1}`, textStyle(26, medal, { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5);
      const img = this.add.image(110, 0, `pcircle_${s.charId}`).setScale(0.42);
      const nm = this.add.text(140, 0, s.name + (s.isPlayer ? '（你）' : ''), textStyle(20, s.isPlayer ? '#ffe066' : '#ffffff')).setOrigin(0, 0.5);
      const tm = this.add.text(520, 0, s.finished ? formatTime(s.time) : '未完成', textStyle(20, s.finished ? '#ffffff' : '#adb5bd')).setOrigin(0, 0.5);
      const bl = this.add.text(680, 0, s.bestLap ? formatTime(s.bestLap) : '--', textStyle(18, '#a5f3fc')).setOrigin(0, 0.5);
      row.add([bg, r, img, nm, tm, bl]);
      this.tweens.add({ targets: row, x: tx, duration: 400, delay: 150 + i * 90, ease: 'Cubic.Out' });
    });

    makeButton(this, 640, 665, '再玩一次 (Enter)', () => this.retry(), { width: 280, height: 54, size: 24 });
    makeButton(this, 940, 665, '返回主選單 (Esc)', () => this.menu(), { width: 280, height: 54, size: 24, color: 0x5c6bc0 });
    makeButton(this, 1180, 665, '換賽道', () => this.changeTrack(), { width: 150, height: 54, size: 22, color: 0x7048e8 });

    this.input.keyboard.on('keydown-ENTER', () => this.retry());
    this.input.keyboard.on('keydown-ESC', () => this.menu());

    // 彩帶
    if (rank <= 3) {
      const e = this.add.particles(0, 0, 'confetti', {
        x: { min: 0, max: GAME_W }, y: -10, lifespan: 4000, speedY: { min: 120, max: 260 },
        speedX: { min: -60, max: 60 }, rotate: { min: 0, max: 360 }, frequency: 40,
        tint: [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8], scale: { min: 0.8, max: 1.4 },
      });
      e.setDepth(50);
      this.time.delayedCall(3500, () => e.stop());
    }
    this.cameras.main.fadeIn(400);
    Sound.unlock();
  }

  retry() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.select();
    this.scene.start('Race', { trackId: this.data_.trackId, charId: this.data_.charId, mode: this.data_.mode });
  }

  menu() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Title');
  }

  changeTrack() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('TrackSelect');
  }
}
