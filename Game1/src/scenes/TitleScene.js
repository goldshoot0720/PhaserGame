import Phaser from 'phaser';
import { txt, button, stadiumBackdrop, panel } from '../ui/common.js';
import { unlockAudio, speak, sfxCheer } from '../systems/audio.js';
import { PLAYERS, TEAMS } from '../systems/data.js';
import Chibi from '../ui/Chibi.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.leaving = false;
    stadiumBackdrop(this);

    // 一排 Q 版角色
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    ids.forEach((id, i) => {
      const p = PLAYERS[id];
      const ch = new Chibi(this, 110 + i * 151, 660, p, TEAMS[p.team], i % 2 ? 'batter' : 'pitcher');
      ch.setScale(0.95);
      this.tweens.add({ targets: ch, y: 650, duration: 500 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 90 });
    });

    // 標題
    const title = txt(this, 640, 120, '熱血實況野球', 104, '#ffe14d', { stroke: '#c2185b', strokeThickness: 14 }).setOrigin(0.5);
    title.setShadow(6, 8, '#000000', 0, true, true);
    txt(this, 640, 205, '～ 藍鯨隊 vs 貓咪隊 ～', 36, '#ffffff', { stroke: '#0d2f6e', strokeThickness: 8 }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 操作說明
    panel(this, 330, 250, 620, 200, 0x0d2f6e, 0.85);
    const help = [
      '【打擊】 滑鼠 / WASD / 方向鍵 移動游標　點擊 / 空白鍵 揮棒　B 鍵 短打',
      '【投球】 1~4 或 Q/E 選球種　滑鼠 / WASD 瞄準　點擊 / 空白鍵 投球',
      '【其他】 M 鍵 靜音切換　游標對準球＋時機正確 = 強勁擊球！',
    ];
    help.forEach((s, i) => txt(this, 350, 272 + i * 40, s, 19, '#ffffff', { strokeThickness: 3 }));
    txt(this, 640, 418, '實況語音使用瀏覽器語音合成（建議開啟聲音）', 17, '#ffe14d', { strokeThickness: 3 }).setOrigin(0.5);

    const start = button(this, 640, 505, 300, 70, '開始遊戲', () => this.go(), { size: 34 });
    this.tweens.add({ targets: start, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown-SPACE', () => this.go());
    this.input.keyboard.once('keydown-ENTER', () => this.go());
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    unlockAudio();
    sfxCheer(1.4, 0.35);
    speak('熱血實況野球！開始！');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Select'));
  }
}
