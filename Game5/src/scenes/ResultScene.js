import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES } from '../objects/Stage.js';
import { menuAction } from '../systems/Input.js';
import { Sfx } from '../systems/Sfx.js';
import { makeText, stripesBackground } from '../ui.js';

const OPTIONS = ['再戰一場', '重新選擇角色', '回到標題'];

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.config = data;
    this.cursor = 0;
  }

  create() {
    const { winner, p1, p2, mode } = this.config;
    stripesBackground(this, 0x3a0f1a);
    if (winner === -1) {
      makeText(this, WIDTH / 2, 150, '平手！', 110, '#ffe45c', { stroke: '#c0161b', strokeThickness: 14 }).setOrigin(0.5);
    } else {
      const c = CHARACTERS[winner === 0 ? p1 : p2];
      const who = winner === 1 && mode === 'cpu' ? 'CPU' : `${winner + 1}P`;
      const img = this.add.image(330, HEIGHT - 30, c.texture).setOrigin(0.5, 1).setScale((520 / 440) * (c.height / 320) * 0.9);
      this.tweens.add({ targets: img, y: HEIGHT - 50, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      makeText(this, 860, 150, `${who} ${c.name}`, 70, '#ffffff').setOrigin(0.5);
      makeText(this, 860, 250, '勝利！', 120, '#ffe45c', { stroke: '#c0161b', strokeThickness: 14 }).setOrigin(0.5);
    }
    this.items = OPTIONS.map((label, i) => makeText(this, 860, 400 + i * 64, label, 40).setOrigin(0.5));
    makeText(this, 860, 620, '↑↓ 選擇　Enter / J 確定', 22, '#cccccc').setOrigin(0.5);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.refresh();
  }

  onKey(event) {
    const act = menuAction(event);
    if (!act) return;
    if (act.action === 'up' || act.action === 'down') {
      this.cursor = Phaser.Math.Wrap(this.cursor + (act.action === 'up' ? -1 : 1), 0, OPTIONS.length);
      Sfx.cursor();
      this.refresh();
    } else if (act.action === 'confirm') {
      Sfx.confirm();
      const { mode, difficulty, p1, p2 } = this.config;
      if (this.cursor === 0) this.scene.start('Versus', { mode, difficulty, p1, p2, stage: Phaser.Math.Between(0, STAGES.length - 1) });
      else if (this.cursor === 1) this.scene.start('Select', { mode, difficulty, p1, p2 });
      else this.scene.start('Title', { difficulty });
    }
  }

  refresh() {
    this.items.forEach((t, i) => {
      const sel = i === this.cursor;
      t.setText(sel ? `▶ ${OPTIONS[i]} ◀` : OPTIONS[i]).setColor(sel ? '#ffe45c' : '#ffffff');
    });
  }
}
