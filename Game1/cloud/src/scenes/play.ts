import { mobilePointer } from '../mobile.js';
// Play: catcher's-view at-bats. When the user's team bats they steer a meet cursor
// and time a swing; when it fields they pick a pitch, aim it and throw.
import { Scene, type Draw, type Preload } from '../../engine/webgpu.js';
import { preloadArt, registerArt, drawStadium, drawChar, type Frames, type Field } from '../art.js';
import { label, panel, button, clamp, lerp, inside, type Rect } from '../ui.js';
import { PITCH_TYPES, ZONE_W, ZONE_H, CURSOR_SPEED, SWING_WINDOW, type PitchName } from '../data.js';
import { GameState, OUTCOME_TEXT, HIT_BASES, type PitchOutcome } from '../rules.js';
import { makePitch, pitchPos, resolveSwing, cpuBat, cpuPitch, inZone, meetRadius, type Pitch } from '../sim.js';
import { session } from '../session.js';
import { prepareBatters, batterPose, drawBatter, SWING_CONTACT } from '../batter.js';

type Phase = 'ready' | 'aim' | 'windup' | 'flight' | 'result' | 'half';

const rng = Math.random;
const WINDUP = 0.7;
const RESULT_TIME = 1.9;

export class Play extends Scene {
  private f!: Frames;
  private gs!: GameState;
  private field: Field | null = null;
  private phase: Phase = 'ready';
  private timer = 0;
  private t = 0;
  private pitch: Pitch | null = null;
  private flightT = 0;              // seconds since release
  private cur = { x: 0, y: 0 };     // cursor in zone units (bat cursor or pitch aim)
  private swung = false;
  private swingAt = -1;             // flight time at which the user swung
  private cpuResult: PitchOutcome | null = null;
  private cpuSwingShown = false;
  private outcome: PitchOutcome | null = null;
  private note = '';
  private hitBall: { t: number; ang: number; kind: PitchOutcome } | null = null;
  private selPitch: PitchName = '直球';
  private wasDown = false;
  private lastPtr = { x: 0, y: 0 };
  private halfBanner = '';
  private halfChanged = false;
  private pitchBtns: { name: PitchName; r: Rect }[] = [];
  private swingAnim = -1;
  private pitchBatterId: string | null = null;

  override preload(load: Preload): void { preloadArt(load); }

