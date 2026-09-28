// Frame-stepped fighting simulation (60 steps/s). Pure logic — no engine imports.
import { NORMALS, COUNTER_STRIKE, MOTIONS, matchMotion, type Move, type Btn } from './moves.js';
import { GROUND_Y, GRAVITY, JUMP_VY, METER_MAX, type Fighter } from './roster.js';

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; lp: boolean; hp: boolean; lk: boolean; hk: boolean; sp: boolean; su: boolean; }
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, lp: false, hp: false, lk: false, hk: false, sp: false, su: false };

export type State = 'idle' | 'walk' | 'crouch' | 'air' | 'attack' | 'hitstun' | 'blockstun' | 'down' | 'ko' | 'win';

export interface Shot { owner: number; x: number; y: number; vx: number; w: number; h: number; life: number; style: string; color: number; move: Move; hitsLeft: number; hitEvery: number; cd: number; }

export interface Events { hit: { x: number; y: number; big: boolean; blocked: boolean; color: number }[]; say: string[]; sfx: string[]; }

export class Body {
  x: number; y = GROUND_Y; vx = 0; vy = 0;
  facing: 1 | -1;
  hp: number; meter = 0;
  state: State = 'idle';
  move: Move | null = null; moveKind = '';
  frame = 0; stun = 0; invuln = 0;
  hitsDone = 0; lastHitF = -99; connected = false;
  combo = 0;
  hist: { dir: number; f: number }[] = [];
  prev: Input = NO_INPUT;
  blocking = false;
  shotFired = false;
  constructor(public f: Fighter, x: number, facing: 1 | -1) { this.x = x; this.facing = facing; this.hp = f.health; }
  get scale(): number { return this.f.height / 320; }
  get grounded(): boolean { return this.y >= GROUND_Y; }
  get crouching(): boolean { return this.state === 'crouch' || (this.state === 'blockstun' && this.prev.down) || (this.state === 'attack' && this.moveKind === 'crouch'); }
  /** Hurtbox (world rect). */
  hurt(): { x: number; y: number; w: number; h: number } {
    const w = 110 * this.scale;
    let h = this.f.height * (this.crouching ? 0.62 : 0.92);
    if (this.move?.lowProfile && this.state === 'attack') h = this.f.height * 0.32;
    if (this.state === 'down') h = this.f.height * 0.25;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }
  phase(): 'startup' | 'active' | 'recovery' | null {
    const m = this.move;
    if (!m || this.state !== 'attack') return null;
    if (this.frame < m.startup) return 'startup';
    if (this.frame < m.startup + m.active || (m.untilLand && !this.grounded && this.frame >= m.startup)) return 'active';
    return 'recovery';
  }
  hitbox(): { x: number; y: number; w: number; h: number } | null {
    const m = this.move;
    if (!m?.box || this.phase() !== 'active') return null;
    const s = this.scale * (m.box === undefined ? 1 : 1), r = this.f.reach;
    const cx = this.x + this.facing * m.box.x * s * r, cy = this.y - m.box.y * s;
    const w = m.box.w * s * r, h = m.box.h * s;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
}

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Numpad direction relative to facing. */
export function numpad(i: Input, facing: 1 | -1): number {
  const fwd = facing > 0 ? i.right : i.left, back = facing > 0 ? i.left : i.right;
  const h = fwd ? 1 : back ? -1 : 0, v = i.up ? 1 : i.down ? -1 : 0;
  return 5 + h + v * 3;
}

export class Fight {
  p: [Body, Body];
  shots: Shot[] = [];
  frameNo = 0;
  hitstop = 0;
  left = 60; right = 1220;
  ev: Events = { hit: [], say: [], sfx: [] };
  constructor(a: Fighter, b: Fighter, width = 1280) {
    this.right = width - 60;
    this.p = [new Body(a, width / 2 - 220, 1), new Body(b, width / 2 + 220, -1)];
  }

