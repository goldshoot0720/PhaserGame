/**
 * 以 Canvas 2D 把賽道畫成多張 1024x1024 的貼圖區塊（避免單張貼圖過大）。
 * 路面/草地/牆壁都以「沿中心線的粗筆畫」繪製，與物理判定的距離完全一致。
 */
const CHUNK = 1024;
const PAD = 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class TrackRenderer {
  constructor(scene, geom) {
    this.scene = scene;
    this.geom = geom;
    this.data = geom.data;
    this.theme = geom.data.theme;
    this.decos = this.buildDecorations();
  }

  /** 建立（或重用）貼圖並加入場景，回傳 image 陣列 */
  build(depth = 0) {
    const { scene, geom } = this;
    const cols = Math.ceil(geom.width / CHUNK);
    const rows = Math.ceil(geom.height / CHUNK);
    const images = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const key = `track_${this.data.id}_${cx}_${cy}`;
        if (!scene.textures.exists(key)) {
          // 每塊多畫 PAD 像素與鄰塊重疊，避免縮放時出現接縫
          const w = Math.min(CHUNK, geom.width - cx * CHUNK) + PAD * 2;
          const h = Math.min(CHUNK, geom.height - cy * CHUNK) + PAD * 2;
          const tex = scene.textures.createCanvas(key, w, h);
          const ctx = tex.getContext();
          this.drawChunk(ctx, cx * CHUNK - PAD, cy * CHUNK - PAD, w, h, cx + cy * 97);
          tex.refresh();
        }
        images.push(scene.add.image(cx * CHUNK - PAD, cy * CHUNK - PAD, key).setOrigin(0, 0).setDepth(depth));
      }
    }
    return images;
  }

  tracePath(ctx) {
    const g = this.geom;
    ctx.beginPath();
    ctx.moveTo(g.x[0], g.y[0]);
    for (let i = 1; i < g.n; i++) ctx.lineTo(g.x[i], g.y[i]);
    ctx.closePath();
  }

  drawChunk(ctx, ox, oy, w, h, seed) {
    const g = this.geom;
    const th = this.theme;
    const rand = mulberry32(hashStr(this.data.id) + seed * 7919);
    ctx.save();
    ctx.translate(-ox, -oy);

    // 背景
    ctx.fillStyle = th.bg;
    ctx.fillRect(ox, oy, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = th.bgDots[(rand() * th.bgDots.length) | 0];
      const r = 2 + rand() * 7;
      if (th.deco === 'ocean') {
        // 海浪
        const x = ox + rand() * w;
        const y = oy + rand() * h;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, r * 4, 2);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        ctx.arc(ox + rand() * w, oy + rand() * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (th.deco === 'night') {
      // 地磚格線
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 2;
      for (let x = Math.floor(ox / 128) * 128; x < ox + w; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + h); ctx.stroke();
      }
      for (let y = Math.floor(oy / 128) * 128; y < oy + h; y += 128) {
        ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); ctx.stroke();
      }
    }

    // 裝飾（在牆外）
    for (const d of this.decos) {
      if (d.x + 120 < ox || d.x - 120 > ox + w || d.y + 120 < oy || d.y - 120 > oy + h) continue;
      this.drawDeco(ctx, d);
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 陰影
    this.tracePath(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = g.wallHalf * 2 + 34;
    ctx.stroke();

    // 牆（外框兩色）
    this.tracePath(ctx);
    ctx.strokeStyle = th.wallAlt;
    ctx.lineWidth = g.wallHalf * 2 + 22;
    ctx.stroke();
    this.tracePath(ctx);
    ctx.strokeStyle = th.wall;
    ctx.lineWidth = g.wallHalf * 2 + 22;
    ctx.setLineDash([36, 36]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 減速帶
    this.tracePath(ctx);
    ctx.strokeStyle = th.off;
    ctx.lineWidth = g.wallHalf * 2;
    ctx.stroke();
    // 減速帶紋理
    const r2 = mulberry32(seed + 17);
    for (let i = 0; i < g.n; i += 1) {
      const nx = -g.ty[i];
      const ny = g.tx[i];
      for (let side = -1; side <= 1; side += 2) {
        const lat = side * (g.roadHalf + 8 + r2() * (g.wallHalf - g.roadHalf - 14));
        const x = g.x[i] + nx * lat;
        const y = g.y[i] + ny * lat;
        if (x < ox - 10 || x > ox + w + 10 || y < oy - 10 || y > oy + h + 10) continue;
        ctx.fillStyle = th.offDots[(r2() * th.offDots.length) | 0];
        ctx.beginPath();
        ctx.arc(x, y, 2 + r2() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 路緣石
    this.tracePath(ctx);
    ctx.strokeStyle = th.curbA;
    ctx.lineWidth = g.roadHalf * 2 + 18;
    ctx.stroke();
    this.tracePath(ctx);
    ctx.strokeStyle = th.curbB;
    ctx.lineWidth = g.roadHalf * 2 + 18;
    ctx.setLineDash([28, 28]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 路面
    this.tracePath(ctx);
    ctx.strokeStyle = th.road;
    ctx.lineWidth = g.roadHalf * 2;
    ctx.stroke();
    // 路面顆粒
    for (let i = 0; i < 2600; i++) {
      const k = (r2() * g.n) | 0;
      const lat = (r2() * 2 - 1) * (g.roadHalf - 4);
      const x = g.x[k] - g.ty[k] * lat;
      const y = g.y[k] + g.tx[k] * lat;
      if (x < ox || x > ox + w || y < oy || y > oy + h) continue;
      ctx.fillStyle = th.roadDots[(r2() * th.roadDots.length) | 0];
      ctx.fillRect(x, y, 3 + r2() * 5, 3 + r2() * 5);
    }
    if (th.icy) {
      // 冰面反光
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 160; i++) {
        const k = (r2() * g.n) | 0;
        const lat = (r2() * 2 - 1) * (g.roadHalf - 30);
        const x = g.x[k] - g.ty[k] * lat;
        const y = g.y[k] + g.tx[k] * lat;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 30 + r2() * 40, 8 + r2() * 10, g.heading[k], 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 中線虛線
    this.tracePath(ctx);
    ctx.strokeStyle = th.line;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 5;
    ctx.setLineDash([40, 50]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 檢查點（淡淡的橫線）
    for (const s of g.checkpointS) {
      const p = g.pointAt(s, 0);
      this.drawAcross(ctx, p, g.roadHalf, 'rgba(255,255,255,0.18)', 6);
    }

    // 起終點線（棋盤格）
    this.drawStartLine(ctx);

    ctx.restore();
  }

  drawAcross(ctx, p, half, color, width) {
    const nx = -Math.sin(p.heading);
    const ny = Math.cos(p.heading);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p.x - nx * half, p.y - ny * half);
    ctx.lineTo(p.x + nx * half, p.y + ny * half);
    ctx.stroke();
  }

  drawStartLine(ctx) {
    const g = this.geom;
    const p = g.pointAt(0, 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading);
    const cell = 14;
    const rowsN = Math.ceil((g.roadHalf * 2) / cell);
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < rowsN; r++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(-cell * 1.5 + c * cell, -g.roadHalf + r * cell, cell, Math.min(cell, g.roadHalf * 2 - r * cell));
      }
    }
    // 起跑格
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const bx = -70 - k * 80;
      for (const side of [-1, 1]) {
        const by = side * 52;
        ctx.beginPath();
        ctx.moveTo(bx + 24, by - 22);
        ctx.lineTo(bx - 20, by - 22);
        ctx.lineTo(bx - 20, by + 22);
        ctx.lineTo(bx + 24, by + 22);
        ctx.stroke();
      }
    }
    ctx.restore();
    // 起點拱門柱
    const nx = -Math.sin(p.heading);
    const ny = Math.cos(p.heading);
    for (const side of [-1, 1]) {
      const x = p.x + nx * side * (g.wallHalf + 18);
      const y = p.y + ny * side * (g.wallHalf + 18);
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** 以固定亂數種子在牆外放置裝飾物 */
  buildDecorations() {
    const g = this.geom;
    const rand = mulberry32(hashStr(this.data.id + '_deco'));
    const list = [];
    const W = g.width;
    const H = g.height;
    let tries = 0;
    const want = Math.floor((W * H) / 70000);
    while (list.length < want && tries < want * 12) {
      tries++;
      const x = 40 + rand() * (W - 80);
      const y = 40 + rand() * (H - 80);
      const p = g.project(x, y, -1);
      const size = 26 + rand() * 34;
      if (p.dist < g.wallHalf + 30 + size) continue;
      let clash = false;
      for (const d of list) {
        if (Math.abs(d.x - x) < (d.size + size) * 0.9 && Math.abs(d.y - y) < (d.size + size) * 0.9) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      list.push({ x, y, size, kind: rand(), rot: rand() * Math.PI * 2, hue: rand() });
    }
    return list;
  }

  drawDeco(ctx, d) {
    const t = this.theme.deco;
    if (t === 'ocean') this.drawOceanDeco(ctx, d);
    else if (t === 'snow') this.drawSnowDeco(ctx, d);
    else this.drawNightDeco(ctx, d);
  }

  drawOceanDeco(ctx, d) {
    const { x, y, size } = d;
    if (d.kind < 0.45) {
      // 沙島 + 棕櫚樹
      ctx.fillStyle = '#f1d9a0';
      ctx.beginPath(); ctx.ellipse(x, y, size * 1.2, size, d.rot, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(x + 6, y + 6, size * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f9e44';
      for (let k = 0; k < 6; k++) {
        const a = d.rot + (k * Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * size * 0.35, y + Math.sin(a) * size * 0.35, size * 0.45, size * 0.14, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#8d5a2b';
      ctx.beginPath(); ctx.arc(x, y, size * 0.12, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind < 0.8) {
      // 海港大樓（屋頂）
      const s = size * 1.3;
      const cols = ['#f8f9fa', '#ffd8a8', '#a5d8ff', '#ffc9c9', '#d0bfff'];
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - s / 2 + 10, y - s / 2 + 10, s, s);
      ctx.fillStyle = cols[(d.hue * cols.length) | 0];
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - s / 2 + 6, y - s / 2 + 6, s - 12, s - 12);
      ctx.fillStyle = '#868e96';
      ctx.fillRect(x - 8, y - 8, 16, 16);
    } else {
      // 小鯨魚
      ctx.fillStyle = '#1c3f8f';
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.9, size * 0.45, d.rot, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(d.rot);
      ctx.beginPath();
      ctx.moveTo(-size * 0.8, 0); ctx.lineTo(-size * 1.3, -size * 0.4); ctx.lineTo(-size * 1.2, 0); ctx.lineTo(-size * 1.3, size * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(size * 0.45, -size * 0.12, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(size * 0.2, -size * 0.6, 5, 0, Math.PI * 2); ctx.arc(size * 0.3, -size * 0.8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawSnowDeco(ctx, d) {
    const { x, y, size } = d;
    if (d.kind < 0.5) {
      // 松樹（俯視）
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.arc(x + 8, y + 8, size * 0.8, 0, Math.PI * 2); ctx.fill();
      const layers = [['#1e6b45', 0.8], ['#2b8a57', 0.58], ['#3aa56b', 0.36]];
      for (const [c, r] of layers) {
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = d.rot + (k * Math.PI) / 4;
          const rr = k % 2 === 0 ? size * r : size * r * 0.7;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, size * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind < 0.75) {
      // 冰屋
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.arc(x + 6, y + 6, size * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, size * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b9d6f2';
      ctx.lineWidth = 2;
      for (let r = size * 0.25; r < size * 0.75; r += size * 0.18) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#6c8ebf';
      ctx.fillRect(x - size * 0.2, y + size * 0.55, size * 0.4, size * 0.35);
    } else {
      // 企鵝（俯視）
      ctx.fillStyle = '#1c1c22';
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.35, size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x, y + size * 0.08, size * 0.22, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb000';
      ctx.beginPath(); ctx.moveTo(x - 5, y - size * 0.2); ctx.lineTo(x + 5, y - size * 0.2); ctx.lineTo(x, y - size * 0.05); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x - 6, y - size * 0.27, 2.5, 0, Math.PI * 2); ctx.arc(x + 6, y - size * 0.27, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawNightDeco(ctx, d) {
    const { x, y, size } = d;
    const neon = ['#ff4fd8', '#3ef2ff', '#ffe14d', '#7cff6b', '#ff8a3d'];
    const c = neon[(d.hue * neon.length) | 0];
    if (d.kind < 0.55) {
      // 夜市攤位（條紋遮雨棚）
      const s = size * 1.4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - s / 2 + 8, y - s / 2 + 8, s, s * 0.8);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 === 0 ? c : '#ffffff';
        ctx.fillRect(x - s / 2 + (k * s) / 6, y - s / 2, s / 6 + 1, s * 0.8);
      }
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - s / 2, y - s / 2, s, s * 0.8);
      ctx.shadowBlur = 0;
    } else if (d.kind < 0.85) {
      // 燈籠
      ctx.shadowColor = '#ff5a36';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ff5a36';
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.35, size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(x - size * 0.2, y - size * 0.5, size * 0.4, 5);
      ctx.fillRect(x - size * 0.2, y + size * 0.45, size * 0.4, 5);
    } else {
      // 貓咪霓虹招牌
      ctx.shadowColor = c;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = c;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.moveTo(x - size * 0.45, y - size * 0.2);
      ctx.lineTo(x - size * 0.35, y - size * 0.75);
      ctx.lineTo(x - size * 0.1, y - size * 0.48);
      ctx.moveTo(x + size * 0.45, y - size * 0.2);
      ctx.lineTo(x + size * 0.35, y - size * 0.75);
      ctx.lineTo(x + size * 0.1, y - size * 0.48);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /** 小地圖貼圖：回傳 {key, scale, offX, offY, size} */
  buildMinimap(size = 200) {
    const g = this.geom;
    const key = `minimap_${this.data.id}_${size}`;
    const pad = 14;
    const scale = Math.min((size - pad * 2) / g.width, (size - pad * 2) / g.height);
    const offX = (size - g.width * scale) / 2;
    const offY = (size - g.height * scale) / 2;
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, size, size);
      const ctx = tex.getContext();
      ctx.fillStyle = this.theme.miniBg;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, 16);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, size, size);
      }
      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);
      ctx.lineJoin = 'round';
      this.tracePath(ctx);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = g.roadHalf * 2 + 90;
      ctx.stroke();
      this.tracePath(ctx);
      ctx.strokeStyle = this.theme.mini;
      ctx.lineWidth = g.roadHalf * 2 + 20;
      ctx.stroke();
      // 起點
      const p = g.pointAt(0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      tex.refresh();
    }
    return { key, scale, offX, offY, size };
  }
}
