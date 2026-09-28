// Pure rules engine for the 1v1 card battle (ported from the local Game8). Every action
// mutates state and returns events that the UI replays.
import { CARDS, getCard } from './cards.js';

export const RULES = { HERO_HP: 30, MAX_MANA: 10, HAND_MAX: 8, BOARD_MAX: 5, COPIES_PER_CARD: 2, START_HAND_FIRST: 3, START_HAND_SECOND: 4, START_MANA: 3 };
export const heroId = (p: number): string => `H${p}`;

export interface HandCard { uid: string; cardId: string; }
export interface Minion { uid: string; cardId: string; atk: number; hp: number; maxHp: number; taunt: boolean; charge: boolean; sleeping: boolean; attacked: boolean; }
export interface PlayerState { id: number; hp: number; maxHp: number; mana: number; maxMana: number; fatigue: number; deck: string[]; hand: HandCard[]; board: Minion[]; }
export type Ev = { type: string; [k: string]: unknown };
export type Rng = () => number;

export class Battle {
  nextUid = 1;
  turn = 0;
  current: number;
  winner: number | 'draw' | null = null;
  players: PlayerState[];
  constructor(public rng: Rng = Math.random, public firstPlayer = 0) {
    this.current = firstPlayer;
    this.players = [0, 1].map((id) => ({ id, hp: RULES.HERO_HP, maxHp: RULES.HERO_HP, mana: 0, maxMana: RULES.START_MANA - 1, fatigue: 0, deck: this.buildDeck(), hand: [], board: [] }));
  }
  get isOver(): boolean { return this.winner !== null; }
  buildDeck(): string[] {
    const deck = CARDS.flatMap((c) => Array<string>(RULES.COPIES_PER_CARD).fill(c.id));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
  }
  opponentOf(p: number): number { return 1 - p; }

  findCharacter(id: string): { owner: number; entity: { hp: number; maxHp: number; atk?: number }; isHero: boolean; minion?: Minion } {
    if (id === 'H0' || id === 'H1') { const owner = Number(id[1]); return { owner, entity: this.players[owner], isHero: true }; }
    for (const p of this.players) { const m = p.board.find((x) => x.uid === id); if (m) return { owner: p.id, entity: m, isHero: false, minion: m }; }
    throw new Error(`No character ${id}`);
  }
  canPlay(player: number, uid: string): boolean {
    if (this.isOver || player !== this.current) return false;
    const p = this.players[player];
    const hc = p.hand.find((c) => c.uid === uid);
    return !!hc && getCard(hc.cardId).cost <= p.mana && p.board.length < RULES.BOARD_MAX;
  }
  playableCards(player: number): HandCard[] { return this.players[player].hand.filter((c) => this.canPlay(player, c.uid)); }
  canAttack(player: number, uid: string): boolean {
    if (this.isOver || player !== this.current) return false;
    const m = this.players[player].board.find((x) => x.uid === uid);
    return !!m && !m.sleeping && !m.attacked && m.atk > 0;
  }
  readyAttackers(player: number): Minion[] { return this.players[player].board.filter((m) => this.canAttack(player, m.uid)); }
  validTargets(player: number, uid: string): string[] {
    if (!this.canAttack(player, uid)) return [];
    const enemy = this.players[this.opponentOf(player)];
    const taunts = enemy.board.filter((m) => m.taunt);
    if (taunts.length) return taunts.map((m) => m.uid);
    return enemy.board.length ? enemy.board.map((m) => m.uid) : [heroId(enemy.id)];
  }
  hasAnyAction(player: number): boolean { return this.playableCards(player).length > 0 || this.readyAttackers(player).length > 0; }

