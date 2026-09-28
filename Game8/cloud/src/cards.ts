// Card definitions (ported from the local Game8) — pure data.
export type Effect = 'healOwnHero' | 'draw' | 'damageEnemyHero' | 'damageAllEnemies' | 'endTurnBuffOthersAtk';
export interface Card {
  id: string; name: string; cost: number; atk: number; hp: number; text: string;
  taunt?: boolean; charge?: boolean;
  battlecry?: { effect: Effect; amount: number };
  endOfTurn?: { effect: Effect; amount: number };
  art: string; color: string;
}
const C = 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/';
export const CARDS: Card[] = [
  { id: 'whale', name: '鯨歌女僕 汐音', cost: 4, atk: 3, hp: 5, text: '登場：回復己方英雄 4 點生命', battlecry: { effect: 'healOwnHero', amount: 4 }, art: C + 'cast-a/cast-a-1-42cf43b8cb.png', color: '#4f8dff' },
  { id: 'penguin', name: '企鵝少女 小冰', cost: 2, atk: 1, hp: 4, text: '嘲諷', taunt: true, art: C + 'cast-a/cast-a-2-4212161a03.png', color: '#9adfff' },
  { id: 'glasses', name: '眼鏡學長 光哉', cost: 3, atk: 2, hp: 3, text: '登場：抽 1 張牌', battlecry: { effect: 'draw', amount: 1 }, art: C + 'cast-b/cast-b-1-1ae4cc393e.png', color: '#d8b98a' },
  { id: 'tshirt', name: '陽光少年 阿翔', cost: 1, atk: 2, hp: 1, text: '衝鋒', charge: true, art: C + 'cast-b/cast-b-2-fa52e60eb6.png', color: '#b0b0b0' },
  { id: 'calico', name: '街頭三花貓 小花', cost: 5, atk: 4, hp: 4, text: '衝鋒', charge: true, art: C + 'cast-c/cast-c-1-9a84c2e477.png', color: '#f0a24a' },
  { id: 'whitecat', name: '書房白貓 書白', cost: 6, atk: 4, hp: 7, text: '回合結束時：其他友方角色 +1 攻擊', endOfTurn: { effect: 'endTurnBuffOthersAtk', amount: 1 }, art: C + 'cast-c/cast-c-2-4f3b04f575.png', color: '#f4efe6' },
  { id: 'redcat', name: '赤焰貓耳 緋音', cost: 3, atk: 3, hp: 2, text: '登場：對敵方英雄造成 2 點傷害', battlecry: { effect: 'damageEnemyHero', amount: 2 }, art: C + 'cast-d/cast-d-1-a87eb32b86.png', color: '#e8413c' },
  { id: 'sailor', name: '水手服少女 澪', cost: 7, atk: 6, hp: 6, text: '登場：對所有敵方角色造成 1 點傷害', battlecry: { effect: 'damageAllEnemies', amount: 1 }, art: C + 'cast-d/cast-d-2-4e1a43adf1.png', color: '#7fb3e6' },
];
const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export function getCard(id: string): Card { const c = BY_ID.get(id); if (!c) throw new Error(`Unknown card ${id}`); return c; }
