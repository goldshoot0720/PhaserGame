// Acceptance tests for the card rules (and many CPU-vs-CPU games).
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import { Battle, chooseAction, applyAction, heroId, RULES } from './battle.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.error('  FAIL  ', name); }
}
check('boot options', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER);
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('game.json agrees', declared.background === BACKGROUND && declared.pixelArt === PIXEL_ART && declared.worldHeight === GAME_OPTIONS.worldHeight);

let seed = 7;
const rng = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
{
  const b = new Battle(rng, 0);
  b.start();
  check('opening hands 3+1 draw vs 4', b.players[0].hand.length === 4 && b.players[1].hand.length === 4);
  check('first turn gives 3 mana', b.players[0].mana === 3 && b.players[0].maxMana === 3);
  check('decks are 16 cards minus draws', b.players[0].deck.length === 12 && b.players[1].deck.length === 12);
  check('first player can play a card immediately', b.playableCards(0).length > 0);
}
{
  let openingPlayable = true, secondPlayable = true, deckCountsPreserved = true;
  for (let i = 0; i < 500; i++) {
    const b = new Battle(rng, i % 2);
    b.start();
    openingPlayable &&= b.playableCards(b.firstPlayer).length > 0;
    const second = b.opponentOf(b.firstPlayer);
    b.endTurn(b.firstPlayer);
    secondPlayable &&= b.playableCards(second).length > 0;
    for (const p of b.players) {
      const counts = new Map<string, number>();
      for (const id of [...p.deck, ...p.hand.map((c) => c.cardId)]) counts.set(id, (counts.get(id) ?? 0) + 1);
      deckCountsPreserved &&= [...counts.values()].every((n) => n <= RULES.COPIES_PER_CARD);
    }
  }
  check('500 randomized first-player openers have a playable card', openingPlayable);
  check('500 randomized second-player openers have a playable card', secondPlayable);
  check('opening adjustment preserves deck copies', deckCountsPreserved);
}
{
  // Rig hands to test keywords.
  const b = new Battle(rng, 0);
  b.start();
  const p0 = b.players[0], p1 = b.players[1];
  p0.mana = p0.maxMana = 10;
  p0.hand = [{ uid: 'a', cardId: 'tshirt' }, { uid: 'b', cardId: 'redcat' }, { uid: 'c', cardId: 'whale' }];
  b.playCard(0, 'a');
  check('charge minions can attack at once', b.canAttack(0, 'a'));
  b.playCard(0, 'b');
  check('battlecry deals 2 to enemy hero', p1.hp === RULES.HERO_HP - 2);
  check('non-charge minions are asleep', !b.canAttack(0, 'b'));
  p0.hp = 20;
  b.playCard(0, 'c');
  check('汐音 heals own hero 4', p0.hp === 24);
  p1.board.push({ uid: 'T', cardId: 'penguin', atk: 1, hp: 4, maxHp: 4, taunt: true, charge: false, sleeping: false, attacked: false });
  check('taunt forces targets', b.validTargets(0, 'a').length === 1 && b.validTargets(0, 'a')[0] === 'T');
  b.attack(0, 'a', 'T');
  check('attacker takes counter damage and dies', !p0.board.some((m) => m.uid === 'a') && p1.board[0].hp === 2);
  check('mana spent', p0.mana === 10 - 1 - 3 - 4);
}
{
  const b = new Battle(rng, 0); b.start();
  b.players[0].board = [{ uid: 'A', cardId: 'tshirt', atk: 2, hp: 1, maxHp: 1, taunt: false, charge: true, sleeping: false, attacked: false }];
  b.players[1].board = [{ uid: 'D', cardId: 'redcat', atk: 3, hp: 2, maxHp: 2, taunt: false, charge: false, sleeping: false, attacked: false }];
  check('an enemy card blocks direct hero attacks even without taunt',
    b.validTargets(0, 'A').join(',') === 'D' && !b.validTargets(0, 'A').includes(heroId(1)));
  b.attack(0, 'A', 'D');
  b.players[0].board = [{ uid: 'B', cardId: 'tshirt', atk: 2, hp: 1, maxHp: 1, taunt: false, charge: true, sleeping: false, attacked: false }];
  check('enemy hero becomes target only after all enemy cards are cleared', b.players[1].board.length === 0 && b.validTargets(0, 'B').join(',') === heroId(1));
}
{
  // Many full AI-vs-AI games must finish with a winner.
  let finished = 0, turns = 0;
  for (let g = 0; g < 40; g++) {
    const b = new Battle(rng, g % 2);
    b.start();
    let guard = 0;
    while (!b.isOver && guard++ < 2000) applyAction(b, b.current, chooseAction(b, b.current));
    if (b.isOver) finished++;
    turns += b.turn;
  }
  check('40 CPU-vs-CPU games all finish', finished === 40);
  check(`games last a sensible number of turns (avg ${(turns / 40).toFixed(1)})`, turns / 40 > 8 && turns / 40 < 40);
}
{
  const b = new Battle(rng, 0); b.start();
  b.players[0].deck = [];
  b.endTurn(0); b.endTurn(1);
  check('empty deck deals growing fatigue', b.players[0].fatigue === 1 && b.players[0].hp === RULES.HERO_HP - 1);
  check('hero id helper', heroId(1) === 'H1');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