  start(): Ev[] {
    const ev: Ev[] = [];
    const second = this.opponentOf(this.firstPlayer);
    for (let i = 0; i < RULES.START_HAND_FIRST; i++) this.draw(this.firstPlayer, ev);
    for (let i = 0; i < RULES.START_HAND_SECOND; i++) this.draw(second, ev);
    this.ensureOpeningCard(this.firstPlayer);
    this.ensureOpeningCard(second);
    this.startTurn(this.firstPlayer, ev);
    return ev;
  }
  private ensureOpeningCard(player: number): void {
    const p = this.players[player];
    if (p.hand.some((c) => getCard(c.cardId).cost <= RULES.START_MANA)) return;
    const i = p.deck.findIndex((id) => getCard(id).cost <= RULES.START_MANA);
    if (i < 0) throw new Error('Deck has no affordable opening card');
    const old = p.hand[0].cardId;
    p.hand[0].cardId = p.deck[i];
    p.deck[i] = old;
  }
  playCard(player: number, uid: string): Ev[] {
    if (!this.canPlay(player, uid)) throw new Error('Illegal play');
    const ev: Ev[] = [];
    const p = this.players[player];
    const [hc] = p.hand.splice(p.hand.findIndex((c) => c.uid === uid), 1);
    const card = getCard(hc.cardId);
    p.mana -= card.cost;
    const m: Minion = { uid: hc.uid, cardId: card.id, atk: card.atk, hp: card.hp, maxHp: card.hp, taunt: !!card.taunt, charge: !!card.charge, sleeping: !card.charge, attacked: false };
    p.board.push(m);
    ev.push({ type: 'play', player, uid, cardId: card.id });
    if (card.battlecry) this.battlecry(player, m, card.battlecry.effect, card.battlecry.amount, ev);
    this.resolveDeaths(ev);
    return ev;
  }
  attack(player: number, attackerUid: string, targetId: string): Ev[] {
    if (!this.validTargets(player, attackerUid).includes(targetId)) throw new Error('Illegal attack');
    const ev: Ev[] = [];
    const a = this.findCharacter(attackerUid).minion!;
    const t = this.findCharacter(targetId);
    a.attacked = true;
    ev.push({ type: 'attack', attacker: attackerUid, target: targetId });
    const counter = t.isHero ? 0 : t.minion!.atk;
    this.damage(targetId, a.atk, ev);
    if (counter > 0) this.damage(attackerUid, counter, ev);
    this.resolveDeaths(ev);
    return ev;
  }
  endTurn(player: number): Ev[] {
    if (this.isOver || player !== this.current) throw new Error('Not your turn');
    const ev: Ev[] = [{ type: 'turnEnd', player }];
    const board = this.players[player].board;
    for (const s of board) {
      const c = getCard(s.cardId);
      if (c.endOfTurn?.effect !== 'endTurnBuffOthersAtk') continue;
      ev.push({ type: 'ability', source: s.uid, cardId: s.cardId, player });
      for (const m of board) if (m !== s) { m.atk += c.endOfTurn.amount; ev.push({ type: 'buff', target: m.uid, atk: m.atk }); }
    }
    this.resolveDeaths(ev);
    if (!this.isOver) this.startTurn(this.opponentOf(player), ev);
    return ev;
  }

