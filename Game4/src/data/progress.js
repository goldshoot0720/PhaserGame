// Save data lives in localStorage; every access is guarded because storage can be
// unavailable (private mode, blocked site data).

const STORAGE_KEY = 'rock-heroes-save-v1';

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data === 'object' && data.heroes) return data;
  } catch {
    // fall through to a fresh save
  }
  return { lastHero: null, heroes: {} };
}

function save(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // progress simply is not persisted
  }
}

let state = load();

function heroRecord(heroKey) {
  if (!state.heroes[heroKey]) state.heroes[heroKey] = { beaten: [], cleared: false };
  return state.heroes[heroKey];
}

export const Progress = {
  get lastHero() {
    return state.lastHero;
  },

  setHero(heroKey) {
    state.lastHero = heroKey;
    heroRecord(heroKey);
    save(state);
  },

  beaten(heroKey) {
    return [...heroRecord(heroKey).beaten];
  },

  isBeaten(heroKey, bossKey) {
    return heroRecord(heroKey).beaten.includes(bossKey);
  },

  markBeaten(heroKey, bossKey) {
    const rec = heroRecord(heroKey);
    if (!rec.beaten.includes(bossKey)) rec.beaten.push(bossKey);
    save(state);
  },

  markCleared(heroKey) {
    heroRecord(heroKey).cleared = true;
    save(state);
  },

  isCleared(heroKey) {
    return heroRecord(heroKey).cleared;
  },

  resetHero(heroKey) {
    state.heroes[heroKey] = { beaten: [], cleared: false };
    save(state);
  },
};
