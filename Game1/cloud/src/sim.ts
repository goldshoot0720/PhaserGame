// Pitch flight & contact resolution — pure maths with an injectable RNG, so
// verify.ts can test it headlessly.
import { PITCH_TYPES, PITCH_TIME_BASE, ZONE_W, ZONE_H, type PitchName, type Player } from './data.js';
import type { PitchOutcome } from './rules.js';

export type Rng = () => number;

export interface Pitch {
  type: PitchName;
  /** where the pitch was aimed, in zone units (-1..1 is inside the zone) */
  aimX: number;
  aimY: number;
  /** final location at the plate after control error and break (zone units) */
  endX: number;
  endY: number;
  /** seconds from release to the plate */
  time: number;
  kmh: number;
}

export function makePitch(p: Player, type: PitchName, aimX: number, aimY: number, rng: Rng): Pitch {
  const pt = PITCH_TYPES[type];
  const err = (1 - p.control / 100) * 0.55;
  const endX = aimX + (rng() * 2 - 1) * err;
  const endY = aimY + (rng() * 2 - 1) * err;
  const kmh = Math.round(p.velo * pt.speed - rng() * 3);
  return { type, aimX, aimY, endX, endY, time: PITCH_TIME_BASE * (150 / kmh), kmh };
}

/** Ball position in zone units at flight progress t (0..1): it starts displaced
 *  opposite its break and bends onto (endX, endY) late in the flight. */
export function pitchPos(p: Pitch, t: number): { x: number; y: number } {
  const pt = PITCH_TYPES[p.type];
  const bend = 1 - Math.pow(t, pt.curve);
  return { x: p.endX - pt.dx * bend, y: p.endY - pt.dy * bend };
}

export function inZone(x: number, y: number): boolean {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}

/**
 * Resolve a swing. `timing` is the swing's error in seconds (negative = early),
 * `dist` is the distance from the meet cursor centre to the ball (zone units).
 */
export function resolveSwing(batter: Player, timing: number, dist: number, rng: Rng): PitchOutcome {
  const meetR = 0.35 + batter.meet / 220;         // zone units covered by the cursor
  if (dist > meetR || Math.abs(timing) > 0.11) return 'strike';
  const aim = 1 - dist / meetR;                      // 0 edge … 1 sweet spot
  const time = 1 - Math.abs(timing) / 0.11;
  const q = aim * 0.55 + time * 0.45;                // contact quality 0..1
  if (q < 0.22) return 'foul';
  // Launch: early swings pull, late ones slice foul more often.
  if (Math.abs(timing) > 0.08 && rng() < 0.55) return 'foul';
  const power = q * (0.55 + batter.power / 160) + (rng() - 0.5) * 0.18;
  const r = rng();
  if (power > 1.02) return 'homerun';
  if (power > 0.88) return r < 0.35 ? 'homerun' : r < 0.6 ? 'double' : 'flyout';
  if (power > 0.72) return r < 0.12 + batter.speed / 900 ? 'triple' : r < 0.45 ? 'double' : r < 0.75 ? 'single' : 'flyout';
  if (power > 0.52) return r < 0.5 ? 'single' : r < 0.75 ? 'lineout' : 'groundout';
  return r < 0.25 + batter.speed / 400 ? 'single' : r < 0.6 ? 'groundout' : 'flyout';
}

/** CPU batter: decides whether to swing and how well, given the pitch. */
export function cpuBat(batter: Player, pitch: Pitch, rng: Rng): PitchOutcome {
  const zone = inZone(pitch.endX, pitch.endY);
  const edge = Math.max(Math.abs(pitch.endX), Math.abs(pitch.endY));
  const breakAmt = Math.hypot(PITCH_TYPES[pitch.type].dx, PITCH_TYPES[pitch.type].dy);
  // Swing more at strikes; chase breaking balls just off the plate.
  const swingP = zone ? 0.72 : Math.max(0.03, 0.45 - (edge - 1) * 0.8 + breakAmt * 0.12);
  if (rng() >= swingP) return zone ? 'strike' : 'ball';
  // Harder to square up fast pitches, big breaks and corners.
  const difficulty = (pitch.kmh - 120) / 60 + breakAmt * 0.25 + (zone ? edge * 0.25 : 0.5);
  const dist = Math.max(0, (rng() * 0.9) * (0.55 + difficulty * 0.5) - batter.meet / 400);
  const timing = (rng() * 2 - 1) * (0.05 + difficulty * 0.05);
  return resolveSwing(batter, timing, dist, rng);
}

/** CPU pitcher: picks a pitch and an aim point. */
export function cpuPitch(p: Player, balls: number, strikes: number, rng: Rng): { type: PitchName; aimX: number; aimY: number } {
  const type = p.pitches[Math.floor(rng() * p.pitches.length)];
  const nibble = strikes >= 2 && balls < 3 ? 1.15 : balls >= 3 ? 0.6 : 0.85;
  return { type, aimX: (rng() * 2 - 1) * nibble, aimY: (rng() * 2 - 1) * nibble };
}

export { ZONE_W, ZONE_H };
