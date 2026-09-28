// Scene: Play — the round. THIS IS WHERE YOUR GAME GOES.
//
// A fresh Play scene is built each time you enter it, so setup() just spawns this
// round's sprites — this.add(new Player({ x, y })). A sprite's looks and physics
// are DATA (the config object); code adds only behaviour (an update() override).
// Keep level layout with the scene as a leaf const so it can't create an import
// cycle.
//   preload(load) — declare the files this scene needs (see below).
//   setup()       — spawn this round's sprites, bind input.
//   update(dt)    — advance the round (call super.update(dt) first); call
//                   this.gotoGameOver(result) when it ends.
//   draw(d)       — world-space verbs over the auto-drawn sprites (call super first).
//   drawHud(d)    — the HUD (score, timer, lives…) in screen space.
//
// Lay the field out against the view — this.width / this.height / this.centerX /
// this.centerY, or this.vw(f) / this.vh(f) for a fraction across/down it (world
// units this frame; the width follows the window aspect).
// See engine/webgpu/index.md.
import { Scene, type Draw, type BitmapFont, type Preload } from '../../engine/webgpu.js';

export class Play extends Scene {
  private font!: BitmapFont;

  // preload() declares EVERY asset this scene needs — the engine shows a loading
  // bar while they load, THEN calls setup(). The rule: DECLARE data here, BUILD
  // (sprites, models, fonts) in setup().
  //   load.image(url)  → register frames in setup() with
  //                      this.game.assets.framesOf(url, frameW?, frameH?)
  //   load.audio(url)  → play with this.sound.play(url)
  //   load.json(url) / load.text(url) / load.binary(url)
  //   load.font(family, url) → a woff2/ttf/otf file. REQUIRED for any
  //     non-system face; bake in setup() with assets.font({ font: '32px ' + family })
  //   load.msdfFont(png, json) → build in setup() with this.game.assets.msdfFont(…)
  //   load.glb(url) / load.obj(url)  → a 3D model's geometry + textures; build
  //     in setup() with (await this.game.world3d()).loadGlb(url) — instant, the
  //     data is already cached.
  // Delete this override for a procgen (asset-free) game — the loader is skipped.
  override preload(_load: Preload): void {
    // _load.image('sprites/hero.png');
    // _load.glb('models/ship.glb');
  }

  override setup(): void {
    this.font = this.game.assets.font({ font: 'bold 24px monospace' });
    this.input.bind({ start: ['Space', 'Enter'] });
    // Spawn this round's sprites here, e.g.:
    //   this.add(new Player({ x: this.centerX, y: this.centerY }));
  }

  override update(dt: number): void {
    super.update(dt);                                 // engine: sprites, physics, collisions
    // Run the round here. When it ends, hand the result to the game-over screen:
    //   this.gotoGameOver({ win: true, score });
    if (this.input.keys.start.pressed) this.gotoGameOver();
  }

  // Screen space, CSS pixels: `d.w` / `d.h` are the window this frame. Anchor the
  // HUD to its edges — d.text(this.font, `SCORE ${score}`, 12, 12) top-left,
  // `d.h - 28` for the bottom.
  override drawHud(d: Draw): void {
    d.text(this.font, 'PLAYING', d.w / 2, d.h / 2, { align: 'center', color: '#e6e9f5' });
  }
}
