const boot = document.getElementById('loading');
function send(type, extra = {}) {
  if (parent !== window) parent.postMessage({ type, ...extra }, location.origin);
}
function fail(message) {
  boot.replaceChildren();
  boot.hidden = false;
  boot.style.display = 'grid';
  const label = document.createElement('p');
  label.textContent = '遊戲未能載入：' + message;
  const retry = document.createElement('button');
  retry.textContent = '重新載入'; retry.onclick = () => location.reload();
  boot.append(label, retry);
  send('collection:error', { message });
}
addEventListener('message', ({ source, origin, data }) => {
  if (source !== parent || origin !== location.origin || !data?.type) return;
  const g = window.game;
  if (!g || typeof g.pause !== 'function') return;
  if (data.type === 'collection:pause') g.pause();
  if (data.type === 'collection:resume') g.resume();
  if (data.type === 'collection:mute' && Boolean(g.sound.muted) !== data.muted) g.sound.toggleMute();
  if (data.type === 'collection:key') {
    window.dispatchEvent(new KeyboardEvent(data.down ? 'keydown' : 'keyup', { key: data.key, code: data.code, bubbles: true }));
  }
  send('collection:state', { paused: !!g.paused, muted: !!g.sound.muted });
});
addEventListener('error', e => send('collection:error', { message: e.message }));
addEventListener('unhandledrejection', e => send('collection:error', { message: String(e.reason) }));
try {
  await import(new URL('./bundle.js', location.href).href);
  boot.style.display = 'none';
  send('collection:ready');
  let previousState = '';
  setInterval(() => {
    const g = window.game;
    if (!g) return;
    const state = { paused: !!g.paused, muted: !!g.sound.muted };
    const key = JSON.stringify(state);
    if (key !== previousState) { previousState = key; send('collection:state', state); }
  }, 150);
} catch (error) { fail(error.message); }
