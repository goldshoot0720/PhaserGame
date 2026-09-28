import type { Game, Pointer } from '../engine/webgpu.js';

/** Shared mobile layout, copied into each cloud game by tools/sync-mobile.mjs. */
export const mobileAim = { active: false, x: 1, y: 0 };
let tapPointer: Pointer | null = null;
let tapUntil = 0;
/** Preserve fast touch taps long enough for polling-based menus and board games. */
export function mobilePointer(pointer: Pointer | null): Pointer | null {
  if (tapPointer && performance.now() < tapUntil) return tapPointer;
  return pointer;
}
export const MOBILE_ACTIONS: Record<number, [string, string][]> = {
  1: [['揮棒／投球', 'Space'], ['直球', 'Digit1'], ['滑球', 'Digit2'], ['曲球', 'Digit3'], ['變速球', 'Digit4']],
  2: [['投籃／封蓋', 'Space'], ['傳球／抄球', 'KeyK'], ['換人', 'KeyQ'], ['衝刺', 'ShiftLeft']],
  3: [['油門', 'KeyW'], ['煞車', 'KeyS'], ['甩尾', 'ShiftLeft'], ['道具', 'Space']],
  4: [['跳躍', 'KeyZ'], ['射擊', 'KeyX'], ['前武器', 'KeyQ'], ['後武器', 'KeyE'], ['E罐', 'KeyR'], ['M罐', 'KeyM']],
  5: [['輕拳', 'KeyJ'], ['重拳', 'KeyK'], ['輕踢', 'KeyU'], ['重踢', 'KeyI'], ['必殺', 'KeyL'], ['超必殺', 'KeyO']],
  6: [['確認', 'Enter'], ['結束回合', 'KeyE'], ['取消', 'Escape']],
  7: [['衝刺', 'Space'], ['戰績', 'Tab']],
  8: [['確認／回合', 'Space'], ['取消', 'Escape']],
  9: [['擲骰／確認', 'Space'], ['略過', 'KeyN']],
  10: [['發射', 'Space'], ['砲彈1', 'Digit1'], ['砲彈2', 'Digit2'], ['砲彈3', 'Digit3'], ['砲彈4', 'Digit4'], ['左看', 'KeyQ'], ['右看', 'KeyE']],
  11: [['炸彈', 'KeyX'], ['慢速', 'ShiftLeft']],
  12: [['放水球', 'Space'], ['針救援', 'ShiftLeft']],
};

