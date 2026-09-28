// Acceptance tests — run headless by `npm run verify`.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { CHARACTERS, bossesFor, weaknessFor, bossDamage, fortressBossReward, FORTRESS_REWARDS, E_TANK, M_TANK, citadelTankGrant, FINAL_BOSS_PHASES, finalBossDamage, PLAYER, BG_URLS, CAST_URLS, VIEW_H } from './data.js';
import { buildLevel, STAGE_LAYOUTS, isSolid, T_WALL } from './levels.js';
import { Stage } from './stage.js';
import { Progress, run } from './progress.js';
import { Stages } from './scenes/stages.js';

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
check('game.json world height matches the override', GAME_OPTIONS.worldHeight === declared.worldHeight && declared.worldHeight === VIEW_H);

// Weakness loop: every boss has exactly one weakness and every weapon is a weakness exactly once.
const weak = CHARACTERS.map((c) => c.weakTo);
check('weakness chart is a permutation of the cast', new Set(weak).size === 8 && weak.every((w) => CHARACTERS.some((c) => c.key === w)) && CHARACTERS.every((c) => c.weakTo !== c.key));
for (const hero of CHARACTERS) {
  const bosses = bossesFor(hero.key);
  check(`${hero.key}: 7 bosses, hero excluded`, bosses.length === 7 && !bosses.some((b) => b.key === hero.key));
  // The boss weak to the hero's weapon is beaten by a charged shot instead.
  const chargeBoss = bosses.find((b) => b.weakTo === hero.key);
  check(`${hero.key}: the charge-weak boss exists`, !!chargeBoss && weaknessFor(chargeBoss.key, hero.key) === 'charge');
  if (chargeBoss) check(`${hero.key}: full charge deals weakness damage to it`, bossDamage(chargeBoss.key, hero.key, 'buster', 2) === 4);
}
check('weakness weapon deals 4, others 1', bossDamage('whale', 'glasses', 'penguin', 0) === 4 && bossDamage('whale', 'glasses', 'redcat', 0) === 1);
check('buster damage scales with charge', bossDamage('whale', 'glasses', 'buster', 0) === 1 && bossDamage('whale', 'glasses', 'buster', 1) === 2);

// Final fortress rewards: each boss heals more than half a bar; every third grants one life.
check('fortress reward is over half a health bar', FORTRESS_REWARDS.heal > PLAYER.maxHp / 2);
check('first boss heals and does not grant a life', (() => {
  const r = fortressBossReward(1, 2, 1);
  return r.hp === 1 + FORTRESS_REWARDS.heal && r.lives === 2 && !r.extraLife;
})());
check('healing respects max HP', fortressBossReward(PLAYER.maxHp - 1, 2, 2).hp === PLAYER.maxHp);
check('third and sixth bosses grant one life each', (() => {
  const third = fortressBossReward(4, 2, 3);
  const sixth = fortressBossReward(4, third.lives, 6);
  return third.lives === 3 && sixth.lives === 4 && third.extraLife && sixth.extraLife;
})());
check('fourth and seventh bosses do not grant a life', !fortressBossReward(4, 2, 4).extraLife && !fortressBossReward(4, 2, 7).extraLife);

// Levels.
for (const key of Object.keys(STAGE_LAYOUTS)) {
  let lv;
  try { lv = buildLevel(key); } catch (e) { check(`${key}: builds`, false); continue; }
  check(`${key}: builds 14 rows with a start`, lv.rows === 14 && lv.tiles.length === 14 && !!lv.start);
  check(`${key}: has checkpoints`, lv.checkpoints.length >= 2);
  check(`${key}: player starts on solid ground`, isSolid(lv.tiles[lv.start.row + 1][lv.start.col]));
  check(`${key}: boss room walled on the right`, lv.tiles[5][lv.cols - 1] === T_WALL);
  check(`${key}: boss door is open`, lv.doorRows.every((r) => !isSolid(lv.tiles[r][lv.roomCol])));
}
check('every stage has a background and every hero a sprite', CHARACTERS.every((c) => !!BG_URLS[c.key] && !!CAST_URLS[c.key]) && !!BG_URLS.final && !!BG_URLS.citadel);
check('guardian has three separate HP bars and distinct weak weapons',
  FINAL_BOSS_PHASES.length === 3 && FINAL_BOSS_PHASES.every((p) => p.hp > 0) &&
  new Set(FINAL_BOSS_PHASES.map((p) => p.weakTo)).size === 3);
