// State that outlives a scene.
export interface RaceResult { order: { id: string; time: number; you: boolean }[]; place: number; time: number; track: number; best: number; }

export const session: { racer: string; track: number; result: RaceResult | null; musicOn: boolean } = {
  racer: 'whale',
  track: 0,
  result: null,
  musicOn: false,
};

export function loadBest(track: number): number {
  try { const v = localStorage.getItem(`moekart-best-${track}`); return v ? Number(v) : 0; } catch { return 0; }
}
export function saveBest(track: number, t: number): void {
  try { localStorage.setItem(`moekart-best-${track}`, String(t)); } catch { /* storage unavailable */ }
}
