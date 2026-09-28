import Phaser from 'phaser';
import { METER_MAX } from '../config.js';
import { emptyInputFrame } from './Input.js';

// thinkEvery: frames between decisions (= reaction time); block: chance to block a threat;
// aggression: chance to approach/attack when idle; special: chance to use the special when it fits.
const LEVELS = {
  easy: { thinkEvery: 22, block: 0.2, aggression: 0.45, special: 0.12, antiAir: 0.1, combo: 0.2 },
  normal: { thinkEvery: 12, block: 0.55, aggression: 0.6, special: 0.3, antiAir: 0.4, combo: 0.5 },
  hard: { thinkEvery: 5, block: 0.85, aggression: 0.75, special: 0.45, antiAir: 0.75, combo: 0.85 },
};

/**
 * CPU opponent. Produces the same input frames as a keyboard, from a small queue of planned steps:
 * { frames, hold: {forward, back, up, down}, press: 'lp' | ... }.
 */
export class CpuController {
  constructor(difficulty) {
    this.level = LEVELS[difficulty] ?? LEVELS.normal;
    this.plan = [];
    this.timer = 0;
  }

  bind(self, opponent, scene) {
    this.self = self;
    this.opp = opponent;
    this.scene = scene;
    this.plan = [];
  }

  poll() {
    const me = this.self;
    if (!me) return emptyInputFrame();
    this.timer++;
    if (this.timer >= this.level.thinkEvery || (this.plan.length === 0 && me.isNeutral)) {
      this.timer = 0;
      this.think();
    }
    const step = this.plan[0];
    const frame = emptyInputFrame();
    if (!step) return frame;
    const fwd = me.facing > 0 ? 'right' : 'left';
    const back = me.facing > 0 ? 'left' : 'right';
    const hold = step.hold ?? {};
    frame[fwd] = !!hold.forward;
    frame[back] = !!hold.back;
    frame.up = !!hold.up;
    frame.down = !!hold.down;
    if (step.press && !step.pressed) {
      frame[step.press] = true;
      step.pressed = true;
    }
    if (--step.frames <= 0) this.plan.shift();
    return frame;
  }

  set(steps) {
    this.plan = steps.map((s) => ({ ...s }));
  }

  think() {
    const me = this.self;
    const opp = this.opp;
    const L = this.level;
    const dist = Math.abs(opp.x - me.x);
    const chance = (p) => Math.random() < p;

    // Keep pressing on with a combo after a connected normal.
    if (me.state === 'attack' && me.attack.connected && chance(L.combo)) {
      this.set([{ frames: 2, press: 'sp' }]);
      return;
    }
    if (!me.isNeutral && me.state !== 'blockstun') return;

    // Defence: incoming projectile or an attack in range.
    const threat = this.scene.projectiles.some((p) => p.owner === opp && Math.abs(p.x - me.x) < 320 && Math.sign(me.x - p.x) === p.dir)
      || (opp.state === 'attack' && dist < 330);
    if (threat && chance(L.block)) {
      const low = opp.attack?.move.level === 'low' || (opp.attack?.kind === 'crouch');
      this.set([{ frames: L.thinkEvery + 8, hold: { back: true, down: low } }]);
      return;
    }
    if (this.plan.length) return; // let the current plan finish
    if (me.meter >= METER_MAX && dist < 380 && chance(L.special)) {
      this.set([{ frames: 2, press: 'su' }]);
      return;
    }
    // Anti-air against jump-ins.
    if (opp.state === 'jump' && dist < 300 && chance(L.antiAir)) {
      const dp = me.def.special.motion === 'dp';
      this.set([dp ? { frames: 2, press: 'sp' } : { frames: 3, hold: { down: true }, press: 'hp' }]);
      return;
    }
    if (!chance(L.aggression)) {
      this.set([{ frames: Phaser.Math.Between(8, 24), hold: chance(0.5) ? { back: true } : {} }]);
      return;
    }

    const isProjectile = !!me.def.special.projectile;
    if (dist > 520) {
      if (isProjectile && chance(L.special * 1.5) && !this.scene.projectiles.some((p) => p.owner === me)) {
        this.set([{ frames: 2, press: 'sp' }]);
      } else if (chance(0.15)) {
        this.set([{ frames: 30, hold: { up: true, forward: true } }, { frames: 6, press: 'hk' }]);
      } else {
        this.set([{ frames: 20, hold: { forward: true } }]);
      }
      return;
    }
    if (dist > 230) {
      const r = Math.random();
      if (r < L.special && !me.def.special.counter) this.set([{ frames: 2, press: 'sp' }]);
      else if (r < 0.35) this.set([{ frames: 24, hold: { up: true, forward: true } }, { frames: 8, press: 'hk' }]);
      else this.set([{ frames: 16, hold: { forward: true } }]);
      return;
    }
    // Close range: pick a string.
    const strings = [
      [{ frames: 6, press: 'lp' }, { frames: 6, press: 'lp' }, { frames: 4, press: chance(L.combo) ? 'sp' : 'hp' }],
      [{ frames: 7, press: 'lk' }, { frames: 14, press: 'hk' }],
      [{ frames: 24, hold: { down: true }, press: 'hk' }],
      [{ frames: 8, hold: { down: true }, press: 'lk' }, { frames: 6, hold: { down: true }, press: 'lp' }, { frames: 4, press: 'sp' }],
      [{ frames: 18, press: 'hp' }],
      [{ frames: 14, hold: { back: true } }],
    ];
    this.set(Phaser.Math.RND.pick(strings));
  }
}
