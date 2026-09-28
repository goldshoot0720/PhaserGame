import Phaser from 'phaser';
import { KART_RADIUS } from './Kart.js';

export const ITEM_NAMES = {
  missile: '飛彈',
  banana: '香蕉皮',
  shield: '護盾',
  booster: '加速器',
  water: '水炸彈',
};

// 依名次加權：落後者拿到更強的道具
const WEIGHTS = {
  front: { banana: 40, shield: 28, water: 17, missile: 5, booster: 10 },
  mid: { banana: 20, shield: 15, water: 25, missile: 25, booster: 15 },
  back: { banana: 5, shield: 10, water: 20, missile: 35, booster: 30 },
};

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function rollItem(rank, total, rng = Math.random) {
  const ratio = total > 1 ? (rank - 1) / (total - 1) : 0;
  const table = ratio < 0.25 ? WEIGHTS.front : ratio < 0.65 ? WEIGHTS.mid : WEIGHTS.back;
  const sum = Object.values(table).reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (const [k, w] of Object.entries(table)) {
    r -= w;
    if (r <= 0) return k;
  }
  return 'banana';
}

/** 道具箱、香蕉皮、飛彈、水炸彈的管理 */
export class ItemSystem {
  constructor(scene, track, racers, fx, onEvent) {
    this.scene = scene;
    this.track = track;
    this.racers = racers;
    this.fx = fx;
    this.onEvent = onEvent || (() => {});
    this.boxes = [];
    this.bananas = [];
    this.missiles = [];
    this.bombs = [];
    this.buildBoxes();
  }

  buildBoxes() {
    const t = this.track;
    const rows = t.data.itemRows || [0.25, 0.5, 0.75];
    for (const f of rows) {
      const s = f * t.length;
      for (const lf of [-0.64, -0.32, 0, 0.32, 0.64]) {
        const p = t.pointAt(s, lf * t.roadHalf);
        const sprite = this.scene.add.image(p.x, p.y, 'itembox').setDepth(2);
        this.scene.tweens.add({
          targets: sprite, angle: 360, duration: 3000 + Math.random() * 800, repeat: -1,
        });
        this.boxes.push({ x: p.x, y: p.y, sprite, respawn: 0 });
      }
    }
  }

