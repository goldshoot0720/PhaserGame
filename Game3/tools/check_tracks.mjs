// 檢查賽道是否自我重疊（牆與牆之間需保持距離），並輸出預覽用折線。
// 用法：node tools/check_tracks.mjs [outJson]
import { TRACKS } from '../src/data/tracks.js';
import { TrackGeometry } from '../src/systems/TrackGeometry.js';
import fs from 'node:fs';

const dump = {};
let ok = true;
for (const t of TRACKS) {
  const g = new TrackGeometry(t);
  let minD = Infinity;
  let where = null;
  for (let i = 0; i < g.n; i++) {
    for (let j = i + 1; j < g.n; j++) {
      let arc = Math.abs(i - j) * g.ds;
      arc = Math.min(arc, g.length - arc);
      if (arc < 1400) continue;
      const d = Math.hypot(g.x[i] - g.x[j], g.y[i] - g.y[j]);
      if (d < minD) {
        minD = d;
        where = [Math.round(g.x[i]), Math.round(g.y[i]), Math.round(g.x[j]), Math.round(g.y[j])];
      }
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < g.n; i++) {
    minX = Math.min(minX, g.x[i]); maxX = Math.max(maxX, g.x[i]);
    minY = Math.min(minY, g.y[i]); maxY = Math.max(maxY, g.y[i]);
  }
  // 最大曲率（每 16px 的轉角）→ 最小轉彎半徑
  let minR = Infinity;
  for (let i = 0; i < g.n; i++) {
    const c = Math.abs(g.curvatureAhead(i, 1));
    if (c > 1e-4) minR = Math.min(minR, g.ds / c);
  }
  const need = t.wallHalf * 2 + 60;
  const pass = minD > need && minX - t.wallHalf > 60 && minY - t.wallHalf > 60 &&
    maxX + t.wallHalf < t.width - 60 && maxY + t.wallHalf < t.height - 60;
  if (!pass) ok = false;
  console.log(`${t.id}: length=${Math.round(g.length)} n=${g.n} minSep=${Math.round(minD)} (need ${need}) at ${where} bbox=[${Math.round(minX)},${Math.round(minY)},${Math.round(maxX)},${Math.round(maxY)}] minRadius=${Math.round(minR)} ${pass ? 'OK' : 'FAIL'}`);
  dump[t.id] = { w: t.width, h: t.height, road: t.roadHalf, wall: t.wallHalf, pts: Array.from(g.x).map((x, i) => [x, g.y[i]]) };
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(dump));
process.exit(ok ? 0 : 1);