export function installMobileControls(game: Game, id: number): void {
  if (typeof document === 'undefined' || document.getElementById('moe-touch')) return;
  const touch = matchMedia('(pointer: coarse)');
  if (!touch.matches && navigator.maxTouchPoints === 0 && !new URLSearchParams(location.search).has('touch')) return;
  const host = game.canvas.parentElement!;
  const root = document.createElement('section'); root.id = 'moe-touch'; root.setAttribute('aria-label', '手機遊戲控制');
  const style = document.createElement('style');
  style.textContent = `
    html,body{overscroll-behavior:none;touch-action:manipulation;background:#0d1425!important}
    #moe-touch{position:fixed;inset:0;pointer-events:none;color:#edf5ff;font:13px system-ui;z-index:15;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    #moe-touch button,#moe-touch .pad{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
    #moe-touch button{min-width:44px;min-height:44px;border:1px solid #5581a7;border-radius:12px;background:#203951ef;color:#effaff;padding:7px 9px;font:inherit;line-height:1.2}
    #moe-touch button.held{background:#70c5e0;color:#102132;border-color:#c5f2ff}
    #moe-touch .bar{position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));top:max(4px,env(safe-area-inset-top));display:flex;gap:6px;justify-content:center;align-items:center}
    #moe-touch .move{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:max(12px,env(safe-area-inset-left));display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:4px}
    #moe-touch .actions{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(2,minmax(52px,1fr));gap:5px;max-width:184px}
    #moe-touch .pad{width:88px;height:88px;border-radius:50%;border:2px solid #7abbdf;background:#172c45ed;display:grid;place-items:center;position:absolute;bottom:68px;right:max(12px,env(safe-area-inset-right));font-size:12px}
    #moe-touch .pad.held{background:#347b9e}
    #moe-touch .notice{position:absolute;left:0;right:0;bottom:162px;text-align:center;color:#9abbd8;font-size:12px}
    @media(orientation:landscape){#moe-touch .move{grid-template-columns:repeat(3,40px);grid-template-rows:repeat(2,44px);gap:2px;left:max(4px,env(safe-area-inset-left))}#moe-touch .actions{right:max(4px,env(safe-area-inset-right));max-width:130px;gap:3px}#moe-touch .actions button{font-size:11px;padding:3px;min-width:44px}#moe-touch .notice{display:none}#moe-touch .bar{justify-content:flex-end}#moe-touch .pad{right:24px;bottom:116px}}
    @media(max-width:360px) and (orientation:portrait){#moe-touch .actions{max-width:156px;right:6px}#moe-touch .move{left:6px}}
  `;
  document.head.append(style); document.body.append(root);
  const held = new Map<string, Set<number>>();
  const emit = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true }));
  function key(code: string, pointer: number, down: boolean): void {
    const owners = held.get(code) ?? new Set<number>(), before = owners.size;
    if (down) owners.add(pointer); else owners.delete(pointer);
    held.set(code, owners);
    if (!before && owners.size) emit(code, true);
    if (before && !owners.size) emit(code, false);
  }
  function reset(): void {
    for (const [code, owners] of held) { if (owners.size) emit(code, false); }
    held.clear(); mobileAim.active = false; tapPointer = null;
    root.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
  }
  function button(label: string, code: string, parent: HTMLElement): HTMLButtonElement {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.dataset.code = code;
    const pointers = new Map<number, number>();
    el.addEventListener('pointerdown', event => {
      event.preventDefault(); if (game.paused) return;
      pointers.set(event.pointerId, performance.now()); el.setPointerCapture(event.pointerId);
      key(code, event.pointerId, true); el.classList.add('held');
    });
    const release = (event: PointerEvent): void => {
      const started = pointers.get(event.pointerId); if (started === undefined) return;
      pointers.delete(event.pointerId); el.classList.remove('held');
      // Keep short taps visible to at least one 60 Hz simulation frame.
      setTimeout(() => key(code, event.pointerId, false), Math.max(0, 35 - (performance.now() - started)));
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, release as EventListener);
    parent.append(el); return el;
  }
  const bar = document.createElement('div'); bar.className = 'bar'; root.append(bar);
  button('確認', 'Enter', bar); button('返回', 'Escape', bar);
  const pause = document.createElement('button'); pause.textContent = '暫停';
  pause.onclick = () => { reset(); if (game.paused) game.resume(); else game.pause(); pause.textContent = game.paused ? '繼續' : '暫停'; };
  const mute = document.createElement('button'); mute.textContent = '靜音';
  mute.onclick = () => { game.sound.toggleMute(); mute.textContent = game.sound.muted ? '開聲音' : '靜音'; };
  bar.append(pause, mute);
  const move = document.createElement('div'); move.className = 'move'; root.append(move);
  const up = button('↑', 'KeyW', move); up.style.gridColumn = '2';
  const left = button('←', 'KeyA', move); left.style.gridColumn = '1'; left.style.gridRow = '2';
  const down = button('↓', 'KeyS', move); down.style.gridColumn = '2'; down.style.gridRow = '2';
  const right = button('→', 'KeyD', move); right.style.gridColumn = '3'; right.style.gridRow = '2';
  const actions = document.createElement('div'); actions.className = 'actions'; root.append(actions);
  for (const [label, code] of MOBILE_ACTIONS[id]) button(label, code, actions);
  if (id === 7) {
    const pad = document.createElement('div'); pad.className = 'pad'; pad.textContent = '瞄準／射擊'; pad.setAttribute('aria-label', '拖曳瞄準射擊'); root.append(pad);
    let pointer: number | null = null;
    const aim = (event: PointerEvent): void => {
      if (event.pointerId !== pointer) return;
      const r = pad.getBoundingClientRect(), x = event.clientX - r.left - r.width / 2, y = event.clientY - r.top - r.height / 2;
      if (Math.hypot(x, y) > 8) { mobileAim.x = x; mobileAim.y = y; mobileAim.active = true; }
    };
    pad.onpointerdown = event => { if (pointer !== null || game.paused) return; event.preventDefault(); pointer = event.pointerId; pad.setPointerCapture(pointer); pad.classList.add('held'); aim(event); key('KeyJ', pointer, true); };
    pad.onpointermove = aim;
    const release = (event: PointerEvent): void => { if (event.pointerId !== pointer) return; key('KeyJ', pointer, false); pointer = null; mobileAim.active = false; pad.classList.remove('held'); };
    pad.onpointerup = release; pad.onpointercancel = release; pad.onlostpointercapture = release;
  }
  const notice = document.createElement('div'); notice.className = 'notice'; notice.textContent = '橫向畫面更大・可同時按住移動與動作'; root.append(notice);
  game.input.onTap(event => {
    if (game.paused) return;
    tapPointer = { ...game.input.pointer, x: event.x, y: event.y, isDown: true } as Pointer;
    tapUntil = performance.now() + 70;
  });
  function layout(): void {
    reset(); const width = window.innerWidth, height = window.innerHeight, portrait = height > width;
    const availableWidth = Math.max(180, width - (portrait ? 12 : 264));
    const availableHeight = Math.max(100, height - (portrait ? 236 : 58));
    const w = Math.min(availableWidth, availableHeight * 16 / 9), h = w * 9 / 16;
    Object.assign(host.style, { position: 'fixed', width: `${w}px`, height: `${h}px`, left: `${(width - w) / 2}px`, top: `${52 + Math.max(0, (availableHeight - h) / 2)}px` });
  }
  window.addEventListener('resize', layout);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { reset(); game.pause(); pause.textContent = '繼續'; } });
  let previous = game.scene;
  // No gameplay loop is replaced: only reset virtual buttons on scene transitions.
  const watch = setInterval(() => { if (!root.isConnected) { clearInterval(watch); return; } if (game.scene !== previous) { reset(); previous = game.scene; } pause.textContent = game.paused ? '繼續' : '暫停'; }, 200);
  layout();
}
