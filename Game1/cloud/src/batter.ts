// Batter rig: the cast sprites stand arms-down, so for batting we erase each
// sprite's forearms/hands on a canvas and draw jointed arms, gloves and a bat
// that follow a real swing — stance, load, a level cut through the zone and a
// follow-through over the shoulder.
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
const UPPER = 22;      // upper-arm length (sprite px)
const FORE = 21;       // forearm length
const BAT = 96;        // bat length
const OUTLINE = '#2a1814';
const WOOD = '#dcaa6e';
const GLOVE = '#f5f5f5';

// ── armless sprite frames (built once, asynchronously) ──
const armless: Record<string, number> = {};
let started = false;

/** Kick off building the armless batter frames; drawBatter falls back to the plain sprite until ready. */
export function prepareBatters(game: Game): void {
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

// ── the swing ──
interface Pose {
  /** grip (bottom hand), offset from the shoulders' midpoint, sprite px */
  gx: number; gy: number;
  /** bat direction: yaw around the batter (0 = across the plate, +90° = toward the camera), pitch up */
  yaw: number; pitch: number;
  /** body shift toward the plate (sprite px) and lean (radians) */
  dx: number; rot: number;
}

const STANCE: Pose = { gx: -14, gy: 0, yaw: 160, pitch: 62, dx: 0, rot: -0.03 };
// 蓄力 (load): hands and weight drift back and up while the pitcher winds up.
const LOAD: Pose = { gx: -20, gy: -5, yaw: 174, pitch: 58, dx: -4, rot: -0.06 };
/**
 * Swing keyframes by seconds since the swing started; the bat meets the zone at
 * SWING_CONTACT. 引棒 (bat lag): the hands drive knob-first toward the ball while
 * the barrel stays up and back, then the barrel whips level through contact,
 * extends toward the pitcher and wraps over the front shoulder.
 */
const KEYS: [number, Pose][] = [
  [0, LOAD],
  [0.04, { gx: -2, gy: 12, yaw: 150, pitch: 46, dx: 2, rot: -0.02 }],
  [0.065, { gx: 8, gy: 18, yaw: 70, pitch: 12, dx: 5, rot: 0.03 }],
  [0.08, { gx: 16, gy: 20, yaw: 0, pitch: 2, dx: 6, rot: 0.06 }],
  [0.14, { gx: 18, gy: 10, yaw: -75, pitch: 12, dx: 6, rot: 0.07 }],
  [0.3, { gx: 2, gy: -6, yaw: -165, pitch: 48, dx: 3, rot: 0 }],
];
export const SWING_CONTACT = 0.08;

function mix(a: Pose, b: Pose, k: number): Pose {
  const l = (p: number, q: number): number => p + (q - p) * k;
  return { gx: l(a.gx, b.gx), gy: l(a.gy, b.gy), yaw: l(a.yaw, b.yaw), pitch: l(a.pitch, b.pitch), dx: l(a.dx, b.dx), rot: l(a.rot, b.rot) };
}

/**
 * The batter's pose. `swing` = seconds since the swing began (-1: not swinging),
 * `load` = 0..1 how far into the load (the pitcher's windup), `t` = scene time for the waggle.
 */
export function batterPose(swing: number, load: number, t: number): Pose {
  if (swing < 0) {
    const p = mix(STANCE, LOAD, Math.min(1, Math.max(0, load)));
    const wag = 1 - Math.min(1, load * 1.5);
    return { ...p, yaw: p.yaw + Math.sin(t * 2.4) * 7 * wag, pitch: p.pitch + Math.sin(t * 2.4 + 1) * 4 * wag };
  }
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [ta, a] = KEYS[i], [tb, b] = KEYS[i + 1];
    if (swing <= tb) { const k = (swing - ta) / (tb - ta); return mix(a, b, k * k * (3 - 2 * k)); }
  }
  return KEYS[KEYS.length - 1][1];
}

/** Two-bone arm: the elbow for a shoulder→hand reach (bending out/down). */
function elbow(s: Pt, hand: Pt, bendDown: boolean, k: number): { e: Pt; h: Pt } {
  const U = UPPER * k, F = FORE * k;
  const dx = hand.x - s.x, dy = hand.y - s.y;
  const d = Math.max(1e-3, Math.min(Math.hypot(dx, dy), U + F - 0.5 * k));
  const c = Math.max(-1, Math.min(1, (U * U + d * d - F * F) / (2 * U * d)));
  const ang = Math.atan2(dy, dx) + (bendDown ? 1 : -1) * Math.acos(c);
  const e = { x: s.x + Math.cos(ang) * U, y: s.y + Math.sin(ang) * U };
  const fa = Math.atan2(hand.y - e.y, hand.x - e.x);
  return { e, h: { x: e.x + Math.cos(fa) * F, y: e.y + Math.sin(fa) * F } };
}

