import { physicsFromStats } from '../data/characters.js';
import { TOTAL_LAPS } from '../config.js';

export const KART_RADIUS = 19;
const NITRO_MAX_SLOTS = 2;
const MAX_ITEMS = 2;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * 卡丁車：物理與比賽狀態（純邏輯），外觀由 scene 提供時才建立。
 * input: { throttle, brake, steer(-1~1), drift(bool), nitro(按下瞬間), item(按下瞬間), instantTap(按下瞬間) }
 */
export class Kart {
  constructor(scene, char, track, opts = {}) {
    this.scene = scene;
    this.char = char;
    this.track = track;
    this.isPlayer = !!opts.isPlayer;
    this.phys = physicsFromStats(char.stats);
    this.icy = !!track.data.theme.icy;
    this.fx = opts.fx || null;
    this.events = opts.events || null; // 事件回呼 (type, kart, data)

    this.x = 0;
    this.y = 0;
    this.heading = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.vF = 0;
    this.vL = 0;

    this.input = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, item: false, instantTap: false };

    // 比賽狀態
    this.idx = 0;
    this.s = 0;
    this.lap = 0;
    this.nextCp = track.checkpointCount - 1;
    this.progress = 0;
    this.finished = false;
    this.finishTime = null;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = null;
    this.rank = 1;
    this.wrongTime = 0;
    this.wrongWay = false;
    this.offroad = false;

    // 甩尾與氮氣
    this.drifting = false;
    this.driftDir = 0;
    this.driftTime = 0;
    this.instantWindow = 0;
    this.nitroGauge = 0;
    this.nitroSlots = 0;
    this.boostTime = 0;
    this.boostMul = 1;
    this.boostKind = null;
    this.startBoostReady = false;

    // 道具與狀態
    this.items = [];
    this.spinTime = 0;
    this.spinVisual = 0;
    this.trapTime = 0;
    this.shieldTime = 0;
    this.invulnTime = 0;
    this.speedMul = 1; // AI 動態平衡用
    this.skidTimer = 0;
    this.wallCooldown = 0;
    this.autopilot = false;

