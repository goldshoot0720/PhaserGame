// All non-character art is drawn with Graphics and baked into textures here.

import { GAME_HEIGHT, GAME_WIDTH, TILE, TILESET_COUNT, PLAYER, BOSS } from '../config.js';

function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function shade(color, factor) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const gr = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (gr << 8) | b;
}

/** Textures shared by every stage. */
export function createSharedTextures(scene) {
  bake(scene, 'hitbox_player', PLAYER.hitbox.w, PLAYER.hitbox.h, () => {});
  bake(scene, 'hitbox_boss', BOSS.hitbox.w, BOSS.hitbox.h, () => {});

  bake(scene, 'spark', 8, 8, (g) => { g.fillStyle(0xffffff); g.fillCircle(4, 4, 4); });
  bake(scene, 'orb', 18, 18, (g) => {
    g.fillStyle(0xffffff, 0.5); g.fillCircle(9, 9, 9);
    g.fillStyle(0xffffff); g.fillCircle(9, 9, 5);
  });
  bake(scene, 'ring', 64, 64, (g) => { g.lineStyle(4, 0xffffff); g.strokeCircle(32, 32, 28); });

  // Buster shots (small / half charged / fully charged).
  bake(scene, 'shot_small', 12, 8, (g) => {
    g.fillStyle(0xfff3a0); g.fillEllipse(6, 4, 12, 8);
    g.fillStyle(0xffffff); g.fillEllipse(7, 4, 6, 4);
  });
  bake(scene, 'shot_mid', 22, 16, (g) => {
    g.fillStyle(0x7fe0ff, 0.6); g.fillEllipse(11, 8, 22, 16);
    g.fillStyle(0xffffff); g.fillEllipse(13, 8, 12, 8);
  });
  bake(scene, 'shot_full', 44, 28, (g) => {
    g.fillStyle(0x3fb8ff, 0.35); g.fillEllipse(22, 14, 44, 28);
    g.fillStyle(0x7fe0ff, 0.8); g.fillEllipse(26, 14, 30, 20);
    g.fillStyle(0xffffff); g.fillEllipse(30, 14, 16, 10);
  });

  // Special weapons (also reused, tinted, by the bosses).
  bake(scene, 'w_whale', 20, 20, (g) => {
    g.fillStyle(0x6fd6ff, 0.55); g.fillCircle(10, 10, 10);
    g.lineStyle(2, 0xffffff, 0.9); g.strokeCircle(10, 10, 9);
    g.fillStyle(0xffffff); g.fillCircle(6, 6, 3);
  });
  bake(scene, 'w_penguin', 26, 12, (g) => {
    g.fillStyle(0xbff4ff); g.fillTriangle(0, 6, 13, 0, 13, 12); g.fillTriangle(13, 0, 26, 6, 13, 12);
    g.fillStyle(0xffffff); g.fillTriangle(8, 6, 15, 3, 15, 9);
  });
  bake(scene, 'w_glasses', 16, 16, (g) => {
    g.fillStyle(0xffe27a); g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff); g.fillCircle(6, 6, 3);
  });
  bake(scene, 'w_tshirt', 12, 6, (g) => {
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 12, 6, 3);
    g.fillStyle(0xff5fa8); g.fillRect(0, 2, 4, 2);
  });
  bake(scene, 'w_calico', 40, 44, (g) => {
    g.fillStyle(0xffb347);
    for (let i = 0; i < 3; i += 1) {
      g.fillTriangle(8 + i * 11, 44, 14 + i * 11, 44, 24 + i * 9, 2);
    }
  });
  bake(scene, 'w_library', 24, 18, (g) => {
    g.fillStyle(0x7a3b1c); g.fillRect(0, 0, 24, 18);
    g.fillStyle(0xf2e2b6); g.fillRect(3, 3, 19, 12);
    g.fillStyle(0x7a3b1c); g.fillRect(12, 3, 2, 12);
  });
  bake(scene, 'w_redcat', 22, 14, (g) => {
    g.fillStyle(0xff4a1a); g.fillEllipse(12, 7, 20, 14);
    g.fillTriangle(0, 7, 8, 1, 8, 13);
    g.fillStyle(0xffc04a); g.fillEllipse(14, 7, 10, 7);
  });
  bake(scene, 'w_sailor', 34, 40, (g) => {
    g.lineStyle(3, 0xc8f0ff, 0.95);
    for (let i = 0; i < 4; i += 1) g.strokeEllipse(17, 8 + i * 9, 32 - i * 7, 10);
  });

  bake(scene, 'eshot', 12, 12, (g) => {
    g.fillStyle(0xff8a3a); g.fillCircle(6, 6, 6);
    g.fillStyle(0xfff0c0); g.fillCircle(6, 6, 3);
  });
  bake(scene, 'spout', 44, 180, (g) => {
    g.fillStyle(0x6fd6ff, 0.55); g.fillRect(4, 10, 36, 170);
    g.fillStyle(0xffffff, 0.8); g.fillRect(12, 10, 8, 170);
    g.fillStyle(0x9ee7ff, 0.9); g.fillEllipse(22, 12, 44, 24);
  });
  bake(scene, 'flame', 30, 80, (g) => {
    g.fillStyle(0xff4a1a, 0.9); g.fillTriangle(0, 80, 30, 80, 15, 0);
    g.fillStyle(0xffc04a); g.fillTriangle(6, 80, 24, 80, 15, 26);
  });
  bake(scene, 'warning', 44, 10, (g) => { g.fillStyle(0xffffff, 0.8); g.fillEllipse(22, 5, 44, 10); });

  // Generic enemies, drawn light so they can be tinted with the stage colour.
  bake(scene, 'walker', 34, 30, (g) => {
    g.fillStyle(0x333333); g.fillRect(4, 22, 8, 8); g.fillRect(22, 22, 8, 8);
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 4, 34, 22, 10);
    g.fillStyle(0xdddddd); g.fillRect(0, 18, 34, 6);
    g.fillStyle(0x111111); g.fillCircle(24, 12, 5);
    g.fillStyle(0xff3030); g.fillCircle(25, 12, 2);
  });
  bake(scene, 'flyer', 34, 24, (g) => {
    g.fillStyle(0xeeeeee); g.fillTriangle(0, 6, 12, 12, 0, 20); g.fillTriangle(34, 6, 22, 12, 34, 20);
    g.fillStyle(0xffffff); g.fillCircle(17, 12, 10);
    g.fillStyle(0x111111); g.fillCircle(17, 13, 5);
    g.fillStyle(0xffe040); g.fillCircle(18, 12, 2);
  });
  bake(scene, 'turret', 32, 30, (g) => {
    g.fillStyle(0x444444); g.fillRect(0, 22, 32, 8);
    g.fillStyle(0xffffff); g.fillEllipse(16, 18, 30, 24);
    g.fillStyle(0x222222); g.fillRect(14, 12, 18, 6);
    g.fillStyle(0xff3030); g.fillCircle(12, 16, 3);
  });

  bake(scene, 'hp_big', 20, 18, (g) => {
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 20, 18, 5);
    g.fillStyle(0xff4060); g.fillRect(3, 3, 14, 12);
    g.fillStyle(0xffffff); g.fillRect(8, 5, 4, 8); g.fillRect(6, 7, 8, 4);
  });
  bake(scene, 'hp_small', 12, 10, (g) => {
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 12, 10, 3);
    g.fillStyle(0xff4060); g.fillRect(2, 2, 8, 6);
  });
  bake(scene, 'ammo_big', 20, 18, (g) => {
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 20, 18, 5);
    g.fillStyle(0x40a0ff); g.fillRect(3, 3, 14, 12);
    g.fillStyle(0xffffff); g.fillTriangle(10, 4, 5, 10, 15, 10); g.fillRect(8, 10, 4, 4);
  });
  bake(scene, 'ammo_small', 12, 10, (g) => {
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 12, 10, 3);
    g.fillStyle(0x40a0ff); g.fillRect(2, 2, 8, 6);
  });
  bake(scene, 'flag', 20, 32, (g) => {
    g.fillStyle(0xcccccc); g.fillRect(0, 0, 3, 32);
    g.fillStyle(0x40ff90); g.fillTriangle(3, 2, 20, 8, 3, 14);
  });
  bake(scene, 'door', TILE, TILE * 3, (g) => {
    g.fillStyle(0x777788); g.fillRect(0, 0, TILE, TILE * 3);
    g.fillStyle(0x555566);
    for (let y = 4; y < TILE * 3; y += 12) g.fillRect(2, y, TILE - 4, 6);
    g.fillStyle(0xffd040); g.fillRect(TILE / 2 - 2, 0, 4, TILE * 3);
  });
  bake(scene, 'lock', 40, 44, (g) => {
    g.lineStyle(6, 0xcccccc); g.strokeCircle(20, 16, 11);
    g.fillStyle(0xdddddd); g.fillRoundedRect(4, 18, 32, 26, 4);
    g.fillStyle(0x333333); g.fillCircle(20, 29, 4); g.fillRect(18, 30, 4, 8);
  });
}

