// Cast, weapons, terrain and ballistics — pure data + functions (verify.ts imports this; no engine imports).
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/bCmTFAj6tW4/';
export const ART = {
  logo: A + 'art/art/logo-ebf05ec450.png',
  hull: A + 'art/props/props-1-4f8540f7f8.png',
  barrel: A + 'art/props/props-2-1c4d00a666.png',
  music: A + 'music/a-cute-turn-based-artillery-tank-battle-c9875f9633bc.mp3',
};

export type ShotKind = 'normal' | 'cluster' | 'laser' | 'digger' | 'teleport' | 'freeze' | 'heal' | 'wave';
export interface Weapon { id: string; name: string; kind: ShotKind; dmg: number; radius: number; count: number; spread: number; uses: number; color: string; desc: string; }
export const BASE_WEAPONS: Weapon[] = [
  { id: 'std', name: '標準彈', kind: 'normal', dmg: 28, radius: 52, count: 1, spread: 0, uses: -1, color: '#ffd84a', desc: '無限使用' },
  { id: 'tri', name: '三連彈', kind: 'normal', dmg: 16, radius: 38, count: 3, spread: 0.07, uses: 2, color: '#7fe0ff', desc: '三顆散射' },
  { id: 'heavy', name: '重砲', kind: 'normal', dmg: 46, radius: 84, count: 1, spread: 0, uses: 1, color: '#ff7a5a', desc: '大爆炸' },
];
export interface Hero { id: string; name: string; title: string; color: string; special: Weapon; }
const sp = (id: string, name: string, kind: ShotKind, dmg: number, radius: number, color: string, desc: string, count = 1, spread = 0): Weapon => ({ id, name, kind, dmg, radius, count, spread, uses: 1, color, desc });
export const HEROES: Hero[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', color: '#4f8dff', special: sp('wave', '巨浪彈', 'wave', 30, 96, '#6fd0ff', '大範圍並把坦克沖開') },
  { id: 'penguin', name: '小冰', title: '企鵝少女', color: '#9adfff', special: sp('freeze', '冰封彈', 'freeze', 22, 64, '#cff6ff', '被打中會凍結一回合') },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', color: '#d8b98a', special: sp('laser', '光學雷射', 'laser', 42, 40, '#ff5ad0', '直線飛行、不受風影響') },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', color: '#b0b0b0', special: sp('spread', '街頭散彈', 'normal', 14, 36, '#ffffff', '五顆扇形散射', 5, 0.11) },
  { id: 'calico', name: '小花', title: '夾克三花貓', color: '#f0a24a', special: sp('drill', '貓爪鑽地彈', 'digger', 34, 56, '#ffb347', '鑽入地面挖出深坑') },
  { id: 'whitecat', name: '書白', title: '圖書館貓', color: '#f4efe6', special: sp('heal', '治癒之書', 'heal', 40, 0, '#8dff9a', '立刻回復 40 HP') },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', color: '#e8413c', special: sp('cluster', '火焰集束彈', 'cluster', 17, 40, '#ff6a3a', '最高點分裂成五顆') },
  { id: 'sailor', name: '澪', title: '水手服少女', color: '#7fb3e6', special: sp('tele', '傳送彈', 'teleport', 15, 32, '#c9a0ff', '把自己傳送到落點') },
];
export const TANK_COLORS = ['#39c6ff', '#ff6fa8', '#7ee05a', '#ffc83a'];

// ── Tuning ──
export const FIELD_W = 2400;
export const FIELD_H = 720;
export const WATER_Y = 690;
export const GRAVITY = 520;
export const SPEED_PER_POWER = 9.2;
export const WIND_ACC = 9;
export const MAX_WIND = 10;
export const MAX_HP = 100;
export const FUEL = 120;
export const DRIVE_SPEED = 70;
export const MAX_CLIMB = 3.2;
export const TURN_TIME = 25;
export const TANK_R = 24;
export const LASER_SPEED = 1500;
export const FALL_SAFE = 50;
export const CRATE_CHANCE = 0.45;
export const AMMO_SHARE = 0.55;
/** Max stock per weapon slot (standard is unlimited). */
export const AMMO_CAPS = [-1, 4, 3, 2];
/** Every N of your own turns you get a free shell of that slot. */
export const AUTO_SUPPLY: [slot: number, every: number][] = [[1, 3], [2, 5]];

