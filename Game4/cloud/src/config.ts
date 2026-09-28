// Canvas/boot options. worldHeight = 14 tiles × 32 px.
import type { GameOptions } from '../engine/webgpu.js';

export const BACKGROUND = '#0a0a14';
export const PIXEL_ART = false;
export const CONTAINER = '#game';
export const WORLD_HEIGHT = 448;

export const GAME_OPTIONS: GameOptions = { container: CONTAINER, background: BACKGROUND, pixelArt: PIXEL_ART, worldHeight: WORLD_HEIGHT };
