// The fight: rounds, input, CPU, drawing.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, cover, drawFighter, type Frames } from '../art.js';
import { label, panel, clamp } from '../ui.js';
import { ROSTER, STAGES, MUSIC, ROUND_TIME, ROUNDS_TO_WIN, METER_MAX, GROUND_Y, hex } from '../roster.js';
import { Fight, NO_INPUT, type Input, type Body } from '../sim.js';
import { MOTIONS } from '../moves.js';
import { Cpu } from '../ai.js';
import { session } from '../session.js';

const STEP = 1 / 60;

export class FightScene extends Scene {
  private f!: Frames;
  private fight!: Fight;
  private cpu: Cpu | null = null;
  private acc = 0;
  private timer = ROUND_TIME;
  private round = 1;
  private wins: [number, number] = [0, 0];
  private phase: 'intro' | 'fight' | 'ko' | 'over' = 'intro';
  private phaseT = 0;
  private banner = '';
  private sub = '';
  private callout: { text: string; side: number; t: number } | null = null;
  private superFlash = 0;
  private t = 0;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    this.wins = [0, 0];
    this.round = 1;
    const sd = this.sound;
    sd.define('swing', { type: 'noise', duration: 0.08, volume: 0.2, filter: { type: 'bandpass', freq: 1500, freqEnd: 3000, q: 1 } });
    sd.define('hit', [{ type: 'noise', duration: 0.1, curve: 'exponential', volume: 0.6, filter: { type: 'lowpass', freq: 1800 } }, { type: 'square', freq: 220, freqEnd: 80, duration: 0.08, volume: 0.3 }]);
    sd.define('hitBig', [{ type: 'noise', duration: 0.22, curve: 'exponential', distortion: 0.3, volume: 0.8, filter: { type: 'lowpass', freq: 1200, freqEnd: 200 } }, { type: 'square', freq: 160, freqEnd: 50, duration: 0.15, volume: 0.35 }]);
    sd.define('block', { type: 'square', freq: 900, freqEnd: 600, duration: 0.06, volume: 0.25 });
    sd.define('special', { type: 'sawtooth', freq: 300, freqEnd: 900, duration: 0.25, volume: 0.25 });
    sd.define('super', { notes: 'C5 G5 C6 G6', step: 0.05, type: 'sawtooth', volume: 0.3 });
    sd.define('jump', { type: 'square', freq: 300, freqEnd: 500, duration: 0.06, volume: 0.1 });
    sd.define('land', { type: 'noise', duration: 0.05, volume: 0.12, filter: { type: 'lowpass', freq: 400 } });
    sd.define('bell', { notes: 'C6 G5 C6', step: 0.12, type: 'triangle', volume: 0.4 });
    if (!session.musicOn) { this.sound.music(MUSIC, { loop: true, volume: 0.3 }); session.musicOn = true; }
    this.newRound();
  }

  private newRound(): void {
    this.fight = new Fight(ROSTER[session.p1], ROSTER[session.p2], this.width);
    this.cpu = session.mode === 'cpu' ? new Cpu(1, session.difficulty) : null;
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.banner = this.wins[0] === ROUNDS_TO_WIN - 1 && this.wins[1] === ROUNDS_TO_WIN - 1 ? 'FINAL ROUND' : `ROUND ${this.round}`;
    this.sub = '';
    this.sound.play('bell');
  }

  private readP1(): Input {
    const k = (...c: string[]): boolean => this.input.key(...c);
    const solo = session.mode === 'cpu';
    return {
      left: k('KeyA') || (solo && k('ArrowLeft')), right: k('KeyD') || (solo && k('ArrowRight')),
      up: k('KeyW') || (solo && k('ArrowUp')), down: k('KeyS') || (solo && k('ArrowDown')),
      lp: k('KeyJ') || (solo && k('KeyZ')), hp: k('KeyK') || (solo && k('KeyX')), lk: k('KeyU') || (solo && k('KeyC')), hk: k('KeyI') || (solo && k('KeyV')),
      sp: k('KeyL') || (solo && k('KeyB')), su: k('KeyO') || (solo && k('KeyN')),
    };
  }
  private readP2(): Input {
    const k = (...c: string[]): boolean => this.input.key(...c);
    return {
      left: k('ArrowLeft'), right: k('ArrowRight'), up: k('ArrowUp'), down: k('ArrowDown'),
      lp: k('Numpad1', 'Comma'), hp: k('Numpad2', 'Period'), sp: k('Numpad3', 'Slash'),
      lk: k('Numpad4', 'Semicolon'), hk: k('Numpad5', 'Quote'), su: k('Numpad6', 'BracketRight'),
    };
  }

  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.input.keyPressed('Escape')) { this.game.go('select'); return; }
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(); }
    if (this.callout) { this.callout.t -= dt; if (this.callout.t <= 0) this.callout = null; }
    if (this.superFlash > 0) this.superFlash -= dt;
  }

  private tick(): void {
    const fight = this.fight;
    this.phaseT += STEP;
    let inputs: [Input, Input] = [NO_INPUT, NO_INPUT];
    if (this.phase === 'intro') {
      if (this.phaseT > 1.2 && this.banner !== 'FIGHT!') { this.banner = 'FIGHT!'; this.sound.play({ type: 'square', freq: 880, duration: 0.25, volume: 0.3 }); }
      if (this.phaseT > 1.9) { this.phase = 'fight'; this.banner = ''; }
    } else if (this.phase === 'fight') {
      inputs = [this.readP1(), this.cpu ? this.cpu.think(fight) : this.readP2()];
      if (fight.hitstop === 0) this.timer -= STEP;
    }
    fight.step(inputs);
    fight.settle();
    // Events → fx and sound.
    for (const h of fight.ev.hit) {
      const col = hex(h.color);
      this.game.fx.emit({ x: h.x, y: h.y, count: h.big ? 36 : h.blocked ? 10 : 20, speed: h.big ? 420 : 260, life: 0.3, size: h.big ? 9 : 6, colors: h.blocked ? ['#9fd8ff', '#ffffff'] : ['#ffffff', '#ffe066', col], add: true });
      if (h.big) this.camera.shake(8, 0.2);
    }
    for (const s of fight.ev.sfx) this.sound.play(s);
    for (const s of fight.ev.say) {
      const [who, name] = s.split(':');
      this.callout = { text: name, side: who === 'P1' ? 0 : 1, t: 1.2 };
      if (fight.hitstop >= 10) this.superFlash = 0.5;
    }

    if (this.phase === 'fight') {
      const [a, b] = fight.p;
      const ko = a.hp <= 0 || b.hp <= 0;
      if (ko || this.timer <= 0) {
        this.phase = 'ko'; this.phaseT = 0;
        let w = -1;
        if (a.hp <= 0 && b.hp > 0) w = 1; else if (b.hp <= 0 && a.hp > 0) w = 0;
        else if (!ko) w = a.hp / a.f.health > b.hp / b.f.health ? 0 : b.hp / b.f.health > a.hp / a.f.health ? 1 : -1;
        if (w >= 0) { this.wins[w]++; fight.p[w].state = 'win'; }
        this.banner = ko ? 'K.O.' : 'TIME UP';
        this.sub = w < 0 ? '平手' : `${fight.p[w].f.name} 勝利！`;
        this.sound.play(ko ? 'hitBig' : 'bell');
        if (ko) this.camera.flash('#ffffff', 0.25);
      }
    } else if (this.phase === 'ko' && this.phaseT > 3) {
      if (this.wins[0] >= ROUNDS_TO_WIN || this.wins[1] >= ROUNDS_TO_WIN) {
        session.winner = this.wins[0] >= ROUNDS_TO_WIN ? 0 : 1;
        session.score = [...this.wins] as [number, number];
        this.gotoGameOver();
        return;
      }
      this.round++;
      this.newRound();
    }
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height, g = this.game, fight = this.fight;
    cover(d, g, this.f.stages[session.stage], W, H);
    if (this.superFlash > 0) d.rect(0, 0, W, H, '#000000', clamp(this.superFlash * 1.4, 0, 0.6));
    // Shadows.
    for (const b of fight.p) {
      const sc = clamp(1 - (GROUND_Y - b.y) / 400, 0.4, 1);
      d.fill(this.ellipse(b.x, GROUND_Y + 4, 70 * sc * b.scale, 12 * sc), '#000000', 0.35);
    }
    // Draw the attacker on top.
    const order = fight.p[0].state === 'attack' ? [1, 0] : [0, 1];
    for (const i of order) this.drawBody(d, fight.p[i], i);
    // Projectiles.
    for (const s of fight.shots) {
      const c = hex(s.color);
      const wob = Math.sin(this.t * 20) * 4;
      if (s.style === 'bigwave') {
        d.circle(s.x, s.y, s.h / 2 + wob, c, 0.55); d.circle(s.x + Math.sign(s.vx) * 20, s.y, s.h / 3, '#ffffff', 0.6);
      } else {
        d.circle(s.x, s.y, s.h / 2 + wob * 0.5, c, 0.75); d.ring(s.x, s.y, s.h / 2, 4, '#ffffff', 0.8);
      }
      g.fx.emit({ x: s.x - Math.sign(s.vx) * s.w / 3, y: s.y, count: 1, speed: 30, life: 0.3, size: 8, color: c, add: true });
    }
    this.drawHud2(d, W, H);
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number): { x: number; y: number }[] {
    const p: { x: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
    return p;
  }

  private drawBody(d: Draw, b: Body, i: number): void {
    const g = this.game, f = b.f;
    let rot = 0, sx = 1, sy = 1, tint: string | undefined, dx = 0;
    const ph = b.phase();
    const pose = b.move?.pose ?? '';
    const act = ph === 'active';
    switch (b.state) {
      case 'crouch': sy = 0.68; sx = 1.08; break;
      case 'walk': rot = Math.sin(this.t * 14) * 0.04; break;
      case 'air': rot = b.vy < 0 ? -0.1 * b.facing : 0.08 * b.facing; break;
      case 'hitstun': rot = -0.25 * b.facing; tint = '#ff9090'; dx = -b.facing * 6; break;
      case 'blockstun': tint = '#a8d8ff'; dx = -b.facing * 4; break;
      case 'down': rot = -1.45 * b.facing; sy = 1; break;
      case 'ko': rot = -1.45 * b.facing; tint = '#cccccc'; break;
      case 'win': sy = 1 + Math.abs(Math.sin(this.t * 6)) * 0.05; break;
      case 'attack': {
        const lean = ph === 'startup' ? -0.08 : act ? 0.16 : 0.05;
        if (pose === 'punch' || pose === 'claw' || pose === 'cast') { rot = lean * b.facing; dx = act ? b.facing * 18 : 0; }
        else if (pose === 'kick' || pose === 'airkick') { rot = (act ? -0.35 : -0.1) * b.facing; dx = act ? b.facing * 14 : 0; }
        else if (pose === 'low') { sy = 0.66; sx = 1.1; rot = (act ? 0.12 : 0) * b.facing; }
        else if (pose === 'uppercut' || pose === 'rise') { sy = act ? 1.12 : 0.8; rot = (act ? -0.1 : 0.1) * b.facing; }
        else if (pose === 'slide') { rot = 1.25 * b.facing; sy = 0.9; }
        else if (pose === 'spin') { rot = (this.t * 30) % (Math.PI * 2); }
        else if (pose === 'flip') { rot = act ? -((b.frame * 0.35) % (Math.PI * 2)) * b.facing : 0; }
        else if (pose === 'pounce') { rot = 0.5 * b.facing; }
        else if (pose === 'counter') { tint = act ? '#bfe9ff' : undefined; }
        else if (pose === 'air') { rot = 0.2 * b.facing; }
        if (b.move?.fire && act) this.game.fx.emit({ x: b.x, y: b.y - f.height * 0.4, count: 3, speed: 60, life: 0.4, size: 10, ramp: 'fire', add: true });
        break;
      }
    }
    if (b.invuln > 0 && b.state !== 'attack' && Math.floor(this.t * 20) % 2) tint = '#ffffff';
    const yOff = b.state === 'down' || b.state === 'ko' ? f.height * 0.3 : 0;
    drawFighter(d, g, this.f.fighters[ROSTER.indexOf(f)], b.x + dx, b.y + yOff, f.height, b.facing, f.faceLeft, { rot, tint, sx, sy });
    // Attack swoosh on active frames.
    const hb = b.hitbox();
    if (hb) {
      const c = hex(f.color);
      const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
      d.line(cx - b.facing * hb.w * 0.5, cy + hb.h * 0.2, cx + b.facing * hb.w * 0.45, cy - hb.h * 0.15, Math.max(6, hb.h * 0.25), c, 0.55);
      d.circle(cx + b.facing * hb.w * 0.4, cy - hb.h * 0.1, Math.min(hb.h, 40) * 0.4, '#ffffff', 0.6);
    }
    if (b.state === 'blockstun') d.ring(b.x + b.facing * 40, b.y - f.height * 0.55, 40, 5, '#9fd8ff', 0.8);
    void i;
  }

  private drawHud2(d: Draw, W: number, H: number): void {
    const g = this.game, fight = this.fight;
    const bw = Math.min(480, W * 0.36);
    fight.p.forEach((b, i) => {
      const left = i === 0;
      const x = left ? 40 : W - 40 - bw;
      d.rect(x - 4, 26, bw + 8, 34, '#000000', 0.7);
      const r = clamp(b.hp / b.f.health, 0, 1);
      d.rect(x, 30, bw, 26, '#5a1010');
      const fillW = bw * r;
      d.rect(left ? x + bw - fillW : x, 30, fillW, 26, r < 0.25 ? '#ff5f3a' : '#ffd23f');
      label(d, g, `${b.f.name}｜${b.f.title}`, left ? x : x + bw, 76, { size: 22, color: '#ffffff', stroke: '#000000', strokeWidth: 4 }, left ? 0 : 1, 0.5);
      for (let k = 0; k < ROUNDS_TO_WIN; k++) d.circle(left ? x + bw - 14 - k * 26 : x + 14 + k * 26, 76, 9, k < this.wins[i] ? '#ffe066' : '#ffffff33');
      // Super meter.
      const mw = Math.min(300, W * 0.24), mx = left ? 40 : W - 40 - mw, my = H - 40;
      d.rect(mx - 3, my - 3, mw + 6, 20, '#000000', 0.7);
      const mr = b.meter / METER_MAX;
      d.rect(left ? mx : mx + mw - mw * mr, my, mw * mr, 14, mr >= 1 ? (Math.floor(this.t * 8) % 2 ? '#5cffb0' : '#ffffff') : '#3a8dff');
      label(d, g, mr >= 1 ? '超必殺 OK！' : 'SUPER', left ? mx : mx + mw, my - 14, { size: 16, color: mr >= 1 ? '#5cffb0' : '#cccccc', stroke: '#000000', strokeWidth: 3 }, left ? 0 : 1, 0.5);
      if (b.combo >= 2) label(d, g, `${b.combo} HIT COMBO`, left ? W - 60 : 60, 170, { size: 30, color: '#ffe066', stroke: '#6a1010', strokeWidth: 6, weight: 900 }, left ? 1 : 0, 0.5);
    });
    label(d, g, String(Math.max(0, Math.ceil(this.timer))), W / 2, 44, { size: 44, color: '#ffffff', stroke: '#000000', strokeWidth: 6, weight: 900 });
    if (this.callout) {
      const s = this.callout.side;
      label(d, g, this.callout.text, s === 0 ? 60 : W - 60, 230, { size: 38, color: '#ffffff', stroke: hex(fight.p[s].f.color), strokeWidth: 8, weight: 900 }, s === 0 ? 0 : 1, 0.5, clamp(this.callout.t * 2, 0, 1));
    }
    if (this.banner) label(d, g, this.banner, W / 2, H * 0.36, { size: 96, color: '#ffe066', stroke: '#3a0a0a', strokeWidth: 12, weight: 900 });
    if (this.sub) label(d, g, this.sub, W / 2, H * 0.48, { size: 40, color: '#ffffff', stroke: '#000000', strokeWidth: 6 });
    if (this.round === 1 && this.phase !== 'ko') {
      const sp = fight.p[0].f.special;
      const mo = sp.motion ? `${MOTIONS[sp.motion].label}+${sp.button === 'P' ? '拳' : '腳'}` : '';
      const keys = session.mode === 'cpu' ? '方向鍵/WASD 移動　Z/J 輕拳　X/K 重拳　C/U 輕腳　V/I 重腳　B/L 必殺　N/O 超必殺　後=防禦' : 'P1：WASD + J K U I L O　P2：方向鍵 + , . ; " / ] 或數字鍵 1-6';
      label(d, g, `${keys}　必殺技「${sp.name}」${mo}`, W / 2, H - 70, { size: 16, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    }
  }
}
