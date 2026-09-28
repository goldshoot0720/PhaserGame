// Acceptance tests for the grid, blasts, danger and bots.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import {
  HEROES, CAST_URLS, COLS, ROWS, EMPTY, SOLID, BOX, SPAWNS, FUSE, makeGrid, passable, blast, chain, dangerMap, bfs, botDecide, dropFor, key, speedOf, matchWinner, type Cell,
} from './rules.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); } else { fail++; console.error('  FAIL  ', name); }
}
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('boot options agree with game.json', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER && declared.background === BACKGROUND && declared.worldHeight === GAME_OPTIONS.worldHeight);
check('eight heroes with art and equal stat budgets', HEROES.length === 8 && HEROES.every((h) => !!CAST_URLS[h.id] && h.balloons + h.range + h.speed === 4));

const g = makeGrid(42);
check('15×13 grid with pillars on odd/odd cells', g.length === ROWS && g[0].length === COLS && g[1][1] === SOLID && g[3][5] === SOLID && g[0][1] !== SOLID);
check('spawn corners and their neighbours are clear', SPAWNS.every(([c, r]) => g[r][c] === EMPTY) && g[0][1] === EMPTY && g[1][0] === EMPTY && g[ROWS - 1][COLS - 2] === EMPTY);
check('plenty of breakable boxes', g.flat().filter((x) => x === BOX).length > 60);
check('same seed → same map', JSON.stringify(makeGrid(42)) === JSON.stringify(g));

const open: Cell[][] = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (c % 2 === 1 && r % 2 === 1 ? SOLID : EMPTY) as Cell));
const b1 = blast(open, [], { c: 2, r: 2, range: 2 });
check('blast: cross of 1 + 4×range on an open row', b1.tiles.length === 9 && b1.tiles.some(([c, r]) => c === 4 && r === 2) && b1.tiles.some(([c, r]) => c === 2 && r === 0));
const b2 = blast(open, [], { c: 1, r: 2, range: 3 });
check('blast is stopped by pillars', !b2.tiles.some(([c, r]) => c === 1 && r === 1) && !b2.tiles.some(([c, r]) => c === 1 && r === 3));
const withBox = open.map((row) => [...row]); withBox[2][4] = BOX; withBox[2][5] = BOX;
const b3 = blast(withBox, [], { c: 2, r: 2, range: 5 });
check('blast soaks only the first box in a line', b3.boxes.length === 1 && b3.boxes[0][0] === 4 && !b3.tiles.some(([c]) => c === 5));
const bs = [{ c: 2, r: 2, t: 1, range: 3 }, { c: 4, r: 2, t: 9, range: 2 }, { c: 4, r: 4, t: 9, range: 1 }];
const ch = chain(open, bs, 0);
check('chain reaction: a blast sets off balloons it reaches', ch.balloons.length === 3 && ch.tiles.some(([c, r]) => c === 5 && r === 4));
const dm = dangerMap(open, bs);
check('danger map: chained balloons inherit the short fuse; far cells safe', dm[key(4, 5)] === 1 && dm[key(10, 10)] === Infinity);
check('balloons block walking', !passable(open, bs, 4, 2) && passable(open, bs, 3, 2));
const path = bfs(open, [], [0, 0], (c, r) => c === 4 && r === 0);
check('BFS finds the straight route', !!path && path.length === 4);

// Bots.
const v = (me: { c: number; r: number }, balloons = [] as typeof bs, grid = open, items: { c: number; r: number }[] = []) => ({ grid, balloons, wet: [], items, me: { ...me, left: 1, range: 2, speed: 4 }, foes: [{ c: 14, r: 12, trapped: false }] });
const flee = botDecide(v({ c: 2, r: 2 }, [{ c: 2, r: 2, t: FUSE, range: 2 }]));
check('bot standing in a blast zone runs to a safe cell', flee.kind === 'move' && flee.path.length > 0 && dangerMap(open, [{ c: 2, r: 2, t: FUSE, range: 2 }])[key(...flee.path[flee.path.length - 1])] === Infinity);
const boxy = open.map((row) => [...row]); boxy[0][2] = BOX;
const bomb = botDecide(v({ c: 1, r: 0 }, [], boxy), 0.1);
check('bot drops a balloon next to a box and plans an escape', bomb.kind === 'bomb' && bomb.path.length > 0);
const trapBox = open.map((row) => [...row]); trapBox[0][1] = BOX; trapBox[1][0] = BOX;
const noSuicide = botDecide({ ...v({ c: 0, r: 0 }, [], trapBox), me: { c: 0, r: 0, left: 1, range: 1, speed: 4 } }, 0.1);
check('bot never bombs itself into a dead end', noSuicide.kind !== 'bomb');
const grab = botDecide(v({ c: 0, r: 0 }, [], open, [{ c: 3, r: 0 }]), 0.9);
check('bot walks to a nearby item', grab.kind === 'move' && grab.path[grab.path.length - 1][0] === 3);
check('bot goes to pop a trapped rival', (() => { const a = botDecide({ ...v({ c: 0, r: 0 }), foes: [{ c: 4, r: 0, trapped: true }] }); return a.kind === 'move' && a.path[a.path.length - 1][0] === 4; })());

check('item table: common upgrades, rare ultra, some empties', dropFor(0.05) === 'balloon' && dropFor(0.2) === 'potion' && dropFor(0.3) === 'skate' && dropFor(0.45) === 'ultra' && dropFor(0.9) === null);
check('speed grows with skates', speedOf(3) > speedOf(0));
check('match: first to 2 wins, tie-break rounds, draw after 5', matchWinner([2, 0, 0, 0], 2) === 0 && matchWinner([1, 1, 0, 0], 2) === null && matchWinner([1, 1, 1, 0], 3) === null && matchWinner([1, 1, 1, 1], 5) === -1);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
