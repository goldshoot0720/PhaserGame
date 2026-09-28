// Players, teams and pitch types — pure data, no engine imports (verify.ts loads it).
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
  stadium: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/stadium2/bg-32fdccee5f.png',
  logo: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/moe-baseball-showdown/logo-75aa9d66bf.png',
  music: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/music/a-cute-anime-baseball-game-in-a-sunny-st-f43430009283.mp3',
};

/** Background image anchors (in the 1024×614 stadium image). */
export const BG_W = 1024;
export const BG_H = 614;
export const BG_PLATE = { x: 512, y: 541 };
export const BG_MOUND = { x: 512, y: 364 };

export type PitchName = '直球' | '滑球' | '曲球' | '指叉' | '伸卡' | '變速';

export interface PitchType {
  /** speed multiplier on the pitcher's velocity */
  speed: number;
  /** break at the plate, in strike-zone half-widths (x: + = to catcher's right, y: + = down) */
  dx: number;
  dy: number;
  /** how late the break happens (higher = later) */
  curve: number;
  color: string;
}

export const PITCH_TYPES: Record<PitchName, PitchType> = {
  直球: { speed: 1.0, dx: 0, dy: -0.05, curve: 2, color: '#ffffff' },
  滑球: { speed: 0.88, dx: 0.9, dy: 0.15, curve: 2.4, color: '#4fc3ff' },
  曲球: { speed: 0.78, dx: 0.55, dy: 0.8, curve: 1.8, color: '#7dff6a' },
  指叉: { speed: 0.86, dx: 0, dy: 0.95, curve: 3.2, color: '#ff6ad5' },
  伸卡: { speed: 0.92, dx: -0.75, dy: 0.45, curve: 2.4, color: '#ffb13d' },
  變速: { speed: 0.78, dx: -0.15, dy: 0.45, curve: 2, color: '#d6a4ff' },
};

export interface Player {
  id: string;
  name: string;
  title: string;
  /** batting: contact 1-100, power 1-100, speed 1-100 */
  meet: number;
  power: number;
  speed: number;
  /** pitching: velocity km/h, control 1-100 */
  velo: number;
  control: number;
  pitches: PitchName[];
}

export const PLAYERS: Record<string, Player> = {
  whale: { id: 'whale', name: '汐音', title: '鯨魚女僕', meet: 58, power: 50, speed: 55, velo: 146, control: 74, pitches: ['直球', '滑球', '指叉', '伸卡'] },
  penguin: { id: 'penguin', name: '小冰', title: '企鵝少女', meet: 78, power: 35, speed: 88, velo: 128, control: 60, pitches: ['直球', '曲球', '變速'] },
  glasses: { id: 'glasses', name: '光哉', title: '眼鏡學長', meet: 85, power: 55, speed: 50, velo: 132, control: 82, pitches: ['直球', '曲球', '伸卡'] },
  tshirt: { id: 'tshirt', name: '阿翔', title: 'T恤少年', meet: 62, power: 88, speed: 60, velo: 140, control: 55, pitches: ['直球', '滑球'] },
  calico: { id: 'calico', name: '小花', title: '夾克三花貓', meet: 70, power: 72, speed: 70, velo: 138, control: 66, pitches: ['直球', '滑球', '變速'] },
  whitecat: { id: 'whitecat', name: '書白', title: '圖書館貓', meet: 64, power: 45, speed: 66, velo: 150, control: 70, pitches: ['直球', '曲球', '指叉', '變速'] },
  redcat: { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', meet: 74, power: 66, speed: 78, velo: 134, control: 60, pitches: ['直球', '滑球', '曲球'] },
  sailor: { id: 'sailor', name: '澪', title: '水手服少女', meet: 80, power: 58, speed: 72, velo: 130, control: 78, pitches: ['直球', '伸卡', '變速'] },
};

export interface Team {
  id: 'whale' | 'cat';
  name: string;
  color: string;
  dark: string;
  pitcher: string;
  lineup: string[];
}

export const TEAMS: Record<'whale' | 'cat', Team> = {
  whale: { id: 'whale', name: '藍鯨隊', color: '#2a6fdb', dark: '#0d2f6e', pitcher: 'whale', lineup: ['penguin', 'glasses', 'tshirt', 'whale'] },
  cat: { id: 'cat', name: '貓咪隊', color: '#e0503a', dark: '#6e1a10', pitcher: 'whitecat', lineup: ['redcat', 'sailor', 'calico', 'whitecat'] },
};

// ── TUNING ──
export const INNINGS = 3;
export const ZONE_W = 120;           // strike zone width (world units)
export const ZONE_H = 140;           // strike zone height
export const MEET_R = 34;            // batting cursor radius (scaled by meet)
export const CURSOR_SPEED = 520;     // batting / aiming cursor speed (units/s)
export const PITCH_TIME_BASE = 0.62; // seconds for a 150 km/h pitch to reach the plate
