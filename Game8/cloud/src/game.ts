// Game boot — the scene roster + Game.create + run(), and nothing else.
import { Game } from '../engine/webgpu.js';
import { GAME_OPTIONS } from './config.js';
import { Title } from './scenes/title.js';
import { Duel } from './scenes/duel.js';
import { GameOver } from './scenes/gameover.js';

const game = await Game.create({ ...GAME_OPTIONS, scenes: { title: Title, play: Duel, gameOver: GameOver } });
game.run();
