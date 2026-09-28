// Save data in localStorage; every access is guarded (storage can be unavailable).
const KEY = 'moe-rock-heroes-v1';
interface HeroProgress { beaten: string[]; cleared: boolean; citadelPhase?: number; }
interface Save { lastHero: string | null; heroes: Record<string, HeroProgress>; }

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? (JSON.parse(raw) as Save) : null;
    if (d && d.heroes) return d;
  } catch { /* fresh save */ }
  return { lastHero: null, heroes: {} };
}
let state: Save | null = null;
function s(): Save { if (!state) state = load(); return state; }
function save(): void { try { localStorage.setItem(KEY, JSON.stringify(s())); } catch { /* not persisted */ } }
function rec(h: string): HeroProgress {
  const st = s();
  if (!st.heroes[h]) st.heroes[h] = { beaten: [], cleared: false };
  return st.heroes[h];
}

export const Progress = {
  get lastHero(): string | null { return s().lastHero; },
  setHero(h: string): void { s().lastHero = h; rec(h); save(); },
  beaten(h: string): string[] { return [...rec(h).beaten]; },
  isBeaten(h: string, b: string): boolean { return rec(h).beaten.includes(b); },
  markBeaten(h: string, b: string): void { const r = rec(h); if (!r.beaten.includes(b)) r.beaten.push(b); save(); },
  markCitadelReached(h: string): void { const r = rec(h); if (r.citadelPhase === undefined) r.citadelPhase = 0; save(); },
  citadelCheckpoint(h: string): number { return rec(h).citadelPhase ?? -1; },
  markCitadelPhase(h: string, phase: number): void { const r = rec(h); r.citadelPhase = Math.max(r.citadelPhase ?? 0, Math.min(2, phase)); save(); },
  markCleared(h: string): void { rec(h).cleared = true; save(); },
  isCleared(h: string): boolean { return rec(h).cleared; },
  reset(h: string): void { s().heroes[h] = { beaten: [], cleared: false }; save(); },
};

/** Scene-to-scene hand-off. */
export const run: {
  hero: string; stage: string; outcome: 'none' | 'win' | 'lose' | 'ending';
  message: string; musicOn: boolean;
  fortressCarry: null | { hp: number; lives: number; ammo: Record<string, number>; eTanks: number; mTanks: number };
} = {
  hero: 'whale', stage: 'penguin', outcome: 'none', message: '', musicOn: false, fortressCarry: null,
};
