// Race: pseudo-3D chase-camera kart race — 3 laps vs 7 CPU karts, drifting mini-turbos and items.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { createRoad, type PseudoRoad } from '../../engine/packs/route.js';
import { preloadArt, registerArt, drawBottom, type Frames } from '../art.js';
import { label, panel, clamp, lerp, fmtTime } from '../ui.js';
import {
  RACERS, TRACKS, ITEMS, rollItem, standings, LAPS, MAX_SPEED, ACCEL, BRAKE, COAST, OFFROAD_MAX, STEER, CENTRIFUGAL,
  BOOST_MUL, SEGMENT, ROAD_W, KART_W, KMH, ART, type Racer, type Track, type ItemId,
} from '../data.js';
import { session, loadBest, saveBest } from '../session.js';

interface Kart {
  r: Racer; you: boolean;
  z: number; x: number; speed: number; total: number;
  lap: number; finishT: number;
  boost: number; spin: number; star: number;
  drift: number; driftDir: number;
  item: ItemId | null; itemT: number;
  skill: number; line: number; hitCd: number;
}
interface Hazard { z: number; x: number; }
interface Shot { z: number; x: number; speed: number; owner: Kart; life: number; }
interface Box { z: number; x: number; respawn: number; }

const rng = Math.random;
const CAR_Y_OFF = 40;   // player kart bottom, px above the view bottom

