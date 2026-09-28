// The eight playable characters. Whoever is not chosen as the hero becomes a boss.
// `weakTo` is the key of the character whose weapon deals weakness damage to this one
// (an 8-step rock-paper-scissors loop, Mega Man style).

export const CHARACTERS = [
  {
    key: 'whale',
    name: '汐音',
    title: '鯨魚女僕',
    stage: '鯨歌海底神殿',
    weakTo: 'penguin',
    gimmick: 'water',
    palette: { sky: 0x0b2a4a, sky2: 0x14568a, ground: 0x1d4f7a, top: 0x5fc6e8, accent: 0x9ee7ff, detail: 0x0e3656 },
    weapon: { name: '泡泡水柱', color: 0x6fd6ff, cost: 1, desc: '緩緩漂浮前進的水泡，會輕輕上下擺動。' },
  },
  {
    key: 'penguin',
    name: '小冰',
    title: '企鵝少女',
    stage: '冰原企鵝基地',
    weakTo: 'calico',
    gimmick: 'ice',
    palette: { sky: 0x2a3f66, sky2: 0x8fb5dd, ground: 0x6f8fb8, top: 0xe8f6ff, accent: 0xbfe9ff, detail: 0x4b6a93 },
    weapon: { name: '冰晶飛鏢', color: 0xbff4ff, cost: 1, desc: '高速貫穿敵人的冰晶。' },
  },
  {
    key: 'glasses',
    name: '光哉',
    title: '眼鏡學長',
    stage: '光學研究所',
    weakTo: 'sailor',
    gimmick: 'lab',
    palette: { sky: 0x1b1f2b, sky2: 0x3b4458, ground: 0x6d6552, top: 0xd9c9a0, accent: 0xffe27a, detail: 0x4a4436 },
    weapon: { name: '反射光彈', color: 0xffe27a, cost: 1, desc: '碰到牆壁與地面就會反彈的光球。' },
  },
  {
    key: 'tshirt',
    name: '阿翔',
    title: 'T恤少年',
    stage: '霓虹街區',
    weakTo: 'library',
    gimmick: 'city',
    palette: { sky: 0x1a1030, sky2: 0x3d2a6b, ground: 0x4a4f5c, top: 0x9aa3b5, accent: 0xff5fa8, detail: 0x2c3039 },
    weapon: { name: '連射飛彈', color: 0xffffff, cost: 0.5, desc: '射速極快的小型飛彈，可同時發射較多。' },
  },
  {
    key: 'calico',
    name: '小花',
    title: '夾克三花貓',
    stage: '廢棄工廠',
    weakTo: 'glasses',
    gimmick: 'factory',
    palette: { sky: 0x1a1210, sky2: 0x5a3420, ground: 0x4d3a2e, top: 0xd49a5a, accent: 0xffb347, detail: 0x2e221b },
    weapon: { name: '貓爪衝擊波', color: 0xffb347, cost: 2, desc: '沿著地面奔馳的巨大爪痕。' },
  },
  {
    key: 'library',
    name: '書白',
    title: '圖書館貓',
    stage: '無盡圖書館',
    weakTo: 'redcat',
    gimmick: 'library',
    palette: { sky: 0x2b1d14, sky2: 0x6b4a2b, ground: 0x5b3a22, top: 0xc58b4e, accent: 0xf2e2b6, detail: 0x3a2515 },
    weapon: { name: '迴旋書本', color: 0xf2e2b6, cost: 1, desc: '飛出後會折返的厚重書本，可貫穿。' },
  },
  {
    key: 'redcat',
    name: '緋音',
    title: '紅髮貓耳少女',
    stage: '熔岩火山',
    weakTo: 'whale',
    gimmick: 'lava',
    palette: { sky: 0x2a0a0a, sky2: 0x7a1f12, ground: 0x3a1f1f, top: 0xff6a2a, accent: 0xffc04a, detail: 0x241212 },
    weapon: { name: '火焰三連', color: 0xff7a3a, cost: 2, desc: '同時向前方射出三道火焰。' },
  },
  {
    key: 'sailor',
    name: '澪',
    title: '水手服少女',
    stage: '暴風港灣',
    weakTo: 'tshirt',
    gimmick: 'wind',
    palette: { sky: 0x2d4b73, sky2: 0x9cc3e6, ground: 0x3e5b7a, top: 0xdfeefa, accent: 0xa8e0ff, detail: 0x2a4059 },
    weapon: { name: '旋風', color: 0xc8f0ff, cost: 2, desc: '斜向上升的旋風，可貫穿多個敵人。' },
  },
];

export const BUSTER = { key: 'buster', name: '基本射擊', color: 0xfff3a0 };

export const FINAL_STAGE = {
  key: 'final',
  stage: '最終要塞',
  title: '連續頭目戰',
  palette: { sky: 0x0a0a14, sky2: 0x2a1840, ground: 0x2f2f3f, top: 0xb28bff, accent: 0xff5fd2, detail: 0x1c1c28 },
  gimmick: 'fortress',
};

export function getCharacter(key) {
  return CHARACTERS.find((c) => c.key === key);
}

export function bossesFor(heroKey) {
  return CHARACTERS.filter((c) => c.key !== heroKey);
}

/** Weapon that deals weakness damage to `bossKey`, or 'charge' if that weapon belongs to the hero. */
export function weaknessFor(bossKey, heroKey) {
  const weak = getCharacter(bossKey).weakTo;
  return weak === heroKey ? 'charge' : weak;
}
