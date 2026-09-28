// Shared menu art + backdrop.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, ART } from './rules.js';

export function preloadMenu(load: Preload): void { for (const u of [...Object.values(CAST_URLS), ART.logo, ART.jet, ART.space]) load.image(u); }
export function menuFrames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  f.logo = game.assets.framesOf(ART.logo); f.jet = game.assets.framesOf(ART.jet); f.spaceMenu = game.assets.framesOf(ART.space);
  return f;
}
/** Starry scrolling backdrop behind the menus. */
export function backdrop(d: Draw, game: Game, f: Record<string, number>, w: number, h: number, t: number): void {
  d.rect(0, 0, w, h, '#0b0b2a');
  const tile = h * 0.75, off = (t * 30) % (h * 1.5);
  for (let x = 0; x < w; x += tile) for (let k = -1; k < 2; k++) {
    const y = off + k * h * 1.5 - h * 0.75;
    d.sprite(f.spaceMenu, x, y, { w: tile, h: h * 0.75, rot: Math.PI, flipX: true, alpha: 0.55 });
    d.sprite(f.spaceMenu, x, y + h * 0.75, { w: tile, h: h * 0.75, alpha: 0.55 });
  }
  for (let i = 0; i < 50; i++) d.rect((i * 173) % w, (i * 97 + t * (90 + (i % 3) * 70)) % h, 2, 5 + (i % 3) * 3, '#ffffff', 0.5);
  void game;
}
/** Draw a frame centred at (cx, cy), scaled so its longest side is `size`. */
export function spriteC(d: Draw, game: Game, f: number, cx: number, cy: number, size: number, opts: { flipX?: boolean; alpha?: number; tint?: string; rot?: number } = {}): void {
  const sz = game.assets.frameSize(f), k = size / Math.max(sz.w, sz.h), w = sz.w * k, h = sz.h * k;
  d.sprite(f, cx - w / 2, cy - h / 2, { w, h, ...opts });
}
