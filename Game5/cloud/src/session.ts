// Scene hand-off state.
export const session = {
  mode: 'cpu' as 'cpu' | 'vs',
  p1: 0, p2: 1, stage: 0, difficulty: 1,
  winner: -1 as number, score: [0, 0] as [number, number],
  musicOn: false,
};
export const DIFFS = ['簡單', '普通', '困難'];
