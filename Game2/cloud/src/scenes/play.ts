// Play: a 3-on-3 half-court game. The user controls one player of team 0 (auto-switches
// to the ball handler on offense; Q switches on defense). Everything else is AI.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawCourt, drawChar, ellipse, ellipseRing, type Frames, type View } from '../art.js';
import { label, panel, clamp, lerp } from '../ui.js';
import { baller, RUN_SPEED, DEPTH_FACTOR, PASS_SPEED, STEAL_RANGE, BLOCK_RANGE, BLOCK_MIN_Z, CONTEST_RANGE, METER_TIME, METER_SWEET, ART, type Baller } from '../data.js';
import { HOOP, RIM_HEIGHT, TOP_OF_KEY, clampToCourt, isThree, hoopDist, floorDist, depthScale, halfWidth, TOP_Y, BOTTOM_Y } from '../court.js';
import { Match, shotChance, meterQuality, blockChance, type Side } from '../rules.js';
import { prepareShooters, drawShooter, shotHand, SHOT_RELEASE, SHOT_FINISH } from '../shooter.js';
import { session } from '../session.js';

interface P {
  b: Baller; side: Side; idx: number;
  x: number; y: number; z: number; vz: number;
  facing: 1 | -1;
  stun: number;            // can't act (failed steal / after being stripped)
  windup: number;          // > 0 while gathering a shot (AI) — seconds left
  spot: { x: number; y: number };
  retarget: number;
  moving: boolean;
  shot: { age: number; timing: number; released: boolean } | null;
}

type BallMode = 'held' | 'pass' | 'shot' | 'loose' | 'dead';
interface Ball {
  mode: BallMode;
  holder: P | null;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  from: { x: number; y: number; z: number };
  target: P | null;
  t: number; dur: number;
  make: boolean; three: boolean; shooter: P | null; blocked: boolean;
}

const rng = Math.random;
const GRAV = 900;
const OFF_SPOTS = [
  { x: 318, y: 468 }, { x: 706, y: 468 }, { x: 512, y: 568 }, { x: 420, y: 430 }, { x: 604, y: 430 }, { x: 250, y: 420 }, { x: 774, y: 420 },
];

export class Play extends Scene {
  private f!: Frames;
  private v: View = { s: 1, x: 0, y: 0 };
  private m = new Match();
  private ps: P[] = [];
  private ball!: Ball;
  private ctrl!: P;
  private msg = '';
  private msgT = 0;
  private msgCol = '#ffffff';
  private meter = -1;           // user's shot meter (0..1), -1 idle
  private pause = 0;            // dead-ball pause before a check
  private t = 0;
  private aiTick = 0;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    prepareShooters(this.game);
    this.input.bind({
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      shoot: ['Space', 'KeyJ'], pass: ['KeyK', 'KeyX'], sw: ['KeyQ', 'KeyL'], sprint: ['ShiftLeft', 'ShiftRight'], quit: ['Escape'],
    });
    this.sound.define('bounce', { type: 'sine', freq: 140, freqEnd: 70, duration: 0.08, volume: 0.5 });
    this.sound.define('swish', { type: 'noise', duration: 0.3, volume: 0.35, filter: { type: 'bandpass', freq: 3000, freqEnd: 1200, q: 1.5 } });
    this.sound.define('rim', { type: 'triangle', freq: 520, freqEnd: 380, duration: 0.25, volume: 0.4 });
    this.sound.define('whistle', { type: 'sine', freq: 2600, duration: 0.35, volume: 0.25, vibrato: { freq: 30, depth: 0.04 } });
    this.sound.define('steal', { notes: 'A5 E6', step: 0.05, type: 'square', volume: 0.3 });
    this.sound.define('block', { type: 'noise', duration: 0.15, volume: 0.6, filter: { type: 'lowpass', freq: 700 } });
    if (!session.musicOn) { this.sound.music(ART.music, { loop: true, volume: 0.3 }); session.musicOn = true; }

