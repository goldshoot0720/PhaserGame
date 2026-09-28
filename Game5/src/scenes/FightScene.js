import Phaser from 'phaser';
import { WIDTH, HEIGHT, FRAME_MS, ROUND_TIME, ROUNDS_TO_WIN, STAGE_LEFT, STAGE_RIGHT, FPS, FONT } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES, drawStage } from '../objects/Stage.js';
import { Fighter } from '../objects/Fighter.js';
import { Projectile } from '../objects/Projectile.js';
import { Hud } from '../objects/Hud.js';
import { Effects } from '../systems/Effects.js';
import { KeyboardController, menuAction } from '../systems/Input.js';
import { CpuController } from '../systems/CpuController.js';
import { Sfx } from '../systems/Sfx.js';

const START_X = [WIDTH / 2 - 240, WIDTH / 2 + 240];
const ROUND_NAMES = ['第一回合', '第二回合', '最終回合'];
const SUPER_FREEZE = 45;
const KO_SLOWMO = 70;
const WALL_MARGIN = 12;
const COMBO_SCALE = 0.12;
const MIN_DAMAGE_SCALE = 0.35;

export class FightScene extends Phaser.Scene {
  constructor() {
    super('Fight');
  }

  init(data) {
    this.config = data;
  }

  create() {
    const { mode, p1, p2, difficulty, stage } = this.config;
    drawStage(this, STAGES[stage]);
    this.effects = new Effects(this);
    this.projectiles = [];

    const c1 = new KeyboardController(this, 'p1');
    const c2 = mode === 'cpu' ? new CpuController(difficulty) : new KeyboardController(this, 'p2');
    this.fighters = [new Fighter(this, CHARACTERS[p1], 0, c1), new Fighter(this, CHARACTERS[p2], 1, c2)];
    if (c2 instanceof CpuController) c2.bind(this.fighters[1], this.fighters[0], this);

    this.hud = new Hud(this, this.fighters);
    this.debug = this.add.graphics().setDepth(150);
    this.showBoxes = false;
    this.wins = [0, 0];
    this.round = 0;
    this.acc = 0;
    this.paused = false;
    this.pauseText = this.add.text(WIDTH / 2, HEIGHT / 2, '暫停中\nEsc 繼續　Enter 回到選角畫面', {
      fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffffff', align: 'center', backgroundColor: '#000000aa', padding: { x: 30, y: 20 },
    }).setOrigin(0.5).setDepth(300).setVisible(false);
    this.superDim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000022, 0.6).setDepth(15).setVisible(false);

