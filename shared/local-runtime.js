// Browser-only Canvas 2D backend for the drawing/input API used by Game2/7/11.
// Independently implemented here; the cloud engine and published bundles are not required.
export function localAsset(url) {
  const prefix = 'https://gameblocks.nyc3.digitaloceanspaces.com/';
  return url.startsWith(prefix) ? `/shared/media/${url.slice(prefix.length)}` : url;
}

export class Input {
  constructor(canvas, camera, unlock, aimOrigin = () => null) {
    this.canvas = canvas; this.camera = camera; this.codes = new Set();
    this.previous = new Set(); this.pressed = new Set(); this.released = new Set(); this.mapping = {}; this.keys = {}; this.position = null;
    this.down = false; this.aimOrigin = aimOrigin; this.virtualAim = null; this.abort = new AbortController();
    const on = (target, event, fn) => target.addEventListener(event, fn, { signal: this.abort.signal });
    on(window, 'keydown', e => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(e.target.tagName)) return;
      if (Object.values(this.mapping).some(codes => codes.includes(e.code))) {
        e.preventDefault(); if (!this.codes.has(e.code)) this.pressed.add(e.code); this.codes.add(e.code); unlock();
      }
    });
    on(window, 'keyup', e => { if (this.codes.has(e.code)) this.released.add(e.code); this.codes.delete(e.code); });
    on(window, 'blur', () => this.reset());
    on(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    on(canvas, 'pointermove', e => this.locate(e));
    on(canvas, 'pointerdown', e => {
      if (e.button !== 0) return;
      this.locate(e); this.down = true; this.tap = true; canvas.setPointerCapture(e.pointerId); unlock();
    });
    on(canvas, 'pointerup', () => { this.down = false; });
    on(canvas, 'pointercancel', () => this.reset());
    on(canvas, 'lostpointercapture', () => { this.down = false; });
    on(canvas, 'contextmenu', e => e.preventDefault());
  }
  locate(e) {
    const r = this.canvas.getBoundingClientRect();
    this.position = { x: (e.clientX - r.left) * this.canvas.width / r.width,
      y: (e.clientY - r.top) * this.canvas.height / r.height };
  }
  get pointer() {
    const origin = this.aimOrigin();
    if (this.virtualAim && origin) return { x: origin.x + this.virtualAim.x * 240,
      y: origin.y + this.virtualAim.y * 240, isDown: true };
    return this.position && { x: this.position.x + this.camera().x,
      y: this.position.y + this.camera().y, isDown: this.down || !!this.tap };
  }
  bind(mapping) {
    this.mapping = mapping;
    this.keys = Object.fromEntries(Object.keys(mapping).map(k => [k, { held: false, pressed: false, released: false }]));
  }
  setAction(action, held) {
    const code = `@${action}`;
    if (held) { if (!this.codes.has(code)) this.pressed.add(code); this.codes.add(code); }
    else { if (this.codes.has(code)) this.released.add(code); this.codes.delete(code); }
  }
  setAim(vector) { this.virtualAim = vector; }
  tick() {
    for (const [key, boundCodes] of Object.entries(this.mapping)) {
      const codes = [...boundCodes, `@${key}`];
      const held = codes.some(c => this.codes.has(c));
      const before = codes.some(c => this.previous.has(c));
      Object.assign(this.keys[key], { held, pressed: codes.some(c => this.pressed.has(c)) || held && !before,
        released: codes.some(c => this.released.has(c)) || !held && before });
    }
  }
  end() { this.previous = new Set(this.codes); this.pressed.clear(); this.released.clear(); this.tap = false; }
  reset() { this.codes.clear(); this.previous.clear(); this.pressed.clear(); this.released.clear(); this.down = false; this.tap = false; this.virtualAim = null; }
  destroy() { this.abort.abort(); this.reset(); }
}