/**
 * A rounded, outlined segment. Solid shapes join the sprites' depth-buffered
 * cutout pass (and would sink under the body), so anything meant to sit in
 * front of a sprite goes through the blend pass with a hair of translucency.
 */
function limb(d: Draw, a: Pt, b: Pt, w: number, col: string, k: number, front = true): void {
  const o = w + 2.4 * k, al = front ? 0.995 : 1;
  d.line(a.x, a.y, b.x, b.y, o, OUTLINE, al);
  d.circle(a.x, a.y, o / 2, OUTLINE, al);
  d.circle(b.x, b.y, o / 2, OUTLINE, al);
  d.line(a.x, a.y, b.x, b.y, w, col, al);
  d.circle(a.x, a.y, w / 2, col, al);
  d.circle(b.x, b.y, w / 2, col, al);
}

/**
 * Draw a cast member at bat, feet at (x, y), `h` tall, standing left of the
 * plate. Returns where the bat's barrel is (for effects).
 */
export function drawBatter(d: Draw, game: Game, castFrame: number, id: string, x: number, y: number, h: number, pose: Pose, aim: Pt, swing: number): Pt {
  const rig = RIGS[id] ?? RIGS.whale;
  const frame = armless[id] ?? castFrame;
  const sz = game.assets.frameSize(castFrame);
  const k = h / ART_H;
  const w = (sz.w / sz.h) * h;
  const left = x - w / 2 + pose.dx * k, top = y - h;
  const cx = left + w / 2, cy = top + h / 2;
  const cr = Math.cos(pose.rot), sr = Math.sin(pose.rot);
  // Sprite px → world, following the body's lean about its centre.
  const P = (px: number, py: number): Pt => {
    const ux = left + px * k - cx, uy = top + py * k - cy;
    return { x: cx + ux * cr - uy * sr, y: cy + ux * sr + uy * cr };
  };
  const sh = [P(rig.sh[0].x, rig.sh[0].y), P(rig.sh[1].x, rig.sh[1].y)];
  const mid = { x: (sh[0].x + sh[1].x) / 2, y: (sh[0].y + sh[1].y) / 2 };
  const grip = { x: mid.x + pose.gx * k, y: mid.y + pose.gy * k };

  const yr = (pose.yaw * Math.PI) / 180, pr = (pose.pitch * Math.PI) / 180;
  let bx = Math.cos(pr) * Math.cos(yr);
  const bz = Math.cos(pr) * Math.sin(yr);
  let by = -Math.sin(pr) + bz * 0.4;                 // nearer the camera reads lower
  // Around contact, steer the barrel's sweet spot onto the ball.
  const wC = swing >= 0 ? Math.max(0, 1 - Math.abs(swing - SWING_CONTACT) / 0.05) : 0;
  if (wC > 0) {
    const len = Math.hypot(bx, by);
    const ax = aim.x - grip.x, ay = aim.y - grip.y, al = Math.hypot(ax, ay) || 1;
    const nx = bx + (ax / al * len - bx) * wC, ny = by + (ay / al * len - by) * wC;
    const nl = Math.hypot(nx, ny) || 1;
    bx = (nx / nl) * len; by = (ny / nl) * len;
  }
  const tip = { x: grip.x + bx * BAT * k, y: grip.y + by * BAT * k };
  const knob = { x: grip.x - bx * 6 * k, y: grip.y - by * 6 * k };
  const topHand = { x: grip.x + bx * 8 * k, y: grip.y + by * 8 * k };
  const barrel = { x: grip.x + bx * BAT * 0.45 * k, y: grip.y + by * BAT * 0.45 * k };
  const drawBat = (front: boolean): void => { limb(d, knob, barrel, 5 * k, WOOD, k, front); limb(d, barrel, tip, 10 * k, WOOD, k, front); };

  // Bat raised over the shoulder goes behind the head; otherwise in front of the body.
  const behind = by < -0.35;
  if (behind) drawBat(false);
  d.sprite(frame, left, top, { w, h, rot: pose.rot });
  if (!behind) drawBat(true);
  const arms: [Pt, Pt, boolean][] = [[sh[0], grip, false], [sh[1], topHand, true]];
  for (const [s, target, bend] of arms) {
    const a = elbow(s, target, bend, k);
    limb(d, s, a.e, 12 * k, rig.up, k);
    limb(d, a.e, a.h, 10 * k, rig.fo, k);
  }
  for (const p of [grip, topHand]) { d.circle(p.x, p.y, 7 * k, OUTLINE, 0.995); d.circle(p.x, p.y, 5.8 * k, GLOVE, 0.995); }
  return tip;
}
