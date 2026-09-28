import Phaser from 'phaser';
import { WIDTH } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { MOTIONS } from '../data/moves.js';
import { STAGES } from '../objects/Stage.js';
import { menuAction } from '../systems/Input.js';
import { Sfx } from '../systems/Sfx.js';
import { makeText, controlsPanel, stripesBackground } from '../ui.js';

const COLS = 4;
const CELL = 138;
const GRID_X = WIDTH / 2 - (COLS * CELL) / 2 + CELL / 2;
const GRID_Y = 170;
const PREVIEW_H = 300;
const P_COLORS = [0xff3b30, 0x2e9bff];

export class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  init(data) {
    this.mode = data.mode;
    this.difficulty = data.difficulty;
    this.cursors = [data.p1 ?? 0, data.p2 ?? 1];
    this.locked = [false, false];
    this.leaving = false;
  }

  create() {
    stripesBackground(this, 0x0f1a3a);
    makeText(this, WIDTH / 2, 50, '選擇角色', 56, '#ffe45c', { stroke: '#c0161b', strokeThickness: 10 }).setOrigin(0.5);
    const hint = this.mode === 'cpu'
      ? '1P：WASD 移動　J 確定　K 取消（先選自己，再選電腦對手）'
      : '1P：WASD + J 確定 / K 取消　　2P：方向鍵 + 數字鍵1 或 , 確定 / 數字鍵2 或 . 取消';
    makeText(this, WIDTH / 2, 98, hint, 20, '#dddddd').setOrigin(0.5);

    CHARACTERS.forEach((c, i) => {
      const { x, y } = cellPos(i);
      this.add.rectangle(x, y, CELL - 10, CELL - 10, c.color, 0.35).setStrokeStyle(3, 0xffffff, 0.8);
      this.add.image(x, y, c.portrait).setDisplaySize(CELL - 16, CELL - 16);
      makeText(this, x, y + CELL / 2 - 20, c.name, 20).setOrigin(0.5);
    });
    this.cursorGfx = this.add.graphics().setDepth(5);
    this.tags = [0, 1].map((p) => makeText(this, 0, 0, p === 0 ? '1P' : this.mode === 'cpu' ? 'CPU' : '2P', 20, p === 0 ? '#ff6b61' : '#6bc0ff').setOrigin(0.5).setDepth(6));

    this.previews = [0, 1].map((p) => {
      const x = p === 0 ? 170 : WIDTH - 170;
      return {
        img: this.add.image(x, 460, CHARACTERS[0].texture).setOrigin(0.5, 1),
        name: makeText(this, x, 110, '', 40, '#ffffff').setOrigin(0.5).setDepth(4),
        info: makeText(this, p === 0 ? 20 : WIDTH - 20, 468, '', 17, '#ffffff', { strokeThickness: 3, wordWrap: { width: 330, useAdvancedWrap: true }, align: p === 0 ? 'left' : 'right' })
          .setOrigin(p === 0 ? 0 : 1, 0),
      };
    });
    this.status = makeText(this, WIDTH / 2, 480, '', 30, '#ffe45c').setOrigin(0.5);
    controlsPanel(this, 590);

    this.input.keyboard.on('keydown', this.onKey, this);
    this.refresh();
  }

  /** Which cursor does this input drive? In CPU mode P1 picks both, one after the other. */
  targetFor(player) {
    if (this.mode === 'cpu') return player === 2 ? null : Number(this.locked[0]);
    if (player === 0) return Number(this.locked[0]);
    return player - 1;
  }

  onKey(event) {
    if (this.leaving) return;
    Sfx.unlock();
    const act = menuAction(event);
    if (!act) return;
    const target = this.targetFor(act.player);
    if (target === null) return;

    const moves = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    if (moves[act.action] && !this.locked[target]) {
      const [dx, dy] = moves[act.action];
      const col = Phaser.Math.Wrap((this.cursors[target] % COLS) + dx, 0, COLS);
      const row = Phaser.Math.Wrap(Math.floor(this.cursors[target] / COLS) + dy, 0, CHARACTERS.length / COLS);
      this.cursors[target] = row * COLS + col;
      Sfx.cursor();
    } else if (act.action === 'confirm' && !this.locked[target]) {
      this.locked[target] = true;
      Sfx.confirm();
    } else if (act.action === 'back') {
      // Undo this player's pick (or the latest pick for shared keys); with nothing picked, go back to the title.
      const undo = act.player === 2 || (this.mode === 'versus' && act.player === 1) ? target : this.locked.lastIndexOf(true);
      if (undo >= 0 && this.locked[undo]) {
        this.locked[undo] = false;
        Sfx.cursor();
      } else if (!this.locked.includes(true)) {
        this.scene.start('Title', { difficulty: this.difficulty });
        return;
      }
    }
    this.refresh();
    if (this.locked[0] && this.locked[1]) this.startMatch();
  }

  startMatch() {
    this.leaving = true;
    this.status.setText('準備開戰！');
    this.time.delayedCall(700, () => {
      this.scene.start('Versus', {
        mode: this.mode, difficulty: this.difficulty, p1: this.cursors[0], p2: this.cursors[1],
        stage: Phaser.Math.Between(0, STAGES.length - 1),
      });
    });
  }

  refresh() {
    const g = this.cursorGfx;
    g.clear();
    [0, 1].forEach((p) => {
      const { x, y } = cellPos(this.cursors[p]);
      const inset = p === 0 ? 0 : 8;
      const size = CELL - 4 - inset * 2;
      g.lineStyle(this.locked[p] ? 8 : 5, P_COLORS[p], 1).strokeRect(x - size / 2, y - size / 2, size, size);
      this.tags[p].setPosition(x + (p === 0 ? -CELL / 2 + 22 : CELL / 2 - 26), y - CELL / 2 + 14);

      const c = CHARACTERS[this.cursors[p]];
      const pv = this.previews[p];
      pv.img.setTexture(c.texture).setScale(PREVIEW_H / 440 * (c.height / 320)).setFlipX(p === 1).setAlpha(this.locked[p] ? 1 : 0.85);
      pv.name.setText(`${c.name}`).setColor(this.locked[p] ? '#ffe45c' : '#ffffff');
      const sp = c.special;
      pv.info.setText([
        `${c.title}　${c.desc}`,
        `必殺技：${sp.name}　${MOTIONS[sp.motion].label} + ${sp.button === 'P' ? '拳' : '腳'}`,
        `超必殺：${c.super.name}`,
      ].join('\n'));
    });
    const waiting = this.mode === 'cpu'
      ? (this.locked[0] ? '請選擇電腦對手' : '1P 請選擇角色')
      : ['1P', '2P'].filter((_, i) => !this.locked[i]).map((s) => `${s} 選擇中…`).join('　');
    this.status.setText(this.locked[0] && this.locked[1] ? '準備開戰！' : waiting);
  }
}

function cellPos(i) {
  return { x: GRID_X + (i % COLS) * CELL, y: GRID_Y + Math.floor(i / COLS) * CELL + 20 };
}
