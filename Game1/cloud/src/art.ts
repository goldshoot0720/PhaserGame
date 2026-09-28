// Shared art registration + stadium backdrop drawing.
// d.sprite() places a frame by its TOP-LEFT corner; helpers below anchor for you.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { ART, CAST_URLS, BG_W, BG_H, BG_PLATE, BG_MOUND } from './data.js';

export function preloadArt(load: Preload): void {
  load.image(ART.stadium);
  load.image(ART.logo);
  for (const url of Object.values(CAST_URLS)) load.image(url);
}

export interface Frames { stadium: number; logo: number; cast: Record<string, number>; }

export function registerArt(game: Game): Frames {
  const cast: Record<string, number> = {};
  for (const [id, url] of Object.entries(CAST_URLS)) cast[id] = game.assets.framesOf(url);
  return { stadium: game.assets.framesOf(ART.stadium), logo: game.assets.framesOf(ART.logo), cast };
}

export interface Field { s: number; x: number; y: number; plate: { x: number; y: number }; mound: { x: number; y: number }; }

/** Cover the view with the stadium (bottom-aligned) and return where the plate & mound land. */
export function drawStadium(d: Draw, f: Frames, w: number, h: number, dim = 0): Field {
  const s = Math.max(w / BG_W, h / BG_H);
  const x = (w - BG_W * s) / 2;
  const y = h - BG_H * s;
  d.sprite(f.stadium, x, y, { w: BG_W * s, h: BG_H * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
  return {
    s, x, y,
    plate: { x: x + BG_PLATE.x * s, y: y + BG_PLATE.y * s },
    mound: { x: x + BG_MOUND.x * s, y: y + BG_MOUND.y * s },
  };
}

/** Draw an image centred on (cx, cy) at height h (width from its aspect). */
export function drawCentered(d: Draw, game: Game, frame: number, cx: number, cy: number, h: number, alpha = 1): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h;
  d.sprite(frame, cx - w / 2, cy - h / 2, { w, h, alpha });
}

/** Draw a cast member with feet at (x, y), `h` tall. */
export function drawChar(d: Draw, game: Game, frame: number, x: number, y: number, h: number, opts: { flipX?: boolean; rot?: number; tint?: string; alpha?: number } = {}): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h;
  d.sprite(frame, x - w / 2, y - h, { w, h, flipX: opts.flipX, rot: opts.rot, tint: opts.tint, alpha: opts.alpha });
}
