import Phaser from 'phaser';
import { GAME_W, GAME_H, TOTAL_LAPS, textStyle, formatTime, hexStr } from '../config.js';
import { ITEM_NAMES } from '../objects/ItemSystem.js';
import { makeButton } from '../systems/UI.js';
import { Sound } from '../systems/Sound.js';
import { getRecords } from '../systems/Storage.js';

/** 比賽 HUD（獨立場景，不受賽道相機縮放影響） */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
    this.ready = false;
  }

  init(data) {
    this.race = data.race;
  }

  create() {
    const race = this.race;
    this.ready = false;
    this.paused = false;
    this.leavingPause = false;
    this.speedLines = this.add.graphics().setDepth(0);

    // --- 左上：圈數與時間 ---
    const box = this.add.graphics();
    box.fillStyle(0x0b1026, 0.6);
    box.fillRoundedRect(16, 12, 262, 96, 16);
    this.lapText = this.add.text(30, 22, '', textStyle(30, '#ffffff', { stroke: '#000', strokeThickness: 4 }));
    this.timeText = this.add.text(30, 60, '', textStyle(24, '#ffe066', { stroke: '#000', strokeThickness: 3 }));
    this.bestText = this.add.text(272, 26, '', textStyle(14, '#a5f3fc')).setOrigin(1, 0);
    const rec = getRecords(race.trackData.id);
    this.recordLap = rec.bestLap;

    // --- 左側：排名 ---
    this.rankRows = new Map();
    const listBg = this.add.graphics();
    listBg.fillStyle(0x0b1026, 0.45);
    listBg.fillRoundedRect(16, 118, 210, 8 * 44 + 12, 16);
    race.racers.forEach((k) => {
      const c = this.add.container(22, 130 + (k.rank - 1) * 44);
      const hl = this.add.graphics();
      if (k.isPlayer) {
        hl.fillStyle(0xffe066, 0.35);
        hl.fillRoundedRect(-2, -2, 200, 42, 10);
      }
      const num = this.add.text(14, 19, '1', textStyle(20, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
      const img = this.add.image(50, 19, `pcircle_${k.char.id}`).setScale(0.4);
      const name = this.add.text(74, 19, k.char.name, textStyle(15, k.isPlayer ? '#ffe066' : '#ffffff', {
        stroke: '#000', strokeThickness: 3,
      })).setOrigin(0, 0.5);
      c.add([hl, num, img, name]);
      c.num = num;
      c.name = name;
      this.rankRows.set(k, c);
    });

    // --- 右上：小地圖 ---
    const mm = race.minimap;
    this.mmX = GAME_W - mm.size - 16;
    this.mmY = 12;
    this.add.image(this.mmX, this.mmY, mm.key).setOrigin(0, 0).setAlpha(0.95);
    this.mmDots = this.add.graphics();

    // --- 名次 ---
    this.rankBig = this.add.text(GAME_W - 118, 290, '1', textStyle(96, '#ffffff', {
      stroke: '#1b2a6b', strokeThickness: 10,
    })).setOrigin(1, 0.5);
    this.rankSub = this.add.text(GAME_W - 112, 312, '/ 8 名', textStyle(30, '#ffffff', {
      stroke: '#1b2a6b', strokeThickness: 6,
    })).setOrigin(0, 0.5);

    // --- 上方中央：道具欄 ---
    this.itemMode = !!race.items;
    this.itemSlots = [];
    if (this.itemMode) {
      const g = this.add.graphics();
      g.fillStyle(0x0b1026, 0.6);
      g.fillRoundedRect(GAME_W / 2 - 70, 10, 88, 88, 16);
      g.lineStyle(3, 0xffe066, 1);
      g.strokeRoundedRect(GAME_W / 2 - 70, 10, 88, 88, 16);
      g.fillStyle(0x0b1026, 0.5);
      g.fillRoundedRect(GAME_W / 2 + 26, 26, 58, 58, 12);
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeRoundedRect(GAME_W / 2 + 26, 26, 58, 58, 12);
      this.itemSlots.push(this.add.image(GAME_W / 2 - 26, 54, 'icon_missile').setScale(1.1).setVisible(false));
      this.itemSlots.push(this.add.image(GAME_W / 2 + 55, 55, 'icon_missile').setScale(0.75).setVisible(false));
      this.add.text(GAME_W / 2 - 26, 108, 'Z / X', textStyle(14, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
      this.itemName = this.add.text(GAME_W / 2 - 26, 126, '', textStyle(16, '#ffe066', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
    }

    // --- 左下：氮氣 ---
    const ng = this.add.graphics();
    ng.fillStyle(0x0b1026, 0.6);
    ng.fillRoundedRect(16, GAME_H - 86, 360, 72, 16);
    this.add.text(30, GAME_H - 74, '氮氣 Ctrl / 空白鍵', textStyle(15, '#ffffff'));
    this.nitroBar = this.add.graphics();
    this.nitroIcons = [0, 1].map((i) => this.add.image(300 + i * 42, GAME_H - 50, 'icon_nitro').setScale(0.55));

    // --- 右下：速度表 ---
    this.speedo = this.add.graphics();
    this.speedText = this.add.text(GAME_W - 110, GAME_H - 92, '0', textStyle(40, '#ffffff', {
      stroke: '#000', strokeThickness: 5,
    })).setOrigin(0.5);
    this.add.text(GAME_W - 110, GAME_H - 58, 'km/h', textStyle(16, '#cdd8ff')).setOrigin(0.5);

    // --- 中央訊息 ---
    this.countText = this.add.text(GAME_W / 2, GAME_H / 2 - 60, '', textStyle(150, '#ffe066', {
      stroke: '#1b2a6b', strokeThickness: 14,
    })).setOrigin(0.5).setDepth(10);
    this.msgText = this.add.text(GAME_W / 2, 210, '', textStyle(44, '#ffffff', {
      stroke: '#000000', strokeThickness: 7,
    })).setOrigin(0.5).setDepth(10).setAlpha(0);
    this.wrongText = this.add.text(GAME_W / 2, 300, '逆向行駛！', textStyle(52, '#ff4d4d', {
      stroke: '#ffffff', strokeThickness: 8,
    })).setOrigin(0.5).setVisible(false).setDepth(10);
    this.warnText = this.add.text(GAME_W / 2, 160, '⚠ 飛彈鎖定！', textStyle(34, '#ff3b3b', {
      stroke: '#ffffff', strokeThickness: 6,
    })).setOrigin(0.5).setVisible(false).setDepth(10);
    this.instantText = this.add.text(GAME_W / 2, GAME_H - 150, '↑ 瞬間加速！', textStyle(30, '#7df9ff', {
      stroke: '#003', strokeThickness: 6,
    })).setOrigin(0.5).setVisible(false).setDepth(10);
    this.startHint = this.add.text(GAME_W / 2, GAME_H - 120, '在 GO 之前的瞬間按 ↑ 可以起步加速！', textStyle(22, '#ffffff', {
      stroke: '#000', strokeThickness: 4,
    })).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H - 16, 'Esc / P 暫停　R 回到賽道', textStyle(14, '#ffffff', { stroke: '#000', strokeThickness: 3 }))
      .setOrigin(0.5, 1).setAlpha(0.7);

    // --- 暫停選單 ---
    this.pauseLayer = this.add.container(0, 0).setDepth(100).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    dim.setInteractive();
    const pt = this.add.text(GAME_W / 2, 200, '暫停中', textStyle(64, '#ffffff', { stroke: '#1b2a6b', strokeThickness: 10 })).setOrigin(0.5);
    const b1 = makeButton(this, GAME_W / 2, 320, '繼續 (Esc)', () => this.togglePause(), { width: 300 });
    const b2 = makeButton(this, GAME_W / 2, 400, '重新開始 (R)', () => this.restart(), { width: 300, color: 0x7048e8 });
    const b3 = makeButton(this, GAME_W / 2, 480, '返回主選單 (Q)', () => this.quit(), { width: 300, color: 0x5c6bc0 });
    this.pauseLayer.add([dim, pt, b1, b2, b3]);

    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-R', () => { if (this.paused) this.restart(); });
    kb.on('keydown-Q', () => { if (this.paused) this.quit(); });

    this.lastItems = '';
    this.ready = true;
    this.events.once('shutdown', () => { this.ready = false; });
  }

  togglePause() {
    const race = this.race;
    if (!race || race.leaving) return;
    this.paused = !this.paused;
    this.pauseLayer.setVisible(this.paused);
    if (this.paused) {
      Sound.muteEngine(true);
      this.scene.pause('Race');
    } else {
      this.scene.resume('Race');
    }
  }

  restart() {
    if (this.leavingPause) return;
    this.leavingPause = true;
    this.race.restartRace();
  }

  quit() {
    if (this.leavingPause) return;
    this.leavingPause = true;
    this.race.quitToMenu();
  }

  showMessage(text, color = '#ffffff', size = 44, duration = 900) {
    if (!this.ready) return;
    const t = this.msgText;
    this.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setFontSize(size).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: duration, duration: 300 });
  }

  showCountdown(text) {
    if (!this.ready) return;
    const t = this.countText;
    this.tweens.killTweensOf(t);
    t.setText(text).setAlpha(1).setScale(1.6);
    t.setColor(text === 'GO!' ? '#69db7c' : '#ffe066');
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: text === 'GO!' ? 600 : 650, duration: 250 });
    if (text === 'GO!') {
      this.tweens.add({ targets: this.startHint, alpha: 0, duration: 400 });
    }
  }

  showInstantPrompt() {
    if (!this.ready) return;
    this.instantText.setVisible(true);
  }

  flashNitro() {
    if (!this.ready) return;
    const slot = this.nitroIcons[Math.max(0, this.race.player.nitroSlots - 1)];
    this.tweens.add({ targets: slot, scale: { from: 1.1, to: 0.55 }, duration: 350, ease: 'Back.Out' });
  }

  itemPicked() {
    if (!this.ready || !this.itemSlots.length) return;
    this.tweens.add({ targets: this.itemSlots[0], scale: { from: 1.6, to: 1.1 }, duration: 300, ease: 'Back.Out' });
  }

  missileWarning() {
    if (!this.ready) return;
    this.warnUntil = this.time.now + 400;
  }

  update(time) {
    if (!this.ready || !this.race || !this.race.player) return;
    const race = this.race;
    const p = race.player;

    // 圈數與時間
    const lapShown = p.finished ? TOTAL_LAPS : p.displayLap;
    this.lapText.setText(`圈數 ${lapShown} / ${TOTAL_LAPS}`);
    this.timeText.setText(formatTime(p.finished ? p.finishTime : race.raceTime));
    const best = p.bestLap;
    this.bestText.setText(`本場最佳 ${best ? formatTime(best) : '--'}\n紀錄 ${this.recordLap ? formatTime(this.recordLap) : '--'}`);

    // 排名
    for (const [k, row] of this.rankRows) {
      const ty = 130 + (k.rank - 1) * 44;
      row.y += (ty - row.y) * 0.2;
      row.num.setText(String(k.rank));
      row.name.setText(k.finished ? `${k.char.name} ✔` : k.char.name);
    }
    this.rankBig.setText(String(p.rank));
    this.rankBig.setColor(p.rank === 1 ? '#ffe066' : p.rank <= 3 ? '#ffffff' : '#cdd8ff');

    // 小地圖
    const mm = race.minimap;
    const g = this.mmDots;
    g.clear();
    for (const k of race.racers) {
      if (k === p) continue;
      g.fillStyle(k.char.color, 1);
      g.lineStyle(1.5, 0x000000, 0.8);
      const x = this.mmX + mm.offX + k.x * mm.scale;
      const y = this.mmY + mm.offY + k.y * mm.scale;
      g.fillCircle(x, y, 4.5);
      g.strokeCircle(x, y, 4.5);
    }
    if (race.items) {
      g.fillStyle(0xff3b3b, 1);
      for (const m of race.items.missiles) {
        g.fillCircle(this.mmX + mm.offX + m.x * mm.scale, this.mmY + mm.offY + m.y * mm.scale, 2.5);
      }
    }
    const px = this.mmX + mm.offX + p.x * mm.scale;
    const py = this.mmY + mm.offY + p.y * mm.scale;
    g.fillStyle(0xffe066, 1);
    g.lineStyle(2.5, 0xffffff, 1);
    g.fillCircle(px, py, 7);
    g.strokeCircle(px, py, 7);
    g.fillStyle(0x000000, 1);
    g.fillTriangle(
      px + Math.cos(p.heading) * 7, py + Math.sin(p.heading) * 7,
      px + Math.cos(p.heading + 2.5) * 4, py + Math.sin(p.heading + 2.5) * 4,
      px + Math.cos(p.heading - 2.5) * 4, py + Math.sin(p.heading - 2.5) * 4,
    );

    // 道具欄
    if (this.itemMode) {
      const key = p.items.join(',');
      if (key !== this.lastItems) {
        this.lastItems = key;
        this.itemSlots.forEach((s, i) => {
          const it = p.items[i];
          s.setVisible(!!it);
          if (it) s.setTexture(`icon_${it}`);
        });
        this.itemName.setText(p.items[0] ? ITEM_NAMES[p.items[0]] : '');
      }
    }

    // 氮氣
    const nb = this.nitroBar;
    nb.clear();
    const w = 250;
    nb.fillStyle(0x000000, 0.5);
    nb.fillRoundedRect(30, GAME_H - 50, w, 22, 11);
    const ratio = p.nitroSlots >= 2 ? 1 : p.nitroGauge / 100;
    const col = p.drifting ? 0x7df9ff : 0x4dabf7;
    if (ratio > 0) {
      nb.fillStyle(col, 1);
      nb.fillRoundedRect(30, GAME_H - 50, Math.max(22, w * ratio), 22, 11);
      nb.fillStyle(0xffffff, 0.35);
      nb.fillRoundedRect(34, GAME_H - 47, Math.max(14, w * ratio - 8), 6, 3);
    }
    nb.lineStyle(2, 0xffffff, p.drifting ? 1 : 0.5);
    nb.strokeRoundedRect(30, GAME_H - 50, w, 22, 11);
    this.nitroIcons.forEach((ic, i) => ic.setAlpha(i < p.nitroSlots ? 1 : 0.2));

    // 速度表
    const kmh = Math.round(p.speed * 0.36);
    this.speedText.setText(String(kmh));
    const sg = this.speedo;
    sg.clear();
    const cx = GAME_W - 110;
    const cy = GAME_H - 78;
    sg.fillStyle(0x0b1026, 0.6);
    sg.fillCircle(cx, cy, 82);
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    sg.lineStyle(12, 0x000000, 0.5);
    sg.beginPath();
    sg.arc(cx, cy, 66, a0, a1);
    sg.strokePath();
    const sr = Math.min(1, p.speed / (p.phys.maxSpeed * 1.5));
    const scol = p.boostTime > 0 ? 0xff922b : sr > 0.6 ? 0xffe066 : 0x69db7c;
    if (sr > 0.01) {
      sg.lineStyle(12, scol, 1);
      sg.beginPath();
      sg.arc(cx, cy, 66, a0, a0 + (a1 - a0) * sr);
      sg.strokePath();
    }

    // 集中線（加速時）
    const sl = this.speedLines;
    sl.clear();
    if (p.boostTime > 0 && !this.paused) {
      sl.lineStyle(3, 0xffffff, 0.35);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 330 + Math.random() * 120;
        const r1 = r0 + 120 + Math.random() * 160;
        sl.lineBetween(GAME_W / 2 + Math.cos(a) * r0, GAME_H / 2 + Math.sin(a) * r0 * 0.7,
          GAME_W / 2 + Math.cos(a) * r1, GAME_H / 2 + Math.sin(a) * r1 * 0.7);
      }
    }

    // 警告
    this.wrongText.setVisible(p.wrongWay && Math.floor(time / 300) % 2 === 0);
    const targeted = race.items && race.items.isTargeted(p);
    this.warnText.setVisible(!!targeted && Math.floor(time / 180) % 2 === 0);
    this.instantText.setVisible(p.instantWindow > 0 && Math.floor(time / 90) % 2 === 0);
  }
}
