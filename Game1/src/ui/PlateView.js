// 捕手後方視角：投手丘、好球帶、打者、投球軌跡、打擊游標
import Phaser from 'phaser';
import Chibi from './Chibi.js';
import { ZONE, RELEASE, pitchPos } from '../systems/physics.js';
import { lerpColor } from './common.js';

export const CAM = { z: -3.0, h: 1.05, f: 1046, cx: 640, horizon: 330 };

export function project(x, y, z) {
  const s = CAM.f / (z - CAM.z);
  return { x: CAM.cx + x * s, y: CAM.horizon - (y - CAM.h) * s, s };
}

// 好球帶螢幕座標
const zTL = project(-ZONE.halfW, ZONE.top, 0);
const zBR = project(ZONE.halfW, ZONE.bottom, 0);
export const ZONE_SCREEN = { left: zTL.x, top: zTL.y, right: zBR.x, bottom: zBR.y, cx: (zTL.x + zBR.x) / 2, cy: (zTL.y + zBR.y) / 2 };
export const PX_PER_M = project(0, 0, 0).s;

// 螢幕座標 ↔ 本壘板平面公尺
export function screenToPlate(sx, sy) {
  const s = PX_PER_M;
  return { x: (sx - CAM.cx) / s, y: CAM.h - (sy - CAM.horizon) / s };
}