class Assets {
  constructor() { this.images = new Map(); this.frames = []; this.groups = new Map(); }
  async load(url) {
    if (this.images.has(url)) return this.images.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`素材載入失敗：${localAsset(url)}`));
      image.src = localAsset(url);
    });
    this.images.set(url, promise);
    const image = await promise;
    this.images.set(url, image);
    return image;
  }
  framesOf(url, w, h) {
    const key = `${url}:${w}:${h}`;
    if (this.groups.has(key)) return this.groups.get(key);
    const image = this.images.get(url);
    if (!image?.naturalWidth) throw new Error(`素材尚未就緒：${url}`);
    w ||= image.naturalWidth; h ||= image.naturalHeight;
    const start = this.frames.length;
    for (let y = 0; y + h <= image.naturalHeight; y += h)
      for (let x = 0; x + w <= image.naturalWidth; x += w) this.frames.push({ image, x, y, w, h });
    this.groups.set(key, start);
    return start;
  }
  frameSize(id) { const { w, h } = this.frames[id]; return { w, h }; }
  // Keep text as lightweight data. Dynamic scores do not allocate GPU textures.
  unicodeText(text, options) { return { text, options }; }
}

class Draw {
  constructor(context, assets) { this.c = context; this.assets = assets; this.tints = new Map(); }
  paint(color, alpha, fn) {
    const c = this.c; c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.fillStyle = c.strokeStyle = color; fn(c); c.restore();
  }
  rect(x, y, w, h, color, alpha = 1, rot = 0) {
    this.paint(color, alpha, c => { c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.fillRect(-w / 2, -h / 2, w, h); });
  }
  circle(x, y, r, color, alpha = 1) {
    this.paint(color, alpha, c => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fill(); });
  }
  ring(x, y, r, width, color, alpha = 1) {
    this.paint(color, alpha, c => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.lineWidth = width; c.stroke(); });
  }
  line(x, y, x2, y2, width, color, alpha = 1) { this.poly([{ x, y }, { x: x2, y: y2 }], width, color, alpha); }
  path(c, pts) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); }
  poly(pts, width, color, alpha = 1) { this.paint(color, alpha, c => { this.path(c, pts); c.lineWidth = width; c.stroke(); }); }
  fill(pts, color, alpha = 1) { this.paint(color, alpha, c => { this.path(c, pts); c.closePath(); c.fill(); }); }
  sprite(id, x, y, opts = {}) {
    const f = this.assets.frames[id];
    if (!f) throw new Error(`Unknown sprite frame ${id}`);
    const c = this.c, w = opts.w ?? f.w, h = opts.h ?? f.h;
    c.save(); c.globalAlpha = opts.alpha ?? 1;
    c.translate(x + w / 2, y + h / 2); c.rotate(opts.rot ?? 0);
    c.scale(opts.flipX ? -1 : 1, opts.flipY ? -1 : 1);
    if (opts.tint) {
      const key = `${id}:${opts.tint}`;
      if (!this.tints.has(key)) {
        const canvas = document.createElement('canvas'); canvas.width = f.w; canvas.height = f.h;
        const t = canvas.getContext('2d'); t.drawImage(f.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.5; t.fillStyle = opts.tint; t.fillRect(0, 0, f.w, f.h);
        if (this.tints.size >= 128) this.tints.delete(this.tints.keys().next().value);
        this.tints.set(key, canvas);
      }
      c.drawImage(this.tints.get(key), -w / 2, -h / 2, w, h);
    } else c.drawImage(f.image, f.x, f.y, f.w, f.h, -w / 2, -h / 2, w, h);
    c.restore();
  }
  unicodeText(block, x, y, { origin = { x: 0, y: 0 }, alpha = 1 } = {}) {
    const c = this.c, o = block.options, size = o.fontSize ?? 24;
    c.save(); c.font = `${o.fontWeight ?? 700} ${size}px ${o.fontFamily ?? 'sans-serif'}`;
    const lines = [];
    for (const paragraph of String(block.text).split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (o.maxWidth && line && c.measureText(line + char).width > o.maxWidth) { lines.push(line); line = ''; }
        line += char;
      }
      lines.push(line);
    }
    const width = Math.max(...lines.map(line => c.measureText(line).width));
    const lineHeight = size * 1.25, height = lines.length * lineHeight;
    c.globalAlpha = alpha; c.textBaseline = 'middle'; c.fillStyle = o.color ?? '#fff';
    const left = x - width * origin.x, top = y - height * origin.y;
    lines.forEach((line, i) => {
      const dx = o.align === 'center' ? (width - c.measureText(line).width) / 2 : o.align === 'right' ? width - c.measureText(line).width : 0;
      if (o.stroke) { c.strokeStyle = o.stroke.color; c.lineWidth = o.stroke.width; c.lineJoin = o.stroke.join ?? 'round'; c.strokeText(line, left + dx, top + (i + 0.5) * lineHeight); }
      c.fillText(line, left + dx, top + (i + 0.5) * lineHeight);
    });
    c.restore();
  }
}

