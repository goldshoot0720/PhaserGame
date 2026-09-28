// Roster: stats, special move (motion input + shortcut key) and super move per fighter.
// Special/super attack fields (in addition to the normal attack fields in moves.js):
//   dashVx: forward speed (px/frame) during active frames; jumpVy: upward launch at the first active frame
//   hover: stay in the air at a fixed height during active frames; hits/hitEvery: multi-hit
//   invuln: invulnerable frames from the start; projectile: spawns a projectile after startup
//   lowProfile: shrinks the hurtbox (slides under projectiles); projInvuln: passes through projectiles
//   untilLand: active until the fighter lands; fire: flame trail effect
//   counter: parry window (frames) that answers any hit with COUNTER_STRIKE

const special = (o) => ({ knockdown: false, hits: 1, chip: 0.25, lunge: 0, ...o });

export const CHARACTERS = [
  {
    id: 'shione', name: '汐音', title: '鯨歌女僕', texture: 'f1', portrait: 'p1', color: 0x4f8dff,
    height: 300, health: 1000, walk: 3.0, jump: 1.0, power: 1.0, reach: 1.0,
    desc: '以鯨浪波牽制遠距離的均衡型角色。',
    special: special({
      name: '鯨浪波', motion: 'qcf', button: 'P', pose: 'cast', startup: 12, active: 1, recovery: 24, damage: 80, hitstun: 22, blockstun: 16,
      level: 'mid', projectile: { speed: 7.5, w: 90, h: 80, life: 160, style: 'wave', color: 0x5ec8ff },
    }),
    super: special({
      name: '深海鯨嘯', pose: 'cast', startup: 10, active: 1, recovery: 30, damage: 50, hitstun: 26, blockstun: 12, level: 'mid', knockdown: true,
      invuln: 12, projectile: { speed: 6.5, w: 200, h: 220, life: 200, style: 'bigwave', color: 0x3aa0ff, hits: 6, hitEvery: 7 },
    }),
  },
  {
    id: 'koori', name: '小冰', title: '企鵝連帽少女', texture: 'f2', portrait: 'p2', color: 0x9adfff,
    height: 262, health: 1080, walk: 2.6, jump: 0.92, power: 1.08, reach: 0.9,
    desc: '身材嬌小卻很耐打，企鵝滑壘可以鑽過飛行道具。',
    special: special({
      name: '企鵝滑壘', motion: 'qcf', button: 'K', pose: 'slide', startup: 8, active: 26, recovery: 18, damage: 90, hitstun: 24, blockstun: 16,
      level: 'low', box: { x: 70, y: 30, w: 170, h: 60 }, dashVx: 10.5, knockdown: true, lowProfile: true,
    }),
    super: special({
      name: '冰原特快車', pose: 'slide', startup: 6, active: 44, recovery: 22, damage: 38, hitstun: 20, blockstun: 8,
      level: 'low', box: { x: 70, y: 40, w: 190, h: 80 }, dashVx: 12, hits: 7, hitEvery: 6, knockdown: true, invuln: 14, lowProfile: true,
    }),
  },
  {
    id: 'shoheng', name: '書恆', title: '書卷系青年', texture: 'f3', portrait: 'p3', color: 0xd8b98a,
    height: 345, health: 1000, walk: 3.0, jump: 1.0, power: 1.05, reach: 1.1,
    desc: '手長腳長，知識昇龍拳發動瞬間無敵，是最強的對空技。',
    special: special({
      name: '知識昇龍拳', motion: 'dp', button: 'P', pose: 'rise', startup: 3, active: 16, recovery: 22, damage: 120, hitstun: 30, blockstun: 18,
      level: 'mid', box: { x: 55, y: 260, w: 110, h: 200 }, jumpVy: -15, dashVx: 2.5, knockdown: true, invuln: 9,
    }),
    super: special({
      name: '真・博學昇龍', pose: 'rise', startup: 4, active: 26, recovery: 26, damage: 55, hitstun: 26, blockstun: 10,
      level: 'mid', box: { x: 55, y: 260, w: 130, h: 240 }, jumpVy: -18, dashVx: 3, hits: 5, hitEvery: 5, knockdown: true, invuln: 16,
    }),
  },
  {
    id: 'ashou', name: '阿翔', title: '街頭少年', texture: 'f4', portrait: 'p4', color: 0xb0b0b0,
    height: 335, health: 980, walk: 3.4, jump: 1.05, power: 1.0, reach: 1.0,
    desc: '腳步輕快的街頭少年，旋風腿能穿越對手的飛行道具。',
    special: special({
      name: '旋風腿', motion: 'qcb', button: 'K', pose: 'spin', startup: 7, active: 30, recovery: 16, damage: 40, hitstun: 18, blockstun: 10,
      level: 'high', box: { x: 40, y: 190, w: 240, h: 70 }, dashVx: 5, hover: 60, hits: 3, hitEvery: 10, knockdown: true, projInvuln: true,
    }),
    super: special({
      name: '疾風大旋風', pose: 'spin', startup: 5, active: 48, recovery: 20, damage: 34, hitstun: 18, blockstun: 8,
      level: 'mid', box: { x: 40, y: 180, w: 260, h: 140 }, dashVx: 6.5, hover: 70, hits: 8, hitEvery: 6, knockdown: true, invuln: 12,
    }),
  },
  {
    id: 'hanamaki', name: '花卷', title: '三花街貓', texture: 'f5', portrait: 'p5', color: 0xf0a24a,
    height: 330, health: 900, walk: 3.8, jump: 1.08, power: 0.92, reach: 0.95, speed: 0.8,
    desc: '速度最快的貓，出招快、連段多，但比較不耐打。',
    special: special({
      name: '三連貓爪', motion: 'qcf', button: 'P', pose: 'claw', startup: 6, active: 18, recovery: 14, damage: 36, hitstun: 16, blockstun: 8,
      level: 'high', box: { x: 95, y: 200, w: 120, h: 110 }, dashVx: 7, hits: 3, hitEvery: 6,
    }),
    super: special({
      name: '百裂貓爪亂舞', pose: 'claw', startup: 4, active: 50, recovery: 20, damage: 26, hitstun: 16, blockstun: 6,
      level: 'high', box: { x: 95, y: 200, w: 140, h: 150 }, dashVx: 5, hits: 10, hitEvery: 5, knockdown: true, invuln: 10,
    }),
  },
  {
    id: 'yukidama', name: '雪球', title: '圖書館白貓', texture: 'f6', portrait: 'p6', color: 0xf4efe6,
    height: 335, health: 950, walk: 3.4, jump: 1.12, power: 0.98, reach: 1.0, speed: 0.9,
    desc: '身手敏捷的白貓，飛撲貓掌從空中攻擊，必須站著防禦。',
    special: special({
      name: '飛撲貓掌', motion: 'qcf', button: 'K', pose: 'pounce', startup: 6, active: 60, recovery: 12, damage: 95, hitstun: 24, blockstun: 16,
      level: 'overhead', box: { x: 80, y: 90, w: 130, h: 120 }, jumpVy: -13, dashVx: 7.5, untilLand: true, knockdown: true,
    }),
    super: special({
      name: '雪崩飛撲', pose: 'pounce', startup: 4, active: 60, recovery: 16, damage: 48, hitstun: 22, blockstun: 10,
      level: 'overhead', box: { x: 80, y: 110, w: 170, h: 180 }, jumpVy: -15, dashVx: 9, untilLand: true, hits: 5, hitEvery: 5, knockdown: true, invuln: 12,
    }),
  },
  {
    id: 'hirin', name: '緋鈴', title: '緋紅貓耳少女', texture: 'f7', portrait: 'p7', color: 0xe8413c,
    height: 318, health: 960, walk: 3.3, jump: 1.05, power: 1.05, reach: 1.0,
    desc: '腳技華麗的貓耳少女，緋焰月輪腳帶著火焰翻身踢上天空。',
    special: special({
      name: '緋焰月輪腳', motion: 'dp', button: 'K', pose: 'flip', startup: 4, active: 22, recovery: 20, damage: 50, hitstun: 26, blockstun: 12,
      level: 'mid', box: { x: 75, y: 200, w: 150, h: 200 }, jumpVy: -14, dashVx: 4, hits: 2, hitEvery: 8, knockdown: true, invuln: 7, fire: true,
    }),
    super: special({
      name: '鈴音・緋焰天舞', pose: 'flip', startup: 4, active: 34, recovery: 24, damage: 42, hitstun: 24, blockstun: 8,
      level: 'mid', box: { x: 75, y: 220, w: 190, h: 240 }, jumpVy: -17, dashVx: 5, hits: 6, hitEvery: 5, knockdown: true, invuln: 14, fire: true,
    }),
  },
  {
    id: 'mio', name: '澪', title: '水手服少女', texture: 'f8', portrait: 'p8', color: 0x7fb3e6,
    height: 325, health: 1000, walk: 3.1, jump: 1.0, power: 1.0, reach: 1.05,
    desc: '冷靜的反擊專家，水月返可以擋下任何攻擊並立刻反擊。',
    special: special({
      name: '水月返', motion: 'qcb', button: 'P', pose: 'counter', startup: 3, active: 26, recovery: 20, damage: 0, hitstun: 0, blockstun: 0,
      level: 'mid', counter: true,
    }),
    super: special({
      name: '明鏡止水・連掌', pose: 'claw', startup: 5, active: 42, recovery: 22, damage: 40, hitstun: 20, blockstun: 8,
      level: 'mid', box: { x: 100, y: 200, w: 150, h: 170 }, dashVx: 6.5, hits: 7, hitEvery: 6, knockdown: true, invuln: 12,
    }),
  },
];