check('each guardian form takes weakness damage only from its own weapon',
  FINAL_BOSS_PHASES.every((p, i) => finalBossDamage(i + 1, p.weakTo, 0) === 4 &&
    finalBossDamage(i + 1, FINAL_BOSS_PHASES[(i + 1) % 3].weakTo, 0) === 1));

// Exercise the real boss-defeat callback, including the delayed transition.
{
  const stage = Object.create(Stage.prototype) as any;
  const pending: Array<{ delay: number; callback: () => void }> = [];
  let nextBossCalls = 0;
  stage.stageKey = 'final';
  stage.hero = CHARACTERS.find((c) => c.key === 'sailor');
  stage.boss = {
    hero: CHARACTERS.find((c) => c.key === 'penguin'),
    b: { x: 100, y: 100, w: 40, h: 92 }, hp: 1, state: 'idle', iframes: 0,
  };
  stage.bossQueue = ['calico'];
  stage.rushDone = new Set(['whale', 'glasses']);
  stage.life = 1;
  stage.hp = 4;
  stage.lives = 2;
  Object.defineProperties(stage, {
    sound: { value: { play: () => {} } },
    camera: { value: { shake: () => {} } },
    game: { value: { fx: { emit: () => {} } } },
  });
  stage.schedule = (delay: number, callback: () => void) => { pending.push({ delay, callback }); };
  stage.say = () => {};
  stage.nextBoss = () => { nextBossCalls++; };
  stage.hitBoss({ weapon: 'buster', charge: 2 });
  pending.find((p) => p.delay === 1.2)?.callback();
  check('third fortress boss defeat restores HP and adds one life before the next boss',
    stage.hp === 4 + FORTRESS_REWARDS.heal && stage.lives === 3 &&
    stage.rushDone.size === 3 && nextBossCalls === 1 && stage.boss === null);
}

// The seventh rush boss must transfer the earned resources into the new stage.
{
  const stage = Object.create(Stage.prototype) as any;
  const pending: Array<{ delay: number; callback: () => void }> = [];
  let destination = '';
  stage.stageKey = 'final';
  stage.hero = CHARACTERS[0];
  stage.boss = { hero: CHARACTERS[7], b: { x: 0, y: 0, w: 40, h: 92 }, hp: 1, state: 'idle', iframes: 0, phase: 0 };
  stage.bossQueue = [];
  stage.rushDone = new Set(CHARACTERS.slice(1, 7).map((c) => c.key));
  stage.life = 1;
  stage.hp = 9;
  stage.lives = 4;
  stage.ammo = { buster: 28, penguin: 12 };
  stage.eTanks = 2;
  stage.mTanks = 1;
  Object.defineProperties(stage, {
    sound: { value: { play: () => {}, stopMusic: () => {} } },
    camera: { value: { shake: () => {} } },
    game: { value: { fx: { emit: () => {} }, go: (name: string) => { destination = name; } } },
  });
  stage.schedule = (delay: number, callback: () => void) => { pending.push({ delay, callback }); };
  stage.say = () => {};
  stage.hitBoss({ weapon: 'buster', charge: 2 });
  pending.find((p) => p.delay === 1.2)?.callback();
  check('seven-boss clear enters the new stage with earned HP, lives and ammo',
    destination === 'play' && run.stage === 'citadel' && run.fortressCarry?.hp === 26 &&
    run.fortressCarry?.lives === 4 && run.fortressCarry?.ammo.penguin === 12 && run.fortressCarry?.eTanks === 2 && run.fortressCarry?.mTanks === 1 &&
    Progress.citadelCheckpoint(CHARACTERS[0].key) === 0);
  run.fortressCarry = null;
}

