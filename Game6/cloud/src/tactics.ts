// Board rules (ported from the local Game6) — pure logic, verify.ts drives it headlessly.
export interface CharDef {
  key: string; name: string; title: string; role: string;
  hp: number; atk: number; def: number; mov: number; rmin: number; rmax: number;
  swim?: boolean; heal?: number; crit?: number; magic?: boolean; color: string; desc: string;
}

export const CHARS: CharDef[] = [
  { key: 'whale', name: '汐音', title: '鯨之女僕', role: '治療師', hp: 22, atk: 5, def: 3, mov: 4, rmin: 1, rmax: 2, swim: true, heal: 8, color: '#5ab0ff', desc: '可為友軍恢復 8 HP，並能在水面上行走。' },
  { key: 'penguin', name: '小冰', title: '企鵝衛士', role: '重裝', hp: 32, atk: 7, def: 7, mov: 3, rmin: 1, rmax: 1, color: '#f2c14e', desc: '血量與防禦極高的前線坦克。' },
  { key: 'glasses', name: '光哉', title: '眼鏡軍師', role: '弓手', hp: 20, atk: 8, def: 3, mov: 4, rmin: 2, rmax: 3, color: '#d2b48c', desc: '射程 2-3 的遠程攻擊，無法反擊貼身敵人。' },
  { key: 'tshirt', name: '阿翔', title: '熱血少年', role: '格鬥家', hp: 27, atk: 9, def: 4, mov: 5, rmin: 1, rmax: 1, color: '#9aa0a6', desc: '攻守均衡、耐打的近戰突擊手。' },
  { key: 'calico', name: '小花', title: '街頭貓俠', role: '盜賊', hp: 21, atk: 8, def: 3, mov: 6, rmin: 1, rmax: 1, crit: 0.3, color: '#f08a3c', desc: '移動力 6，攻擊有 30% 機率造成雙倍爆擊。' },
  { key: 'whitecat', name: '書白', title: '書庫魔導', role: '魔法師', hp: 18, atk: 10, def: 2, mov: 4, rmin: 1, rmax: 2, magic: true, color: '#b57bff', desc: '魔法攻擊無視目標一半的防禦。' },
  { key: 'redcat', name: '緋音', title: '紅焰劍士', role: '劍士', hp: 24, atk: 10, def: 4, mov: 5, rmin: 1, rmax: 1, color: '#e0443e', desc: '攻擊力出眾的近戰劍士。' },
  { key: 'sailor', name: '澪', title: '水手長槍', role: '槍兵', hp: 25, atk: 8, def: 5, mov: 4, rmin: 1, rmax: 2, color: '#3a5ba0', desc: '射程 1-2 的長槍，攻守兼備。' },
];

export interface Terrain { name: string; cost: number; def: number; heal?: number; }
export const TERRAIN: Record<string, Terrain> = {
  '.': { name: '草地', cost: 1, def: 0 },
  F: { name: '森林', cost: 2, def: 2 },
  W: { name: '水域', cost: 99, def: 0 },
  M: { name: '山岳', cost: 3, def: 3 },
  H: { name: '民房', cost: 1, def: 1, heal: 5 },
};

export interface MapDef { name: string; rows: string[]; p: [number, number][]; e: [number, number][]; }
export const MAPS: MapDef[] = [
  { name: '綠野平原', rows: ['..F....M..F.', '.FF..W....F.', '....WW..H...', 'M...W...FF..', '..F.......M.', '..FF...W....', '...H..WW....', '.F....W..FF.', '.F..M....F..'],
    p: [[1, 2], [0, 4], [1, 6], [0, 7]], e: [[11, 1], [10, 3], [11, 5], [10, 7]] },
  { name: '湖畔小鎮', rows: ['...F..H...F.', '.H..WWWW..F.', '...WWWWWW...', 'F..WW..WW..M', '..F...H...F.', 'M..WW..WW..F', '...WWWWWW...', '.F..WWWW..H.', '.F...H..F...'],
    p: [[0, 1], [1, 4], [0, 6], [1, 8]], e: [[11, 0], [10, 3], [11, 6], [10, 8]] },
  { name: '霧隱山谷', rows: ['MMM..F..MMMM', 'M...FF....MM', '..F....F....', '.F..MMM..H..', '....M.M.....', '..H..MMM..F.', '....F....F..', 'MM....FF...M', 'MMMM..F..MMM'],
    p: [[4, 0], [1, 2], [0, 4], [2, 6]], e: [[7, 8], [10, 6], [11, 4], [9, 2]] },
];
export const COLS = 12, ROWS = 9;
export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface Unit { id: number; c: CharDef; team: 'P' | 'E'; x: number; y: number; hp: number; acted: boolean; }
export interface Node { x: number; y: number; c: number; prev: string | null; blocked: boolean; }
export type Rng = () => number;

