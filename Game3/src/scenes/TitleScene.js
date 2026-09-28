import Phaser from 'phaser';
import { GAME_W, GAME_H, textStyle } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { makeButton, gradientBg } from '../systems/UI.js';
import { Sound } from '../systems/Sound.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.leaving = false;
    gradientBg(this, 0x3fb8ff, 0x1a2a7a);

    // 背景：捲動的賽道條紋
    const road = this.add.graphics();
    road.fillStyle(0x3d4654, 1);
    road.fillRect(0, 560, GAME_W, 160);
    road.fillStyle(0xffffff, 1);
    for (let x = 0; x < GAME_W; x += 56) {
      road.fillStyle(((x / 56) | 0) % 2 === 0 ? 0xffffff : 0xe53945, 1);
      road.fillRect(x, 552, 56, 10);
      road.fillRect(x, 718, 56, 10);
    }
    this.dashes = [];
    for (let i = 0; i < 12; i++) {
      this.dashes.push(this.add.rectangle(i * 120, 640, 60, 6, 0xffe066, 0.7));
    }

    // 泡泡
    for (let i = 0; i < 24; i++) {
      const b = this.add.circle(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, 540),
        Phaser.Math.Between(4, 16), 0xffffff, 0.15);
      this.tweens.add({
        targets: b, y: b.y - 120, alpha: 0, duration: Phaser.Math.Between(3000, 7000),
        repeat: -1, delay: Phaser.Math.Between(0, 4000),
      });
    }

    // 奔馳的卡丁車
    this.runners = CHARACTERS.map((c, i) => {
      const lane = 600 + (i % 3) * 40;
      const body = this.add.image(-100 - i * 180, lane, `kart_${c.id}`).setScale(1.2);
      const head = this.add.image(body.x, lane - 12, `head_${c.id}`).setScale(0.38);
      return { body, head, speed: 180 + Math.random() * 160, lane };
    });

    // 標題
    const title = this.add.text(GAME_W / 2, 118, '鯨喜卡丁車', textStyle(104, '#ffffff', {
      stroke: '#1b2a6b', strokeThickness: 14,
      shadow: { offsetX: 0, offsetY: 8, color: '#0b1026', blur: 0, fill: true, stroke: true },
    })).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: { from: 1, to: 1.04 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
    this.add.text(GAME_W / 2, 200, '～ 萌萌狂飆大賽 ～', textStyle(34, '#ffe066', {
      stroke: '#1b2a6b', strokeThickness: 8,
    })).setOrigin(0.5);

    // 角色頭像列
    CHARACTERS.forEach((c, i) => {
      const x = GAME_W / 2 - 3.5 * 92 + i * 92;
      const img = this.add.image(x, 290, `pcircle_${c.id}`).setScale(0.9);
      this.tweens.add({ targets: img, y: 280, yoyo: true, repeat: -1, duration: 700, delay: i * 110, ease: 'Sine.InOut' });
    });

    // 操作說明
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1026, 0.55);
    panel.fillRoundedRect(GAME_W / 2 - 420, 345, 840, 150, 20);
    panel.lineStyle(2, 0x8fe0ff, 0.8);
    panel.strokeRoundedRect(GAME_W / 2 - 420, 345, 840, 150, 20);
    const lines = [
      ['方向鍵 / WASD', '加速・煞車・轉向'],
      ['Shift', '甩尾（集滿氮氣）'],
      ['Ctrl / 空白鍵', '使用氮氣加速'],
      ['Z / X', '使用道具'],
      ['甩尾放開後按 ↑', '瞬間加速！'],
      ['Esc / P', '暫停'],
    ];
    lines.forEach(([k, d], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_W / 2 - 390 + col * 420;
      const y = 375 + row * 42;
      this.add.text(x, y, k, textStyle(21, '#ffe066')).setOrigin(0, 0.5);
      this.add.text(x + 190, y, d, textStyle(21, '#ffffff')).setOrigin(0, 0.5);
    });

    this.startBtn = makeButton(this, GAME_W / 2, 528, '開始遊戲', () => this.go(), { width: 280, height: 56, size: 28 });
    const hint = this.add.text(GAME_W / 2, 700, '按 Enter 開始', textStyle(18, '#ffffff')).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });

    this.input.keyboard.on('keydown-ENTER', () => this.go());
    this.input.keyboard.on('keydown-SPACE', () => this.go());
    this.input.keyboard.on('keydown', () => Sound.unlock());
    this.input.on('pointerdown', () => Sound.unlock());
    this.cameras.main.fadeIn(300);
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.unlock();
    Sound.select();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelect'));
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const d of this.dashes) {
      d.x -= 300 * dt;
      if (d.x < -60) d.x += 12 * 120;
    }
    for (const r of this.runners) {
      r.body.x += r.speed * dt;
      if (r.body.x > GAME_W + 100) {
        r.body.x = -100 - Math.random() * 400;
        r.speed = 180 + Math.random() * 160;
      }
      r.head.x = r.body.x - 6;
      r.head.y = r.lane - 12 + Math.sin(time / 80 + r.speed) * 1.5;
    }
  }
}
