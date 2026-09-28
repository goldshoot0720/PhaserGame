import Phaser from 'phaser';
import { GAME_W, textStyle, formatTime } from '../config.js';
import { TRACKS } from '../data/tracks.js';
import { TrackGeometry } from '../systems/TrackGeometry.js';
import { TrackRenderer } from '../systems/TrackRenderer.js';
import { makeButton, gradientBg } from '../systems/UI.js';
import { Sound } from '../systems/Sound.js';
import { getRecords } from '../systems/Storage.js';

export class TrackSelectScene extends Phaser.Scene {
  constructor() {
    super('TrackSelect');
  }

  create() {
    this.leaving = false;
    gradientBg(this, 0x1fa2c9, 0x10163f);
    this.add.text(40, 36, '選擇賽道', textStyle(44, '#ffffff', { stroke: '#1b2a6b', strokeThickness: 8 })).setOrigin(0, 0.5);
    this.add.text(250, 40, '← → 選擇　M 切換模式　Enter 出發　Esc 返回', textStyle(18, '#cdd8ff')).setOrigin(0, 0.5);

    const prev = this.registry.get('trackId');
    this.index = Math.max(0, TRACKS.findIndex((t) => t.id === prev));
    this.mode = this.registry.get('mode') || 'item';

    this.cards = TRACKS.map((t, i) => {
      const x = GAME_W / 2 + (i - 1) * 400;
      const y = 330;
      const cont = this.add.container(x, y);
      const frame = this.add.graphics();
      const geom = new TrackGeometry(t);
      const mini = new TrackRenderer(this, geom).buildMinimap(230);
      const img = this.add.image(0, -60, mini.key);
      const name = this.add.text(0, 80, t.name, textStyle(32, '#ffffff', { stroke: '#000000', strokeThickness: 5 })).setOrigin(0.5);
      const sub = this.add.text(0, 118, t.subtitle, textStyle(18, '#ffe066')).setOrigin(0.5);
      const desc = this.add.text(0, 160, t.desc, textStyle(16, '#dfe8ff', {
        wordWrap: { width: 320, useAdvancedWrap: true }, align: 'center',
      })).setOrigin(0.5, 0);
      const rec = getRecords(t.id);
      const recText = this.add.text(0, 222, `最佳單圈 ${formatTime(rec.bestLap)}\n最佳總時間 ${formatTime(rec.bestRace)}`,
        textStyle(16, '#a5f3fc', { align: 'center' })).setOrigin(0.5, 0);
      cont.add([frame, img, name, sub, desc, recText]);
      cont.setSize(360, 520);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerdown', () => {
        Sound.unlock();
        if (this.index === i) this.start();
        else this.select(i);
      });
      cont.frame = frame;
      return cont;
    });

    // 模式切換
    this.modeBtn = makeButton(this, GAME_W / 2 - 150, 665, '', () => this.toggleMode(), { width: 260, height: 52, size: 22, color: 0x7048e8 });
    makeButton(this, GAME_W / 2 + 150, 665, '出發！', () => this.start(), { width: 220, height: 52, size: 26 });
    makeButton(this, 100, 665, '返回', () => this.back(), { width: 130, height: 44, size: 20, color: 0x5c6bc0 });
    this.updateMode();

    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.select((this.index + TRACKS.length - 1) % TRACKS.length));
    kb.on('keydown-A', () => this.select((this.index + TRACKS.length - 1) % TRACKS.length));
    kb.on('keydown-RIGHT', () => this.select((this.index + 1) % TRACKS.length));
    kb.on('keydown-D', () => this.select((this.index + 1) % TRACKS.length));
    kb.on('keydown-M', () => this.toggleMode());
    kb.on('keydown-TAB', () => this.toggleMode());
    kb.on('keydown-ENTER', () => this.start());
    kb.on('keydown-SPACE', () => this.start());
    kb.on('keydown-ESC', () => this.back());
    this.input.keyboard.addCapture('TAB');

    this.select(this.index, true);
    this.cameras.main.fadeIn(250);
  }

  toggleMode() {
    this.mode = this.mode === 'item' ? 'speed' : 'item';
    Sound.click();
    this.updateMode();
  }

  updateMode() {
    this.modeBtn.label.setText(this.mode === 'item' ? '模式：道具賽' : '模式：競速賽');
    this.registry.set('mode', this.mode);
  }

  select(i, silent = false) {
    this.index = i;
    if (!silent) Sound.click();
    this.cards.forEach((card, k) => {
      const on = k === i;
      const g = card.frame;
      g.clear();
      g.fillStyle(on ? 0x1b2a6b : 0x000000, on ? 0.85 : 0.4);
      g.fillRoundedRect(-180, -210, 360, 500, 24);
      g.lineStyle(on ? 5 : 2, on ? 0xffe066 : 0xffffff, on ? 1 : 0.35);
      g.strokeRoundedRect(-180, -210, 360, 500, 24);
      card.setScale(on ? 1.04 : 0.94);
      card.setAlpha(on ? 1 : 0.8);
    });
  }

  start() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.unlock();
    Sound.select();
    this.registry.set('trackId', TRACKS[this.index].id);
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Race', {
        trackId: TRACKS[this.index].id,
        charId: this.registry.get('playerChar') || 'whale',
        mode: this.mode,
      });
    });
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('CharacterSelect');
  }
}