/** Add ammo to slots (capped); returns the slots that actually went up. */
export function resupply(uses: number[], slots: number[]): number[] {
  const got: number[] = [];
  for (const s of slots) if (uses[s] >= 0 && uses[s] < AMMO_CAPS[s]) { uses[s]++; got.push(s); }
  return got;
}
/** Slots auto-refilled at the start of a tank's `n`-th own turn. */
export function autoSupplySlots(n: number): number[] { return AUTO_SUPPLY.filter(([, every]) => n > 0 && n % every === 0).map(([s]) => s); }

export type MapId = 'grass' | 'snow' | 'desert';
export const MAPS: Record<MapId, { name: string; top: string; dirt: string; deep: string; sky: [string, string] }> = {
  grass: { name: '草原戰場', top: '#7ed957', dirt: '#b07a4a', deep: '#8a5a34', sky: ['#7fd3ff', '#dff4ff'] },
  snow: { name: '雪山戰場', top: '#ffffff', dirt: '#9fb8d8', deep: '#7390b8', sky: ['#a9c8ff', '#f0f6ff'] },
  desert: { name: '沙漠戰場', top: '#ffe08a', dirt: '#e0a95a', deep: '#bf8440', sky: ['#ffb27a', '#fff0c8'] },
};

/** Small deterministic RNG so maps are reproducible in tests. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/** Heightmap: terrain[x] = the surface y at column x (bigger = lower). */
export function makeTerrain(seed: number): number[] {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ a: (60 - i * 10) * (0.5 + r()), f: (0.8 + i * 1.7 + r()) / FIELD_W * Math.PI * 2, p: r() * 6.28 }));
  const t: number[] = [];
  for (let x = 0; x <= FIELD_W; x++) {
    let y = 470;
    for (const w of waves) y += w.a * Math.sin(x * w.f + w.p);
    // Two valleys dip toward the water for drama.
    y += 120 * Math.exp(-(((x - FIELD_W * 0.35) / 90) ** 2)) + 110 * Math.exp(-(((x - FIELD_W * 0.7) / 80) ** 2));
    t.push(Math.max(260, Math.min(WATER_Y + 20, Math.round(y))));
  }
  return t;
}
export function surface(t: number[], x: number): number { return t[Math.max(0, Math.min(FIELD_W, Math.round(x)))]; }

/** Blast a round crater centred at (cx, cy). depth>1 digs deeper (drill). */
export function carve(t: number[], cx: number, cy: number, r: number, depth = 1): void {
  for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(FIELD_W, Math.ceil(cx + r)); x++) {
    const dy = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) * depth;
    const bottom = cy + dy;
    if (t[x] < bottom) t[x] = Math.min(FIELD_H + 10, Math.round(bottom));
  }
}

/** Spawn columns spread across the field on dry land. */
export function spawnXs(t: number[], n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    let x = Math.round(FIELD_W * (0.1 + (0.8 * i) / Math.max(1, n - 1)));
    for (let k = 0; k < 200 && surface(t, x) > WATER_Y - 40; k++) x += (k % 2 ? 1 : -1) * k * 4;
    xs.push(Math.max(40, Math.min(FIELD_W - 40, x)));
  }
  return xs;
}

export function launchVelocity(facing: number, elev: number, power: number, kind: ShotKind = 'normal'): { vx: number; vy: number } {
  const s = kind === 'laser' ? LASER_SPEED : power * SPEED_PER_POWER, a = (elev * Math.PI) / 180;
  return { vx: facing * Math.cos(a) * s, vy: -Math.sin(a) * s };
}

