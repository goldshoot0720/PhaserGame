// Acceptance tests for terrain + ballistics + AI.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import {
  HEROES, CAST_URLS, BASE_WEAPONS, FIELD_W, WATER_Y, TANK_R, makeTerrain, surface, carve, spawnXs, launchVelocity, simulate, blastDamage, fallDamage,
  canDrive, aiAim, standings, resupply, autoSupplySlots, AMMO_CAPS,
} from './rules.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); } else { fail++; console.error('  FAIL  ', name); }
}
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('boot options agree with game.json', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER && declared.background === BACKGROUND && declared.worldHeight === GAME_OPTIONS.worldHeight);
check('eight drivers, each with art and a distinct special', HEROES.length === 8 && HEROES.every((h) => !!CAST_URLS[h.id]) && new Set(HEROES.map((h) => h.special.kind + h.special.count)).size === 8);
check('three base weapons, standard is unlimited', BASE_WEAPONS.length === 3 && BASE_WEAPONS[0].uses === -1 && BASE_WEAPONS.slice(1).every((w) => w.uses > 0));

const t = makeTerrain(1234);
check('terrain spans the field and is deterministic', t.length === FIELD_W + 1 && makeTerrain(1234)[900] === t[900] && makeTerrain(99)[900] !== t[900]);
check('terrain has land above water and a valley near it', t.some((y) => y < 450) && t.some((y) => y > WATER_Y - 60));
const xs = spawnXs(t, 4);
check('four spawns on dry land, spread out', xs.length === 4 && xs.every((x) => surface(t, x) < WATER_Y - 30) && xs[3] - xs[0] > FIELD_W * 0.5);

const t2 = [...t];
const y0 = surface(t2, 1200);
carve(t2, 1200, y0, 50);
check('explosion carves a crater (lower in the middle than at the rim)', surface(t2, 1200) > y0 + 40 && surface(t2, 1200) >= surface(t2, 1240));
const t3 = [...t]; carve(t3, 1200, y0, 50, 2.4);
check('drill digs deeper than a normal blast', surface(t3, 1200) > surface(t2, 1200));

const v = launchVelocity(1, 45, 100);
check('launch at 45° goes up and to the facing side', v.vx > 0 && v.vy < 0 && Math.abs(v.vx + v.vy) < 1e-6);
check('laser ignores power', launchVelocity(-1, 0, 10, 'laser').vx < -1000);
const flat = Array.from({ length: FIELD_W + 1 }, () => 500);
const noWind = simulate(flat, 400, 460, 300, -300, 0, [], -1);
const tail = simulate(flat, 400, 460, 300, -300, 8, [], -1);
check('shell lands on the ground; tail wind carries it further', noWind.hit === -1 && tail.hit === -1 && tail.x > noWind.x + 20);
const tanks = [{ x: 400, y: 500, alive: true }, { x: noWind.x, y: 500, alive: true }];
const direct = simulate(flat, 400, 460, 300, -300, 0, tanks, 0);
check('shell can hit a tank directly', direct.hit === 1);

const w = { dmg: 30, radius: 50 };
check('blast damage: direct > centre > rim > outside', blastDamage(w, 0, 0, 0, 0, true) > blastDamage(w, 0, -18, 0, 0, false) && blastDamage(w, 0, -18, 0, 0, false) > blastDamage(w, 40, -18, 0, 0, false) && blastDamage(w, 200, -18, 0, 0, false) === 0);
check('fall damage only for long drops', fallDamage(30) === 0 && fallDamage(130) === 20);
const wall = [...flat]; for (let x = 600; x <= 700; x++) wall[x] = 300;
check('tanks cannot drive up a cliff', canDrive(flat, 500, 501) && !canDrive(wall, 599, 600));

// AI should land a shell near a target on flat ground with and without wind.
const foes = [{ x: 500, y: 500, alive: true }, { x: 1300, y: 500, alive: true }];
const calm = aiAim(flat, foes, 0, 1, 0, 50);
const windy = aiAim(flat, foes, 0, 1, -7, 50);
check('AI finds a shot within 40px of the target (calm and windy)', calm.miss < 40 && windy.miss < 40 && calm.facing === 1);
const back = aiAim(flat, [{ x: 1300, y: 500, alive: true }, { x: 500, y: 500, alive: true }], 0, 1, 0, 50);
check('AI faces left when the target is left', back.facing === -1 && back.miss < 40);
check('standings: survivors first, then latest eliminated', standings([{ alive: false, hp: 0, diedAt: 3, n: 'a' }, { alive: true, hp: 20, diedAt: 0, n: 'b' }, { alive: false, hp: 0, diedAt: 7, n: 'c' }]).map((x) => x.n).join('') === 'bca');
const u = [-1, 0, 3, 1];
check('ammo crate restocks every slot up to its cap, never the unlimited shell', resupply(u, [0, 1, 2, 3]).join() === '1,3' && u.join() === `-1,1,${AMMO_CAPS[2]},2` && resupply(u, [3]).length === 0);
check('automatic resupply: triple every 3rd turn, heavy every 5th', autoSupplySlots(3).join() === '1' && autoSupplySlots(5).join() === '2' && autoSupplySlots(15).join() === '1,2' && autoSupplySlots(4).length === 0);
check('tank radius sane', TANK_R > 10 && TANK_R < 40);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
