// Acceptance tests — run headless by `npm run verify`.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { Match, shotChance, meterQuality } from './rules.js';
import { isThree, hoopDist, clampToCourt, HOOP, TOP_OF_KEY, BOTTOM_Y } from './court.js';
import { BALLERS, WIN_SCORE, SHOT_CLOCK, METER_SWEET } from './data.js';

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

// ── 3x3 rules ──
{
  const m = new Match();
  m.possession = 0;
  check('inside-arc basket = 1 point, beyond = 2', Match.points(false) === 1 && Match.points(true) === 2);
  m.made(0, true);
  check('made basket scores and flips possession', m.score[0] === 2 && (m.possession as number) === 1 && !m.mustClear);
  m.gain(0);
  check('defensive rebound/steal requires clearing the ball', (m.possession as number) === 0 && m.mustClear);
  m.cleared();
  check('clearing lifts the restriction', !m.mustClear);
  m.shotClock = 0.05;
  check('shot clock violation flips possession', m.tick(0.1, true) === 'shotclock' && (m.possession as number) === 1 && m.shotClock === SHOT_CLOCK);
  check('clock does not run on a dead ball', (() => { const c = m.clock; m.tick(1, false); return m.clock === c; })());
  const w = new Match();
  w.score[0] = WIN_SCORE - 1;
  w.made(0, false);
  check('reaching 21 ends the game', w.over && w.winner() === 0);
  const t = new Match();
  t.clock = 0.01; t.tick(0.05, true);
  check('tied at the buzzer goes to sudden-death overtime', t.overtime && !t.over);
  t.made(1, false);
  check('first basket in overtime wins', t.over && t.winner() === 1);
}
// ── shooting ──
{
  check('layups are likelier than threes', shotChance(30, false, 6, 0.8, 0) > shotChance(260, true, 6, 0.8, 0));
  check('contest lowers the odds', shotChance(150, false, 7, 0.8, 1) < shotChance(150, false, 7, 0.8, 0));
  check('good timing beats bad timing', shotChance(200, false, 7, 1, 0) > shotChance(200, false, 7, 0, 0));
  check('chance stays within 3%..95%', shotChance(10, false, 10, 1, 0) <= 0.95 && shotChance(900, true, 1, 0, 1) >= 0.03);
  check('meter sweet spot is perfect', meterQuality((METER_SWEET[0] + METER_SWEET[1]) / 2, METER_SWEET) === 1);
  check('meter far off is poor', meterQuality(0.2, METER_SWEET) < 0.2);
}
// ── court ──
{
  check('under the hoop is inside the arc', !isThree(HOOP.x, HOOP.y + 20));
  check('check-ball spot is beyond the arc', isThree(TOP_OF_KEY.x, TOP_OF_KEY.y));
  check('hoop distance is 0 at the hoop', hoopDist(HOOP.x, HOOP.y) === 0);
  const p = { x: -500, y: 9999 };
  clampToCourt(p);
  check('positions clamp onto the floor', p.y === BOTTOM_Y && p.x > 0);
  check('eight ballers with ratings 1..10', BALLERS.length === 8 && BALLERS.every((b) => [b.shoot, b.three, b.speed, b.defense, b.jump].every((v) => v >= 1 && v <= 10)));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
