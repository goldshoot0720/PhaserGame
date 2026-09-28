import { CHARACTERS } from '../data/characters.js';
import { hexStr } from '../config.js';

/** 以 Canvas 2D 程序化產生所有非角色圖像 */
function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shade(hex, amt) {
  let r = (hex >> 16) & 255;
  let g = (hex >> 8) & 255;
  let b = hex & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `rgb(${r},${g},${b})`;
}

export function drawKart(ctx, color, accent) {
  // 64 x 40，車頭朝 +x
  ctx.clearRect(0, 0, 64, 40);
  // 輪胎
  ctx.fillStyle = '#15161a';
  rr(ctx, 7, 0, 15, 9, 3); ctx.fill();
  rr(ctx, 7, 31, 15, 9, 3); ctx.fill();
  rr(ctx, 43, 2, 12, 8, 3); ctx.fill();
  rr(ctx, 43, 30, 12, 8, 3); ctx.fill();
  ctx.fillStyle = '#44464f';
  ctx.fillRect(10, 2, 9, 2); ctx.fillRect(10, 36, 9, 2);
  // 車身
  ctx.fillStyle = shade(color, -45);
  ctx.beginPath();
  ctx.moveTo(4, 8); ctx.lineTo(40, 6); ctx.lineTo(61, 14); ctx.lineTo(61, 26); ctx.lineTo(40, 34); ctx.lineTo(4, 32);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = hexStr(color);
  ctx.beginPath();
  ctx.moveTo(6, 10); ctx.lineTo(40, 8); ctx.lineTo(59, 15); ctx.lineTo(59, 25); ctx.lineTo(40, 32); ctx.lineTo(6, 30);
  ctx.closePath(); ctx.fill();
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(8, 11); ctx.lineTo(40, 9.5); ctx.lineTo(56, 15.5); ctx.lineTo(40, 14); ctx.lineTo(8, 15);
  ctx.closePath(); ctx.fill();
  // 中央條紋
  ctx.fillStyle = hexStr(accent);
  ctx.fillRect(36, 17, 22, 6);
  ctx.beginPath(); ctx.moveTo(56, 15); ctx.lineTo(62, 17); ctx.lineTo(62, 23); ctx.lineTo(56, 25); ctx.fill();
  // 座艙
  ctx.fillStyle = '#1b1d24';
  ctx.beginPath(); ctx.ellipse(24, 20, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(accent, 20);
  ctx.beginPath(); ctx.ellipse(34, 20, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
  // 尾翼
  ctx.fillStyle = hexStr(accent);
  rr(ctx, 0, 5, 7, 30, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(5, 5, 2, 30);
  // 排氣管
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(0, 14, 4, 4); ctx.fillRect(0, 22, 4, 4);
}

export function drawItemIcon(ctx, type, s) {
  const c = s / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  if (type === 'missile') {
    ctx.translate(c, c);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.12); ctx.lineTo(-s * 0.36, s * 0.24); ctx.lineTo(-s * 0.36, -s * 0.24); ctx.lineTo(-s * 0.22, -s * 0.12); ctx.fill();
    ctx.fillStyle = '#e9ecef';
    rr(ctx, -s * 0.3, -s * 0.1, s * 0.5, s * 0.2, s * 0.06); ctx.fill();
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.1); ctx.lineTo(s * 0.38, 0); ctx.lineTo(s * 0.2, s * 0.1); ctx.fill();
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(-s * 0.02, -s * 0.1, s * 0.06, s * 0.2);
  } else if (type === 'banana') {
    ctx.translate(c, c);
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#a67c00';
    ctx.lineWidth = s * 0.04;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate((k - 1) * 0.9);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.2, s * 0.1, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#8d6e00';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'shield') {
    ctx.translate(c, c);
    const grd = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    grd.addColorStop(0, '#74c0fc');
    grd.addColorStop(1, '#1c7ed6');
    ctx.fillStyle = grd;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(s * 0.32, -s * 0.26);
    ctx.quadraticCurveTo(s * 0.32, s * 0.2, 0, s * 0.4);
    ctx.quadraticCurveTo(-s * 0.32, s * 0.2, -s * 0.32, -s * 0.26);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${s * 0.36}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 0);
  } else if (type === 'booster') {
    ctx.translate(c, c);
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.4); ctx.lineTo(s * 0.26, -s * 0.05); ctx.lineTo(s * 0.04, -s * 0.03);
    ctx.lineTo(s * 0.16, s * 0.4); ctx.lineTo(-s * 0.26, s * 0.02); ctx.lineTo(-s * 0.04, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff3bf';
    ctx.lineWidth = s * 0.05;
    ctx.stroke();
  } else if (type === 'water') {
    ctx.translate(c, c);
    const grd = ctx.createRadialGradient(-s * 0.1, -s * 0.1, s * 0.05, 0, 0, s * 0.36);
    grd.addColorStop(0, '#e7f5ff');
    grd.addColorStop(0.4, '#4dabf7');
    grd.addColorStop(1, '#1864ab');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#495057';
    ctx.fillRect(-s * 0.06, -s * 0.36, s * 0.12, s * 0.12);
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.36); ctx.quadraticCurveTo(s * 0.12, -s * 0.48, s * 0.2, -s * 0.4); ctx.stroke();
  } else if (type === 'nitro') {
    ctx.translate(c, c);
    const grd = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    grd.addColorStop(0, '#ffe066');
    grd.addColorStop(1, '#f03e3e');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.35, -s * 0.05, s * 0.2, s * 0.25);
    ctx.quadraticCurveTo(0, s * 0.45, -s * 0.2, s * 0.25);
    ctx.quadraticCurveTo(-s * 0.35, -s * 0.05, 0, -s * 0.42);
    ctx.fill();
    ctx.fillStyle = '#fff9db';
    ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.1, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function generateTextures(scene) {
  // 各角色卡丁車
  for (const ch of CHARACTERS) {
    canvasTex(scene, `kart_${ch.id}`, 64, 40, (ctx) => drawKart(ctx, ch.color, ch.accent));
  }

  canvasTex(scene, 'shadow', 72, 48, (ctx) => {
    const g = ctx.createRadialGradient(36, 24, 4, 36, 24, 34);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(36, 24, 36, 24, 0, 0, Math.PI * 2); ctx.fill();
  });

  canvasTex(scene, 'itembox', 44, 44, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 44, 44);
    g.addColorStop(0, '#ff6b6b');
    g.addColorStop(0.33, '#ffd43b');
    g.addColorStop(0.66, '#51cf66');
    g.addColorStop(1, '#4dabf7');
    ctx.fillStyle = g;
    rr(ctx, 2, 2, 40, 40, 9); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    rr(ctx, 2, 2, 40, 40, 9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(ctx, 6, 6, 32, 12, 5); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeText('?', 22, 24);
    ctx.fillText('?', 22, 24);
  });

  for (const t of ['missile', 'banana', 'shield', 'booster', 'water', 'nitro']) {
    canvasTex(scene, `icon_${t}`, 64, 64, (ctx) => drawItemIcon(ctx, t, 64));
  }

  canvasTex(scene, 'missile', 40, 16, (ctx) => {
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(0, 1); ctx.lineTo(0, 15); ctx.fill();
    ctx.fillStyle = '#f1f3f5';
    rr(ctx, 4, 3, 26, 10, 4); ctx.fill();
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.moveTo(29, 3); ctx.lineTo(40, 8); ctx.lineTo(29, 13); ctx.fill();
    ctx.fillStyle = '#339af0';
    ctx.fillRect(16, 3, 3, 10);
  });

  canvasTex(scene, 'banana', 32, 32, (ctx) => drawItemIcon(ctx, 'banana', 32));

  canvasTex(scene, 'waterball', 28, 28, (ctx) => drawItemIcon(ctx, 'water', 28));

  canvasTex(scene, 'bubble', 96, 96, (ctx) => {
    const g = ctx.createRadialGradient(40, 36, 6, 48, 48, 46);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(116,192,252,0.35)');
    g.addColorStop(1, 'rgba(28,126,214,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(48, 48, 45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(48, 48, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(32, 28, 10, 5, -0.6, 0, Math.PI * 2); ctx.fill();
  });

  canvasTex(scene, 'shieldfx', 96, 96, (ctx) => {
    const g = ctx.createRadialGradient(48, 48, 20, 48, 48, 46);
    g.addColorStop(0, 'rgba(255,236,153,0)');
    g.addColorStop(0.75, 'rgba(255,212,59,0.25)');
    g.addColorStop(1, 'rgba(255,250,200,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(48, 48, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(48, 48, 43, 0, Math.PI * 2); ctx.stroke();
  });

  canvasTex(scene, 'splash', 128, 128, (ctx) => {
    ctx.strokeStyle = 'rgba(165,216,255,0.95)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(77,171,247,0.35)';
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  });

  const radial = (key, size, stops) =>
    canvasTex(scene, key, size, size, (ctx) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, c] of stops) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    });
  radial('flame', 32, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,200,60,0.95)'], [0.65, 'rgba(255,90,20,0.6)'], [1, 'rgba(255,40,0,0)']]);
  radial('blueflame', 32, [[0, 'rgba(240,255,255,1)'], [0.35, 'rgba(90,220,255,0.9)'], [0.7, 'rgba(40,110,255,0.5)'], [1, 'rgba(0,50,255,0)']]);
  radial('smoke', 32, [[0, 'rgba(255,255,255,0.8)'], [0.6, 'rgba(230,230,230,0.35)'], [1, 'rgba(200,200,200,0)']]);
  radial('spark', 12, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,230,120,1)'], [1, 'rgba(255,160,0,0)']]);
  radial('glow', 64, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);

  canvasTex(scene, 'skid', 10, 6, (ctx) => {
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    rr(ctx, 0, 0, 10, 6, 3);
    ctx.fill();
  });

  canvasTex(scene, 'confetti', 10, 6, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 10, 6);
  });

  canvasTex(scene, 'star', 24, 24, (ctx) => {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 === 0 ? 12 : 5;
      ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  });

  canvasTex(scene, 'marker', 24, 18, (ctx) => {
    ctx.fillStyle = '#ffe066';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(22, 2); ctx.lineTo(12, 16); ctx.closePath();
    ctx.fill(); ctx.stroke();
  });

  canvasTex(scene, 'pixel', 4, 4, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
  });
}

/** 由載入的頭像產生圓角版與圓形版（需在載入完成後呼叫） */
export function generatePortraitVariants(scene) {
  for (const ch of CHARACTERS) {
    const src = scene.textures.get(`portrait_${ch.id}`).getSourceImage();
    canvasTex(scene, `pround_${ch.id}`, 256, 256, (ctx) => {
      rr(ctx, 0, 0, 256, 256, 36);
      ctx.save();
      ctx.clip();
      ctx.drawImage(src, 0, 0, 256, 256);
      ctx.restore();
    });
    canvasTex(scene, `pcircle_${ch.id}`, 96, 96, (ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(48, 48, 44, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(src, 0, 0, 96, 96);
      ctx.restore();
      ctx.strokeStyle = hexStr(ch.color);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(48, 48, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(48, 48, 47, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}
