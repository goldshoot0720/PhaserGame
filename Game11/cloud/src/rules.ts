// Pilots, shot types, enemies and stage timelines — pure data + functions (verify.ts imports this; no engine imports).
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/fvhg1h7jEMG/';
export const ART = {
  logo: A + 'art/2026-2027/logo-6958b9b65e.png',
  jet: A + 'art/ships-a/ships-a-1-7a31cc0661.png',
  drone: A + 'art/ships-a/ships-a-2-4d109e960d.png',
  fighter: A + 'art/ships-b/ships-b-1-e64a532bd0.png', // two stacked copies → split into 2 frames
  bomber: A + 'art/ships-b/ships-b-2-693cb07dd7.png', // two stacked copies → split into 2 frames
  boss1: A + 'art/boss-a/boss-a-1-df867533cc.png',
  boss2: A + 'art/boss-b/boss-b-1-1bc499cad0.png',
  ocean: A + 'art/ocean/bg-d168e07788.png',
  space: A + 'art/space/bg-7545bc6a6d.png',
  music: A + 'music/a-fast-vertical-arcade-shoot-em-up-like-1b2b750a6c4e.mp3',
};

export const PF_W = 540;
export const PF_H = 720;
export const SPEED = 330;
export const FOCUS_SPEED = 165;
export const HITBOX = 4;
export const FIRE_RATE = 0.09;
export const MISSILE_RATE = 0.5;
export const MAX_POWER = 4;
export const START_LIVES = 3;
export const START_BOMBS = 3;
export const MAX_BOMBS = 6;
export const INVULN = 3;
export const BOMB_TIME = 2.5;
export const BOMB_DMG = 40;
export const EXTENDS = [60000, 180000];
export const COLLECT_LINE = 190;

export type ShotType = 'spread' | 'laser' | 'homing' | 'vulcan' | 'options' | 'orbit' | 'flame' | 'backfire';
export interface Pilot { id: string; name: string; title: string; color: string; shot: ShotType; shotName: string; desc: string; }
export const PILOTS: Pilot[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', color: '#4f8dff', shot: 'spread', shotName: '泡泡散射', desc: '廣角扇形彈幕，清雜兵最強' },
  { id: 'penguin', name: '小冰', title: '企鵝少女', color: '#9adfff', shot: 'laser', shotName: '冰晶雷射', desc: '貫穿敵機的直線雷射' },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', color: '#d8b98a', shot: 'homing', shotName: '追蹤飛彈', desc: '主砲＋自動追蹤飛彈' },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', color: '#b0b0b0', shot: 'vulcan', shotName: '重火力機槍', desc: '集中前方的高傷害機槍' },
  { id: 'calico', name: '小花', title: '夾克三花貓', color: '#f0a24a', shot: 'options', shotName: '貓爪僚機', desc: '兩架僚機從側面支援' },
  { id: 'whitecat', name: '書白', title: '圖書館貓', color: '#f4efe6', shot: 'orbit', shotName: '書頁結界', desc: '環繞書頁會擋下子彈' },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', color: '#e8413c', shot: 'flame', shotName: '火焰噴射', desc: '近距離超高傷害火焰' },
  { id: 'sailor', name: '澪', title: '水手服少女', color: '#7fb3e6', shot: 'backfire', shotName: '前後夾擊', desc: '前方多向＋後方射擊' },
];

export type BulletKind = 'shot' | 'laser' | 'missile' | 'flame' | 'bubble';
export interface ShotSpec { dx: number; dy: number; ang: number; speed: number; dmg: number; r: number; pierce: boolean; homing: boolean; life: number; kind: BulletKind; color: string; }
const S = (dx: number, ang: number, o: Partial<ShotSpec> = {}): ShotSpec => ({ dx, dy: -20, ang, speed: 820, dmg: 1, r: 5, pierce: false, homing: false, life: 1.2, kind: 'shot', color: '#fff27a', ...o });

