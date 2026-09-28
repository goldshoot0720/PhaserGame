// 比賽 HUD：記分板、B/S/O 燈號、壘包、打者 / 投手小卡、實況橫幅、球種選單
import { txt, FONT } from './common.js';
import { TEAMS, grade, GRADE_COLORS, PITCH_TYPES } from '../systems/data.js';
import { isMuted, setMuted, unlockAudio, speak } from '../systems/audio.js';

export default class Hud {
  constructor(scene, gs) {
    this.scene = scene;
    this.gs = gs;
    this.root = scene.add.container(0, 0).setDepth(100);

    this.scoreG = scene.add.graphics();
    this.root.add(this.scoreG);
    this.scoreTexts = scene.add.container(0, 0);
    this.root.add(this.scoreTexts);

    this.countG = scene.add.graphics();
    this.root.add(this.countG);
    this.inningText = txt(scene, 1120, 22, '', 24, '#ffffff').setOrigin(0.5, 0);
    this.root.add(this.inningText);
    ['B', 'S', 'O'].forEach((l, i) => this.root.add(txt(scene, 1000, 64 + i * 28, l, 20, ['#7dff6a', '#ffe14d', '#ff5a3c'][i]).setOrigin(0.5)));

    // 打者 / 投手卡
    this.batCard = scene.add.container(0, 0);
    this.pitCard = scene.add.container(0, 0);
    this.root.add([this.batCard, this.pitCard]);

    // 球速
    this.speedText = txt(scene, 1262, 586, '', 34, '#ffffff', { strokeThickness: 6 }).setOrigin(1, 0.5);
    this.pitchNameText = txt(scene, 1262, 552, '', 22, '#ffe14d').setOrigin(1, 0.5);
    this.root.add([this.speedText, this.pitchNameText]);

    // 靜音
    this.muteBtn = txt(scene, 1266, 150, '', 18, '#ffffff', { strokeThickness: 4 }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => this.toggleMute());
    this.root.add(this.muteBtn);
    this.refreshMute();

    // 操作提示
    this.hint = txt(scene, 640, 708, '', 17, '#ffffff', { strokeThickness: 4 }).setOrigin(0.5, 1);
    this.root.add(this.hint);

    // 球種選單
    this.pitchMenu = scene.add.container(0, 0).setVisible(false);
    this.root.add(this.pitchMenu);

    // 實況橫幅
    this.banner = scene.add.container(640, 170).setAlpha(0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.4); bg.fillRoundedRect(-392, -30, 792, 68, 12);
    bg.fillStyle(0xffffff, 0.96); bg.fillRoundedRect(-396, -34, 792, 68, 12);
    bg.lineStyle(3, 0x1a1a1a); bg.strokeRoundedRect(-396, -34, 792, 68, 12);
    bg.fillStyle(0xc2185b, 1); bg.fillRoundedRect(-396, -34, 96, 68, { tl: 12, bl: 12, tr: 0, br: 0 });
    const lab = txt(scene, -348, 0, '實況', 26, '#ffffff').setOrigin(0.5);
    this.bannerText = scene.add.text(-284, 0, '', { fontFamily: FONT, fontSize: '28px', color: '#1a1a1a', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.banner.add([bg, lab, this.bannerText]);
    this.root.add(this.banner);

    this.bigText = txt(scene, 640, 330, '', 110, '#ffe14d', { stroke: '#c2185b', strokeThickness: 16 }).setOrigin(0.5).setAlpha(0);
    this.root.add(this.bigText);
  }

  toggleMute() {
    unlockAudio();
    setMuted(!isMuted());
    this.refreshMute();
  }

  refreshMute() {
    this.muteBtn.setText(isMuted() ? '聲音：關 (M)' : '聲音：開 (M)');
  }

  refresh() {
    this.drawScore();
    this.drawCount();
  }

  drawScore() {
    const gs = this.gs;
    const g = this.scoreG;
    const T = this.scoreTexts;
    T.removeAll(true);
    g.clear();
    const cols = Math.max(gs.innings, gs.inning);
    const x0 = 14, y0 = 12, cw = 36, nameW = 92, rh = 34;
    const w = nameW + cols * cw + 56 + 50;
    g.fillStyle(0x0a1628, 0.9); g.fillRoundedRect(x0, y0, w, rh * 3 + 8, 10);
    g.lineStyle(2, 0xffc928, 1); g.strokeRoundedRect(x0, y0, w, rh * 3 + 8, 10);
    for (let i = 0; i < cols; i++) {
      const cx = x0 + nameW + i * cw + cw / 2;
      if (i === gs.inning - 1) { g.fillStyle(0xffc928, 0.25); g.fillRect(cx - cw / 2, y0 + 4, cw, rh * 3); }
      T.add(txt(this.scene, cx, y0 + 20, String(i + 1), 17, '#aac4ff', { strokeThickness: 2 }).setOrigin(0.5));
    }
    T.add(txt(this.scene, x0 + nameW + cols * cw + 28, y0 + 20, 'R', 18, '#ffe14d', { strokeThickness: 2 }).setOrigin(0.5));
    T.add(txt(this.scene, x0 + nameW + cols * cw + 78, y0 + 20, 'H', 18, '#aac4ff', { strokeThickness: 2 }).setOrigin(0.5));
    [gs.away, gs.home].forEach((tid, r) => {
      const team = TEAMS[tid];
      const y = y0 + 20 + (r + 1) * rh;
      g.fillStyle(team.color, 1); g.fillRoundedRect(x0 + 8, y - 13, nameW - 14, 26, 6);
      const bat = gs.battingTeamId === tid;
      T.add(txt(this.scene, x0 + 8 + (nameW - 14) / 2, y, (bat ? '▶' : '') + team.name, 17, '#ffffff', { strokeThickness: 3 }).setOrigin(0.5));
      const ls = gs.lineScore[tid];
      for (let i = 0; i < cols; i++) {
        const v = ls[i];
        T.add(txt(this.scene, x0 + nameW + i * cw + cw / 2, y, v === undefined ? '' : String(v), 20, '#ffffff', { strokeThickness: 3 }).setOrigin(0.5));
      }
      T.add(txt(this.scene, x0 + nameW + cols * cw + 28, y, String(gs.runs[tid]), 24, '#ffe14d', { strokeThickness: 3 }).setOrigin(0.5));
      T.add(txt(this.scene, x0 + nameW + cols * cw + 78, y, String(gs.hits[tid]), 20, '#ffffff', { strokeThickness: 3 }).setOrigin(0.5));
    });
  }

  drawCount() {
    const gs = this.gs;
    const g = this.countG;
    g.clear();
    g.fillStyle(0x0a1628, 0.9); g.fillRoundedRect(978, 12, 290, 132, 10);
    g.lineStyle(2, 0xffc928, 1); g.strokeRoundedRect(978, 12, 290, 132, 10);
    const lamp = (x, y, on, color) => {
      g.fillStyle(on ? color : 0x2a3a55, 1); g.fillCircle(x, y, 10);
      if (on) { g.fillStyle(0xffffff, 0.5); g.fillCircle(x - 3, y - 3, 3); }
    };
    for (let i = 0; i < 3; i++) lamp(1026 + i * 26, 64, gs.balls > i, 0x3ddc55);
    for (let i = 0; i < 2; i++) lamp(1026 + i * 26, 92, gs.strikes > i, 0xffd23f);
    for (let i = 0; i < 2; i++) lamp(1026 + i * 26, 120, gs.outs > i, 0xff4a3a);
    // 壘包
    const bx = 1190, by = 92, d = 22;
    const base = (x, y, on) => {
      g.fillStyle(on ? 0xffc928 : 0x2a3a55, 1);
      g.fillPoints([{ x, y: y - 11 }, { x: x + 11, y }, { x, y: y + 11 }, { x: x - 11, y }], true);
      g.lineStyle(2, 0xffffff, 0.8);
      g.strokePoints([{ x, y: y - 11 }, { x: x + 11, y }, { x, y: y + 11 }, { x: x - 11, y }], true);
    };
    base(bx + d, by, !!gs.bases[0]);
    base(bx, by - d, !!gs.bases[1]);
    base(bx - d, by, !!gs.bases[2]);
    this.inningText.setText(`${gs.inning}局${gs.top ? '上' : '下'}`);
    this.inningText.setPosition(1190, 20);
  }

  setCards(batter, batTeam, pitcher, pitTeam) {
    const gs = this.gs;
    const sc = this.scene;
    // 打者卡
    const B = this.batCard; B.removeAll(true);
    const bg = sc.add.graphics();
    bg.fillStyle(0x000000, 0.35); bg.fillRoundedRect(16, 606, 330, 100, 12);
    bg.fillStyle(batTeam.color, 0.95); bg.fillRoundedRect(12, 602, 330, 100, 12);
    bg.lineStyle(3, 0xffffff, 0.9); bg.strokeRoundedRect(12, 602, 330, 100, 12);
    bg.fillStyle(0xffffff, 1); bg.fillCircle(62, 652, 40);
    B.add(bg);
    B.add(sc.add.image(62, 652, `head_${batter.id}`).setScale(0.3));
    const st = gs.stats[batter.id];
    B.add(txt(sc, 112, 612, `${(gs.order[gs.battingTeamId] % 4) + 1}棒 ${batter.name}`, 22, '#ffffff'));
    B.add(txt(sc, 112, 642, `今日 ${st.ab}打數 ${st.h}安打${st.hr ? ` ${st.hr}轟` : ''}`, 16, '#ffffff', { strokeThickness: 3 }));
    [['彈', null, batter.traj], ['巧', batter.meet], ['力', batter.power], ['速', batter.speed]].forEach((r, i) => {
      const x = 112 + i * 56;
      B.add(txt(sc, x, 672, r[0], 17, '#ffffff', { strokeThickness: 3 }));
      const gr = r[1] == null ? String(r[2]) : grade(r[1]);
      B.add(txt(sc, x + 20, 667, gr, 22, r[1] == null ? '#ffffff' : GRADE_COLORS[gr], { strokeThickness: 4 }));
    });

    // 投手卡
    const P = this.pitCard; P.removeAll(true);
    const pg = sc.add.graphics();
    pg.fillStyle(0x000000, 0.35); pg.fillRoundedRect(942, 610, 330, 96, 12);
    pg.fillStyle(pitTeam.color, 0.95); pg.fillRoundedRect(938, 606, 330, 96, 12);
    pg.lineStyle(3, 0xffffff, 0.9); pg.strokeRoundedRect(938, 606, 330, 96, 12);
    pg.fillStyle(0xffffff, 1); pg.fillCircle(986, 654, 38);
    P.add(pg);
    P.add(sc.add.image(986, 654, `head_${pitcher.id}`).setScale(0.28));
    P.add(txt(sc, 1034, 614, `投手 ${pitcher.name}`, 21, '#ffffff'));
    this.staminaG = sc.add.graphics();
    P.add(this.staminaG);
    P.add(txt(sc, 1034, 646, '體力', 16, '#ffffff', { strokeThickness: 3 }));
    this.pitchCountText = txt(sc, 1034, 674, '', 16, '#ffffff', { strokeThickness: 3 });
    P.add(this.pitchCountText);
    this.updateStamina();
  }

  updateStamina() {
    const gs = this.gs;
    const g = this.staminaG;
    if (!g) return;
    const r = gs.staminaRatio;
    g.clear();
    g.fillStyle(0x222222, 1); g.fillRoundedRect(1078, 650, 172, 14, 6);
    g.fillStyle(r > 0.5 ? 0x5ee06b : r > 0.25 ? 0xffc928 : 0xff4a3a, 1);
    g.fillRoundedRect(1078, 650, 172 * r, 14, 6);
    this.pitchCountText.setText(`用球數 ${gs.pitchCount[gs.fieldingTeamId]}`);
  }

  showSpeed(pitch) {
    this.speedText.setText(`${pitch.kmh} km/h`);
    this.pitchNameText.setText(pitch.type);
    this.speedText.setScale(1.3);
    this.scene.tweens.add({ targets: this.speedText, scale: 1, duration: 250, ease: 'Back.easeOut' });
  }

  clearSpeed() { this.speedText.setText(''); this.pitchNameText.setText(''); }

  setHint(s) { this.hint.setText(s); }

  buildPitchMenu(list, onPick) {
    const M = this.pitchMenu; M.removeAll(true);
    this.pitchRows = [];
    const x = 1050, y0 = 250;
    const g = this.scene.add.graphics();
    g.fillStyle(0x0a1628, 0.85); g.fillRoundedRect(x - 10, y0 - 44, 225, list.length * 46 + 54, 12);
    g.lineStyle(2, 0xffc928, 1); g.strokeRoundedRect(x - 10, y0 - 44, 225, list.length * 46 + 54, 12);
    M.add(g);
    M.add(txt(this.scene, x + 100, y0 - 24, '球種 (1~4 / Q E)', 17, '#ffe14d', { strokeThickness: 3 }).setOrigin(0.5));
    list.forEach((name, i) => {
      const row = this.scene.add.container(x, y0 + i * 46);
      const bg = this.scene.add.graphics();
      const t = txt(this.scene, 12, 0, `${i + 1}  ${name}`, 22, '#ffffff', { strokeThickness: 3 }).setOrigin(0, 0.5);
      const arrow = this.scene.add.graphics();
      const def = PITCH_TYPES[name];
      arrow.lineStyle(4, def.color, 1);
      const ax = 170, ay = 0;
      const dx = def.dx * 16, dy = -def.dy * 16;
      if (name === '直球') { arrow.fillStyle(def.color, 1); arrow.fillCircle(ax, ay, 6); }
      else {
        arrow.lineBetween(ax - dx * 0.5, ay - dy * 0.5, ax + dx, ay + dy);
        arrow.fillStyle(def.color, 1); arrow.fillCircle(ax + dx, ay + dy, 5);
      }
      row.add([bg, t, arrow]);
      row.setSize(205, 42);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => onPick(i));
      M.add(row);
      this.pitchRows.push({ bg, t });
    });
  }

  selectPitchRow(i) {
    (this.pitchRows || []).forEach((r, k) => {
      r.bg.clear();
      if (k === i) {
        r.bg.fillStyle(0xff4fa3, 0.85); r.bg.fillRoundedRect(0, -20, 205, 40, 8);
      }
    });
  }

  showPitchMenu(v) { this.pitchMenu.setVisible(v); }

  say(text, voice = true, color = '#1a1a1a') {
    this.bannerText.setText(text).setColor(color);
    const b = this.banner;
    this.scene.tweens.killTweensOf(b);
    b.setAlpha(1).setX(700);
    this.scene.tweens.add({ targets: b, x: 640, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: b, alpha: 0, delay: 2600, duration: 400 });
    if (voice) speak(text);
  }

  big(text, color = '#ffe14d', stroke = '#c2185b', size = 110, hold = 900) {
    const t = this.bigText;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setStroke(stroke, Math.round(size / 7)).setFontSize(size);
    t.setAlpha(1).setScale(0.2).setAngle(-6);
    this.scene.tweens.add({ targets: t, scale: 1, angle: 0, duration: 350, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, scale: 1.2, delay: hold, duration: 300 });
  }
}
