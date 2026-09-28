// Shared art registration for the menu scenes.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, BG_URLS, ART } from './data.js';

export function preloadMenu(load: Preload): void {
  for (const u of [...Object.values(CAST_URLS), ...Object.values(BG_URLS), ART.logo]) load.image(u);
}
export function frames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  for (const [k, u] of Object.entries(BG_URLS)) f['bg_' + k] = game.assets.framesOf(u);
  f.logo = game.assets.framesOf(ART.logo);
  return f;
}
export function cover(d: Draw, game: Game, frame: number, w: number, h: number, dim = 0): void {
  const sz = game.assets.frameSize(frame);
  const s = Math.max(w / sz.w, h / sz.h);
  d.sprite(frame, (w - sz.w * s) / 2, (h - sz.h * s) / 2, { w: sz.w * s, h: sz.h * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
}
export function portrait(d: Draw, game: Game, frame: number, cx: number, bottom: number, h: number, opts: { tint?: string; alpha?: number; flipX?: boolean } = {}): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h;
  d.sprite(frame, cx - w / 2, bottom - h, { w, h, tint: opts.tint, alpha: opts.alpha, flipX: opts.flipX });
}
