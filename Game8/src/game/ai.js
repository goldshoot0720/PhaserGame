// Computer opponent. Pure functions: given a Battle and a player, pick the next action.
import { getCard } from './cards.js';
import { heroId } from './Battle.js';

const TAUNT_VALUE = 2;
const BUFFER_VALUE = 4; // the 書房白貓 keeps buffing, so it is worth removing
const CLEAN_TRADE_BONUS = 10;
const EVEN_TRADE_BONUS = 2;

export function minionValue(m) {
  let value = m.atk * 2 + m.hp;
  if (m.taunt) value += TAUNT_VALUE;
  if (getCard(m.cardId).endOfTurn) value += BUFFER_VALUE;
  return value;
}

function cardPlayValue(card) {
  // Highest cost first (spend mana), battlecries break ties.
  return card.cost * 10 + (card.battlecry ? 1 : 0);
}

function choosePlay(battle, player) {
  const playable = battle.playableCards(player);
  if (!playable.length) return null;
  const best = playable.reduce((a, b) => (cardPlayValue(getCard(b.cardId)) > cardPlayValue(getCard(a.cardId)) ? b : a));
  return { type: 'play', uid: best.uid };
}

function tradeScore(attacker, defender) {
  const kills = attacker.atk >= defender.hp;
  const survives = defender.atk < attacker.hp;
  if (!kills) return defender.taunt ? 0 : -Infinity;
  if (survives) return minionValue(defender) + CLEAN_TRADE_BONUS;
  const gain = minionValue(defender) - minionValue(attacker);
  return gain >= 0 ? gain + EVEN_TRADE_BONUS : -Infinity;
}

function hasLethal(battle, player) {
  const enemy = battle.players[battle.opponentOf(player)];
  if (enemy.board.length) return false;
  const damage = battle.readyAttackers(player).reduce((sum, m) => sum + m.atk, 0);
  return damage >= enemy.hp;
}

function chooseAttack(battle, player) {
  const attackers = [...battle.readyAttackers(player)].sort((a, b) => b.atk - a.atk);
  if (!attackers.length) return null;
  const enemyHero = heroId(battle.opponentOf(player));
  const lethal = hasLethal(battle, player);

  for (const attacker of attackers) {
    const targets = battle.validTargets(player, attacker.uid);
    if (lethal && targets.includes(enemyHero)) return { type: 'attack', attacker: attacker.uid, target: enemyHero };
    let best = null;
    let bestScore = -Infinity;
    for (const id of targets) {
      if (id === enemyHero) continue;
      const score = tradeScore(attacker, battle.findCharacter(id).entity);
      if (score > bestScore) [best, bestScore] = [id, score];
    }
    const mustHitTaunt = !targets.includes(enemyHero);
    if (best && (bestScore > -Infinity || mustHitTaunt)) return { type: 'attack', attacker: attacker.uid, target: best };
    if (targets.includes(enemyHero)) return { type: 'attack', attacker: attacker.uid, target: enemyHero };
  }
  return null;
}

/** Next action for `player`: { type: 'play', uid } | { type: 'attack', attacker, target } | { type: 'end' }. */
export function chooseAction(battle, player) {
  return choosePlay(battle, player) ?? chooseAttack(battle, player) ?? { type: 'end' };
}

/** Applies an action chosen by chooseAction and returns the resulting events. */
export function applyAction(battle, player, action) {
  switch (action.type) {
    case 'play': return battle.playCard(player, action.uid);
    case 'attack': return battle.attack(player, action.attacker, action.target);
    case 'end': return battle.endTurn(player);
    default: throw new Error(`Unknown action: ${action.type}`);
  }
}
