// Scene hand-off.
export interface Result { id: string; name: string; worth: number; props: number; alive: boolean; you: boolean; color: string; }
export const session = { hero: 'whale', results: [] as Result[], reason: '', musicOn: false };
