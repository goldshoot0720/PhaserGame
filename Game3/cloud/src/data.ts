// Racers, tracks, items and tuning — pure data (verify.ts imports it).
export const CAST_URLS: Record<string, string> = {
  whale: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-a/cast-a-1-42cf43b8cb.png',
  penguin: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-a/cast-a-2-4212161a03.png',
  glasses: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-b/cast-b-1-1ae4cc393e.png',
  tshirt: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-b/cast-b-2-fa52e60eb6.png',
  calico: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-c/cast-c-1-9a84c2e477.png',
  whitecat: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-c/cast-c-2-4f3b04f575.png',
  redcat: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-d/cast-d-1-a87eb32b86.png',
  sailor: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-d/cast-d-2-4e1a43adf1.png',
};

const K = 'https://gameblocks.nyc3.digitaloceanspaces.com/FjxcDnWNvMB/art/';
export const KART_URLS: Record<string, string> = {
  whale: K + 'karts-a/karts-a-1-71f8d49787.png',
  penguin: K + 'karts-a/karts-a-2-c683c0f4bf.png',
  glasses: K + 'karts-b/karts-b-1-0741c3b10c.png',
  tshirt: K + 'karts-b/karts-b-2-b8ec9fa0e9.png',
  calico: K + 'karts-c/karts-c-1-5c51dba11d.png',
  whitecat: K + 'karts-c/karts-c-2-89b57afb1f.png',
  redcat: K + 'karts-d/karts-d-1-ebd7ab04b7.png',
  sailor: K + 'karts-d/karts-d-2-425a510694.png',
};

export const ART = {
  logo: K + 'moe-kart-gp/logo-17df613531.png',
  palm: K + 'props/props-1-a5a677f5b0.png',
  snowman: K + 'props/props-2-b736ac6168.png',
  lamp: K + 'props/props-3-9ed05008f4.png',
  itembox: K + 'items/items-1-e40be863b1.png',
  banana: K + 'items/items-2-11eedfdb97.png',
  music: 'https://gameblocks.nyc3.digitaloceanspaces.com/FjxcDnWNvMB/music/a-cute-fast-kart-racing-game-high-energy-3e4e5fd8c31b.mp3',
};

export interface Racer { id: string; name: string; title: string; speed: number; accel: number; handling: number; color: string; }

/** Stats are multipliers around 1.0. */
export const RACERS: Racer[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', speed: 1.0, accel: 1.0, handling: 1.0, color: '#4f8dff' },
  { id: 'penguin', name: '小冰', title: '企鵝少女', speed: 0.96, accel: 1.12, handling: 1.12, color: '#9adfff' },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', speed: 1.02, accel: 0.94, handling: 1.04, color: '#d8b98a' },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', speed: 1.06, accel: 0.9, handling: 0.94, color: '#b0b0b0' },
  { id: 'calico', name: '小花', title: '夾克三花貓', speed: 1.0, accel: 1.08, handling: 0.98, color: '#f0a24a' },
  { id: 'whitecat', name: '書白', title: '圖書館貓', speed: 0.98, accel: 1.0, handling: 1.1, color: '#f4efe6' },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', speed: 1.05, accel: 1.02, handling: 0.92, color: '#e8413c' },
  { id: 'sailor', name: '澪', title: '水手服少女', speed: 1.01, accel: 0.98, handling: 1.06, color: '#7fb3e6' },
];

export interface TrackPiece { length: number; curve?: number; hill?: number; }
export interface Track {
  id: string; name: string; subtitle: string; sky: string; prop: 'palm' | 'snowman' | 'lamp';
  grip: number;       // steering grip multiplier (ice < 1)
  grass: [string, string]; road: [string, string]; rumble: [string, string]; lane: string; fog: string;
  pieces: TrackPiece[];
}

/** Tracks are authored short and stretched to race length (hills scale too). */
function stretch(ps: TrackPiece[], k = 2.2): TrackPiece[] {
  return ps.map((p) => ({ ...p, length: Math.round((p.length * k) / 200) * 200 }));
}

