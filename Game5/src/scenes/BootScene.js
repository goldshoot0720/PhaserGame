import Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES } from '../objects/Stage.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const bar = this.add.graphics();
    this.add.text(WIDTH / 2, HEIGHT / 2 - 40, '載入中…', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (v) => {
      bar.clear().fillStyle(0xffd23f, 1).fillRect(WIDTH / 2 - 200, HEIGHT / 2, 400 * v, 16);
      bar.lineStyle(2, 0xffffff, 1).strokeRect(WIDTH / 2 - 200, HEIGHT / 2, 400, 16);
    });
    for (const c of CHARACTERS) {
      this.load.image(c.texture, `fighters/${c.texture}.png`);
      this.load.image(c.portrait, `portraits/${c.portrait}.png`);
    }
    for (const s of STAGES) if (s.image) this.load.image(s.image, `stages/${s.image}.jpg`);
  }

  create() {
    this.scene.start('Title');
  }
}