  step(inputs: [Input, Input]): void {
    this.frameNo++;
    this.ev = { hit: [], say: [], sfx: [] };
    if (this.hitstop > 0) { this.hitstop--; return; }
    for (let i = 0; i < 2; i++) this.control(i, inputs[i]);
    for (let i = 0; i < 2; i++) this.physics(i);
    this.pushApart();
    this.stepShots();
    this.resolveHits();
    for (let i = 0; i < 2; i++) this.p[i].prev = inputs[i];
  }

  private start(b: Body, m: Move, kind: string): void {
    b.state = 'attack'; b.move = m; b.moveKind = kind; b.frame = 0; b.hitsDone = 0; b.lastHitF = -99; b.connected = false; b.shotFired = false;
    b.invuln = m.invuln ?? 0;
    if (kind !== 'air') b.vx = 0;
    this.ev.sfx.push(kind === 'super' ? 'super' : kind === 'special' ? 'special' : 'swing');
    if (kind === 'super' || kind === 'special') this.ev.say.push(`${b === this.p[0] ? 'P1' : 'P2'}:${m.name ?? ''}`);
  }

  private control(i: number, inp: Input): void {
    const b = this.p[i], o = this.p[1 - i];
    const dir = numpad(inp, b.facing);
    if (!b.hist.length || b.hist[b.hist.length - 1].dir !== dir) { b.hist.push({ dir, f: this.frameNo }); if (b.hist.length > 16) b.hist.shift(); }
    const pressed = (k: keyof Input): boolean => inp[k] && !b.prev[k];
    const btn: Btn | null = pressed('hp') ? 'hp' : pressed('hk') ? 'hk' : pressed('lp') ? 'lp' : pressed('lk') ? 'lk' : null;
    b.blocking = false;

    if (b.state === 'ko' || b.state === 'win') return;
    if (b.invuln > 0) b.invuln--;
    if (b.state === 'hitstun' || b.state === 'blockstun') { if (--b.stun <= 0) b.state = b.grounded ? 'idle' : 'air'; return; }
    if (b.state === 'down') { if (--b.stun <= 0) { b.state = 'idle'; b.invuln = 20; } return; }

    // Specials / supers (motion or shortcut), allowed from neutral or when cancelling a connected normal.
    const canAct = b.state === 'idle' || b.state === 'walk' || b.state === 'crouch';
    const canCancel = b.state === 'attack' && b.connected && !!b.move?.cancelable && b.phase() !== 'startup';
    if ((canAct || canCancel) && b.grounded) {
      const wantSuper = pressed('su') || ((btn) && matchMotion(b.hist, MOTIONS.super.seq, this.frameNo, 40));
      if (wantSuper && b.meter >= METER_MAX) { b.meter = 0; this.start(b, b.f.super, 'super'); this.hitstop = 10; return; }
      const sm = b.f.special;
      const btnType = btn === 'lp' || btn === 'hp' ? 'P' : btn ? 'K' : null;
      const motionOk = !!btnType && btnType === sm.button && !!sm.motion && matchMotion(b.hist, MOTIONS[sm.motion].seq, this.frameNo);
      if (pressed('sp') || motionOk) { this.start(b, sm, 'special'); return; }
    }
    if (canCancel && btn && b.move?.chain) {
      this.start(b, NORMALS[b.moveKind === 'crouch' ? 'crouch' : 'stand'][btn], b.moveKind === 'crouch' ? 'crouch' : 'stand');
      return;
    }

    if (b.state === 'attack') return;

    if (b.state === 'air') {
      if (btn && !b.move) this.start(b, NORMALS.air[btn], 'air');
      return;
    }

    // Grounded neutral.
    b.facing = o.x >= b.x ? 1 : -1;
    const back = b.facing > 0 ? inp.left : inp.right;
    b.blocking = back;
    if (btn) { const k = inp.down ? 'crouch' : 'stand'; this.start(b, NORMALS[k][btn], k); return; }
    if (inp.up) {
      b.state = 'air';
      b.vy = JUMP_VY * b.f.jump;
      b.vx = (inp.right ? 1 : inp.left ? -1 : 0) * 4.2;
      b.move = null;
      this.ev.sfx.push('jump');
      return;
    }
    if (inp.down) { b.state = 'crouch'; b.vx = 0; return; }
    const h = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    b.vx = h * b.f.walk * (h === b.facing ? 1 : 0.8);
    b.state = h ? 'walk' : 'idle';
  }

