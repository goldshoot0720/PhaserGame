/**
 * 以 Web Audio 即時合成的音效（不需要任何音檔）。
 * 所有呼叫都包在 try/catch 裡，瀏覽器不支援時安靜失敗。
 */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.engine = null;
    this.drift = null;
    this.noiseBuf = null;
  }

  /** 需在使用者互動後呼叫 */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  get ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  tone(freq, dur, type = 'square', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ok) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }

  noise(dur, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0) {
    if (!this.ok) return;
    try {
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }

  // ---- 遊戲音效 ----
  click() { this.tone(880, 0.06, 'square', 0.12); }
  select() { this.tone(660, 0.08, 'square', 0.15); this.tone(990, 0.12, 'square', 0.15, null, 0.07); }
  countdown() { this.tone(520, 0.25, 'square', 0.25); }
  go() { this.tone(1040, 0.5, 'square', 0.3); this.tone(1560, 0.5, 'triangle', 0.15); }
  pickup() { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.18, null, i * 0.05)); }
  boost() { this.noise(0.7, 0.35, 900, 0.7, 'bandpass'); this.tone(220, 0.6, 'sawtooth', 0.12, 660); }
  instant() { this.tone(700, 0.15, 'square', 0.15, 1400); this.noise(0.3, 0.2, 2000, 1); }
  nitroReady() { this.tone(1200, 0.08, 'triangle', 0.18); this.tone(1600, 0.12, 'triangle', 0.18, null, 0.08); }
  hit() { this.tone(160, 0.35, 'sawtooth', 0.3, 50); this.noise(0.3, 0.3, 400, 0.8, 'lowpass'); }
  bump() { this.noise(0.12, 0.25, 300, 1, 'lowpass'); }
  wall() { this.noise(0.15, 0.25, 700, 1.5); }
  launch() { this.noise(0.5, 0.25, 1500, 0.8); this.tone(400, 0.4, 'sawtooth', 0.1, 900); }
  splash() { this.noise(0.6, 0.35, 600, 0.6, 'lowpass'); this.tone(300, 0.3, 'sine', 0.2, 120); }
  shield() { this.tone(500, 0.3, 'sine', 0.2, 1000); }
  lap() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, 'square', 0.15, null, i * 0.1)); }
  finish() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.18, null, i * 0.12)); }
  wrong() { this.tone(300, 0.2, 'square', 0.15); this.tone(240, 0.25, 'square', 0.15, null, 0.2); }

  /** 引擎持續音 */
  startEngine() {
    if (!this.ok || this.engine) return;
    try {
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o2.type = 'square';
      o.frequency.value = 60;
      o2.frequency.value = 30;
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.value = 0.0;
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start();
      o2.start();
      // 甩尾摩擦聲
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 2400;
      nf.Q.value = 3;
      const ng = this.ctx.createGain();
      ng.gain.value = 0;
      n.connect(nf);
      nf.connect(ng);
      ng.connect(this.master);
      n.start();
      this.engine = { o, o2, f, g, n, ng };
    } catch (e) {
      this.engine = null;
    }
  }

  updateEngine(speedRatio, drifting, boosting) {
    if (!this.engine || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const e = this.engine;
      const base = 55 + speedRatio * 150 + (boosting ? 40 : 0);
      e.o.frequency.setTargetAtTime(base, t, 0.05);
      e.o2.frequency.setTargetAtTime(base / 2, t, 0.05);
      e.f.frequency.setTargetAtTime(400 + speedRatio * 1400, t, 0.05);
      e.g.gain.setTargetAtTime(0.05 + speedRatio * 0.07, t, 0.05);
      e.ng.gain.setTargetAtTime(drifting ? 0.08 : 0, t, 0.04);
    } catch (err) { /* ignore */ }
  }

  stopEngine() {
    if (!this.engine) return;
    try {
      const e = this.engine;
      e.o.stop(); e.o2.stop(); e.n.stop();
      e.g.disconnect(); e.ng.disconnect();
    } catch (err) { /* ignore */ }
    this.engine = null;
  }

  muteEngine(m) {
    if (!this.engine || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      if (m) {
        this.engine.g.gain.setTargetAtTime(0, t, 0.02);
        this.engine.ng.gain.setTargetAtTime(0, t, 0.02);
      }
    } catch (err) { /* ignore */ }
  }
}

export const Sound = new SoundFX();
