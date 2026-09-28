document.querySelector('[data-pause]').addEventListener('click', event => {
  const game = window.__game;
  if (game) game.setPaused(!game.paused);
  event.currentTarget.blur();
});
document.querySelector('[data-mute]').addEventListener('click', event => {
  const sound = window.__game?.sound;
  if (!sound) return;
  sound.mute(!sound.muted);
  event.currentTarget.textContent = sound.muted ? '開啟聲音' : '靜音';
  event.currentTarget.setAttribute('aria-pressed', String(sound.muted));
  event.currentTarget.blur();
});
document.querySelector('[data-fullscreen]').addEventListener('click', async event => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { document.querySelector('[data-status]').textContent = '此瀏覽器未支援全螢幕，可使用視窗最大化。'; }
  event.currentTarget.blur();
});
window.addEventListener('pagehide', event => {
  if (event.persisted) window.__game?.setPaused(true);
  else window.__game?.destroy();
});
import './touch-controls.js';