  private physics(i: number): void {
    const b = this.p[i];
    if (b.state === 'attack' && b.move) {
      const m = b.move;
      const ph = b.phase();
      if (b.frame === 0 && m.lunge) b.x += b.facing * m.lunge * 0.3 * b.scale;
      if (ph === 'active') {
        if (b.frame === m.startup && m.jumpVy) { b.vy = m.jumpVy; b.y -= 1; }
        if (m.dashVx) b.vx = b.facing * m.dashVx;
        if (m.hover !== undefined) { b.y = GROUND_Y - m.hover; b.vy = 0; }
        if (m.projectile && !b.shotFired) {
          b.shotFired = true;
          const pr = m.projectile;
          this.shots.push({ owner: i, x: b.x + b.facing * 90 * b.scale, y: b.y - b.f.height * 0.55, vx: b.facing * pr.speed, w: pr.w, h: pr.h, life: pr.life, style: pr.style, color: pr.color, move: m, hitsLeft: pr.hits ?? 1, hitEvery: pr.hitEvery ?? 1, cd: 0 });
        }
      } else if (ph === 'recovery' && b.moveKind !== 'air') {
        if (!m.hover) b.vx *= 0.7;
      }
      b.frame++;
      const total = m.startup + m.active + m.recovery;
      if (b.moveKind === 'air') {
        if (b.grounded) { b.state = 'idle'; b.move = null; b.vx = 0; }
        else if (b.frame >= total) { b.state = 'air'; }
      } else if (b.frame >= total && b.grounded) {
        b.state = 'idle'; b.move = null; b.vx = 0;
      }
    }
    // Gravity.
    const hovering = b.state === 'attack' && b.move?.hover !== undefined && b.phase() === 'active';
    if (!b.grounded && !hovering) b.vy += GRAVITY;
    b.x += b.vx;
    b.y += b.vy;
    if (b.y >= GROUND_Y) {
      const wasAir = b.vy > 0;
      b.y = GROUND_Y; b.vy = 0;
      if (b.state === 'air') { b.state = 'idle'; b.vx = 0; b.move = null; if (wasAir) this.ev.sfx.push('land'); }
      if (b.state === 'attack' && b.move?.untilLand && b.frame > b.move.startup + 2) { b.frame = Math.max(b.frame, b.move.startup + b.move.active); }
      if (b.state === 'hitstun' && b.stun > 900) { b.state = 'down'; b.stun = 40; b.vx = 0; }
    }
    if (b.state === 'ko' && b.grounded) b.vx *= 0.85;
    b.x = Math.max(this.left, Math.min(this.right, b.x));
  }

  private pushApart(): void {
    const [a, b] = this.p;
    const min = 70 * (a.scale + b.scale) / 2;
    const d = b.x - a.x;
    if (Math.abs(d) < min && Math.abs(a.y - b.y) < 200) {
      const push = (min - Math.abs(d)) / 2 * Math.sign(d || 1);
      a.x -= push; b.x += push;
      a.x = Math.max(this.left, Math.min(this.right, a.x));
      b.x = Math.max(this.left, Math.min(this.right, b.x));
    }
  }

