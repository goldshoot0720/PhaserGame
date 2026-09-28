// Pure rules engine for the 1v1 card battle. No Phaser imports: every action mutates the
// state and returns a list of events that the UI replays as animations.
import { CARDS, EFFECTS, KEYWORDS, getCard, hasKeyword } from './cards.js';

export const RULES = {
  HERO_HP: 30,
  MAX_MANA: 10,
  HAND_MAX: 8,
  BOARD_MAX: 5,
  COPIES_PER_CARD: 2,
  START_HAND_FIRST: 3,
  START_HAND_SECOND: 4,
  START_MANA: 3,
};

export const heroId = (player) => `H${player}`;

export class Battle {
  constructor({ rng = Math.random, firstPlayer = 0 } = {}) {
    this.rng = rng;
    this.firstPlayer = firstPlayer;
    this.nextUid = 1;
    this.turn = 0;
    this.current = firstPlayer;
    this.winner = null; // null while playing, then 0, 1 or 'draw'
    this.players = [0, 1].map((id) => ({
      id,
      hp: RULES.HERO_HP,
      maxHp: RULES.HERO_HP,
      mana: 0,
      maxMana: RULES.START_MANA - 1,
      fatigue: 0,
      deck: this.buildDeck(),
      hand: [],
      board: [],
    }));
  }

  get isOver() {
    return this.winner !== null;
  }

