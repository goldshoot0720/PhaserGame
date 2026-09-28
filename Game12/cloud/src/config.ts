// Canvas/boot options.
import type { GameOptions } from '../engine/webgpu.js';

export const BACKGROUND = '#2a6a8f';
export const PIXEL_ART = false;
export const CONTAINER = '#game';
export const WORLD_HEIGHT = 720;

export const GAME_OPTIONS: GameOptions = { container: CONTAINER, background: BACKGROUND, pixelArt: PIXEL_ART, worldHeight: WORLD_HEIGHT };
