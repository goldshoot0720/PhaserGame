import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y } from '../config.js';

export const STAGES = [
  { id: 'dojo', name: '夕陽道場' },
  { id: 'city', name: '霓虹夜街' },
  { id: 'warehouse', name: '黃昏倉庫', image: 'bg5' },
  { id: 'library', name: '古書圖書館', image: 'bg6' },
];

/** Draws a stage background (procedural or photo backdrop + drawn floor). */
export function drawStage(scene, stage) {
  const g = scene.add.graphics().setDepth(0);
  if (stage.image) {
    scene.add.image(WIDTH / 2, HEIGHT / 2, stage.image).setDisplaySize(WIDTH, HEIGHT).setDepth(-1);
    drawPlankFloor(g, stage.id === 'library' ? 0x4a2a16 : 0x2c2622, stage.id === 'library' ? 0x6b3f22 : 0x4a3a2c);
    g.fillStyle(0x000000, 0.25).fillRect(0, 0, WIDTH, 60);
    return;
  }
  if (stage.id === 'dojo') drawDojo(scene, g);
  else drawCity(scene, g);
}

function drawPlankFloor(g, dark, light) {
  g.fillGradientStyle(light, light, dark, dark, 0.9, 0.9, 1, 1);
  g.fillRect(0, GROUND_Y - 30, WIDTH, HEIGHT - GROUND_Y + 30);
  g.lineStyle(2, 0x000000, 0.25);
  for (let y = GROUND_Y - 10; y < HEIGHT; y += 22) g.lineBetween(0, y, WIDTH, y);
  for (let x = -600; x < WIDTH + 600; x += 90) g.lineBetween(WIDTH / 2 + (x - WIDTH / 2) * 0.55, GROUND_Y - 30, x, HEIGHT);
}

function drawDojo(scene, g) {
  g.fillGradientStyle(0x2b1d4d, 0x2b1d4d, 0xff8a3c, 0xffb86b, 1);
  g.fillRect(0, 0, WIDTH, GROUND_Y - 60);
  g.fillStyle(0xffe08a, 0.9).fillCircle(WIDTH * 0.7, 330, 90);
  g.fillStyle(0xfff3c4, 0.3).fillCircle(WIDTH * 0.7, 330, 130);
  // mountains
  g.fillStyle(0x5a3a5e, 1);
  g.fillTriangle(-100, 520, 260, 250, 620, 520);
  g.fillTriangle(420, 520, 760, 300, 1100, 520);
  g.fillTriangle(900, 520, 1180, 280, 1480, 520);
  g.fillStyle(0xffffff, 0.6).fillTriangle(222, 285, 260, 250, 298, 285);
  // back wall of the dojo
  g.fillStyle(0x6b3b24, 1).fillRect(0, 470, WIDTH, GROUND_Y - 500);
  g.fillStyle(0x3d2014, 1);
  for (let x = 0; x < WIDTH; x += 160) g.fillRect(x, 440, 18, GROUND_Y - 470);
  g.fillStyle(0x3d2014, 1).fillRect(0, 430, WIDTH, 22);
  // paper screens
  g.fillStyle(0xf6e7c8, 0.9);
  for (let x = 18; x < WIDTH; x += 160) g.fillRect(x + 8, 470, 126, 100);
  g.lineStyle(2, 0x6b3b24, 1);
  for (let x = 18; x < WIDTH; x += 160) {
    g.lineBetween(x + 71, 470, x + 71, 570);
    g.lineBetween(x + 8, 520, x + 134, 520);
  }
  drawPlankFloor(g, 0x6d4020, 0xa8683a);
  // lanterns (animated sway)
  for (const lx of [140, 1140]) {
    const l = scene.add.graphics({ x: lx, y: 440 }).setDepth(1);
    l.lineStyle(3, 0x222222, 1).lineBetween(0, 0, 0, 30);
    l.fillStyle(0xe8352e, 1).fillEllipse(0, 60, 52, 64);
    l.fillStyle(0xffd27a, 0.5).fillEllipse(0, 60, 30, 50);
    l.fillStyle(0x222222, 1).fillRect(-14, 26, 28, 6).fillRect(-14, 88, 28, 6);
    scene.tweens.add({ targets: l, angle: { from: -4, to: 4 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
}

function drawCity(scene, g) {
  g.fillGradientStyle(0x060818, 0x060818, 0x28154a, 0x3a1a4a, 1);
  g.fillRect(0, 0, WIDTH, GROUND_Y);
  const rnd = new Phaser.Math.RandomDataGenerator(['city']);
  for (let i = 0; i < 70; i++) g.fillStyle(0xffffff, rnd.realInRange(0.2, 0.8)).fillCircle(rnd.between(0, WIDTH), rnd.between(0, 250), 1.5);
  g.fillStyle(0xf4f1d0, 1).fillCircle(200, 110, 44);
  // skyline, two layers
  for (const [color, base, hMin, hMax, lit] of [[0x1a1433, 560, 150, 330, 0.25], [0x100c22, 600, 90, 260, 0.45]]) {
    let x = -20;
    while (x < WIDTH) {
      const w = rnd.between(70, 150);
      const h = rnd.between(hMin, hMax);
      g.fillStyle(color, 1).fillRect(x, base - h, w, h + 80);
      for (let wy = base - h + 14; wy < base - 10; wy += 24) {
        for (let wx = x + 10; wx < x + w - 14; wx += 20) {
          if (rnd.frac() < lit) g.fillStyle(rnd.pick([0xffd86b, 0x7fe3ff, 0xff8ad8]), 0.8).fillRect(wx, wy, 9, 12);
        }
      }
      x += w + rnd.between(0, 20);
    }
  }
  // street
  g.fillStyle(0x24222c, 1).fillRect(0, GROUND_Y - 40, WIDTH, HEIGHT - GROUND_Y + 40);
  g.fillStyle(0x3a3746, 1).fillRect(0, GROUND_Y - 44, WIDTH, 10);
  g.fillStyle(0xe8e0a0, 0.7);
  for (let x = 20; x < WIDTH; x += 160) g.fillRect(x, GROUND_Y + 40, 90, 8);
  // neon signs (flicker)
  for (const [x, y, text, color] of [[330, 330, '拉麵', '#ff4fd8'], [960, 300, '電玩', '#4fe3ff']]) {
    const t = scene.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '54px', fontStyle: 'bold', color, stroke: '#ffffff', strokeThickness: 2 })
      .setOrigin(0.5).setDepth(1).setShadow(0, 0, color, 18, true, true);
    scene.tweens.add({ targets: t, alpha: { from: 1, to: 0.55 }, duration: 120, yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(900, 2500) });
  }
}
