export const NAMES = ['小鯨', '企鵝妹', '眼鏡哥', '阿弟', '三花貓', '白貓', '紅貓娘', '水手服'];
export const KEYS = ['luna', 'penguin', 'xiang', 'zhe', 'calico', 'whitecat', 'xiaohong', 'yukino'];
export const PLAYER_COLORS = [0xffd36b, 0x80e8ed, 0xf38eb6, 0xbba3ff];
export const MAX_ROUNDS = 18;

const special = {
  0: ['start', '起點'], 4: ['chance', '機會'], 7: ['jail', '警局'],
  10: ['tax', '稅務'], 14: ['chance', '命運'], 17: ['bonus', '獎金'],
  20: ['tax', '稅務'], 24: ['chance', '機會'],
};
const districts = ['海灣', '山城', '櫻花', '星河'];
export const BOARD = Array.from({ length: 28 }, (_, i) => {
  if (special[i]) return { kind: special[i][0], name: special[i][1], owner: -1, price: 0, rent: 0 };
  const price = 100 + Math.floor(i / 7) * 70 + (i % 7) * 20;
  return { kind: 'property', name: `${districts[Math.floor(i / 7)]}${i % 7 + 1}街`, owner: -1, price, rent: Math.round(price * .26 / 10) * 10 };
});

export function createPlayers(chosen) {
  const others = Array.from({ length: 8 }, (_, i) => i).filter(i => i !== chosen);
  return [chosen, ...others.slice(0, 3)].map((character, id) => ({
    id, character, name: NAMES[character], cash: 1200, pos: 0, jailed: 0, alive: true,
  }));
}

export function worth(player, board) {
  return player.cash + board.filter(tile => tile.owner === player.id).reduce((sum, tile) => sum + tile.price, 0);
}

export function pay(player, amount, board) {
  player.cash -= amount;
  const sold = [];
  while (player.cash < 0) {
    const owned = board.filter(tile => tile.owner === player.id).sort((a, b) => b.price - a.price);
    if (!owned.length) break;
    const tile = owned[0];
    tile.owner = -1;
    player.cash += Math.floor(tile.price / 2);
    sold.push(tile.name);
  }
  if (player.cash < 0) player.alive = false;
  return sold;
}

export function buy(player, tile) {
  if (tile.kind !== 'property' || tile.owner !== -1 || player.cash < tile.price) return false;
  player.cash -= tile.price;
  tile.owner = player.id;
  return true;
}

export function advance(player, steps) {
  const total = player.pos + steps;
  player.pos = total % BOARD.length;
  if (total >= BOARD.length) player.cash += 200;
  return total >= BOARD.length;
}
