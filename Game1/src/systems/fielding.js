// 守備判定：由擊球飛行軌跡決定出局 / 安打 / 全壘打，並計算跑者推進
import { simulateFlight } from './physics.js';

// 球場座標 (公尺)：本壘 (0,0)，y 朝中外野，x 朝右外野
export const BASES = [
  { x: 0, y: 0 },          // 0: 本壘
  { x: 19.4, y: 19.4 },    // 1: 一壘
  { x: 0, y: 38.8 },       // 2: 二壘
  { x: -19.4, y: 19.4 },   // 3: 三壘
];

export const FIELDERS = [
  { id: 'P', name: '投手', x: 0, y: 18.4, sp: 5.8, react: 0.4, inf: true },
  { id: 'C', name: '捕手', x: 0, y: -1.2, sp: 5.4, react: 0.35, inf: true },
  { id: '1B', name: '一壘手', x: 15, y: 24, sp: 6.2, react: 0.35, inf: true },
  { id: '2B', name: '二壘手', x: 10.5, y: 36, sp: 6.7, react: 0.35, inf: true },
  { id: 'SS', name: '游擊手', x: -10.5, y: 36, sp: 6.8, react: 0.35, inf: true },
  { id: '3B', name: '三壘手', x: -15.5, y: 24, sp: 6.2, react: 0.35, inf: true },
  { id: 'LF', name: '左外野手', x: -28, y: 78, sp: 7.3, react: 0.5, inf: false },
  { id: 'CF', name: '中外野手', x: 0, y: 90, sp: 7.6, react: 0.5, inf: false },
  { id: 'RF', name: '右外野手', x: 28, y: 78, sp: 7.3, react: 0.5, inf: false },
];

const CATCH_H = 2.6;
const REACH = 1.3;
const BASE_LEN = 27.43;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function runSpeed(player) { return 6.2 + (player.speed / 100) * 2.6; } // m/s

export function ballXY(spray, d) {
  const a = (spray * Math.PI) / 180;
  return { x: d * Math.sin(a), y: d * Math.cos(a) };
}

function findFielder(flight, spray) {
  let best = null;
  const landT = flight.landed ? flight.landed.t : Infinity;
  for (const f of FIELDERS) {
    for (const s of flight.samples) {
      if (s.h > CATCH_H || s.t < 0.25) continue;
      const air = s.t < landT;
      if (f.id === 'C' && air && s.h > 0.2) continue;
      const p = ballXY(spray, s.d);
      // 空中球：判斷落點需要較長反應時間，撲接範圍較小
      const react = f.react + (air ? (f.inf ? 0.12 : 0.55) : 0);
      const sp = air ? f.sp * 0.9 : f.sp;
      const need = dist(f, p) - (air ? (f.inf ? 0.9 : 1.1) : REACH);
      const can = Math.max(0, s.t - react) * sp;
      if (need <= can) {
        if (!best || s.t < best.t) best = { f, t: s.t, p, h: s.h };
        break;
      }
    }
  }
  if (!best) {
    // 球停止後最近的野手去撿
    const last = flight.samples[flight.samples.length - 1];
    const p = ballXY(spray, last.d);
    let f = FIELDERS[0], md = Infinity;
    for (const ff of FIELDERS) { const dd = dist(ff, p); if (dd < md) { md = dd; f = ff; } }
    best = { f, t: Math.max(last.t, f.react + md / f.sp), p, h: 0 };
  }
  return best;
}

// 強迫進壘：batter 上一壘時，被擠的跑者前進一個壘包
function forceAdvance(bases, batter) {
  const nb = [...bases];
  let runs = [];
  if (nb[0]) {
    if (nb[1]) {
      if (nb[2]) runs.push(nb[2]);
      nb[2] = nb[1];
    }
    nb[1] = nb[0];
  }
  nb[0] = batter;
  return { bases: nb, runs };
}

// 所有跑者推進 n 個壘包（依照各壘位置額外推進）
function advanceAll(bases, extraFn) {
  const nb = [null, null, null];
  const runs = [];
  for (let i = 2; i >= 0; i--) {
    const r = bases[i];
    if (!r) continue;
    let to = i + 1 + extraFn(i + 1); // 目標壘 (1-based)，>=4 得分
    while (to <= 3 && nb[to - 1]) to++; // 避免重疊
    if (to >= 4) runs.push(r); else nb[to - 1] = r;
  }
  return { bases: nb, runs };
}

/**
 * 判定一次擊出去的球（非界外）
 * @returns outcome { code, label, outs, runs(players), bases, batterBases, fielder, t, point, flight, throwTo }
 */