export interface Body { x: number; y: number; alive: boolean; }
export interface Impact { x: number; y: number; hit: number; steps: number; }
/** Integrate one shell until it hits the ground, a tank (index in `hit`), or leaves the field. */
export function simulate(t: number[], x: number, y: number, vx: number, vy: number, wind: number, tanks: Body[], shooter: number, laser = false, dt = 1 / 120): Impact {
  for (let i = 0; i < 2400; i++) {
    if (!laser) { vx += wind * WIND_ACC * dt; vy += GRAVITY * dt; }
    x += vx * dt; y += vy * dt;
    if (x < -60 || x > FIELD_W + 60 || y > FIELD_H + 40) return { x, y, hit: -2, steps: i };
    if (x >= 0 && x <= FIELD_W && y >= surface(t, x)) return { x, y, hit: -1, steps: i };
    for (let k = 0; k < tanks.length; k++) {
      const b = tanks[k];
      if (!b.alive || (k === shooter && i < 40)) continue;
      if (Math.hypot(x - b.x, y - (b.y - 18)) < TANK_R) return { x, y, hit: k, steps: i };
    }
  }
  return { x, y, hit: -2, steps: 2400 };
}

/** Blast damage for a tank at (bx, by) — full at the centre, 40% at the rim, 0 outside. */
export function blastDamage(w: { dmg: number; radius: number }, ex: number, ey: number, bx: number, by: number, direct: boolean): number {
  if (direct) return Math.round(w.dmg * 1.2);
  const d = Math.hypot(ex - bx, ey - (by - 18));
  if (d >= w.radius + TANK_R * 0.5) return 0;
  return Math.max(3, Math.round(w.dmg * (1 - Math.min(1, d / (w.radius + TANK_R * 0.5)) * 0.6)));
}

export function fallDamage(drop: number): number { return drop <= FALL_SAFE ? 0 : Math.round((drop - FALL_SAFE) / 4); }

/** Can a tank drive from x to nx without climbing a wall? */
export function canDrive(t: number[], x: number, nx: number): boolean {
  return surface(t, x) - surface(t, nx) <= MAX_CLIMB && nx > 20 && nx < FIELD_W - 20;
}

export interface AiShot { elev: number; power: number; facing: number; miss: number; }
/** Search elevation × power for the shell that lands nearest the target (wind included). */
export function aiAim(t: number[], tanks: Body[], me: number, target: number, wind: number, radius: number, laser = false): AiShot {
  const m = tanks[me], tg = tanks[target];
  const facing = tg.x >= m.x ? 1 : -1;
  let best: AiShot = { elev: 45, power: 60, facing, miss: Infinity };
  const powers = laser ? [100] : Array.from({ length: 30 }, (_, i) => 25 + i * 2.6);
  for (let elev = laser ? 0 : 12; elev <= 84; elev += laser ? 1 : 3) {
    for (const power of powers) {
      const v = launchVelocity(facing, elev, power, laser ? 'laser' : 'normal');
      const mx = m.x + facing * 16, my = m.y - 40;
      const imp = simulate(t, mx, my, v.vx, v.vy, wind, tanks, me, laser, 1 / 60);
      let miss = imp.hit === target ? 0 : Math.hypot(imp.x - tg.x, imp.y - (tg.y - 18));
      if (imp.hit === -2) miss += 800;
      if (Math.hypot(imp.x - m.x, imp.y - m.y) < radius + 30) miss += 1000; // never shell yourself
      if (miss < best.miss) best = { elev, power, facing, miss };
    }
  }
  return best;
}

/** Final standings: survivors first (by HP), then the most recently eliminated. */
export function standings<T extends { alive: boolean; hp: number; diedAt: number }>(ps: T[]): T[] {
  return [...ps].sort((a, b) => Number(b.alive) - Number(a.alive) || (a.alive ? b.hp - a.hp : b.diedAt - a.diedAt));
}
