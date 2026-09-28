import * as Phaser from 'phaser';

const BINDINGS = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
  jump: ['Z', 'SPACE'],
  shoot: ['X', 'J'],
  dash: ['C', 'K'],
  prev: ['Q'],
  next: ['E'],
  confirm: ['ENTER'],
  pause: ['P', 'ESC'],
  back: ['ESC', 'BACKSPACE'],
};

const NUMBER_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** Groups several physical keys into named actions. */
export class Controls {
  constructor(scene) {
    const kb = scene.input.keyboard;
    this.keys = {};
    for (const [action, names] of Object.entries(BINDINGS)) {
      this.keys[action] = names.map((n) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[n]));
    }
    this.numbers = NUMBER_KEYS.map((n) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[n]));
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
  }

  isDown(action) {
    return this.keys[action].some((k) => k.isDown);
  }

  justDown(action) {
    // Evaluate every key so each one's "just down" flag is consumed.
    return this.keys[action].map((k) => Phaser.Input.Keyboard.JustDown(k)).some(Boolean);
  }

  justUp(action) {
    return this.keys[action].map((k) => Phaser.Input.Keyboard.JustUp(k)).some(Boolean);
  }

  /** Index (0-based) of a number key pressed this frame, or -1. */
  numberPressed() {
    return this.numbers.findIndex((k) => Phaser.Input.Keyboard.JustDown(k));
  }
}
