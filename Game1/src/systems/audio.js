// WebAudio 合成音效 + Web Speech API 實況語音
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('pawapuro-muted') === '1'; } catch (e) { /* ignore */ }

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('pawapuro-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.8;
  if (m && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function noiseBuffer(sec) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function ready() { return ctx && !muted; }

// 清脆擊球聲
export function sfxBat(power = 1) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(0.25);
  const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.8;
  const g = ctx.createGain(); env(g, t, 0.002, 0.9 * power, 0.12);
  n.connect(hp).connect(g).connect(master); n.start(t);
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.08);
  const g2 = ctx.createGain(); env(g2, t, 0.001, 0.5 * power, 0.09);
  o.connect(g2).connect(master); o.start(t); o.stop(t + 0.15);
}

// 捕手手套
export function sfxMitt() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
  const g = ctx.createGain(); env(g, t, 0.002, 0.9, 0.12);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.1);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g2 = ctx.createGain(); env(g2, t, 0.001, 0.6, 0.05);
  n.connect(lp).connect(g2).connect(master); n.start(t);
}

// 揮棒風切聲
export function sfxSwing() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.3);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
  const g = ctx.createGain(); env(g, t, 0.06, 0.35, 0.14);
  n.connect(bp).connect(g).connect(master); n.start(t);
}

// 觀眾歡呼
export function sfxCheer(sec = 2.2, vol = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(sec + 0.5);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.35);
  g.gain.setValueAtTime(vol, t + sec * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
  const lg = ctx.createGain(); lg.gain.value = 250;
  lfo.connect(lg).connect(bp.frequency); lfo.start(t); lfo.stop(t + sec);
  n.connect(bp).connect(g).connect(master); n.start(t); n.stop(t + sec + 0.1);
  // 喇叭聲
  [523, 659, 784].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const og = ctx.createGain(); env(og, t + 0.1 + i * 0.12, 0.01, 0.06 * vol * 2, 0.18);
    o.connect(og).connect(master); o.start(t + 0.1 + i * 0.12); o.stop(t + 0.5 + i * 0.12);
  });
}

// 裁判喊聲（合成「嘿」的母音）
export function sfxUmpire(kind = 'strike') {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const base = kind === 'out' ? 150 : 180;
  o.frequency.setValueAtTime(base * 1.3, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.35);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 5;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 6;
  const g = ctx.createGain(); env(g, t, 0.02, 0.7, 0.35);
  o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.45);
}

// 選單音
export function sfxBlip(f = 880) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = ctx.createGain(); env(g, t, 0.003, 0.12, 0.08);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.12);
}

// ---- 實況語音 ----
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = window.speechSynthesis.getVoices();
  voice = vs.find((v) => /zh[-_]TW/i.test(v.lang)) || vs.find((v) => /zh[-_]HK/i.test(v.lang)) ||
    vs.find((v) => /^zh/i.test(v.lang)) || null;
  return voice;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, { rate = 1.15, pitch = 1.1, interrupt = true } = {}) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    const s = window.speechSynthesis;
    if (interrupt) s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[「」!！]/g, (c) => (c === '!' || c === '！' ? '！' : '')));
    if (!voice) pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'zh-TW';
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    s.speak(u);
  } catch (e) { /* 語音失敗時忽略 */ }
}
