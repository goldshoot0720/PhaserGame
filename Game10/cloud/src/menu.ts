// Shared menu art + backdrop.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CAST_URLS, ART } from './rules.js';

export function preloadMenu(load: Preload): void { for (const u of [...Object.values(CAST_URLS), ART.logo, ART.hull, ART.barrel]) load.image(u); }
export function menuFrames(game: Game): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  f.logo = game.assets.framesOf(ART.logo); f.hull = game.assets.framesOf(ART.hull); f.barrel = game.assets.framesOf(ART.barrel);
  return f;
}
export function backdrop(d: Draw, w: number, h: number, t: number): void {
  for (let i = 0; i < 16; i++) d.rect(0, (i * h) / 16, w, h / 16 + 1, '#' + [120 + i * 6, 190 + i * 3, 255].map((c) => c.toString(16).padStart(2, '0')).join(''));
  for (let i = 0; i < 7; i++) {
    const x = ((i * 260 + t * 20) % (w + 300)) - 150, y = 60 + (i * 71) % 220;
    for (const [ox, oy, r] of [[0, 0, 36], [32, 8, 30], [-32, 8, 28]]) d.circle(x + ox, y + oy, r, '#ffffff', 0.75);
  }
  const pts: { x: number; y: number }[] = [{ x: 0, y: h }];
  for (let x = 0; x <= w; x += 16) pts.push({ x, y: h - 150 + 30 * Math.sin(x / 140) + 16 * Math.sin(x / 47) });
  pts.push({ x: w, y: h });
  d.fill(pts, '#b07a4a');
  d.poly(pts.slice(1, -1), 10, '#7ed957');
}
/** Draw a frame bottom-centred at (cx, bottom) scaled to height h. */
export function spriteB(d: Draw, game: Game, f: number, cx: number, bottom: number, h: number, opts: { flipX?: boolean; alpha?: number; tint?: string } = {}): void {
  const sz = game.assets.frameSize(f), w = (sz.w / sz.h) * h;
  d.sprite(f, cx - w / 2, bottom - h, { w, h, ...opts });
}
