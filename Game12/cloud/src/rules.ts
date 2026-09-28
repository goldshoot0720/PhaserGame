// Grid, balloons, water blasts, danger map, path-finding and bot brain — pure (verify.ts imports this; no engine imports).
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/eVdsiqEdzeb/';
export const ART = {
  logo: A + 'art/art/logo-de1f353228.png',
  crate: A + 'art/blocks/blocks-1-27befd285e.png',
  house: A + 'art/blocks/blocks-2-b3210269d6.png',
  balloon: A + 'art/balloon/balloon-1-3f5ec788ee.png',
  potion: A + 'art/balloon/balloon-2-b33e868d85.png',
  skate: A + 'art/items/items-1-781408f372.png',
  needle: A + 'art/items/items-2-344feed931.png',
  music: A + 'music/a-cute-crazy-arcade-bomberman-style-wate-9052a8d97f45.mp3',
};

export interface Hero { id: string; name: string; title: string; color: string; balloons: number; range: number; speed: number; }
/** Each hero starts with slightly different stats (total budget is equal). */
export const HEROES: Hero[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', color: '#4f8dff', balloons: 1, range: 2, speed: 1 },
  { id: 'penguin', name: '小冰', title: '企鵝少女', color: '#9adfff', balloons: 2, range: 1, speed: 1 },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', color: '#d8b98a', balloons: 1, range: 1, speed: 2 },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', color: '#b0b0b0', balloons: 2, range: 1, speed: 1 },
  { id: 'calico', name: '小花', title: '夾克三花貓', color: '#f0a24a', balloons: 1, range: 1, speed: 2 },
  { id: 'whitecat', name: '書白', title: '圖書館貓', color: '#f4efe6', balloons: 1, range: 2, speed: 1 },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', color: '#e8413c', balloons: 2, range: 1, speed: 1 },
  { id: 'sailor', name: '澪', title: '水手服少女', color: '#7fb3e6', balloons: 1, range: 2, speed: 1 },
];
export const PLAYER_COLORS = ['#39c6ff', '#ff6fa8', '#7ee05a', '#ffc83a'];

export const COLS = 15;
export const ROWS = 13;
export const EMPTY = 0, SOLID = 1, BOX = 2;
export type Cell = 0 | 1 | 2;
export const FUSE = 2.6;
export const WATER_TIME = 0.55;
export const TRAP_TIME = 3.5;
export const BASE_SPEED = 3.0;
export const SPEED_STEP = 0.45;
export const MAX_SPEED_LV = 8;
export const MAX_BALLOONS = 8;
export const MAX_RANGE = 8;
export const ROUND_TIME = 150;
export const WINS_NEEDED = 2;
export const SPAWNS: [number, number][] = [[0, 0], [COLS - 1, ROWS - 1], [COLS - 1, 0], [0, ROWS - 1]];

export type ItemKind = 'balloon' | 'potion' | 'skate' | 'needle' | 'ultra';
export const ITEM_NAMES: Record<ItemKind, string> = { balloon: '水球 +1', potion: '水柱 +1', skate: '速度 +1', needle: '救命針', ultra: '水柱最大' };
/** Item table for a broken box: roll in [0,1). */
export function dropFor(roll: number): ItemKind | null {
  if (roll < 0.14) return 'balloon';
  if (roll < 0.28) return 'potion';
  if (roll < 0.39) return 'skate';
  if (roll < 0.44) return 'needle';
  if (roll < 0.47) return 'ultra';
  return null;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

export const key = (c: number, r: number): number => r * COLS + c;
export function inBounds(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }

/** Pillars on odd/odd cells, random boxes elsewhere, spawn corners kept clear. */
export function makeGrid(seed: number, density = 0.72): Cell[][] {
  const r = rng(seed);
  const g: Cell[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < COLS; x++) {
      if (x % 2 === 1 && y % 2 === 1) { row.push(SOLID); continue; }
      const nearSpawn = SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2);
      row.push(!nearSpawn && r() < density ? BOX : EMPTY);
    }
    g.push(row);
  }
  return g;
}

