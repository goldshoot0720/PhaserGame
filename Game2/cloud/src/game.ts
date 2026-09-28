import { installMobileControls } from './mobile.js';
// Game boot — the scene roster + Game.create + run(), and nothing else.
import { Game } from '../engine/webgpu.js';
import { GAME_OPTIONS } from './config.js';
import { Title } from './scenes/title.js';
import { Select } from './scenes/select.js';
import { Play } from './scenes/play.js';
import { GameOver } from './scenes/gameover.js';

const game = await Game.create({
  ...GAME_OPTIONS,
  scenes: { title: Title, select: Select, play: Play, gameOver: GameOver },
});
installMobileControls(game, 2);
game.run();