  override setup(): void {
    this.f = registerArt(this.game);
    prepareBatters(this.game);
    this.gs = GameState.forUser(session.team);
    this.input.bind({
      act: ['Space', 'Enter'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      p1: ['Digit1'], p2: ['Digit2'], p3: ['Digit3'], p4: ['Digit4'],
    });
    this.sound.define('crack', [{ type: 'noise', duration: 0.12, curve: 'exponential', volume: 0.9, filter: { type: 'highpass', freq: 1800 } }, { type: 'square', freq: 1200, freqEnd: 300, duration: 0.08, volume: 0.3 }]);
    this.sound.define('mitt', { type: 'noise', duration: 0.09, curve: 'exponential', volume: 0.7, filter: { type: 'lowpass', freq: 900 } });
    this.sound.define('whoosh', { type: 'noise', duration: 0.25, volume: 0.25, filter: { type: 'bandpass', freq: 600, freqEnd: 2400, q: 2 } });
    this.sound.define('cheer', { type: 'noise', duration: 1.4, attack: 0.2, volume: 0.35, filter: { type: 'bandpass', freq: 1400, q: 0.7 } });
    this.startHalf();
  }

  // ── helpers ──
  private get userBatting(): boolean { return this.gs.battingTeam.id === session.team; }
  private zoneCenter(): { x: number; y: number } {
    const f = this.field;
    return f ? { x: f.plate.x, y: f.plate.y - 200 } : { x: this.centerX, y: this.height - 290 };
  }
  private zoneToWorld(x: number, y: number): { x: number; y: number } {
    const c = this.zoneCenter();
    return { x: c.x + (x * ZONE_W) / 2, y: c.y + (y * ZONE_H) / 2 };
  }
  private worldToZone(x: number, y: number): { x: number; y: number } {
    const c = this.zoneCenter();
    return { x: ((x - c.x) * 2) / ZONE_W, y: ((y - c.y) * 2) / ZONE_H };
  }

  private startHalf(): void {
    const gs = this.gs;
    this.halfBanner = `${gs.inning} 局${gs.top ? '上' : '下'}　${gs.battingTeam.name} 進攻`;
    this.phase = 'half';
    this.timer = 1.8;
    this.pitch = null;
    this.hitBall = null;
  }

  private newAtBatPitch(): void {
    this.pitch = null;
    this.pitchBatterId = this.gs.batter.id;
    this.outcome = null;
    this.hitBall = null;
    this.swingAt = -1;
    this.swung = false;
    this.swingAnim = -1;
    this.cpuResult = null;
    this.cpuSwingShown = false;
    this.cur = { x: 0, y: 0 };
    if (this.userBatting) {
      this.phase = 'ready';
      this.timer = 0.9;
    } else {
      this.phase = 'aim';
      if (!this.gs.pitcher.pitches.includes(this.selPitch)) this.selPitch = this.gs.pitcher.pitches[0];
    }
  }

  private release(type: PitchName, aimX: number, aimY: number): void {
    this.pitch = makePitch(this.gs.pitcher, type, aimX, aimY, rng);
    this.phase = 'windup';
    this.timer = WINDUP;
    this.flightT = 0;
    if (!this.userBatting) this.cpuResult = cpuBat(this.gs.batter, this.pitch, rng);
  }

  private finishPitch(o: PitchOutcome): void {
    const gs = this.gs;
    const beforeHalf = `${gs.inning}${gs.top}`;
    this.outcome = o;
    gs.apply(o);
    this.note = gs.lastNote || OUTCOME_TEXT[o];
    this.phase = 'result';
    const inPlay = !!HIT_BASES[o] || o.endsWith('out');
    this.timer = inPlay ? RESULT_TIME + 0.4 : 1.1;
    const contact = o !== 'ball' && o !== 'strike';
    if (contact) {
      this.sound.play('crack');
      const c = this.zoneToWorld(this.pitch?.endX ?? 0, this.pitch?.endY ?? 0);
      this.game.fx.emit({ x: c.x, y: c.y, count: 26, speed: 260, life: 0.4, size: 5, colors: ['#ffffff', '#ffe066'], add: true });
      this.hitBall = { t: 0, ang: o === 'foul' ? (rng() < 0.5 ? -1.1 : 1.1) : (rng() - 0.5) * 1.2, kind: o };
    } else {
      this.sound.play('mitt');
    }
    if (o === 'homerun') { this.sound.play('cheer'); this.camera.shake(8, 0.5); }
    else if (HIT_BASES[o]) this.sound.play('cheer');
    if (gs.lastNote.startsWith('三振')) this.sound.play({ notes: 'E5 C5', step: 0.09, type: 'triangle', volume: 0.4 });
    this.halfChanged = beforeHalf !== `${gs.inning}${gs.top}`;
  }

  // ── update ──
  override update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.swingAnim >= 0) this.swingAnim += dt;
    const k = this.input.keys;
    const p = mobilePointer(this.input.pointer);
    const down = !!p?.isDown;
    const click = down && !this.wasDown;
    this.wasDown = down;

