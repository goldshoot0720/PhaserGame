// 簡化球場俯視圖：播放擊球飛行、野手移動、跑者推進
import Phaser from 'phaser';
import { FIELDERS, BASES, ballXY, runSpeed } from '../systems/fielding.js';
import { fenceDist } from '../systems/physics.js';
import { txt } from './common.js';

const K = 4.1; // px / m
const HOME = { x: 640, y: 668 };
const toS = (p) => ({ x: HOME.x + p.x * K, y: HOME.y - p.y * K });
const PLAYBACK = 1.35; // 播放速度倍率

export default class FieldView {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setVisible(false);
    this.drawField();
    this.dyn = scene.add.container(0, 0);
    this.root.add(this.dyn);
  }

  drawField() {
    const g = this.scene.add.graphics();
    this.root.add(g);
    g.fillStyle(0x10233f, 1); g.fillRect(0, 0, 1280, 720);
    // 看台
    g.fillStyle(0x1b2a44, 1);
    const stands = [];
    for (let a = -50; a <= 50; a += 2) stands.push(toS(ballXY(a, fenceDist(Math.min(45, Math.abs(a))) + 30)));
    stands.push(toS({ x: 80, y: -10 })); stands.push(toS({ x: -80, y: -10 }));
    g.fillPoints(stands, true);
    // 外野草地
    const fan = [toS({ x: 0, y: -6 })];
    for (let a = -45; a <= 45; a += 1.5) fan.push(toS(ballXY(a, fenceDist(a))));
    g.fillStyle(0x3aa655, 1); g.fillPoints(fan, true);
    // 條紋
    for (let r = 20; r < 125; r += 16) {
      g.lineStyle(7, 0x46b862, 0.6);
      g.beginPath();
      for (let a = -45; a <= 45; a += 3) {
        const d = Math.min(r, fenceDist(a));
        const p = toS(ballXY(a, d));
        if (a === -45) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    // 牆
    g.lineStyle(8, 0x145c2e, 1);
    g.beginPath();
    for (let a = -45; a <= 45; a += 1.5) { const p = toS(ballXY(a, fenceDist(a))); if (a === -45) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
    g.strokePath();
    g.lineStyle(2, 0xffc928, 1); g.strokePath();
    // 內野紅土
    const dirt = [toS({ x: 0, y: -5 })];
    for (let a = -45; a <= 45; a += 3) dirt.push(toS(ballXY(a, 29)));
    g.fillStyle(0xc9905a, 1); g.fillPoints(dirt, true);
    g.fillStyle(0x3aa655, 1);
    g.fillPoints([toS({ x: 0, y: 3 }), toS({ x: 15.5, y: 19.4 }), toS({ x: 0, y: 34.5 }), toS({ x: -15.5, y: 19.4 })], true);
    // 投手丘
    const m = toS({ x: 0, y: 18.4 });
    g.fillStyle(0xc9905a, 1); g.fillCircle(m.x, m.y, 2.8 * K);
    // 界外線
    g.lineStyle(2, 0xffffff, 0.9);
    const L = toS(ballXY(-45, fenceDist(45))), R = toS(ballXY(45, fenceDist(45)));
    g.lineBetween(HOME.x, HOME.y, L.x, L.y); g.lineBetween(HOME.x, HOME.y, R.x, R.y);
    // 壘包
    BASES.forEach((b, i) => {
      const p = toS(b);
      g.fillStyle(0xffffff, 1);
      if (i === 0) g.fillPoints([{ x: p.x - 6, y: p.y - 4 }, { x: p.x + 6, y: p.y - 4 }, { x: p.x + 6, y: p.y + 2 }, { x: p.x, y: p.y + 7 }, { x: p.x - 6, y: p.y + 2 }], true);
      else g.fillRect(p.x - 6, p.y - 6, 12, 12);
    });
    this.root.add(txt(this.scene, 1180, 90, '球場', 22, '#ffffff').setOrigin(0.5).setAlpha(0.3));
  }

  token(x, y, color, headKey, scale = 1) {
    const c = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(0, 2, 22 * scale, 8 * scale);
    g.fillStyle(color, 1); g.lineStyle(2, 0x111111, 1);
    g.fillRoundedRect(-8 * scale, -16 * scale, 16 * scale, 16 * scale, 5 * scale);
    g.strokeRoundedRect(-8 * scale, -16 * scale, 16 * scale, 16 * scale, 5 * scale);
    c.add(g);
    if (headKey) {
      const h = this.scene.add.image(0, -12 * scale, headKey).setOrigin(0.5, 0.95).setScale(0.11 * scale);
      c.add(h);
    } else {
      const h = this.scene.add.graphics();
      h.fillStyle(0xffe0c0, 1); h.lineStyle(2, 0x111111); h.fillCircle(0, -22 * scale, 9 * scale); h.strokeCircle(0, -22 * scale, 9 * scale);
      h.fillStyle(color, 1); h.fillRect(-9 * scale, -32 * scale, 18 * scale, 7 * scale);
      c.add(h);
    }
    this.dyn.add(c);
    return c;
  }

  /**
   * 播放一個守備結果
   * @param o resolvePlay 的結果
   * @param ctx { batter, oldBases, fieldTeam, batTeam, pitcherId }
   */
  play(o, ctx, onDone) {
    const sc = this.scene;
    this.dyn.removeAll(true);
    this.root.setVisible(true);
    this.root.setAlpha(0);
    sc.tweens.add({ targets: this.root, alpha: 1, duration: 150 });

    // 野手
    const fieldTokens = {};
    FIELDERS.forEach((f) => {
      const p = toS(f);
      fieldTokens[f.id] = this.token(p.x, p.y, ctx.fieldTeam.color, f.id === 'P' ? `head_${ctx.pitcherId}` : null, 1);
    });

    // 跑者
    const runnerTokens = [];
    // 壘包內存的是跑者物件 { player, uid }
    const mk = (runner, fromBase) => {
      const p = toS(BASES[fromBase]);
      const t = this.token(p.x - 8, p.y, ctx.batTeam.color, `head_${runner.player.id}`, 1.25);
      runnerTokens.push({ runner, fromBase, t });
    };
    ctx.oldBases.forEach((r, i) => { if (r) mk(r, i + 1); });
    mk(ctx.batterRunner, 0);

    // 球
    const shadow = sc.add.ellipse(HOME.x, HOME.y, 10, 5, 0x000000, 0.4);
    const ball = sc.add.image(HOME.x, HOME.y, 'ball').setScale(0.16);
    this.dyn.add([shadow, ball]);

    const samples = o.flight.samples;
    const endT = o.code === 'HR' ? samples[samples.length - 1].t : o.t;
    const dur = Math.max(700, (endT / PLAYBACK) * 1000);
    const state = { t: 0 };

    // 負責的野手跑向落點
    if (o.fielder) {
      const ft = fieldTokens[o.fielder.id];
      const target = toS(o.point);
      sc.tweens.add({ targets: ft, x: target.x, y: target.y, duration: dur * 0.92, ease: 'Sine.easeOut' });
      // 其他外野手追球
      FIELDERS.forEach((f) => {
        if (f.id === o.fielder.id) return;
        if (!f.inf && !o.fielder.inf) {
          const tk = fieldTokens[f.id];
          sc.tweens.add({ targets: tk, x: (tk.x + target.x) / 2, y: (tk.y + target.y) / 2, duration: dur });
        }
      });
    }

    // 跑者動畫
    this.animateRunners(o, ctx, runnerTokens, dur);

    // 球飛行
    sc.tweens.add({
      targets: state, t: endT, duration: dur, ease: 'Linear',
      onUpdate: () => {
        const s = sampleAt(samples, state.t);
        const p = toS(ballXY(o.spray, s.d));
        shadow.setPosition(p.x, p.y);
        ball.setPosition(p.x, p.y - s.h * K * 0.9);
        ball.setScale(0.16 + s.h * 0.012);
      },
      onComplete: () => {
        if (o.code === 'HR') {
          ball.setVisible(false); shadow.setVisible(false);
          sc.time.delayedCall(900, () => this.finish(onDone));
          return;
        }
        // 接到球 → 傳球
        if (o.throwTo != null && o.throwTo >= 0) {
          const to = toS(BASES[o.throwTo]);
          shadow.setVisible(false);
          sc.tweens.add({
            targets: ball, x: to.x, y: to.y, scale: 0.16, duration: 420, ease: 'Quad.easeIn',
            onComplete: () => sc.time.delayedCall(450, () => this.finish(onDone)),
          });
        } else {
          sc.time.delayedCall(650, () => this.finish(onDone));
        }
      },
    });
  }

  animateRunners(o, ctx, tokens, dur) {
    const sc = this.scene;
    tokens.forEach(({ runner, fromBase, t }) => {
      let dest;
      const bi = o.bases.indexOf(runner);
      if (o.runs.includes(runner)) dest = 4;
      else if (bi >= 0) dest = bi + 1;
      else dest = -1; // 出局
      const isBatter = runner === ctx.batterRunner;
      let target = dest;
      if (dest === -1) target = isBatter ? 1 : fromBase + 1;
      if (target <= fromBase) return; // 停留
      const path = [];
      for (let b = fromBase + 1; b <= target; b++) path.push(toS(BASES[b % 4]));
      const per = Math.max(260, (27.43 / runSpeed(runner.player) / PLAYBACK) * 1000);
      const totalTime = Math.max(per * path.length, dur * 0.8);
      const each = totalTime / path.length;
      sc.tweens.chain({
        targets: t,
        tweens: path.map((p) => ({ x: p.x - 8, y: p.y, duration: each, ease: 'Linear' })),
        onComplete: () => {
          if (dest === -1) {
            sc.tweens.add({ targets: t, alpha: 0.2, duration: 300 });
            const x = txt(sc, t.x, t.y - 44, 'OUT', 20, '#ff5a3c').setOrigin(0.5);
            this.dyn.add(x);
          } else if (dest === 4) {
            const x = txt(sc, t.x, t.y - 44, '得分！', 20, '#ffe14d').setOrigin(0.5);
            this.dyn.add(x);
            sc.tweens.add({ targets: x, y: x.y - 20, alpha: 0, duration: 900, delay: 300 });
          }
        },
      });
    });
  }

  finish(onDone) {
    const sc = this.scene;
    sc.tweens.add({
      targets: this.root, alpha: 0, duration: 200,
      onComplete: () => { this.root.setVisible(false); this.dyn.removeAll(true); onDone && onDone(); },
    });
  }
}

function sampleAt(samples, t) {
  // samples 以 0.02s 取樣
  const i = Math.min(samples.length - 1, Math.max(0, Math.floor(t / 0.02)));
  const a = samples[i], b = samples[Math.min(samples.length - 1, i + 1)];
  const f = Phaser.Math.Clamp((t - a.t) / 0.02, 0, 1);
  return { d: a.d + (b.d - a.d) * f, h: a.h + (b.h - a.h) * f };
}
