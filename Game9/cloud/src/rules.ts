// Cast, board and economy rules — pure data + functions (verify.ts imports this; no engine imports).
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CAST_URLS: Record<string, string> = {
  whale: C + 'cast-a/cast-a-1-42cf43b8cb.png', penguin: C + 'cast-a/cast-a-2-4212161a03.png',
  glasses: C + 'cast-b/cast-b-1-1ae4cc393e.png', tshirt: C + 'cast-b/cast-b-2-fa52e60eb6.png',
  calico: C + 'cast-c/cast-c-1-9a84c2e477.png', whitecat: C + 'cast-c/cast-c-2-4f3b04f575.png',
  redcat: C + 'cast-d/cast-d-1-a87eb32b86.png', sailor: C + 'cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/P9PoxCYxWb4/';
export const ART = {
  logo: A + 'art/art/logo-d81bfdfc45.png',
  house: A + 'art/buildings/buildings-1-61e729aec2.png',
  hotel: A + 'art/buildings/buildings-2-9016b90210.png',
  music: A + 'music/a-cute-festive-board-game-like-monopoly-1a685bfc483e.mp3',
};

export type PerkId = 'start' | 'tax' | 'land' | 'build' | 'luck' | 'discount' | 'toll' | 'rich';
export interface Hero { id: string; name: string; title: string; color: string; perk: PerkId; perkText: string; }
export const HEROES: Hero[] = [
  { id: 'whale', name: '汐音', title: '鯨魚女僕', color: '#4f8dff', perk: 'start', perkText: '經過起點多領 $100' },
  { id: 'penguin', name: '小冰', title: '企鵝少女', color: '#9adfff', perk: 'tax', perkText: '繳稅與罰款減半' },
  { id: 'glasses', name: '光哉', title: '眼鏡學長', color: '#d8b98a', perk: 'land', perkText: '購買土地打 9 折' },
  { id: 'tshirt', name: '阿翔', title: 'T恤少年', color: '#b0b0b0', perk: 'build', perkText: '蓋房子打 8 折' },
  { id: 'calico', name: '小花', title: '夾克三花貓', color: '#f0a24a', perk: 'luck', perkText: '機會卡的獎金加倍' },
  { id: 'whitecat', name: '書白', title: '圖書館貓', color: '#f4efe6', perk: 'discount', perkText: '過路費只付 8 成' },
  { id: 'redcat', name: '緋音', title: '紅髮貓耳少女', color: '#e8413c', perk: 'toll', perkText: '收過路費多收 2 成' },
  { id: 'sailor', name: '澪', title: '水手服少女', color: '#7fb3e6', perk: 'rich', perkText: '起始資金多 $300' },
];
export const PLAYER_COLORS = ['#39c6ff', '#ff6fa8', '#7ee05a', '#ffc83a'];

export const START_CASH = 1500;
export const PASS_START = 200;
export const MAX_ROUNDS = 20;
export const MAX_LEVEL = 3;
export const TAX = 150;
export const RENT_MULT = [1, 4, 9, 16];
export const BOARD_SIZE = 28;
export const REST_TILE = 7;

export type Kind = 'start' | 'prop' | 'chance' | 'tax' | 'rest' | 'jail' | 'pot';
export interface Tile { i: number; kind: Kind; name: string; group: number; price: number; owner: number; level: number; }
export const GROUPS = [
  { name: '海灣區', color: '#35b6e8' }, { name: '櫻花區', color: '#ff8fbf' }, { name: '學園區', color: '#9b7bff' },
  { name: '山城區', color: '#52c77a' }, { name: '星河區', color: '#ffb43a' }, { name: '皇冠區', color: '#ff5a5a' },
];
const STREETS = [['貝殼路', '燈塔街', '珊瑚港'], ['櫻花道', '花見坂', '和菓子街'], ['學園路', '書店街', '圖書館'], ['松林道', '溫泉鄉', '雲海台'], ['天文台', '流星街', '銀河站'], ['城堡路', '王冠廣場', '萌友塔']];
const SPECIAL: Record<number, [Kind, string]> = {
  0: ['start', '起點'], 3: ['chance', '機會'], 7: ['rest', '露營區'], 10: ['chance', '命運'], 12: ['tax', '所得稅'],
  14: ['pot', '幸運池'], 17: ['chance', '機會'], 21: ['jail', '前往警局'], 24: ['chance', '命運'], 26: ['tax', '奢侈稅'],
};

export function makeBoard(): Tile[] {
  const b: Tile[] = [];
  let n = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const s = SPECIAL[i];
    if (s) { b.push({ i, kind: s[0], name: s[1], group: -1, price: 0, owner: -1, level: 0 }); continue; }
    const g = Math.floor(n / 3), k = n % 3;
    n++;
    b.push({ i, kind: 'prop', name: STREETS[g][k], group: g, price: 100 + g * 50 + k * 20, owner: -1, level: 0 });
  }
  return b;
}