// Citadel checkpoint survives a game over and routes the fortress slot directly to the guardian.
{
  const hero = 'whale';
  Progress.markCitadelPhase(hero, 1);
  Progress.markCitadelPhase(hero, 2);
  run.hero = hero;
  const stages = Object.create(Stages.prototype) as any;
  let destination = '';
  stages.unlocked = () => true;
  stages.gotoPlay = () => { destination = run.stage; };
  Object.defineProperty(stages, 'sound', { value: { play: () => {} } });
  stages.go('final');
  check('fortress select resumes at guardian rather than the seven-boss rush', destination === 'citadel' && Progress.citadelCheckpoint(hero) === 2);
  const stage = Object.create(Stage.prototype) as any;
  stage.stageKey = 'citadel'; stage.lv = { roomCol: 20 }; stage.life = 1;
  stage.schedule = () => {};
  Object.defineProperty(stage, 'sound', { value: { play: () => {} } });
  stage.enterRoom();
  check('entering guardian room updates respawn point to the guardian', stage.checkpoint.x === 23 * 32 && stage.checkpoint.y === 10 * 32);
  Progress.reset(hero);
  check('reset removes the guardian checkpoint', Progress.citadelCheckpoint(hero) === -1);
}

// E tanks heal fully, are consumed once, and grant three on citadel entry.
check('E and M tanks each grant three on citadel entry', E_TANK.citadelGrant === 3 && M_TANK.citadelGrant === 3 &&
  citadelTankGrant(0, 0).eTanks === 3 && citadelTankGrant(0, 0).mTanks === 3);
check('citadel tank grants cap both inventories', citadelTankGrant(8, 9).eTanks === 9 && citadelTankGrant(8, 9).mTanks === 9);
{
  const stage = Object.create(Stage.prototype) as any;
  stage.hp = 5; stage.eTanks = 3; stage.dead = 0; stage.endT = -1;
  Object.defineProperty(stage, 'sound', { value: { play: () => {} } });
  stage.useTank();
  check('E tank restores full HP and consumes one', stage.hp === PLAYER.maxHp && stage.eTanks === 2);
  stage.useTank();
  check('E tank cannot be wasted at full HP', stage.eTanks === 2);
  stage.hp = 1; stage.dead = 0.1; stage.useTank();
  check('E tank cannot be used after death', stage.eTanks === 2 && stage.hp === 1);
}
{
  const stage = Object.create(Stage.prototype) as any;
  stage.hp = 4; stage.mTanks = 3; stage.dead = 0; stage.endT = -1;
  stage.weapons = ['buster', 'penguin', 'redcat'];
  stage.ammo = { buster: 28, penguin: 1, redcat: 12 };
  Object.defineProperty(stage, 'sound', { value: { play: () => {} } });
  stage.useMTank();
  check('M tank restores life and every special weapon', stage.hp === PLAYER.maxHp && stage.ammo.penguin === PLAYER.maxAmmo && stage.ammo.redcat === PLAYER.maxAmmo && stage.mTanks === 2);
  stage.useMTank();
  check('M tank cannot be wasted when everything is full', stage.mTanks === 2);
  stage.hp = 1; stage.dead = 0.1; stage.useMTank();
  check('M tank cannot be used after death', stage.mTanks === 2 && stage.hp === 1);
}
{
  const stage = Object.create(Stage.prototype) as any;
  stage.pending = []; stage.paused = true;
  let calls = 0;
  stage.schedule(0.5, () => { calls++; });
  if (!stage.paused) stage.tickPending(1);
  check('pause freezes scheduled events', calls === 0 && stage.pending[0].left === 0.5);
  stage.paused = false; stage.tickPending(0.5);
  check('resume advances scheduled events', calls === 1 && stage.pending.length === 0);
}

// Three actual boss spawns must switch form, attack and HP in order.
{
  const stage = Object.create(Stage.prototype) as any;
  stage.stageKey = 'citadel';
  stage.lv = { roomCol: 10 };
  stage.shots = [];
  stage.finalPhase = 0;
  stage.bossBar = 0;
  stage.say = () => {};
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    stage.nextBoss();
    seen.push(`${stage.boss.phase}:${stage.boss.hp}:${stage.boss.hero.weapon.kind}`);
  }
  check('final guardian transforms through three distinct attack forms',
    seen.join('|') === '1:28:ice|2:32:bounce|3:36:fire3');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
