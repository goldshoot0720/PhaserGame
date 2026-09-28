// Art + session.
import type { Draw, Game, Preload } from '../engine/webgpu.js';

const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/pqEUqeub1aN/';
export const ART = {
  grass: A + 'art/tiles-a/tiles-a-1-e5c6f551ed.png', forest: A + 'art/tiles-a/tiles-a-2-52aaac485c.png',
  water: A + 'art/tiles-b/tiles-b-1-83eb27ff94.png', mountain: A + 'art/tiles-b/tiles-b-2-aa1b175eb9.png',
  house: A + 'art/tiles-c/tiles-c-1-b93bd4cc71.png', bg: A + 'art/war-table/bg-a914986556.png',
  logo: A + 'art/moe-tactics/logo-5df370de4f.png', music: A + 'music/a-cute-fantasy-turn-based-tactics-game-o-7db591dcac18.mp3',
};
export function preloadArt(load: Preload): void {
  for (const u of [...Object.values(CAST_URLS), ART.grass, ART.forest, ART.water, ART.mountain, ART.house, ART.bg, ART.logo]) load.image(u);
}
export type Frames = Record<string, number>;
export function registerArt(game: Game): Frames {
  const f: Frames = {};
  for (const [k, u] of Object.entries(CAST_URLS)) f[k] = game.assets.framesOf(u);
  for (const k of ['grass', 'forest', 'water', 'mountain', 'house', 'bg', 'logo'] as const) f[k] = game.assets.framesOf(ART[k]);
  return f;
}
export function cover(d: Draw, game: Game, frame: number, w: number, h: number, dim = 0): void {
  const sz = game.assets.frameSize(frame);
  const s = Math.max(w / sz.w, h / sz.h);
  d.sprite(frame, (w - sz.w * s) / 2, (h - sz.h * s) / 2, { w: sz.w * s, h: sz.h * s });
  if (dim > 0) d.rect(0, 0, w, h, '#000000', dim);
}
export function drawChar(d: Draw, game: Game, frame: number, cx: number, bottom: number, h: number, opts: { tint?: string; alpha?: number; flipX?: boolean } = {}): void {
  const sz = game.assets.frameSize(frame);
  const w = (sz.w / sz.h) * h;
  d.sprite(frame, cx - w / 2, bottom - h, { w, h, tint: opts.tint, alpha: opts.alpha, flipX: opts.flipX });
}
export const session = { team: ['whale', 'penguin', 'glasses', 'redcat'] as string[], enemy: [] as string[], map: 0, result: null as null | { win: boolean; turns: number; survivors: string[] }, musicOn: false };
