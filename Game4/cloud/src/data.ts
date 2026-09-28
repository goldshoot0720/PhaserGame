// Characters, weapons, art and tuning — pure data (verify.ts imports it).
export const TILE = 32;
export const ROWS = 14;
export const VIEW_H = ROWS * TILE; // 448 — the world height
export const GRAVITY = 1150;

export const PLAYER = {
  h: 64, hitW: 20, hitH: 50, slideH: 24,
  run: 165, jump: 510, jumpCut: 160, coyote: 0.09,
  slideSpeed: 320, slideTime: 0.32, climb: 120,
  maxHp: 28, maxAmmo: 28, lives: 3,
  iframes: 1.3, knockback: 0.38,
  chargeStart: 0.26, chargeMid: 0.7, chargeFull: 1.4,
};

export const BOSS = { h: 104, hitW: 40, hitH: 92, maxHp: 28, rushHp: 14, iframes: 0.45, contact: 4, rushBossHp: 14 };

export const E_TANK = { max: 9, citadelGrant: 3 };
export const M_TANK = { max: 9, citadelGrant: 3 };
export function citadelTankGrant(eTanks: number, mTanks: number): { eTanks: number; mTanks: number } {
  return {
    eTanks: Math.min(E_TANK.max, eTanks + E_TANK.citadelGrant),
    mTanks: Math.min(M_TANK.max, mTanks + M_TANK.citadelGrant),
  };
}

export const FORTRESS_REWARDS = { heal: Math.ceil(PLAYER.maxHp * 0.6), lifeEvery: 3 };

export function fortressBossReward(hp: number, lives: number, defeated: number): { hp: number; lives: number; extraLife: boolean } {
  const extraLife = defeated > 0 && defeated % FORTRESS_REWARDS.lifeEvery === 0;
  return {
    hp: Math.min(PLAYER.maxHp, hp + FORTRESS_REWARDS.heal),
    lives: lives + (extraLife ? 1 : 0),
    extraLife,
  };
}

export type WeaponKind = 'buster' | 'bubble' | 'ice' | 'bounce' | 'rapid' | 'claw' | 'book' | 'fire3' | 'whirl';

export interface Palette { sky: string; sky2: string; ground: string; top: string; accent: string; detail: string; }
export interface Hero {
  key: string; name: string; title: string; stage: string; weakTo: string;
  palette: Palette;
  weapon: { name: string; kind: WeaponKind; color: string; cost: number; desc: string };
}

