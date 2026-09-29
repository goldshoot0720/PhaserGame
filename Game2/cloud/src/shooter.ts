// Shooting rig: the cast sprites stand arms-down, so for a jump shot we erase each
// sprite's forearms/hands on a canvas (same rig as Game1's batter) and draw jointed
// arms that carry the ball through a real shooting motion.
import type { Draw, Game } from '../engine/webgpu.js';
import { CAST_URLS } from './data.js';

type Pt = { x: number; y: number };
type Box = [number, number, number, number];

interface Rig {
  /** shoulder joints [rear (screen-left), front], sprite px on the 192-tall art */
  sh: [Pt, Pt];
  /** forearm/hand regions to erase */
  er: Box[];
  /** upper-arm and forearm colours */
  up: string;
  fo: string;
  /** erase only arm-coloured pixels (the arms overlap hair/skirt); skin always counts */
  key?: string[];
}

const RIGS: Record<string, Rig> = {
  whale: { sh: [{ x: 38, y: 108 }, { x: 76, y: 108 }], er: [[12, 114, 37, 149], [77, 114, 101, 149]], up: '#2c2972', fo: '#fdddca', key: [] },
  penguin: { sh: [{ x: 30, y: 106 }, { x: 71, y: 106 }], er: [[4, 112, 31, 148], [70, 112, 96, 148]], up: '#403c4c', fo: '#403c4c' },
  glasses: { sh: [{ x: 22, y: 106 }, { x: 66, y: 106 }], er: [[4, 114, 25, 153], [63, 114, 84, 153]], up: '#efcba7', fo: '#efcba7' },
  tshirt: { sh: [{ x: 22, y: 108 }, { x: 66, y: 108 }], er: [[5, 117, 23, 153], [65, 117, 83, 153]], up: '#a3a3b5', fo: '#fdd0b2' },
  calico: { sh: [{ x: 20, y: 106 }, { x: 70, y: 106 }], er: [[0, 110, 19, 147], [71, 110, 91, 147]], up: '#332d36', fo: '#332d36' },
  whitecat: { sh: [{ x: 20, y: 106 }, { x: 68, y: 106 }], er: [[0, 110, 18, 147], [71, 110, 89, 147]], up: '#fce6cb', fo: '#fce6cb' },
  redcat: { sh: [{ x: 38, y: 106 }, { x: 84, y: 106 }], er: [[15, 112, 37, 137], [85, 112, 108, 137]], up: '#42394a', fo: '#42394a', key: ['#42394a', '#231f34', '#0f0b25', '#292437'] },
  sailor: { sh: [{ x: 26, y: 106 }, { x: 70, y: 106 }], er: [[2, 114, 25, 137], [71, 114, 93, 137]], up: '#b9eaf9', fo: '#b9eaf9', key: ['#b9eaf9', '#99c1ee', '#c6edfb'] },
};

const ART_H = 192;     // height of the cast art the rig coordinates refer to

// ── armless sprite frames (built once, asynchronously) ──
const armless: Record<string, number> = {};
let started = false;

