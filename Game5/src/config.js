// Global constants shared by all scenes.
export const WIDTH = 1280;
export const HEIGHT = 720;
export const GROUND_Y = 640;
export const STAGE_LEFT = 50;
export const STAGE_RIGHT = WIDTH - 50;

export const FPS = 60;
export const FRAME_MS = 1000 / FPS;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;
export const METER_MAX = 100;

export const FONT = '"PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

export const DIFFICULTIES = [
  { id: 'easy', label: '簡單' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困難' },
];

// Key bindings (Phaser key code names). P2 has two alternatives per button:
// the numpad and a laptop-friendly cluster next to the arrow keys.
export const KEYMAP = {
  p1: {
    up: ['W'], down: ['S'], left: ['A'], right: ['D'],
    lp: ['J'], hp: ['K'], sp: ['L'],
    lk: ['U'], hk: ['I'], su: ['O'],
  },
  p2: {
    up: ['UP'], down: ['DOWN'], left: ['LEFT'], right: ['RIGHT'],
    lp: ['NUMPAD_ONE', 'COMMA'], hp: ['NUMPAD_TWO', 'PERIOD'], sp: ['NUMPAD_THREE', 'FORWARD_SLASH'],
    lk: ['NUMPAD_FOUR', 'SEMICOLON'], hk: ['NUMPAD_FIVE', 'QUOTES'], su: ['NUMPAD_SIX', 'CLOSED_BRACKET'],
  },
};

export const CONTROLS_TEXT = [
  '【P1】移動 W A S D　輕拳 J　重拳 K　輕腳 U　重腳 I　必殺技 L　超必殺 O',
  '【P2】移動 方向鍵　輕拳 數字鍵1 / ,　重拳 2 / .　輕腳 4 / ;　重腳 5 / \'　必殺技 3 / /　超必殺 6 / ]',
  '按住「後」防禦（蹲下+後 防下段）；指令技：↓↘→ / →↓↘ / ↓↙← + 拳或腳；超必殺：↓↘→↓↘→ + 拳腳（需滿氣）',
];
