// Fighters, weapons, arena and tuning — pure data (verify.ts imports it).
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/S7sNJTEcx8r/';
export const ART = {
  crate: A + 'art/props/props-1-2b72158865.png',
  bush: A + 'art/props/props-2-f0e24674ec.png',
  heart: A + 'art/pickups/pickups-1-df1aff3af8.png',
  bolt: A + 'art/pickups/pickups-2-9fbf98cce7.png',
  music: A + 'music/a-cute-but-frantic-top-down-arena-shoote-599878187c3e.mp3',
  floor: '', logo: '',
};

export type Kind = 'bubble' | 'smg' | 'sniper' | 'shotgun' | 'boomerang' | 'book' | 'fire3' | 'grenade';
export interface Weapon { name: string; kind: Kind; dmg: number; rate: number; speed: number; range: number; r: number; spread: number; pellets: number; color: string; pref: number; }
export interface Fighter { id: string; name: string; title: string; color: string; weapon: Weapon; }

export const FIGHTERS: Fighter[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', color: '#4f8dff', weapon: { name: '泡泡大砲', kind: 'bubble', dmg: 22, rate: 0.42, speed: 380, range: 620, r: 14, spread: 0.04, pellets: 1, color: '#7fd8ff', pref: 330 } },
  { id: 'penguin', name: '小冰', title: '企鵝少女', color: '#9adfff', weapon: { name: '冰晶衝鋒槍', kind: 'smg', dmg: 7, rate: 0.085, speed: 820, range: 560, r: 5, spread: 0.12, pellets: 1, color: '#dff7ff', pref: 260 } },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', color: '#d8b98a', weapon: { name: '光學狙擊槍', kind: 'sniper', dmg: 48, rate: 1.05, speed: 1700, range: 1100, r: 5, spread: 0.01, pellets: 1, color: '#ffe27a', pref: 560 } },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', color: '#b0b0b0', weapon: { name: '街頭散彈', kind: 'shotgun', dmg: 9, rate: 0.75, speed: 760, range: 380, r: 5, spread: 0.32, pellets: 6, color: '#ffffff', pref: 170 } },
  { id: 'calico', name: '小花', title: '夾克三花貓', color: '#f0a24a', weapon: { name: '貓爪迴力鏢', kind: 'boomerang', dmg: 20, rate: 0.55, speed: 640, range: 440, r: 12, spread: 0, pellets: 1, color: '#ffb347', pref: 240 } },
  { id: 'whitecat', name: '書白', title: '圖書館貓', color: '#f4efe6', weapon: { name: '魔法書頁', kind: 'book', dmg: 13, rate: 0.22, speed: 620, range: 640, r: 8, spread: 0.05, pellets: 1, color: '#f2e2b6', pref: 340 } },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', color: '#e8413c', weapon: { name: '火焰三連', kind: 'fire3', dmg: 11, rate: 0.42, speed: 600, range: 480, r: 8, spread: 0.22, pellets: 3, color: '#ff7a3a', pref: 250 } },
  { id: 'sailor', name: '澪', title: '水手服少女', color: '#7fb3e6', weapon: { name: '旋風手雷', kind: 'grenade', dmg: 38, rate: 1.0, speed: 520, range: 520, r: 10, spread: 0, pellets: 1, color: '#c8f0ff', pref: 330 } },
];

// ── ARENA ──
export const ARENA_W = 2400, ARENA_H = 1600;
/** Crates (solid) as [x, y, w, h]. */
export const CRATES: [number, number, number, number][] = [
  [560, 360, 96, 96], [656, 360, 96, 96], [1152, 700, 96, 96], [1152, 796, 96, 96], [1740, 360, 96, 96], [1740, 456, 96, 96],
  [400, 1080, 96, 96], [496, 1080, 96, 96], [1850, 1100, 96, 96], [1946, 1100, 96, 96], [960, 300, 96, 96], [1350, 1250, 96, 96],
  [800, 760, 96, 96], [1500, 760, 96, 96], [1152, 180, 96, 96], [1152, 1320, 96, 96],
];
export const BUSHES: [number, number][] = [[300, 300], [2100, 300], [300, 1300], [2100, 1300], [1200, 520], [1200, 1080], [760, 1300], [1640, 300]];
export const SPAWNS: [number, number][] = [[200, 200], [2200, 200], [200, 1400], [2200, 1400], [1200, 120], [1200, 1480], [120, 800], [2280, 800], [700, 800], [1700, 800]];
export const PICKUP_SPOTS: { x: number; y: number; kind: 'heart' | 'bolt' }[] = [
  { x: 1200, y: 640, kind: 'bolt' }, { x: 1200, y: 960, kind: 'heart' }, { x: 420, y: 800, kind: 'heart' }, { x: 1980, y: 800, kind: 'heart' }, { x: 900, y: 1200, kind: 'bolt' }, { x: 1500, y: 400, kind: 'bolt' },
];

export const MAX_HP = 100;
export const SPEED = 260;
export const RADIUS = 22;
export const DASH_SPEED = 820, DASH_TIME = 0.16, DASH_CD = 1.8;
export const RESPAWN = 3;
export const SHIELD = 2;
export const KILL_TARGET = 10;
export const MATCH_TIME = 180;
export const PICKUP_RESPAWN = 12;
export const POWER_TIME = 8;

/** Circle vs axis-aligned box: returns the push-out vector or null. */
export function circleBox(cx: number, cy: number, r: number, b: [number, number, number, number]): { x: number; y: number } | null {
  const nx = Math.max(b[0], Math.min(cx, b[0] + b[2])), ny = Math.max(b[1], Math.min(cy, b[1] + b[3]));
  const dx = cx - nx, dy = cy - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 === 0) { // centre inside: push out along the shallowest axis
    const l = cx - b[0], rr = b[0] + b[2] - cx, t = cy - b[1], bb = b[1] + b[3] - cy;
    const m = Math.min(l, rr, t, bb);
    return m === l ? { x: -(l + r), y: 0 } : m === rr ? { x: rr + r, y: 0 } : m === t ? { x: 0, y: -(t + r) } : { x: 0, y: bb + r };
  }
  const d = Math.sqrt(d2);
  return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
}

/** Does the segment a→b cross any crate? (line of sight) */
export function blocked(ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 24);
  for (let i = 1; i < steps; i++) {
    const x = ax + ((bx - ax) * i) / steps, y = ay + ((by - ay) * i) / steps;
    for (const c of CRATES) if (x > c[0] && x < c[0] + c[2] && y > c[1] && y < c[1] + c[3]) return true;
  }
  return false;
}

/** Scoreboard order: kills desc, then deaths asc. */
export function ranking<T extends { kills: number; deaths: number }>(ps: T[]): T[] {
  return [...ps].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}
