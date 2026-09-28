// Art and session.
import type { Draw, Game, Preload } from '../engine/webgpu.js';
import { CARDS } from './cards.js';

const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/peC2fwqocRE/';
export const ART = {
  table: A + 'art/table/bg-60131598a6.png',
  back: A + 'art/cardback/cardback-1-c4adb3f953.png',
  logo: A + 'art/moe-card-duel/logo-d86dfd3fcb.png',
  music: A + 'music/a-cozy-magical-tavern-card-game-duel-war-d21359aed8c7.mp3',
};
export function preloadArt(load: Preload): void { for (const u of [ART.table, ART.back, ART.logo, ...CARDS.map((c) => c.art)]) load.image(u); }
export function registerArt(game: Game): Record<string, number> {
  const f: Record<string, number> = { table: game.assets.framesOf(ART.table), back: game.assets.framesOf(ART.back), logo: game.assets.framesOf(ART.logo) };
  for (const c of CARDS) f[c.id] = game.assets.framesOf(c.art);
  return f;
}
export function cover(d: Draw, game: Game, frame: number, w: number, h: number, dim = 0): void {
  const sz = game.assets.frameSize(frame), s = Math.max(w / sz.w, h / sz.h);
  d.sprite(frame, (w - sz.w * s) / 2, (h - sz.h * s) / 2, { w: sz.w * s, h: sz.h * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
}
export function fit(d: Draw, game: Game, frame: number, cx: number, bottom: number, h: number, opts: { alpha?: number; tint?: string } = {}): void {
  const sz = game.assets.frameSize(frame), w = (sz.w / sz.h) * h;
  d.sprite(frame, cx - w / 2, bottom - h, { w, h, alpha: opts.alpha, tint: opts.tint });
}
export const session = { result: null as null | { win: boolean | null; turns: number }, musicOn: false, first: 0 };
