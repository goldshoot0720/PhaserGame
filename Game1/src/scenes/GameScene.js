import Phaser from 'phaser';
import { GameState } from '../systems/rules.js';
import { TEAMS, pitchList } from '../systems/data.js';
import { makePitch, isStrike, battedBall, clamp } from '../systems/physics.js';
import { resolvePlay } from '../systems/fielding.js';
import { cpuChoosePitch, cpuBatterDecide } from '../systems/cpu.js';
import { line } from '../systems/commentary.js';
import { unlockAudio, sfxBat, sfxMitt, sfxSwing, sfxCheer, sfxUmpire, sfxBlip, speak } from '../systems/audio.js';
import PlateView, { ZONE_SCREEN, project, screenToPlate } from '../ui/PlateView.js';
import FieldView from '../ui/FieldView.js';
import Hud from '../ui/Hud.js';

const SWING_LAG = 150;     // 按下揮棒 → 球棒到達擊球點 (ms)
const TIMING_WIN = 110;    // 擊球時機容許範圍 (±ms)
const BOUNDS = { left: ZONE_SCREEN.left - 75, right: ZONE_SCREEN.right + 75, top: ZONE_SCREEN.top - 70, bottom: ZONE_SCREEN.bottom + 70 };

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.cfg = { teamId: data.teamId || 'whale', innings: data.innings || 3, userHome: data.userHome ?? true };
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.gs = new GameState(this.cfg.teamId, this.cfg.innings, this.cfg.userHome);
    this.plate = new PlateView(this);
    this.field = new FieldView(this);
    this.hud = new Hud(this, this.gs);
    this.field.root.setDepth(50);

    this.phase = 'intro';
    this.cursor = { x: ZONE_SCREEN.cx, y: ZONE_SCREEN.cy };
    this.aim = { x: ZONE_SCREEN.cx, y: ZONE_SCREEN.cy };
    this.pitchIdx = 0;
    this.bunt = false;
    this.swingTime = null;
    this.flight = null;

    this.flash = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 1).setAlpha(0).setDepth(90);
    this.confetti = this.add.particles(0, 0, 'confetti', {
      x: { min: 0, max: 1280 }, y: -20, speedY: { min: 150, max: 380 }, speedX: { min: -80, max: 80 },
      rotate: { min: 0, max: 360 }, lifespan: 3200, gravityY: 60, scale: { min: 0.8, max: 1.4 },
      tint: [0xff4fa3, 0xffe14d, 0x4fc3ff, 0x7dff6a, 0xffffff, 0xff5a3c], emitting: false,
    }).setDepth(95);
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 200, max: 520 }, lifespan: 450, scale: { start: 1.1, end: 0 }, tint: [0xffffff, 0xffe14d], emitting: false,
    }).setDepth(80);

    this.setupInput();
    this.hud.refresh();
    this.time.delayedCall(400, () => this.startHalfInning());
  }

  // ---------- 輸入 ----------
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,B,M,Q,E,ONE,TWO,THREE,FOUR,FIVE');
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    this.input.on('pointermove', (p) => {
      if (this.gs.userBatting) { this.cursor.x = p.x; this.cursor.y = p.y; }
      else { this.aim.x = p.x; this.aim.y = p.y; }
    });
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (over && over.length) return;
      this.action();
    });
    kb.on('keydown-SPACE', () => { unlockAudio(); this.action(); });
    kb.on('keydown-B', () => this.toggleBunt());
    kb.on('keydown-M', () => this.hud.toggleMute());
    kb.on('keydown-Q', () => this.pickPitch(this.pitchIdx - 1));
    kb.on('keydown-E', () => this.pickPitch(this.pitchIdx + 1));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.pickPitch(i)));
  }

  action() {
    if (this.gs.userBatting) this.userSwing();
    else this.userThrow();
  }

  get cursorR() {
    const rx = 18 + this.gs.batter.meet * 0.36;
    return { rx: this.bunt ? rx * 1.15 : rx, ry: (this.bunt ? rx * 1.15 : rx) * 0.8 };
  }

  update(time, delta) {
    const k = this.keys;
    const v = (0.42 * delta);
    const dx = (k.A.isDown || k.LEFT.isDown ? -1 : 0) + (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    const dy = (k.W.isDown || k.UP.isDown ? -1 : 0) + (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    const tgt = this.gs.userBatting ? this.cursor : this.aim;
    tgt.x = clamp(tgt.x + dx * v, BOUNDS.left, BOUNDS.right);
    tgt.y = clamp(tgt.y + dy * v, BOUNDS.top, BOUNDS.bottom);

    const playing = !['field', 'end', 'change'].includes(this.phase);
    const r = this.cursorR;
    this.plate.drawCursor(this.cursor.x, this.cursor.y, r.rx, r.ry, playing && this.gs.userBatting, this.bunt);
    this.plate.drawAim(this.aim.x, this.aim.y, playing && !this.gs.userBatting && (this.phase === 'aim' || this.phase === 'windup'));

    if (this.phase === 'flight' && this.flight) {
      const t = (this.time.now - this.flight.start) / this.flight.p.duration;
      if (t < 1) this.plate.showBall(this.flight.p, t);
      else this.resolvePitch();
    }
  }

  // ---------- 半局 / 打席 ----------
  startHalfInning() {
    const gs = this.gs;
    const team = TEAMS[gs.battingTeamId];
    this.hud.refresh();
    this.hud.big(`${gs.inning}局${gs.top ? '上' : '下'}`, '#ffffff', '#0d2f6e', 90, 700);
    const who = gs.userBatting ? '輪到你打擊！' : '輪到你投球！';
    this.hud.say(`${gs.inning}局${gs.top ? '上半' : '下半'}，${team.name}進攻。${who}`);
    const list = pitchList(gs.pitcher);
    this.hud.buildPitchMenu(list, (i) => this.pickPitch(i));
    this.pickPitch(0, true);
    this.time.delayedCall(1500, () => this.startAtBat());
  }

  startAtBat() {
    const gs = this.gs;
    const batter = gs.batter;
    const pitcher = gs.pitcher;
    this.bunt = false;
    this.plate.setPlayers(batter, TEAMS[gs.battingTeamId], pitcher, TEAMS[gs.fieldingTeamId]);
    this.hud.setCards(batter, TEAMS[gs.battingTeamId], pitcher, TEAMS[gs.fieldingTeamId]);
    this.hud.refresh();
    this.hud.clearSpeed();
    const hot = gs.bases[1] || gs.bases[2];
    this.hud.say(line(hot ? 'introHot' : 'intro', { b: batter.name, n: (gs.order[gs.battingTeamId] % 4) + 1 }));
    this.phase = 'intro';
    this.time.delayedCall(1100, () => this.nextPitch());
  }

  nextPitch() {
    if (this.phase === 'end') return;
    this.swingTime = null;
    this.flight = null;
    this.plate.hideBall();
    this.plate.drawZone(false);
    const gs = this.gs;
    if (gs.userBatting) {
      this.phase = 'batWait';
      this.hud.showPitchMenu(false);
      this.hud.setHint('滑鼠 / WASD 移動游標　點擊 / 空白鍵 揮棒　B 短打' + (this.bunt ? '（短打中）' : ''));
      this.time.delayedCall(700 + Math.random() * 700, () => this.cpuPitch());
    } else {
      this.phase = 'aim';
      this.hud.showPitchMenu(true);
      this.hud.setHint('1~4 / Q E 選球種　滑鼠 / WASD 瞄準　點擊 / 空白鍵 投球');
    }
  }

  // ---------- 投球 ----------
  pickPitch(i, silent = false) {
    const list = pitchList(this.gs.pitcher);
    this.pitchIdx = (i + list.length) % list.length;
    this.hud.selectPitchRow(this.pitchIdx);
    if (!silent) sfxBlip(660 + this.pitchIdx * 110);
  }

  cpuPitch() {
    if (this.phase !== 'batWait') return;
    const gs = this.gs;
    const choice = cpuChoosePitch(gs.pitcher, gs.balls, gs.strikes);
    const p = makePitch(gs.pitcher, choice.type, choice.x, choice.y, gs.fatigue);
    this.phase = 'windup';
    this.plate.pitcher.windup(620, () => this.release(p));
  }

  userThrow() {
    if (this.phase !== 'aim') return;
    const gs = this.gs;
    const type = pitchList(gs.pitcher)[this.pitchIdx];
    const m = screenToPlate(this.aim.x, this.aim.y);
    const p = makePitch(gs.pitcher, type, m.x, m.y, gs.fatigue);
    this.phase = 'windup';
    this.hud.showPitchMenu(false);
    this.plate.pitcher.windup(620, () => this.release(p));
  }

  release(p) {
    const gs = this.gs;
    gs.countPitch();
    this.hud.updateStamina();
    this.hud.showSpeed(p);
    this.flight = { p, start: this.time.now };
    this.phase = 'flight';
    if (!gs.userBatting) {
      const d = cpuBatterDecide(gs.batter, p, gs.balls, gs.strikes, gs.bases, gs.outs);
      this.cpuDecision = d;
      if (d.bunt) this.plate.batter.buntStance(true);
      else if (d.swing) {
        const at = p.duration - SWING_LAG + (d.contact ? d.timingN * TIMING_WIN * 0.8 : (Math.random() - 0.5) * 260);
        this.time.delayedCall(Math.max(0, at), () => { if (this.plate.batter) { this.plate.batter.swing(); sfxSwing(); } });
      }
    }
  }

  // ---------- 打擊 ----------
  toggleBunt() {
    if (!this.gs.userBatting || !['batWait', 'windup', 'intro'].includes(this.phase)) return;
    this.bunt = !this.bunt;
    this.plate.batter && this.plate.batter.buntStance(this.bunt);
    sfxBlip(this.bunt ? 520 : 400);
    this.hud.setHint(this.bunt ? '短打姿勢：把游標對準球！（再按 B 取消）' : '滑鼠 / WASD 移動游標　點擊 / 空白鍵 揮棒　B 短打');
  }

  userSwing() {
    if (this.phase !== 'flight' || this.swingTime !== null || this.bunt) return;
    this.swingTime = this.time.now;
    this.plate.batter.swing();
    sfxSwing();
  }

  resolvePitch() {
    const gs = this.gs;
    const p = this.flight.p;
    const arrive = this.flight.start + p.duration;
    this.phase = 'resolve';
    const bs = project(p.target.x, p.target.y, 0);
    const strikeLoc = isStrike(p.target.x, p.target.y);

    if (gs.userBatting) {
      const r = this.cursorR;
      const cur = this.cursor;
      const ex = (bs.x - cur.x) / r.rx;
      const ey = (bs.y - cur.y) / r.ry;
      const ballPad = (bs.s * 0.037) / r.rx;
      const inside = Math.hypot(ex, ey) <= 1 + ballPad;
      if (this.bunt) {
        if (inside) return this.contact(battedBall(gs.batter, ex, ey, 0, { bunt: true }), bs);
        return this.called(strikeLoc || Math.abs(ex) < 1.5 ? 'strike' : 'ball', bs, true);
      }
      if (this.swingTime !== null) {
        const timingN = (this.swingTime + SWING_LAG - arrive) / TIMING_WIN;
        if (Math.abs(timingN) <= 1 && inside) {
          return this.contact(battedBall(gs.batter, clamp(ex, -1.1, 1.1), clamp(ey, -1.1, 1.1), timingN), bs);
        }
        return this.called('swingMiss', bs);
      }
      return this.called(strikeLoc ? 'strike' : 'ball', bs);
    }

    // CPU 打者
    const d = this.cpuDecision || { swing: false };
    if (d.bunt) {
      this.plate.batter.buntStance(false);
      if (d.contact) return this.contact(battedBall(gs.batter, d.ex, 0, 0, { bunt: true }), bs);
      return this.called('strike', bs, true);
    }
    if (d.swing) {
      if (d.contact) return this.contact(battedBall(gs.batter, d.ex, d.ey, d.timingN), bs);
      return this.called('swingMiss', bs);
    }
    return this.called(strikeLoc ? 'strike' : 'ball', bs);
  }

  called(kind, bs, buntMiss = false) {
    const gs = this.gs;
    this.plate.showBall(this.flight.p, 1);
    this.plate.catchAt(bs.x, bs.y);
    sfxMitt();
    this.time.delayedCall(150, () => this.plate.hideBall());
    let ev;
    if (kind === 'ball') {
      ev = gs.ball();
      if (ev.event === 'walk') {
        this.hud.big('四壞球', '#7dff6a', '#0d4a1a', 96);
        this.hud.say(line('walk'));
      } else {
        this.hud.big('BALL', '#7dff6a', '#0d4a1a', 80, 450);
        this.hud.say(line('ball'), true);
      }
    } else {
      if (buntMiss && gs.strikes === 2) ev = gs.strike(true);
      else ev = gs.strike(kind === 'swingMiss');
      sfxUmpire(ev.event === 'strikeout' ? 'out' : 'strike');
      if (ev.event === 'strikeout') {
        this.hud.big('三振！', '#ffe14d', '#c2185b', 120);
        this.hud.say(line('strikeout'));
        this.cameras.main.shake(180, 0.006);
      } else {
        this.hud.big('STRIKE', '#ffe14d', '#c2185b', 80, 450);
        this.hud.say(line(kind === 'swingMiss' ? 'swingMiss' : 'strike'));
      }
      this.plate.drawZone(true);
    }
    this.bunt = false;
    if (this.plate.batter) this.plate.batter.buntStance(false);
    this.hud.refresh();
    this.time.delayedCall(ev.event === 'walk' || ev.event === 'strikeout' ? 1500 : 1000, () => this.afterPitch(ev));
  }

  contact(bb, bs) {
    const gs = this.gs;
    // 打擊停頓 (hit stop)
    this.plate.showBall(this.flight.p, 1);
    const power = bb.bunt ? 0.35 : 0.5 + bb.quality * 0.6;
    sfxBat(power);
    this.flash.setAlpha(bb.quality > 0.75 ? 0.7 : 0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 180 });
    this.sparks.explode(bb.bunt ? 6 : 10 + Math.round(bb.quality * 18), bs.x, bs.y);
    this.cameras.main.shake(bb.quality > 0.8 ? 200 : 90, bb.quality > 0.8 ? 0.012 : 0.004);
    const stop = bb.quality > 0.8 ? 180 : 90;

    this.time.delayedCall(stop, () => {
      // 球在捕手視角飛走
      const ball = this.plate.ball;
      this.plate.shadow.setVisible(false);
      this.plate.trail.clear();
      const tx = 640 + clamp(bb.spray, -80, 80) * (bb.foul ? 9 : 5);
      const ty = bb.launch > 5 ? 330 - Math.min(260, bb.launch * 5) : 420;
      this.tweens.add({
        targets: ball, x: tx, y: ty, scale: 0.04, duration: bb.foul ? 500 : 380, ease: 'Quad.easeOut',
        onComplete: () => ball.setVisible(false),
      });
      if (bb.foul) {
        const ev = gs.foul(!!bb.bunt);
        this.hud.big('FOUL', '#ffffff', '#555555', 80, 450);
        this.hud.say(line(ev.event === 'strikeout' ? 'strikeout' : 'foul'));
        this.bunt = false;
        if (this.plate.batter) this.plate.batter.buntStance(false);
        this.hud.refresh();
        this.time.delayedCall(1100, () => this.afterPitch(ev));
        return;
      }
      if (!bb.bunt && bb.quality > 0.7 && bb.launch > 15) this.hud.say('打到了！很遠！', true, '#c2185b');
      const runner = gs.makeRunner();
      const oldBases = [...gs.bases];
      const o = resolvePlay(bb, gs.batter, gs.bases, gs.outs, runner);
      this.phase = 'field';
      this.time.delayedCall(420, () => {
        this.plate.setVisible(false);
        this.field.play(o, {
          batterRunner: runner, oldBases, fieldTeam: TEAMS[gs.fieldingTeamId], batTeam: TEAMS[gs.battingTeamId],
          pitcherId: gs.pitcher.id,
        }, () => this.applyOutcome(o));
      });
    });
  }

  applyOutcome(o) {
    const gs = this.gs;
    this.plate.setVisible(true);
    gs.applyPlay(o);
    this.hud.refresh();
    const nRuns = o.runs.length;
    if (o.code === 'HR') {
      this.hud.big('HOME RUN!!', '#ffe14d', '#c2185b', 130, 1600);
      this.cameras.main.shake(600, 0.018);
      this.confetti.explode(140);
      sfxCheer(3.2, 0.7);
      if (this.plate.batter) this.plate.batter.jump(4);
      this.hud.say(`${line('HR')}${nRuns > 1 ? `${nRuns}分打點！` : ''}`, true, '#c2185b');
    } else {
      const big = { '1B': '安打！', '2B': '二壘安打！', '3B': '三壘安打！', DP: '雙殺！', GO: 'OUT', FLY: 'OUT', LINE: 'OUT', POP: 'OUT', SAC: '犧牲短打', SACFLY: '犧牲飛球' }[o.code] || o.label;
      const hit = o.hit;
      this.hud.big(big, hit ? '#ffe14d' : '#ffffff', hit ? '#c2185b' : '#333333', hit ? 100 : 90, 900);
      if (hit || nRuns) sfxCheer(hit && o.batterBases >= 2 ? 2.4 : 1.6, 0.5); else sfxUmpire('out');
      let s = line(o.code) || o.label;
      if (nRuns && o.code !== 'SACFLY') s += ` ${nRuns}分進帳！`;
      this.hud.say(s, true, hit ? '#c2185b' : '#1a1a1a');
      if (this.plate.batter) { if (hit) this.plate.batter.jump(2); else this.plate.batter.droop(); }
    }
    this.time.delayedCall(o.code === 'HR' ? 2600 : 1700, () => this.afterPitch({ event: 'play', o }));
  }

  afterPitch(ev) {
    const gs = this.gs;
    this.hud.refresh();
    const abOver = ['walk', 'strikeout', 'play'].includes(ev.event);
    const st = gs.checkState();
    if (st === 'end') return this.endGame();
    if (st === 'switch') {
      this.phase = 'change';
      this.hud.big('攻守交換', '#ffffff', '#0d2f6e', 100, 1000);
      this.hud.say(line('change'));
      this.plate.hideBall();
      this.time.delayedCall(1700, () => this.startHalfInning());
      return;
    }
    if (abOver) this.time.delayedCall(250, () => this.startAtBat());
    else this.nextPitch();
  }

  endGame() {
    const gs = this.gs;
    this.phase = 'end';
    this.hud.setHint('');
    const res = gs.result();
    if (gs.walkOff) {
      this.hud.big('再見！', '#ffe14d', '#c2185b', 140, 2000);
      this.hud.say(line('walkoff'));
      this.confetti.explode(160);
      sfxCheer(3.5, 0.8);
    } else {
      this.hud.big('比賽結束', '#ffffff', '#0d2f6e', 110, 2000);
      speak('比賽結束！');
    }
    this.time.delayedCall(3200, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', res));
    });
  }
}
