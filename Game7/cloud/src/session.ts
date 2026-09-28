// Scene hand-off.
export interface Stat { id: string; kills: number; deaths: number; you: boolean; }
export const session = { hero: 'whale', stats: [] as Stat[], reason: '', musicOn: false };