    // Cursor: keyboard or mouse (whichever moved last).
    const canMove = !this.userBatting && this.phase === 'aim';
    if (canMove) {
      const sp = (CURSOR_SPEED * dt * 2) / ZONE_W;
      if (k.left.held) this.cur.x -= sp;
      if (k.right.held) this.cur.x += sp;
      if (k.up.held) this.cur.y -= sp * (ZONE_W / ZONE_H);
      if (k.down.held) this.cur.y += sp * (ZONE_W / ZONE_H);
      if (p && (Math.abs(p.x - this.lastPtr.x) > 0.5 || Math.abs(p.y - this.lastPtr.y) > 0.5)) {
        const z = this.worldToZone(p.x, p.y);
        this.cur.x = z.x; this.cur.y = z.y;
      }
      const lim = this.userBatting ? 1.35 : 1.7;
      this.cur.x = clamp(this.cur.x, -lim, lim);
      this.cur.y = clamp(this.cur.y, -lim, lim);
    }
    if (p) this.lastPtr = { x: p.x, y: p.y };
    // Batting: the meet circle follows the ball on its own; the player only times the swing.
    // It chases the pitch's projected crossing point, so late breakers still leave some error.
    if (this.userBatting && this.phase === 'flight' && this.pitch) {
      const pt = this.pitch;
      const aim = pitchPos(pt, clamp(this.flightT / pt.time, 0, 1));
      const f = 1 - Math.exp(-dt * (9 + this.gs.batter.meet / 10));
      this.cur.x += (aim.x - this.cur.x) * f;
      this.cur.y += (aim.y - this.cur.y) * f;
    }