/** Kick off building the armless shooter frames; drawShooter falls back to the plain sprite until ready. */
export function prepareShooters(game: Game): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  for (const [id, url] of Object.entries(CAST_URLS)) {
    const rig = RIGS[id];
    if (!rig) continue;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try { armless[id] = game.assets.frames(eraseArms(img, rig)); } catch { /* keep the plain sprite */ }
    };
    img.src = url;
  }
}

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function eraseArms(img: HTMLImageElement, rig: Rig): HTMLCanvasElement {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(data.data);
  const out = data.data;
  const s = h / ART_H;
  const boxes = rig.er.map(([x0, y0, x1, y1]) => [Math.floor(x0 * s), Math.floor(y0 * s), Math.ceil(x1 * s), Math.ceil(y1 * s)] as Box);
  const keyed = !!rig.key;
  const cols = (rig.key ?? []).map(hex);
  const at = (x: number, y: number): number => (y * w + x) * 4;
  const opaque = (x: number, y: number): boolean => src[at(x, y) + 3] >= 40;
  const skin = (i: number): boolean => src[i] > 190 && src[i + 1] > 140 && src[i + 2] > 110 && src[i] - src[i + 2] >= 25 && src[i] >= src[i + 1];
  const keyCol = (i: number): boolean => cols.some((c) => (src[i] - c[0]) ** 2 + (src[i + 1] - c[1]) ** 2 + (src[i + 2] - c[2]) ** 2 < 35 * 35);
  const mask = new Uint8Array(w * h);
  const inBox = (b: Box, x: number, y: number): boolean => x >= b[0] && x < b[2] && y >= b[1] && y < b[3];

  for (const b of boxes) for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
    const i = at(x, y);
    if (src[i + 3] < 40) continue;
    if (!keyed || skin(i) || keyCol(i)) mask[y * w + x] = 1;
  }
  if (keyed) {
    // Swallow the arm's dark outline next to erased pixels.
    for (const b of boxes) for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
      const i = at(x, y);
      if (mask[y * w + x] || src[i + 3] < 40 || 0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2] >= 120) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx] === 1) { near = true; break; }
      }
      if (near) mask[y * w + x] = 2;
    }
    // Drop small clusters stranded inside a box (anti-aliased hand edges).
    for (const b of boxes) {
      const seen = new Uint8Array(w * h);
      for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
        if (mask[y * w + x] || seen[y * w + x] || !opaque(x, y)) continue;
        const comp: number[] = [y * w + x];
        seen[y * w + x] = 1;
        let edge = false;
        for (let k = 0; k < comp.length; k++) {
          const cx = comp[k] % w, cy = (comp[k] - cx) / w;
          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (!inBox(b, nx, ny)) { if (opaque(nx, ny) && !mask[n]) edge = true; continue; }
            if (seen[n] || mask[n] || !opaque(nx, ny)) continue;
            seen[n] = 1;
            comp.push(n);
          }
        }
        if (!edge && comp.length < 60) for (const n of comp) mask[n] = 3;
      }
    }
  }
  for (let n = 0; n < w * h; n++) if (mask[n]) out[n * 4 + 3] = 0;
  if (keyed) {
    // Patch holes inside the silhouette (hair behind the arm) from the nearest kept pixel in the row.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      let l = -1, r = -1;
      for (let k = 1; k < 12 && l < 0; k++) if (x - k >= 0 && !mask[y * w + x - k]) l = x - k;
      for (let k = 1; k < 12 && r < 0; k++) if (x + k < w && !mask[y * w + x + k]) r = x + k;
      if (l < 0 || r < 0 || !opaque(l, y) || !opaque(r, y)) continue;
      const from = at(x - l <= r - x ? l : r, y), to = at(x, y);
      for (let c = 0; c < 4; c++) out[to + c] = src[from + c];
    }
  }
  ctx.putImageData(data, 0, 0);
  return cv;
}


// ── the jump shot ──
// Reference:「完美的投籃有多少細節？3步全面解析投籃姿勢」 https://www.youtube.com/watch?v=KEe1P7aJvGk
// 1. Legs: bend the knees and hold the ball low, then drive up — the ball rises with the legs.
// 2. One motion: the ball travels straight up in front of the body to a set point at the forehead.
// 3. Hands: shooting hand under the ball, elbow beneath it, guide hand on the side; the arm
//    extends fully at release, the wrist snaps down (goose-neck) and the guide hand stays out of it.
// Poses are in art px (192-tall cast art, facing right): x from the sprite's centre, y up from the feet.