export interface BalloonLike { c: number; r: number; t: number; range: number; }
export function balloonAt(bs: BalloonLike[], c: number, r: number): number { return bs.findIndex((b) => b.c === c && b.r === r); }
export function passable(g: Cell[][], bs: BalloonLike[], c: number, r: number): boolean {
  return inBounds(c, r) && g[r][c] === EMPTY && balloonAt(bs, c, r) < 0;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Water from one balloon: centre + 4 arms. Arms stop at pillars, soak (and stop at) the first box, and stop on another balloon (which chains). */
export function blast(g: Cell[][], bs: BalloonLike[], b: { c: number; r: number; range: number }): { tiles: [number, number][]; boxes: [number, number][]; chained: number[] } {
  const tiles: [number, number][] = [[b.c, b.r]], boxes: [number, number][] = [], chained: number[] = [];
  for (const [dx, dy] of DIRS) {
    for (let k = 1; k <= b.range; k++) {
      const c = b.c + dx * k, r = b.r + dy * k;
      if (!inBounds(c, r) || g[r][c] === SOLID) break;
      tiles.push([c, r]);
      if (g[r][c] === BOX) { boxes.push([c, r]); break; }
      const j = balloonAt(bs, c, r);
      if (j >= 0) { chained.push(j); break; }
    }
  }
  return { tiles, boxes, chained };
}

/** Explode balloon i and everything it chains into. Returns the balloon indices and the union of wet tiles/boxes. */
export function chain(g: Cell[][], bs: BalloonLike[], i: number): { balloons: number[]; tiles: [number, number][]; boxes: [number, number][] } {
  const done = new Set<number>([i]), queue = [i], tiles = new Map<number, [number, number]>(), boxes = new Map<number, [number, number]>();
  while (queue.length) {
    const b = queue.shift()!;
    const res = blast(g, bs, bs[b]);
    for (const t of res.tiles) tiles.set(key(t[0], t[1]), t);
    for (const t of res.boxes) boxes.set(key(t[0], t[1]), t);
    for (const j of res.chained) if (!done.has(j)) { done.add(j); queue.push(j); }
  }
  return { balloons: [...done], tiles: [...tiles.values()], boxes: [...boxes.values()] };
}

/** Seconds until each cell gets wet (Infinity = safe). Chain reactions shorten fuses; `wet` cells are 0. */
export function dangerMap(g: Cell[][], bs: BalloonLike[], wet: Iterable<number> = []): number[] {
  const te = bs.map((b) => b.t);
  for (let pass = 0; pass < bs.length; pass++) {
    let changed = false;
    bs.forEach((b, i) => { for (const j of blast(g, bs, b).chained) if (te[i] < te[j]) { te[j] = te[i]; changed = true; } });
    if (!changed) break;
  }
  const d = new Array<number>(COLS * ROWS).fill(Infinity);
  bs.forEach((b, i) => { for (const [c, r] of blast(g, bs, b).tiles) d[key(c, r)] = Math.min(d[key(c, r)], te[i]); });
  for (const k of wet) d[k] = 0;
  return d;
}

/** Breadth-first path (list of cells after `from`) to the nearest cell matching `goal`; `ok(cell, steps)` filters walkable cells. */
export function bfs(g: Cell[][], bs: BalloonLike[], from: [number, number], goal: (c: number, r: number) => boolean, ok: (c: number, r: number, steps: number) => boolean = () => true, maxSteps = 60): [number, number][] | null {
  const prev = new Map<number, number>(), start = key(from[0], from[1]);
  prev.set(start, -1);
  let frontier = [from];
  if (goal(from[0], from[1])) return [];
  for (let steps = 1; steps <= maxSteps && frontier.length; steps++) {
    const next: [number, number][] = [];
    for (const [c, r] of frontier) for (const [dx, dy] of DIRS) {
      const nc = c + dx, nr = r + dy, k = key(nc, nr);
      if (prev.has(k) || !passable(g, bs, nc, nr) || !ok(nc, nr, steps)) continue;
      prev.set(k, key(c, r));
      if (goal(nc, nr)) {
        const path: [number, number][] = [];
        for (let p = k; p !== start; p = prev.get(p)!) path.unshift([p % COLS, Math.floor(p / COLS)]);
        return path;
      }
      next.push([nc, nr]);
    }
    frontier = next;
  }
  return null;
}

// ── Bot brain ──
export interface BotView {
  grid: Cell[][]; balloons: BalloonLike[]; wet: number[]; items: { c: number; r: number }[];
  me: { c: number; r: number; left: number; range: number; speed: number };
  foes: { c: number; r: number; trapped: boolean }[];
}
export type BotAction = { kind: 'move'; path: [number, number][] } | { kind: 'bomb'; path: [number, number][] } | { kind: 'idle' };

/** Is it safe to stand on (c,r) after `steps` moves at `speed` tiles/s given danger `d`? */
function safeAt(d: number[], c: number, r: number, steps: number, speed: number): boolean {
  const arrive = steps / speed, t = d[key(c, r)];
  return t === Infinity || arrive > t + WATER_TIME + 0.15 || arrive < t - 0.45;
}

export function botDecide(v: BotView, roll = 0.5): BotAction {
  const { grid: g, balloons: bs, me } = v;
  const from: [number, number] = [me.c, me.r];
  const d = dangerMap(g, bs, v.wet);
  const walk = (c: number, r: number, s: number): boolean => safeAt(d, c, r, s, me.speed);
  // 1) Get out of the splash zone.
  if (d[key(me.c, me.r)] !== Infinity) {
    const p = bfs(g, bs, from, (c, r) => d[key(c, r)] === Infinity, walk, 12);
    return p ? { kind: 'move', path: p } : { kind: 'idle' };
  }
  const safeGoal = (dd: number[]) => (c: number, r: number) => dd[key(c, r)] === Infinity;
  // 2) Pop a trapped rival.
  const trapped = v.foes.filter((f) => f.trapped);
  if (trapped.length) {
    const p = bfs(g, bs, from, (c, r) => trapped.some((f) => f.c === c && f.r === r), (c, r, s) => walk(c, r, s) && d[key(c, r)] === Infinity, 14);
    if (p) return { kind: 'move', path: p };
  }
  // 3) Drop a balloon if it would soak a box or a rival AND there is an escape.
  if (me.left > 0) {
    const hypo = [...bs, { c: me.c, r: me.r, t: FUSE, range: me.range }];
    const res = blast(g, bs, { c: me.c, r: me.r, range: me.range });
    const hitsFoe = v.foes.some((f) => !f.trapped && res.tiles.some(([c, r]) => c === f.c && r === f.r));
    const worth = hitsFoe || res.boxes.length > 0;
    if (worth && (hitsFoe || roll < 0.85)) {
      const d2 = dangerMap(g, hypo, v.wet);
      const esc = bfs(g, hypo, from, safeGoal(d2), (c, r, s) => safeAt(d2, c, r, s, me.speed) && s / me.speed < FUSE - 0.5, 10);
      if (esc && esc.length) return { kind: 'bomb', path: esc };
    }
  }
  const safeWalk = (c: number, r: number, s: number): boolean => walk(c, r, s) && d[key(c, r)] === Infinity;
  // 4) Grab a nearby item.
  const item = bfs(g, bs, from, (c, r) => v.items.some((it) => it.c === c && it.r === r), safeWalk, 9);
  if (item) return { kind: 'move', path: item };
  // 5) Walk next to a box, or toward the nearest rival.
  const nextToBox = (c: number, r: number): boolean => DIRS.some(([dx, dy]) => inBounds(c + dx, r + dy) && g[r + dy][c + dx] === BOX);
  const target = roll < 0.35 && v.foes.length
    ? bfs(g, bs, from, (c, r) => v.foes.some((f) => Math.abs(f.c - c) + Math.abs(f.r - r) <= 1), safeWalk, 40)
    : bfs(g, bs, from, nextToBox, safeWalk, 40) ?? bfs(g, bs, from, (c, r) => v.foes.some((f) => Math.abs(f.c - c) + Math.abs(f.r - r) <= 2), safeWalk, 40);
  if (target && target.length) return { kind: 'move', path: target.slice(0, 6) };
  return { kind: 'idle' };
}

export function speedOf(level: number): number { return BASE_SPEED + Math.min(MAX_SPEED_LV, level) * SPEED_STEP; }

/** Match winner: first to WINS_NEEDED; after 3 rounds a sole leader wins; still tied after 5 → -1 (draw); otherwise null (keep playing). */
export function matchWinner(wins: number[], roundsPlayed: number): number | null {
  const w = wins.findIndex((n) => n >= WINS_NEEDED);
  if (w >= 0) return w;
  if (roundsPlayed < 3) return null;
  const best = Math.max(...wins);
  const top = wins.map((n, i) => (n === best ? i : -1)).filter((i) => i >= 0);
  if (top.length === 1 && best > 0) return top[0];
  return roundsPlayed >= 5 ? -1 : null;
}