/** The main volley a pilot fires every FIRE_RATE seconds at power level 1..4 (angles in degrees, 0 = straight up). */
export function volley(type: ShotType, level: number): ShotSpec[] {
  const L = Math.max(1, Math.min(MAX_POWER, level));
  const out: ShotSpec[] = [];
  switch (type) {
    case 'spread': {
      const n = 2 * L + 1, span = 10 + 8 * L;
      for (let i = 0; i < n; i++) out.push(S(0, -span / 2 + (span * i) / (n - 1), { speed: 640, dmg: 0.75, r: 6, kind: 'bubble', color: '#7fd8ff' }));
      break;
    }
    case 'laser':
      for (let i = 0; i < L; i++) out.push(S((i - (L - 1) / 2) * 11, 0, { speed: 1150, dmg: 1.6, r: 5, pierce: true, kind: 'laser', color: '#cff6ff' }));
      break;
    case 'homing': out.push(S(-8, 0), S(8, 0)); if (L >= 2) out.push(S(0, 0)); if (L >= 3) out.push(S(-18, -4), S(18, 4)); break;
    case 'vulcan':
      for (let i = 0; i < L + 2; i++) out.push(S((i - (L + 1) / 2) * 7, (i - (L + 1) / 2) * 0.8, { speed: 960, dmg: 0.9, color: '#ffe066' }));
      break;
    case 'options':
      out.push(S(-7, 0), S(7, 0));
      if (L >= 3) out.push(S(0, 0));
      for (const side of [-1, 1]) {
        out.push(S(side * 42, side * 4, { dy: 6, dmg: 0.8, color: '#ffb347' }));
        if (L >= 2) out.push(S(side * 42, side * 14, { dy: 6, dmg: 0.8, color: '#ffb347' }));
        if (L >= 4) out.push(S(side * 42, -side * 2, { dy: 6, dmg: 0.8, color: '#ffb347' }));
      }
      break;
    case 'orbit': for (let i = 0; i <= L; i++) out.push(S((i - L / 2) * 9, 0, { dmg: 1.1, color: '#f2e2b6' })); break;
    case 'flame': {
      const n = 4 + 2 * L, span = 22 + 6 * L;
      for (let i = 0; i < n; i++) out.push(S(0, -span / 2 + (span * i) / (n - 1), { speed: 540, dmg: 0.6, r: 9, life: 0.36, kind: 'flame', color: '#ff7a3a' }));
      break;
    }
    case 'backfire': {
      const fwd = L >= 3 ? [-16, -8, 0, 8, 16] : L >= 2 ? [-10, 0, 10] : [0];
      for (const a of fwd) out.push(S(0, a, { color: '#c8f0ff' }));
      out.push(S(0, 180, { dy: 20, dmg: 0.9, color: '#c8f0ff' }));
      if (L >= 4) out.push(S(0, 165, { dy: 20, dmg: 0.9, color: '#c8f0ff' }), S(0, 195, { dy: 20, dmg: 0.9, color: '#c8f0ff' }));
      break;
    }
  }
  return out;
}
/** Homing missiles (glasses only), every MISSILE_RATE seconds. */
export function missiles(type: ShotType, level: number): ShotSpec[] {
  if (type !== 'homing') return [];
  return Array.from({ length: level }, (_, i) => S((i % 2 ? 1 : -1) * (14 + i * 6), (i % 2 ? 1 : -1) * 30, { speed: 460, dmg: 2.2, r: 6, homing: true, life: 2.2, kind: 'missile', color: '#ff9a5a' }));
}
/** Whitecat's orbiting pages: count by level. */
export function orbiters(type: ShotType, level: number): number { return type === 'orbit' ? level + 1 : 0; }
/** Rough damage per second of a pilot's main gun at a level (for balance tests). */
export function dps(type: ShotType, level: number): number {
  const v = volley(type, level).reduce((s, b) => s + b.dmg, 0) / FIRE_RATE;
  return v + missiles(type, level).reduce((s, b) => s + b.dmg, 0) / MISSILE_RATE;
}

export type EnemyKind = 'drone' | 'fighter' | 'bomber' | 'midboss' | 'boss1' | 'boss2';
export const ENEMY: Record<EnemyKind, { hp: number; r: number; score: number; size: number }> = {
  drone: { hp: 3, r: 18, score: 100, size: 46 },
  fighter: { hp: 10, r: 22, score: 300, size: 64 },
  bomber: { hp: 70, r: 44, score: 2500, size: 130 },
  midboss: { hp: 420, r: 62, score: 12000, size: 190 },
  boss1: { hp: 1500, r: 88, score: 50000, size: 330 },
  boss2: { hp: 1900, r: 100, score: 80000, size: 300 },
};
export type Path = 'down' | 'sine' | 'swoopL' | 'swoopR' | 'hover' | 'sideL' | 'sideR';
export interface Wave { t: number; kind: EnemyKind; path: Path; x: number; count: number; gap: number; }