/** Seconds from the shot starting (jump) to the ball leaving the fingertips. */
export const SHOT_RELEASE = 0.18;
/** Seconds until the follow-through is over. */
export const SHOT_FINISH = 0.68;
const ART_W = 118;            // typical cast art width at 192 tall
const BALL_R = 14;            // the ball's radius in art px (9.5 world units on a 128-unit body)
const S_UP = 27, S_FORE = 27; // arm segments for the shot, art px
const SKIN = '#fbd9c0';
const LINE = '#252638';
const ease = (x: number): number => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const mixPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** Ball path while it is in the hands: the dip, then one smooth rise to the release. */
const HOLD_IN: Pt = { x: 22, y: 64 };     // coming out of the dribble
const HOLD_LOW: Pt = { x: 18, y: 50 };    // knees bent, ball at the waist
const RISE: [number, Pt][] = [[0, HOLD_LOW], [0.08, { x: 20, y: 98 }], [0.14, { x: 22, y: 126 }], [SHOT_RELEASE, { x: 28, y: 148 }]];

export interface ShotPose {
  /** fraction the figure squashes as the knees bend */
  crouch: number;
  /** ball centre (art px), shooting and guide hands */
  ball: Pt; hand: Pt; guide: Pt;
  /** 0 → 1 wrist snap after the release; 0 → 1 arms coming down at the end */
  wrist: number; relax: number;
  released: boolean;
}

/** `gather` 0..1 = the dip (meter / AI windup), `age` = seconds since the jump (-1 before it). */
export function shotPose(gather: number, age: number): ShotPose {
  const q = ease(gather);
  let ball = mixPt(HOLD_IN, HOLD_LOW, q);
  // Knees load with the dip and straighten as the ball starts up (the legs drive the shot).
  let crouch = 0.07 * q;
  if (age >= 0) {
    crouch = 0.07 * (1 - ease(age / 0.1));
    ball = RISE[RISE.length - 1][1];
    for (let i = 0; i < RISE.length - 1; i++) {
      const [ta, a] = RISE[i], [tb, b] = RISE[i + 1];
      if (age <= tb) { ball = mixPt(a, b, ease((age - ta) / (tb - ta))); break; }
    }
  }
  const released = age >= SHOT_RELEASE;
  const wrist = released ? ease((age - SHOT_RELEASE) / 0.08) : 0;
  const relax = age < 0 ? 0 : ease((age - 0.46) / 0.22);
  // Shooting hand cups the ball from below; guide hand rests on its far side until the
  // set point, then stays put while the ball goes on without it.
  const SET = 0.14;
  const guideOn = (b: Pt): Pt => ({ x: b.x - BALL_R * 0.95, y: b.y + 1 });
  let hand = { x: ball.x - 2, y: ball.y - BALL_R * 0.8 };
  let guide = guideOn(ball);
  if (age > SET) {
    const off = ease((age - SET) / 0.1);
    guide = mixPt(guideOn(shotPose(1, SET).ball), { x: 2, y: 124 }, off);
  }
  if (released) {
    const top = RISE[RISE.length - 1][1];
    hand = mixPt({ x: top.x - 2, y: top.y - BALL_R * 0.8 }, { x: top.x + 4, y: top.y - BALL_R * 0.5 }, wrist);
  }
  hand = mixPt(hand, { x: 24, y: 66 }, relax);
  guide = mixPt(guide, { x: -22, y: 66 }, relax);
  return { crouch, ball, hand, guide, wrist, relax, released };
}

/** Where the ball sits relative to the feet: x along the facing, z up (world units for a `height`-tall body). */
export function shotHand(gather: number, age: number, height: number): { x: number; z: number } {
  const p = shotPose(gather, age), k = height / 192;
  return { x: p.ball.x * k, z: p.ball.y * k * (1 - p.crouch) };
}

/**
 * Two-bone reach in art space (y up). The elbow bends to the `out` side (+1 = larger x);
 * `flare` scales how far it swings sideways — a small value reads as the elbow pointing
 * toward the hoop (into the screen) rather than out to the side.
 */