export class Effects {
  constructor() { this.particles = []; }
  emit({ x, y, count = 20, speed = 160, life = 0.5, size = 5, colors, color, ramp, add = false }) {
    const palette = colors ?? (ramp === 'ice' ? ['#ffffff', '#b8edff', '#59b5ff'] : [color ?? '#ffffff']);
    const available = Math.min(count, 1600 - this.particles.length);
    for (let i = 0; i < available; i++) {
      const angle = Math.random() * Math.PI * 2, velocity = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
        life, maxLife: life, size, color: palette[i % palette.length], add });
    }
  }
  update(dt) {
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.particles = this.particles.filter(p => p.life > 0);
  }
  draw(d) {
    for (const p of this.particles) {
      d.c.save(); if (p.add) d.c.globalCompositeOperation = 'lighter';
      d.circle(p.x, p.y, p.size * (0.3 + 0.7 * p.life / p.maxLife), p.color, p.life / p.maxLife); d.c.restore();
    }
  }
}

class Sound {
  constructor() { this.definitions = new Map(); this.muted = false; }
  unlock() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!this.context && Audio) {
      this.context = new Audio(); this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45; this.master.connect(this.context.destination);
    }
    this.context?.resume().catch(() => {});
    if (this.track?.paused && !this.suspended) this.track.play().catch(() => {});
  }
  define(key, spec) { this.definitions.set(key, spec); }
  play(value) {
    const s = typeof value === 'string' ? this.definitions.get(value) : value;
    if (!s || !this.context || this.context.state !== 'running') return;
    if (s.notes) {
      let at = 0;
      for (const token of s.notes.split(/\s+/)) {
        const match = /^([A-G])([#b]?)(\d)(?::([\d.]+))?$/.exec(token);
        if (!match) continue;
        const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
        const midi = (+match[3] + 1) * 12 + semitone + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
        const duration = (s.step ?? 0.1) * +(match[4] ?? 1);
        this.tone({ ...s, notes: null, freq: 440 * 2 ** ((midi - 69) / 12), duration }, at); at += duration;
      }
    } else this.tone(s);
  }
  tone(s, delay = 0) {
    const c = this.context, time = c.currentTime + delay, duration = Math.max(0.015, s.duration ?? 0.1);
    const gain = c.createGain(); gain.gain.setValueAtTime(Math.max(0.001, s.volume ?? 0.2), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration); gain.connect(this.master);
    let source;
    if (s.type === 'noise') {
      source = c.createBufferSource(); const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
      const samples = buffer.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
    } else {
      source = c.createOscillator(); source.type = s.type ?? 'sine'; source.frequency.setValueAtTime(s.freq ?? 440, time);
      if (s.freqEnd) source.frequency.exponentialRampToValueAtTime(Math.max(1, s.freqEnd), time + duration);
    }
    let filter;
    if (s.filter) {
      filter = c.createBiquadFilter(); filter.type = s.filter.type; filter.frequency.setValueAtTime(s.filter.freq, time);
      if (s.filter.freqEnd) filter.frequency.exponentialRampToValueAtTime(s.filter.freqEnd, time + duration);
      filter.Q.value = s.filter.q ?? 1; source.connect(filter); filter.connect(gain);
    } else source.connect(gain);
    source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    source.start(time); source.stop(time + duration);
  }
  music(url, { loop = true, volume = 0.3 } = {}) {
    if (this.track?.dataset.source === url) return;
    this.track?.pause(); this.track = new Audio(localAsset(url)); this.track.dataset.source = url;
    this.track.loop = loop; this.track.volume = volume; this.track.muted = this.muted;
    this.track.play().catch(() => {});
  }
  mute(value) { this.muted = value; if (this.master) this.master.gain.value = value ? 0 : 0.45; if (this.track) this.track.muted = value; }
  suspend(value) {
    this.suspended = value;
    if (value) { this.track?.pause(); this.context?.suspend().catch(() => {}); }
    else this.unlock();
  }
  destroy() { this.track?.pause(); this.context?.close(); }
}

export class Scene {
  get width() { return this.game.canvas.width; }
  get height() { return this.game.canvas.height; }
  get input() { return this.game.input; }
  get sound() { return this.game.sound; }
  preload() {}
  setup() {}
  update() {}
  draw() {}
  gotoTitle() { this.game.go('title'); }
  gotoPlay() { this.game.go('play'); }
  gotoGameOver() { this.game.go('gameOver'); }
}

export class Game {
  static async create(options) {
    const game = new Game(options); await game.go('title'); return game;
  }
  constructor(options) {
    this.options = options; this.assets = new Assets(); this.sound = new Sound(); this.fx = new Effects(); this.paused = false;
    this.canvas = document.createElement('canvas'); this.canvas.height = options.worldHeight ?? 768;
    this.canvas.width = Math.round(this.canvas.height * 16 / 9);
    this.canvas.setAttribute('aria-label', document.title); this.canvas.tabIndex = 0;
    document.querySelector(options.container).append(this.canvas);
    this.context = this.canvas.getContext('2d'); this.drawAPI = new Draw(this.context, this.assets);
    this.input = new Input(this.canvas, () => this.scene?.camera ?? { x: 0, y: 0 }, () => this.sound.unlock(), () => this.scene?.me);
    this.status = document.querySelector('[data-status]');
    this.abort = new AbortController();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setPaused(true); }, { signal: this.abort.signal });
    window.addEventListener('blur', () => this.setPaused(true), { signal: this.abort.signal });
    window.__game = this;
  }
  async go(name) {
    if (this.loading) return;
    const Type = this.options.scenes[name];
    if (!Type) throw new Error(`Unknown scene: ${name}`);
    this.loading = true;
    try {
      if (this.status) this.status.textContent = '載入素材…';
      const scene = new Type(); scene.game = this;
      scene.camera = { x: 0, y: 0, time: 0, strength: 0, shake(strength, time) { this.strength = strength; this.time = time; } };
      const urls = new Set(); scene.preload({ image: url => urls.add(url) });
      await Promise.all([...urls].map(url => this.assets.load(url)));
      this.scene?.destroy?.(); this.fx.particles = []; this.input.reset(); this.scene = scene; this.sceneName = name;
      scene.setup(); this.last = performance.now();
      window.dispatchEvent(new CustomEvent('local:scene', { detail: name }));
      if (this.status) this.status.textContent = '';
    } catch (error) { this.failed = true; this.error = error.message; if (this.status) this.status.textContent = `${error.message}；請重新整理後重試。`; console.error(error); }
    finally { this.loading = false; }
  }
  setPaused(value) {
    this.paused = value; this.input.reset(); this.last = performance.now(); this.sound.suspend(value);
    window.dispatchEvent(new CustomEvent('local:pause', { detail: value }));
    const button = document.querySelector('[data-pause]'); if (button) button.textContent = value ? '繼續遊戲' : '暫停';
  }
  run() {
    this.last = performance.now();
    const frame = now => {
      if (this.destroyed) return;
      this.animation = requestAnimationFrame(frame);
      const dt = Math.min(0.04, Math.max(0, (now - this.last) / 1000)); this.last = now;
      if (!this.scene || this.loading || this.failed) return;
      try {
        if (!this.paused) { this.input.tick(); this.scene.update(dt); this.fx.update(dt); this.input.end(); }
        const c = this.context, camera = this.scene.camera;
        c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = this.options.background; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
        c.save();
        camera.time = Math.max(0, camera.time - (this.paused ? 0 : dt));
        const shake = camera.time > 0 ? camera.strength : 0;
        c.translate(-camera.x + (Math.random() - 0.5) * shake, -camera.y + (Math.random() - 0.5) * shake);
        this.scene.draw(this.drawAPI); this.fx.draw(this.drawAPI); c.restore();
        if (this.paused) {
          this.drawAPI.rect(0, 0, this.canvas.width, this.canvas.height, '#071321', 0.72);
          this.drawAPI.unicodeText({ text: '已暫停｜按上方「繼續遊戲」', options: { fontSize: 32 } }, this.canvas.width / 2, this.canvas.height / 2, { origin: { x: 0.5, y: 0.5 } });
        }
      } catch (error) { this.failed = true; this.error = error.message; if (this.status) this.status.textContent = `執行錯誤：${error.message}`; console.error(error); }
    };
    this.animation = requestAnimationFrame(frame);
  }
  destroy() { this.destroyed = true; cancelAnimationFrame(this.animation); this.input.destroy(); this.abort.abort(); this.sound.destroy(); this.scene?.destroy?.(); this.canvas.remove(); }
}
