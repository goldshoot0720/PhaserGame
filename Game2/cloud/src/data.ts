// Characters, art URLs and tuning — pure data (verify.ts imports it).
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

export const ART = {
  court: 'https://gameblocks.nyc3.digitaloceanspaces.com/qShMT5e7fmJ/art/court/bg-0929a696cc.png',
  logo: 'https://gameblocks.nyc3.digitaloceanspaces.com/qShMT5e7fmJ/art/moe-street-3x3/logo-1cf24ca37a.png',
  music: 'https://gameblocks.nyc3.digitaloceanspaces.com/qShMT5e7fmJ/music/a-cute-street-basketball-3-on-3-game-at-ccae05215c3e.mp3',
};

export interface Baller {
  id: string;
  name: string;
  title: string;
  /** 1-10 ratings */
  shoot: number;
  three: number;
  speed: number;
  defense: number;
  jump: number;
  color: string;
}

export const BALLERS: Baller[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', shoot: 7, three: 6, speed: 6, defense: 6, jump: 6, color: '#4f8dff' },
  { id: 'penguin', name: '小冰', title: '企鵝少女', shoot: 6, three: 5, speed: 9, defense: 7, jump: 5, color: '#9adfff' },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', shoot: 8, three: 9, speed: 5, defense: 5, jump: 4, color: '#d8b98a' },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', shoot: 7, three: 5, speed: 7, defense: 7, jump: 9, color: '#b0b0b0' },
  { id: 'calico', name: '小花', title: '夾克三花貓', shoot: 6, three: 6, speed: 8, defense: 8, jump: 7, color: '#f0a24a' },
  { id: 'whitecat', name: '書白', title: '圖書館貓', shoot: 7, three: 8, speed: 6, defense: 6, jump: 5, color: '#f4efe6' },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', shoot: 8, three: 7, speed: 8, defense: 5, jump: 6, color: '#e8413c' },
  { id: 'sailor', name: '澪', title: '水手服少女', shoot: 6, three: 7, speed: 7, defense: 8, jump: 6, color: '#7fb3e6' },
];

export function baller(id: string): Baller {
  return BALLERS.find((b) => b.id === id) ?? BALLERS[0];
}

// ── TUNING (3x3 rules) ──
export const WIN_SCORE = 21;          // first to 21 wins (official 3x3)
export const GAME_TIME = 240;         // seconds on the game clock (4:00 arcade length)
export const SHOT_CLOCK = 12;         // 3x3 shot clock
export const RUN_SPEED = 190;         // floor px/s at speed 5
export const DEPTH_FACTOR = 0.62;     // vertical (depth) movement is slower
export const PASS_SPEED = 620;        // floor px/s
export const STEAL_RANGE = 34;
export const BLOCK_RANGE = 44;
export const METER_TIME = 0.9;        // seconds for the shot meter to fill
export const METER_SWEET = [0.78, 0.92] as const;
