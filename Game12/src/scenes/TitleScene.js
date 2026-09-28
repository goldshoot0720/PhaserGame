import Phaser from 'phaser';
import { CHARACTERS, preloadCharacters } from './characters.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  preload() { preloadCharacters(this); }

  create() {
    this.selected = 0;
    this.cards = [];
    const g = this.add.graphics();
    g.fillGradientStyle(0x16385e, 0x16385e, 0x0f1935, 0x0f1935);
    g.fillRect(0, 0, 1100, 760);
    for (let i = 0; i < 42; i++) {
      const x = (i * 173 + 37) % 1100;
      const y = (i * 263 + 83) % 760;
      this.add.circle(x, y, 3 + (i % 5) * 2, 0x8cd8ef, 0.08 + (i % 3) * 0.04);
    }
    this.add.text(550, 60, '水球大作戰', { fontFamily: 'Arial, sans-serif', fontSize: '62px', fontStyle: 'bold', color: '#fff7db', stroke: '#134977', strokeThickness: 9 }).setOrigin(0.5);
    this.add.text(550, 121, '選擇角色，躲開水球，成為最後的贏家！', { fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#d4e8ff' }).setOrigin(0.5);

    CHARACTERS.forEach((character, index) => {
      const x = 145 + (index % 4) * 270;
      const y = 230 + Math.floor(index / 4) * 205;
      const bg = this.add.rectangle(x, y, 230, 174, 0x203f65, 0.95).setStrokeStyle(2, 0x5c8fb7);
      const portrait = this.add.image(x, y - 17, character.key).setDisplaySize(96, 125);
      const label = this.add.text(x, y + 71, character.name, { fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const hit = this.add.zone(x, y, 230, 174).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.select(index));
      hit.on('pointerdown', () => this.startGame(index));
      this.cards.push({ bg, portrait, label });
    });
    this.select(0);
    const button = this.add.rectangle(550, 665, 270, 64, 0xf5b942).setStrokeStyle(3, 0xffe9a2).setInteractive({ useHandCursor: true });
    this.add.text(550, 665, '開始對戰  ▶', { fontFamily: 'Arial, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#24314c' }).setOrigin(0.5);
    button.on('pointerdown', () => this.startGame(this.selected));
    this.add.text(550, 725, '方向鍵 / WASD 移動　・　空白鍵 放水球　・　手機可用畫面按鈕', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#abc9e7' }).setOrigin(0.5);
    this.input.keyboard.on('keydown-LEFT', () => this.select((this.selected + 7) % 8));
    this.input.keyboard.on('keydown-RIGHT', () => this.select((this.selected + 1) % 8));
    this.input.keyboard.on('keydown-UP', () => this.select((this.selected + 4) % 8));
    this.input.keyboard.on('keydown-DOWN', () => this.select((this.selected + 4) % 8));
    this.input.keyboard.on('keydown-ENTER', () => this.startGame(this.selected));
  }

  select(index) {
    this.selected = index;
    this.cards.forEach(({ bg, portrait, label }, i) => {
      const active = i === index;
      bg.setFillStyle(active ? 0x366b88 : 0x203f65, 0.98).setStrokeStyle(active ? 4 : 2, active ? 0xffd36b : 0x5c8fb7);
      portrait.setDisplaySize(active ? 100 : 96, active ? 130 : 125);
      label.setColor(active ? '#ffdf77' : '#ffffff');
    });
  }

  startGame(index) { this.scene.start('Arena', { character: index }); }
}
