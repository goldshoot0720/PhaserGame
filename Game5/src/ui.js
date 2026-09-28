import { WIDTH, FONT, CONTROLS_TEXT } from './config.js';

/** Bold outlined text used across all scenes. */
export function makeText(scene, x, y, str, size, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000000', strokeThickness: Math.max(3, size / 8), ...extra,
  });
}

/** Key-binding help box. */
export function controlsPanel(scene, y) {
  scene.add.rectangle(WIDTH / 2, y + 48, WIDTH - 60, 112, 0x000000, 0.55).setStrokeStyle(2, 0xffffff, 0.4);
  CONTROLS_TEXT.forEach((line, i) => {
    makeText(scene, WIDTH / 2, y + 12 + i * 34, line, 19, i === 2 ? '#ffe45c' : '#ffffff', { strokeThickness: 3 }).setOrigin(0.5, 0);
  });
}

/** Simple animated backdrop: diagonal speed stripes. */
export function stripesBackground(scene, color = 0x1a0f3a) {
  scene.add.rectangle(WIDTH / 2, 360, WIDTH, 720, 0x07070d);
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  for (let x = -800; x < WIDTH + 800; x += 120) g.fillPoints([{ x, y: 0 }, { x: x + 60, y: 0 }, { x: x - 300, y: 720 }, { x: x - 360, y: 720 }], true);
  scene.tweens.add({ targets: g, x: 120, duration: 2400, repeat: -1 });
  return g;
}
