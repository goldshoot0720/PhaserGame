import Phaser from 'phaser';
import { WIDTH, HEIGHT, DIFFICULTIES } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES } from '../objects/Stage.js';
import { Sfx } from '../systems/Sfx.js';
import { makeText } from '../ui.js';

const DURATION = 2600;

export class VersusScene extends Phaser.Scene {
  constructor() {
    super('Versus');
  }

  init(data) {
    this.config = data;
  }

  create() {
    const { p1, p2, mode, difficulty, stage } = this.config;
    const fighters = [CHARACTERS[p1], CHARACTERS[p2]];
    // Split background in the two fighters' colours.
    const g = this.add.graphics();
    g.fillStyle(fighters[0].color, 0.55).fillPoints([{ x: 0, y: 0 }, { x: WIDTH / 2 + 80, y: 0 }, { x: WIDTH / 2 - 80, y: HEIGHT }, { x: 0, y: HEIGHT }], true);
    g.fillStyle(fighters[1].color, 0.55).fillPoints([{ x: WIDTH / 2 + 80, y: 0 }, { x: WIDTH, y: 0 }, { x: WIDTH, y: HEIGHT }, { x: WIDTH / 2 - 80, y: HEIGHT }], true);
    g.fillStyle(0x000000, 0.35).fillRect(0, 0, WIDTH, HEIGHT);

    fighters.forEach((c, i) => {
      const left = i === 0;
      const x = left ? 300 : WIDTH - 300;
      const img = this.add.image(left ? -300 : WIDTH + 300, HEIGHT - 60, c.texture).setOrigin(0.5, 1).setFlipX(!left);
      img.setScale((420 / 440) * (c.height / 320));
      this.tweens.add({ targets: img, x, duration: 450, ease: 'Cubic.Out' });
      const label = i === 1 && mode === 'cpu' ? `CPU（${DIFFICULTIES.find((d) => d.id === difficulty).label}）` : `${i + 1}P`;
      makeText(this, x, 90, c.name, 64, '#ffffff').setOrigin(0.5);
      makeText(this, x, 150, `${c.title}　${label}`, 26, '#ffe45c').setOrigin(0.5);
    });

    const vs = makeText(this, WIDTH / 2, HEIGHT / 2 - 20, 'VS', 180, '#ffe45c', { stroke: '#c0161b', strokeThickness: 18 }).setOrigin(0.5).setScale(4).setAlpha(0);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, delay: 350, duration: 300, ease: 'Back.Out', onStart: () => Sfx.announce() });
    makeText(this, WIDTH / 2, HEIGHT - 40, `戰場：${STAGES[stage].name}`, 28).setOrigin(0.5);

    this.time.delayedCall(DURATION, () => this.scene.start('Fight', this.config));
  }
}
