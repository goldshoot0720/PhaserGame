// Pitch flight & contact resolution — pure maths with an injectable RNG, so
// verify.ts can test it headlessly.
import { PITCH_TYPES, PITCH_TIME_BASE, SWING_WINDOW, ZONE_W, ZONE_H, type PitchName, type Player } from './data.js';
import { HIT_BASES, type PitchOutcome } from './rules.js';

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

/** Radius (zone units) of the batter's meet circle. */
export function meetRadius(batter: Player): number {
  return 0.5 + batter.meet / 180;
}

/**
 * Resolve a swing. `timing` is the swing's error in seconds (negative = early),
 * `dist` is the distance from the meet cursor centre to the ball (zone units).
 */
export function resolveSwing(batter: Player, timing: number, dist: number, rng: Rng, hitRate = 1): PitchOutcome {
  const o = contact(batter, timing, dist, rng);
  // Fielders run down a share of the balls in play (used to rein in the CPU).
  if (hitRate < 1 && HIT_BASES[o] && rng() > hitRate) return o === 'single' ? 'groundout' : rng() < 0.5 ? 'lineout' : 'flyout';
  return o;
}

function contact(batter: Player, timing: number, dist: number, rng: Rng): PitchOutcome {
  const meetR = meetRadius(batter);
  if (dist > meetR || Math.abs(timing) > SWING_WINDOW) return 'strike';
  const aim = 1 - dist / meetR;                      // 0 edge … 1 sweet spot
  const time = 1 - Math.abs(timing) / SWING_WINDOW;
  const q = aim * 0.55 + time * 0.45;                // contact quality 0..1
  if (q < 0.2) return 'foul';
  // Launch: very early swings pull, very late ones slice foul more often.
  if (time < 0.3 && rng() < 0.5) return 'foul';
  const power = q * (0.55 + batter.power / 160) + (rng() - 0.5) * 0.18;
  const r = rng();
  if (power > 1.02) return 'homerun';
  if (power > 0.88) return r < 0.35 ? 'homerun' : r < 0.6 ? 'double' : 'flyout';
  if (power > 0.72) return r < 0.12 + batter.speed / 900 ? 'triple' : r < 0.45 ? 'double' : r < 0.75 ? 'single' : 'flyout';
  if (power > 0.52) return r < 0.5 ? 'single' : r < 0.75 ? 'lineout' : 'groundout';
  return r < 0.25 + batter.speed / 400 ? 'single' : r < 0.6 ? 'groundout' : 'flyout';
}

/** Share of the CPU's would-be hits that still fall in. */
const CPU_HIT_RATE = 0.6;

/** CPU batter: decides whether to swing and how well, given the pitch. */
export function cpuBat(batter: Player, pitch: Pitch, rng: Rng): PitchOutcome {
  const zone = inZone(pitch.endX, pitch.endY);
  const edge = Math.max(Math.abs(pitch.endX), Math.abs(pitch.endY));
  const breakAmt = Math.hypot(PITCH_TYPES[pitch.type].dx, PITCH_TYPES[pitch.type].dy);
  // Swing more at strikes; chase breaking balls just off the plate.
  const swingP = zone ? 0.68 : Math.max(0.03, 0.42 - (edge - 1) * 0.8 + breakAmt * 0.12);
  if (rng() >= swingP) return zone ? 'strike' : 'ball';
  // Harder to square up fast pitches, big breaks, corners and chases.
  const difficulty = (pitch.kmh - 115) / 45 + breakAmt * 0.45 + (zone ? edge * edge * 0.6 : 0.9);
  const skill = batter.meet / 100;
  // A clean miss: the CPU is fooled outright.
  if (rng() < Math.min(0.7, 0.16 + difficulty * 0.22 - skill * 0.12)) return 'strike';
  // Otherwise contact quality falls with difficulty: aim and timing errors scale
  // with the batter's own meet circle / the timing window.
  const meetR = meetRadius(batter);
  const miss = 0.3 + difficulty * 0.25 - skill * 0.2;
  const dist = Math.min(meetR, rng() * meetR * miss + rng() * 0.15);
  const timing = (rng() * 2 - 1) * SWING_WINDOW * Math.min(1, miss + 0.1);
  return resolveSwing(batter, timing, dist, rng, CPU_HIT_RATE);
}

/** CPU pitcher: picks a pitch and an aim point. */
export function cpuPitch(p: Player, balls: number, strikes: number, rng: Rng): { type: PitchName; aimX: number; aimY: number } {
  const type = p.pitches[Math.floor(rng() * p.pitches.length)];
  const nibble = strikes >= 2 && balls < 3 ? 1.15 : balls >= 3 ? 0.6 : 0.85;
  return { type, aimX: (rng() * 2 - 1) * nibble, aimY: (rng() * 2 - 1) * nibble };
}

export { ZONE_W, ZONE_H };
