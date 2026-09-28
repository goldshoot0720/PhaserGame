import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { GAME_W, GAME_H, textStyle } from '../config.js';
import { generateTextures, generatePortraitVariants } from '../systems/TextureFactory.js';

/** 載入角色圖片並產生程序化貼圖 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const barBg = this.add.rectangle(GAME_W / 2, GAME_H / 2 + 30, 420, 18, 0x223355).setStrokeStyle(2, 0x8fe0ff);
    const bar = this.add.rectangle(GAME_W / 2 - 208, GAME_H / 2 + 30, 4, 12, 0x8fe0ff).setOrigin(0, 0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 - 20, '載入中…', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.load.on('progress', (v) => {
      bar.width = Math.max(4, 416 * v);
    });
    this.load.on('complete', () => barBg.destroy());

    for (const c of CHARACTERS) {
      this.load.image(`portrait_${c.id}`, `assets/characters/portrait_${c.id}.png`);
      this.load.image(`head_${c.id}`, `assets/characters/head_${c.id}.png`);
    }
  }

  create() {
    generateTextures(this);
    generatePortraitVariants(this);
    this.registry.set('mode', 'item');
    this.scene.start('Title');
  }
}
