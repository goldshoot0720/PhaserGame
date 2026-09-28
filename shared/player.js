const frame = document.getElementById('game-frame');
const pauseButton = document.getElementById('pause');
const muteButton = document.getElementById('mute');
const status = document.getElementById('player-status');
const help = document.getElementById('help-dialog');
const restart = document.getElementById('restart-dialog');
let ready = false, paused = false, muted = false, resumeAfterDialog = false;
try { muted = localStorage.getItem('moe-muted') === '1'; } catch {}
const post = (type, extra = {}) => frame.contentWindow?.postMessage({ type: 'collection:' + type, ...extra }, location.origin);
function setPaused(value) { if (!ready) return; paused = value; post(value ? 'pause' : 'resume'); pauseButton.textContent = value ? '繼續' : '暫停'; if (!value) frame.contentWindow.focus(); }
function dialogOpen(dialog) { resumeAfterDialog = ready && !paused; setPaused(true); dialog.showModal(); }
function dialogClose() { if (resumeAfterDialog && !document.hidden) setPaused(false); resumeAfterDialog = false; }
pauseButton.onclick = () => setPaused(!paused);
muteButton.onclick = () => { muted = !muted; post('mute', { muted }); updateMute(); try { localStorage.setItem('moe-muted', muted ? '1' : '0'); } catch {} frame.contentWindow.focus(); };
function updateMute() { muteButton.textContent = muted ? '聲音：關' : '聲音：開'; muteButton.setAttribute('aria-pressed', String(muted)); }
document.getElementById('help').onclick = () => dialogOpen(help);
document.getElementById('close-help').onclick = () => help.close();
help.addEventListener('close', dialogClose); restart.addEventListener('close', dialogClose);
document.getElementById('restart').onclick = () => dialogOpen(restart);
document.getElementById('cancel-restart').onclick = () => restart.close();
document.getElementById('confirm-restart').onclick = () => { resumeAfterDialog = false; restart.close(); ready = false; paused = false; pauseButton.disabled = muteButton.disabled = true; pauseButton.textContent = '暫停'; status.hidden = false; status.textContent = '正在重新載入…'; frame.contentWindow.location.reload(); };
document.getElementById('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { status.hidden = false; status.textContent = '此瀏覽器無法切換全螢幕，請使用瀏覽器的全螢幕功能。'; }
};
document.addEventListener('visibilitychange', () => { if (document.hidden && ready && !paused) setPaused(true); });
window.addEventListener('message', ({ source, origin, data }) => {
  if (source !== frame.contentWindow || origin !== location.origin) return;
  if (data?.type === 'collection:ready') {
    ready = true; status.hidden = true; pauseButton.disabled = muteButton.disabled = false;
    post('mute', { muted }); updateMute();
    if (help.open || restart.open || document.hidden) setPaused(true); else frame.contentWindow.focus();
  }
  if (data?.type === 'collection:error') { status.hidden = false; status.textContent = '遊戲發生錯誤，可按「重新開始」重試：' + data.message; }
  if (data?.type === 'collection:state') {
    paused = data.paused; pauseButton.textContent = paused ? '繼續' : '暫停';
    muted = data.muted; updateMute();
    try { localStorage.setItem('moe-muted', muted ? '1' : '0'); } catch {}
  }
});
try {
  const games = await (await fetch('shared/catalog.json')).json();
  const id = Number(new URLSearchParams(location.search).get('game'));
  const game = games.find(g => g.id === id);
  if (!game) throw Error('請先從遊戲館選擇遊戲。');
  document.title = game.title + '｜萌友遊戲館'; document.getElementById('game-title').textContent = game.title;
  frame.title = game.title;
  frame.src = `Game${id}/complete/index.html` + (new URLSearchParams(location.search).has('webgl') ? '?webgl' : '');
  document.getElementById('guide-frame').src = `guides/Game${id}.html`;
} catch (e) { status.textContent = e.message; }
