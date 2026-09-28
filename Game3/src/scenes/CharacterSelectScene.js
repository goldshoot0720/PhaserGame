import Phaser from 'phaser';
import { GAME_W, GAME_H, textStyle, hexStr } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { makeButton, gradientBg, statBar } from '../systems/UI.js';
import { Sound } from '../systems/Sound.js';

const STAT_LABELS = [
  ['speed', '極速', 0xff6b6b],
  ['accel', '加速', 0xffd43b],
  ['handling', '操控', 0x51cf66],
  ['drift', '甩尾', 0x4dabf7],
];

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    this.leaving = false;
    gradientBg(this, 0x5b3fd1, 0x10163f);
    this.add.text(40, 36, '選擇角色', textStyle(44, '#ffffff', { stroke: '#1b2a6b', strokeThickness: 8 })).setOrigin(0, 0.5);
    this.add.text(250, 40, '← → ↑ ↓ 選擇　Enter 確定　Esc 返回', textStyle(18, '#cdd8ff')).setOrigin(0, 0.5);

    const prev = this.registry.get('playerChar');
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === prev));

    // 卡片
    this.cards = CHARACTERS.map((c, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 128 + col * 180;
      const y = 200 + row * 240;
      const cont = this.add.container(x, y);
      const frame = this.add.graphics();
      const img = this.add.image(0, -18, `pround_${c.id}`).setScale(0.6);
      const name = this.add.text(0, 95, c.name, textStyle(19, '#ffffff')).setOrigin(0.5);
      cont.add([frame, img, name]);
      cont.setSize(166, 226);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerdown', () => {
        Sound.unlock();
        if (this.index === i) this.confirm();
        else this.select(i);
      });
      cont.on('pointerover', () => { if (this.index !== i) cont.setScale(1.03); });
      cont.on('pointerout', () => { if (this.index !== i) cont.setScale(1); });
      cont.frame = frame;
      cont.char = c;
      return cont;
    });

    // 詳細面板
    const px = 800;
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1026, 0.6);
    panel.fillRoundedRect(px, 80, 440, 560, 24);
    panel.lineStyle(2, 0xffffff, 0.5);
    panel.strokeRoundedRect(px, 80, 440, 560, 24);
    this.bigPortrait = this.add.image(px + 110, 200, 'pround_whale').setScale(0.72);
    this.nameText = this.add.text(px + 220, 130, '', textStyle(30, '#ffffff')).setOrigin(0, 0.5);
    this.titleText = this.add.text(px + 220, 172, '', textStyle(20, '#ffe066')).setOrigin(0, 0.5);
    this.kartPreview = this.add.image(px + 320, 250, 'kart_whale').setScale(1.6);
    this.kartHead = this.add.image(px + 312, 238, 'head_whale').setScale(0.5);
    this.descText = this.add.text(px + 30, 320, '', textStyle(19, '#dfe8ff', { wordWrap: { width: 380, useAdvancedWrap: true } }));
    this.bars = STAT_LABELS.map(([key, label, col], i) => {
      const b = statBar(this, px + 40, 410 + i * 42, label, 5, col, 300);
      b.key = key;
      return b;
    });
    this.confirmBtn = makeButton(this, px + 220, 595, '確定！', () => this.confirm(), { width: 240, height: 56 });
    makeButton(this, 110, 680, '返回', () => this.back(), { width: 140, height: 44, size: 20, color: 0x5c6bc0 });

    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.move(-1, 0));
    kb.on('keydown-A', () => this.move(-1, 0));
    kb.on('keydown-RIGHT', () => this.move(1, 0));
    kb.on('keydown-D', () => this.move(1, 0));
    kb.on('keydown-UP', () => this.move(0, -1));
    kb.on('keydown-W', () => this.move(0, -1));
    kb.on('keydown-DOWN', () => this.move(0, 1));
    kb.on('keydown-S', () => this.move(0, 1));
    kb.on('keydown-ENTER', () => this.confirm());
    kb.on('keydown-SPACE', () => this.confirm());
    kb.on('keydown-ESC', () => this.back());

    this.select(this.index, true);
    this.cameras.main.fadeIn(250);
  }

  move(dx, dy) {
    let col = this.index % 4;
    let row = Math.floor(this.index / 4);
    col = (col + dx + 4) % 4;
    row = (row + dy + 2) % 2;
    this.select(row * 4 + col);
  }

  select(i, silent = false) {
    this.index = i;
    if (!silent) Sound.click();
    this.cards.forEach((card, k) => {
      const c = card.char;
      const g = card.frame;
      g.clear();
      const on = k === i;
      g.fillStyle(on ? c.color : 0x000000, on ? 0.9 : 0.35);
      g.fillRoundedRect(-83, -113, 166, 226, 18);
      g.lineStyle(on ? 5 : 2, on ? 0xffe066 : 0xffffff, on ? 1 : 0.4);
      g.strokeRoundedRect(-83, -113, 166, 226, 18);
      card.setScale(on ? 1.06 : 1);
      if (on) this.children.bringToTop(card);
    });
    const c = CHARACTERS[i];
    this.bigPortrait.setTexture(`pround_${c.id}`);
    this.nameText.setText(c.name);
    this.titleText.setText(c.title);
    this.descText.setText(c.desc);
    this.kartPreview.setTexture(`kart_${c.id}`);
    this.kartHead.setTexture(`head_${c.id}`);
    this.bars.forEach((b) => b.setValue(c.stats[b.key]));
    this.nameText.setColor('#ffffff');
    this.tweens.add({ targets: this.bigPortrait, scale: { from: 0.62, to: 0.72 }, duration: 180, ease: 'Back.Out' });
  }

  confirm() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.unlock();
    Sound.select();
    this.registry.set('playerChar', CHARACTERS[this.index].id);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TrackSelect'));
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Title');
  }

  update(time) {
    const r = Math.sin(time / 600) * 0.25 - Math.PI / 2;
    this.kartPreview.setRotation(r);
    this.kartHead.setPosition(this.kartPreview.x - Math.cos(r) * 8, this.kartPreview.y - Math.sin(r) * 8 - 12);
  }
}
