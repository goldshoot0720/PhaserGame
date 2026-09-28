import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1100,
  height: 760,
  backgroundColor: '#101b37',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, ArenaScene],
});