/** Position of a path-following enemy `age` seconds after spawning at column x0 (0..1 of the field). */
export function pathPos(path: Path, x0: number, age: number, idx: number): { x: number; y: number } {
  const X = x0 * PF_W;
  switch (path) {
    case 'down': return { x: X + Math.sin(age * 2 + idx) * 12, y: -40 + age * 150 };
    case 'sine': return { x: X + Math.sin(age * 2.2) * 110, y: -40 + age * 130 };
    case 'swoopL': return { x: X + age * 150, y: -40 + 270 * age - 62 * age * age };
    case 'swoopR': return { x: X - age * 150, y: -40 + 270 * age - 62 * age * age };
    case 'hover': { const y = age < 1.4 ? -40 + age * 150 : age < 5 ? 170 + Math.sin(age * 2) * 8 : 170 + (age - 5) * 220; return { x: X + Math.sin(age) * 30, y }; }
    case 'sideL': return { x: -40 + age * 190, y: 80 + x0 * 200 + age * 35 };
    case 'sideR': return { x: PF_W + 40 - age * 190, y: 80 + x0 * 200 + age * 35 };
  }
}

export interface StageInfo { year: string; name: string; bg: 'ocean' | 'space'; bulletSpeed: number; fireMul: number; boss: EnemyKind; }
export const STAGES: StageInfo[] = [
  { year: '2026', name: '蒼藍海洋航線', bg: 'ocean', bulletSpeed: 1, fireMul: 1, boss: 'boss1' },
  { year: '2027', name: '銀河星雲決戰', bg: 'space', bulletSpeed: 1.18, fireMul: 1.25, boss: 'boss2' },
];
export const MIDBOSS_T = 38;
export const BOSS_T = 80;

/** Deterministic wave schedule for a stage (0 or 1). */
export function stageWaves(stage: number): Wave[] {
  const seq: [EnemyKind, Path, number, number, number][] = [
    ['drone', 'sine', 0.3, 5, 0.32], ['drone', 'sine', 0.7, 5, 0.32], ['fighter', 'swoopL', 0.12, 4, 0.38], ['fighter', 'swoopR', 0.88, 4, 0.38],
    ['drone', 'sideL', 0.2, 6, 0.28], ['fighter', 'hover', 0.3, 1, 0], ['fighter', 'hover', 0.7, 1, 0], ['bomber', 'down', 0.5, 1, 0],
    ['drone', 'sideR', 0.4, 6, 0.28], ['drone', 'down', 0.2, 4, 0.3], ['drone', 'down', 0.8, 4, 0.3], ['fighter', 'swoopL', 0.2, 5, 0.3],
  ];
  const step = stage === 0 ? 2.8 : 2.2;
  const out: Wave[] = [];
  let i = stage * 3;
  for (let t = 2; t < MIDBOSS_T - 3; t += step) { const s = seq[i++ % seq.length]; out.push({ t, kind: s[0], path: s[1], x: s[2], count: s[3], gap: s[4] }); }
  out.push({ t: MIDBOSS_T, kind: 'midboss', path: 'hover', x: 0.5, count: 1, gap: 0 });
  for (let t = MIDBOSS_T + 14; t < BOSS_T - 4; t += step) { const s = seq[i++ % seq.length]; out.push({ t, kind: s[0], path: s[1], x: s[2], count: s[3], gap: s[4] }); }
  if (stage === 1) out.push({ t: 60, kind: 'bomber', path: 'down', x: 0.25, count: 1, gap: 0 }, { t: 60, kind: 'bomber', path: 'down', x: 0.75, count: 1, gap: 0 });
  out.push({ t: BOSS_T, kind: STAGES[stage].boss, path: 'hover', x: 0.5, count: 1, gap: 0 });
  return out.sort((a, b) => a.t - b.t);
}

/** Evenly spaced ring of `n` angles (radians) starting at `start`. */
export function ring(n: number, start = 0): number[] { return Array.from({ length: n }, (_, i) => start + (i * Math.PI * 2) / n); }
/** Fan of `n` angles centred on `mid` spanning `span` radians. */
export function fan(n: number, mid: number, span: number): number[] { return n === 1 ? [mid] : Array.from({ length: n }, (_, i) => mid - span / 2 + (span * i) / (n - 1)); }
export function aimAt(fx: number, fy: number, tx: number, ty: number): number { return Math.atan2(ty - fy, tx - fx); }
export function hit(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean { const dx = ax - bx, dy = ay - by, r = ar + br; return dx * dx + dy * dy < r * r; }
/** Boss phase from remaining HP fraction: 0 (>66%), 1 (33–66%), 2 (<33%). */
export function bossPhase(hp: number, max: number): number { const f = hp / max; return f > 0.66 ? 0 : f > 0.33 ? 1 : 2; }
/** Lives earned by passing extend thresholds between two scores. */
export function extendsBetween(before: number, after: number): number { return EXTENDS.filter((e) => before < e && after >= e).length; }
