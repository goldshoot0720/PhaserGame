import Phaser from 'phaser';
import { FONT } from '../ui/common.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const bar = this.add.graphics();
    const label = this.add.text(640, 320, '讀取中…', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (p) => {
      bar.clear();
      bar.fillStyle(0x223355, 1); bar.fillRoundedRect(340, 370, 600, 28, 12);
      bar.fillStyle(0xffc928, 1); bar.fillRoundedRect(340, 370, 600 * p, 28, 12);
      label.setText(`讀取中… ${Math.round(p * 100)}%`);
    });
    for (let i = 1; i <= 8; i++) {
      this.load.image(`head_c${i}`, `assets/heads/c${i}.png`);
      this.load.image(`por_c${i}`, `assets/portraits/c${i}.png`);
    }
  }

  create() {
    this.scene.start('Title');
  }
}