  private stepShots(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx; s.life--; if (s.cd > 0) s.cd--;
      if (s.life <= 0 || s.x < -200 || s.x > this.right + 260) this.shots.splice(i, 1);
    }
    // Clash.
    for (let i = 0; i < this.shots.length; i++) for (let j = i + 1; j < this.shots.length; j++) {
      const a = this.shots[i], b = this.shots[j];
      if (a.owner !== b.owner && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) { a.hitsLeft--; b.hitsLeft--; a.life = a.hitsLeft > 0 ? a.life : 0; b.life = b.hitsLeft > 0 ? b.life : 0; }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private resolveHits(): void {
    for (let i = 0; i < 2; i++) {
      const a = this.p[i], d = this.p[1 - i];
      const hb = a.hitbox();
      const m = a.move;
      if (hb && m && m.damage > 0) {
        const hits = m.hits ?? 1, every = m.hitEvery ?? 99;
        if (a.hitsDone < hits && this.frameNo - a.lastHitF >= every && overlap(hb, d.hurt())) {
          a.hitsDone++; a.lastHitF = this.frameNo;
          this.applyHit(i, m, a.hitsDone === hits, a.x);
        }
      }
    }
    for (const s of this.shots) {
      const d = this.p[1 - s.owner];
      if (s.cd > 0) continue;
      if (d.state === 'attack' && d.move?.projInvuln && d.phase() === 'active') continue;
      const box = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
      if (overlap(box, d.hurt())) {
        s.hitsLeft--; s.cd = s.hitEvery;
        this.applyHit(s.owner, s.move, s.hitsLeft <= 0, s.x - Math.sign(s.vx) * 100);
        if (s.hitsLeft <= 0) s.life = 0;
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private applyHit(ai: number, m: Move, last: boolean, fromX: number): void {
    const a = this.p[ai], d = this.p[1 - ai];
    if (d.invuln > 0 || d.state === 'ko' || d.state === 'down') return;
    // Parry stance.
    if (d.state === 'attack' && d.move?.counter && d.phase() === 'active') {
      d.facing = a.x >= d.x ? 1 : -1;
      this.start(d, COUNTER_STRIKE, 'counter');
      d.frame = 0;
      this.hitstop = 12;
      this.ev.say.push(`${d === this.p[0] ? 'P1' : 'P2'}:水月返・斬`);
      return;
    }
    const dir = fromX < d.x ? 1 : -1;
    const awayHeld = dir > 0 ? d.prev.right : d.prev.left;
    const canBlock = d.grounded && (d.state === 'idle' || d.state === 'walk' || d.state === 'crouch' || d.state === 'blockstun') && awayHeld;
    const crouch = d.prev.down;
    const blockedOk = canBlock && !(m.level === 'low' && !crouch) && !(m.level === 'overhead' && crouch);
    a.connected = true;
    const hy = d.y - d.f.height * (crouch ? 0.35 : 0.6);
    if (blockedOk) {
      const chip = Math.round(m.damage * (m.chip ?? 0) * a.f.power);
      d.hp = Math.max(1, d.hp - chip);
      d.state = 'blockstun'; d.stun = m.blockstun; d.vx = dir * 3;
      d.x += dir * 6;
      a.meter = Math.min(METER_MAX, a.meter + 3); d.meter = Math.min(METER_MAX, d.meter + 2);
      this.hitstop = 5;
      this.ev.hit.push({ x: d.x - dir * 30, y: hy, big: false, blocked: true, color: 0x9fd8ff });
      this.ev.sfx.push('block');
      return;
    }
    const scale = Math.max(0.4, 1 - d.combo * 0.1);
    const dmg = Math.round(m.damage * a.f.power * scale);
    d.hp = Math.max(0, d.hp - dmg);
    d.combo++;
    a.meter = Math.min(METER_MAX, a.meter + Math.round(m.damage / 8)); d.meter = Math.min(METER_MAX, d.meter + Math.round(m.damage / 14));
    d.move = null;
    const launch = (m.knockdown && last) || !d.grounded || d.hp <= 0;
    if (launch) {
      d.state = 'hitstun'; d.stun = 999; d.vy = -9; d.vx = dir * 5; d.y -= 1;
    } else {
      d.state = 'hitstun'; d.stun = m.hitstun; d.vx = dir * 4;
    }
    this.hitstop = dmg >= 60 ? 9 : 6;
    this.ev.hit.push({ x: d.x - dir * 30, y: hy, big: dmg >= 60, blocked: false, color: a.f.color });
    this.ev.sfx.push(dmg >= 60 ? 'hitBig' : 'hit');
    if (d.hp <= 0) { d.state = 'ko'; d.stun = 0; d.vy = -12; d.vx = dir * 6; }
  }

  /** Reset combo counters once the victim recovers. */
  settle(): void {
    for (const b of this.p) if (b.state !== 'hitstun' && b.state !== 'down' && b.state !== 'ko') b.combo = 0;
  }
}
