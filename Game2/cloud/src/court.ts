// Court geometry in "floor px" — the pixel space of the 1024×614 court image. The
// floor is a perspective trapezoid; entities live on it at (x, y) plus a height z.
import { clamp } from './ui.js';

export const BG_W = 1024;
export const BG_H = 614;
export const HOOP = { x: 512, y: 404 };        // the floor point under the rim
export const RIM = { x: 512, y: 272 };         // the rim in image space
export const RIM_HEIGHT = HOOP.y - RIM.y;      // screen px of rim height at the hoop's depth
export const TOP_Y = 408;                      // baseline (just in front of the hoop post)
export const BOTTOM_Y = 604;                   // the far edge of the playable half
export const ARC = { cx: 512, cy: 404, rx: 222, ry: 100 }; // three-point line (ellipse)
export const TOP_OF_KEY = { x: 512, y: 540 };  // check-ball spot beyond the arc

/** Horizontal half-width of the floor at depth y (trapezoid edges). */
export function halfWidth(y: number): number {
  // (275,400) → (120,545): 237 at y=400, 392 at y=545.
  return 237 + ((y - 400) * (392 - 237)) / 145;
}

/** Perspective scale for a sprite standing at depth y. */
export function depthScale(y: number): number {
  return 0.78 + ((y - TOP_Y) / (BOTTOM_Y - TOP_Y)) * 0.42;
}

export function clampToCourt(p: { x: number; y: number }): void {
  p.y = clamp(p.y, TOP_Y, BOTTOM_Y);
  const hw = halfWidth(p.y) - 18;
  p.x = clamp(p.x, 512 - hw, 512 + hw);
}

/** Outside the three-point arc (an ellipse centred on the hoop). */
export function isThree(x: number, y: number): boolean {
  const u = (x - ARC.cx) / ARC.rx, v = (y - ARC.cy) / ARC.ry;
  return u * u + v * v > 1;
}

/** "Real" distance to the hoop, compensating for the squashed depth axis. */
export function hoopDist(x: number, y: number): number {
  return Math.hypot(x - HOOP.x, (y - HOOP.y) * (ARC.rx / ARC.ry));
}

export function floorDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * (ARC.rx / ARC.ry));
}
