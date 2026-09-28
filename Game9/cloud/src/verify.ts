// Acceptance tests for the board economy.
import { readFileSync } from 'node:fs';
import { BACKGROUND, PIXEL_ART, CONTAINER, GAME_OPTIONS } from './config.js';
import {
  HEROES, CAST_URLS, CARDS, BOARD_SIZE, START_CASH, PASS_START, MAX_LEVEL, makeBoard, createPlayers, hop, advance, buy, upgrade, charge,
  payRent, rentOf, baseRent, landCost, upgradeCost, taxFor, worth, ranking, aiWantsBuy, cardCash, gridOf, type Tile,
} from './rules.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log('  ok   ', name); } else { fail++; console.error('  FAIL  ', name); }
}
const declared = JSON.parse(readFileSync(new URL('../src/game.json', import.meta.url), 'utf8')) as { worldHeight: number; background: string; pixelArt: boolean };
check('boot options agree with game.json', GAME_OPTIONS.background === BACKGROUND && GAME_OPTIONS.pixelArt === PIXEL_ART && GAME_OPTIONS.container === CONTAINER && declared.background === BACKGROUND && declared.worldHeight === GAME_OPTIONS.worldHeight);
check('eight heroes with art and distinct perks', HEROES.length === 8 && HEROES.every((h) => !!CAST_URLS[h.id]) && new Set(HEROES.map((h) => h.perk)).size === 8);

const board = makeBoard();
const props = board.filter((t) => t.kind === 'prop');
check('28 spaces, 18 deeds in 6 districts of 3', board.length === BOARD_SIZE && props.length === 18 && [0, 1, 2, 3, 4, 5].every((g) => props.filter((t) => t.group === g).length === 3));
check('corners are start / rest / pot / jail', board[0].kind === 'start' && board[7].kind === 'rest' && board[14].kind === 'pot' && board[21].kind === 'jail');
const cells = new Set(board.map((t) => { const g = gridOf(t.i); return `${g.gx},${g.gy}`; }));
check('ring layout: every space on a distinct edge cell', cells.size === 28 && board.every((t) => { const g = gridOf(t.i); return g.gx === 0 || g.gy === 0 || g.gx === 7 || g.gy === 7; }));

const rnd = (): number => 0.5;
const ps = createPlayers('whale', rnd);
check('you plus three distinct rivals', ps.length === 4 && !ps[0].ai && ps.slice(1).every((p) => p.ai) && new Set(ps.map((p) => p.hero.id)).size === 4 && ps[0].cash === START_CASH);
check('sailor perk: +300 starting cash', createPlayers('sailor', rnd)[0].cash === START_CASH + 300);

const me = ps[0], b1 = board[1];
me.pos = 26;
const c0 = me.cash;
check('passing start pays the bonus (+100 whale perk)', advance(me, 4) && me.pos === 2 && me.cash === c0 + PASS_START + 100);
hop(me, -1); hop(me, -1); hop(me, -1);
check('moving backwards over start pays nothing', me.pos === 27 && me.cash === c0 + PASS_START + 100);

const w0 = worth(me, board);
check('buying a deed keeps net worth, changes owner', buy(me, b1) && b1.owner === 0 && worth(me, board) === w0);
check('cannot buy an owned deed', !buy(ps[1], b1));
const rival = ps[1];
const r0 = rentOf(b1, board);
check('base toll is 10% of price', r0 === baseRent(b1) && r0 === 10);
buy(me, board[2]); buy(me, board[4]);
check('owning a whole district doubles the empty-lot toll', rentOf(b1, board) === r0 * 2);
check('upgrading raises toll 4× then up to a hotel', upgrade(me, b1) && rentOf(b1, board) === baseRent(b1) * 4 && upgrade(me, b1) && upgrade(me, b1) && b1.level === MAX_LEVEL && !upgrade(me, b1) && rentOf(b1, board) === baseRent(b1) * 16);

const glasses = createPlayers('glasses', rnd)[0], tshirt = createPlayers('tshirt', rnd)[0];
check('land and build discounts', landCost(board[27], glasses.hero.perk) === Math.round(board[27].price * 0.9 / 10) * 10 && upgradeCost(board[27], tshirt.hero.perk) < upgradeCost(board[27]));
check('penguin pays half tax', taxFor(createPlayers('penguin', rnd)[0]) === 75 && taxFor(me) === 150);
check('calico doubles windfalls only', cardCash(100, createPlayers('calico', rnd)[0]) === 200 && cardCash(-80, createPlayers('calico', rnd)[0]) === -80);

const beforeOwner = me.cash, beforePayer = rival.cash;
const pr = payRent(rival, me, b1, board);
check('toll moves cash from payer to owner', pr.paid === pr.amount && me.cash === beforeOwner + pr.amount && rival.cash === beforePayer - pr.amount);

// Liquidation then bankruptcy.
const b2: Tile[] = makeBoard();
const [a, bb] = createPlayers('tshirt', rnd);
buy(a, b2[27]);
a.cash = 10;
const lq = charge(a, 50, b2);
check('short on cash: sells a deed at 60% before going bankrupt', lq.sold.length === 1 && a.alive && b2[27].owner === -1 && a.cash === 10 - 50 + Math.floor(b2[27].price * 0.6));
buy(bb, b2[1]); bb.cash = 0;
const bk = charge(bb, 5000, b2);
check('bankruptcy: pays what it can and releases deeds', bk.bankrupt && !bb.alive && bb.cash === 0 && bk.paid === Math.floor(b2[1].price * 0.6) && b2.every((t) => t.owner !== bb.id));
check('ranking puts survivors first, then by worth', ranking([bb, a], b2)[0] === a);

const ai = createPlayers('whale', rnd)[1];
ai.cash = 150;
check('AI keeps a cash reserve before buying', !aiWantsBuy(ai, makeBoard()[27], makeBoard()) && (ai.cash = 2000, aiWantsBuy(ai, makeBoard()[27], makeBoard())));
check('chance deck has variety', CARDS.length >= 10 && new Set(CARDS.map((c) => c.kind)).size >= 6);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
