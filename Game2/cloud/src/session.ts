// State that outlives a scene.
export const session: { team: string[]; cpu: string[]; result: { score: [number, number]; win: boolean } | null; musicOn: boolean } = {
  team: ['whale', 'penguin', 'tshirt'],
  cpu: ['calico', 'redcat', 'sailor'],
  result: null,
  musicOn: false,
};
