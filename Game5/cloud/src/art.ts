// Art registration + helpers.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { ROSTER, STAGES, LOGO } from './roster.js';

export function preloadArt(load: Preload): void {
  for (const u of [...ROSTER.map((f) => f.art), ...STAGES.map((s) => s.url), LOGO]) load.image(u);
}
export interface Frames { fighters: number[]; stages: number[]; logo: number; }
export function registerArt(game: Game): Frames {
  return { fighters: ROSTER.map((f) => game.assets.framesOf(f.art)), stages: STAGES.map((s) => game.assets.framesOf(s.url)), logo: game.assets.framesOf(LOGO) };
}
export function cover(d: Draw, game: Game, frame: number, w: number, h: number, dim = 0): void {
  const sz = game.assets.frameSize(frame);
  const s = Math.max(w / sz.w, h / sz.h);
  d.sprite(frame, (w - sz.w * s) / 2, h - sz.h * s, { w: sz.w * s, h: sz.h * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
}
/** Feet at (x, y), `h` tall; `face` 1 = facing right. */
export function drawFighter(d: Draw, game: Game, frame: number, x: number, y: number, h: number, face: number, faceLeftArt = false, opts: { rot?: number; tint?: string; alpha?: number; sx?: number; sy?: number } = {}): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h * (opts.sx ?? 1), hh = h * (opts.sy ?? 1);
  const flip = faceLeftArt ? face > 0 : face < 0;
  d.sprite(frame, x - w / 2, y - hh, { w, h: hh, flipX: flip, rot: opts.rot, tint: opts.tint, alpha: opts.alpha });
}
