// 球員與球隊資料（純資料，無 Phaser 依賴）

// 能力數值 (1-100) → Power Pro 風格等級
export function grade(v) {
  if (v >= 90) return 'S';
  if (v >= 80) return 'A';
  if (v >= 70) return 'B';
  if (v >= 60) return 'C';
  if (v >= 50) return 'D';
  if (v >= 40) return 'E';
  if (v >= 20) return 'F';
  return 'G';
}

export const GRADE_COLORS = {
  S: '#ff4fa3', A: '#ff5a3c', B: '#ff9a1f', C: '#f2c500',
  D: '#8fd14f', E: '#3cc3a0', F: '#4a9be8', G: '#9a9a9a',
};

// 球種定義：速度倍率、在本壘板的位移方向 (x: 捕手視角右為正, y: 向上為正)、位移曲線指數（越大越晚變化）
export const PITCH_TYPES = {
  直球: { speed: 1.0, dx: 0, dy: 0.04, curve: 2, color: 0xffffff },
  滑球: { speed: 0.88, dx: 1, dy: -0.15, curve: 2.4, color: 0x4fc3ff },
  曲球: { speed: 0.78, dx: 0.7, dy: -0.8, curve: 1.8, color: 0x7dff6a },
  指叉: { speed: 0.86, dx: 0, dy: -1, curve: 3.2, color: 0xff6ad5 },
  伸卡: { speed: 0.92, dx: -0.8, dy: -0.45, curve: 2.4, color: 0xffb13d },
  變速: { speed: 0.8, dx: -0.15, dy: -0.45, curve: 2, color: 0xd6a4ff },
};

export const TEAMS = {
  whale: {
    id: 'whale',
    name: '藍鯨隊',
    short: '鯨',
    color: 0x2a6fdb,
    color2: 0x0d2f6e,
    css: '#2a6fdb',
    pitcher: 'c1',
    lineup: ['c2', 'c3', 'c4', 'c1'],
  },
  cat: {
    id: 'cat',
    name: '貓咪隊',
    short: '貓',
    color: 0xe0503a,
    color2: 0x6e1a10,
    css: '#e0503a',
    pitcher: 'c6',
    lineup: ['c7', 'c8', 'c5', 'c6'],
  },
};

// traj: 彈道 1-4；meet 巧打；power 力量；speed 跑速
export const PLAYERS = {
  c1: {
    id: 'c1', name: '鯨井 澪', pos: '投手', team: 'whale',
    desc: '藍鯨隊王牌，女僕裝下藏著強力指叉球。',
    traj: 2, meet: 55, power: 45, speed: 60,
    pitch: { velo: 146, control: 72, stamina: 66, pitches: { 滑球: 4, 指叉: 5, 伸卡: 2 } },
  },
  c2: {
    id: 'c2', name: '企鵝 小雪', pos: '中外野手', team: 'whale',
    desc: '企鵝裝的飛毛腿首棒，短打與盜壘名人。',
    traj: 1, meet: 82, power: 30, speed: 93,
  },
  c3: {
    id: 'c3', name: '眼鏡 哲也', pos: '一壘手', team: 'whale',
    desc: '冷靜分析配球的中距離打者。',
    traj: 3, meet: 75, power: 71, speed: 48,
  },
  c4: {
    id: 'c4', name: '日向 陽太', pos: '三壘手', team: 'whale',
    desc: '一棒轟出場外的熱血第四棒。',
    traj: 4, meet: 57, power: 92, speed: 62,
  },
  c5: {
    id: 'c5', name: '三毛 虎太郎', pos: '一壘手', team: 'cat',
    desc: '夜市出身的三花貓強打者，專砸好球。',
    traj: 4, meet: 64, power: 87, speed: 52,
  },
  c6: {
    id: 'c6', name: '白雪 墨丸', pos: '投手', team: 'cat',
    desc: '圖書館裡的軟投派，曲球與變速球軌跡刁鑽。',
    traj: 2, meet: 60, power: 42, speed: 45,
    pitch: { velo: 137, control: 85, stamina: 76, pitches: { 曲球: 5, 變速: 4, 伸卡: 3 } },
  },
  c7: {
    id: 'c7', name: '緋村 鈴', pos: '游擊手', team: 'cat',
    desc: '紅髮貓耳的安打製造機，腳程飛快。',
    traj: 2, meet: 91, power: 52, speed: 85,
  },
  c8: {
    id: 'c8', name: '水無月 雫', pos: '右外野手', team: 'cat',
    desc: '溫柔的水手服少女，關鍵時刻特別可靠。',
    traj: 3, meet: 76, power: 70, speed: 64,
  },
};

export function pitchList(pitcher) {
  return ['直球', ...Object.keys(pitcher.pitch.pitches)];
}