    switch (this.phase) {
      case 'half':
        this.timer -= dt;
        if (this.timer <= 0) this.newAtBatPitch();
        break;
      case 'ready':
        this.timer -= dt;
        if (this.timer <= 0) {
          const c = cpuPitch(this.gs.pitcher, this.gs.balls, this.gs.strikes, rng);
          this.release(c.type, c.aimX, c.aimY);
        }
        break;
      case 'aim': {
        const ps = this.gs.pitcher.pitches;
        [k.p1, k.p2, k.p3, k.p4].forEach((key, i) => { if (key.pressed && ps[i]) this.selPitch = ps[i]; });
        let clickedBtn = false;
        if (click) for (const b of this.pitchBtns) if (inside(p, b.r)) { this.selPitch = b.name; clickedBtn = true; }
        const plateY = this.field ? this.field.plate.y : this.height;
        if (k.act.pressed || (click && !clickedBtn && p && p.y < plateY)) this.release(this.selPitch, this.cur.x, this.cur.y);
        break;
      }
      case 'windup':
        // Presses before the ball leaves the hand are ignored rather than burning the swing.
        this.timer -= dt;
        if (this.timer <= 0) { this.phase = 'flight'; this.sound.play('whoosh'); }
        break;
      case 'flight': {
        this.flightT += dt;
        const pt = this.pitch!;
        if (this.userBatting) {
          if (!this.swung && (k.act.pressed || click)) this.swing(this.flightT);
          if (this.swung && this.flightT >= this.swingAt + SWING_CONTACT && Math.abs(this.swingAt + SWING_CONTACT - pt.time) <= SWING_WINDOW) {
            // Judge the barrel arrival, then show the contact pose with the crack/ball launch.
            this.swingAnim = SWING_CONTACT;
            const dist = Math.hypot(this.cur.x - pt.endX, this.cur.y - pt.endY);
            this.finishPitch(resolveSwing(this.gs.batter, this.swingAt + SWING_CONTACT - pt.time, dist, rng));
          } else if (this.flightT >= pt.time + SWING_WINDOW + 0.01) {
            this.finishPitch(this.swung ? 'strike' : inZone(pt.endX, pt.endY) ? 'strike' : 'ball');
          }
        } else {
          const o = this.cpuResult!;
          if (this.cpuSwings(o) && !this.cpuSwingShown && this.flightT >= pt.time - SWING_CONTACT) { this.cpuSwingShown = true; this.swingAnim = 0; }
          if (this.flightT >= pt.time) {
            if (this.cpuSwingShown) this.swingAnim = SWING_CONTACT;
            this.finishPitch(o);
          }
        }
        break;
      }
      case 'result':
        this.timer -= dt;
        if (this.hitBall) this.hitBall.t += dt;
        if (this.timer <= 0) {
          if (this.gs.over) { session.last = this.gs; this.gotoGameOver({ state: this.gs }); return; }
          if (this.halfChanged) this.startHalf(); else this.newAtBatPitch();
        }
        break;
    }
  }

  /** Does the CPU batter visibly swing? Contact always; a 'strike' outside the zone is a chase. */
  private cpuSwings(o: PitchOutcome): boolean {
    if (o === 'ball') return false;
    if (o !== 'strike') return true;
    const pt = this.pitch!;
    return !inZone(pt.endX, pt.endY) || Math.abs(pt.endX * 10) % 2 > 1;
  }

  private swing(at: number): void {
    if (this.swung) return;
    this.swingAt = at;
    this.swung = true;
    this.swingAnim = 0;
    this.sound.play('whoosh');
  }

  // ── draw ──
  override draw(d: Draw): void {
    super.draw(d);
    const W = this.width, H = this.height;
    const field = drawStadium(d, this.f, W, H);
    this.field = field;
    const gs = this.gs;
    const plate = field.plate, mound = field.mound;
    const s = field.s;

    // Pitcher on the mound (winds up, then follows through).
    let pRot = 0, pLift = 0;
    if (this.phase === 'windup') { const q = 1 - this.timer / WINDUP; pRot = Math.sin(q * Math.PI) * -0.25; pLift = Math.sin(q * Math.PI) * 10; }
    if (this.phase === 'flight') pRot = 0.18;
    drawChar(d, this.game, this.f.cast[gs.pitcher.id], mound.x, mound.y + 8 - pLift, 118 * s, { rot: pRot });

    // Strike zone (3×3 grid).
    const zc = this.zoneCenter();
    const zx = zc.x - ZONE_W / 2, zy = zc.y - ZONE_H / 2;
    d.rect(zx, zy, ZONE_W, ZONE_H, '#ffffff', 0.08);
    for (let i = 0; i <= 3; i++) {
      const edge = i % 3 === 0;
      d.line(zx + (ZONE_W * i) / 3, zy, zx + (ZONE_W * i) / 3, zy + ZONE_H, edge ? 3 : 1, '#ffffff', edge ? 0.8 : 0.3);
      d.line(zx, zy + (ZONE_H * i) / 3, zx + ZONE_W, zy + (ZONE_H * i) / 3, edge ? 3 : 1, '#ffffff', edge ? 0.8 : 0.3);
    }

    // Batter: stands left of the plate from the catcher's view, sized so a level swing crosses the zone.
    const load = this.phase === 'windup' ? 1 - this.timer / WINDUP : this.phase === 'flight' ? 1 : 0;
    const aimZ = this.userBatting ? this.cur : { x: this.pitch?.endX ?? 0, y: this.pitch?.endY ?? 0 };
    const batterId = this.pitchBatterId ?? gs.batter.id;
    drawBatter(d, this.game, this.f.cast[batterId], batterId, plate.x - 200, plate.y, 420, batterPose(this.swingAnim, load, this.t), this.zoneToWorld(aimZ.x, aimZ.y), this.swingAnim);

    // Pitched ball.
    if (this.pitch && this.phase === 'flight') {
      const pt = this.pitch;
      const tt = clamp(this.flightT / pt.time, 0, 1.15);
      const zp = pitchPos(pt, Math.min(tt, 1));
      const end = this.zoneToWorld(zp.x, zp.y);
      const rel = { x: mound.x + 18, y: mound.y - 80 * s };
      const e = Math.pow(tt, 1.35);
      const x = lerp(rel.x, end.x, e), y = lerp(rel.y, end.y, e);
      const r = lerp(3, 13, Math.min(e, 1.1));
      // Ball shadow on the strike zone: where the pitch is heading, sharpening as it arrives.
      if (tt <= 1) {
        const sh = this.zoneToWorld(zp.x, zp.y);
        d.circle(sh.x, sh.y, 9, '#000000', 0.15 + 0.35 * tt);
        d.ring(sh.x, sh.y, 9, 2, PITCH_TYPES[pt.type].color, 0.25 + 0.5 * tt);
      }
      d.circle(x + 3, y + 5, r, '#00000044');
      d.circle(x, y, r, '#ffffff');
      d.ring(x, y, r, 1.5, PITCH_TYPES[pt.type].color, 0.9);
    }

    // Batted ball flying away.
    if (this.hitBall && this.pitch) {
      const hb = this.hitBall;
      const st = this.zoneToWorld(this.pitch.endX, this.pitch.endY);
      const q = clamp(hb.t / 1.4, 0, 1);
      const far = hb.kind === 'homerun' ? 1.0 : hb.kind === 'groundout' ? 0.55 : hb.kind === 'foul' ? 0.7 : 0.8;
      const tx = mound.x + Math.sin(hb.ang) * W * 0.45 * far;
      const ty = lerp(mound.y, field.y + 60 * s, far);
      const arc = hb.kind === 'groundout' ? 0 : Math.sin(q * Math.PI) * (hb.kind === 'lineout' ? 60 : 240);
      const x = lerp(st.x, tx, q), y = lerp(st.y, ty, q) - arc;
      d.circle(x, y, lerp(12, 3, q), '#ffffff');
      if (q < 1) this.game.fx.emit({ x, y, count: 1, speed: 5, life: 0.3, size: 4, color: '#fff6c8', add: true });
    }

    // Cursor: meet circle (batting) or aim reticle (pitching).
    const cw = this.zoneToWorld(this.cur.x, this.cur.y);
    if (this.userBatting && this.phase !== 'half') {
      const rr = (meetRadius(gs.batter) * ZONE_W) / 2;
      d.circle(cw.x, cw.y, rr, '#ffe066', 0.22);
      d.ring(cw.x, cw.y, rr, 3, '#ffcc00', 0.95);
      d.circle(cw.x, cw.y, 4, '#ff3300');
    } else if (!this.userBatting && this.phase === 'aim') {
      const pt = PITCH_TYPES[this.selPitch];
      d.ring(cw.x, cw.y, 16, 3, pt.color);
      d.line(cw.x - 24, cw.y, cw.x + 24, cw.y, 2, pt.color);
      d.line(cw.x, cw.y - 24, cw.x, cw.y + 24, 2, pt.color);
      d.line(cw.x - pt.dx * ZONE_W * 0.5, cw.y - pt.dy * ZONE_H * 0.5, cw.x, cw.y, 2, pt.color, 0.5);
    }

    this.drawPanels(d, W, H);
  }

  private drawPanels(d: Draw, W: number, H: number): void {
    const gs = this.gs, g = this.game;
    // Scoreboard.
    panel(d, { x: 16, y: 16, w: 300, h: 124 });
    const rows: ['away' | 'home', string][] = [['away', gs.away.name], ['home', gs.home.name]];
    rows.forEach(([side, name], i) => {
      const y = 44 + i * 42;
      const team = side === 'away' ? gs.away : gs.home;
      d.rect(28, y - 14, 10, 28, team.color);
      const batting = gs.battingSide === side;
      label(d, g, `${batting ? '▶' : '　'}${name}${team.id === session.team ? '（你）' : ''}`, 46, y, { size: 22, color: batting ? '#ffe066' : '#ffffff' }, 0, 0.5);
      label(d, g, String(gs.runs[side]), 296, y, { size: 30, color: '#ffffff' }, 1, 0.5);
    });
    label(d, g, `${gs.inning} 局${gs.top ? '上' : '下'}（共 ${gs.innings} 局）`, 166, 124, { size: 18, color: '#9fd2ff' });

    // Count + outs.
    panel(d, { x: 16, y: 156, w: 160, h: 106 });
    const dots = (y: number, name: string, n: number, max: number, col: string): void => {
      label(d, g, name, 34, y, { size: 22, color: '#ffffff' });
      for (let i = 0; i < max; i++) d.circle(62 + i * 26, y, 9, i < n ? col : '#ffffff22');
    };
    dots(180, 'B', gs.balls, 3, '#3ddc84');
    dots(210, 'S', gs.strikes, 2, '#ffd23f');
    dots(240, 'O', gs.outs, 2, '#ff4d4d');

    // Bases diamond.
    panel(d, { x: 190, y: 156, w: 126, h: 106 });
    const dx = 253, dy = 214, r = 15;
    const base = (x: number, y: number, on: boolean): void => {
      d.fill([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], on ? '#ffcf4a' : '#ffffff33');
    };
    base(dx + 30, dy, gs.bases[0]);
    base(dx, dy - 30, gs.bases[1]);
    base(dx - 30, dy, gs.bases[2]);

    // Batter / pitcher card.
    const bat = gs.batter, pit = gs.pitcher;
    panel(d, { x: W - 336, y: 16, w: 320, h: 140 });
    label(d, g, `打者　${bat.name}（${bat.title}）`, W - 320, 42, { size: 21, color: '#ffffff' }, 0, 0.5);
    label(d, g, `巧打 ${bat.meet}　力量 ${bat.power}　跑速 ${bat.speed}`, W - 320, 70, { size: 17, color: '#cfe6ff' }, 0, 0.5);
    label(d, g, `投手　${pit.name}　控球 ${pit.control}`, W - 320, 102, { size: 21, color: '#ffffff' }, 0, 0.5);
    if (this.pitch && (this.phase === 'flight' || this.phase === 'result')) {
      label(d, g, `${this.pitch.type}　${this.pitch.kmh} km/h`, W - 320, 132, { size: 19, color: PITCH_TYPES[this.pitch.type].color }, 0, 0.5);
    }

    // Pitch selector when the user pitches.
    this.pitchBtns = [];
    if (!this.userBatting && this.phase === 'aim') {
      const ps = gs.pitcher.pitches;
      const bw = 124, gap = 10, total = ps.length * bw + (ps.length - 1) * gap;
      ps.forEach((name, i) => {
        const r: Rect = { x: W / 2 - total / 2 + i * (bw + gap), y: H - 74, w: bw, h: 54 };
        this.pitchBtns.push({ name, r });
        button(d, g, r, `${i + 1} ${name}`, mobilePointer(this.input.pointer), { selected: name === this.selPitch, size: 22 });
      });
      label(d, g, '滑鼠/方向鍵瞄準　數字鍵選球種　點擊好球帶或 Space 投球', W / 2, H - 96, { size: 18, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    } else if (this.userBatting && (this.phase === 'ready' || this.phase === 'windup' || this.phase === 'flight')) {
      label(d, g, '自動跟球　看準時機點擊或 Space 揮棒', W / 2, H - 30, { size: 20, color: '#ffffff', stroke: '#000000', strokeWidth: 4 });
    }

    // Banners.
    if (this.phase === 'half') {
      d.rect(0, H / 2 - 64, W, 128, '#0d1433', 0.85);
      label(d, g, this.halfBanner, W / 2, H / 2 - 14, { size: 50, color: '#ffe066', stroke: '#000000', strokeWidth: 6 });
      label(d, g, this.userBatting ? '你的攻擊！看準球路揮棒' : '你的防守！選球種、瞄準、投球', W / 2, H / 2 + 36, { size: 24, color: '#ffffff' });
    }
    if (this.phase === 'result' && this.outcome) {
      const big = !!HIT_BASES[this.outcome];
      const bad = this.outcome.endsWith('out') || this.note.startsWith('三振');
      const col = this.outcome === 'homerun' ? '#ff5fa2' : big ? '#ffe066' : bad ? '#ff6b6b' : '#ffffff';
      label(d, g, this.note, W / 2, H * 0.3, { size: big ? 64 : 48, color: col, stroke: '#1a1030', strokeWidth: 8, weight: 900 });
    }
  }
}
