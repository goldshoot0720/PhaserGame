// Shared constants for the whole game.

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 448;
export const TILE = 32;
export const LEVEL_ROWS = 14;

export const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

export const GRAVITY = 1150;

export const PLAYER = {
  displayHeight: 64,
  hitbox: { w: 20, h: 50 },
  slideHitboxHeight: 24,
  runSpeed: 165,
  jumpVelocity: 510,
  jumpCutVelocity: 160,
  coyoteMs: 90,
  slideSpeed: 320,
  slideMs: 320,
  climbSpeed: 120,
  maxHealth: 28,
  maxAmmo: 28,
  startLives: 3,
  invincibleMs: 1300,
  knockbackMs: 380,
  chargeStartMs: 260,
  chargeMidMs: 700,
  chargeFullMs: 1400,
};

export const BOSS = {
  displayHeight: 104,
  hitbox: { w: 40, h: 92 },
  maxHealth: 28,
  rushHealth: 14,
  invincibleMs: 450,
  contactDamage: 4,
};

// Tile indices inside every generated stage tileset.
export const TILES = {
  EMPTY: -1,
  GROUND: 0,
  GROUND_TOP: 1,
  SPIKE: 2,
  LADDER: 3,
  LADDER_TOP: 4,
  PLATFORM: 5,
  WALL: 6,
};
export const TILESET_COUNT = 7;

export const DEPTH = {
  background: -10,
  tiles: 0,
  pickups: 5,
  enemies: 10,
  boss: 12,
  player: 15,
  shots: 20,
  effects: 30,
  hud: 100,
};
