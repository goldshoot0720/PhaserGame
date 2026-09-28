// Acceptance tests — run headless by `npm run verify`.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { RACERS, TRACKS, KART_URLS, CAST_URLS, rollItem, standings, LAPS, MAX_SPEED, SEGMENT } from './data.js';
import { fmtTime } from './ui.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}

check('background is a hex colour', /^#[0-9a-fA-F]{3,8}$/.test(BACKGROUND));
check('boot options carry the background', GAME_OPTIONS.background === BACKGROUND);
check('boot options carry the art axis', GAME_OPTIONS.pixelArt === PIXEL_ART);
check('boot options carry the mount container', GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { background: string; pixelArt: boolean };
check('game.json agrees on background', declared.background === BACKGROUND);
check('game.json agrees on pixel art', declared.pixelArt === PIXEL_ART);

check('eight racers, each with a kart sprite and portrait', RACERS.length === 8 && RACERS.every((r) => !!KART_URLS[r.id] && !!CAST_URLS[r.id]));
check('three tracks with pieces', TRACKS.length === 3 && TRACKS.every((t) => t.pieces.length >= 8));
for (const t of TRACKS) {
  const len = t.pieces.reduce((a, p) => a + p.length, 0);
  const lapSecs = len / (MAX_SPEED * 0.9);
  check(`${t.id}: a lap takes 15–45 s at race pace (${lapSecs.toFixed(1)} s)`, lapSecs > 15 && lapSecs < 45);
  check(`${t.id}: every piece is whole segments`, t.pieces.every((p) => p.length % SEGMENT === 0));
  check(`${t.id}: hills net to ~zero so the loop closes`, Math.abs(t.pieces.reduce((a, p) => a + (p.hill ?? 0), 0)) < 1);
}
check('race is 3 laps', LAPS === 3);
// Items: the leader never gets a star when the roll is low; back markers get more stars.
const stars = (place: number): number => { let n = 0; for (let i = 0; i < 1000; i++) if (rollItem(place, 8, i / 1000) === 'star') n++; return n; };
check('back markers get more stars than the leader', stars(7) > stars(0));
check('rollItem always returns an item', [0, 0.25, 0.5, 0.9999].every((r) => !!rollItem(3, 8, r)));
// Standings.
const s = standings([{ total: 100, finishT: -1, n: 'a' }, { total: 900, finishT: -1, n: 'b' }, { total: 50, finishT: 40, n: 'c' }, { total: 60, finishT: 38, n: 'd' }]);
check('finishers rank by time, then racers by distance', s.map((x) => x.n).join('') === 'dcba');
check('time formatting', fmtTime(75.5) === '1:15.50' && fmtTime(9.25) === '0:09.25');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