  private startTurn(player: number, ev: Ev[]): void {
    this.current = player;
    this.turn++;
    const p = this.players[player];
    p.maxMana = Math.min(RULES.MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    for (const m of p.board) { m.sleeping = false; m.attacked = false; }
    ev.push({ type: 'turnStart', player, turn: this.turn });
    this.draw(player, ev);
    this.resolveDeaths(ev);
  }
  draw(player: number, ev: Ev[]): void {
    const p = this.players[player];
    if (!p.deck.length) { p.fatigue++; ev.push({ type: 'fatigue', player, amount: p.fatigue }); this.damage(heroId(player), p.fatigue, ev); return; }
    const cardId = p.deck.pop()!;
    if (p.hand.length >= RULES.HAND_MAX) { ev.push({ type: 'burn', player, cardId }); return; }
    p.hand.push({ uid: `c${this.nextUid++}`, cardId });
    ev.push({ type: 'draw', player, cardId });
  }
  damage(id: string, amount: number, ev: Ev[]): void {
    const e = this.findCharacter(id).entity;
    e.hp -= amount;
    ev.push({ type: 'damage', target: id, amount, hp: e.hp });
  }
  heal(id: string, amount: number, ev: Ev[]): void {
    const e = this.findCharacter(id).entity;
    const h = Math.min(amount, e.maxHp - e.hp);
    e.hp += h;
    ev.push({ type: 'heal', target: id, amount: h, hp: e.hp });
  }
  private battlecry(player: number, m: Minion, effect: string, amount: number, ev: Ev[]): void {
    const enemy = this.opponentOf(player);
    ev.push({ type: 'ability', source: m.uid, cardId: m.cardId, player });
    if (effect === 'healOwnHero') this.heal(heroId(player), amount, ev);
    else if (effect === 'draw') for (let i = 0; i < amount; i++) this.draw(player, ev);
    else if (effect === 'damageEnemyHero') this.damage(heroId(enemy), amount, ev);
    else if (effect === 'damageAllEnemies') { for (const x of [...this.players[enemy].board]) this.damage(x.uid, amount, ev); this.damage(heroId(enemy), amount, ev); }
  }
  private resolveDeaths(ev: Ev[]): void {
    for (const p of this.players) {
      const dead = p.board.filter((m) => m.hp <= 0);
      p.board = p.board.filter((m) => m.hp > 0);
      for (const m of dead) ev.push({ type: 'death', target: m.uid, owner: p.id });
    }
    if (this.isOver) return;
    const lost = this.players.filter((p) => p.hp <= 0).map((p) => p.id);
    if (!lost.length) return;
    this.winner = lost.length === 2 ? 'draw' : this.opponentOf(lost[0]);
    ev.push({ type: 'gameOver', winner: this.winner });
  }
}

// ── CPU (ported) ──
export function minionValue(m: Minion): number {
  let v = m.atk * 2 + m.hp;
  if (m.taunt) v += 2;
  if (getCard(m.cardId).endOfTurn) v += 4;
  return v;
}
function tradeScore(a: Minion, d: Minion): number {
  const kills = a.atk >= d.hp, survives = d.atk < a.hp;
  if (!kills) return d.taunt ? 0 : -Infinity;
  if (survives) return minionValue(d) + 10;
  const gain = minionValue(d) - minionValue(a);
  return gain >= 0 ? gain + 2 : -Infinity;
}
export type Action = { type: 'play'; uid: string } | { type: 'attack'; attacker: string; target: string } | { type: 'end' };
export function chooseAction(b: Battle, player: number): Action {
  const playable = b.playableCards(player);
  if (playable.length) {
    const val = (c: HandCard): number => { const k = getCard(c.cardId); return k.cost * 10 + (k.battlecry ? 1 : 0); };
    const best = playable.reduce((x, y) => (val(y) > val(x) ? y : x));
    return { type: 'play', uid: best.uid };
  }
  const attackers = [...b.readyAttackers(player)].sort((x, y) => y.atk - x.atk);
  const enemyHero = heroId(b.opponentOf(player));
  const enemy = b.players[b.opponentOf(player)];
  const lethal = enemy.board.length === 0 && attackers.reduce((s, m) => s + m.atk, 0) >= enemy.hp;
  for (const a of attackers) {
    const targets = b.validTargets(player, a.uid);
    if (lethal && targets.includes(enemyHero)) return { type: 'attack', attacker: a.uid, target: enemyHero };
    let best: string | null = null, bestScore = -Infinity;
    for (const id of targets) {
      if (id === enemyHero) continue;
      const s = tradeScore(a, b.findCharacter(id).minion!);
      if (s > bestScore) { best = id; bestScore = s; }
    }
    const mustTaunt = !targets.includes(enemyHero);
    if (best && (bestScore > -Infinity || mustTaunt)) return { type: 'attack', attacker: a.uid, target: best };
    if (targets.includes(enemyHero)) return { type: 'attack', attacker: a.uid, target: enemyHero };
  }
  return { type: 'end' };
}
export function applyAction(b: Battle, player: number, a: Action): Ev[] {
  if (a.type === 'play') return b.playCard(player, a.uid);
  if (a.type === 'attack') return b.attack(player, a.attacker, a.target);
  return b.endTurn(player);
}
