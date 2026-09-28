// Tiny synthesized sound effects via WebAudio. No audio files are used.

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ type = 'square', from, to = from, duration = 0.1, volume = 0.5, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise({ duration = 0.3, volume = 0.5, filterFrom = 3000, filterTo = 200, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrom, t);
  filter.frequency.exponentialRampToValueAtTime(filterTo, t + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const Sfx = {
  unlock: () => audio(),
  shoot: () => tone({ from: 880, to: 440, duration: 0.07, volume: 0.25 }),
  charged: () => { tone({ from: 300, to: 1200, duration: 0.18, volume: 0.35 }); noise({ duration: 0.15, volume: 0.2 }); },
  weapon: () => tone({ type: 'triangle', from: 600, to: 1400, duration: 0.12, volume: 0.35 }),
  jump: () => tone({ from: 300, to: 700, duration: 0.1, volume: 0.2 }),
  land: () => tone({ type: 'triangle', from: 160, to: 80, duration: 0.06, volume: 0.25 }),
  slide: () => noise({ duration: 0.12, volume: 0.15, filterFrom: 1500, filterTo: 400 }),
  enemyHit: () => tone({ from: 500, to: 200, duration: 0.06, volume: 0.25 }),
  tink: () => tone({ type: 'triangle', from: 1800, to: 1600, duration: 0.05, volume: 0.2 }),
  hurt: () => { tone({ from: 400, to: 120, duration: 0.25, volume: 0.4 }); noise({ duration: 0.15, volume: 0.2 }); },
  explode: () => noise({ duration: 0.5, volume: 0.5, filterFrom: 2000, filterTo: 80 }),
  death: () => { tone({ from: 700, to: 60, duration: 0.8, volume: 0.4 }); noise({ duration: 0.8, volume: 0.3 }); },
  pickup: () => [0, 0.06, 0.12].forEach((d, i) => tone({ from: 600 + i * 200, duration: 0.06, volume: 0.25, delay: d })),
  select: () => tone({ from: 1000, duration: 0.05, volume: 0.2 }),
  confirm: () => { tone({ from: 700, duration: 0.08, volume: 0.25 }); tone({ from: 1050, duration: 0.12, volume: 0.25, delay: 0.08 }); },
  door: () => tone({ type: 'sawtooth', from: 120, to: 90, duration: 0.4, volume: 0.25 }),
  bossAlarm: () => [0, 0.25, 0.5].forEach((d) => tone({ type: 'sawtooth', from: 440, to: 220, duration: 0.2, volume: 0.25, delay: d })),
  fanfare: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', from: f, duration: 0.18, volume: 0.25, delay: i * 0.16 })),
};