/** Tileset, background and moving platform for one stage palette. */
export function createStageTextures(scene, key, palette, gimmick) {
  bake(scene, `tiles_${key}`, TILE * TILESET_COUNT, TILE, (g) => {
    const x = (i) => i * TILE;
    // 0 ground
    g.fillStyle(palette.ground); g.fillRect(x(0), 0, TILE, TILE);
    g.fillStyle(palette.detail); g.fillRect(x(0), 0, TILE, 2); g.fillRect(x(0), 0, 2, TILE);
    g.fillRect(x(0) + 8, 12, 6, 6); g.fillRect(x(0) + 20, 22, 5, 5);
    // 1 ground with surface
    g.fillStyle(palette.ground); g.fillRect(x(1), 0, TILE, TILE);
    g.fillStyle(palette.detail); g.fillRect(x(1), 0, 2, TILE); g.fillRect(x(1) + 10, 18, 6, 6);
    g.fillStyle(palette.top); g.fillRect(x(1), 0, TILE, 8);
    g.fillStyle(shade(palette.top, 0.75)); g.fillRect(x(1), 8, TILE, 3);
    // 2 spikes
    const spike = gimmick === 'lava' ? 0xff5a1a : 0xd8d8e0;
    g.fillStyle(spike);
    for (let i = 0; i < 4; i += 1) g.fillTriangle(x(2) + i * 8, TILE, x(2) + i * 8 + 4, 6, x(2) + i * 8 + 8, TILE);
    g.fillStyle(0xffffff, 0.6);
    for (let i = 0; i < 4; i += 1) g.fillTriangle(x(2) + i * 8 + 2, TILE, x(2) + i * 8 + 4, 10, x(2) + i * 8 + 4, TILE);
    // 3 ladder and 4 ladder top (same art, different collision)
    for (const i of [3, 4]) {
      g.fillStyle(palette.accent); g.fillRect(x(i) + 4, 0, 4, TILE); g.fillRect(x(i) + 24, 0, 4, TILE);
      g.fillRect(x(i) + 4, 6, 24, 4); g.fillRect(x(i) + 4, 22, 24, 4);
    }
    // 5 jump-through platform
    g.fillStyle(palette.top); g.fillRect(x(5), 0, TILE, 10);
    g.fillStyle(shade(palette.top, 0.6)); g.fillRect(x(5), 10, TILE, 4);
    // 6 boss room wall
    g.fillStyle(shade(palette.ground, 0.7)); g.fillRect(x(6), 0, TILE, TILE);
    g.lineStyle(2, palette.accent, 0.6); g.strokeRect(x(6) + 3, 3, TILE - 6, TILE - 6);
  });

  bake(scene, `platform_${key}`, TILE * 3, 16, (g) => {
    g.fillStyle(palette.accent); g.fillRoundedRect(0, 0, TILE * 3, 16, 4);
    g.fillStyle(shade(palette.accent, 0.6)); g.fillRect(4, 10, TILE * 3 - 8, 4);
  });

  bake(scene, `bg_${key}`, GAME_WIDTH, GAME_HEIGHT, (g) => {
    const bands = 16;
    for (let i = 0; i < bands; i += 1) {
      const t = i / (bands - 1);
      const c = lerpColor(palette.sky, palette.sky2, t);
      g.fillStyle(c); g.fillRect(0, (GAME_HEIGHT / bands) * i, GAME_WIDTH, GAME_HEIGHT / bands + 1);
    }
    drawBackdrop(g, gimmick, palette);
  });
}

function lerpColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 0xff;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

// Deterministic pseudo random so every run draws the same backdrop.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawBackdrop(g, gimmick, palette) {
  const rand = rng(gimmick.length * 977);
  const far = shade(palette.sky2, 0.6);
  const near = shade(palette.sky, 1.4);
  switch (gimmick) {
    case 'water':
      g.fillStyle(0xffffff, 0.12);
      for (let i = 0; i < 40; i += 1) g.fillCircle(rand() * GAME_WIDTH, rand() * GAME_HEIGHT, 2 + rand() * 6);
      g.fillStyle(far);
      for (let x = 0; x < GAME_WIDTH; x += 100) g.fillRect(x + 20, 120, 30, GAME_HEIGHT);
      break;
    case 'ice':
      g.fillStyle(0xffffff, 0.5);
      for (let x = 0; x < GAME_WIDTH; x += 200) g.fillTriangle(x, 330, x + 100, 110 + rand() * 60, x + 200, 330);
      g.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 60; i += 1) g.fillCircle(rand() * GAME_WIDTH, rand() * GAME_HEIGHT, 1.5);
      break;
    case 'lab':
    case 'city':
      for (let x = 0; x < GAME_WIDTH; x += 80) {
        const h = 120 + rand() * 180;
        g.fillStyle(far); g.fillRect(x, GAME_HEIGHT - h, 70, h);
        g.fillStyle(palette.accent, 0.5);
        for (let y = GAME_HEIGHT - h + 12; y < GAME_HEIGHT - 20; y += 24) {
          if (rand() > 0.4) g.fillRect(x + 10, y, 12, 8);
          if (rand() > 0.4) g.fillRect(x + 40, y, 12, 8);
        }
      }
      break;
    case 'factory':
      g.fillStyle(far);
      for (let x = 0; x < GAME_WIDTH; x += 160) {
        g.fillRect(x + 20, 180, 110, GAME_HEIGHT);
        g.fillRect(x + 40, 80, 18, 100);
      }
      g.fillStyle(palette.accent, 0.35);
      for (let x = 0; x < GAME_WIDTH; x += 160) g.fillCircle(x + 90, 240, 16);
      break;
    case 'library':
      for (let x = 0; x < GAME_WIDTH; x += 100) {
        g.fillStyle(far); g.fillRect(x + 6, 40, 88, GAME_HEIGHT);
        for (let y = 60; y < GAME_HEIGHT; y += 44) {
          g.fillStyle(shade(palette.sky2, 0.4)); g.fillRect(x + 6, y + 36, 88, 6);
          for (let b = x + 10; b < x + 90; b += 8) {
            g.fillStyle(lerpColor(palette.accent, palette.top, rand()), 0.6);
            g.fillRect(b, y + 36 - (24 + rand() * 10), 6, 24 + rand() * 10);
          }
        }
      }
      break;
    case 'lava':
      g.fillStyle(far);
      g.fillTriangle(0, GAME_HEIGHT, 260, 140, 520, GAME_HEIGHT);
      g.fillTriangle(380, GAME_HEIGHT, 640, 200, 900, GAME_HEIGHT);
      g.fillStyle(palette.accent, 0.5);
      for (let i = 0; i < 40; i += 1) g.fillCircle(rand() * GAME_WIDTH, rand() * GAME_HEIGHT, 1 + rand() * 2);
      break;
    case 'wind':
      g.fillStyle(0xffffff, 0.35);
      for (let i = 0; i < 8; i += 1) g.fillEllipse(rand() * GAME_WIDTH, 40 + rand() * 180, 120 + rand() * 80, 24);
      g.fillStyle(far); g.fillRect(0, 330, GAME_WIDTH, GAME_HEIGHT - 330);
      g.fillStyle(near, 0.6);
      for (let x = 0; x < GAME_WIDTH; x += 40) g.fillRect(x, 330 + (x % 80 ? 4 : 0), 30, 4);
      break;
    default: // fortress
      g.fillStyle(far);
      for (let x = 0; x < GAME_WIDTH; x += 120) {
        g.fillRect(x + 10, 140, 90, GAME_HEIGHT);
        g.fillRect(x + 10, 120, 20, 20); g.fillRect(x + 45, 120, 20, 20); g.fillRect(x + 80, 120, 20, 20);
      }
      g.fillStyle(palette.accent, 0.4);
      for (let i = 0; i < 30; i += 1) g.fillCircle(rand() * GAME_WIDTH, rand() * 120, 1.5);
  }
}
