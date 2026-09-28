// State that outlives a scene (scene fields die on transition).
import type { GameState } from './rules.js';

export const session: { team: 'whale' | 'cat'; last: GameState | null; musicOn: boolean } = {
  team: 'whale',
  last: null,
  musicOn: false,
};
