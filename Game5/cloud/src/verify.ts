// Acceptance tests — headless fights driven through the pure simulation.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { ROSTER, GROUND_Y, METER_MAX } from './roster.js';
import { Fight, NO_INPUT, type Input } from './sim.js';
import { matchMotion, MOTIONS } from './moves.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}
check('background is a hex colour', /^#[0-9a-fA-F]{3,8}$/.test(BACKGROUND));
check('boot options carry the background', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('game.json agrees', declared.background === BACKGROUND && declared.pixelArt === PIXEL_ART && declared.worldHeight === GAME_OPTIONS.worldHeight);

const I = (o: Partial<Input>): Input => ({ ...NO_INPUT, ...o });
function run(f: Fight, frames: number, a: (n: number) => Input, b: (n: number) => Input = () => NO_INPUT): void {
  for (let n = 0; n < frames; n++) f.step([a(n), b(n)]);
}
check('eight fighters with a special and a super', ROSTER.length === 8 && ROSTER.every((r) => !!r.special && !!r.super));

// Walking and facing.
{
  const f = new Fight(ROSTER[0], ROSTER[1]);
  const x0 = f.p[0].x;
  run(f, 30, () => I({ right: true }));
  check('walking forward moves the fighter', f.p[0].x > x0 + 40);
  check('fighters face each other', f.p[0].facing === 1 && f.p[1].facing === -1);
}
// A jab at close range connects.
{
  const f = new Fight(ROSTER[0], ROSTER[1]);
  f.p[0].x = 600; f.p[1].x = 700;
  run(f, 2, () => NO_INPUT);
  const hp = f.p[1].hp;
  run(f, 25, (n) => I({ lp: n === 0 }));
  check('a close light punch deals damage', f.p[1].hp < hp);
  check('attacker gains meter', f.p[0].meter > 0);
}
// Holding back blocks; blocked normals do no damage.
{
  const f = new Fight(ROSTER[0], ROSTER[1]);
  f.p[0].x = 600; f.p[1].x = 700;
  run(f, 2, () => NO_INPUT, () => I({ right: true }));
  const hp = f.p[1].hp;
  run(f, 25, (n) => I({ hp: n === 0 }), () => I({ right: true }));
  check('holding back blocks a normal (no damage)', f.p[1].hp === hp);
}
// Low attacks beat a standing block.
{
  const f = new Fight(ROSTER[0], ROSTER[1]);
  f.p[0].x = 600; f.p[1].x = 700;
  run(f, 2, () => NO_INPUT, () => I({ right: true }));
  const hp = f.p[1].hp;
  run(f, 30, (n) => I({ down: true, hk: n === 0 }), () => I({ right: true }));
  check('a sweep hits a standing blocker', f.p[1].hp < hp);
}
// Motion input: qcf + P fires the projectile special.
{
  const hist = [{ dir: 2, f: 1 }, { dir: 3, f: 3 }, { dir: 6, f: 5 }];
  check('qcf motion is recognised', matchMotion(hist, MOTIONS.qcf.seq, 6));
  check('an old motion is ignored', !matchMotion(hist, MOTIONS.qcf.seq, 200));
  const f = new Fight(ROSTER[0], ROSTER[1]);
  run(f, 2, () => NO_INPUT);
  const seq = [I({ down: true }), I({ down: true, right: true }), I({ right: true }), I({ right: true, lp: true })];
  run(f, 4, (n) => seq[n]);
  run(f, 20, () => NO_INPUT);
  check('汐音 qcf+P throws 鯨浪波', f.shots.length === 1 || f.p[1].hp < f.p[1].f.health);
}
// Super needs a full meter; KO ends at 0 hp.
{
  const f = new Fight(ROSTER[2], ROSTER[3]);
  f.p[0].x = 600; f.p[1].x = 690;
  run(f, 2, () => NO_INPUT);
  run(f, 3, (n) => I({ su: n === 0 }));
  check('super needs a full meter', f.p[0].state !== 'attack');
  f.p[0].meter = METER_MAX;
  run(f, 2, () => NO_INPUT);
  run(f, 80, (n) => I({ su: n === 0 }));
  check('super spends the meter and hits', f.p[0].meter < METER_MAX && f.p[1].hp < f.p[1].f.health);
  f.p[1].hp = 5;
  f.p[0].x = 600; f.p[1].x = 690;
  run(f, 60, () => NO_INPUT);
  run(f, 30, (n) => I({ lp: n === 0 }));
  check('reaching 0 hp is a KO', f.p[1].hp === 0 && f.p[1].state === 'ko');
}
// Parry: 澪's counter answers a hit.
{
  const f = new Fight(ROSTER[0], ROSTER[7]);
  f.p[0].x = 600; f.p[1].x = 700;
  run(f, 2, () => NO_INPUT);
  const hp1 = f.p[1].hp;
  run(f, 40, (n) => I({ hp: n === 6 }), (n) => I({ sp: n === 0 }));
  check('水月返 parries and counters', f.p[1].hp === hp1 && f.p[0].hp < f.p[0].f.health);
}
check('fighters rest on the ground', new Fight(ROSTER[0], ROSTER[1]).p[0].y === GROUND_Y);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
