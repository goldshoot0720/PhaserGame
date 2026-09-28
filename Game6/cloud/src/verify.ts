// Acceptance tests for the tactics rules.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { Board, MAPS, CHARS, COLS, ROWS, TERRAIN } from './tactics.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}
check('boot options', /^#[0-9a-fA-F]{6}$/.test(BACKGROUND) && GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('game.json agrees', declared.background === BACKGROUND && declared.pixelArt === PIXEL_ART && declared.worldHeight === GAME_OPTIONS.worldHeight);

const keys = CHARS.map((c) => c.key);
for (const m of MAPS) {
  check(`${m.name}: ${ROWS}×${COLS} of known terrain`, m.rows.length === ROWS && m.rows.every((r) => r.length === COLS && [...r].every((ch) => !!TERRAIN[ch])));
  check(`${m.name}: every spawn is on walkable land`, [...m.p, ...m.e].every(([x, y]) => m.rows[y][x] !== 'W' && m.rows[y][x] !== 'M'));
  // Every enemy can eventually be reached by a ground unit (distance field).
  const b = Board.create(m, keys.slice(0, 4), keys.slice(4));
  const field = b.distanceField(b.team('P')[1], b.team('E'));
  check(`${m.name}: the armies can reach each other`, b.team('P').every((u) => field.has(`${u.x},${u.y}`)));
}
{
  const b = Board.create(MAPS[0], ['whale', 'penguin', 'glasses', 'tshirt'], ['calico', 'whitecat', 'redcat', 'sailor']);
  const [whale, penguin, glasses, tshirt] = b.team('P');
  const [calico, whitecat, redcat] = b.team('E');
  const r = b.reachable(tshirt);
  check('reach respects movement points', [...r.values()].every((n) => n.c <= tshirt.c.mov));
  // Water blocks walkers but not the swimmer.
  const water = { x: 5, y: 1 };
  check('water blocks normal units', b.moveCost(penguin, water.x, water.y) >= 99 && b.moveCost(whale, water.x, water.y) === 1);
  // Damage formula.
  redcat.x = 5; redcat.y = 4; tshirt.x = 4; tshirt.y = 4;
  check('damage = atk − (def + terrain)', b.calcDamage(redcat, tshirt).dmg === 10 - 4);
  whitecat.x = 3; whitecat.y = 4;
  check('magic halves defence', b.calcDamage(whitecat, tshirt).dmg === 10 - Math.floor(4 / 2));
  check('damage is at least 1', b.calcDamage(whale, penguin).dmg >= 1);
  // Archer cannot counter adjacent attacks.
  glasses.x = 8; glasses.y = 4; calico.x = 9; calico.y = 4;
  const hpBefore = calico.hp;
  const res = b.combat(calico, glasses, () => 0.99);
  check('archer cannot counter at range 1', res.counter === 0 && calico.hp === hpBefore);
  // Crit doubles.
  check('rogue crit doubles damage', b.calcDamage(calico, tshirt, () => 0.1).dmg === 2 * b.calcDamage(calico, tshirt).dmg);
  // Healing caps at max hp.
  penguin.hp = penguin.c.hp - 3;
  check('healing is capped at max HP', b.heal(whale, penguin) === 3 && penguin.hp === penguin.c.hp);
  // House recovery.
  tshirt.x = 8; tshirt.y = 2; tshirt.hp = 10;
  const healed = b.phaseHeal('P');
  check('houses restore 5 HP at phase start', healed.some((h) => h.u === tshirt && h.amt === 5) && tshirt.hp === 15);
  // AI prefers a kill.
  tshirt.hp = 1; tshirt.x = 6; tshirt.y = 4;
  redcat.x = 7; redcat.y = 5;
  const plan = b.aiPlan(redcat);
  check('AI goes for the kill', plan.type === 'atk' && plan.target === tshirt);
  for (const e of b.team('E')) e.hp = 0;
  check('wiping the enemy wins', b.winner() === 'P');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
