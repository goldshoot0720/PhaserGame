// Acceptance tests — run headless by `npm run verify` (type-check + this file).
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { GameState } from './rules.js';
import { TEAMS, PLAYERS, PITCH_TYPES, INNINGS } from './data.js';
import { resolveSwing, cpuBat, makePitch, pitchPos, inZone } from './sim.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}

check('background is a hex colour', /^#[0-9a-fA-F]{3,8}$/.test(BACKGROUND));
check('boot options carry the background', GAME_OPTIONS.background === BACKGROUND);
check('boot options carry the art axis', GAME_OPTIONS.pixelArt === PIXEL_ART);
check('boot options carry the mount container', GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('game.json agrees on background', declared.background === BACKGROUND);
check('game.json agrees on pixel art', declared.pixelArt === PIXEL_ART);
check('game.json world height matches any override', GAME_OPTIONS.worldHeight === undefined || GAME_OPTIONS.worldHeight === declared.worldHeight);

// ── rules ──
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
{
  const g = GameState.forUser('whale');
  check('user team bats last (home)', g.home.id === 'whale' && g.top && g.battingTeam.id === 'cat');
  g.apply('strike'); g.apply('foul'); g.apply('foul');
  check('foul with two strikes keeps the count', g.strikes === 2);
  g.apply('strike');
  check('three strikes is an out and a new batter', g.outs === 1 && g.strikes === 0 && g.order.away === 1);
  for (let i = 0; i < 4; i++) g.apply('ball');
  check('four balls is a walk to first', g.bases[0] && !g.bases[1] && g.balls === 0);
  g.apply('homerun');
  check('two-run homer scores 2 and clears bases', g.runs.away === 2 && !g.bases.some(Boolean));
  g.apply('double');
  check('double puts runner on second', g.bases[1] && !g.bases[0]);
  g.apply('single');
  check('single advances runner one base', g.bases[0] && g.bases[2] && !g.bases[1]);
  g.apply('flyout');
  check('sac fly scores from third', g.runs.away === 3 && g.outs === 2);
  g.apply('groundout');
  check('third out flips to bottom half', !g.top && g.outs === 0 && g.battingTeam.id === 'whale');
  check('line score tracks the top of the 1st', g.line.away[0] === 3);
}
{
  const g = GameState.forUser('cat');
  // Bases loaded walk forces a run.
  for (let b = 0; b < 3; b++) for (let i = 0; i < 4; i++) g.apply('ball');
  for (let i = 0; i < 4; i++) g.apply('ball');
  check('bases-loaded walk forces in a run', g.runs.away === 1 && g.bases.every(Boolean));
}
{
  // Play a whole game of outs: it must end after the last inning.
  const g = GameState.forUser('whale');
  let guard = 0;
  while (!g.over && guard++ < 500) g.apply('groundout');
  check('a scoreless game goes to extras and ends', g.over && g.inning === INNINGS + 3);
  const h = GameState.forUser('whale');
  while (!h.over && guard++ < 1000) { if (!h.top && h.inning === INNINGS) h.apply('homerun'); else h.apply('groundout'); }
  check('walk-off homer ends the game with home winning', h.over && h.winner() === 'home' && h.inning === INNINGS);
}
// ── sim ──
{
  const b = PLAYERS.tshirt;
  check('sweet-spot perfect timing on a slugger is a homer', resolveSwing(b, 0, 0, seq([0.5])) === 'homerun');
  check('swing far off the ball whiffs', resolveSwing(b, 0, 2, seq([0.5])) === 'strike');
  check('very late swing whiffs', resolveSwing(b, 0.2, 0, seq([0.5])) === 'strike');
  const p = makePitch(PLAYERS.whale, '指叉', 0, 0, seq([0.5]));
  const end = pitchPos(p, 1);
  check('pitch ends where it was aimed (no error at rng 0.5)', Math.abs(end.x) < 1e-9 && Math.abs(end.y) < 1e-9);
  const start = pitchPos(p, 0);
  check('splitter starts high and drops', start.y < end.y - 0.5);
  check('pitch flight time is sensible', p.time > 0.4 && p.time < 1.2);
  check('far-outside pitch is a ball when taken', cpuBat(PLAYERS.glasses, makePitch(PLAYERS.whale, '直球', 3, 3, seq([0.5])), seq([0.99])) === 'ball');
  check('zone test', inZone(0.9, -0.9) && !inZone(1.2, 0));
  check('every team has 4 players & a pitcher with pitches', Object.values(TEAMS).every((t) => t.lineup.length === 4 && PLAYERS[t.pitcher].pitches.every((n) => !!PITCH_TYPES[n])));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
