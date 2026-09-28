import Phaser from 'phaser';
import { TEAMS, PLAYERS } from '../systems/data.js';
import { button, panel, stadiumBackdrop, txt } from '../ui/common.js';

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(result) { this.result = result; }

  create() {
    const r = this.result;
    stadiumBackdrop(this);
    this.add.rectangle(640, 360, 1280, 720, 0x07172b, 0.68);
    this.cameras.main.fadeIn(350);

    const message = !r.winner ? '平手！' : r.winner === r.userTeamId ? '勝利！' : '再接再厲！';
    txt(this, 640, 72, message, 70, '#ffe14d', { stroke: '#c2185b', strokeThickness: 10 }).setOrigin(0.5);
    panel(this, 125, 135, 1030, 295, 0xf5f4e9, 0.97);
    txt(this, 640, 160, '比賽結果', 36, '#12376a', { strokeThickness: 0 }).setOrigin(0.5);

    const cols = Math.max(r.innings, ...Object.values(r.lineScore).map((scores) => scores.length));
    const step = Math.min(76, 580 / Math.max(cols, 1));
    const firstX = 440;
    for (let i = 0; i < cols; i++) {
      txt(this, firstX + i * step, 220, String(i + 1), 22, '#526075', { strokeThickness: 0 }).setOrigin(0.5);
    }
    txt(this, 1040, 220, 'R   H', 24, '#526075', { strokeThickness: 0 }).setOrigin(0.5);
    [r.away, r.home].forEach((id, row) => {
      const y = 288 + row * 87;
      txt(this, 160, y, TEAMS[id].name, 29, id === r.userTeamId ? '#c2185b' : '#12376a', { strokeThickness: 0 });
      for (let i = 0; i < cols; i++) {
        txt(this, firstX + i * step, y, String(r.lineScore[id][i] ?? '—'), 27, '#172942', { strokeThickness: 0 }).setOrigin(0.5);
      }
      txt(this, 1040, y, `${r.runs[id]}   ${r.hits[id]}`, 30, '#172942', { strokeThickness: 0 }).setOrigin(0.5);
    });

    const lineup = TEAMS[r.userTeamId].lineup;
    const best = lineup.map((id) => ({ ...r.stats[id], id })).sort((a, b) => b.h - a.h || b.rbi - a.rbi)[0];
    panel(this, 220, 465, 840, 91, 0x12376a, 0.92);
    txt(this, 640, 510, `今日焦點：${PLAYERS[best.id].name}　${best.h} 安打　${best.rbi} 打點`, 27, '#ffffff').setOrigin(0.5);

    button(this, 460, 625, 270, 64, '再玩一次', () => this.scene.start('Select'), { size: 30 });
    button(this, 820, 625, 270, 64, '回到首頁', () => this.scene.start('Title'), { size: 30, color: 0x8cd5ff });
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Select'));
  }
}
