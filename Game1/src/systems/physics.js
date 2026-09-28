// 投球軌跡、擊球接觸與擊球飛行模擬（純邏輯）
import { PITCH_TYPES } from './data.js';

export const ZONE = { halfW: 0.2159, bottom: 0.5, top: 1.1, ballR: 0.037 };
export const RELEASE = { x: -0.45, y: 1.85, z: 17.2 };

// 隨機工具
export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 建立一顆投球
 * @param pitcher 投手資料 (含 pitch)
 * @param type 球種名稱
 * @param aimX, aimY 目標位置 (公尺，本壘板平面)
 * @param fatigue 0(滿體力)~1(耗盡)
 */
export function makePitch(pitcher, type, aimX, aimY, fatigue = 0) {
  const def = PITCH_TYPES[type];
  const level = type === '直球' ? 0 : (pitcher.pitch.pitches[type] || 1);
  const control = pitcher.pitch.control;
  const sigma = (0.02 + (100 - control) * 0.0022) * (1 + fatigue * 0.9);
  const tx = aimX + gauss() * sigma;
  const ty = aimY + gauss() * sigma;
  const velo = pitcher.pitch.velo * def.speed * (1 - fatigue * 0.06) + gauss() * 1.2;
  const kmh = Math.round(velo);
  const mps = velo / 3.6;
  const duration = (RELEASE.z / mps) * 1.55 * 1000; // 遊戲時間 (ms)
  const mag = type === '直球' ? 0.05 : 0.04 + level * 0.035;
  const brk = { x: def.dx * mag, y: type === '直球' ? 0.04 : def.dy * mag };
  return {
    type, kmh, duration, level,
    target: { x: tx, y: ty },
    aim: { x: aimX, y: aimY },
    brk, curve: def.curve,
    color: def.color,
  };
}

// t: 0~1 投球進度 → 3D 位置
export function pitchPos(p, t) {
  const bx = p.target.x - p.brk.x;
  const by = p.target.y - p.brk.y;
  const s = Math.pow(t, p.curve);
  return {
    x: lerp(RELEASE.x, bx, t) + p.brk.x * s,
    y: lerp(RELEASE.y, by, t) + p.brk.y * s + 0.18 * 4 * t * (1 - t),
    z: lerp(RELEASE.z, 0, t),
  };
}

export function isStrike(x, y) {
  const r = ZONE.ballR;
  return Math.abs(x) <= ZONE.halfW + r && y >= ZONE.bottom - r && y <= ZONE.top + r;
}

/**
 * 由接觸參數計算擊球初速 / 仰角 / 方向
 * ex, ey: 球相對於游標中心的偏移 (以游標半徑正規化, ey 正 = 球在游標下方)
 * timingN: -1(太早) ~ 1(太晚)
 */
export function battedBall(batter, ex, ey, timingN, opts = {}) {
  if (opts.bunt) {
    return {
      ev: 7 + Math.random() * 6, launch: -12 + Math.random() * 16,
      spray: clamp(gauss() * 18 + ex * 10, -44, 44), foul: Math.random() < 0.18, bunt: true, quality: 0.2,
    };
  }
  const d = Math.min(1.2, Math.hypot(ex, ey));
  const quality = clamp(1 - 0.55 * Math.pow(d, 1.3) - 0.45 * Math.pow(Math.abs(timingN), 1.4), 0, 1);
  const pow = clamp((batter.power - 10) / 85, 0, 1);
  let ev = (28 + pow * 21) * (0.42 + 0.58 * quality) + gauss() * 1.5; // m/s
  let launch = 13 - ey * 36 + (batter.traj - 2) * 4.5 + gauss() * 5;
  if (quality > 0.8) launch = lerp(launch, 24 + (batter.traj - 2) * 3, 0.35);
  const spray = timingN * 40 + ex * 9 + gauss() * 7;
  let foul = Math.abs(spray) > 45;
  if (quality < 0.1) foul = true;
  if (launch > 70) foul = Math.random() < 0.6 || foul;
  ev = Math.max(8, ev);
  return { ev, launch: clamp(launch, -35, 80), spray, foul, quality };
}

// 外野全壘打牆距離 (公尺)，angle: 度，0 = 中外野
export function fenceDist(angle) {
  const a = Math.min(45, Math.abs(angle)) / 45;
  return 98 + 24 * Math.pow(1 - a, 1.2) + 4 * Math.sin(a * Math.PI);
}
export const FENCE_H = 3.4;

/**
 * 模擬擊球飛行（含空氣阻力、彈跳、滾動、撞牆）
 * 回傳 samples: [{t, d, h}] 以 0.02s 取樣；d 為水平距離（沿方向）
 */
export function simulateFlight(bb) {
  const k = 0.0036; // 空氣阻力係數
  const g = 9.8;
  const dt = 0.02;
  const th = (bb.launch * Math.PI) / 180;
  let vh = bb.ev * Math.cos(th);
  let vy = bb.ev * Math.sin(th);
  let d = 0, h = 1.0, t = 0;
  const samples = [{ t, d, h }];
  const fence = fenceDist(bb.spray);
  let landed = null; // 第一次落地
  let homeRun = false;
  let hitWall = false;
  let bounces = 0;
  let rolling = false;
  while (t < 12) {
    if (!rolling) {
      const v = Math.hypot(vh, vy);
      vh += -k * v * vh * dt;
      vy += (-g - k * v * vy) * dt;
      d += vh * dt;
      h += vy * dt;
      if (h <= 0) {
        h = 0;
        if (!landed) landed = { t, d };
        bounces++;
        vy = -vy * 0.38;
        vh *= 0.72;
        if (vy < 1.2 || bounces > 4) rolling = true;
      }
    } else {
      vh = Math.max(0, vh - 5.5 * dt);
      d += vh * dt;
    }
    // 牆
    if (d >= fence) {
      if (!landed && h > FENCE_H) { homeRun = true; }
      if (!homeRun) {
        d = fence - 0.5;
        vh = -Math.abs(vh) * 0.25;
        hitWall = true;
      }
    }
    t += dt;
    samples.push({ t, d, h });
    if (homeRun && d > fence + 15) break;
    if (rolling && Math.abs(vh) < 0.3) break;
  }
  return { samples, landed, homeRun, hitWall, fence };
}
