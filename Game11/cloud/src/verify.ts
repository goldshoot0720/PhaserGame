// Acceptance tests for shot types, waves and bullet maths.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import {
  PILOTS, CAST_URLS, MAX_POWER, PF_W, ENEMY, STAGES, MIDBOSS_T, BOSS_T, volley, missiles, orbiters, dps, pathPos, stageWaves, ring, fan, aimAt, hit, bossPhase, extendsBetween,
} from './rules.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); } else { fail++; console.error('  FAIL  ', name); }
}
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('boot options agree with game.json', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER && declared.background === BACKGROUND && declared.worldHeight === GAME_OPTIONS.worldHeight);
check('eight pilots with art and eight distinct shot types', PILOTS.length === 8 && PILOTS.every((p) => !!CAST_URLS[p.id]) && new Set(PILOTS.map((p) => p.shot)).size === 8);
check('every shot type gets stronger with power', PILOTS.every((p) => { let ok = true; for (let l = 1; l < MAX_POWER; l++) ok = ok && dps(p.shot, l + 1) > dps(p.shot, l); return ok; }));
const d4 = PILOTS.map((p) => dps(p.shot, 4));
check('max-power DPS is balanced within 2× across pilots', Math.max(...d4) / Math.min(...d4) < 2);
check('power is clamped to 1..4', volley('spread', 9).length === volley('spread', 4).length && volley('spread', 0).length === volley('spread', 1).length);
check('laser pierces, flame is short-ranged, backfire shoots behind', volley('laser', 2).every((s) => s.pierce) && volley('flame', 1).every((s) => s.life < 0.5) && volley('backfire', 1).some((s) => s.ang === 180));
check('only the homing pilot fires missiles; only whitecat has pages', missiles('homing', 3).length === 3 && missiles('spread', 3).length === 0 && orbiters('orbit', 2) === 3 && orbiters('laser', 4) === 0);

for (const s of [0, 1]) {
  const w = stageWaves(s);
  const sorted = w.every((x, i) => i === 0 || w[i - 1].t <= x.t);
  check(`stage ${s + 1}: sorted waves, one midboss at ${MIDBOSS_T}s, boss last at ${BOSS_T}s`, sorted && w.filter((x) => x.kind === 'midboss').length === 1 && w[w.length - 1].kind === STAGES[s].boss && w[w.length - 1].t === BOSS_T);
  check(`stage ${s + 1}: at least 20 regular waves`, w.filter((x) => x.t < BOSS_T && x.kind !== 'midboss').length >= 20);
}
check('stage 2 is harder (faster bullets, more fire, denser waves)', STAGES[1].bulletSpeed > STAGES[0].bulletSpeed && STAGES[1].fireMul > STAGES[0].fireMul && stageWaves(1).length > stageWaves(0).length);
const p0 = pathPos('swoopL', 0.1, 0, 0), p2 = pathPos('swoopL', 0.1, 2.2, 0), p5 = pathPos('swoopL', 0.1, 5, 0);
check('swoop enters from the top, dives, then retreats upward', p0.y < 0 && p2.y > 200 && p5.y < p2.y && p5.x > p0.x);
check('side paths cross the whole field', pathPos('sideL', 0.2, 0, 0).x < 0 && pathPos('sideL', 0.2, 4, 0).x > PF_W);
check('ring spreads evenly, fan is centred', Math.abs(ring(4)[1] - Math.PI / 2) < 1e-9 && Math.abs(fan(3, 1, 0.4)[1] - 1) < 1e-9 && fan(1, 2, 1)[0] === 2);
check('aim points at the target', Math.abs(aimAt(0, 0, 0, 10) - Math.PI / 2) < 1e-9);
check('circle hit test', hit(0, 0, 4, 7, 0, 4) && !hit(0, 0, 4, 9, 0, 4));
check('boss phases by HP', bossPhase(1000, 1000) === 0 && bossPhase(500, 1000) === 1 && bossPhase(100, 1000) === 2);
check('extends at 60k and 180k', extendsBetween(59000, 61000) === 1 && extendsBetween(0, 200000) === 2 && extendsBetween(61000, 62000) === 0);
check('bosses are much tougher than grunts', ENEMY.boss2.hp > ENEMY.boss1.hp && ENEMY.boss1.hp > ENEMY.midboss.hp * 3 && ENEMY.midboss.hp > ENEMY.bomber.hp * 5);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
