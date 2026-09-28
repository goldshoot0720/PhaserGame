// Headless check: plays AI-vs-AI games with the pure rules engine and verifies invariants.
import { Battle, RULES } from '../src/game/Battle.js';
import { chooseAction, applyAction } from '../src/game/ai.js';
import { getCard } from '../src/game/cards.js';

const GAMES = 500;
const MAX_ACTIONS = 2000;

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function checkInvariants(battle) {
  for (const p of battle.players) {
    assert(p.hand.length <= RULES.HAND_MAX, 'hand overflow');
    assert(p.board.length <= RULES.BOARD_MAX, 'board overflow');
    assert(p.mana >= 0 && p.mana <= p.maxMana && p.maxMana <= RULES.MAX_MANA, 'bad mana');
    assert(p.board.every((m) => m.hp > 0), 'dead minion on board');
    assert(p.hp <= p.maxHp, 'overheal');
  }
}

const tally = { 0: 0, 1: 0, draw: 0 };
let totalTurns = 0;
for (let g = 0; g < GAMES; g++) {
  const rng = mulberry32(g + 1);
  const battle = new Battle({ rng, firstPlayer: g % 2 });
  battle.start();
  assert(battle.players[battle.current].mana === RULES.START_MANA, 'opening mana');
  assert(battle.playableCards(battle.current).length > 0, 'first player has no playable opening card');
  const second = battle.opponentOf(battle.current);
  assert(battle.players[second].hand.some((card) => getCard(card.cardId).cost <= RULES.START_MANA), 'second player has no playable opening card');
  let actions = 0;
  while (!battle.isOver) {
    assert(++actions < MAX_ACTIONS, `game ${g} did not finish`);
    const player = battle.current;
    applyAction(battle, player, chooseAction(battle, player));
    checkInvariants(battle);
  }
  tally[battle.winner] += 1;
  totalTurns += battle.turn;
}

// A scripted scenario: taunt must be attacked first, charge can attack immediately.
const b = new Battle({ rng: mulberry32(99), firstPlayer: 0 });
b.start();
const [me, foe] = b.players;
me.mana = me.maxMana = 10;
me.hand = [{ uid: 'x1', cardId: 'xiang' }, { uid: 'x2', cardId: 'zhe' }];
foe.board = [{ uid: 't1', cardId: 'penguin', atk: 1, hp: 4, maxHp: 4, taunt: true, charge: false, sleeping: false, attacked: false }];
b.playCard(0, 'x1');
assert(b.canAttack(0, 'x1'), 'charge minion should attack at once');
assert(JSON.stringify(b.validTargets(0, 'x1')) === '["t1"]', 'taunt must be the only target');
b.playCard(0, 'x2');
assert(!b.canAttack(0, 'x2'), 'summoning sickness');
assert(me.hand.length === 1, 'zhe should draw a card');

// Any opposing minion protects the hero, even without taunt.
const shield = new Battle({ rng: mulberry32(123), firstPlayer: 0 });
shield.start();
shield.players[0].board = [{ uid: 'a', cardId: 'xiang', atk: 2, hp: 1, maxHp: 1, taunt: false, charge: true, sleeping: false, attacked: false }];
shield.players[1].board = [{ uid: 'd', cardId: 'xiaohong', atk: 3, hp: 2, maxHp: 2, taunt: false, charge: false, sleeping: false, attacked: false }];
assert(JSON.stringify(shield.validTargets(0, 'a')) === '["d"]', 'enemy card must block hero attack');
shield.attack(0, 'a', 'd');
shield.players[0].board = [{ uid: 'b', cardId: 'xiang', atk: 2, hp: 1, maxHp: 1, taunt: false, charge: true, sleeping: false, attacked: false }];
assert(JSON.stringify(shield.validTargets(0, 'b')) === '["H1"]', 'hero should be targetable after the board is cleared');

console.log(`AI vs AI: ${GAMES} games finished. wins P0=${tally[0]} P1=${tally[1]} draw=${tally.draw}, avg turns ${(totalTurns / GAMES).toFixed(1)}`);
console.log('Scenario checks passed.');