export default class PlateView {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0);
    this.drawStadium();

    this.zoneG = scene.add.graphics();
    this.root.add(this.zoneG);
    this.drawZone();

    this.pitcher = null;
    this.batter = null;

    this.shadow = scene.add.ellipse(0, 0, 20, 8, 0x000000, 0.35).setVisible(false);
    this.trail = scene.add.graphics();
    this.ball = scene.add.image(0, 0, 'ball').setVisible(false);
    this.root.add([this.shadow, this.trail]);

    // 捕手手套
    this.mitt = scene.add.graphics();
    this.mitt.fillStyle(0x9a5a22, 1); this.mitt.lineStyle(4, 0x3a2208, 1);
    this.mitt.fillEllipse(0, 0, 90, 96); this.mitt.strokeEllipse(0, 0, 90, 96);
    this.mitt.fillStyle(0x6e3c12, 1); this.mitt.fillEllipse(0, 4, 50, 52);
    this.mitt.setAlpha(0.55);
    this.mitt.setPosition(ZONE_SCREEN.cx, ZONE_SCREEN.bottom + 110);
    this.root.add(this.mitt);

    // 打擊游標
    this.cursorG = scene.add.graphics();
    // 瞄準標記（投球時）
    this.aimG = scene.add.graphics();
    this.root.add(this.ball);
    this.root.add([this.cursorG, this.aimG]);
  }

  drawStadium() {
    const s = this.scene;
    const g = s.add.graphics();
    this.root.add(g);
    // 天空 & 看台
    for (let i = 0; i < 20; i++) {
      g.fillStyle(lerpColor(0x061230, 0x1d4a8a, i / 19), 1);
      g.fillRect(0, i * 12, 1280, 13);
    }
    g.fillStyle(0x1b2a44, 1); g.fillRect(0, 180, 1280, 110);
    // 觀眾（彩色點點）
    const rng = new Phaser.Math.RandomDataGenerator(['crowd']);
    for (let i = 0; i < 900; i++) {
      const x = rng.between(0, 1280), y = rng.between(186, 282);
      const c = rng.pick([0x2a6fdb, 0xe0503a, 0xffffff, 0xffc928, 0x9ad0ff, 0xff9aa8]);
      g.fillStyle(c, 0.55); g.fillCircle(x, y, rng.between(2, 4));
    }
    // 燈塔
    [120, 1160].forEach((x) => {
      g.fillStyle(0x666f80, 1); g.fillRect(x - 4, 40, 8, 150);
      g.fillStyle(0xfff6c8, 1); g.fillRoundedRect(x - 50, 20, 100, 40, 6);
      g.fillStyle(0xffffff, 0.08); g.fillCircle(x, 40, 120);
    });
    // 外野牆
    const wallY = project(0, 3.5, 120).y;
    g.fillStyle(0x145c2e, 1); g.fillRect(0, 282, 1280, wallY - 282 + 18);
    g.fillStyle(0xffc928, 1); g.fillRect(0, 282, 1280, 3);
    // 草地（遠處較暗）
    const top = 300;
    for (let y = top; y < 720; y += 6) {
      const t = (y - top) / (720 - top);
      g.fillStyle(lerpColor(0x1f7a35, 0x3fb35a, t), 1);
      g.fillRect(0, y, 1280, 7);
    }
    // 草坪條紋（以透視畫出）
    for (let k = -6; k <= 6; k += 2) {
      const a = project(k * 4, 0, 60), b = project(k * 4 + 4, 0, 60);
      const c = project(k * 4 + 4, 0, 0.5), d = project(k * 4, 0, 0.5);
      g.fillStyle(0xffffff, 0.04);
      g.fillPoints([{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: c.x, y: c.y }, { x: d.x, y: d.y }], true);
    }
    // 內野紅土
    const dirt = [];
    for (let i = 0; i <= 24; i++) {
      const ang = -Math.PI / 4 + (i / 24) * (Math.PI / 2);
      const r = 29;
      dirt.push(project(Math.sin(ang) * r, 0, Math.cos(ang) * r));
    }
    dirt.push(project(3, 0, -1)); dirt.push(project(-3, 0, -1));
    g.fillStyle(0xc9905a, 1); g.fillPoints(dirt.map((p) => ({ x: p.x, y: p.y })), true);
    // 內野草地
    const inner = [project(0, 0, 3), project(13, 0, 19.4), project(0, 0, 35), project(-13, 0, 19.4)];
    g.fillStyle(0x3a9e50, 1); g.fillPoints(inner.map((p) => ({ x: p.x, y: p.y })), true);
    // 投手丘
    const m = project(0, 0, 18.44);
    g.fillStyle(0xb67c48, 1); g.fillEllipse(m.x, m.y, 5.5 * m.s, 1.4 * m.s);
    g.fillStyle(0xffffff, 1); g.fillRect(m.x - 0.3 * m.s, m.y - 2, 0.6 * m.s, 3);
    // 壘包
    [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]].forEach(([x, z]) => {
      const p = project(x, 0, z);
      g.fillStyle(0xffffff, 1); g.fillRect(p.x - 0.3 * p.s, p.y - 0.12 * p.s, 0.6 * p.s, 0.24 * p.s);
    });
    // 界外線
    g.lineStyle(3, 0xffffff, 0.9);
    const h0 = project(0, 0, 0.2);
    const l1 = project(-70, 0, 70), r1 = project(70, 0, 70);
    g.lineBetween(h0.x, h0.y, l1.x, l1.y); g.lineBetween(h0.x, h0.y, r1.x, r1.y);
    // 打擊區框
    g.lineStyle(3, 0xffffff, 0.85);
    [[-1.3, -0.35], [0.35, 1.3]].forEach(([a, b]) => {
      const p1 = project(a, 0, -0.9), p2 = project(b, 0, -0.9), p3 = project(b, 0, 0.9), p4 = project(a, 0, 0.9);
      g.strokePoints([{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }, { x: p3.x, y: p3.y }, { x: p4.x, y: p4.y }], true);
    });
    // 本壘板
    const hp = [project(-0.2159, 0, 0.43), project(0.2159, 0, 0.43), project(0.2159, 0, 0.2), project(0, 0, -0.02), project(-0.2159, 0, 0.2)];
    g.fillStyle(0xffffff, 1); g.fillPoints(hp.map((p) => ({ x: p.x, y: p.y })), true);
  }

  drawZone(highlight = false) {
    const g = this.zoneG;
    const z = ZONE_SCREEN;
    g.clear();
    g.lineStyle(highlight ? 4 : 2.5, 0xffffff, highlight ? 0.95 : 0.7);
    g.strokeRect(z.left, z.top, z.right - z.left, z.bottom - z.top);
    g.lineStyle(1, 0xffffff, 0.25);
    for (let i = 1; i < 3; i++) {
      const x = z.left + ((z.right - z.left) * i) / 3;
      const y = z.top + ((z.bottom - z.top) * i) / 3;
      g.lineBetween(x, z.top, x, z.bottom); g.lineBetween(z.left, y, z.right, y);
    }
  }

  setPlayers(batter, batTeam, pitcher, pitTeam) {
    if (this.pitcher) this.pitcher.destroy();
    if (this.batter) this.batter.destroy();
    const m = project(0, 0.25, 18.44);
    this.pitcher = new Chibi(this.scene, m.x, m.y, pitcher, pitTeam, 'pitcher');
    this.pitcher.setScale(-0.62, 0.62); // 面向捕手：右手在畫面左側
    this.batter = new Chibi(this.scene, 452, 690, batter, batTeam, 'batter');
    this.batter.setScale(1.3);
    this.root.addAt(this.pitcher, this.root.getIndex(this.zoneG));
    this.root.addAt(this.batter, this.root.getIndex(this.ball));
  }

  // 投球畫面：p 為投球資料，t 0~1
  showBall(p, t) {
    const w = pitchPos(p, t);
    const s = project(w.x, w.y, w.z);
    const sh = project(w.x, 0, w.z);
    this.ball.setVisible(true).setPosition(s.x, s.y).setScale(Math.max(0.05, (s.s * 0.075) / 64) * 1.25);
    this.shadow.setVisible(true).setPosition(sh.x, sh.y);
    this.shadow.setDisplaySize(s.s * 0.12, s.s * 0.035);
    // 殘影
    this.trail.clear();
    for (let k = 1; k <= 5; k++) {
      const tt = Math.max(0, t - k * 0.018);
      const ww = pitchPos(p, tt);
      const ss = project(ww.x, ww.y, ww.z);
      this.trail.fillStyle(p.color, 0.22 - k * 0.035);
      this.trail.fillCircle(ss.x, ss.y, (ss.s * 0.075) / 2 * 1.2);
    }
    return s;
  }

  hideBall() {
    this.ball.setVisible(false);
    this.shadow.setVisible(false);
    this.trail.clear();
  }

  releasePoint() { return project(RELEASE.x, RELEASE.y, RELEASE.z); }

  drawCursor(x, y, rx, ry, visible, bunt = false) {
    const g = this.cursorG;
    g.clear();
    if (!visible) return;
    const col = bunt ? 0x7dff6a : 0xffe14d;
    g.fillStyle(col, 0.18); g.fillEllipse(x, y, rx * 2, ry * 2);
    g.lineStyle(3, col, 0.95); g.strokeEllipse(x, y, rx * 2, ry * 2);
    g.lineStyle(2, 0xff5a3c, 0.9); g.strokeEllipse(x, y, rx * 0.6, ry * 0.6);
    g.fillStyle(0xff5a3c, 0.9); g.fillCircle(x, y, 3);
  }

  drawAim(x, y, visible, color = 0xff4fa3) {
    const g = this.aimG;
    g.clear();
    if (!visible) return;
    g.lineStyle(3, color, 1);
    g.strokeCircle(x, y, 16);
    g.lineBetween(x - 26, y, x - 8, y); g.lineBetween(x + 8, y, x + 26, y);
    g.lineBetween(x, y - 26, x, y - 8); g.lineBetween(x, y + 8, x, y + 26);
  }

  // 捕手手套移到球的位置
  catchAt(sx, sy) {
    this.scene.tweens.add({ targets: this.mitt, x: sx, y: sy, alpha: 0.95, duration: 90 });
    this.scene.time.delayedCall(700, () => {
      this.scene.tweens.add({ targets: this.mitt, x: ZONE_SCREEN.cx, y: ZONE_SCREEN.bottom + 110, alpha: 0.55, duration: 300 });
    });
  }

  setVisible(v) { this.root.setVisible(v); }
}