export class Board {
  units: Unit[] = [];
  constructor(public map: MapDef) {}
  static create(map: MapDef, pKeys: string[], eKeys: string[]): Board {
    const b = new Board(map);
    let id = 0;
    pKeys.forEach((k, i) => b.units.push({ id: id++, c: CHARS.find((c) => c.key === k)!, team: 'P', x: map.p[i][0], y: map.p[i][1], hp: 0, acted: false }));
    eKeys.forEach((k, i) => b.units.push({ id: id++, c: CHARS.find((c) => c.key === k)!, team: 'E', x: map.e[i][0], y: map.e[i][1], hp: 0, acted: false }));
    for (const u of b.units) u.hp = u.c.hp;
    return b;
  }
  inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  terrain(x: number, y: number): Terrain { return TERRAIN[this.map.rows[y][x]] ?? TERRAIN['.']; }
  terrainDef(x: number, y: number): number { return this.terrain(x, y).def; }
  moveCost(u: Unit, x: number, y: number): number { const t = this.map.rows[y][x]; if (t === 'W') return u.c.swim ? 1 : 99; return this.terrain(x, y).cost; }
  unitAt(x: number, y: number): Unit | undefined { return this.units.find((u) => u.hp > 0 && u.x === x && u.y === y); }
  team(t: 'P' | 'E'): Unit[] { return this.units.filter((u) => u.team === t && u.hp > 0); }
  dist(a: { x: number; y: number }, b: { x: number; y: number }): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  /** Dijkstra over terrain costs; enemies block, allies can be passed but not stopped on. */
  reachable(u: Unit): Map<string, Node> {
    const out = new Map<string, Node>();
    const start: Node = { x: u.x, y: u.y, c: 0, prev: null, blocked: false };
    out.set(`${u.x},${u.y}`, start);
    const q: Node[] = [start];
    while (q.length) {
      q.sort((a, b) => a.c - b.c);
      const cur = q.shift()!;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const o = this.unitAt(nx, ny);
        if (o && o.team !== u.team) continue;
        const nc = cur.c + this.moveCost(u, nx, ny);
        if (nc > u.c.mov) continue;
        const k = `${nx},${ny}`;
        const ex = out.get(k);
        if (ex && ex.c <= nc) continue;
        const n: Node = { x: nx, y: ny, c: nc, prev: `${cur.x},${cur.y}`, blocked: !!o && o !== u };
        out.set(k, n);
        q.push(n);
      }
    }
    return out;
  }
  pathTo(reach: Map<string, Node>, x: number, y: number): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let k: string | null = `${x},${y}`;
    while (k) { const n: Node | undefined = reach.get(k); if (!n) break; path.unshift({ x: n.x, y: n.y }); k = n.prev; }
    return path;
  }
  inRange(a: Unit, t: { x: number; y: number }, fx = a.x, fy = a.y): boolean {
    const d = Math.abs(fx - t.x) + Math.abs(fy - t.y);
    return d >= a.c.rmin && d <= a.c.rmax;
  }
  calcDamage(a: Unit, d: Unit, rng: Rng | null = null, dx = d.x, dy = d.y): { dmg: number; crit: boolean } {
    let dv = d.c.def + this.terrainDef(dx, dy);
    if (a.c.magic) dv = Math.floor(dv / 2);
    let dmg = Math.max(1, a.c.atk - dv);
    const crit = !!rng && !!a.c.crit && rng() < a.c.crit;
    if (crit) dmg *= 2;
    return { dmg, crit };
  }
  /** Attack + possible counter. Mutates hp; returns what happened. */
  combat(a: Unit, d: Unit, rng: Rng): { dmg: number; crit: boolean; killed: boolean; counter: number; counterCrit: boolean; died: boolean } {
    const r1 = this.calcDamage(a, d, rng);
    d.hp = Math.max(0, d.hp - r1.dmg);
    let counter = 0, counterCrit = false;
    if (d.hp > 0 && this.inRange(d, a)) {
      const r2 = this.calcDamage(d, a, rng);
      counter = r2.dmg; counterCrit = r2.crit;
      a.hp = Math.max(0, a.hp - counter);
    }
    return { dmg: r1.dmg, crit: r1.crit, killed: d.hp <= 0, counter, counterCrit, died: a.hp <= 0 };
  }
  heal(a: Unit, t: Unit): number {
    const amt = Math.min(a.c.heal ?? 0, t.c.hp - t.hp);
    t.hp += amt;
    return amt;
  }
  /** Units of `team` standing on houses recover at the start of their phase. */
  phaseHeal(team: 'P' | 'E'): { u: Unit; amt: number }[] {
    const out: { u: Unit; amt: number }[] = [];
    for (const u of this.team(team)) {
      const h = this.terrain(u.x, u.y).heal;
      if (h && u.hp < u.c.hp) { const amt = Math.min(h, u.c.hp - u.hp); u.hp += amt; out.push({ u, amt }); }
    }
    return out;
  }
  winner(): 'P' | 'E' | null {
    if (!this.team('E').length) return 'P';
    if (!this.team('P').length) return 'E';
    return null;
  }

  /** Enemy AI (ported): score every reachable tile × action, else march along a terrain distance field. */
  aiPlan(e: Unit): { dest: { x: number; y: number }; path: { x: number; y: number }[]; type: 'atk' | 'heal' | 'move'; target: Unit | null } {
    const reach = this.reachable(e);
    const foes = this.team(e.team === 'E' ? 'P' : 'E');
    const allies = this.team(e.team).filter((o) => o !== e);
    let best: { s: number; n: Node; type: 'atk' | 'heal'; t: Unit } | null = null;
    for (const n of reach.values()) {
      if (n.blocked) continue;
      const tb = this.terrainDef(n.x, n.y) * 1.5 - n.c * 0.05;
      if (e.c.heal) {
        for (const al of allies) {
          const miss = al.c.hp - al.hp;
          if (miss <= 0 || !this.inRange(e, al, n.x, n.y)) continue;
          const s = Math.min(e.c.heal, miss) * 2.5 + (al.hp < al.c.hp * 0.5 ? 15 : 0) + tb;
          if (!best || s > best.s) best = { s, n, type: 'heal', t: al };
        }
      }
      for (const f of foes) {
        if (!this.inRange(e, f, n.x, n.y)) continue;
        const dmg = this.calcDamage(e, f).dmg;
        const kill = dmg >= f.hp;
        const counter = !kill && this.inRange(f, { x: n.x, y: n.y }) ? this.calcDamage(f, e, null, n.x, n.y).dmg : 0;
        const s = dmg + (kill ? 40 : 0) - counter * 0.7 + tb + (f.c.heal ? 4 : 0) + (1 - f.hp / f.c.hp) * 6;
        if (!best || s > best.s) best = { s, n, type: 'atk', t: f };
      }
    }
    if (best) return { dest: { x: best.n.x, y: best.n.y }, path: this.pathTo(reach, best.n.x, best.n.y), type: best.type, target: best.t };
    const field = this.distanceField(e, foes);
    let dest: { v: number; n: Node } | null = null;
    for (const n of reach.values()) {
      if (n.blocked) continue;
      const v = field.get(`${n.x},${n.y}`) ?? 999;
      if (!dest || v < dest.v || (v === dest.v && n.c < dest.n.c)) dest = { v, n };
    }
    const d = dest ? dest.n : { x: e.x, y: e.y };
    return { dest: { x: d.x, y: d.y }, path: this.pathTo(reach, d.x, d.y), type: 'move', target: null };
  }
  distanceField(u: Unit, targets: Unit[]): Map<string, number> {
    const d = new Map<string, number>();
    const q: { x: number; y: number; c: number }[] = [];
    targets.forEach((t) => { d.set(`${t.x},${t.y}`, 0); q.push({ x: t.x, y: t.y, c: 0 }); });
    while (q.length) {
      q.sort((a, b) => a.c - b.c);
      const cur = q.shift()!;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const cost = this.moveCost(u, nx, ny);
        if (cost >= 99) continue;
        const nc = cur.c + cost, k = `${nx},${ny}`;
        if (d.has(k) && d.get(k)! <= nc) continue;
        d.set(k, nc);
        q.push({ x: nx, y: ny, c: nc });
      }
    }
    return d;
  }
}
