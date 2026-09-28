// Level building blocks and the stage builder. Pure data — verify.ts checks it.
// Legend:  . empty  # solid  ^ spikes  H ladder  - jump-through platform
//          W walker  F flyer  T turret  M/N sideways platform (7/12 tiles)  V lift
//          C checkpoint  h health  a weapon energy  P player start
import { ROWS } from './data.js';

export const T_EMPTY = -1, T_GROUND = 0, T_TOP = 1, T_SPIKE = 2, T_LADDER = 3, T_LADDER_TOP = 4, T_PLATFORM = 5, T_WALL = 6;

const FLOOR = (w: number): string[] => ['#'.repeat(w), '#'.repeat(w), '#'.repeat(w)];

export const CHUNKS: Record<string, string[]> = {
  start: ['.P..........', ...FLOOR(12)],
  flat: ['......W.........', ...FLOOR(16)],
  gauntlet: ['...W.....W.....W....', ...FLOOR(20)],
  steps: ['........W.........', '......######......', '...############...', '...############...', ...FLOOR(18)],
  pit: ['......F.......', '..............', '..............', '..............', '..............', '#####...######', '#####...######', '#####...######'],
  doublePit: ['.......F..........', '..................', '..................', '..................', '..................', '####...###...#####', '####...###...#####', '####...###...#####'],
  spikePit: ['................', '......---.......', '................', '................', '###^^^^^^^^^####', '################', '################'],
  spikeRun: ['....#...#...#.......', '....#...#...#.......', '##^^#^^^#^^^#^^#####', '####################', '####################'],
  mover: ['....................', '####.M..........####', '####............####', '####............####'],
  lift: ['...........T....', '..........######', '..........######', '..........######', '..........######', '......V...######', ...FLOOR(16)],
  ladderUp: ['..........W.......', '..####H###########', '......H.....######', '......H.....######', '......H.....######', '......H.....######', '......H.....######', ...FLOOR(18)],
  turretWall: ['.........T......', '........#####...', '........#####...', ...FLOOR(16)],
  flyers: ['......F.......F.....', '....................', '....................', '..........---.......', '....................', '....---.............', '....................', ...FLOOR(20)],
  lowTunnel: ['....######........', '....######........', '....######........', '....######........', '....######........', '....######........', '....######........', '..................', ...FLOOR(18)],
  checkpoint: ['....C.....', ...FLOOR(10)],
  health: ['....h..a..', ...FLOOR(10)],
  bigMover: ['..........F.............', '........................', '........................', '........................', '###..N..............####', '###.................####', '###.................####'],
  towers: ['....F.....T.....F...', '.........###........', '.........###........', '.....#...###...#....', '.....#...###...#....', ...FLOOR(20)],
  ladderTall: ['......W.........', '...######H######', '.........H...###', '.........H...###', '..---....H...###', '.........H...###', '.........H...###', '.........H...###', '.........H...###', ...FLOOR(16)],
};

export const STAGE_LAYOUTS: Record<string, string[]> = {
  whale: ['start', 'flat', 'pit', 'mover', 'checkpoint', 'flyers', 'bigMover', 'health', 'doublePit', 'checkpoint', 'mover', 'lowTunnel', 'health'],
  penguin: ['start', 'flat', 'steps', 'spikePit', 'checkpoint', 'lowTunnel', 'gauntlet', 'health', 'pit', 'checkpoint', 'spikeRun', 'towers', 'health'],
  glasses: ['start', 'turretWall', 'flat', 'lift', 'checkpoint', 'towers', 'lowTunnel', 'health', 'turretWall', 'checkpoint', 'lift', 'spikePit', 'health'],
  tshirt: ['start', 'gauntlet', 'pit', 'mover', 'checkpoint', 'doublePit', 'turretWall', 'health', 'gauntlet', 'checkpoint', 'bigMover', 'steps', 'health'],
  calico: ['start', 'flat', 'spikeRun', 'gauntlet', 'checkpoint', 'spikePit', 'steps', 'health', 'lowTunnel', 'checkpoint', 'spikeRun', 'turretWall', 'health'],
  library: ['start', 'flyers', 'ladderUp', 'flat', 'checkpoint', 'ladderTall', 'flyers', 'health', 'steps', 'checkpoint', 'ladderUp', 'flyers', 'health'],
  redcat: ['start', 'flat', 'spikePit', 'pit', 'checkpoint', 'spikeRun', 'lift', 'health', 'mover', 'checkpoint', 'spikePit', 'towers', 'health'],
  sailor: ['start', 'flat', 'pit', 'flyers', 'checkpoint', 'doublePit', 'ladderUp', 'health', 'bigMover', 'checkpoint', 'pit', 'gauntlet', 'health'],
  final: ['start', 'gauntlet', 'spikeRun', 'lift', 'checkpoint', 'bigMover', 'ladderTall', 'health', 'towers', 'lowTunnel', 'checkpoint', 'spikePit', 'doublePit', 'mover', 'health', 'checkpoint', 'turretWall', 'health'],
  citadel: ['start', 'flat', 'spikeRun', 'checkpoint', 'turretWall', 'mover', 'health', 'checkpoint', 'health'],
};