    this.input.keyboard.on('keydown', this.onKey, this);
    this.startRound();
  }

  onKey(event) {
    if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.F2) {
      this.showBoxes = !this.showBoxes;
      return;
    }
    const act = menuAction(event);
    if (!act || act.player !== 0) return;
    if (act.action === 'back' && event.keyCode !== Phaser.Input.Keyboard.KeyCodes.BACKSPACE) {
      this.paused = !this.paused;
      this.pauseText.setVisible(this.paused);
      this.time.paused = this.paused;
      if (this.paused) this.tweens.pauseAll(); else this.tweens.resumeAll();
    } else if (act.action === 'confirm' && this.paused && event.keyCode === Phaser.Input.Keyboard.KeyCodes.ENTER) {
      this.tweens.resumeAll();
      this.time.paused = false;
      this.scene.start('Select', { mode: this.config.mode, difficulty: this.config.difficulty });
    }
  }

  // ---------------------------------------------------------------- round flow

  startRound() {
    this.round++;
    this.phase = 'intro';
    this.timerFrames = ROUND_TIME * FPS;
    this.hitstop = 0;
    this.superFreeze = 0;
    this.slowmo = 0;
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles = [];
    this.fighters.forEach((f, i) => f.resetForRound(START_X[i], i === 0 ? 1 : -1));
    this.hud.setWins(this.wins);
    this.hud.setTime(ROUND_TIME);

    const finalRound = this.wins[0] === ROUNDS_TO_WIN - 1 && this.wins[1] === ROUNDS_TO_WIN - 1;
    const name = finalRound ? ROUND_NAMES[2] : ROUND_NAMES[Math.min(this.round - 1, 1)];
    this.time.delayedCall(400, () => { this.hud.banner(name, { stroke: '#1b3fc0' }); Sfx.announce(); });
    this.time.delayedCall(1800, () => {
      this.hud.banner('開始！', { size: 140, color: '#ffe45c', hold: 600 });
      Sfx.announce();
      this.phase = 'fight';
    });
  }

  endRound(reason) {
    this.phase = 'ko';
    const [a, b] = this.fighters;
    let winner;
    if (reason === 'ko') winner = a.isKO && b.isKO ? -1 : a.isKO ? 1 : 0;
    else {
      const ra = a.health / a.def.health;
      const rb = b.health / b.def.health;
      winner = Math.abs(ra - rb) < 0.001 ? -1 : ra > rb ? 0 : 1;
    }
    if (reason === 'ko') {
      this.slowmo = KO_SLOWMO;
      this.hud.banner('K.O.', { size: 180, color: '#ff3b30', stroke: '#ffffff', hold: 1300 });
      Sfx.ko();
      this.cameras.main.flash(250, 255, 255, 255);
    } else {
      this.hud.banner('時間到！', { size: 120, hold: 1300 });
      Sfx.announce();
    }
    if (winner === -1) { this.wins[0]++; this.wins[1]++; } else this.wins[winner]++;

    this.time.delayedCall(2300, () => {
      if (winner >= 0) this.fighters[winner].win();
      const msg = winner === -1 ? '平手！' : `${this.fighters[winner].def.name} 勝利！`;
      this.hud.setWins(this.wins);
      this.hud.banner(msg, { size: 90, color: '#ffe45c', hold: 1400 });
    });
    this.time.delayedCall(4600, () => {
      const matchOver = this.wins.some((w) => w >= ROUNDS_TO_WIN);
      if (!matchOver) {
        this.startRound();
        return;
      }
      const [w0, w1] = this.wins;
      const matchWinner = w0 === w1 ? -1 : w0 > w1 ? 0 : 1;
      this.scene.start('Result', { ...this.config, winner: matchWinner });
    });
  }

  onSuperStart(fighter) {
    this.superFreeze = SUPER_FREEZE;
    Sfx.superFlash();
    this.superDim.setVisible(true).setAlpha(0.6);
    this.tweens.add({ targets: this.superDim, alpha: 0, delay: SUPER_FREEZE * FRAME_MS, duration: 200, onComplete: () => this.superDim.setVisible(false) });
    const t = this.add.text(fighter.x, fighter.y - fighter.def.height - 30, fighter.def.super.name, {
      fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#ffffff', stroke: Phaser.Display.Color.IntegerToColor(fighter.def.color).rgba, strokeThickness: 10,
    }).setOrigin(0.5).setDepth(210);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 10, WIDTH - t.width / 2 - 10);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 700, duration: 400, onComplete: () => t.destroy() });
    this.effects.counterFlash(fighter.x, fighter.y - fighter.def.height * 0.6);
  }

  spawnProjectile(owner, move) {
    this.projectiles.push(new Projectile(this, owner, move));
  }

  // ---------------------------------------------------------------- main loop

  update(time, delta) {
    if (this.paused) return;
    this.acc += Math.min(delta, 100);
    while (this.acc >= FRAME_MS) {
      this.acc -= FRAME_MS;
      if (this.slowmo > 0) {
        this.slowmo--;
        if (this.slowmo % 3 !== 0) continue;
      }
      this.step();
    }
    this.fighters.forEach((f) => f.render(this.hitstop > 0 && f === this.lastDefender));
    this.projectiles.forEach((p) => p.render());
    this.hud.update();
    this.drawDebug();
  }

  step() {
    if (this.superFreeze > 0) {
      this.superFreeze--;
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    const [a, b] = this.fighters;
    const active = this.phase === 'fight';
    a.step(b, active);
    b.step(a, active);
    this.projectiles.forEach((p) => p.step());
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.separate();
    if (active) this.resolveHits();
    this.fighters.forEach((f, i) => {
      const other = this.fighters[1 - i];
      if (other.isNeutral) f.combo = 0;
    });

    if (!active) return;
    this.timerFrames--;
    this.hud.setTime(Math.ceil(this.timerFrames / FPS));
    if (a.isKO || b.isKO) this.endRound('ko');
    else if (this.timerFrames <= 0) this.endRound('time');
  }

  /** Push boxes: fighters never overlap or leave the stage. */
  separate() {
    const [a, b] = this.fighters;
    const clamp = (f) => { f.x = Phaser.Math.Clamp(f.x, STAGE_LEFT + f.pushWidth() / 2, STAGE_RIGHT - f.pushWidth() / 2); };
    clamp(a);
    clamp(b);
    const minDist = (a.pushWidth() + b.pushWidth()) / 2;
    const dx = b.x - a.x;
    if (Math.abs(dx) >= minDist) return;
    const dir = dx !== 0 ? Math.sign(dx) : a.facing;
    const overlap = minDist - Math.abs(dx);
    a.x -= (dir * overlap) / 2;
    b.x += (dir * overlap) / 2;
    clamp(a);
    clamp(b);
    // If one is pinned to a wall, move the other one out instead.
    if (Math.abs(b.x - a.x) < minDist - 0.5) {
      const atWall = (f) => f.x <= STAGE_LEFT + f.pushWidth() / 2 + 0.5 || f.x >= STAGE_RIGHT - f.pushWidth() / 2 - 0.5;
      if (atWall(a)) b.x = a.x + dir * minDist; else a.x = b.x - dir * minDist;
    }
  }

  resolveHits() {
    const [a, b] = this.fighters;
    // Melee checks are gathered first so simultaneous hits trade.
    const hits = [];
    for (const [att, def] of [[a, b], [b, a]]) {
      const box = att.hitbox();
      const hurt = def.hurtbox();
      if (box && hurt && Phaser.Geom.Intersects.RectangleToRectangle(box, hurt)) {
        hits.push({ att, def, box, hurt, move: att.attack.move, kind: att.attack.kind });
      }
    }
    hits.forEach(({ att, def, box, hurt, move, kind }) => this.applyHit(att, def, move, kind, overlapCenter(box, hurt), null));

    for (const p of this.projectiles) {
      const def = p.owner === a ? b : a;
      const box = p.hitbox();
      const hurt = def.hurtbox();
      if (box && hurt && !def.isProjectileInvulnerable() && Phaser.Geom.Intersects.RectangleToRectangle(box, hurt)) {
        this.applyHit(p.owner, def, p.move, 'special', overlapCenter(box, hurt), p);
      }
    }
    // Opposing projectiles cancel each other out.
    for (const p of this.projectiles) {
      for (const q of this.projectiles) {
        if (p === q || p.owner === q.owner || !p.alive || !q.alive) continue;
        const pb = p.hitbox();
        const qb = q.hitbox();
        if (pb && qb && Phaser.Geom.Intersects.RectangleToRectangle(pb, qb)) {
          p.consumeHit();
          q.consumeHit();
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  /** `att.attack` may already be gone when both fighters hit each other on the same frame (trade). */
  applyHit(att, def, move, kind, point, projectile) {
    const dir = projectile ? projectile.dir : (def.x >= att.x ? 1 : -1);
    this.lastDefender = def;

    if (def.isCountering()) {
      if (projectile) projectile.destroy(); else if (att.attack) att.attack.hits = move.hits;
      def.triggerCounter();
      this.effects.counterFlash(point.x, point.y);
      this.hud.banner('反擊！', { size: 70, color: '#bfe8ff', stroke: '#1b3fc0', hold: 400 });
      Sfx.block();
      this.hitstop = 12;
      return;
    }

    if (projectile) projectile.consumeHit(); else if (att.attack) att.registerHit();
    const finalHit = projectile ? !projectile.alive : !att.attack || att.attack.hits >= move.hits;
    const isSpecial = kind === 'special' || kind === 'super' || kind === 'counter';

    if (def.canBlock(move.level)) {
      const chip = isSpecial ? Math.round(move.damage * (move.chip ?? 0.25) * att.def.power) : 0;
      def.blockHit(move, chip, dir);
      if (!projectile && this.nearWall(def)) att.pushVx = -dir * 5;
      att.gainMeter(move.damage / 16);
      this.effects.blockSpark(point.x, point.y, -dir);
      Sfx.block();
      this.hitstop = 5;
      return;
    }

    const juggled = ['hitstun', 'knockdown'].includes(def.state);
    att.combo = juggled ? att.combo + 1 : 1;
    const scale = Math.max(MIN_DAMAGE_SCALE, 1 - COMBO_SCALE * (att.combo - 1));
    const damage = Math.max(1, Math.round(move.damage * att.def.power * scale));
    def.takeHit(move, damage, dir, finalHit);
    if (!projectile && this.nearWall(def)) att.pushVx = -dir * 4;
    if (kind !== 'super') att.gainMeter(move.damage / 8);

    const heavy = move.damage >= 60 || isSpecial;
    this.effects.hitSpark(point.x, point.y, heavy, kind === 'super' ? 0x7ff5ff : 0xfff27a);
    this.hitstop = heavy ? 9 : 6;
    if (heavy) this.cameras.main.shake(kind === 'super' ? 200 : 110, kind === 'super' ? 0.014 : 0.007);
    if (heavy) Sfx.hitHeavy(); else Sfx.hitLight();
    this.hud.showCombo(this.fighters.indexOf(att), att.combo);
  }

  nearWall(f) {
    return f.x <= STAGE_LEFT + f.pushWidth() / 2 + WALL_MARGIN || f.x >= STAGE_RIGHT - f.pushWidth() / 2 - WALL_MARGIN;
  }

  drawDebug() {
    const g = this.debug;
    g.clear();
    if (!this.showBoxes) return;
    for (const f of this.fighters) {
      const hurt = f.hurtbox();
      if (hurt) g.lineStyle(2, 0x3cff5a, 1).strokeRectShape(hurt);
      const hit = f.hitbox(true);
      if (hit) g.lineStyle(2, f.hitbox() ? 0xff2d2d : 0x884444, 1).strokeRectShape(hit);
      g.lineStyle(1, 0xffff00, 1).strokeRect(f.x - f.pushWidth() / 2, f.y - 20, f.pushWidth(), 20);
    }
    for (const p of this.projectiles) {
      const box = p.hitbox();
      if (box) g.lineStyle(2, 0xff2d2d, 1).strokeRectShape(box);
    }
  }
}

function overlapCenter(r1, r2) {
  const x1 = Math.max(r1.x, r2.x);
  const x2 = Math.min(r1.right, r2.right);
  const y1 = Math.max(r1.y, r2.y);
  const y2 = Math.min(r1.bottom, r2.bottom);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}
