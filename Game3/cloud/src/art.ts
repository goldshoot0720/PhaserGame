// Art registration + anchored drawing (d.sprite places by the top-left corner).
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { ART, CAST_URLS, KART_URLS, TRACKS } from './data.js';

export function preloadArt(load: Preload): void {
  for (const u of [...Object.values(CAST_URLS), ...Object.values(KART_URLS), ART.logo, ART.palm, ART.snowman, ART.lamp, ART.itembox, ART.banana, ...TRACKS.map((t) => t.sky)]) load.image(u);
}

export interface Frames {
  cast: Record<string, number>; kart: Record<string, number>; sky: number[];
  logo: number; palm: number; snowman: number; lamp: number; itembox: number; banana: number;
}

export function registerArt(game: Game): Frames {
  const a = game.assets;
  const cast: Record<string, number> = {}, kart: Record<string, number> = {};
  for (const [id, u] of Object.entries(CAST_URLS)) cast[id] = a.framesOf(u);
  for (const [id, u] of Object.entries(KART_URLS)) kart[id] = a.framesOf(u);
  return {
    cast, kart, sky: TRACKS.map((t) => a.framesOf(t.sky)),
    logo: a.framesOf(ART.logo), palm: a.framesOf(ART.palm), snowman: a.framesOf(ART.snowman), lamp: a.framesOf(ART.lamp),
    itembox: a.framesOf(ART.itembox), banana: a.framesOf(ART.banana),
  };
}

/** Draw a frame with its bottom-centre at (x, y), `w` wide (height from aspect). */
export function drawBottom(d: Draw, game: Game, frame: number, x: number, y: number, w: number, opts: { rot?: number; alpha?: number; tint?: string; flipX?: boolean } = {}): void {
  const sz = game.assets.frameSize(frame);
  const h = (sz.h / sz.w) * w;
  d.sprite(frame, x - w / 2, y - h, { w, h, rot: opts.rot, alpha: opts.alpha, tint: opts.tint, flipX: opts.flipX });
}

export function drawCentered(d: Draw, game: Game, frame: number, cx: number, cy: number, h: number, alpha = 1): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h;
  d.sprite(frame, cx - w / 2, cy - h / 2, { w, h, alpha });
}

/** Cover the view with an image. */
export function cover(d: Draw, game: Game, frame: number, w: number, h: number, dim = 0): void {
  const sz = game.assets.frameSize(frame);
  const s = Math.max(w / sz.w, h / sz.h);
  d.sprite(frame, (w - sz.w * s) / 2, (h - sz.h * s) / 2, { w: sz.w * s, h: sz.h * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
}
