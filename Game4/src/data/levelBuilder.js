// Turns a stage layout (list of chunk names) into tile data and entity spawns.
// Pure data module: no Phaser import, so it can be sanity-checked from Node.

import { CHUNKS } from './chunks.js';
import { STAGE_LAYOUTS } from './stages.js';
import { LEVEL_ROWS, TILES } from '../config.js';

const ROOM_COLS = 25;
const CORRIDOR = [
  '..........',
  '..C.......',
  '##########',
  '##########',
  '##########',
];
const ENTITY_CHARS = new Set(['W', 'F', 'T', 'M', 'N', 'V', 'C', 'h', 'a', 'P']);

function padChunk(name) {
  const rows = CHUNKS[name];
  if (!rows) throw new Error(`Unknown chunk "${name}"`);
  const width = rows[0].length;
  rows.forEach((row, i) => {
    if (row.length !== width) throw new Error(`Chunk "${name}" row ${i} has width ${row.length}, expected ${width}`);
  });
  if (rows.length > LEVEL_ROWS) throw new Error(`Chunk "${name}" is taller than ${LEVEL_ROWS} rows`);
  const blank = '.'.repeat(width);
  return [...Array(LEVEL_ROWS - rows.length).fill(blank), ...rows];
}

function bossRoomRows() {
  const rows = [];
  for (let r = 0; r < LEVEL_ROWS; r += 1) {
    if (r === 0 || r >= 11) rows.push('#'.repeat(ROOM_COLS));
    else if (r >= 8) rows.push('.'.repeat(ROOM_COLS - 1) + '#'); // door opening on the left
    else rows.push('#' + '.'.repeat(ROOM_COLS - 2) + '#');
  }
  return rows;
}

/** Glue rows of several chunks together horizontally. */
function concatChunks(chunkRows) {
  const out = Array(LEVEL_ROWS).fill('');
  for (const rows of chunkRows) {
    for (let r = 0; r < LEVEL_ROWS; r += 1) out[r] += rows[r];
  }
  return out;
}

function tileFor(rows, r, c, roomCol) {
  const ch = rows[r][c];
  const above = r > 0 ? rows[r - 1][c] : '.';
  switch (ch) {
    case '#':
      if (c >= roomCol && (c === roomCol || c === rows[r].length - 1 || r === 0)) return TILES.WALL;
      return above === '#' ? TILES.GROUND : TILES.GROUND_TOP;
    case '^':
      return TILES.SPIKE;
    case 'H':
      return above === 'H' ? TILES.LADDER : TILES.LADDER_TOP;
    case '-':
      return TILES.PLATFORM;
    default:
      return TILES.EMPTY;
  }
}

export function buildLevel(stageKey) {
  const layout = STAGE_LAYOUTS[stageKey];
  if (!layout) throw new Error(`Unknown stage "${stageKey}"`);

  const body = concatChunks([...layout.map(padChunk), padChunkRows(CORRIDOR)]);
  const roomCol = body[0].length;
  const rows = concatChunks([body, bossRoomRows()]);
  const cols = rows[0].length;

  const tiles = rows.map((row, r) => [...row].map((_, c) => tileFor(rows, r, c, roomCol)));
  const entities = [];
  let start = null;
  const checkpoints = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (!ENTITY_CHARS.has(ch)) return;
      if (ch === 'P') start = { col: c, row: r };
      else if (ch === 'C') checkpoints.push({ col: c, row: r });
      else entities.push({ type: ch, col: c, row: r });
    });
  });
  if (!start) throw new Error(`Stage "${stageKey}" has no player start`);
  checkpoints.sort((a, b) => a.col - b.col);

  return {
    key: stageKey,
    cols,
    rows: LEVEL_ROWS,
    tiles,
    entities,
    start,
    checkpoints,
    roomCol,
    roomCols: ROOM_COLS,
    doorRows: [8, 9, 10],
  };
}

function padChunkRows(rows) {
  const width = rows[0].length;
  return [...Array(LEVEL_ROWS - rows.length).fill('.'.repeat(width)), ...rows];
}