const r10 = (v: number): number => Math.round(v / 10) * 10;
const r5 = (v: number): number => Math.round(v / 5) * 5;
export function landCost(t: Tile, perk?: PerkId): number { return perk === 'land' ? r10(t.price * 0.9) : t.price; }
export function upgradeCost(t: Tile, perk?: PerkId): number { const c = r10(t.price * 0.5); return perk === 'build' ? r10(c * 0.8) : c; }
export function tileValue(t: Tile): number { return t.owner < 0 ? 0 : t.price + t.level * upgradeCost(t); }
export function ownsGroup(board: Tile[], owner: number, group: number): boolean { return board.filter((t) => t.group === group).every((t) => t.owner === owner); }
export function baseRent(t: Tile): number { return r5(t.price * 0.1); }
export function rentOf(t: Tile, board: Tile[]): number {
  if (t.kind !== 'prop' || t.owner < 0) return 0;
  const r = baseRent(t) * RENT_MULT[t.level];
  return t.level === 0 && ownsGroup(board, t.owner, t.group) ? r * 2 : r;
}

export interface Player { id: number; hero: Hero; name: string; cash: number; pos: number; skip: number; alive: boolean; ai: boolean; color: string; }

/** You + three random rivals. */
export function createPlayers(heroId: string, rnd: () => number = Math.random): Player[] {
  const me = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  const rivals = HEROES.filter((h) => h !== me).map((h) => ({ h, k: rnd() })).sort((a, b) => a.k - b.k).slice(0, 3).map((x) => x.h);
  return [me, ...rivals].map((hero, id) => ({
    id, hero, name: hero.name, cash: START_CASH + (hero.perk === 'rich' ? 300 : 0), pos: 0, skip: 0, alive: true, ai: id !== 0, color: PLAYER_COLORS[id],
  }));
}

export function passBonus(p: Player): number { return PASS_START + (p.hero.perk === 'start' ? 100 : 0); }
/** Move one space; returns true when this hop lands on (passes) the start. */
export function hop(p: Player, dir: number): boolean {
  p.pos = (p.pos + dir + BOARD_SIZE) % BOARD_SIZE;
  if (dir > 0 && p.pos === 0) { p.cash += passBonus(p); return true; }
  return false;
}
export function advance(p: Player, steps: number): boolean {
  let passed = false;
  for (let i = 0; i < steps; i++) passed = hop(p, 1) || passed;
  return passed;
}

export function worth(p: Player, board: Tile[]): number {
  return p.cash + board.filter((t) => t.owner === p.id).reduce((n, t) => n + tileValue(t), 0);
}

export function buy(p: Player, t: Tile): boolean {
  const cost = landCost(t, p.hero.perk);
  if (t.kind !== 'prop' || t.owner !== -1 || p.cash < cost) return false;
  p.cash -= cost; t.owner = p.id;
  return true;
}
export function upgrade(p: Player, t: Tile): boolean {
  const cost = upgradeCost(t, p.hero.perk);
  if (t.owner !== p.id || t.level >= MAX_LEVEL || p.cash < cost) return false;
  p.cash -= cost; t.level++;
  return true;
}

