// Acceptance tests for the arena rules.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { FIGHTERS, CRATES, SPAWNS, PICKUP_SPOTS, ARENA_W, ARENA_H, RADIUS, circleBox, blocked, ranking, CAST_URLS } from './data.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}
check('boot options', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('game.json agrees', declared.background === BACKGROUND && declared.pixelArt === PIXEL_ART && declared.worldHeight === GAME_OPTIONS.worldHeight);

check('eight fighters, each with sprite and a distinct weapon', FIGHTERS.length === 8 && FIGHTERS.every((f) => !!CAST_URLS[f.id]) && new Set(FIGHTERS.map((f) => f.weapon.kind)).size === 8);
check('every weapon has sane numbers', FIGHTERS.every((f) => f.weapon.dmg > 0 && f.weapon.rate > 0.05 && f.weapon.range > 200 && f.weapon.speed > 100));
const inCrate = (x: number, y: number, r: number): boolean => CRATES.some((c) => circleBox(x, y, r, c) !== null);
check('spawns are inside the arena and clear of crates', SPAWNS.every(([x, y]) => x > RADIUS && y > RADIUS && x < ARENA_W - RADIUS && y < ARENA_H - RADIUS && !inCrate(x, y, RADIUS)));
check('pickups are clear of crates', PICKUP_SPOTS.every((p) => !inCrate(p.x, p.y, 20)));
check('enough spawns for 8 players', SPAWNS.length >= 8);
const push = circleBox(600, 350, 22, [560, 360, 96, 96]);
check('circle touching a crate is pushed out upward', !!push && push.y < 0);
check('circle far away is not pushed', circleBox(100, 100, 22, [560, 360, 96, 96]) === null);
check('line of sight is blocked by a crate', blocked(500, 408, 820, 408) && !blocked(100, 100, 300, 100));
const r = ranking([{ kills: 3, deaths: 5, n: 'a' }, { kills: 5, deaths: 9, n: 'b' }, { kills: 3, deaths: 1, n: 'c' }]);
check('ranking: kills desc, then fewer deaths', r.map((x) => x.n).join('') === 'bca');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
