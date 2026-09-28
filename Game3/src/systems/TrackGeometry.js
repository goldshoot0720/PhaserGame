/**
 * 賽道幾何：由控制點產生封閉的 Catmull-Rom 中心線，並依弧長等距取樣。
 * 提供投影（最近點、側向距離、進度）與沿賽道取點等功能。
 * 物理（牆壁、草地）與繪圖都使用同一條折線，確保判定與畫面一致。
 */

function centripetal(p0, p1, p2, p3, steps, out) {
  const alpha = 0.5;
  const tj = (ti, a, b) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), alpha) + 1e-6;
  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  for (let k = 0; k < steps; k++) {
    const t = t1 + ((t2 - t1) * k) / steps;
    const lerp = (a, b, ta, tb) => {
      const u = (t - ta) / (tb - ta);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    };
    const A1 = lerp(p0, p1, t0, t1);
    const A2 = lerp(p1, p2, t1, t2);
    const A3 = lerp(p2, p3, t2, t3);
    const B1 = lerp(A1, A2, t0, t2);
    const B2 = lerp(A2, A3, t1, t3);
    out.push(lerp(B1, B2, t1, t2));
  }
}

export class TrackGeometry {
  constructor(data, spacing = 16) {
    this.data = data;
    this.roadHalf = data.roadHalf;
    this.wallHalf = data.wallHalf;
    this.width = data.width;
    this.height = data.height;

    // 1) 密集曲線
    const P = data.points;
    const m = P.length;
    const dense = [];
    for (let i = 0; i < m; i++) {
      centripetal(P[(i - 1 + m) % m], P[i], P[(i + 1) % m], P[(i + 2) % m], 40, dense);
    }
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1];
      const b = dense[i % dense.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const Ld = cum[dense.length];

    // 2) 等距重取樣
    const n = Math.max(32, Math.round(Ld / spacing));
    const ds = Ld / n;
    this.n = n;
    this.ds = ds;
    this.length = Ld;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const target = i * ds;
      while (j < dense.length - 1 && cum[j + 1] < target) j++;
      const a = dense[j];
      const b = dense[(j + 1) % dense.length];
      const segL = cum[j + 1] - cum[j] || 1;
      const u = (target - cum[j]) / segL;
      this.x[i] = a[0] + (b[0] - a[0]) * u;
      this.y[i] = a[1] + (b[1] - a[1]) * u;
    }

    // 3) 切線、法線、航向、段長
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.heading = new Float32Array(n);
    this.segLen2 = new Float32Array(n);
    this.segLen = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const dx = this.x[k] - this.x[i];
      const dy = this.y[k] - this.y[i];
      const L = Math.hypot(dx, dy) || 1;
      this.tx[i] = dx / L;
      this.ty[i] = dy / L;
      this.heading[i] = Math.atan2(dy, dx);
      this.segLen[i] = L;
      this.segLen2[i] = L * L;
    }

    // 檢查點（均分 4 段，0 為起終點線）
    this.checkpointCount = data.checkpoints || 4;
    this.checkpointS = [];
    for (let c = 1; c < this.checkpointCount; c++) {
      this.checkpointS.push((this.length * c) / this.checkpointCount);
    }
    this._res = {};
  }

  wrapIndex(i) {
    const n = this.n;
    return ((i % n) + n) % n;
  }

  wrapS(s) {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  /**
   * 找出最接近 (x,y) 的中心線位置。hint < 0 時做全域搜尋。
   * 回傳物件會被重複使用（呼叫端請立即取用數值）。
   */
  project(x, y, hint = -1, win = 26, out = null) {
    const n = this.n;
    let best = Infinity;
    let bi = 0;
    let bt = 0;
    let start = 0;
    let count = n;
    if (hint >= 0) {
      start = hint - win;
      count = win * 2 + 1;
    }
    for (let k = 0; k < count; k++) {
      const i = (((start + k) % n) + n) % n;
      const j = i + 1 === n ? 0 : i + 1;
      const ax = this.x[i];
      const ay = this.y[i];
      const dx = this.x[j] - ax;
      const dy = this.y[j] - ay;
      let t = ((x - ax) * dx + (y - ay) * dy) / this.segLen2[i];
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 < best) {
        best = d2;
        bi = i;
        bt = t;
      }
    }
    const r = out || this._res;
    const j = bi + 1 === n ? 0 : bi + 1;
    const cx = this.x[bi] + (this.x[j] - this.x[bi]) * bt;
    const cy = this.y[bi] + (this.y[j] - this.y[bi]) * bt;
    r.idx = bi;
    r.t = bt;
    r.s = bi * this.ds + bt * this.segLen[bi];
    r.cx = cx;
    r.cy = cy;
    r.dist = Math.sqrt(best);
    // 側向（右手側為正）
    r.lateral = (x - cx) * -this.ty[bi] + (y - cy) * this.tx[bi];
    r.tx = this.tx[bi];
    r.ty = this.ty[bi];
    r.heading = this.heading[bi];
    return r;
  }

  /** 依弧長 s 與側向偏移取得世界座標與航向 */
  pointAt(s, lateral = 0) {
    s = this.wrapS(s);
    const i = Math.min(this.n - 1, Math.floor(s / this.ds));
    const j = (i + 1) % this.n;
    const u = (s - i * this.ds) / this.segLen[i];
    const x = this.x[i] + (this.x[j] - this.x[i]) * u;
    const y = this.y[i] + (this.y[j] - this.y[i]) * u;
    const nx = -this.ty[i];
    const ny = this.tx[i];
    return { x: x + nx * lateral, y: y + ny * lateral, heading: this.heading[i], idx: i };
  }

  /** 前方 steps 個取樣點內的轉向角變化（帶正負號） */
  curvatureAhead(idx, steps) {
    const a = this.heading[this.wrapIndex(idx)];
    const b = this.heading[this.wrapIndex(idx + steps)];
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /** 前方最大轉角（絕對值），用來判斷是否需要甩尾/減速 */
  maxTurnAhead(idx, from, to, stride = 4) {
    let m = 0;
    for (let k = from; k <= to; k += stride) {
      const c = Math.abs(this.curvatureAhead(idx + k, stride * 3));
      if (c > m) m = c;
    }
    return m;
  }
}
