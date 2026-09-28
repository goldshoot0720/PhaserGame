/**
 * 角色資料：數值 1~10。
 * speed 極速 / accel 加速 / handling 操控 / drift 甩尾（集氣速度）
 */
export const CHARACTERS = [
  {
    id: 'whale',
    name: '藍鯨小汐',
    title: '海洋女僕',
    desc: '鯨魚尾巴的女僕，甩尾像鯨魚擺尾一樣優雅。',
    color: 0x2346c8,
    accent: 0x8fe0ff,
    stats: { speed: 7, accel: 6, handling: 7, drift: 8 },
  },
  {
    id: 'penguin',
    name: '企鵝小圓',
    title: '冰原衝刺王',
    desc: '穿著企鵝帽T的元氣少女，起步爆快！',
    color: 0x222428,
    accent: 0xffc629,
    stats: { speed: 5, accel: 9, handling: 8, drift: 6 },
  },
  {
    id: 'glasses',
    name: '眼鏡學長阿哲',
    title: '冷靜戰術家',
    desc: '計算好每個彎道的甩尾角度，集氣效率一流。',
    color: 0xcdb48a,
    accent: 0x3a5f8f,
    stats: { speed: 8, accel: 5, handling: 7, drift: 8 },
  },
  {
    id: 'boy',
    name: '陽光少年小翔',
    title: '全能新人',
    desc: '什麼都平均，什麼都不怕，最適合新手。',
    color: 0x8a8f96,
    accent: 0x2f6fd6,
    stats: { speed: 7, accel: 7, handling: 7, drift: 7 },
  },
  {
    id: 'calico',
    name: '三花喵老大',
    title: '街頭飆速貓',
    desc: '穿飛行外套的三花貓，直線極速最強。',
    color: 0xf08a24,
    accent: 0x1a1a1a,
    stats: { speed: 9, accel: 6, handling: 5, drift: 8 },
  },
  {
    id: 'snow',
    name: '雪球喵',
    title: '圖書館怪盜',
    desc: '背著書包的白貓，過彎穩如泰山。',
    color: 0xf2efe6,
    accent: 0x5b5f66,
    stats: { speed: 6, accel: 7, handling: 9, drift: 6 },
  },
  {
    id: 'redcat',
    name: '紅焰貓娘莉莉',
    title: '烈焰甜心',
    desc: '紅髮貓耳少女，加速與極速兼具。',
    color: 0xd62828,
    accent: 0x1b1b1b,
    stats: { speed: 8, accel: 8, handling: 5, drift: 7 },
  },
  {
    id: 'sailor',
    name: '水手服千夏',
    title: '優等生',
    desc: '水手服少女，操控與甩尾都很細膩。',
    color: 0x9fd3f2,
    accent: 0x1f2d5c,
    stats: { speed: 6, accel: 6, handling: 8, drift: 8 },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

/** 把 1~10 的數值轉成物理參數 */
export function physicsFromStats(stats) {
  return {
    maxSpeed: 505 + stats.speed * 10, // px/s
    accel: 250 + stats.accel * 30, // px/s^2
    turnRate: 2.35 + stats.handling * 0.13, // rad/s
    grip: 7.5 + stats.handling * 0.35,
    driftCharge: 14 + stats.drift * 2.3, // 每秒集氣量（滿 100）
    driftTurn: 1.35 + stats.drift * 0.03,
  };
}