  update(dt) {
    const racers = this.racers;
    const pulse = 1 + Math.sin(this.scene.time.now / 200) * 0.08;

    // 道具箱
    for (const b of this.boxes) {
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.sprite.setVisible(true).setScale(0.2);
          this.scene.tweens.add({ targets: b.sprite, scale: 1, duration: 250, ease: 'Back.Out' });
        }
        continue;
      }
      if (b.sprite.scale >= 0.99) b.sprite.setScale(pulse);
      for (const k of racers) {
        if (k.finished) continue;
        const dx = k.x - b.x;
        const dy = k.y - b.y;
        if (dx * dx + dy * dy < (KART_RADIUS + 22) ** 2) {
          b.respawn = 2.5;
          b.sprite.setVisible(false);
          this.fx.stars(b.x, b.y, 8);
          if (k.items.length < 2) {
            const type = rollItem(k.rank, racers.length);
            k.giveItem(type);
            this.onEvent('pickup', k, { type });
          }
          break;
        }
      }
    }

    // 香蕉皮
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const b = this.bananas[i];
      b.life -= dt;
      b.safe -= dt;
      let remove = b.life <= 0;
      if (!remove) {
        for (const k of racers) {
          if (k === b.owner && b.safe > 0) continue;
          const dx = k.x - b.x;
          const dy = k.y - b.y;
          if (dx * dx + dy * dy < (KART_RADIUS + 14) ** 2) {
            const affected = k.hit('banana');
            this.onEvent('banana', k, { affected, owner: b.owner });
            this.fx.stars(b.x, b.y, 6);
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        b.sprite.destroy();
        this.bananas.splice(i, 1);
      }
    }

    // 飛彈
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      m.speed = Math.min(1050, m.speed + 900 * dt);
      const t = this.track;
      const pr = t.project(m.x, m.y, m.idx);
      m.idx = pr.idx;
      let tx;
      let ty;
      const tgt = m.target;
      if (tgt && !tgt.finished) {
        const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
        const lead = Math.min(1, d / 400);
        if (d < 420) {
          tx = tgt.x + tgt.vx * 0.08 * lead;
          ty = tgt.y + tgt.vy * 0.08 * lead;
        } else {
          const lat = Phaser.Math.Clamp(tgt.lastProj ? tgt.lastProj.lateral : 0, -t.roadHalf, t.roadHalf);
          const p = t.pointAt(pr.s + 170, lat * 0.5);
          tx = p.x;
          ty = p.y;
        }
      } else {
        const p = t.pointAt(pr.s + 170, 0);
        tx = p.x;
        ty = p.y;
      }
      const want = Math.atan2(ty - m.y, tx - m.x);
      const diff = wrapAngle(want - m.heading);
      const maxTurn = 7 * dt;
      m.heading += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
      m.x += Math.cos(m.heading) * m.speed * dt;
      m.y += Math.sin(m.heading) * m.speed * dt;
      m.sprite.setPosition(m.x, m.y).setRotation(m.heading);
      m.trailT -= dt;
      if (m.trailT <= 0) {
        m.trailT = 0.02;
        this.fx.trail(m.x - Math.cos(m.heading) * 18, m.y - Math.sin(m.heading) * 18);
      }
      let explode = m.life <= 0;
      if (!explode) {
        for (const k of racers) {
          if (k === m.owner && m.age < 0.5) continue;
          if (k !== tgt && k !== m.owner && m.age < 0.3) continue;
          if (Math.hypot(k.x - m.x, k.y - m.y) < KART_RADIUS + 14) {
            const affected = k.hit('missile');
            this.onEvent('missileHit', k, { affected, owner: m.owner });
            explode = true;
            break;
          }
        }
      }
      m.age += dt;
      if (explode) {
        this.fx.boom(m.x, m.y, 26);
        m.sprite.destroy();
        this.missiles.splice(i, 1);
        this.onEvent('explode', null, { x: m.x, y: m.y });
      }
    }

    // 水炸彈
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      const x = b.x0 + (b.x1 - b.x0) * u;
      const y = b.y0 + (b.y1 - b.y0) * u;
      const h = Math.sin(u * Math.PI);
      b.sprite.setPosition(x, y - h * 60).setScale(1.2 + h * 0.8).setRotation(u * 8);
      b.shadow.setPosition(x, y).setScale(0.5 + (1 - h) * 0.3);
      if (u >= 1) {
        this.fx.splash(x, y, 34);
        const ring = this.scene.add.image(x, y, 'splash').setDepth(3).setScale(0.3).setAlpha(0.9);
        this.scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
        for (const k of racers) {
          if (k === b.owner) continue;
          if (Math.hypot(k.x - x, k.y - y) < 110) {
            const affected = k.hit('water');
            this.onEvent('waterHit', k, { affected, owner: b.owner });
          }
        }
        this.onEvent('splash', null, { x, y });
        b.sprite.destroy();
        b.shadow.destroy();
        this.bombs.splice(i, 1);
      }
    }
  }

  /** 使用道具，回傳使用的道具種類 */
  use(k) {
    const type = k.takeItem();
    if (!type) return null;
    const fx = Math.cos(k.heading);
    const fy = Math.sin(k.heading);
    switch (type) {
      case 'banana': {
        if (this.bananas.length > 24) {
          const old = this.bananas.shift();
          old.sprite.destroy();
        }
        const x = k.x - fx * 40;
        const y = k.y - fy * 40;
        const sprite = this.scene.add.image(x, y, 'banana').setDepth(3).setRotation(Math.random() * 6);
        this.scene.tweens.add({ targets: sprite, scale: { from: 1.6, to: 1 }, duration: 200 });
        this.bananas.push({ x, y, sprite, owner: k, life: 30, safe: 0.8 });
        break;
      }
      case 'missile': {
        const target = this.racers.find((r) => r.rank === k.rank - 1 && !r.finished) || null;
        const sprite = this.scene.add.image(k.x + fx * 30, k.y + fy * 30, 'missile').setDepth(7);
        this.missiles.push({
          x: k.x + fx * 30, y: k.y + fy * 30, heading: k.heading, speed: Math.max(400, k.speed + 250),
          target, owner: k, life: target ? 7 : 2.5, idx: k.idx, sprite, trailT: 0, age: 0,
        });
        if (target) this.onEvent('targeted', target, { owner: k });
        break;
      }
      case 'water': {
        const t = this.track;
        let x1 = k.x + fx * 430;
        let y1 = k.y + fy * 430;
        const pr = t.project(x1, y1, -1);
        if (pr.dist > t.roadHalf) {
          x1 = pr.cx + ((x1 - pr.cx) / pr.dist) * t.roadHalf;
          y1 = pr.cy + ((y1 - pr.cy) / pr.dist) * t.roadHalf;
        }
        const shadow = this.scene.add.image(k.x, k.y, 'shadow').setDepth(3).setScale(0.5);
        const sprite = this.scene.add.image(k.x, k.y, 'waterball').setDepth(8);
        this.bombs.push({ x0: k.x, y0: k.y, x1, y1, t: 0, dur: 0.6, sprite, shadow, owner: k });
        break;
      }
      case 'shield':
        k.shieldTime = 6;
        break;
      case 'booster':
        k.addBoost(1.8, 1.5, 'booster');
        k.vx += fx * 150;
        k.vy += fy * 150;
        break;
      default:
        break;
    }
    this.onEvent('use', k, { type });
    return type;
  }

  isTargeted(k) {
    return this.missiles.some((m) => m.target === k);
  }

  /** 前方是否有香蕉皮（供 AI 閃避），回傳 {lateral} */
  hazardAhead(k, dist) {
    const fx = Math.cos(k.heading);
    const fy = Math.sin(k.heading);
    let best = null;
    let bestD = dist;
    for (const b of this.bananas) {
      const dx = b.x - k.x;
      const dy = b.y - k.y;
      const along = dx * fx + dy * fy;
      if (along < 0 || along > bestD) continue;
      const side = -dx * fy + dy * fx;
      if (Math.abs(side) > 45) continue;
      bestD = along;
      // 以賽道座標表示香蕉位置
      const pr = this.track.project(b.x, b.y, k.idx);
      best = { lateral: pr.lateral / this.track.roadHalf };
    }
    return best;
  }

  destroy() {
    for (const b of this.boxes) b.sprite.destroy();
    for (const b of this.bananas) b.sprite.destroy();
    for (const m of this.missiles) m.sprite.destroy();
    for (const b of this.bombs) {
      b.sprite.destroy();
      b.shadow.destroy();
    }
  }
}
