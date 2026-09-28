// Tiny synthesized sound effects via the Web Audio API (no audio files needed).
let ctx = null;
let master = null;
let noiseBuffer = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ type = 'square', from, to = from, dur = 0.1, vol = 0.5, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.5, freq = 1200, q = 1, type = 'bandpass', delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const Sfx = {
  unlock: () => audio(),
  whoosh: () => noise({ dur: 0.09, vol: 0.18, freq: 2400, q: 0.8 }),
  hitLight: () => { noise({ dur: 0.08, vol: 0.5, freq: 1800 }); tone({ type: 'square', from: 220, to: 90, dur: 0.07, vol: 0.25 }); },
  hitHeavy: () => { noise({ dur: 0.16, vol: 0.7, freq: 900 }); tone({ type: 'sawtooth', from: 160, to: 45, dur: 0.16, vol: 0.4 }); },
  block: () => { tone({ type: 'triangle', from: 1400, to: 900, dur: 0.06, vol: 0.3 }); noise({ dur: 0.04, vol: 0.2, freq: 4000 }); },
  special: () => tone({ type: 'sawtooth', from: 200, to: 900, dur: 0.25, vol: 0.2 }),
  superFlash: () => { tone({ type: 'square', from: 300, to: 1600, dur: 0.4, vol: 0.2 }); tone({ type: 'sine', from: 80, to: 60, dur: 0.5, vol: 0.4 }); },
  jump: () => tone({ type: 'sine', from: 300, to: 600, dur: 0.08, vol: 0.12 }),
  land: () => noise({ dur: 0.06, vol: 0.2, freq: 300, type: 'lowpass' }),
  ko: () => { tone({ type: 'sawtooth', from: 400, to: 40, dur: 1.0, vol: 0.4 }); noise({ dur: 0.6, vol: 0.5, freq: 500, type: 'lowpass' }); },
  cursor: () => tone({ type: 'square', from: 880, dur: 0.04, vol: 0.12 }),
  confirm: () => { tone({ type: 'square', from: 660, dur: 0.06, vol: 0.15 }); tone({ type: 'square', from: 990, dur: 0.1, vol: 0.15, delay: 0.06 }); },
  announce: () => { tone({ type: 'sawtooth', from: 220, to: 330, dur: 0.3, vol: 0.2 }); tone({ type: 'square', from: 440, to: 660, dur: 0.3, vol: 0.12 }); },
  tick: () => tone({ type: 'sine', from: 1200, dur: 0.03, vol: 0.08 }),
};
