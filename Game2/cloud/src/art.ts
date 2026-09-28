// Art registration and anchored drawing. d.sprite() places a frame by its top-left.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { ART, CAST_URLS } from './data.js';
import { BG_W, BG_H } from './court.js';

export function preloadArt(load: Preload): void {
  load.image(ART.court);
  load.image(ART.logo);
  for (const url of Object.values(CAST_URLS)) load.image(url);
}

export interface Frames { court: number; logo: number; cast: Record<string, number>; }

export function registerArt(game: Game): Frames {
  const cast: Record<string, number> = {};
  for (const [id, url] of Object.entries(CAST_URLS)) cast[id] = game.assets.framesOf(url);
  return { court: game.assets.framesOf(ART.court), logo: game.assets.framesOf(ART.logo), cast };
}

/** Image→world transform for the court (cover, bottom-aligned). */
export interface View { s: number; x: number; y: number; }

export function drawCourt(d: Draw, f: Frames, w: number, h: number, dim = 0): View {
  const s = Math.max(w / BG_W, h / BG_H);
  const x = (w - BG_W * s) / 2;
  const y = h - BG_H * s;
  d.sprite(f.court, x, y, { w: BG_W * s, h: BG_H * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
  return { s, x, y };
}

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

/** A filled ellipse (for floor shadows / team rings). */
export function ellipse(d: Draw, cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
  d.fill(pts, color, alpha);
}

export function ellipseRing(d: Draw, cx: number, cy: number, rx: number, ry: number, width: number, color: string, alpha = 1): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
  d.poly(pts, width, color, alpha);
}
