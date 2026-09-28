// 資產處理：從 public/assets/src/c1..c8.png 產生頭像 (heads) 與立繪 (portraits)
// 用法：npm run assets
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'public/assets/src');
const HEADS = path.join(ROOT, 'public/assets/heads');
const PORTRAITS = path.join(ROOT, 'public/assets/portraits');
fs.mkdirSync(HEADS, { recursive: true });
fs.mkdirSync(PORTRAITS, { recursive: true });

// 頭部裁切區域（已逐張檢視輸出 PNG 後調整）
// mode: 'flood' = 由裁切邊緣做淺色背景洪水填充；'ellipse' = 柔邊橢圓遮罩（背景複雜的兩隻貓）
const HEAD_CROPS = {
  c1: { x: 285, y: 25, w: 500, h: 420, mode: 'flood', tol: 34 },
  c2: { x: 300, y: 5, w: 420, h: 400, mode: 'flood', tol: 30 },
  c3: { x: 420, y: 100, w: 180, h: 205, mode: 'flood', tol: 30 },
  c4: { x: 400, y: 120, w: 200, h: 200, mode: 'flood', tol: 30 },
  // 兩隻貓：背景較暗／雜 → 先以「非亮毛色」由邊緣洪水填充去背，再乘上柔邊橢圓遮罩清掉殘留
  c5: { x: 380, y: 175, w: 250, h: 225, mode: 'ellipse', lum: 105, cx: 0.5, cy: 0.5, rx: 0.56, ry: 0.56 },
  c6: { x: 410, y: 115, w: 260, h: 220, mode: 'ellipse', lum: 150, cx: 0.5, cy: 0.5, rx: 0.56, ry: 0.56 },
  c7: { x: 360, y: 30, w: 310, h: 315, mode: 'flood', tol: 30 },
  c8: { x: 385, y: 60, w: 260, h: 270, mode: 'flood', tol: 30 },
};

const HEAD_SIZE = 256;

function floodRemove(data, w, h, tol) {
  // 取裁切區四角與邊緣的淺色像素當作背景色參考
  const idx = (x, y) => (y * w + x) * 4;
  const isLight = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > 200 && mx - mn < 30;
  };
  // 背景色：取邊緣淺色像素平均
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
    const i = idx(x, y); if (isLight(i)) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; }
  }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
    const i = idx(x, y); if (isLight(i)) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; }
  }
  const bg = n ? [sr / n, sg / n, sb / n] : [245, 245, 245];
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  const removed = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (removed[p]) return;
    if (dist(p * 4) > tol) return;
    removed[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // 設定 alpha，並在邊界做 1px 的半透明羽化
  for (let p = 0; p < w * h; p++) {
    if (removed[p]) { data[p * 4 + 3] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    let nb = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && removed[yy * w + xx]) nb++;
    }
    if (nb) {
      // 邊界像素：越接近背景色越透明
      const d = dist(p * 4);
      const a = Math.min(1, d / (tol * 2.2));
      data[p * 4 + 3] = Math.round(255 * Math.max(0.35, a));
    }
  }
}

function darkFloodRemove(data, w, h, lum) {
  // 由邊緣移除「比毛色暗」的背景像素
  const L = (p) => 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
  const removed = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (removed[p] || L(p) > lum) return;
    removed[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(); const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let p = 0; p < w * h; p++) {
    if (removed[p]) { data[p * 4 + 3] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    let nb = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && removed[yy * w + xx]) nb++;
    }
    if (nb) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * (1 - nb * 0.09));
  }
}

function ellipseMask(data, w, h, c) {
  const cx = c.cx * w, cy = c.cy * h, rx = c.rx * w, ry = c.ry * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    // 0.86 以內不透明，之後柔和淡出到 1.0
    const a = d < 0.86 ? 1 : d > 1 ? 0 : 1 - (d - 0.86) / 0.14;
    const i = (y * w + x) * 4;
    data[i + 3] = Math.round(data[i + 3] * a * a);
  }
}

async function buildHead(id, c) {
  const { data, info } = await sharp(path.join(SRC, `${id}.png`))
    .extract({ left: c.x, top: c.y, width: c.w, height: c.h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (c.mode === 'flood') floodRemove(data, info.width, info.height, c.tol);
  else {
    if (c.lum) darkFloodRemove(data, info.width, info.height, c.lum);
    ellipseMask(data, info.width, info.height, c);
  }
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
  const trimmed = await sharp(buf).trim({ threshold: 1 }).png().toBuffer().catch(() => buf);
  await sharp(trimmed)
    .resize(HEAD_SIZE, HEAD_SIZE, { fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(HEADS, `${id}.png`));
}

async function buildPortrait(id) {
  await sharp(path.join(SRC, `${id}.png`))
    .resize({ height: 400 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PORTRAITS, `${id}.png`));
}

for (const [id, c] of Object.entries(HEAD_CROPS)) {
  await buildHead(id, c);
  await buildPortrait(id);
  console.log('built', id);
}
