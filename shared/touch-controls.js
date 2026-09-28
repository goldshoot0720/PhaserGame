// Multi-touch controls use the same action states as keyboard input.
// Each pad owns a pointer so moving, aiming and firing can happen together.
const id = Number(document.body.dataset.game);
const mobile = matchMedia('(pointer: coarse)');
const dock = document.createElement('section');
dock.className = 'touch-controls'; dock.setAttribute('aria-label', '觸控遊戲控制');
document.body.append(dock);
const pads = new Set();
const game = () => window.__game;
function releaseAll() { game()?.input.reset(); for (const reset of pads) reset(); }
function actionButton(label, action, parent, extra = '') {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  button.className = `touch-action ${extra}`; button.dataset.action = action;
  let pointer = null;
  const actual = () => action === 'confirm' ? Object.entries(game()?.input.mapping ?? {}).find(([, codes]) => codes.includes('Enter'))?.[0] : action;
  let heldAction = null;
  const release = () => { if (heldAction) game()?.input.setAction(heldAction, false); heldAction = null; pointer = null; button.classList.remove('held'); };
  button.addEventListener('pointerdown', event => {
    if (pointer !== null || game()?.paused || game()?.loading) return;
    event.preventDefault(); pointer = event.pointerId; button.setPointerCapture(pointer);
    heldAction = actual(); if (heldAction) game()?.input.setAction(heldAction, true);
    game()?.sound.unlock(); button.classList.add('held');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => { if (event.pointerId === pointer) release(); });
  // Allow assistive technology / keyboard activation without duplicating touch taps.
  button.addEventListener('click', event => {
    if (event.detail !== 0 || pointer !== null || game()?.paused) return;
    const key = actual(); if (key) { game()?.input.setAction(key, true); game()?.input.setAction(key, false); }
  });
  pads.add(release); parent.append(button); return button;
}
function stick(label, aim = false) {
  const wrap = document.createElement('div'); wrap.className = 'touch-stick-wrap';
  const pad = document.createElement('div'); pad.className = 'touch-stick'; pad.dataset.stick = aim ? 'aim' : 'move';
  pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', label);
  const knob = document.createElement('span'); knob.className = 'touch-knob'; pad.append(knob);
  const caption = document.createElement('span'); caption.textContent = label; wrap.append(pad, caption); dock.append(wrap);
  let pointer = null;
  const release = () => {
    pointer = null; knob.style.transform = ''; pad.classList.remove('held');
    if (aim) game()?.input.setAim(null);
    else for (const key of ['left', 'right', 'up', 'down']) game()?.input.setAction(key, false);
  };
  function move(event) {
    if (event.pointerId !== pointer) return;
    const r = pad.getBoundingClientRect(), radius = r.width * 0.36;
    let x = (event.clientX - r.left - r.width / 2) / radius, y = (event.clientY - r.top - r.height / 2) / radius;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    if (aim) game()?.input.setAim(length > 0.18 ? { x: x / (Math.hypot(x, y) || 1), y: y / (Math.hypot(x, y) || 1) } : null);
    else { const threshold = 0.22; for (const [key, held] of Object.entries({ left: x < -threshold, right: x > threshold, up: y < -threshold, down: y > threshold })) game()?.input.setAction(key, held); }
  }
  pad.addEventListener('pointerdown', event => {
    if (pointer !== null || game()?.paused || game()?.loading) return;
    event.preventDefault(); pointer = event.pointerId; pad.setPointerCapture(pointer); pad.classList.add('held'); game()?.sound.unlock(); move(event);
  });
  pad.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, event => { if (event.pointerId === pointer) release(); });
  pads.add(release);
}
function render() {
  releaseAll(); pads.clear(); dock.replaceChildren();
  const touch = mobile.matches || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch-device', touch); dock.hidden = !touch;
  if (!touch) return;
  const scene = game()?.sceneName ?? 'title';
  dock.dataset.scene = scene;
  if (scene !== 'play') {
    const menu = document.createElement('div'); menu.className = 'touch-menu'; dock.append(menu);
    if (scene === 'select') { actionButton('←', 'left', menu).setAttribute('aria-label', '上一位角色'); actionButton('→', 'right', menu).setAttribute('aria-label', '下一位角色'); }
    actionButton(scene === 'title' ? '開始遊戲' : scene === 'select' ? (id === 2 ? '選擇／上場' : '出擊') : '再玩一次', 'confirm', menu, 'primary-action');
    return;
  }
  stick('移動');
  const actions = document.createElement('div'); actions.className = 'touch-actions';
  if (id === 7) { stick('瞄準／射擊', true); actionButton('衝刺', 'dash', actions); actionButton('戰績', 'board', actions); }
  if (id === 2) { actionButton('投籃／封蓋', 'shoot', actions, 'primary-action'); actionButton('傳球／抄球', 'pass', actions); actionButton('換人', 'sw', actions); actionButton('衝刺', 'sprint', actions); }
  if (id === 11) { actionButton('炸彈', 'bomb', actions, 'primary-action'); actionButton('慢速', 'slow', actions); }
  dock.append(actions);
}
window.addEventListener('local:scene', render);
window.addEventListener('local:pause', releaseAll);
window.addEventListener('blur', releaseAll);
window.addEventListener('resize', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
mobile.addEventListener('change', render);
render();
