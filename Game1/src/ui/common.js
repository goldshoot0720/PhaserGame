// 共用 UI 小工具
import { sfxBlip, unlockAudio } from '../systems/audio.js';
import { grade, GRADE_COLORS } from '../systems/data.js';

export const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif';

export function txt(scene, x, y, s, size = 24, color = '#ffffff', opts = {}) {
  return scene.add.text(x, y, s, {
    fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: opts.bold === false ? 'normal' : 'bold',
    stroke: opts.stroke || '#000000', strokeThickness: opts.strokeThickness ?? Math.max(2, Math.round(size / 8)),
    align: opts.align || 'left', wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: opts.lineSpacing || 0,
  });
}

export function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const c = scene.add.container(x, y);
  const color = opts.color ?? 0xffc928;
  const g = scene.add.graphics();
  const draw = (hover, selected) => {
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 14);
    g.fillStyle(selected ? 0xff5a8a : color, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0xffffff, hover ? 0.45 : 0.25); g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.4, 10);
    g.lineStyle(3, 0x1a1a1a, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw(false, false);
  const t = txt(scene, 0, 0, label, opts.size || 26, opts.textColor || '#2a1a00', { stroke: '#ffffff', strokeThickness: 0 }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { draw(true, c.selected); c.setScale(1.04); });
  c.on('pointerout', () => { draw(false, c.selected); c.setScale(1); });
  c.on('pointerdown', () => { unlockAudio(); sfxBlip(1040); onClick && onClick(); });
  c.selected = false;
  c.setSelected = (s) => { c.selected = s; draw(false, s); t.setColor(s ? '#ffffff' : (opts.textColor || '#2a1a00')); };
  c.label = t;
  return c;
}

export function gradeText(scene, x, y, value, size = 26) {
  const gr = grade(value);
  return txt(scene, x, y, gr, size, GRADE_COLORS[gr], { stroke: '#000', strokeThickness: 4 });
}

// 球場夜空背景
export function stadiumBackdrop(scene, alpha = 1) {
  const g = scene.add.graphics();
  const W = 1280, H = 720;
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const c = lerpColor(0x0b1a3e, 0x2f6fb0, t);
    g.fillStyle(c, alpha); g.fillRect(0, (i * H) / 24, W, H / 24 + 1);
  }
  // 看台燈光
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 320;
    g.fillStyle(0xffffff, 0.08 * alpha); g.fillCircle(x, 60, 90);
    g.fillStyle(0xfff6c8, 0.9 * alpha);
    for (let k = 0; k < 6; k++) g.fillCircle(x - 30 + (k % 3) * 30, 50 + Math.floor(k / 3) * 22, 8);
  }
  // 草地
  g.fillStyle(0x2f9e44, alpha); g.fillRect(0, 470, W, 250);
  for (let i = 0; i < 10; i++) { g.fillStyle(i % 2 ? 0x37a94b : 0x2b9340, alpha); g.fillRect(i * 128, 470, 128, 250); }
  return g;
}

export function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function panel(scene, x, y, w, h, color = 0xffffff, alpha = 0.92, radius = 16) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 5, y + 6, w, h, radius);
  g.fillStyle(color, alpha); g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, 0x1a1a1a, 1); g.strokeRoundedRect(x, y, w, h, radius);
  return g;
}