  buildDeck() {
    const deck = CARDS.flatMap((card) => Array(RULES.COPIES_PER_CARD).fill(card.id));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  opponentOf(player) {
    return 1 - player;
  }

  // ---------- queries ----------

  /** Finds a hero ('H0'/'H1') or a minion uid; returns { owner, entity, isHero }. */
  findCharacter(id) {
    if (id === heroId(0) || id === heroId(1)) {
      const owner = Number(id[1]);
      return { owner, entity: this.players[owner], isHero: true };
    }
    for (const p of this.players) {
      const minion = p.board.find((m) => m.uid === id);
      if (minion) return { owner: p.id, entity: minion, isHero: false };
    }
    return null;
  }

  canPlay(player, uid) {
    if (this.isOver || player !== this.current) return false;
    const p = this.players[player];
    const card = p.hand.find((c) => c.uid === uid);
    return !!card && getCard(card.cardId).cost <= p.mana && p.board.length < RULES.BOARD_MAX;
  }

  playableCards(player) {
    return this.players[player].hand.filter((c) => this.canPlay(player, c.uid));
  }

  canAttack(player, uid) {
    if (this.isOver || player !== this.current) return false;
    const minion = this.players[player].board.find((m) => m.uid === uid);
    return !!minion && !minion.sleeping && !minion.attacked && minion.atk > 0;
  }

  readyAttackers(player) {
    return this.players[player].board.filter((m) => this.canAttack(player, m.uid));
  }

  /** Enemy minions shield their hero; taunts must be cleared before other minions. */
  validTargets(player, uid) {
    if (!this.canAttack(player, uid)) return [];
    const enemy = this.players[this.opponentOf(player)];
    const taunts = enemy.board.filter((m) => m.taunt);
    if (taunts.length) return taunts.map((m) => m.uid);
    return enemy.board.length ? enemy.board.map((m) => m.uid) : [heroId(enemy.id)];
  }

  hasAnyAction(player) {
    return this.playableCards(player).length > 0 || this.readyAttackers(player).length > 0;
  }

  // ---------- actions ----------

  start() {
    const events = [];
    const second = this.opponentOf(this.firstPlayer);
    for (let i = 0; i < RULES.START_HAND_FIRST; i++) this.draw(this.firstPlayer, events);
    for (let i = 0; i < RULES.START_HAND_SECOND; i++) this.draw(second, events);
    this.ensureOpeningCard(this.firstPlayer);
    this.ensureOpeningCard(second);
    this.startTurn(this.firstPlayer, events);
    return events;
  }

  ensureOpeningCard(player) {
    const p = this.players[player];
    if (p.hand.some((card) => getCard(card.cardId).cost <= RULES.START_MANA)) return;
    const index = p.deck.findIndex((id) => getCard(id).cost <= RULES.START_MANA);
    if (index < 0) throw new Error('Deck has no affordable opening card');
    const old = p.hand[0].cardId;
    p.hand[0].cardId = p.deck[index];
    p.deck[index] = old;
  }

  playCard(player, uid) {
    if (!this.canPlay(player, uid)) throw new Error('Illegal play');
    const events = [];
    const p = this.players[player];
    const index = p.hand.findIndex((c) => c.uid === uid);
    const [handCard] = p.hand.splice(index, 1);
    const card = getCard(handCard.cardId);
    p.mana -= card.cost;
    const minion = this.createMinion(handCard, card);
    p.board.push(minion);
    events.push({ type: 'play', player, uid, cardId: card.id, minion: { ...minion }, mana: p.mana });
    if (card.battlecry) this.resolveBattlecry(player, minion, card.battlecry, events);
    this.resolveDeaths(events);
    return events;
  }

  attack(player, attackerUid, targetId) {
    if (!this.validTargets(player, attackerUid).includes(targetId)) throw new Error('Illegal attack');
    const events = [];
    const attacker = this.findCharacter(attackerUid).entity;
    const target = this.findCharacter(targetId);
    attacker.attacked = true;
    events.push({ type: 'attack', attacker: attackerUid, target: targetId });
    const counter = target.isHero ? 0 : target.entity.atk;
    this.damage(targetId, attacker.atk, events);
    if (counter > 0) this.damage(attackerUid, counter, events);
    this.resolveDeaths(events);
    return events;
  }

  endTurn(player) {
    if (this.isOver || player !== this.current) throw new Error('Not your turn');
    const events = [{ type: 'turnEnd', player }];
    this.resolveEndOfTurn(player, events);
    this.resolveDeaths(events);
    if (!this.isOver) this.startTurn(this.opponentOf(player), events);
    return events;
  }

  // ---------- internals ----------

  createMinion(handCard, card) {
    const charge = hasKeyword(card, KEYWORDS.CHARGE);
    return {
      uid: handCard.uid,
      cardId: card.id,
      atk: card.atk,
      hp: card.hp,
      maxHp: card.hp,
      taunt: hasKeyword(card, KEYWORDS.TAUNT),
      charge,
      sleeping: !charge,
      attacked: false,
    };
  }

  startTurn(player, events) {
    this.current = player;
    this.turn += 1;
    const p = this.players[player];
    p.maxMana = Math.min(RULES.MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    for (const m of p.board) {
      m.sleeping = false;
      m.attacked = false;
    }
    events.push({ type: 'turnStart', player, turn: this.turn, mana: p.mana, maxMana: p.maxMana });
    this.draw(player, events);
    this.resolveDeaths(events);
  }

  draw(player, events) {
    const p = this.players[player];
    if (!p.deck.length) {
      p.fatigue += 1;
      events.push({ type: 'fatigue', player, amount: p.fatigue });
      this.damage(heroId(player), p.fatigue, events);
      return;
    }
    const cardId = p.deck.pop();
    if (p.hand.length >= RULES.HAND_MAX) {
      events.push({ type: 'burn', player, cardId, deckCount: p.deck.length });
      return;
    }
    const card = { uid: `c${this.nextUid++}`, cardId };
    p.hand.push(card);
    events.push({ type: 'draw', player, card: { ...card }, deckCount: p.deck.length });
  }

  damage(id, amount, events) {
    const { entity } = this.findCharacter(id);
    entity.hp -= amount;
    events.push({ type: 'damage', target: id, amount, hp: entity.hp });
  }

  heal(id, amount, events) {
    const { entity } = this.findCharacter(id);
    const healed = Math.min(amount, entity.maxHp - entity.hp);
    entity.hp += healed;
    events.push({ type: 'heal', target: id, amount: healed, hp: entity.hp });
  }

  resolveBattlecry(player, minion, { effect, amount }, events) {
    const enemy = this.opponentOf(player);
    events.push({ type: 'ability', source: minion.uid, cardId: minion.cardId, player });
    switch (effect) {
      case EFFECTS.HEAL_OWN_HERO:
        this.heal(heroId(player), amount, events);
        break;
      case EFFECTS.DRAW:
        for (let i = 0; i < amount; i++) this.draw(player, events);
        break;
      case EFFECTS.DAMAGE_ENEMY_HERO:
        this.damage(heroId(enemy), amount, events);
        break;
      case EFFECTS.DAMAGE_ALL_ENEMIES:
        for (const m of [...this.players[enemy].board]) this.damage(m.uid, amount, events);
        this.damage(heroId(enemy), amount, events);
        break;
      default:
        throw new Error(`Unknown battlecry: ${effect}`);
    }
  }

  resolveEndOfTurn(player, events) {
    const board = this.players[player].board;
    for (const source of board) {
      const card = getCard(source.cardId);
      if (card.endOfTurn?.effect !== EFFECTS.END_TURN_BUFF_OTHERS_ATK) continue;
      events.push({ type: 'ability', source: source.uid, cardId: source.cardId, player });
      for (const m of board) {
        if (m === source) continue;
        m.atk += card.endOfTurn.amount;
        events.push({ type: 'buff', target: m.uid, atk: m.atk });
      }
    }
  }

  resolveDeaths(events) {
    for (const p of this.players) {
      const dead = p.board.filter((m) => m.hp <= 0);
      p.board = p.board.filter((m) => m.hp > 0);
      for (const m of dead) events.push({ type: 'death', target: m.uid, owner: p.id });
    }
    if (this.isOver) return;
    const lost = this.players.filter((p) => p.hp <= 0).map((p) => p.id);
    if (!lost.length) return;
    this.winner = lost.length === 2 ? 'draw' : this.opponentOf(lost[0]);
    events.push({ type: 'gameOver', winner: this.winner });
  }
}