export const CHARACTERS: Hero[] = [
  { key: 'whale', name: '汐音', title: '鯨魚女僕', stage: '鯨歌海底神殿', weakTo: 'penguin',
    palette: { sky: '#0b2a4a', sky2: '#14568a', ground: '#1d4f7a', top: '#5fc6e8', accent: '#9ee7ff', detail: '#0e3656' },
    weapon: { name: '泡泡水柱', kind: 'bubble', color: '#6fd6ff', cost: 1, desc: '緩緩漂浮前進的水泡。' } },
  { key: 'penguin', name: '小冰', title: '企鵝少女', stage: '冰原企鵝基地', weakTo: 'calico',
    palette: { sky: '#2a3f66', sky2: '#8fb5dd', ground: '#6f8fb8', top: '#e8f6ff', accent: '#bfe9ff', detail: '#4b6a93' },
    weapon: { name: '冰晶飛鏢', kind: 'ice', color: '#bff4ff', cost: 1, desc: '高速貫穿敵人的冰晶。' } },
  { key: 'glasses', name: '光哉', title: '眼鏡學長', stage: '光學研究所', weakTo: 'sailor',
    palette: { sky: '#1b1f2b', sky2: '#3b4458', ground: '#6d6552', top: '#d9c9a0', accent: '#ffe27a', detail: '#4a4436' },
    weapon: { name: '反射光彈', kind: 'bounce', color: '#ffe27a', cost: 1, desc: '碰到牆壁與地面會反彈的光球。' } },
  { key: 'tshirt', name: '阿翔', title: 'T恤少年', stage: '霓虹街區', weakTo: 'glasses',
    palette: { sky: '#1a1030', sky2: '#3d2a6b', ground: '#4a4f5c', top: '#9aa3b5', accent: '#ff5fa8', detail: '#2c3039' },
    weapon: { name: '連射飛彈', kind: 'rapid', color: '#ffffff', cost: 0.5, desc: '射速極快的小型飛彈。' } },
  { key: 'calico', name: '小花', title: '夾克三花貓', stage: '廢棄工廠', weakTo: 'library',
    palette: { sky: '#1a1210', sky2: '#5a3420', ground: '#4d3a2e', top: '#d49a5a', accent: '#ffb347', detail: '#2e221b' },
    weapon: { name: '貓爪衝擊波', kind: 'claw', color: '#ffb347', cost: 2, desc: '沿著地面奔馳的巨大爪痕。' } },
  { key: 'library', name: '書白', title: '圖書館貓', stage: '無盡圖書館', weakTo: 'redcat',
    palette: { sky: '#2b1d14', sky2: '#6b4a2b', ground: '#5b3a22', top: '#c58b4e', accent: '#f2e2b6', detail: '#3a2515' },
    weapon: { name: '迴旋書本', kind: 'book', color: '#f2e2b6', cost: 1, desc: '飛出後會折返的厚重書本。' } },
  { key: 'redcat', name: '緋音', title: '紅髮貓耳少女', stage: '熔岩火山', weakTo: 'whale',
    palette: { sky: '#2a0a0a', sky2: '#7a1f12', ground: '#3a1f1f', top: '#ff6a2a', accent: '#ffc04a', detail: '#241212' },
    weapon: { name: '火焰三連', kind: 'fire3', color: '#ff7a3a', cost: 2, desc: '同時向前方射出三道火焰。' } },
  { key: 'sailor', name: '澪', title: '水手服少女', stage: '暴風港灣', weakTo: 'tshirt',
    palette: { sky: '#2d4b73', sky2: '#9cc3e6', ground: '#3e5b7a', top: '#dfeefa', accent: '#a8e0ff', detail: '#2a4059' },
    weapon: { name: '旋風', kind: 'whirl', color: '#c8f0ff', cost: 2, desc: '斜向上升的旋風。' } },
];

export const FINAL = {
  key: 'final', stage: '最終要塞', title: '連續頭目戰',
  palette: { sky: '#0a0a14', sky2: '#2a1840', ground: '#2f2f3f', top: '#b28bff', accent: '#ff5fd2', detail: '#1c1c28' } as Palette,
};

export const CITADEL = {
  key: 'citadel', stage: '要塞核心', title: '終焉守護者・三段變形',
  palette: { sky: '#090b20', sky2: '#2a1950', ground: '#292941', top: '#78dcef', accent: '#ffca68', detail: '#151529' } as Palette,
};

export const FINAL_BOSS_PHASES: { name: string; hp: number; weakTo: string; attackKind: WeaponKind; color: string }[] = [
  { name: '晶盾型態', hp: 28, weakTo: 'whale', attackKind: 'ice', color: '#66dfff' },
  { name: '翼刃型態', hp: 32, weakTo: 'penguin', attackKind: 'bounce', color: '#ffcb62' },
  { name: '熾核型態', hp: 36, weakTo: 'redcat', attackKind: 'fire3', color: '#ff6b64' },
];

export function finalBossDamage(phase: number, weaponKey: string, chargeLevel: number): number {
  const form = FINAL_BOSS_PHASES[phase - 1];
  if (!form) throw new Error(`Unknown final boss phase: ${phase}`);
  if (weaponKey === form.weakTo) return 4;
  if (weaponKey === 'buster') return chargeLevel >= 2 ? 3 : chargeLevel === 1 ? 2 : 1;
  return 1;
}

