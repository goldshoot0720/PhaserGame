// Which chunks make up each stage. Every stage automatically ends with a
// corridor, a boss door and a one-screen boss room (added by levelBuilder).

export const STAGE_LAYOUTS = {
  whale: ['start', 'flat', 'pit', 'mover', 'checkpoint', 'flyers', 'bigMover', 'health', 'doublePit', 'checkpoint', 'mover', 'lowTunnel', 'health'],
  penguin: ['start', 'flat', 'steps', 'spikePit', 'checkpoint', 'lowTunnel', 'gauntlet', 'health', 'pit', 'checkpoint', 'spikeRun', 'towers', 'health'],
  glasses: ['start', 'turretWall', 'flat', 'lift', 'checkpoint', 'towers', 'lowTunnel', 'health', 'turretWall', 'checkpoint', 'lift', 'spikePit', 'health'],
  tshirt: ['start', 'gauntlet', 'pit', 'mover', 'checkpoint', 'doublePit', 'turretWall', 'health', 'gauntlet', 'checkpoint', 'bigMover', 'steps', 'health'],
  calico: ['start', 'flat', 'spikeRun', 'gauntlet', 'checkpoint', 'spikePit', 'steps', 'health', 'lowTunnel', 'checkpoint', 'spikeRun', 'turretWall', 'health'],
  library: ['start', 'flyers', 'ladderUp', 'flat', 'checkpoint', 'ladderTall', 'flyers', 'health', 'steps', 'checkpoint', 'ladderUp', 'flyers', 'health'],
  redcat: ['start', 'flat', 'spikePit', 'pit', 'checkpoint', 'spikeRun', 'lift', 'health', 'mover', 'checkpoint', 'spikePit', 'towers', 'health'],
  sailor: ['start', 'flat', 'pit', 'flyers', 'checkpoint', 'doublePit', 'ladderUp', 'health', 'bigMover', 'checkpoint', 'pit', 'gauntlet', 'health'],
  final: [
    'start', 'gauntlet', 'spikeRun', 'lift', 'checkpoint', 'bigMover', 'ladderTall', 'health',
    'towers', 'lowTunnel', 'checkpoint', 'spikePit', 'doublePit', 'mover', 'health', 'checkpoint', 'turretWall', 'health',
  ],
};