export class Race extends Scene {
  private f!: Frames;
  private tr!: Track;
  private road!: PseudoRoad;
  private len = 1;
  private karts: Kart[] = [];
  private me!: Kart;
  private hazards: Hazard[] = [];
  private shots: Shot[] = [];
  private boxes: Box[] = [];
  private props: { z: number; x: number }[] = [];
  private t = 0;          // race clock (after GO)
  private count = 3.6;    // countdown
  private camGap = 1000;  // road distance from camera to the player kart
  private finished = false;
  private endT = 0;
  private msg = '';
  private msgT = 0;
  private skyShift = 0;
  private lastLap = 0;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    this.tr = TRACKS[session.track] ?? TRACKS[0];
    this.road = createRoad({ pieces: this.tr.pieces, segmentLength: SEGMENT, roadWidth: ROAD_W, lanes: 3, camHeight: 1000, drawDistance: 180 });
    this.len = this.road.length;
    this.input.bind({
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], gas: ['ArrowUp', 'KeyW', 'KeyZ'], brake: ['ArrowDown', 'KeyS'],
      drift: ['ShiftLeft', 'ShiftRight', 'KeyC'], item: ['Space', 'KeyX'], quit: ['Escape'],
    });
    this.sound.define('box', { notes: 'C6 E6 G6', step: 0.04, type: 'square', volume: 0.25 });
    this.sound.define('boost', { type: 'sawtooth', freq: 200, freqEnd: 900, duration: 0.4, volume: 0.25 });
    this.sound.define('spin', { type: 'square', freq: 700, freqEnd: 120, duration: 0.5, volume: 0.3 });
    this.sound.define('beep', { type: 'square', freq: 660, duration: 0.15, volume: 0.3 });
    this.sound.define('go', { type: 'square', freq: 1320, duration: 0.4, volume: 0.3 });
    this.sound.define('bump', { type: 'noise', duration: 0.12, volume: 0.4, filter: { type: 'lowpass', freq: 500 } });
    if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }

    // Grid: the player starts 5th.
    const order = [...RACERS.filter((r) => r.id !== session.racer)];
    order.splice(4, 0, RACERS.find((r) => r.id === session.racer) ?? RACERS[0]);
    this.karts = order.map((r, i) => ({
      r, you: r.id === session.racer,
      z: this.len - 600 - i * 520, x: i % 2 ? 0.45 : -0.45, speed: 0, total: -600 - i * 520,
      lap: 0, finishT: -1, boost: 0, spin: 0, star: 0, drift: 0, driftDir: 0, item: null, itemT: 0,
      skill: 0.86 + (7 - i) * 0.016 + rng() * 0.02, line: (rng() - 0.5) * 0.5, hitCd: 0,
    }));
    this.me = this.karts.find((k) => k.you)!;

    // Item box rows every quarter lap, props along the verge.
    for (let q = 1; q <= 4; q++) for (const x of [-0.55, 0, 0.55]) this.boxes.push({ z: (this.len * (q - 0.5)) / 4, x, respawn: 0 });
    for (let z = 0; z < this.len; z += SEGMENT * 6) {
      this.props.push({ z, x: -1.6 - rng() * 0.6 });
      if ((z / (SEGMENT * 6)) % 2 === 0) this.props.push({ z: z + SEGMENT * 3, x: 1.6 + rng() * 0.6 });
    }
  }

  private say(s: string, t = 1.2): void { this.msg = s; this.msgT = t; }
  private wrap(z: number): number { return ((z % this.len) + this.len) % this.len; }
  private place(k: Kart): number { return standings(this.karts).indexOf(k); }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    dt = Math.min(dt, 1 / 30);
    if (this.input.keys.quit.pressed) { this.gotoTitle(); return; }
    if (this.msgT > 0) this.msgT -= dt;

    if (this.count > 0) {
      const before = Math.ceil(this.count - 0.6);
      this.count -= dt;
      const after = Math.ceil(this.count - 0.6);
      if (after !== before) this.sound.play(after <= 0 ? 'go' : 'beep');
      // Rocket start: holding gas right at GO.
      if (this.count <= 0 && this.input.keys.gas.held) { this.me.boost = 1.0; this.say('火箭起步！', 0.9); }
      return;
    }
    this.t += dt;

    this.playerDrive(dt);
    for (const k of this.karts) if (!k.you) this.aiDrive(k, dt);
    for (const k of this.karts) this.integrate(k, dt);
    this.collide(dt);
    this.updateItems(dt);

    if (this.finished) {
      this.endT += dt;
      if (this.endT > 3.2) this.finishRace();
    }
  }

  private maxFor(k: Kart): number {
    let m = MAX_SPEED * k.r.speed;
    if (Math.abs(k.x) > 1.05) m *= OFFROAD_MAX;
    if (k.boost > 0 || k.star > 0) m *= BOOST_MUL;
    return m;
  }

  private playerDrive(dt: number): void {
    const k = this.me, keys = this.input.keys;
    if (k.finishT >= 0) { k.speed = lerp(k.speed, MAX_SPEED * 0.5, dt); return; }
    if (k.spin > 0) return;
    const steer = (keys.right.held ? 1 : 0) - (keys.left.held ? 1 : 0);
    const sp = k.speed / MAX_SPEED;
    const max = this.maxFor(k);
    if (keys.gas.held || k.boost > 0) k.speed += ACCEL * k.r.accel * (k.boost > 0 ? 2 : 1) * dt;
    else if (keys.brake.held) k.speed -= BRAKE * dt;
    else k.speed -= COAST * dt;
    if (k.speed > max) k.speed = Math.max(max, k.speed - BRAKE * 0.6 * dt);
    k.speed = Math.max(0, k.speed);

    // Drift: hold drift + steer at speed to charge a mini-turbo.
    if (keys.drift.held && steer !== 0 && sp > 0.5) {
      if (k.driftDir === 0) k.driftDir = steer;
      k.drift += dt;
    } else if (k.driftDir !== 0) {
      if (k.drift > 1.6) { k.boost = 1.4; this.sound.play('boost'); this.say('超級迦轉加速！', 0.8); }
      else if (k.drift > 0.8) { k.boost = 0.8; this.sound.play('boost'); }
      k.drift = 0; k.driftDir = 0;
    }
    const grip = this.tr.grip * k.r.handling;
    const drifting = k.driftDir !== 0;
    k.x += steer * STEER * grip * (drifting ? 1.3 : 1) * Math.min(1, sp * 1.4) * dt;
    if (drifting) k.x += k.driftDir * 0.35 * dt;
    k.x -= this.road.curveAt(k.z + this.camGap * 0) * sp * sp * CENTRIFUGAL * (drifting ? 0.55 : 1) / grip * dt * 2;
    if (drifting && k.drift > 0.4) {
      const col = k.drift > 1.6 ? ['#ff9a3c', '#ffe066'] : k.drift > 0.8 ? ['#5cc8ff', '#ffffff'] : ['#ffffff'];
      const H = this.height, W = this.width;
      this.game.fx.emit({ x: W / 2 - 70, y: H - CAR_Y_OFF - 8, count: 2, speed: 90, life: 0.25, size: 5, colors: col, add: true });
      this.game.fx.emit({ x: W / 2 + 70, y: H - CAR_Y_OFF - 8, count: 2, speed: 90, life: 0.25, size: 5, colors: col, add: true });
    }
    if (this.input.keys.item.pressed) this.useItem(k);
  }

  private aiDrive(k: Kart, dt: number): void {
    if (k.spin > 0) return;
    // Racing line: lean into the upcoming corner, dodge hazards.
    const ahead = this.road.curveAt(k.z + 2400);
    let tx = clamp(-ahead * 0.1 + k.line, -0.75, 0.75);
    for (const h of this.hazards) {
      const dz = this.wrap(h.z - k.z);
      if (dz < 1800 && Math.abs(h.x - tx) < 0.3) tx = h.x > 0 ? h.x - 0.45 : h.x + 0.45;
    }
    k.x += clamp(tx - k.x, -1, 1) * 1.6 * dt;
    // Rubber band around the player.
    const gap = k.total - this.me.total;
    const band = gap > 4000 ? 0.93 : gap < -4000 ? 1.07 : 1;
    const target = this.maxFor(k) * (k.finishT >= 0 ? 0.6 : k.skill * band);
    k.speed += clamp(target - k.speed, -BRAKE * dt, ACCEL * k.r.accel * dt);
    // Items.
    if (k.item) {
      k.itemT -= dt;
      if (k.itemT <= 0) {
        if (k.item === 'bubble') { const tgt = this.nextAhead(k); if (tgt && tgt.total - k.total < 5000) this.useItem(k); }
        else this.useItem(k);
      }
    }
  }

  private integrate(k: Kart, dt: number): void {
    if (k.spin > 0) { k.spin -= dt; k.speed = Math.max(0, k.speed - BRAKE * 0.5 * dt); }
    if (k.boost > 0) k.boost -= dt;
    if (k.star > 0) k.star -= dt;
    if (k.hitCd > 0) k.hitCd -= dt;
    k.x = clamp(k.x, -2.0, 2.0);
    const dz = k.speed * dt;
    const prevLap = Math.floor(k.total / this.len);
    k.z = this.wrap(k.z + dz);
    k.total += dz;
    const lap = Math.floor(k.total / this.len);
    if (lap > prevLap && lap >= 1) {
      k.lap = lap;
      if (lap >= LAPS && k.finishT < 0) {
        k.finishT = this.t;
        if (k.you) { this.finished = true; this.say(`衝線！第 ${this.place(k) + 1} 名`, 3); this.sound.play({ notes: 'C5 E5 G5 C6:3', step: 0.1, type: 'square', volume: 0.35 }); }
      } else if (k.you) {
        this.say(lap === LAPS - 1 ? '最後一圈！' : `第 ${lap + 1} 圈`, 1.3);
        this.sound.play({ notes: 'E5 A5', step: 0.08, type: 'square', volume: 0.3 });
      }
    }
  }

  private hit(k: Kart, why: string): void {
    if (k.star > 0 || k.spin > 0) return;
    k.spin = 1.0;
    k.speed *= 0.35;
    k.drift = 0; k.driftDir = 0;
    if (k.you) { this.sound.play('spin'); this.say(why, 1); this.camera.shake(6, 0.3); }
  }

  private collide(dt: number): void {
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      let dz = b.total - a.total;
      if (Math.abs(dz) > 260 || Math.abs(a.x - b.x) > 0.34) continue;
      const [back, front] = dz > 0 ? [a, b] : [b, a];
      if (back.star > 0 && front.star <= 0) { this.hit(front, '被無敵星撞飛了！'); continue; }
      if (front.star > 0 && back.star <= 0) { this.hit(back, '被無敵星撞飛了！'); continue; }
      back.speed = Math.min(back.speed, front.speed * 0.92);
      const push = a.x < b.x ? -1 : 1;
      a.x += push * 0.04; b.x -= push * 0.04;
      if ((a.you || b.you) && a.hitCd <= 0 && b.hitCd <= 0) { this.sound.play('bump'); a.hitCd = b.hitCd = 0.4; }
    }
  }

  private nextAhead(k: Kart): Kart | null {
    let best: Kart | null = null, bd = Infinity;
    for (const o of this.karts) { const d = o.total - k.total; if (o !== k && d > 0 && d < bd) { bd = d; best = o; } }
    return best;
  }

  private useItem(k: Kart): void {
    const it = k.item;
    if (!it) return;
    k.item = null;
    switch (it) {
      case 'fish': k.boost = 1.6; if (k.you) this.sound.play('boost'); break;
      case 'star': k.star = 5; if (k.you) { this.sound.play({ notes: 'C6 D6 E6 G6 E6 G6', step: 0.06, type: 'square', volume: 0.25 }); this.say('無敵狀態！', 1); } break;
      case 'banana': this.hazards.push({ z: this.wrap(k.z - 500), x: k.x }); break;
      case 'bubble': this.shots.push({ z: this.wrap(k.z + 300), x: k.x, speed: k.speed + 4500, owner: k, life: 4 }); if (k.you) this.sound.play({ type: 'sine', freq: 400, freqEnd: 900, duration: 0.2, volume: 0.3 }); break;
    }
  }

  private updateItems(dt: number): void {
    // Boxes.
    for (const b of this.boxes) {
      if (b.respawn > 0) { b.respawn -= dt; continue; }
      for (const k of this.karts) {
        const dz = this.wrap(k.z - b.z);
        if ((dz < 260 || dz > this.len - 60) && Math.abs(k.x - b.x) < 0.3) {
          b.respawn = 3;
          if (!k.item) {
            k.item = rollItem(this.place(k), this.karts.length, rng());
            k.itemT = 1 + rng() * 3;
            if (k.you) this.sound.play('box');
          }
          break;
        }
      }
    }
    // Bananas.
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      for (const k of this.karts) {
        const dz = this.wrap(k.z - h.z);
        if ((dz < 200 || dz > this.len - 60) && Math.abs(k.x - h.x) < 0.22) {
          this.hazards.splice(i, 1);
          this.hit(k, '踩到香蕉皮！');
          break;
        }
      }
    }
    // Bubble shots home onto the next kart ahead.
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.z = this.wrap(s.z + s.speed * dt);
      let hitK: Kart | null = null, bd = Infinity;
      for (const k of this.karts) {
        if (k === s.owner) continue;
        const dz = this.wrap(k.z - s.z);
        const fwd = dz < this.len / 2 ? dz : dz - this.len;
        if (fwd > -150 && fwd < 3500 && fwd < bd) { bd = fwd; hitK = k; }
      }
      if (hitK) s.x += clamp(hitK.x - s.x, -1, 1) * 3 * dt;
      if (hitK && Math.abs(bd) < 200 && Math.abs(hitK.x - s.x) < 0.3) { this.hit(hitK, '被泡泡彈打中！'); this.shots.splice(i, 1); continue; }
      if (s.life <= 0) this.shots.splice(i, 1);
    }
  }

  private finishRace(): void {
    // Karts still racing are ranked by where they are.
    const est = (k: Kart): number => k.finishT >= 0 ? k.finishT : this.t + (LAPS * this.len - k.total) / Math.max(3000, k.speed);
    const order = [...this.karts].sort((a, b) => est(a) - est(b));
    const place = order.indexOf(this.me);
    const prev = loadBest(session.track);
    const time = this.me.finishT;
    if (!prev || time < prev) saveBest(session.track, time);
    session.result = { order: order.map((k) => ({ id: k.r.id, time: est(k), you: k.you })), place, time, track: session.track, best: prev && prev < time ? prev : time };
    this.gotoGameOver(session.result);
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game, tr = this.tr, me = this.me;
    const camZ = this.wrap(me.z - this.camGap);
    const quads = this.road.view(camZ, me.x, { w: W, h: H });
    this.camGap = this.road.distanceAtScreenY(H - CAR_Y_OFF) || 1000;
    let horizon = H;
    for (const q of quads) horizon = Math.min(horizon, q.y2);
    horizon = clamp(horizon, H * 0.2, H * 0.7);

    // Sky: parallax-shifted by the accumulated curve.
    this.skyShift = this.skyShift * 0.996 + this.road.curveAt(me.z) * (me.speed / MAX_SPEED) * 0.0009;
    const sky = this.f.sky[session.track] ?? this.f.sky[0];
    const sz = g.assets.frameSize(sky);
    const sh = horizon / 0.72, sw = Math.max(W * 1.25, (sz.w / sz.h) * sh);
    const room = Math.max(0, (sw - W) / 2);
    const sx = -room - clamp(this.skyShift * 600, -room, room);
    d.sprite(sky, sx, horizon - sh * 0.72 - 4, { w: sw, h: sh });
    d.rect(0, horizon - 2, W, H - horizon + 2, tr.grass[0]);

    // Road, far to near.
    for (let i = quads.length - 1; i >= 0; i--) {
      const q = quads[i];
      const alt = Math.floor(q.index / 3) % 2;
      const top = Math.max(q.y2, 0);
      d.rect(0, top, W, q.y1 - top + 1, tr.grass[alt]);
      const r1 = q.w1 * 1.14, r2 = q.w2 * 1.14;
      d.fill([{ x: q.x1 - r1, y: q.y1 }, { x: q.x1 + r1, y: q.y1 }, { x: q.x2 + r2, y: q.y2 }, { x: q.x2 - r2, y: q.y2 }], tr.rumble[alt]);
      d.fill([{ x: q.x1 - q.w1, y: q.y1 }, { x: q.x1 + q.w1, y: q.y1 }, { x: q.x2 + q.w2, y: q.y2 }, { x: q.x2 - q.w2, y: q.y2 }], tr.road[alt]);
      if (alt === 0) {
        for (const l of [-1 / 3, 1 / 3]) {
          const lw1 = q.w1 * 0.025, lw2 = q.w2 * 0.025;
          const a = q.x1 + q.w1 * l, b = q.x2 + q.w2 * l;
          d.fill([{ x: a - lw1, y: q.y1 }, { x: a + lw1, y: q.y1 }, { x: b + lw2, y: q.y2 }, { x: b - lw2, y: q.y2 }], tr.lane, 0.85);
        }
      }
      if (q.index === 0 || q.index === 1) {
        d.fill([{ x: q.x1 - q.w1, y: q.y1 }, { x: q.x1 + q.w1, y: q.y1 }, { x: q.x2 + q.w2, y: q.y2 }, { x: q.x2 - q.w2, y: q.y2 }], q.index === 0 ? '#ffffff' : '#222222');
      }
      if (q.fog > 0.55) d.fill([{ x: 0, y: q.y1 }, { x: W, y: q.y1 }, { x: W, y: q.y2 }, { x: 0, y: q.y2 }], tr.fog, (q.fog - 0.55) * 1.2);
    }

    // World objects, far to near.
    type Obj = { dist: number; draw: () => void };
    const objs: Obj[] = [];
    const propFrame = tr.prop === 'palm' ? this.f.palm : tr.prop === 'snowman' ? this.f.snowman : this.f.lamp;
    const propW = tr.prop === 'lamp' ? 160 : tr.prop === 'snowman' ? 420 : 700;
    const push = (z: number, x: number, fn: (p: { x: number; y: number; scale: number }) => void): void => {
      const p = this.road.place(z, x, 0);
      if (!p) return;
      objs.push({ dist: this.wrap(z - camZ), draw: () => fn(p) });
    };
    for (const pr of this.props) push(pr.z, pr.x, (p) => drawBottom(d, g, propFrame, p.x, p.y, propW * p.scale));
    for (const b of this.boxes) if (b.respawn <= 0) push(b.z, b.x, (p) => drawBottom(d, g, this.f.itembox, p.x, p.y - Math.sin(this.t * 4) * 20 * p.scale - 60 * p.scale, 220 * p.scale, { rot: Math.sin(this.t * 2) * 0.2 }));
    for (const h of this.hazards) push(h.z, h.x, (p) => drawBottom(d, g, this.f.banana, p.x, p.y, 200 * p.scale));
    for (const s of this.shots) push(s.z, s.x, (p) => { const r = 110 * p.scale; d.circle(p.x, p.y - r, r, '#9fe3ff', 0.7); d.ring(p.x, p.y - r, r, 2, '#ffffff'); });
    for (const k of this.karts) {
      if (k.you) continue;
      push(k.z, k.x, (p) => {
        const rot = k.spin > 0 ? Math.sin(k.spin * 25) * 0.6 : 0;
        drawBottom(d, g, this.f.kart[k.r.id], p.x, p.y, KART_W * p.scale, { rot, tint: k.star > 0 ? (Math.floor(this.t * 12) % 2 ? '#ffb3f0' : '#b3fff0') : undefined });
      });
    }
    objs.sort((a, b) => b.dist - a.dist);
    for (const o of objs) o.draw();

    // The player's kart.
    const steer = (this.input.keys.right.held ? 1 : 0) - (this.input.keys.left.held ? 1 : 0);
    const bounce = me.speed > 100 ? Math.sin(this.t * 30) * 1.5 : 0;
    const rot = me.spin > 0 ? Math.sin(me.spin * 25) * 0.7 : steer * 0.06 + me.driftDir * 0.1;
    const tint = me.star > 0 ? (Math.floor(this.t * 12) % 2 ? '#ffb3f0' : '#b3fff0') : undefined;
    if (me.boost > 0) this.game.fx.emit({ x: W / 2, y: H - CAR_Y_OFF - 20, count: 3, speed: 120, angle: Math.PI / 2, spread: 0.6, life: 0.3, size: 8, ramp: 'fire', add: true });
    drawBottom(d, g, this.f.kart[me.r.id], W / 2, H - CAR_Y_OFF + bounce, 250, { rot, tint });

    this.drawHud3(d, W, H);
  }

  private drawHud3(d: Draw, W: number, H: number): void {
    const g = this.game, me = this.me;
    const pl = this.place(me) + 1;
    panel(d, { x: 16, y: 16, w: 210, h: 118 });
    label(d, g, `第 ${pl} 名`, 121, 50, { size: 44, color: pl === 1 ? '#ffe066' : '#ffffff', stroke: '#1b1040', strokeWidth: 6, weight: 900 });
    label(d, g, `圈數 ${Math.min(LAPS, Math.max(1, Math.floor(me.total / this.len) + 1))} / ${LAPS}`, 121, 102, { size: 22, color: '#9fe3ff' });
    panel(d, { x: W - 236, y: 16, w: 220, h: 118 });
    label(d, g, fmtTime(this.t), W - 126, 44, { size: 30, color: '#ffffff' });
    label(d, g, `${Math.round(me.speed * KMH)} km/h`, W - 126, 88, { size: 28, color: me.boost > 0 ? '#ff9a3c' : '#ffe066' });
    const best = loadBest(session.track);
    if (best) label(d, g, `最佳 ${fmtTime(best)}`, W - 126, 118, { size: 16, color: '#cccccc' });

    // Item slot.
    const ix = W / 2 - 56;
    panel(d, { x: ix, y: 16, w: 112, h: 112 }, '#0d1433cc', me.item ? ITEMS[me.item].color : '#ffffff55');
    if (me.item) {
      const c = ITEMS[me.item].color;
      if (me.item === 'banana') drawBottom(d, g, this.f.banana, W / 2, 96, 70);
      else if (me.item === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 16 : 36; pts.push({ x: W / 2 + Math.cos(a) * r, y: 66 + Math.sin(a) * r }); } d.fill(pts, c); }
      else if (me.item === 'fish') { d.fill([{ x: W / 2 - 34, y: 66 }, { x: W / 2 + 10, y: 46 }, { x: W / 2 + 20, y: 66 }, { x: W / 2 + 10, y: 86 }], c); d.fill([{ x: W / 2 + 18, y: 66 }, { x: W / 2 + 38, y: 50 }, { x: W / 2 + 38, y: 82 }], c); }
      else { d.circle(W / 2, 64, 30, c, 0.8); d.ring(W / 2, 64, 30, 3, '#ffffff'); }
      label(d, g, ITEMS[me.item].name, W / 2, 114, { size: 17, color: '#ffffff' });
    } else label(d, g, '道具', W / 2, 72, { size: 20, color: '#ffffff55' });

    // Progress strip with every racer.
    const px = 30, pw = W - 60, py = H - 16;
    d.rect(px, py - 3, pw, 6, '#00000066');
    for (const k of this.karts) {
      const f = clamp(k.total / (LAPS * this.len), 0, 1);
      d.circle(px + pw * f, py, k.you ? 9 : 6, k.you ? '#ffe066' : k.r.color);
    }

    // Drift charge.
    if (me.driftDir !== 0) {
      const c = me.drift > 1.6 ? '#ff9a3c' : me.drift > 0.8 ? '#5cc8ff' : '#ffffff';
      d.rect(W / 2 - 60, H - 330, 120, 10, '#00000088');
      d.rect(W / 2 - 60, H - 330, 120 * clamp(me.drift / 1.6, 0, 1), 10, c);
    }

    if (this.count > 0) {
      const n = Math.ceil(this.count - 0.6);
      label(d, g, n > 0 ? String(n) : 'GO!', W / 2, H * 0.36, { size: 120, color: n > 0 ? '#ffffff' : '#5cffb0', stroke: '#1b1040', strokeWidth: 12, weight: 900 });
      label(d, g, '↑ 油門　← → 轉向　Shift 漂移集氣　Space 使用道具', W / 2, H * 0.52, { size: 22, color: '#ffffff', stroke: '#000000', strokeWidth: 5 });
      label(d, g, 'GO 的瞬間按住油門 = 火箭起步', W / 2, H * 0.57, { size: 18, color: '#ffe066', stroke: '#000000', strokeWidth: 4 });
    } else if (this.count > -0.8) {
      label(d, g, 'GO!', W / 2, H * 0.36, { size: 120, color: '#5cffb0', stroke: '#1b1040', strokeWidth: 12, weight: 900 }, 0.5, 0.5, clamp((this.count + 0.8) / 0.8, 0, 1));
    }
    if (this.msgT > 0) label(d, g, this.msg, W / 2, H * 0.26, { size: 40, color: '#ffffff', stroke: '#1b1040', strokeWidth: 7, weight: 900 }, 0.5, 0.5, clamp(this.msgT * 2, 0, 1));
  }
}
