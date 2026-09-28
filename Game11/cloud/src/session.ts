// Scene hand-off + persisted hi-score (browser storage is optional — every access is guarded).
const KEY = 'moe-strikers-2026-hi';
function loadHi(): number {
  try { return Number(globalThis.localStorage?.getItem(KEY)) || 0; } catch { return 0; }
}
export function saveHi(v: number): void {
  try { globalThis.localStorage?.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
}
export const session = { pilot: 'whale', score: 0, hi: loadHi(), won: false, stage: 0, musicOn: false };
