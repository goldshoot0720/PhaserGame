// CPU AI：配球與打擊判斷
import { ZONE, gauss, clamp, isStrike } from './physics.js';
import { pitchList, PITCH_TYPES } from './data.js';

// CPU 投手選擇球種與目標位置
export function cpuChoosePitch(pitcher, balls, strikes) {
  const list = pitchList(pitcher);
  const weights = list.map((t) => (t === '直球' ? 1.6 : 0.5 + (pitcher.pitch.pitches[t] || 1) * 0.15));
  if (strikes === 2) weights.forEach((w, i) => { if (list[i] !== '直球') weights[i] = w * 1.5; });
  if (balls === 3) weights[0] *= 2.2;
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum, type = list[0];
  for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) { type = list[i]; break; } }

  // 目標：好球帶角落為主，兩好球時誘打壞球
  const inZoneP = balls === 3 ? 0.9 : strikes === 2 ? 0.45 : 0.68;
  let x, y;
  if (Math.random() < inZoneP) {
    x = (Math.random() * 2 - 1) * ZONE.halfW * 0.85;
    y = ZONE.bottom + 0.06 + Math.random() * (ZONE.top - ZONE.bottom - 0.12);
    // 偏角落
    if (Math.random() < 0.6) x = Math.sign(x || 1) * ZONE.halfW * (0.55 + Math.random() * 0.4);
  } else {
    const side = Math.random();
    if (side < 0.4) { x = (Math.random() < 0.5 ? -1 : 1) * (ZONE.halfW + 0.07 + Math.random() * 0.1); y = 0.55 + Math.random() * 0.5; }
    else { x = (Math.random() * 2 - 1) * ZONE.halfW; y = ZONE.bottom - 0.08 - Math.random() * 0.12; }
  }
  // 變化球要考慮位移，瞄準點修正一半（CPU 不是完美的）
  const def = PITCH_TYPES[type];
  if (type === '指叉' || type === '曲球') y = Math.max(y, ZONE.bottom - 0.05);
  return { type, x, y, def };
}

/**
 * CPU 打者對一顆球的反應
 * @returns { swing: bool, contact: bool, ex, ey, timingN, bunt }
 */
export function cpuBatterDecide(batter, pitch, balls, strikes, bases, outs) {
  const final = pitch.target;
  const inZone = isStrike(final.x, final.y);
  const meet = batter.meet / 100;
  const breakAmt = Math.hypot(pitch.brk.x, pitch.brk.y);
  // 短打：飛毛腿或有跑者一壘、無出局時偶爾嘗試
  const buntTry = strikes < 2 && outs < 2 && ((bases[0] && !bases[1] && batter.power < 60 && Math.random() < 0.3) ||
    (batter.speed > 88 && !bases.some(Boolean) && Math.random() < 0.06));
  if (buntTry) {
    const ok = Math.random() < 0.55 + meet * 0.3 && Math.abs(final.x) < ZONE.halfW + 0.12 && final.y > ZONE.bottom - 0.12;
    if (inZone || ok) return { swing: true, bunt: true, contact: ok, ex: gauss() * 0.4, ey: 0, timingN: 0 };
  }

  let swingP;
  if (inZone) swingP = strikes === 2 ? 0.88 : balls === 3 ? 0.55 : 0.7;
  else {
    const edge = Math.max(0, Math.abs(final.x) - ZONE.halfW, ZONE.bottom - final.y, final.y - ZONE.top);
    swingP = clamp(0.36 - edge * 1.4 - meet * 0.12 + breakAmt * 0.6 + (strikes === 2 ? 0.15 : 0), 0.03, 0.6);
    if (balls === 3) swingP *= 0.5;
  }
  if (Math.random() > swingP) return { swing: false };

  const velo = pitch.kmh;
  let pContact = 0.62 + meet * 0.3 - clamp((velo - 130) / 100, 0, 0.18) - breakAmt * 0.5;
  if (!inZone) pContact -= 0.22;
  pContact = clamp(pContact, 0.2, 0.93);
  if (Math.random() > pContact) return { swing: true, contact: false };
  const sig = 0.62 - meet * 0.3;
  let timingN = gauss() * (0.42 - meet * 0.12) + (velo > 145 ? 0.12 : 0) - (pitch.type === '變速' || pitch.type === '曲球' ? 0.15 : 0);
  return {
    swing: true, contact: true,
    ex: clamp(gauss() * sig, -1.1, 1.1),
    ey: clamp(gauss() * sig + (pitch.type === '指叉' || pitch.type === '伸卡' ? 0.25 : 0), -1.1, 1.1),
    timingN: clamp(timingN, -1, 1),
  };
}
