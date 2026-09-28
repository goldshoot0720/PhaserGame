// Shared menu art + backdrop.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, ART } from './data.js';

export const LOGO = 'https://gameblocks.nyc3.digitaloceanspaces.com/S7sNJTEcx8r/art/moe-arena-brawl/logo-3fd7e657d5.png';
export function preloadMenu(load: Preload): void { for (const u of [...Object.values(CAST_URLS), LOGO, ART.crate, ART.bush]) load.image(u); }
export function menuFrames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  f.logo = game.assets.framesOf(LOGO); f.crate = game.assets.framesOf(ART.crate); f.bush = game.assets.framesOf(ART.bush);
  return f;
}
export function backdrop(d: Draw, w: number, h: number, t: number): void {
  const T = 80, off = (t * 30) % (T * 2);
  d.rect(0, 0, w, h, '#f8dbe8');
  for (let y = -T * 2; y < h + T; y += T) for (let x = -T * 2; x < w + T; x += T) if (((x + y) / T) % 2 === 0) d.rect(x + off, y + off, T, T, '#fde7ef');
  d.rect(0, 0, w, h, '#2a2140', 0.25);
}
export function spriteB(d: Draw, game: Game, f: number, cx: number, bottom: number, h: number, flipX = false): void {
  const sz = game.assets.frameSize(f), w = (sz.w / sz.h) * h;
  d.sprite(f, cx - w / 2, bottom - h, { w, h, flipX });
}
