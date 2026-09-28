// Canvas/boot options. Gameplay tuning lives in data.ts (shared with verify.ts).
import type { GameOptions } from '../engine/webgpu.js';

export const BACKGROUND = '#241436';
export const PIXEL_ART = false;
export const CONTAINER = '#game';

export const GAME_OPTIONS: GameOptions = {
  container: CONTAINER,
  background: BACKGROUND,
  pixelArt: PIXEL_ART,
};
