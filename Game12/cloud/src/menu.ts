// Shared menu art + backdrop.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, ART } from './rules.js';

export function preloadMenu(load: Preload): void { for (const u of [...Object.values(CAST_URLS), ART.logo, ART.crate, ART.house, ART.balloon, ART.potion, ART.skate, ART.needle]) load.image(u); }
export function menuFrames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  for (const k of ['logo', 'crate', 'house', 'balloon', 'potion', 'skate', 'needle'] as const) f[k] = game.assets.framesOf(ART[k]);
  return f;
}
/** Sky-blue checker with drifting bubbles. */
export function backdrop(d: Draw, w: number, h: number, t: number): void {
  d.rect(0, 0, w, h, '#5ec8f0');
  const T = 80, off = (t * 20) % (T * 2);
  for (let y = -T * 2; y < h + T; y += T) for (let x = -T * 2; x < w + T; x += T) if (((x + y) / T) % 2 === 0) d.rect(x + off, y + off, T, T, '#6fd2f6');
  for (let i = 0; i < 18; i++) {
    const r = 10 + (i % 4) * 8, x = (i * 151) % w + Math.sin(t + i) * 20, y = h - ((t * (30 + (i % 3) * 20) + i * 97) % (h + 80)) + 40;
    d.circle(x, y, r, '#ffffff', 0.25); d.ring(x, y, r, 2, '#ffffff', 0.7); d.circle(x - r * 0.35, y - r * 0.35, r * 0.2, '#ffffff', 0.8);
  }
}
/** Draw a frame bottom-centred at (cx, bottom) scaled to height h. */
export function spriteB(d: Draw, game: Game, f: number, cx: number, bottom: number, h: number, opts: { flipX?: boolean; alpha?: number; tint?: string } = {}): void {
  const sz = game.assets.frameSize(f), w = (sz.w / sz.h) * h;
  d.sprite(f, cx - w / 2, bottom - h, { w, h, ...opts });
}
