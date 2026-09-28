// CPU opponent: produces an Input every frame from the fight state.
import { NO_INPUT, type Input, type Fight } from './sim.js';
import { METER_MAX } from './roster.js';

export class Cpu {
  private plan: Input = { ...NO_INPUT };
  private hold = 0;
  private tap = false;
  constructor(private idx: number, private level: number) {}

  think(f: Fight): Input {
    const me = f.p[this.idx], o = f.p[1 - this.idx];
    const fwd = me.facing > 0 ? 'right' : 'left', back = me.facing > 0 ? 'left' : 'right';
    const dist = Math.abs(o.x - me.x);
    const react = [0.25, 0.55, 0.85][this.level];
    const r = Math.random();
    // Release single-frame button taps.
    if (this.tap) { this.tap = false; const k = { ...this.plan, lp: false, hp: false, lk: false, hk: false, sp: false, su: false }; this.plan = k; return k; }
    // Block incoming attacks / projectiles.
    const threat = (o.state === 'attack' && o.phase() !== 'recovery' && dist < 330) || f.shots.some((s) => s.owner !== this.idx && Math.abs(s.x - me.x) < 260);
    if (threat && me.state !== 'attack' && Math.random() < react * 0.35) {
      const low = o.move?.level === 'low' || (o.moveKind === 'crouch');
      const inp: Input = { ...NO_INPUT, [back]: true, down: low } as Input;
      this.hold = 6;
      this.plan = inp;
      return inp;
    }
    if (this.hold-- > 0) return this.plan;
    const inp: Input = { ...NO_INPUT };
    // Anti-air.
    if (!o.grounded && o.state !== 'hitstun' && dist < 260 && r < react * 0.6) {
      if (me.f.special.pose === 'rise' || me.f.special.pose === 'flip') inp.sp = true; else { inp.down = true; inp.hp = true; }
      this.tap = true; this.plan = inp; return inp;
    }
    if (me.meter >= METER_MAX && dist < 360 && r < 0.05 + react * 0.05) { inp.su = true; this.tap = true; this.plan = inp; return inp; }
    if (dist > 420) {
      if (me.f.special.projectile && r < 0.02 + react * 0.03) { inp.sp = true; this.tap = true; }
      else if (r < 0.01) { inp.up = true; (inp as unknown as Record<string, boolean>)[fwd] = true; this.hold = 30; }
      else { (inp as unknown as Record<string, boolean>)[fwd] = true; this.hold = 10 + Math.floor(Math.random() * 20); }
    } else if (dist > 200) {
      if (r < 0.04 + react * 0.04) { inp.sp = !!(me.f.special.dashVx || me.f.special.projectile) ; if (!inp.sp) (inp as unknown as Record<string, boolean>)[fwd] = true; this.tap = inp.sp; this.hold = inp.sp ? 0 : 12; }
      else if (r < 0.08) { inp.up = true; (inp as unknown as Record<string, boolean>)[fwd] = true; this.hold = 30; }
      else { (inp as unknown as Record<string, boolean>)[fwd] = true; this.hold = 8; }
    } else {
      if (r < 0.06 + react * 0.12) {
        const pick = Math.random();
        if (pick < 0.3) inp.lp = true; else if (pick < 0.5) inp.lk = true; else if (pick < 0.7) { inp.down = true; inp.hk = true; } else if (pick < 0.85) inp.hp = true; else inp.sp = true;
        this.tap = true;
      } else if (r < 0.2) { (inp as unknown as Record<string, boolean>)[back] = true; this.hold = 10; }
      else { this.hold = 4; }
    }
    this.plan = inp;
    return inp;
  }
}
