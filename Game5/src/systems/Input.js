import Phaser from 'phaser';
import { KEYMAP } from '../config.js';

const BUTTONS = ['lp', 'hp', 'lk', 'hk', 'sp', 'su'];
const DIRS = ['up', 'down', 'left', 'right'];
const HISTORY_FRAMES = 40;

/** A snapshot of one player's controls for a single logic frame. */
export function emptyInputFrame() {
  return { up: false, down: false, left: false, right: false, lp: false, hp: false, lk: false, hk: false, sp: false, su: false };
}

/** Reads a player's keys once per logic frame and reports held directions + freshly pressed buttons. */
export class KeyboardController {
  constructor(scene, player) {
    const kb = scene.input.keyboard;
    this.keys = {};
    for (const [action, names] of Object.entries(KEYMAP[player])) {
      this.keys[action] = names.map((n) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[n], true, false));
    }
    this.prev = {};
  }

  poll() {
    const frame = emptyInputFrame();
    for (const d of DIRS) frame[d] = this.keys[d].some((k) => k.isDown);
    for (const b of BUTTONS) {
      const down = this.keys[b].some((k) => k.isDown);
      frame[b] = down && !this.prev[b];
      this.prev[b] = down;
    }
    return frame;
  }
}

/** Stores recent stick positions to recognise motion inputs such as ↓↘→. */
export class MotionBuffer {
  constructor() {
    this.history = [];
    this.frame = 0;
  }

  push(input) {
    this.frame++;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = input.up ? 1 : input.down ? -1 : 0;
    const last = this.history[this.history.length - 1];
    if (!last || last.dx !== dx || last.dy !== dy) this.history.push({ dx, dy, frame: this.frame });
    while (this.history.length && this.history[0].frame < this.frame - HISTORY_FRAMES) this.history.shift();
  }

  /** True when `seq` (numpad notation relative to `facing`) was entered within `window` frames. */
  matches(seq, facing, window) {
    let idx = seq.length - 1;
    for (let i = this.history.length - 1; i >= 0 && idx >= 0; i--) {
      const h = this.history[i];
      if (h.frame < this.frame - window) break;
      if (toNumpad(h.dx * facing, h.dy) === seq[idx]) idx--;
    }
    return idx < 0;
  }

  clear() {
    this.history.length = 0;
  }
}

function toNumpad(fx, dy) {
  return 5 + fx + dy * 3;
}

/**
 * Menu helper: maps a keyboard event to { player: 1|2|0, action } where action is one of
 * up/down/left/right/confirm/back. Enter/Esc/Space work for either player (player 0).
 */
export function menuAction(event) {
  const code = event.keyCode;
  const K = Phaser.Input.Keyboard.KeyCodes;
  if (code === K.ENTER || code === K.SPACE) return { player: 0, action: 'confirm' };
  if (code === K.ESC || code === K.BACKSPACE) return { player: 0, action: 'back' };
  for (const [pi, player] of [[1, 'p1'], [2, 'p2']]) {
    const map = KEYMAP[player];
    const has = (action) => map[action].some((n) => K[n] === code);
    for (const d of DIRS) if (has(d)) return { player: pi, action: d };
    if (has('lp') || has('lk')) return { player: pi, action: 'confirm' };
    if (has('hp') || has('hk')) return { player: pi, action: 'back' };
  }
  return null;
}