const S = 'https://gameblocks.nyc3.digitaloceanspaces.com/FjxcDnWNvMB/art/';
export const TRACKS: Track[] = [
  {
    id: 'ocean', name: '海洋城市', subtitle: '陽光沙灘 × 寬闊彎道', sky: S + 'sky-ocean/bg-68fc474dc9.png', prop: 'palm', grip: 1.0,
    grass: ['#f1d9a0', '#e8cb85'], road: ['#5a6474', '#525c6b'], rumble: ['#ffffff', '#e53945'], lane: '#ffffff', fog: '#bfe6ff',
    pieces: stretch([
      { length: 8000 }, { length: 9000, curve: 2.2 }, { length: 6000, hill: 1500 }, { length: 8000, curve: -3 },
      { length: 7000, hill: -1500 }, { length: 9000, curve: 2.8 }, { length: 6000 }, { length: 8000, curve: -2.2, hill: 800 },
      { length: 7000, curve: 3.4 }, { length: 7000, hill: -800 },
    ]),
  },
  {
    id: 'snow', name: '冰雪企鵝村', subtitle: '結冰路面 × 連續髮夾彎', sky: S + 'sky-snow/bg-47d2455d4e.png', prop: 'snowman', grip: 0.82,
    grass: ['#f4f8ff', '#dfe9f7'], road: ['#9fb4cf', '#93a8c3'], rumble: ['#ffffff', '#3a7bd5'], lane: '#e8f4ff', fog: '#fde6ee',
    pieces: stretch([
      { length: 7000 }, { length: 6000, curve: -3.2 }, { length: 5000, curve: 3.6 }, { length: 6000, hill: 1800 },
      { length: 7000, curve: -4 }, { length: 5000, hill: -1800 }, { length: 6000, curve: 4.2 }, { length: 5000 },
      { length: 6000, curve: -3.6, hill: 1000 }, { length: 7000, curve: 2.6, hill: -1000 }, { length: 5000 },
    ]),
  },
  {
    id: 'neon', name: '霓虹夜城', subtitle: '夜晚街道 × 大起伏', sky: S + 'sky-neon/bg-71e3fc45e5.png', prop: 'lamp', grip: 0.95,
    grass: ['#2a1f4a', '#231a40'], road: ['#3a3552', '#34304a'], rumble: ['#ff4fd8', '#39e6ff'], lane: '#ffe066', fog: '#402a6a',
    pieces: stretch([
      { length: 7000 }, { length: 6000, hill: 2400 }, { length: 7000, curve: 4.4 }, { length: 6000, hill: -2400 },
      { length: 6000, curve: -4.8 }, { length: 7000, curve: 2 , hill: 1600 }, { length: 6000, curve: 5 }, { length: 6000, hill: -1600 },
      { length: 7000, curve: -3 }, { length: 6000 },
    ]),
  },
];

export type ItemId = 'fish' | 'banana' | 'bubble' | 'star';
export const ITEMS: Record<ItemId, { name: string; color: string }> = {
  fish: { name: '衝刺魚', color: '#5cc8ff' },
  banana: { name: '香蕉皮', color: '#ffe066' },
  bubble: { name: '泡泡彈', color: '#9fe3ff' },
  star: { name: '無敵星', color: '#ffb3f0' },
};

/** Weighted item roll — racers further back get better items. place 0 = leader. */
export function rollItem(place: number, total: number, r: number): ItemId {
  const back = total > 1 ? place / (total - 1) : 0;
  const table: [ItemId, number][] = [
    ['banana', 3 - back * 2],
    ['fish', 2 + back * 1],
    ['bubble', 1.5 + back * 1.5],
    ['star', 0.2 + back * 1.8],
  ];
  const sum = table.reduce((a, [, w]) => a + w, 0);
  let x = r * sum;
  for (const [id, w] of table) { if ((x -= w) <= 0) return id; }
  return 'banana';
}

// ── TUNING ──
export const LAPS = 3;
export const MAX_SPEED = 7200;      // world units / s (≈ kart top speed)
export const ACCEL = 3000;
export const BRAKE = 7000;
export const COAST = 1400;
export const OFFROAD_MAX = 0.45;    // fraction of top speed on the verge
export const STEER = 1.9;           // half-widths / s at full speed
export const CENTRIFUGAL = 0.2;
export const BOOST_MUL = 1.35;
export const SEGMENT = 200;
export const ROAD_W = 1000;
export const KART_W = 420;          // world width of a kart
export const KMH = 0.02;            // units/s → displayed km/h

/** Race order: by laps done then distance. */
export function standings<T extends { total: number; finishT: number }>(rs: T[]): T[] {
  return [...rs].sort((a, b) => {
    if (a.finishT >= 0 && b.finishT >= 0) return a.finishT - b.finishT;
    if (a.finishT >= 0) return -1;
    if (b.finishT >= 0) return 1;
    return b.total - a.total;
  });
}
