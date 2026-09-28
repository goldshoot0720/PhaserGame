// Card definitions — pure data, shared by the rules engine, the AI and the UI.

export const KEYWORDS = {
  TAUNT: 'taunt',
  CHARGE: 'charge',
};

export const EFFECTS = {
  HEAL_OWN_HERO: 'healOwnHero',
  DRAW: 'draw',
  DAMAGE_ENEMY_HERO: 'damageEnemyHero',
  DAMAGE_ALL_ENEMIES: 'damageAllEnemies',
  END_TURN_BUFF_OTHERS_ATK: 'endTurnBuffOthersAtk',
};

export const CARDS = [
  {
    id: 'luna', name: '鯨歌女僕 露娜', cost: 4, atk: 3, hp: 5,
    text: '登場：回復己方英雄 4 點生命',
    battlecry: { effect: EFFECTS.HEAL_OWN_HERO, amount: 4 },
  },
  {
    id: 'penguin', name: '企鵝少女 小企', cost: 2, atk: 1, hp: 4,
    text: '嘲諷', keywords: [KEYWORDS.TAUNT],
  },
  {
    id: 'zhe', name: '眼鏡上班族 阿哲', cost: 3, atk: 2, hp: 3,
    text: '登場：抽 1 張牌',
    battlecry: { effect: EFFECTS.DRAW, amount: 1 },
  },
  {
    id: 'xiang', name: '陽光少年 小翔', cost: 1, atk: 2, hp: 1,
    text: '衝鋒', keywords: [KEYWORDS.CHARGE],
  },
  {
    id: 'calico', name: '街頭三花貓', cost: 5, atk: 4, hp: 4,
    text: '衝鋒', keywords: [KEYWORDS.CHARGE],
  },
  {
    id: 'whitecat', name: '書房白貓', cost: 6, atk: 4, hp: 7,
    text: '回合結束時：其他友方角色 +1 攻擊',
    endOfTurn: { effect: EFFECTS.END_TURN_BUFF_OTHERS_ATK, amount: 1 },
  },
  {
    id: 'xiaohong', name: '赤焰貓耳 小紅', cost: 3, atk: 3, hp: 2,
    text: '登場：對敵方英雄造成 2 點傷害',
    battlecry: { effect: EFFECTS.DAMAGE_ENEMY_HERO, amount: 2 },
  },
  {
    id: 'yukino', name: '水手服少女 雪乃', cost: 7, atk: 6, hp: 6,
    text: '登場：對所有敵方角色造成 1 點傷害',
    battlecry: { effect: EFFECTS.DAMAGE_ALL_ENEMIES, amount: 1 },
  },
];

const BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export function getCard(id) {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function hasKeyword(card, keyword) {
  return (card.keywords ?? []).includes(keyword);
}