export const BUSTER = { name: '基本射擊', kind: 'buster' as WeaponKind, color: '#fff3a0', cost: 0 };

export function getHero(key: string): Hero {
  return CHARACTERS.find((c) => c.key === key) ?? CHARACTERS[0];
}
export function bossesFor(heroKey: string): Hero[] {
  return CHARACTERS.filter((c) => c.key !== heroKey);
}
/** Weapon key that deals weakness damage to `bossKey`, or 'charge' when that weapon is the hero's own. */
export function weaknessFor(bossKey: string, heroKey: string): string {
  const weak = getHero(bossKey).weakTo;
  return weak === heroKey ? 'charge' : weak;
}
/** Damage a player shot deals to a boss. */
export function bossDamage(bossKey: string, heroKey: string, weaponKey: string, chargeLevel: number): number {
  const weak = weaknessFor(bossKey, heroKey);
  if (weaponKey === 'buster') {
    if (weak === 'charge' && chargeLevel >= 2) return 4;
    return chargeLevel >= 2 ? 3 : chargeLevel === 1 ? 2 : 1;
  }
  return weaponKey === weak ? 4 : 1;
}

// ── art ──
export const CAST_URLS: Record<string, string> = {
  whale: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-a/cast-a-1-42cf43b8cb.png',
  penguin: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-a/cast-a-2-4212161a03.png',
  glasses: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-b/cast-b-1-1ae4cc393e.png',
  tshirt: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-b/cast-b-2-fa52e60eb6.png',
  calico: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-c/cast-c-1-9a84c2e477.png',
  library: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-c/cast-c-2-4f3b04f575.png',
  redcat: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-d/cast-d-1-a87eb32b86.png',
  sailor: 'https://gameblocks.nyc3.digitaloceanspaces.com/9rwJkwrCkfc/art/cast-d/cast-d-2-4e1a43adf1.png',
};
const A = 'https://gameblocks.nyc3.digitaloceanspaces.com/78wQyqoVoGi/';
export const BG_URLS: Record<string, string> = {
  whale: A + 'art/bg-whale/bg-f4509df7a6.png',
  penguin: A + 'art/bg-penguin/bg-2f0873aa4d.png',
  glasses: A + 'art/bg-glasses/bg-3f324b7735.png',
  tshirt: A + 'art/bg-tshirt/bg-e89a9601b4.png',
  calico: A + 'art/bg-calico/bg-56c71df462.png',
  library: A + 'art/bg-library/bg-f938fe3c1a.png',
  redcat: A + 'art/bg-redcat/bg-c8b075799a.png',
  sailor: A + 'art/bg-sailor/bg-1f97f8f99f.png',
  final: A + 'art/bg-final/bg-16fbbf15c0.png',
  citadel: A + 'art/core-citadel/bg-f662e3014b.png',
};
export const ART = {
  walker: A + 'art/enemies/enemies-1-4a2566f221.png',
  flyer: A + 'art/enemies/enemies-2-603b647894.png',
  turret: A + 'art/enemies/enemies-3-2656b1a170.png',
  logo: A + 'art/moe-rock-heroes/logo-ddbdd9f220.png',
  stageMusic: A + 'music/a-mega-man-style-action-platformer-stage-e1af7374c5af.mp3',
  bossMusic: A + 'music/a-robot-master-boss-battle-in-a-mega-man-71723e713b70.mp3',
  bossForms: ["https://gameblocks.nyc3.digitaloceanspaces.com/78wQyqoVoGi/art/citadel-guardian/citadel-guardian-1-cc1530309e.png","https://gameblocks.nyc3.digitaloceanspaces.com/78wQyqoVoGi/art/citadel-guardian/citadel-guardian-2-3667ef2690.png","https://gameblocks.nyc3.digitaloceanspaces.com/78wQyqoVoGi/art/citadel-guardian/citadel-guardian-3-df82cc871a.png"],
};