    const mk = (id: string, side: Side, idx: number): P => ({
      b: baller(id), side, idx, x: 512, y: 500, z: 0, vz: 0, facing: 1, stun: 0, windup: 0,
      spot: { x: 512, y: 500 }, retarget: 0, moving: false, shot: null,
    });
    this.ps = [...session.team.map((id, i) => mk(id, 0, i)), ...session.cpu.map((id, i) => mk(id, 1, i))];
    this.ctrl = this.ps[0];
    this.ball = { mode: 'dead', holder: null, x: 512, y: 540, z: 0, vx: 0, vy: 0, vz: 0, from: { x: 0, y: 0, z: 0 }, target: null, t: 0, dur: 1, make: false, three: false, shooter: null, blocked: false };
    this.m.possession = rng() < 0.5 ? 0 : 1;
    this.checkBall('跳球開賽！');
  }

  // ── flow ──
  private say(s: string, col = '#ffffff', t = 1.4): void { this.msg = s; this.msgCol = col; this.msgT = t; }

  private team(side: Side): P[] { return this.ps.filter((p) => p.side === side); }

  /** Reset to a check at the top of the key for the possession team. */
  private checkBall(note: string): void {
    const off = this.team(this.m.possession), def = this.team((1 - this.m.possession) as Side);
    off.forEach((p, i) => { const s = i === 0 ? TOP_OF_KEY : OFF_SPOTS[i - 1]; p.x = s.x; p.y = s.y + (i === 0 ? 20 : 0); p.z = 0; p.vz = 0; p.windup = 0; p.stun = 0; p.shot = null; });
    def.forEach((p, i) => { const o = off[i]; p.x = lerp(o.x, HOOP.x, 0.22); p.y = lerp(o.y, HOOP.y, 0.22); p.z = 0; p.vz = 0; p.windup = 0; p.stun = 0; p.shot = null; });
    this.give(off[0]);
    this.m.mustClear = false;
    this.m.shotClock = 12;
    this.pause = 1.1;
    this.meter = -1;
    this.say(note, '#ffe066', 1.1);
    if (this.m.possession === 0) this.ctrl = off[0];
  }

  private give(p: P): void {
    const b = this.ball;
    b.mode = 'held'; b.holder = p; b.target = null; b.shooter = null;
    if (p.side === 0 && p !== this.ctrl) { this.ctrl = p; this.meter = -1; }
  }

  private holder(): P | null { return this.ball.mode === 'held' ? this.ball.holder : null; }

  // ── actions ──
  private startShot(p: P): void {
    if (this.m.mustClear && p.side === this.m.possession) {
      if (p.side === 0) this.say('先運到三分線外清球！', '#ff9a3c', 1.0);
      return;
    }
    p.windup = 0.42;
  }

  private release(p: P, timing: number): void {
    if (this.holder() !== p || p.shot) return;
    p.shot = { age: 0, timing, released: false };
    p.windup = 0; p.moving = false;
    p.vz = 260 + p.b.jump * 12;
  }

  private launchShot(p: P, timing: number): void {
    const b = this.ball;
    if (b.holder !== p) return;
    const three = isThree(p.x, p.y);
    const dist = hoopDist(p.x, p.y);
    const skill = three ? p.b.three : p.b.shoot;
    let contest = 0;
    let blocker: P | null = null;
    for (const d of this.team((1 - p.side) as Side)) {
      const fd = floorDist(d, p);
      contest = Math.max(contest, clamp(1 - fd / CONTEST_RANGE, 0, 1) * (d.z > 8 ? 1.2 : 1));
      if (d.z > BLOCK_MIN_Z && fd < BLOCK_RANGE && !blocker) blocker = d;
    }
    const hand = shotHand(1, SHOT_RELEASE, 128 * depthScale(p.y));
    b.mode = 'shot'; b.holder = null; b.shooter = p; b.three = three;
    b.from = { x: p.x + hand.x * p.facing, y: p.y, z: p.z + hand.z };
    b.x = b.from.x; b.y = b.from.y; b.z = b.from.z; b.t = 0;
    b.dur = 0.55 + dist / 900;
    b.blocked = false;
    if (blocker && rng() < blockChance(blocker.b.jump, p.b.jump)) {
      b.blocked = true;
      b.dur = 0.18;
    }
    b.make = !b.blocked && rng() < shotChance(dist, three, skill, clamp(timing, 0, 1), clamp(contest, 0, 1));
    this.sound.play({ type: 'sine', freq: 300, freqEnd: 600, duration: 0.12, volume: 0.2 });
  }

  private pass(from: P, to: P): void {
    const b = this.ball;
    if (b.holder !== from || from === to) return;
    b.mode = 'pass'; b.holder = null; b.target = to;
    b.from = { x: from.x, y: from.y, z: 55 };
    b.x = from.x; b.y = from.y; b.z = 55; b.t = 0;
    b.dur = Math.max(0.22, floorDist(from, to) / PASS_SPEED);
    this.sound.play({ type: 'square', freq: 500, duration: 0.05, volume: 0.15 });
  }

  private trySteal(p: P): void {
    const h = this.holder();
    if (!h || h.side === p.side || p.stun > 0) return;
    if (floorDist(p, h) > STEAL_RANGE) { p.stun = 0.25; return; }
    if (rng() < 0.22 + (p.b.defense - 5) * 0.045 - (h.b.speed - 5) * 0.02) {
      this.m.gain(p.side);
      this.give(p);
      h.stun = 0.6;
      this.sound.play('steal');
      this.say(`${p.b.name} 抄截！`, '#5cffb0');
    } else {
      p.stun = 0.55;
    }
  }

  private jump(p: P): void { if (p.z <= 0 && p.stun <= 0) p.vz = 300 + p.b.jump * 22; }

  /** Best pass target for p: teammate most in the stick direction, or the most open. */
  private passTarget(p: P, dx: number, dy: number): P {
    const mates = this.team(p.side).filter((q) => q !== p);
    let best = mates[0], bestScore = -Infinity;
    for (const q of mates) {
      let sc: number;
      if (dx || dy) {
        const ax = q.x - p.x, ay = (q.y - p.y) * 2;
        sc = (ax * dx + ay * dy) / (Math.hypot(ax, ay) + 1);
      } else sc = this.openness(q);
      if (sc > bestScore) { bestScore = sc; best = q; }
    }
    return best;
  }

  private openness(q: P): number {
    let m = 999;
    for (const d of this.team((1 - q.side) as Side)) m = Math.min(m, floorDist(d, q));
    return m;
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    dt = Math.min(dt, 1 / 30);
    if (this.input.keys.quit.pressed) { this.gotoTitle(); return; }
    if (this.msgT > 0) this.msgT -= dt;

    if (this.m.over) {
      session.result = { score: [...this.m.score] as [number, number], win: this.m.winner() === 0 };
      this.gotoGameOver(session.result);
      return;
    }

    if (this.pause > 0) {
      this.pause -= dt;
      this.physics2(dt);
      return;
    }

    const live = this.ball.mode !== 'dead';
    if (this.m.tick(dt, live) === 'shotclock') {
      this.sound.play('whistle');
      this.checkBall('12 秒進攻違例！球權轉換');
      return;
    }

    this.userInput(dt);
    this.aiTick -= dt;
    const think = this.aiTick <= 0;
    if (think) this.aiTick = 0.12;
    for (const p of this.ps) if (p !== this.ctrl) this.ai(p, dt, think);
    this.physics2(dt);
    this.updateBall(dt);
    // Launch after held-ball positioning: the first free-flight frame starts at the fingertips.
    for (const p of this.ps) if (p.shot) {
      if (!p.shot.released && this.holder() !== p) { p.shot = null; continue; }
      const previous = p.shot.age; p.shot.age += dt;
      if (!p.shot.released && previous < SHOT_RELEASE && p.shot.age >= SHOT_RELEASE) {
        p.shot.released = true; this.launchShot(p, p.shot.timing);
      }
      if (p.shot.age >= SHOT_FINISH && p.z <= 0) p.shot = null;
    }

    // Clear-the-ball rule.
    const h = this.holder();
    if (h && this.m.mustClear && h.side === this.m.possession && isThree(h.x, h.y)) {
      this.m.cleared();
      if (h.side === 0) this.say('清球完成，可以進攻！', '#9fd2ff', 0.9);
    }
  }

  private userInput(dt: number): void {
    const k = this.input.keys, c = this.ctrl;
    if (c.shot) { c.moving = false; return; }
    if (c.stun > 0) { c.stun -= dt; c.moving = false; return; }
    let dx = (k.right.held ? 1 : 0) - (k.left.held ? 1 : 0);
    let dy = (k.down.held ? 1 : 0) - (k.up.held ? 1 : 0);
    const hasBall = this.ball.holder === c && this.ball.mode === 'held';

    if (hasBall) {
      if (k.shoot.pressed && this.meter < 0 && c.z <= 0) {
        if (this.m.mustClear) this.say('先運到三分線外清球！', '#ff9a3c', 1.0);
        else this.meter = 0;
      }
      if (this.meter >= 0) {
        dx = 0; dy = 0;
        this.meter += dt / METER_TIME;
        if (!k.shoot.held || this.meter >= 1.15) {
          const q = meterQuality(this.meter, METER_SWEET);
          if (q >= 0.99) this.say('完美出手！', '#5cffb0', 0.7);
          this.release(c, q);
          this.meter = -1;
        }
      } else if (k.pass.pressed) {
        this.pass(c, this.passTarget(c, dx, dy));
      }
    } else {
      this.meter = -1;
      const def = this.m.possession === 1 || (this.ball.mode !== 'held' && this.ball.shooter?.side === 1);
      if (k.shoot.pressed) this.jump(c);
      if (k.pass.pressed && def) this.trySteal(c);
      if (k.pass.pressed && !def && this.ball.mode === 'held' && this.ball.holder && this.ball.holder.side === 0) {
        // Call for the ball.
        this.pass(this.ball.holder, c);
      }
      if (k.sw.pressed) this.switchCtrl();
    }
    const sp = RUN_SPEED * (0.7 + c.b.speed * 0.06) * (k.sprint.held ? 1.3 : 1) * (hasBall ? 0.92 : 1);
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      c.x += (dx / n) * sp * dt;
      c.y += (dy / n) * sp * DEPTH_FACTOR * dt;
      if (dx) c.facing = dx > 0 ? 1 : -1;
    }
    c.moving = !!(dx || dy);
    clampToCourt(c);
  }

  private switchCtrl(): void {
    const target = this.ball.mode === 'held' && this.ball.holder ? this.ball.holder : this.ball;
    let best = this.ctrl, bd = Infinity;
    for (const p of this.team(0)) { if (p === this.ctrl) continue; const d = floorDist(p, target); if (d < bd) { bd = d; best = p; } }
    this.ctrl = best;
  }

  private moveToward(p: P, tx: number, ty: number, dt: number, speedMul = 1): void {
    const dx = tx - p.x, dy = (ty - p.y) / DEPTH_FACTOR;
    const d = Math.hypot(dx, dy);
    p.moving = d > 6;
    if (d < 3) return;
    const sp = RUN_SPEED * (0.7 + p.b.speed * 0.06) * speedMul * dt;
    const k = Math.min(1, sp / d);
    p.x += dx * k;
    p.y += dy * k * DEPTH_FACTOR;
    if (Math.abs(dx) > 4) p.facing = dx > 0 ? 1 : -1;
    clampToCourt(p);
  }

  private ai(p: P, dt: number, think: boolean): void {
    if (p.stun > 0) { p.stun -= dt; p.moving = false; return; }
    const b = this.ball;
    const offense = p.side === this.m.possession;
    if (p.shot) { p.moving = false; return; }

    // Loose ball: nearest two of each side chase it.
    if (b.mode === 'loose') {
      const mine = this.team(p.side).slice().sort((a, c) => floorDist(a, b) - floorDist(c, b));
      if (mine.indexOf(p) < 2) { this.moveToward(p, b.x, b.y, dt, 1.1); return; }
    }

    if (p.windup > 0) {
      p.windup -= dt;
      p.moving = false;
      if (p.windup <= 0) this.release(p, 0.55 + rng() * 0.4);
      return;
    }

    if (offense && b.mode === 'held' && b.holder === p) {
      // Ball handler.
      if (this.m.mustClear) { this.moveToward(p, p.x < 512 ? 330 : 694, 560, dt); return; }
      if (think) {
        const open = this.openness(p);
        const dist = hoopDist(p.x, p.y);
        const three = isThree(p.x, p.y);
        const skill = three ? p.b.three : p.b.shoot;
        const want = (dist < 70 && open > 25) || (open > 70 && (three ? skill >= 6 : dist < 260)) || this.m.shotClock < 2.2;
        if (want && rng() < 0.55) { this.startShot(p); return; }
        if (open < 40 && rng() < 0.28) { this.pass(p, this.passTarget(p, 0, 0)); return; }
        if (rng() < 0.06) { this.pass(p, this.passTarget(p, 0, 0)); return; }
        // Drive: aim at the rim with a lateral wobble.
        p.spot = { x: HOOP.x + (rng() - 0.5) * 200, y: HOOP.y + 30 + rng() * 60 };
      }
      this.moveToward(p, p.spot.x, p.spot.y, dt, 0.9);
      return;
    }

    if (offense) {
      // Off-ball: rotate between spots.
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.retarget = 1.5 + rng() * 2;
        const s = OFF_SPOTS[Math.floor(rng() * OFF_SPOTS.length)];
        p.spot = { x: s.x + (rng() - 0.5) * 40, y: s.y + (rng() - 0.5) * 20 };
      }
      this.moveToward(p, p.spot.x, p.spot.y, dt, 0.85);
      return;
    }

    // Defense: guard the same-index attacker, between him and the rim.
    const opp = this.team((1 - p.side) as Side)[p.idx];
    const tx = lerp(opp.x, HOOP.x, 0.2), ty = lerp(opp.y, HOOP.y, 0.2);
    this.moveToward(p, tx, ty, dt, 1.0);
    const h = this.holder();
    if (h === opp && think) {
      // React to the release rather than leaping at the start of the gather, so a
      // defender who bites early is back on the floor when the ball goes up.
      const nearRelease = (h.windup > 0 && h.windup < 0.2) || this.meter >= 0.6;
      if (h.windup > 0 || this.meter >= 0) { if (nearRelease && floorDist(p, h) < BLOCK_RANGE + 10 && rng() < 0.3 + p.b.jump * 0.02) this.jump(p); }
      else if (floorDist(p, h) < STEAL_RANGE && rng() < 0.05 + p.b.defense * 0.006) this.trySteal(p);
    }
    if (b.mode === 'shot' && b.shooter === opp && b.t < 0.15 && floorDist(p, opp) < BLOCK_RANGE && think) this.jump(p);
  }

  /** Vertical (jump) physics for players. */
  private physics2(dt: number): void {
    for (const p of this.ps) {
      if (p.z > 0 || p.vz > 0) {
        p.vz -= GRAV * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) { p.z = 0; p.vz = 0; }
      }
    }
  }

  private updateBall(dt: number): void {
    const b = this.ball;
    switch (b.mode) {
      case 'held': {
        const h = b.holder!;
        b.x = h.x + h.facing * 16; b.y = h.y + 2;
        const gather = h.shot ? 1 : h.windup > 0 ? 1-h.windup/0.42 : h === this.ctrl && this.meter >= 0 ? Math.min(1,this.meter/0.6) : -1;
        if (gather >= 0) {
          const hand=shotHand(gather,h.shot?.age ?? -1,128*depthScale(h.y));
          b.x=h.x+hand.x*h.facing;b.y=h.y;b.z=h.z+hand.z;
        } else b.z=h.z+Math.abs(Math.sin(this.t*8))*40+8;
        if (h.moving && Math.abs(Math.sin(this.t * 8)) < 0.12 && Math.abs(Math.sin((this.t - dt) * 8)) >= 0.12) this.sound.play('bounce');
        break;
      }
      case 'pass': {
        const to = b.target!;
        b.t += dt / b.dur;
        const k = Math.min(1, b.t);
        b.x = lerp(b.from.x, to.x, k); b.y = lerp(b.from.y, to.y, k); b.z = lerp(b.from.z, 55, k) + Math.sin(k * Math.PI) * 25;
        // Interception by defenders near the lane.
        for (const d of this.team((1 - to.side) as Side)) {
          if (d.stun <= 0 && floorDist(d, b) < 20 && k > 0.2 && k < 0.85 && rng() < 0.08 + d.b.defense * 0.01) {
            this.m.gain(d.side);
            this.give(d);
            this.sound.play('steal');
            this.say(`${d.b.name} 抦截！`, '#5cffb0');
            return;
          }
        }
        if (b.t >= 1) this.give(to);
        break;
      }
      case 'shot': {
        b.t += dt / b.dur;
        const k = Math.min(1, b.t);
        if (b.blocked) {
          if (k >= 1) {
            this.sound.play('block');
            this.say('大蓋火鍋！', '#ff5fa2');
            this.camera.shake(5, 0.25);
            b.mode = 'loose'; b.vx = (rng() - 0.5) * 420; b.vy = 120 + rng() * 120; b.vz = 120;
          } else { b.x = b.from.x; b.y = b.from.y; b.z = b.from.z + k * 40; }
          break;
        }
        b.x = lerp(b.from.x, HOOP.x, k); b.y = lerp(b.from.y, HOOP.y, k);
        b.z = lerp(b.from.z, RIM_HEIGHT, k) + Math.sin(k * Math.PI) * (90 + hoopDist(b.from.x, b.from.y) * 0.25);
        if (k >= 1) {
          const sh = b.shooter!;
          if (b.make) {
            const pts = this.m.made(sh.side, b.three);
            this.sound.play('swish');
            this.game.fx.emit({ x: this.wx(HOOP.x), y: this.wy(HOOP.y) - RIM_HEIGHT * this.v.s, count: 30, speed: 180, life: 0.6, colors: sh.side === 0 ? ['#5cc8ff', '#ffffff'] : ['#ff6b6b', '#ffe066'], add: true });
            b.mode = 'dead';
            if (!this.m.over) this.checkBall(`${sh.b.name} ${pts === 2 ? '兩分球！' : '進球！'}（${pts} 分）`);
            this.say(`${sh.b.name} ${pts === 2 ? '外線兩分！' : '得分！'} +${pts}`, sh.side === 0 ? '#5cc8ff' : '#ff6b6b', 1.3);
          } else {
            this.sound.play('rim');
            b.mode = 'loose';
            const a = rng() * Math.PI;
            b.vx = Math.cos(a) * 230; b.vy = Math.sin(a) * 160 + 40; b.vz = 180 + rng() * 120;
          }
        }
        break;
      }
      case 'loose': {
        b.vz -= GRAV * dt;
        b.x += b.vx * dt; b.y += b.vy * dt * DEPTH_FACTOR; b.z += b.vz * dt;
        if (b.z <= 0) { b.z = 0; if (Math.abs(b.vz) > 60) this.sound.play('bounce'); b.vz = -b.vz * 0.55; b.vx *= 0.8; b.vy *= 0.8; }
        if (b.y < TOP_Y) { b.y = TOP_Y; b.vy = Math.abs(b.vy); }
        if (b.y > BOTTOM_Y) { b.y = BOTTOM_Y; b.vy = -Math.abs(b.vy); }
        const hw = halfWidth(b.y) - 10;
        if (b.x < 512 - hw) { b.x = 512 - hw; b.vx = Math.abs(b.vx); }
        if (b.x > 512 + hw) { b.x = 512 + hw; b.vx = -Math.abs(b.vx); }
        for (const p of this.ps) {
          if (p.stun > 0) continue;
          if (floorDist(p, b) < 26 && b.z < 60 + p.z) {
            const shooterSide = b.shooter ? b.shooter.side : this.m.possession;
            if (p.side === shooterSide && p.side === this.m.possession) { this.m.offensiveRebound(); this.say(`${p.b.name} 進攻籃板！`, '#9fd2ff', 0.9); }
            else { this.m.gain(p.side); this.say(`${p.b.name} 搶到籃板！`, '#9fd2ff', 0.9); }
            this.give(p);
            if (p.side === 0) this.ctrl = p;
            break;
          }
        }
        break;
      }
      case 'dead':
        break;
    }
  }

  // ── draw ──
  private wx(fx: number): number { return this.v.x + fx * this.v.s; }
  private wy(fy: number): number { return this.v.y + fy * this.v.s; }

  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game;
    this.v = drawCourt(d, this.f, W, H);
    const s = this.v.s;
    const b = this.ball;

    // Shadows + rings.
    for (const p of this.ps) {
      const ds = depthScale(p.y) * s;
      ellipse(d, this.wx(p.x), this.wy(p.y), 30 * ds, 9 * ds, '#000000', 0.35);
      ellipseRing(d, this.wx(p.x), this.wy(p.y), 30 * ds, 9 * ds, 3, p.side === 0 ? '#39c6ff' : '#ff4d5e', p === this.ctrl ? 1 : 0.6);
    }
    const bds = depthScale(b.y) * s;
    ellipse(d, this.wx(b.x), this.wy(b.y), 10 * bds, 3.5 * bds, '#000000', 0.35);

    // Depth-sorted players + ball.
    type Item = { y: number; draw: () => void };
    const items: Item[] = this.ps.map((p) => ({
      y: p.y,
      draw: () => {
        const ds = depthScale(p.y) * s;
        const h = 128 * ds;
        const bob = p.moving ? Math.abs(Math.sin(this.t * 12 + p.idx)) * 4 : 0;
        const tint = p.stun > 0 ? '#aaaaaa' : undefined;
        const gather = p.shot ? 1 : p.windup > 0 ? 1-p.windup/0.42 : p === this.ctrl && this.meter >= 0 ? Math.min(1,this.meter/0.6) : -1;
        if (gather >= 0) drawShooter(d,g,this.f.cast[p.b.id],p.b.id,this.wx(p.x),this.wy(p.y)-p.z*s,h,gather,p.shot?.age ?? -1,p.facing);
        else drawChar(d, g, this.f.cast[p.b.id], this.wx(p.x), this.wy(p.y) - p.z * s - bob, h, { flipX: p.facing < 0, tint });
        if (p === this.ctrl) {
          const ty = this.wy(p.y) - p.z * s - h - 16;
          d.fill([{ x: this.wx(p.x) - 10, y: ty - 12 }, { x: this.wx(p.x) + 10, y: ty - 12 }, { x: this.wx(p.x), y: ty }], '#39c6ff');
        }
      },
    }));
    items.push({
      y: b.y + 1,
      draw: () => {
        if (b.mode === 'dead' && this.pause <= 0) return;
        const r = 9.5 * bds;
        const x = this.wx(b.x), y = this.wy(b.y) - b.z * s;
        d.circle(x, y, r, '#f07a1e');
        d.ring(x, y, r, 1.5, '#5a2a08');
        d.line(x - r, y, x + r, y, 1.2, '#5a2a08');
        d.line(x, y - r, x, y + r, 1.2, '#5a2a08');
      },
    });
    items.sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();

    // Shot meter above the controlled shooter.
    if (this.meter >= 0) {
      const c = this.ctrl;
      const ds = depthScale(c.y) * s;
      const mx = this.wx(c.x) + 40 * ds, my = this.wy(c.y) - 150 * ds;
      const mh = 90;
      d.rect(mx - 2, my - 2, 16, mh + 4, '#000000', 0.7);
      d.rect(mx, my + mh * (1 - METER_SWEET[1]), 12, mh * (METER_SWEET[1] - METER_SWEET[0]), '#5cffb0', 0.6);
      const fill = clamp(this.meter, 0, 1.15);
      d.rect(mx, my + mh * (1 - Math.min(fill, 1)), 12, mh * Math.min(fill, 1), fill > METER_SWEET[1] ? '#ff5f5f' : '#ffe066');
    }

    this.drawHud2(d, W, H);
  }

  private drawHud2(d: Draw, W: number, H: number): void {
    const g = this.game, m = this.m, cx = W / 2;
    panel(d, { x: cx - 250, y: 10, w: 500, h: 92 });
    d.rect(cx - 250, 10, 8, 92, '#39c6ff');
    d.rect(cx + 242, 10, 8, 92, '#ff4d5e');
    label(d, g, '你的隊伍', cx - 160, 34, { size: 20, color: '#9fe3ff' });
    label(d, g, '電腦隊', cx + 160, 34, { size: 20, color: '#ffb0b8' });
    label(d, g, String(m.score[0]), cx - 160, 72, { size: 44, color: '#ffffff', weight: 900 });
    label(d, g, String(m.score[1]), cx + 160, 72, { size: 44, color: '#ffffff', weight: 900 });
    const mm = Math.floor(m.clock / 60), ss = Math.floor(m.clock % 60);
    label(d, g, m.overtime ? '驟死延長' : `${mm}:${ss < 10 ? '0' : ''}${ss}`, cx, 36, { size: 28, color: '#ffe066' });
    const sc = Math.ceil(m.shotClock);
    label(d, g, `進攻 ${sc}`, cx, 76, { size: 22, color: sc <= 4 ? '#ff5f5f' : '#ffffff' });
    label(d, g, `先得 21 分獲勝　弧內 1 分／弧外 2 分`, cx, 120, { size: 16, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    // Possession tag.
    const pos = m.possession === 0 ? '我方球權' : '對方球權';
    label(d, g, m.mustClear ? `${pos}｜需清球` : pos, cx, 146, { size: 18, color: m.possession === 0 ? '#9fe3ff' : '#ffb0b8', stroke: '#000000', strokeWidth: 4 });

    if (this.msgT > 0) {
      const a = clamp(this.msgT * 2, 0, 1);
      label(d, g, this.msg, cx, H * 0.36, { size: 46, color: this.msgCol, stroke: '#16102a', strokeWidth: 8, weight: 900 }, 0.5, 0.5, a);
    }
    const help = this.m.possession === 0
      ? '方向鍵移動　Shift 衝刺　按住 Space 蓄力投籃（綠區放開）　K 傳球（方向鍵選人）'
      : '方向鍵移動　Space 跳起封蓋　K 抄球　Q 切換球員　Esc 離開';
    label(d, g, help, cx, H - 22, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
  }
}
