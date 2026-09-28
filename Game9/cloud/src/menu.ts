// Shared menu art + backdrop.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, ART } from './rules.js';

export function preloadMenu(load: Preload): void { for (const u of [...Object.values(CAST_URLS), ART.logo, ART.house, ART.hotel]) load.image(u); }
export function menuFrames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  f.logo = game.assets.framesOf(ART.logo); f.house = game.assets.framesOf(ART.house); f.hotel = game.assets.framesOf(ART.hotel);
  return f;
}
export function backdrop(d: Draw, w: number, h: number, t: number): void {
  const T = 90, off = (t * 24) % (T * 2);
  d.rect(0, 0, w, h, '#123049');
  for (let y = -T * 2; y < h + T; y += T) for (let x = -T * 2; x < w + T; x += T) if (((x + y) / T) % 2 === 0) d.rect(x + off, y + off, T, T, '#173a57');
  // Floating coins.
  for (let i = 0; i < 14; i++) {
    const x = (i * 197 + t * 30 * (1 + (i % 3))) % (w + 60) - 30, y = (i * 131) % h + Math.sin(t * 2 + i) * 14;
    d.circle(x, y, 9 + (i % 3) * 3, '#ffd44a', 0.35); d.ring(x, y, 9 + (i % 3) * 3, 2, '#fff2a8', 0.35);
  }
}
/** Draw a frame bottom-centred at (cx, bottom) scaled to height h. */
export function spriteB(d: Draw, game: Game, f: number, cx: number, bottom: number, h: number, opts: { flipX?: boolean; alpha?: number; tint?: string } = {}): void {
  const sz = game.assets.frameSize(f), w = (sz.w / sz.h) * h;
  d.sprite(f, cx - w / 2, bottom - h, { w, h, ...opts });
}
