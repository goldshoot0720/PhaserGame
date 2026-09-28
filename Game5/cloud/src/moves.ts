// Frame data (ported from the local Game5). Boxes are for a 320px-tall fighter and scale per
// character. box.x: distance in front of the fighter's centre; box.y: height above the feet.
export type Level = 'high' | 'mid' | 'low' | 'overhead';
export interface Box { x: number; y: number; w: number; h: number; }
export interface Projectile { speed: number; w: number; h: number; life: number; style: string; color: number; hits?: number; hitEvery?: number; }
export interface Move {
  name?: string; pose: string; startup: number; active: number; recovery: number;
  damage: number; hitstun: number; blockstun: number; level: Level;
  box?: Box; lunge?: number; chain?: boolean; cancelable?: boolean; knockdown?: boolean; hits?: number; hitEvery?: number;
  motion?: string; button?: 'P' | 'K'; chip?: number;
  dashVx?: number; jumpVy?: number; hover?: number; invuln?: number; projectile?: Projectile;
  lowProfile?: boolean; projInvuln?: boolean; untilLand?: boolean; fire?: boolean; counter?: boolean;
}

const normal = (o: Move): Move => ({ cancelable: true, knockdown: false, hits: 1, ...o });
export const special = (o: Move): Move => ({ knockdown: false, hits: 1, chip: 0.25, lunge: 0, ...o });

export type Btn = 'lp' | 'hp' | 'lk' | 'hk';
export const NORMALS: Record<'stand' | 'crouch' | 'air', Record<Btn, Move>> = {
  stand: {
    lp: normal({ pose: 'punch', startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 14, blockstun: 9, level: 'high', box: { x: 105, y: 225, w: 90, h: 44 }, lunge: 10, chain: true }),
    hp: normal({ pose: 'punch', startup: 7, active: 4, recovery: 16, damage: 70, hitstun: 20, blockstun: 14, level: 'high', box: { x: 120, y: 220, w: 120, h: 54 }, lunge: 26 }),
    lk: normal({ pose: 'kick', startup: 5, active: 3, recovery: 9, damage: 35, hitstun: 15, blockstun: 10, level: 'mid', box: { x: 100, y: 120, w: 110, h: 50 }, lunge: 10, chain: true }),
    hk: normal({ pose: 'kick', startup: 9, active: 4, recovery: 18, damage: 80, hitstun: 22, blockstun: 15, level: 'mid', box: { x: 125, y: 170, w: 130, h: 64 }, lunge: 30 }),
  },
  crouch: {
    lp: normal({ pose: 'low', startup: 4, active: 3, recovery: 7, damage: 25, hitstun: 13, blockstun: 8, level: 'mid', box: { x: 100, y: 130, w: 90, h: 44 }, lunge: 8, chain: true }),
    hp: normal({ pose: 'uppercut', startup: 6, active: 5, recovery: 17, damage: 65, hitstun: 20, blockstun: 13, level: 'mid', box: { x: 85, y: 230, w: 100, h: 140 }, lunge: 14 }),
    lk: normal({ pose: 'low', startup: 5, active: 3, recovery: 9, damage: 25, hitstun: 13, blockstun: 8, level: 'low', box: { x: 105, y: 25, w: 120, h: 40 }, lunge: 8, chain: true }),
    hk: normal({ pose: 'low', startup: 8, active: 5, recovery: 22, damage: 70, hitstun: 20, blockstun: 14, level: 'low', box: { x: 130, y: 25, w: 150, h: 44 }, lunge: 30, knockdown: true }),
  },
  air: {
    lp: normal({ pose: 'air', startup: 4, active: 8, recovery: 4, damage: 30, hitstun: 14, blockstun: 9, level: 'overhead', box: { x: 85, y: 110, w: 90, h: 70 }, lunge: 0 }),
    hp: normal({ pose: 'air', startup: 6, active: 6, recovery: 6, damage: 65, hitstun: 20, blockstun: 13, level: 'overhead', box: { x: 95, y: 90, w: 110, h: 90 }, lunge: 0 }),
    lk: normal({ pose: 'airkick', startup: 4, active: 9, recovery: 4, damage: 35, hitstun: 15, blockstun: 9, level: 'overhead', box: { x: 90, y: 50, w: 100, h: 70 }, lunge: 0 }),
    hk: normal({ pose: 'airkick', startup: 6, active: 7, recovery: 6, damage: 75, hitstun: 20, blockstun: 13, level: 'overhead', box: { x: 105, y: 45, w: 120, h: 80 }, lunge: 0 }),
  },
};

export const COUNTER_STRIKE: Move = {
  name: '水月返・斬', pose: 'punch', startup: 2, active: 5, recovery: 16, damage: 130, hitstun: 30, blockstun: 16,
  level: 'mid', box: { x: 140, y: 190, w: 200, h: 180 }, lunge: 70, knockdown: true, hits: 1, invuln: 10,
};

/** Numpad notation relative to facing: 6 forward, 4 back, 2 down. */
export const MOTIONS: Record<string, { seq: number[]; label: string }> = {
  qcf: { seq: [2, 3, 6], label: '↓↘→' },
  qcb: { seq: [2, 1, 4], label: '↓↙←' },
  dp: { seq: [6, 2, 3], label: '→↓↘' },
  super: { seq: [2, 3, 6, 2, 3, 6], label: '↓↘→↓↘→' },
};

/** Does the direction history (newest last) end with the motion, within `window` frames? */
export function matchMotion(history: { dir: number; f: number }[], seq: number[], now: number, window = 22): boolean {
  let si = seq.length - 1;
  for (let i = history.length - 1; i >= 0 && si >= 0; i--) {
    const h = history[i];
    if (now - h.f > window + seq.length * 4) break;
    if (h.dir === seq[si]) si--;
  }
  return si < 0;
}
