// 3x3 match rules — score, clocks, possession and the "clear the ball" rule. Pure logic.
import { WIN_SCORE, GAME_TIME, SHOT_CLOCK } from './data.js';

export type Side = 0 | 1; // 0 = user team, 1 = CPU team

export class Match {
  score: [number, number] = [0, 0];
  clock = GAME_TIME;
  shotClock = SHOT_CLOCK;
  possession: Side = 0;
  /** After a defensive rebound or steal the ball must be taken behind the arc. */
  mustClear = false;
  over = false;
  overtime = false;

  /** Points for a made shot (3x3: 1 inside the arc, 2 beyond). */
  static points(three: boolean): number { return three ? 2 : 1; }

  made(side: Side, three: boolean): number {
    const pts = Match.points(three);
    this.score[side] += pts;
    if (this.score[side] >= WIN_SCORE) this.over = true;
    if (this.overtime) this.over = true; // sudden death: first basket in OT wins
    // Other team checks the ball from the top.
    this.possession = (1 - side) as Side;
    this.mustClear = false;
    this.shotClock = SHOT_CLOCK;
    return pts;
  }

  /** A change of possession on a live ball (rebound / steal / block recovery). */
  gain(side: Side): void {
    if (side !== this.possession) {
      this.possession = side;
      this.mustClear = true;
    }
    this.shotClock = SHOT_CLOCK;
  }

  /** Offensive rebound off the rim resets the shot clock but keeps possession. */
  offensiveRebound(): void { this.shotClock = SHOT_CLOCK; }

  cleared(): void { this.mustClear = false; }

  /** Tick the clocks; returns 'shotclock' if it expired this tick. */
  tick(dt: number, ballLive: boolean): 'shotclock' | null {
    if (this.over || !ballLive) return null;
    this.clock = Math.max(0, this.clock - dt);
    if (this.clock <= 0) {
      if (this.score[0] === this.score[1]) this.overtime = true;
      else { this.over = true; return null; }
    }
    this.shotClock -= dt;
    if (this.shotClock <= 0) {
      this.possession = (1 - this.possession) as Side;
      this.mustClear = false;
      this.shotClock = SHOT_CLOCK;
      return 'shotclock';
    }
    return null;
  }

  winner(): Side | -1 { return this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1; }
}

/**
 * Make probability for a shot.
 * dist: real distance to hoop (floor px), three: beyond the arc,
 * skill: shoot or three rating 1-10, timing: 0..1 quality of the meter release,
 * contest: 0 (open) .. 1 (hand in face).
 */
export function shotChance(dist: number, three: boolean, skill: number, timing: number, contest: number): number {
  let base: number;
  if (dist < 60) base = 0.76;            // layup range
  else if (!three) base = 0.62 - (dist - 60) / 600;
  else base = 0.44 - Math.max(0, dist - 240) / 500;
  const sk = (skill - 5) * 0.035;
  const tm = (timing - 0.6) * 0.45;
  // A hand in the face hurts a jumper more than a layup at the rim.
  const p = (base + sk + tm) * (1 - contest * (three ? 0.45 : 0.32));
  return Math.max(0.03, Math.min(0.95, p));
}

/** Chance an airborne defender in range swats the shot (blocker / shooter jump ratings 1-10). */
export function blockChance(blockerJump: number, shooterJump: number): number {
  return Math.max(0.05, Math.min(0.4, 0.12 + blockerJump * 0.025 - (shooterJump - 5) * 0.015));
}

/** Meter quality: 1 at the sweet window, falling off either side. */
export function meterQuality(v: number, sweet: readonly [number, number]): number {
  if (v >= sweet[0] && v <= sweet[1]) return 1;
  const d = v < sweet[0] ? sweet[0] - v : v - sweet[1];
  return Math.max(0, 1 - d * 3.2);
}
