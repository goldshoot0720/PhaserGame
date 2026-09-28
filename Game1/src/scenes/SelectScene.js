import Phaser from 'phaser';
import { txt, button, stadiumBackdrop, panel, gradeText } from '../ui/common.js';
import { TEAMS, PLAYERS } from '../systems/data.js';
import { sfxBlip, speak } from '../systems/audio.js';

export default class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }

  create() {
    this.cameras.main.fadeIn(250);
    stadiumBackdrop(this, 0.6);
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.35);
    this.teamId = 'whale';
    this.innings = 3;
    this.userHome = true;
    this.cardPid = null;

    txt(this, 640, 34, '選擇你的球隊', 38, '#ffe14d', { stroke: '#c2185b', strokeThickness: 8 }).setOrigin(0.5);

    this.teamPanels = {};
    ['whale', 'cat'].forEach((tid, ti) => this.buildTeamPanel(tid, 30 + ti * 625, 70));

    // 能力卡
    this.cardLayer = this.add.container(0, 0);

    // 選項
    const ox = 1040;
    panel(this, 850, 470, 400, 238, 0x0d2f6e, 0.9);
    txt(this, ox, 492, '局數', 24, '#ffffff').setOrigin(0.5);
    this.innBtns = [1, 3, 5].map((n, i) => button(this, ox - 110 + i * 110, 530, 96, 44, `${n} 局`, () => this.setInnings(n), { size: 22 }));
    txt(this, ox, 572, '攻守', 22, '#ffffff').setOrigin(0.5);
    this.homeBtns = [
      button(this, ox - 80, 606, 140, 42, '後攻 (主場)', () => this.setHome(true), { size: 19 }),
      button(this, ox + 80, 606, 140, 42, '先攻 (客場)', () => this.setHome(false), { size: 19 }),
    ];
    button(this, ox, 668, 260, 54, '開始比賽！', () => this.start(), { size: 30, color: 0x5ee06b });

    this.setInnings(3);
    this.setHome(true);
    this.selectTeam('whale');
    this.showCard('c2');

    this.input.keyboard.on('keydown-LEFT', () => this.selectTeam('whale'));
    this.input.keyboard.on('keydown-RIGHT', () => this.selectTeam('cat'));
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.started = false;
  }

  buildTeamPanel(tid, x, y) {
    const team = TEAMS[tid];
    const w = 595, h = 390;
    const c = this.add.container(0, 0);
    const bg = this.add.graphics();
    const draw = (sel) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.4); bg.fillRoundedRect(x + 6, y + 8, w, h, 20);
      bg.fillStyle(sel ? 0xfff6d8 : 0xdfe6ee, 1); bg.fillRoundedRect(x, y, w, h, 20);
      bg.fillStyle(team.color, 1); bg.fillRoundedRect(x, y, w, 58, { tl: 20, tr: 20, bl: 0, br: 0 });
      bg.lineStyle(sel ? 7 : 3, sel ? 0xffc928 : 0x1a1a1a, 1); bg.strokeRoundedRect(x, y, w, h, 20);
    };
    draw(false);
    c.add(bg);
    c.add(txt(this, x + w / 2, y + 29, team.name, 34, '#ffffff', { strokeThickness: 6 }).setOrigin(0.5));
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.selectTeam(tid));
    c.add(hit);

    const order = [...team.lineup];
    order.forEach((pid, i) => {
      const p = PLAYERS[pid];
      const px = x + 78 + i * 146;
      const img = this.add.image(px, y + 72, `por_${pid}`).setOrigin(0.5, 0);
      const tex = this.textures.get(`por_${pid}`).getSourceImage();
      const s = 138 / tex.width;
      img.setScale(s);
      img.setCrop(0, 0, tex.width, tex.height * 0.62);
      const frame = this.add.graphics();
      frame.lineStyle(3, 0x1a1a1a, 1); frame.strokeRoundedRect(px - 69, y + 72, 138, tex.height * 0.62 * s, 8);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => { this.showCard(pid); });
      img.on('pointerdown', () => { this.selectTeam(tid); this.showCard(pid); });
      c.add([img, frame]);
      c.add(txt(this, px, y + 72 + tex.height * 0.62 * s + 18, p.name, 19, '#1a1a1a', { stroke: '#ffffff', strokeThickness: 3 }).setOrigin(0.5));
      c.add(txt(this, px, y + 72 + tex.height * 0.62 * s + 42, `${i + 1}棒 ${p.pos}`, 15, '#444444', { stroke: '#ffffff', strokeThickness: 2 }).setOrigin(0.5));
      if (p.pitch) c.add(txt(this, px + 50, y + 80, '投', 20, '#ffffff', { stroke: '#c2185b', strokeThickness: 6 }).setOrigin(0.5));
    });
    this.teamPanels[tid] = { draw, c };
  }

  selectTeam(tid) {
    if (this.teamId !== tid) sfxBlip(700);
    this.teamId = tid;
    this.teamPanels.whale.draw(tid === 'whale');
    this.teamPanels.cat.draw(tid === 'cat');
  }

  setInnings(n) {
    this.innings = n;
    this.innBtns.forEach((b, i) => b.setSelected([1, 3, 5][i] === n));
  }

  setHome(h) {
    this.userHome = h;
    this.homeBtns[0].setSelected(h);
    this.homeBtns[1].setSelected(!h);
  }

  showCard(pid) {
    if (this.cardPid === pid) return;
    this.cardPid = pid;
    const L = this.cardLayer;
    L.removeAll(true);
    const p = PLAYERS[pid];
    const team = TEAMS[p.team];
    const x = 30, y = 470;
    L.add(panel(this, x, y, 800, 238, 0xffffff, 0.95));
    const head = this.add.image(x + 80, y + 118, `head_${pid}`).setScale(0.52);
    const ring = this.add.graphics();
    ring.fillStyle(team.color, 1); ring.fillCircle(x + 80, y + 118, 68);
    L.add([ring, head]);
    L.add(txt(this, x + 170, y + 16, p.name, 32, '#1a1a1a', { stroke: '#ffffff', strokeThickness: 0 }));
    L.add(txt(this, x + 170, y + 58, `${team.name}・${p.pos}`, 18, team.css, { stroke: '#ffffff', strokeThickness: 0 }));
    L.add(txt(this, x + 170, y + 84, p.desc, 17, '#333333', { stroke: '#ffffff', strokeThickness: 0, wrap: 330, bold: false }));

    // 打擊能力
    const rows = [['彈道', null, p.traj], ['巧打', p.meet], ['力量', p.power], ['跑速', p.speed]];
    rows.forEach((r, i) => {
      const ry = y + 140 + Math.floor(i / 2) * 44;
      const rx = x + 170 + (i % 2) * 170;
      L.add(txt(this, rx, ry, r[0], 20, '#1a1a1a', { stroke: '#fff', strokeThickness: 0 }));
      if (r[1] == null) {
        L.add(txt(this, rx + 56, ry - 4, String(r[2]), 28, '#ff5a3c', { stroke: '#000', strokeThickness: 4 }));
      } else {
        L.add(gradeText(this, rx + 56, ry - 4, r[1], 28));
        L.add(txt(this, rx + 86, ry + 4, String(r[1]), 16, '#555555', { stroke: '#fff', strokeThickness: 0 }));
      }
    });

    // 投手能力
    if (p.pitch) {
      const px = x + 530;
      const pg = this.add.graphics();
      pg.fillStyle(0xfff0f4, 1); pg.fillRoundedRect(px - 12, y + 12, 272, 214, 12);
      L.add(pg);
      L.add(txt(this, px, y + 18, '投手能力', 20, '#c2185b', { stroke: '#fff', strokeThickness: 0 }));
      L.add(txt(this, px, y + 50, `球速 ${p.pitch.velo} km/h`, 20, '#1a1a1a', { stroke: '#fff', strokeThickness: 0 }));
      L.add(txt(this, px, y + 82, '控球', 20, '#1a1a1a', { stroke: '#fff', strokeThickness: 0 }));
      L.add(gradeText(this, px + 50, y + 76, p.pitch.control, 26));
      L.add(txt(this, px + 120, y + 82, '體力', 20, '#1a1a1a', { stroke: '#fff', strokeThickness: 0 }));
      L.add(gradeText(this, px + 170, y + 76, p.pitch.stamina, 26));
      Object.entries(p.pitch.pitches).forEach(([k, lv], i) => {
        L.add(txt(this, px, y + 120 + i * 32, k, 19, '#1a1a1a', { stroke: '#fff', strokeThickness: 0 }));
        const bar = this.add.graphics();
        for (let j = 0; j < 7; j++) {
          bar.fillStyle(j < lv ? 0xffc928 : 0xcccccc, 1);
          bar.fillRect(px + 60 + j * 22, y + 124 + i * 32, 18, 16);
        }
        L.add(bar);
        L.add(txt(this, px + 222, y + 120 + i * 32, String(lv), 19, '#c2185b', { stroke: '#fff', strokeThickness: 0 }));
      });
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    speak(`${TEAMS[this.teamId].name}，出發！`);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game', { teamId: this.teamId, innings: this.innings, userHome: this.userHome });
    });
  }
}
