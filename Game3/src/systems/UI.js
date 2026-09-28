import Phaser from 'phaser';
import { textStyle } from '../config.js';
import { Sound } from './Sound.js';

/** 圓角按鈕（滑鼠可點、可設定焦點狀態） */
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const w = opts.width || 240;
  const h = opts.height || 60;
  const color = opts.color ?? 0xff5d8f;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const txt = scene.add.text(0, 0, label, textStyle(opts.size || 26, '#ffffff', {
    stroke: '#00000055', strokeThickness: 4,
  })).setOrigin(0.5);
  const draw = (hover) => {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 18);
    g.fillStyle(hover ? Phaser.Display.Color.ValueToColor(color).lighten(15).color : color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.38, 12);
    g.lineStyle(3, 0xffffff, hover ? 1 : 0.7);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  };
  draw(false);
  c.add([g, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { draw(true); c.setScale(1.05); });
  c.on('pointerout', () => { draw(false); c.setScale(1); });
  c.on('pointerdown', () => {
    Sound.unlock();
    Sound.click();
    onClick();
  });
  c.setFocus = (f) => { draw(f); c.setScale(f ? 1.05 : 1); };
  c.label = txt;
  return c;
}

/** 漸層背景 */
export function gradientBg(scene, top, bottom) {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, scene.scale.width, scene.scale.height);
  return g;
}

export function statBar(scene, x, y, label, value, color, width = 200) {
  const c = scene.add.container(x, y);
  const t = scene.add.text(0, 0, label, textStyle(18, '#dfe8ff')).setOrigin(0, 0.5);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.35);
  bg.fillRoundedRect(60, -8, width, 16, 8);
  const fg = scene.add.graphics();
  c.add([t, bg, fg]);
  c.setValue = (v, col = color) => {
    fg.clear();
    fg.fillStyle(col, 1);
    fg.fillRoundedRect(60, -8, Math.max(16, (width * v) / 10), 16, 8);
    fg.fillStyle(0xffffff, 0.3);
    fg.fillRoundedRect(62, -6, Math.max(12, (width * v) / 10 - 4), 5, 3);
  };
  c.setValue(value);
  return c;
}