export function resolvePlay(bb, batter, bases, outs, br = batter) {
  // br: 打者跑者物件（放進壘包 / 得分陣列中）
  const flight = simulateFlight(bb);
  const base = { flight, spray: bb.spray };

  if (flight.homeRun) {
    const runs = [...bases.filter(Boolean), br];
    const hr = flight.samples.find((s) => s.d >= flight.fence) || flight.samples[flight.samples.length - 1];
    return {
      ...base, code: 'HR', label: '全壘打', hit: true, batterBases: 4, outs: 0,
      runs, bases: [null, null, null], t: hr.t, point: ballXY(bb.spray, hr.d), fielder: null,
      distance: Math.round(flight.samples[flight.samples.length - 1].d - 10),
    };
  }

  const fb = findFielder(flight, bb.spray);
  const landedT = flight.landed ? flight.landed.t : Infinity;
  const common = { ...base, fielder: fb.f, t: fb.t, point: fb.p };

  // 空中接殺
  if (fb.t < landedT - 0.01) {
    const d = Math.hypot(fb.p.x, fb.p.y);
    let code = 'FLY', label = '飛球接殺';
    if (bb.launch < 18 && fb.h > 0.3) { code = 'LINE'; label = '平飛球接殺'; }
    if (bb.launch > 48 && d < 55) { code = 'POP'; label = '內野高飛接殺'; }
    if (bb.bunt) { code = 'POP'; label = '短打小飛球被接'; }
    const newOuts = outs + 1;
    let nb = [...bases];
    const runs = [];
    // 高飛犧牲打：三壘跑者回壘觸壘後衝本壘
    if (newOuts < 3 && code === 'FLY' && d > 62 && nb[2]) {
      runs.push(nb[2]); nb[2] = null; label = '高飛犧牲打';
      code = 'SACFLY';
    }
    if (newOuts < 3 && code === 'FLY' && d > 88 && nb[1] && !nb[2]) { nb[2] = nb[1]; nb[1] = null; }
    return { ...common, code, label, hit: false, outs: 1, runs, bases: nb, batterBases: 0, throwTo: null };
  }

  // 落地後接球
  const f = fb.f;
  const tRunner1 = 0.95 + BASE_LEN / runSpeed(batter) + (bb.bunt ? -0.15 : 0);
  if (f.inf) {
    const tThrow = fb.t + 0.55 + dist(fb.p, BASES[1]) / 31;
    const margin = tRunner1 - tThrow; // >0 = 出局
    if (margin > 0) {
      // 雙殺
      if (bases[0] && outs < 2 && !bb.bunt && margin > 0.55 && fb.t < 2.2) {
        const newOuts = outs + 2;
        const adv = advanceAll([null, bases[1], bases[2]], () => 0);
        const runs = newOuts >= 3 ? [] : adv.runs;
        return {
          ...common, code: 'DP', label: '雙殺打', hit: false, outs: 2, runs,
          bases: newOuts >= 3 ? [null, null, null] : adv.bases, batterBases: 0, throwTo: 2,
        };
      }
      const newOuts = outs + 1;
      const adv = advanceAll(bases, () => 0);
      const runs = newOuts >= 3 ? [] : adv.runs;
      const sac = bb.bunt && bases.some(Boolean) && newOuts < 3;
      return {
        ...common, code: sac ? 'SAC' : 'GO', label: sac ? '犧牲短打成功' : (bb.bunt ? '短打出局' : '滾地球出局'),
        hit: false, outs: 1, runs, bases: newOuts >= 3 ? [null, null, null] : adv.bases, batterBases: 0, throwTo: 1,
      };
    }
    // 內野安打
    const fa = forceAdvance(bases, br);
    return {
      ...common, code: '1B', label: bb.bunt ? '短打安打' : '內野安打', hit: true, outs: 0,
      runs: fa.runs, bases: fa.bases, batterBases: 1, throwTo: 1,
    };
  }

  // 外野安打：計算打者能跑到幾壘
  const rs = runSpeed(batter);
  let n = 1;
  for (let k = 2; k <= 3; k++) {
    const tRun = 0.95 + ((k * BASE_LEN) / rs) * 0.96 + 0.2 * (k - 1);
    const tBall = fb.t + 0.9 + dist(fb.p, BASES[k]) / 24; // 撿球 + 轉傳
    if (tRun < tBall) n = k;
  }
  const adv = advanceAll(bases, (from) => (n === 1 && from >= 2 ? 1 : 0) + (n === 2 && from === 1 ? 1 : 0) + (n - 1));
  const nb = [...adv.bases];
  nb[n - 1] = br;
  const labels = { 1: '安打', 2: '二壘安打', 3: '三壘安打' };
  const codes = { 1: '1B', 2: '2B', 3: '3B' };
  return {
    ...common, code: codes[n], label: labels[n], hit: true, outs: 0, runs: adv.runs, bases: nb,
    batterBases: n, throwTo: Math.min(3, n + 1) === 4 ? 0 : n,
  };
}

// 四壞球保送
export function walkAdvance(bases, batter) {
  return forceAdvance(bases, batter);
}