    this.view = null;
    if (scene && scene.add) this.createView();
  }

  createView() {
    const sc = this.scene;
    const v = {};
    v.shadow = sc.add.image(0, 0, 'shadow').setDepth(4).setAlpha(0.8);
    v.body = sc.add.image(0, 0, `kart_${this.char.id}`).setDepth(5);
    v.head = sc.add.image(0, 0, `head_${this.char.id}`).setDepth(6).setScale(0.32);
    v.shield = sc.add.image(0, 0, 'shieldfx').setDepth(7).setVisible(false).setScale(0.85);
    v.bubble = sc.add.image(0, 0, 'bubble').setDepth(7).setVisible(false);
    if (this.isPlayer) {
      v.marker = sc.add.image(0, 0, 'marker').setDepth(8);
      sc.tweens.add({ targets: v.marker, scale: { from: 0.9, to: 1.15 }, yoyo: true, repeat: -1, duration: 400 });
    }
    this.view = v;
  }

  destroyView() {
    if (!this.view) return;
    Object.values(this.view).forEach((o) => o && o.destroy());
    this.view = null;
  }

  emit(type, data) {
    if (this.events) this.events(type, this, data);
  }

  placeAt(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.vx = this.vy = 0;
    const p = this.track.project(x, y, -1);
    this.idx = p.idx;
    this.s = p.s;
    this.updateProgress();
    this.syncView(0);
  }

  get maxSpeedNow() {
    let m = this.phys.maxSpeed * this.speedMul;
    if (this.offroad && this.boostTime <= 0) m *= 0.55;
    else if (this.offroad) m *= 0.8;
    if (this.boostTime > 0) m *= this.boostMul;
    return m;
  }

  get locked() {
    return this.spinTime > 0 || this.trapTime > 0;
  }

  /** dt 秒；active=false 時（倒數中）只能原地 */
  update(dt, active, raceTime) {
    const p = this.phys;
    const inp = this.input;
    const locked = this.locked || !active;

    // 計時器
    this.spinTime = Math.max(0, this.spinTime - dt);
    this.trapTime = Math.max(0, this.trapTime - dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.instantWindow = Math.max(0, this.instantWindow - dt);
    this.wallCooldown = Math.max(0, this.wallCooldown - dt);
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (this.boostTime <= 0) {
        this.boostTime = 0;
        this.boostMul = 1;
        this.boostKind = null;
      }
    }

    const maxSpeed = this.maxSpeedNow;
    const throttle = locked ? 0 : inp.throttle;
    const brake = locked ? 0 : inp.brake;
    const steer = locked ? 0 : inp.steer;

    // --- 轉向 ---
    let fx = Math.cos(this.heading);
    let fy = Math.sin(this.heading);
    const curVF = this.vx * fx + this.vy * fy;
    const speedFactor = Math.min(1, Math.abs(curVF) / 140);
    let turn = 0;
    if (this.drifting) {
      turn = (steer * 0.75 + this.driftDir * 0.45) * p.turnRate * p.driftTurn * speedFactor;
    } else {
      // 高速時稍微降低轉向
      const hs = 1 - 0.25 * Math.min(1, Math.abs(curVF) / p.maxSpeed);
      turn = steer * p.turnRate * speedFactor * hs * Math.sign(curVF || 1);
    }
    if (this.spinTime > 0) {
      this.spinVisual += dt * 14;
    } else {
      this.spinVisual = 0;
    }
    this.heading = wrapAngle(this.heading + turn * dt);

    fx = Math.cos(this.heading);
    fy = Math.sin(this.heading);
    const rx = -fy;
    const ry = fx;
    let vF = this.vx * fx + this.vy * fy;
    let vL = this.vx * rx + this.vy * ry;

    // --- 甩尾 ---
    const wantDrift = !locked && inp.drift && Math.abs(steer) > 0.15 && vF > 220;
    if (!this.drifting && wantDrift) {
      this.drifting = true;
      this.driftDir = Math.sign(steer);
      this.driftTime = 0;
      // 小小側滑起步
      vL -= this.driftDir * 40;
    } else if (this.drifting && (!inp.drift || vF < 140 || locked)) {
      this.endDrift(locked);
    }
    if (this.drifting) {
      this.driftTime += dt;
      const slip = Math.min(1.3, Math.max(0.35, Math.abs(vL) / 140));
      if (this.nitroSlots < NITRO_MAX_SLOTS) {
        this.nitroGauge += p.driftCharge * slip * dt;
        if (this.nitroGauge >= 100) {
          this.nitroGauge = 0;
          this.nitroSlots++;
          this.emit('nitroReady');
        }
      }
      vF -= 55 * dt;
    }

    // --- 瞬間加速 ---
    if (this.instantWindow > 0 && inp.instantTap && !locked) {
      this.instantWindow = 0;
      this.addBoost(0.9, 1.22, 'instant');
      vF += 90;
      this.emit('instant');
    }

    // --- 引擎 ---
    if (this.boostTime > 0 && !locked) {
      if (vF < maxSpeed) vF = Math.min(maxSpeed, vF + p.accel * 2.4 * dt);
    } else if (throttle > 0) {
      if (vF < maxSpeed) {
        const k = Math.max(0.3, 1 - (vF / maxSpeed) * 0.65);
        vF += p.accel * k * throttle * dt;
      }
    }
    if (brake > 0) {
      if (vF > 20) vF -= 950 * brake * dt;
      else vF = Math.max(-maxSpeed * 0.35, vF - p.accel * 0.6 * brake * dt);
    }
    if (throttle <= 0 && brake <= 0 && !(this.boostTime > 0 && !locked)) {
      const drag = (locked ? 700 : 170) * dt;
      if (Math.abs(vF) <= drag) vF = 0;
      else vF -= Math.sign(vF) * drag;
    }
    if (vF > maxSpeed) {
      vF -= (vF - maxSpeed) * (this.offroad ? 4 : 2) * dt;
    }
    if (this.trapTime > 0) vF *= Math.exp(-6 * dt);

    // --- 抓地力 ---
    let grip = this.drifting ? 1.5 : p.grip;
    if (this.icy) grip *= this.drifting ? 0.8 : 0.6;
    if (this.spinTime > 0) grip = 3;
    const newVL = vL * Math.exp(-grip * dt);
    const lost = Math.abs(vL - newVL);
    vL = newVL;
    if (!this.drifting && !locked && vF > 50 && vF < maxSpeed) vF = Math.min(maxSpeed, vF + lost * 0.35); // 側滑動能部分轉為前進

    this.vF = vF;
    this.vL = vL;
    this.vx = fx * vF + rx * vL;
    this.vy = fy * vF + ry * vL;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.collideWalls();

    this.speed = Math.hypot(this.vx, this.vy);

    // 逆向偵測
    if (active && !this.finished) {
      const t = this.track;
      const dot = fx * t.tx[this.idx] + fy * t.ty[this.idx];
      if (dot < -0.35 && Math.abs(vF) > 60) this.wrongTime += dt;
      else this.wrongTime = Math.max(0, this.wrongTime - dt * 2);
      this.wrongWay = this.wrongTime > 0.9;
    } else {
      this.wrongWay = false;
      this.wrongTime = 0;
    }

    this.updateLap(raceTime);
    this.syncView(dt);

    // 單次輸入清除
    inp.nitro = false;
    inp.item = false;
    inp.instantTap = false;
  }

  endDrift(locked) {
    this.drifting = false;
    if (!locked && this.driftTime > 0.35) {
      this.instantWindow = 0.5;
      this.emit('driftEnd');
    }
    this.driftTime = 0;
  }

  collideWalls() {
    const t = this.track;
    const pr = t.project(this.x, this.y, this.idx);
    this.idx = pr.idx;
    const limit = t.wallHalf - KART_RADIUS;
    if (pr.dist > limit) {
      const nx = (this.x - pr.cx) / (pr.dist || 1);
      const ny = (this.y - pr.cy) / (pr.dist || 1);
      this.x = pr.cx + nx * limit;
      this.y = pr.cy + ny * limit;
      const vn = this.vx * nx + this.vy * ny;
      if (vn > 0) {
        this.vx -= nx * vn * 1.35;
        this.vy -= ny * vn * 1.35;
        if (vn > 140) {
          this.vx *= 0.82;
          this.vy *= 0.82;
          if (this.wallCooldown <= 0) {
            this.wallCooldown = 0.25;
            this.emit('wall', { x: pr.cx + nx * t.wallHalf, y: pr.cy + ny * t.wallHalf, power: vn });
          }
        }
      }
    }
    this.offroad = pr.dist > t.roadHalf + 6;
    this.lastProj = pr;
    this._newS = pr.s;
  }

  updateLap(raceTime) {
    const t = this.track;
    const L = t.length;
    const prev = this.s;
    const cur = this._newS != null ? this._newS : prev;
    let d = cur - prev;
    if (prev > L * 0.75 && cur < L * 0.25) {
      // 向前越過起終點線
      if (this.nextCp >= t.checkpointCount - 1) {
        this.lap++;
        this.nextCp = 0;
        if (this.lap >= 2 && !this.finished) {
          const lt = raceTime - this.lapStart;
          this.lapTimes.push(lt);
          if (this.bestLap == null || lt < this.bestLap) this.bestLap = lt;
        }
        this.lapStart = raceTime;
        if (this.lap > TOTAL_LAPS && !this.finished) {
          this.finished = true;
          this.finishTime = raceTime;
          this.emit('finish');
        } else if (this.lap >= 2) {
          this.emit('lap', { lap: this.lap });
        }
      }
    } else if (prev < L * 0.25 && cur > L * 0.75) {
      // 倒退越過起終點線
      this.lap--;
      this.nextCp = t.checkpointCount - 1;
    } else if (this.nextCp < t.checkpointCount - 1 && Math.abs(d) < L / 2) {
      const cs = t.checkpointS[this.nextCp];
      if (prev < cs && cur >= cs) this.nextCp++;
    }
    this.s = cur;
    this.updateProgress();
  }

  updateProgress() {
    if (this.finished) {
      // 完賽者依完賽時間排序（放大確保在未完賽者之前）
      this.progress = 1e9 - (this.finishTime || 0);
    } else {
      this.progress = (this.lap - 1) * this.track.length + this.s;
    }
  }

  get displayLap() {
    return Math.max(1, Math.min(TOTAL_LAPS, this.lap));
  }

  addBoost(time, mul, kind) {
    this.boostTime = Math.max(this.boostTime, time);
    this.boostMul = Math.max(this.boostTime > 0 ? this.boostMul : 1, mul);
    if (!this.boostKind || kind !== 'instant') this.boostKind = kind;
  }

  useNitro() {
    if (this.nitroSlots <= 0 || this.locked) return false;
    this.nitroSlots--;
    this.addBoost(2.2, 1.45, 'nitro');
    const fx = Math.cos(this.heading);
    const fy = Math.sin(this.heading);
    this.vx += fx * 120;
    this.vy += fy * 120;
    this.emit('nitro');
    return true;
  }

  giveItem(type) {
    if (this.items.length >= MAX_ITEMS) return false;
    this.items.push(type);
    return true;
  }

  takeItem() {
    if (this.items.length === 0 || this.locked) return null;
    return this.items.shift();
  }

  /** 受到攻擊（回傳是否真的受到影響） */
  hit(kind) {
    if (this.finished) return false;
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.invulnTime = 0.6;
      this.emit('blocked');
      return false;
    }
    if (this.invulnTime > 0) return false;
    this.drifting = false;
    this.boostTime = 0;
    this.boostMul = 1;
    this.boostKind = null;
    if (kind === 'water') {
      this.trapTime = 1.5;
      this.invulnTime = 2.3;
      this.vx *= 0.2;
      this.vy *= 0.2;
    } else {
      this.spinTime = kind === 'missile' ? 1.4 : 1.0;
      this.invulnTime = this.spinTime + 0.8;
      this.vx *= 0.35;
      this.vy *= 0.35;
    }
    this.emit('hit', { kind });
    return true;
  }

  respawn() {
    const p = this.track.pointAt(this.s, 0);
    this.x = p.x;
    this.y = p.y;
    this.heading = p.heading;
    this.vx = this.vy = 0;
    this.drifting = false;
    this.idx = p.idx;
    this.invulnTime = 1.5;
    this.syncView(0);
  }

  syncView(dt) {
    const v = this.view;
    if (!v) return;
    const h = this.heading;
    const rot = h + this.spinVisual;
    v.body.setPosition(this.x, this.y).setRotation(rot);
    v.shadow.setPosition(this.x + 5, this.y + 7).setRotation(rot);
    const bob = this.speed > 30 ? Math.sin(performance.now() / 70) * 0.8 : 0;
    v.head.setPosition(this.x - Math.cos(h) * 5, this.y - Math.sin(h) * 5 - 8 + bob);
    // 無敵閃爍
    const blink = this.invulnTime > 0 && !this.locked && Math.floor(performance.now() / 80) % 2 === 0;
    v.body.setAlpha(blink ? 0.45 : 1);
    v.head.setAlpha(blink ? 0.45 : 1);
    v.shield.setVisible(this.shieldTime > 0);
    if (this.shieldTime > 0) v.shield.setPosition(this.x, this.y).setRotation(performance.now() / 300);
    v.bubble.setVisible(this.trapTime > 0);
    if (this.trapTime > 0) v.bubble.setPosition(this.x, this.y - 4).setScale(0.8 + Math.sin(performance.now() / 120) * 0.04);
    if (v.marker) v.marker.setPosition(this.x, this.y - 44);

    if (!this.fx || dt <= 0) return;
    // 甩尾胎痕與煙
    const fx = Math.cos(h);
    const fy = Math.sin(h);
    if (this.drifting || (this.spinTime > 0 && this.speed > 60) || (Math.abs(this.vL) > 120 && this.speed > 150)) {
      this.skidTimer -= dt;
      if (this.skidTimer <= 0) {
        this.skidTimer = 0.016;
        for (const side of [-1, 1]) {
          const wx = this.x - fx * 16 - fy * side * 15;
          const wy = this.y - fy * 16 + fx * side * 15;
          this.fx.skid(wx, wy, h);
        }
        if (Math.random() < 0.5) this.fx.smoke(this.x - fx * 22, this.y - fy * 22, 0.5);
      }
    }
    if (this.offroad && this.speed > 120 && Math.random() < 0.4) {
      this.fx.dust(this.x - fx * 20, this.y - fy * 20, this.track.data.theme.off);
    }
    if (this.boostTime > 0) {
      const kind = this.boostKind === 'instant' ? 'blueflame' : 'flame';
      for (const side of [-1, 1]) {
        this.fx.flame(this.x - fx * 32 - fy * side * 6, this.y - fy * 32 + fx * side * 6, h, kind);
      }
    }
  }
}