function reach(s: Pt, h: Pt, out: number, flare: number): { e: Pt; h: Pt } {
  const dx = h.x - s.x, dy = h.y - s.y, full = S_UP + S_FORE - 0.5;
  let d = Math.hypot(dx, dy) || 1e-3;
  if (d > full) { h = { x: s.x + dx / d * full, y: s.y + dy / d * full }; d = full; }
  const c = Math.max(-1, Math.min(1, (S_UP * S_UP + d * d - S_FORE * S_FORE) / (2 * S_UP * d)));
  const base = Math.atan2(dy, dx), bend = Math.acos(c);
  const pick = (a: number): Pt => ({ x: s.x + Math.cos(a) * S_UP, y: s.y + Math.sin(a) * S_UP });
  const e1 = pick(base + bend), e2 = pick(base - bend);
  const e = (e1.x - e2.x) * out >= 0 ? e1 : e2;
  // Pull the elbow back toward the shoulder→hand line by `flare`.
  const ux = (h.x - s.x) / d, uy = (h.y - s.y) / d, t = (e.x - s.x) * ux + (e.y - s.y) * uy;
  const on = { x: s.x + ux * t, y: s.y + uy * t };
  return { e: { x: on.x + (e.x - on.x) * flare, y: on.y + (e.y - on.y) * flare }, h };
}

function segment(d: Draw, a: Pt, b: Pt, width: number, color: string): void {
  d.line(a.x, a.y, b.x, b.y, width + 2, LINE, 0.995);
  d.circle(a.x, a.y, (width + 2) / 2, LINE, 0.995);
  d.circle(b.x, b.y, (width + 2) / 2, LINE, 0.995);
  d.line(a.x, a.y, b.x, b.y, width, color, 0.995);
  d.circle(a.x, a.y, width / 2, color, 0.995);
  d.circle(b.x, b.y, width / 2, color, 0.995);
}

/** A cast member mid jump shot, feet at (x, feet), `height` tall, facing ±1. The ball itself is drawn by the scene. */
export function drawShooter(d: Draw, game: Game, frame: number, id: string, x: number, feet: number, height: number, gather: number, age: number, facing: number): void {
  const pose = shotPose(gather, age), rig = RIGS[id] ?? RIGS.whale;
  const size = game.assets.frameSize(frame), k = height / 192;
  const h = height * (1 - pose.crouch), w = height * size.w / size.h;
  d.sprite(armless[id] ?? frame, x - w / 2, feet - h, { w, h, flipX: facing < 0 });
  const artW = size.w / size.h * 192 || ART_W;
  // Art space → screen: mirrored with the facing, squashed with the knee bend.
  const S = (p: Pt): Pt => ({ x: x + p.x * k * facing, y: feet - p.y * k * (1 - pose.crouch) });
  const sh = (i: 0 | 1): Pt => ({ x: rig.sh[i].x - artW / 2, y: 192 - rig.sh[i].y });
  const shootSh = sh(1), guideSh = sh(0);
  // Shooting elbow under the ball (pointing at the hoop once the hand is above the shoulder);
  // guide elbow out to the side.
  const up = ease((pose.hand.y - shootSh.y) / 30);
  const sa = reach(shootSh, pose.hand, 1, 0.8 - 0.5 * up), ga = reach(guideSh, pose.guide, -1, 0.8);
  for (const [s, a] of [[guideSh, ga], [shootSh, sa]] as [Pt, { e: Pt; h: Pt }][]) {
    segment(d, S(s), S(a.e), 9 * k, rig.up);
    segment(d, S(a.e), S(a.h), 7.5 * k, rig.fo);
    d.circle(S(a.h).x, S(a.h).y, 5.5 * k, LINE, 0.995);
    d.circle(S(a.h).x, S(a.h).y, 4.3 * k, SKIN, 0.995);
  }
  // Fingers: pointing up under the ball, then snapping forward and down (goose-neck) after the release.
  const fa = Math.PI / 2 - pose.wrist * 2.1 * (1 - pose.relax);
  const tip = { x: sa.h.x + Math.cos(fa) * 9, y: sa.h.y + Math.sin(fa) * 9 };
  segment(d, S(sa.h), S(tip), 4.5 * k, SKIN);
}
