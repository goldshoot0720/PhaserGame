import Phaser from 'phaser';
import { WIDTH, DIFFICULTIES } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { menuAction } from '../systems/Input.js';
import { Sfx } from '../systems/Sfx.js';
import { makeText, controlsPanel, stripesBackground } from '../ui.js';

const ITEMS = ['1P 對戰電腦', '2P 雙人對戰', '電腦難度'];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  init(data) {
    this.cursor = 0;
    this.difficulty = DIFFICULTIES.findIndex((d) => d.id === (data?.difficulty ?? 'normal'));
  }

  create() {
    stripesBackground(this);
    // Parade of the roster behind the logo.
    CHARACTERS.forEach((c, i) => {
      const img = this.add.image(90 + i * 157, 470, c.texture).setOrigin(0.5, 1).setAlpha(0.35);
      img.setScale((c.height / 440) * 0.95);
      this.tweens.add({ targets: img, y: 460, duration: 700 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });

    const title = makeText(this, WIDTH / 2, 110, '萌鬥快打', 120, '#ffe45c', { stroke: '#c0161b', strokeThickness: 16 }).setOrigin(0.5);
    title.setShadow(8, 8, '#000000', 0, true, true);
    makeText(this, WIDTH / 2, 200, 'STREET BRAWL 8 ─ 八人街頭格鬥', 34, '#ffffff').setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.items = ITEMS.map((label, i) => makeText(this, WIDTH / 2, 300 + i * 58, label, 40).setOrigin(0.5));
    controlsPanel(this, 560);
    makeText(this, WIDTH / 2, 530, '↑↓ 選擇　←→ 調整難度　Enter / J 確定', 20, '#cccccc').setOrigin(0.5);

    this.input.keyboard.on('keydown', this.onKey, this);
    this.refresh();
  }

  onKey(event) {
    Sfx.unlock();
    const act = menuAction(event);
    if (!act) return;
    if (act.action === 'up' || act.action === 'down') {
      this.cursor = Phaser.Math.Wrap(this.cursor + (act.action === 'up' ? -1 : 1), 0, ITEMS.length);
      Sfx.cursor();
    } else if ((act.action === 'left' || act.action === 'right') && this.cursor === 2) {
      this.difficulty = Phaser.Math.Wrap(this.difficulty + (act.action === 'left' ? -1 : 1), 0, DIFFICULTIES.length);
      Sfx.cursor();
    } else if (act.action === 'confirm') {
      if (this.cursor === 2) {
        this.difficulty = Phaser.Math.Wrap(this.difficulty + 1, 0, DIFFICULTIES.length);
        Sfx.cursor();
      } else {
        Sfx.confirm();
        this.scene.start('Select', { mode: this.cursor === 0 ? 'cpu' : 'versus', difficulty: DIFFICULTIES[this.difficulty].id });
      }
    }
    this.refresh();
  }

  refresh() {
    this.items.forEach((t, i) => {
      const selected = i === this.cursor;
      const label = i === 2 ? `${ITEMS[2]}：◀ ${DIFFICULTIES[this.difficulty].label} ▶` : ITEMS[i];
      t.setText(selected ? `▶ ${label} ◀` : label).setColor(selected ? '#ffe45c' : '#ffffff').setScale(selected ? 1.1 : 1);
    });
  }
}
