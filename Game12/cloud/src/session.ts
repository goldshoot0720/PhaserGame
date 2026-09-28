// Scene hand-off.
export interface Result { id: string; name: string; you: boolean; wins: number; color: string; }
export const session = { hero: 'whale', results: [] as Result[], winner: -1, rounds: 0, musicOn: false };
