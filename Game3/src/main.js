import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { TrackSelectScene } from './scenes/TrackSelectScene.js';
import { RaceScene } from './scenes/RaceScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b1026',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    keyboard: true,
  },
  scene: [BootScene, TitleScene, CharacterSelectScene, TrackSelectScene, RaceScene, HUDScene, ResultsScene],
};

const game = new Phaser.Game(config);
window.__game = game;