export interface Charge { paid: number; sold: string[]; bankrupt: boolean; }
/** Take money; sells the cheapest deeds at 60% value if short; bankrupt (deeds released) if still short. */
export function charge(p: Player, amount: number, board: Tile[]): Charge {
  p.cash -= amount;
  const sold: string[] = [];
  while (p.cash < 0) {
    const own = board.filter((t) => t.owner === p.id).sort((a, b) => tileValue(a) - tileValue(b));
    if (!own.length) break;
    const t = own[0];
    p.cash += Math.floor(tileValue(t) * 0.6);
    t.owner = -1; t.level = 0;
    sold.push(t.name);
  }
  let paid = amount;
  if (p.cash < 0) {
    paid = amount + p.cash;
    p.cash = 0; p.alive = false;
    for (const t of board) if (t.owner === p.id) { t.owner = -1; t.level = 0; }
  }
  return { paid, sold, bankrupt: !p.alive };
}

export function tollFor(payer: Player, owner: Player, t: Tile, board: Tile[]): number {
  let amt = rentOf(t, board);
  if (owner.hero.perk === 'toll') amt *= 1.2;
  if (payer.hero.perk === 'discount') amt *= 0.8;
  return r5(amt);
}
export function payRent(payer: Player, owner: Player, t: Tile, board: Tile[]): Charge & { amount: number } {
  const amount = tollFor(payer, owner, t, board);
  const c = charge(payer, amount, board);
  owner.cash += c.paid;
  return { ...c, amount };
}
export function taxFor(p: Player): number { return p.hero.perk === 'tax' ? TAX / 2 : TAX; }

export type Card =
  | { text: string; kind: 'cash'; amount: number }
  | { text: string; kind: 'move'; steps: number }
  | { text: string; kind: 'toStart' }
  | { text: string; kind: 'collect'; amount: number }
  | { text: string; kind: 'repair'; per: number }
  | { text: string; kind: 'jail' }
  | { text: string; kind: 'freeBuild' };
export const CARDS: Card[] = [
  { text: '商店街抽獎中了頭獎！獲得 $200', kind: 'cash', amount: 200 },
  { text: '幫學長搬書，收到謝禮 $100', kind: 'cash', amount: 100 },
  { text: '不小心打翻咖啡，賠償 $80', kind: 'cash', amount: -80 },
  { text: '帶貓咪看醫生，花了 $120', kind: 'cash', amount: -120 },
  { text: '搭上順風車，前進 3 格', kind: 'move', steps: 3 },
  { text: '忘了帶錢包，後退 2 格', kind: 'move', steps: -2 },
  { text: '傳送魔法！直接回到起點領獎金', kind: 'toStart' },
  { text: '今天是你的生日！每位玩家送你 $50', kind: 'collect', amount: 50 },
  { text: '颱風過境，每棟房子修繕費 $40', kind: 'repair', per: 40 },
  { text: '闖紅燈被抓到，直接前往警局', kind: 'jail' },
  { text: '工程隊大放送：免費幫你加蓋一棟房子', kind: 'freeBuild' },
];
/** A cash card's value for this player (the luck perk doubles windfalls, the tax perk halves fines). */
export function cardCash(amount: number, p: Player): number {
  if (amount > 0 && p.hero.perk === 'luck') return amount * 2;
  if (amount < 0 && p.hero.perk === 'tax') return amount / 2;
  return amount;
}

// ── AI ──
export function completesGroup(board: Tile[], p: Player, t: Tile): boolean {
  return board.filter((x) => x.group === t.group && x !== t).every((x) => x.owner === p.id);
}
export function aiWantsBuy(p: Player, t: Tile, board: Tile[]): boolean {
  const reserve = completesGroup(board, p, t) ? 40 : 180;
  return p.cash - landCost(t, p.hero.perk) >= reserve;
}
export function aiWantsUpgrade(p: Player, t: Tile): boolean { return p.cash - upgradeCost(t, p.hero.perk) >= 260; }

/** Final standings: survivors first, then by net worth. */
export function ranking(ps: Player[], board: Tile[]): Player[] {
  return [...ps].sort((a, b) => Number(b.alive) - Number(a.alive) || worth(b, board) - worth(a, board));
}

/** Board grid position (8×8 ring, clockwise from the top-left corner). */
export function gridOf(i: number): { gx: number; gy: number } {
  if (i <= 7) return { gx: i, gy: 0 };
  if (i <= 14) return { gx: 7, gy: i - 7 };
  if (i <= 21) return { gx: 21 - i, gy: 7 };
  return { gx: 0, gy: 28 - i };
}
