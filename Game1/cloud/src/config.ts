// Shared constants & tuning. Gameplay tuning lives in data.ts (pure data, shared
// with verify.ts); this file carries the canvas/boot options.
import type { GameOptions } from '../engine/webgpu.js';

export const BACKGROUND = '#1b2a4a';
export const PIXEL_ART = false;
export const CONTAINER = '#game';

export const GAME_OPTIONS: GameOptions = {
  container: CONTAINER,
  background: BACKGROUND,
  pixelArt: PIXEL_ART,
};
