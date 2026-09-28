// Scene hand-off.
export interface Result { id: string; name: string; you: boolean; alive: boolean; hp: number; dmg: number; color: string; }
export const session = { hero: 'whale', results: [] as Result[], reason: '', musicOn: false };