export const ROOM_COLS = 25;
const CORRIDOR = ['..........', '..C.......', '##########', '##########', '##########'];
const ENTITY = new Set(['W', 'F', 'T', 'M', 'N', 'V', 'C', 'h', 'a', 'P']);

export interface Spawn { type: string; col: number; row: number; }
export interface Level {
  key: string; cols: number; rows: number; tiles: number[][];
  entities: Spawn[]; start: { col: number; row: number }; checkpoints: { col: number; row: number }[];
  roomCol: number; doorRows: number[];
}

function pad(rows: string[], name: string): string[] {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`chunk ${name} row ${i} width ${r.length} != ${w}`); });
  if (rows.length > ROWS) throw new Error(`chunk ${name} too tall`);
  return [...Array(ROWS - rows.length).fill('.'.repeat(w)), ...rows];
}

function bossRoom(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === 0 || r >= 11) rows.push('#'.repeat(ROOM_COLS));
    else if (r >= 8) rows.push('.'.repeat(ROOM_COLS - 1) + '#');
    else rows.push('#' + '.'.repeat(ROOM_COLS - 2) + '#');
  }
  return rows;
}

function concat(parts: string[][]): string[] {
  const out: string[] = Array(ROWS).fill('');
  for (const rows of parts) for (let r = 0; r < ROWS; r++) out[r] += rows[r];
  return out;
}

function tileFor(rows: string[], r: number, c: number, roomCol: number): number {
  const ch = rows[r][c];
  const above = r > 0 ? rows[r - 1][c] : '.';
  switch (ch) {
    case '#':
      if (c >= roomCol && (c === roomCol || c === rows[r].length - 1 || r === 0)) return T_WALL;
      return above === '#' ? T_GROUND : T_TOP;
    case '^': return T_SPIKE;
    case 'H': return above === 'H' ? T_LADDER : T_LADDER_TOP;
    case '-': return T_PLATFORM;
    default: return T_EMPTY;
  }
}

export function buildLevel(key: string): Level {
  const layout = STAGE_LAYOUTS[key];
  if (!layout) throw new Error(`unknown stage ${key}`);
  const body = concat([...layout.map((n) => { const c = CHUNKS[n]; if (!c) throw new Error(`unknown chunk ${n}`); return pad(c, n); }), pad(CORRIDOR, 'corridor')]);
  const roomCol = body[0].length;
  const rows = concat([body, bossRoom()]);
  const cols = rows[0].length;
  const tiles = rows.map((row, r) => [...row].map((_, c) => tileFor(rows, r, c, roomCol)));
  const entities: Spawn[] = [];
  const checkpoints: { col: number; row: number }[] = [];
  let start: { col: number; row: number } | null = null;
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (!ENTITY.has(ch)) return;
    if (ch === 'P') start = { col: c, row: r };
    else if (ch === 'C') checkpoints.push({ col: c, row: r });
    else entities.push({ type: ch, col: c, row: r });
  }));
  if (!start) throw new Error(`stage ${key} has no start`);
  checkpoints.sort((a, b) => a.col - b.col);
  return { key, cols, rows: ROWS, tiles, entities, start, checkpoints, roomCol, doorRows: [8, 9, 10] };
}

export function isSolid(t: number): boolean { return t === T_GROUND || t === T_TOP || t === T_WALL; }
export function isOneWay(t: number): boolean { return t === T_PLATFORM || t === T_LADDER_TOP; }
export function isLadder(t: number): boolean { return t === T_LADDER || t === T_LADDER_TOP; }
