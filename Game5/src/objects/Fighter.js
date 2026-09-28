import Phaser from 'phaser';
import { GROUND_Y, METER_MAX } from '../config.js';
import { NORMALS, MOTIONS, COUNTER_STRIKE } from '../data/moves.js';
import { MotionBuffer, emptyInputFrame } from '../systems/Input.js';
import { Sfx } from '../systems/Sfx.js';

// Physics / feel (per logic frame at 60 fps)
const GRAVITY = 0.85;
const JUMP_VY = -17;
const JUMP_VX = 4.6;
const BACK_WALK = 0.8;
const PUSH_FRICTION = 0.82;
const UNIT = 320; // move boxes are authored for a 320px-tall fighter
const TEXTURE_H = 440;
const BODY_W = 86;
const PUSH_W = 70;
const DOWN_FRAMES = 38;
const GETUP_FRAMES = 22;
const SPECIAL_WINDOW = 16;
const SUPER_WINDOW = 32;

const NEUTRAL = new Set(['idle', 'walk', 'crouch']);

export class Fighter {
  constructor(scene, def, side, controller) {
    this.scene = scene;
    this.def = def;
    this.side = side;
    this.controller = controller;
    this.unit = def.height / UNIT;
    this.baseScale = def.height / TEXTURE_H;
    this.motion = new MotionBuffer();

    this.shadow = scene.add.ellipse(0, GROUND_Y, 150 * this.unit, 26 * this.unit, 0x000000, 0.35).setDepth(9);
    this.sprite = scene.add.image(0, GROUND_Y, def.texture).setOrigin(0.5, 1).setDepth(20 + side);
    this.meter = 0;
  }

  // ---------------------------------------------------------------- round control

  resetForRound(x, facing) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.pushVx = 0;
    this.facing = facing;
    this.health = this.def.health;
    this.state = 'intro';
    this.stateTime = 0;
    this.attack = null;
    this.stun = 0;
    this.invuln = 0;
    this.flash = 0;
    this.combo = 0;
    this.airAttackUsed = false;
    this.juggle = false;
    this.input = emptyInputFrame();
    this.motion.clear();
    this.sprite.setAlpha(1).clearTint();
    this.render(0);
  }

  get grounded() {
    return this.y >= GROUND_Y;
  }

  get isNeutral() {
    return NEUTRAL.has(this.state);
  }

  get isKO() {
    return this.state === 'ko';
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  // ---------------------------------------------------------------- per-frame logic

  /** Advances one logic frame. `active` is false before FIGHT! and after K.O. */
  step(opponent, active) {
    this.input = active && !this.isKO && this.state !== 'win' ? this.controller.poll() : emptyInputFrame();
    this.motion.push(this.input);
    this.stateTime++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;

    switch (this.state) {
      case 'intro':
      case 'idle':
      case 'walk':
      case 'crouch':
        this.stepNeutral(opponent, active);
        break;
      case 'jump':
        this.stepJump();
        break;
      case 'attack':
        this.stepAttack(opponent);
        break;
      case 'hitstun':
      case 'blockstun':
        this.stepStun();
        break;
      case 'knockdown':
      case 'ko':
        this.stepKnockdown();
        break;
      case 'down':
        if (this.stateTime >= DOWN_FRAMES) {
          this.setState('getup');
          this.invuln = GETUP_FRAMES + 6;
        }
        break;
      case 'getup':
        if (this.stateTime >= GETUP_FRAMES) this.setState('idle');
        break;
      default:
        break;
    }
    this.applyPhysics();
  }

  faceOpponent(opponent) {
    if (Math.abs(opponent.x - this.x) > 4) this.facing = opponent.x > this.x ? 1 : -1;
  }

  holdingForward() {
    return this.facing > 0 ? this.input.right : this.input.left;
  }

  holdingBack() {
    return this.facing > 0 ? this.input.left : this.input.right;
  }

  stepNeutral(opponent, active) {
    this.faceOpponent(opponent);
    this.vx = 0;
    if (!active) {
      if (this.state !== 'intro') this.setState('idle');
      return;
    }
    if (this.tryAttack()) return;
    const inp = this.input;
    if (inp.up) {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      this.vx = dir * JUMP_VX;
      this.vy = JUMP_VY * this.def.jump;
      this.y -= 1;
      this.airAttackUsed = false;
      this.setState('jump');
      Sfx.jump();
      return;
    }
    if (inp.down) {
      if (this.state !== 'crouch') this.setState('crouch');
      return;
    }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) {
      const forward = dir === this.facing;
      this.vx = dir * this.def.walk * (forward ? 1 : BACK_WALK);
      if (this.state !== 'walk') this.setState('walk');
    } else if (this.state !== 'idle') {
      this.setState('idle');
    }
  }

  stepJump() {
    if (!this.airAttackUsed) {
      const btn = ['hp', 'hk', 'lp', 'lk'].find((b) => this.input[b]);
      if (btn) {
        this.airAttackUsed = true;
        this.startAttack(NORMALS.air[btn], 'air');
        return;
      }
    }
    if (this.grounded) this.land();
  }

  land() {
    this.y = GROUND_Y;
    this.vy = 0;
    this.vx = 0;
    this.setState(this.input.down ? 'crouch' : 'idle');
    this.scene.effects.dust(this.x, GROUND_Y);
    Sfx.land();
  }

  /** Reads buttons + motion buffer. Returns true when an attack started. */
  tryAttack() {
    const inp = this.input;
    const punch = inp.lp || inp.hp;
    const kick = inp.lk || inp.hk;
    const canSuper = this.meter >= METER_MAX;
    if (canSuper && (inp.su || ((punch || kick) && this.motion.matches(MOTIONS.super.seq, this.facing, SUPER_WINDOW)))) {
      this.startAttack(this.def.super, 'super');
      return true;
    }
    const sp = this.def.special;
    const spButton = sp.button === 'P' ? punch : kick;
    if (inp.sp || (spButton && this.motion.matches(MOTIONS[sp.motion].seq, this.facing, SPECIAL_WINDOW))) {
      this.startAttack(sp, 'special');
      return true;
    }
    const btn = ['hp', 'hk', 'lp', 'lk'].find((b) => inp[b]);
    if (!btn) return false;
    const set = inp.down ? NORMALS.crouch : NORMALS.stand;
    this.startAttack(set[btn], inp.down ? 'crouch' : 'stand');
    return true;
  }

  startAttack(move, kind) {
    const speed = kind === 'special' || kind === 'super' ? 1 : this.def.speed ?? 1;
    this.attack = {
      move,
      kind,
      frame: 0,
      startup: Math.max(1, Math.round(move.startup * speed)),
      active: move.active,
      recovery: Math.max(1, Math.round(move.recovery * speed)),
      hits: 0,
      nextHitFrame: 0,
      connected: false,
      wasAirborne: false,
    };
    this.invuln = Math.max(this.invuln, move.invuln ?? 0);
    if (kind !== 'air') this.vx = 0;
    this.setState('attack');
    if (kind === 'super') {
      this.meter = 0;
      this.scene.onSuperStart(this);
    } else if (kind === 'special') {
      Sfx.special();
    }
  }

  /** Normals that connected can be cancelled into specials/supers (and light normals chain). */
  tryCancel() {
    const a = this.attack;
    if (!a.connected || a.kind === 'special' || a.kind === 'super' || a.kind === 'air') return false;
    const inp = this.input;
    const anyButton = inp.lp || inp.hp || inp.lk || inp.hk || inp.sp || inp.su;
    if (!anyButton) return false;
    if (a.move.chain || this.wantsSpecial()) return this.tryAttack();
    return false;
  }

  wantsSpecial() {
    const inp = this.input;
    if (inp.sp || (inp.su && this.meter >= METER_MAX)) return true;
    const sp = this.def.special;
    const btn = sp.button === 'P' ? inp.lp || inp.hp : inp.lk || inp.hk;
    return (btn && this.motion.matches(MOTIONS[sp.motion].seq, this.facing, SPECIAL_WINDOW))
      || (this.meter >= METER_MAX && this.motion.matches(MOTIONS.super.seq, this.facing, SUPER_WINDOW));
  }

  get attackPhase() {
    const a = this.attack;
    if (!a) return null;
    if (a.frame < a.startup) return 'startup';
    if (a.frame < a.startup + a.active) return 'active';
    return 'recovery';
  }

  stepAttack(opponent) {
    const a = this.attack;
    const m = a.move;
    if (a.frame > a.startup && this.tryCancel()) return;

    if (a.frame === a.startup) this.onActiveStart(m);
    const phase = this.attackPhase;
    const lungeFrames = a.startup + a.active;
    if (m.lunge && a.frame < lungeFrames && this.grounded) this.x += (this.facing * m.lunge * this.unit) / lungeFrames;

    if (phase === 'active') {
      if (m.dashVx) this.vx = this.facing * m.dashVx;
      if (m.hover) {
        this.y = GROUND_Y - m.hover * this.unit;
        this.vy = 0;
      }
      if (m.fire && a.frame % 2 === 0) this.scene.effects.flame(this.x, this.y - 120 * this.unit);
    } else if (phase === 'recovery' && !m.untilLand) {
      if (m.dashVx && this.grounded) this.vx = 0;
      if (m.hover && a.frame === a.startup + a.active) this.vy = 1;
    }
    if (!this.grounded) a.wasAirborne = true;

    // Air normals end on landing.
    if (a.kind === 'air') {
      a.frame++;
      if (this.grounded) {
        this.attack = null;
        this.land();
      } else if (a.frame >= a.startup + a.active + a.recovery) {
        this.attack = null;
        this.setState('jump');
      }
      return;
    }

    // Moves that stay active until landing (pounce) or recover in the air (uppercuts) freeze the frame counter while airborne.
    const inAir = !this.grounded;
    if (m.untilLand && phase === 'active') {
      if (inAir || a.frame === a.startup) a.frame = Math.min(a.frame + 1, a.startup + a.active - 1);
      if (!inAir && a.wasAirborne) {
        a.frame = a.startup + a.active;
        this.vx = 0;
        this.scene.effects.dust(this.x, GROUND_Y);
      }
      return;
    }
    if (phase === 'recovery' && inAir) return;
    if (phase === 'recovery' && a.wasAirborne && this.vx !== 0) {
      this.vx = 0;
      this.scene.effects.dust(this.x, GROUND_Y);
    }

    a.frame++;
    if (a.frame >= a.startup + a.active + a.recovery) {
      this.attack = null;
      this.faceOpponent(opponent);
      this.setState(this.input.down ? 'crouch' : 'idle');
    }
  }

  onActiveStart(m) {
    if (m.jumpVy) {
      this.vy = m.jumpVy;
      this.y -= 1;
    }
    if (m.projectile) this.scene.spawnProjectile(this, m);
    else if (!m.counter) Sfx.whoosh();
    const box = this.hitbox(true);
    if (box && !m.dashVx && !m.hover) {
      this.scene.effects.swipe(box.centerX, box.centerY, box.width, box.height, this.facing, this.def.color);
    }
  }

  stepStun() {
    this.stun--;
    if (!this.grounded) return; // airborne juggle: physics carries us down
    if (this.stun <= 0) this.setState(this.input.down ? 'crouch' : 'idle');
  }

  stepKnockdown() {
    if (this.grounded && this.vy >= 0 && this.stateTime > 2) {
      this.y = GROUND_Y;
      this.vy = 0;
      this.vx = 0;
      if (this.state === 'knockdown') {
        this.setState('down');
        this.scene.effects.dust(this.x, GROUND_Y);
        this.scene.cameras.main.shake(120, 0.006);
        Sfx.land();
      }
    }
  }

  applyPhysics() {
    this.x += this.vx + this.pushVx;
    this.pushVx *= PUSH_FRICTION;
    if (Math.abs(this.pushVx) < 0.1) this.pushVx = 0;
    const hovering = this.state === 'attack' && this.attack?.move.hover && this.attackPhase === 'active';
    if (!this.grounded && !hovering) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        if (this.state === 'jump') this.land();
        else if (this.state === 'hitstun' || this.state === 'blockstun') this.vx = 0;
      }
    }
  }

  // ---------------------------------------------------------------- combat boxes

  /** Hurtbox in world space, or null while invulnerable/untouchable. */
  hurtbox() {
    if (this.invuln > 0 || ['knockdown', 'down', 'getup', 'ko', 'win'].includes(this.state)) return null;
    const h = this.def.height;
    let height = h * 0.92;
    if (this.state === 'crouch' || (this.state === 'attack' && this.attack.kind === 'crouch')
      || (this.state === 'blockstun' && this.input.down)) height = h * 0.62;
    if (this.state === 'attack' && this.attack.move.lowProfile && this.attackPhase !== 'recovery') height = h * 0.3;
    const w = BODY_W * this.unit;
    return new Phaser.Geom.Rectangle(this.x - w / 2, this.y - height, w, height);
  }

  /** Active hitbox in world space. `ignoreTiming` returns the box regardless of phase (for effects). */
  hitbox(ignoreTiming = false) {
    const a = this.attack;
    if (!a || !a.move.box) return null;
    if (!ignoreTiming && (this.attackPhase !== 'active' || a.hits >= a.move.hits || a.frame < a.nextHitFrame)) return null;
    const b = a.move.box;
    const reach = a.kind === 'special' || a.kind === 'super' ? 1 : this.def.reach;
    const w = b.w * this.unit * reach;
    const h = b.h * this.unit;
    const cx = this.x + this.facing * b.x * this.unit * reach;
    const cy = this.y - b.y * this.unit;
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  }

  pushWidth() {
    return PUSH_W * this.unit;
  }

  /** Parry stance of 澪 is active. */
  isCountering() {
    return this.state === 'attack' && this.attack.move.counter && this.attackPhase === 'active';
  }

  isProjectileInvulnerable() {
    return this.state === 'attack' && this.attack.move.projInvuln && this.attackPhase === 'active';
  }

  triggerCounter() {
    this.startAttack(COUNTER_STRIKE, 'counter');
    this.flash = 8;
  }

  registerHit() {
    const a = this.attack;
    a.hits++;
    a.connected = true;
    a.nextHitFrame = a.frame + (a.move.hitEvery ?? 99);
  }

  canBlock(level) {
    const blockingState = this.isNeutral || this.state === 'blockstun';
    if (!blockingState || !this.grounded || !this.holdingBack()) return false;
    const crouching = this.input.down;
    if (level === 'low') return crouching;
    if (level === 'overhead') return !crouching;
    return true;
  }

  // ---------------------------------------------------------------- receiving hits

  takeHit(move, damage, fromFacing, finalHit) {
    this.health = Math.max(0, this.health - damage);
    this.attack = null;
    this.flash = 4;
    this.gainMeter(damage / 14);
    const airborne = !this.grounded;
    if (this.health <= 0) {
      this.launch(fromFacing, -12, 'ko');
      return;
    }
    if ((move.knockdown && finalHit) || (airborne && finalHit)) {
      this.launch(fromFacing, move.knockdown ? -11 : -7, 'knockdown');
      return;
    }
    this.setState('hitstun');
    this.stun = move.hitstun;
    this.vx = 0;
    if (airborne) this.vy = -4; // juggle: keep them in the air for the next hit
    this.pushVx = fromFacing * (move.damage > 60 ? 7 : 5);
  }

  launch(fromFacing, vy, state) {
    this.setState(state);
    this.vy = vy;
    this.vx = fromFacing * 3.5;
    this.y = Math.min(this.y, GROUND_Y - 1);
    this.stun = 0;
  }

  blockHit(move, chip, fromFacing) {
    this.health = Math.max(1, this.health - chip);
    this.setState('blockstun');
    this.stun = move.blockstun;
    this.vx = 0;
    this.pushVx = fromFacing * 5;
    this.gainMeter(move.damage / 20);
  }

  gainMeter(amount) {
    this.meter = Math.min(METER_MAX, this.meter + amount);
  }

  win() {
    this.attack = null;
    this.vx = 0;
    this.setState('win');
  }

  // ---------------------------------------------------------------- visuals

  /** Fakes animation by transforming the single T-pose image. `shake` jitters during hitstop. */
  render(shake) {
    const s = this.baseScale;
    const f = this.facing;
    const t = this.stateTime;
    let sx = s;
    let sy = s;
    let angle = 0;
    let oy = 0;
    let centerPivot = false;
    let tint = null;
    let alpha = 1;

    switch (this.state) {
      case 'intro':
      case 'idle': {
        const b = Math.sin(this.scene.time.now / 260);
        sy *= 1 + 0.014 * b;
        sx *= 1 - 0.007 * b;
        break;
      }
      case 'walk': {
        const p = t * 0.22;
        oy = -Math.abs(Math.sin(p)) * 9;
        angle = Math.sin(p) * 2.5 + Math.sign(this.vx) * 3;
        break;
      }
      case 'crouch':
        sy *= 0.66;
        sx *= 1.08;
        break;
      case 'jump':
        sy *= this.vy < 0 ? 1.04 : 0.9;
        angle = f * this.vx * 1.2;
        break;
      case 'attack':
        ({ sx, sy, angle, oy, centerPivot, tint } = this.attackPose(s));
        break;
      case 'hitstun':
        angle = -f * (6 + Math.min(this.stun, 10));
        sx *= 0.97;
        break;
      case 'blockstun':
        angle = -f * 4;
        sy *= this.input.down ? 0.66 : 0.97;
        tint = 0x9fc6ff;
        break;
      case 'knockdown':
      case 'ko': {
        const fall = Math.min(1, t / 18);
        angle = -f * 90 * fall;
        sx *= 1 - 0.65 * fall;
        break;
      }
      case 'down':
        angle = -f * 90;
        sx *= 0.35;
        break;
      case 'getup': {
        const up = t / GETUP_FRAMES;
        angle = -f * 90 * (1 - up);
        sx *= 0.35 + 0.65 * up;
        alpha = t % 4 < 2 ? 0.6 : 1;
        break;
      }
      case 'win': {
        const hop = Math.abs(Math.sin(t * 0.12));
        oy = -hop * 30;
        sy *= 1 + hop * 0.05;
        break;
      }
      default:
        break;
    }

    if (this.invuln > 0 && this.state === 'attack') tint = tint ?? 0xfff3b0;

    const spr = this.sprite;
    spr.setFlipX(f < 0);
    spr.setOrigin(0.5, centerPivot ? 0.5 : 1);
    spr.setScale(sx, sy);
    spr.setAngle(angle);
    spr.setAlpha(alpha);
    const pivotLift = centerPivot ? (this.def.height * 0.5) : 0;
    // Lying sprites: lift so the squashed arms don't sink into the floor.
    const lying = Math.abs(angle) > 45 && !centerPivot ? (spr.width * Math.abs(sx)) * 0.45 * Math.min(1, Math.abs(angle) / 90) : 0;
    spr.setPosition(this.x + (shake ? Phaser.Math.Between(-4, 4) : 0), this.y + oy - pivotLift - lying);

    if (this.flash > 0) spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (tint !== null) spr.setTint(tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else spr.clearTint();

    const air = Math.max(0, GROUND_Y - this.y);
    const k = Math.max(0.35, 1 - air / 400);
    this.shadow.setPosition(this.x, GROUND_Y).setScale(k).setAlpha(0.35 * k);
  }

  attackPose(s) {
    const a = this.attack;
    const m = a.move;
    const f = this.facing;
    const phase = this.attackPhase;
    const act = phase === 'active';
    const rec = phase === 'recovery';
    const p = Math.min(1, a.frame / Math.max(1, a.startup));
    const pose = { sx: s, sy: s, angle: 0, oy: 0, centerPivot: false, tint: null };

    switch (m.pose) {
      case 'punch':
        pose.angle = f * (act ? 12 : rec ? 6 : -4 * p);
        pose.sx = s * (act ? 1.06 : 1);
        break;
      case 'kick':
        pose.angle = -f * (act ? 18 : rec ? 8 : 6 * p);
        pose.sy = s * (act ? 1.03 : 1);
        break;
      case 'low':
        pose.sy = s * 0.62;
        pose.sx = s * (act ? 1.16 : 1.08);
        pose.angle = f * (act ? 8 : 2);
        break;
      case 'uppercut':
        pose.sy = s * (phase === 'startup' ? 0.7 : act ? 1.1 : 0.9);
        pose.angle = -f * (act ? 6 : 0);
        break;
      case 'air':
        pose.angle = f * (act ? 20 : 8);
        pose.sy = s * 0.92;
        break;
      case 'airkick':
        pose.angle = -f * (act ? 24 : 10);
        pose.sy = s * 0.9;
        break;
      case 'cast':
        pose.angle = f * (phase === 'startup' ? -8 * p : 14);
        pose.sx = s * (phase === 'startup' ? 0.96 : 1.06);
        pose.tint = phase === 'startup' ? 0xbfe6ff : null;
        break;
      case 'slide':
        pose.angle = f * (phase === 'startup' ? 25 * p : act ? 78 : 40);
        pose.sy = s * (act ? 0.9 : 1);
        break;
      case 'rise':
        pose.sy = s * (phase === 'startup' ? 0.75 : 1.1);
        pose.angle = -f * (act ? 10 : 4);
        break;
      case 'spin':
        pose.sx = act ? s * Math.cos(a.frame * 0.7) : s;
        pose.angle = act ? -f * 8 : 0;
        break;
      case 'claw':
        pose.angle = f * (act ? (a.frame % 6 < 3 ? 18 : 2) : 4);
        pose.sx = s * (act ? 1.05 : 1);
        break;
      case 'pounce':
        pose.angle = f * (phase === 'startup' ? -10 : act ? 45 : 10);
        pose.sy = s * (phase === 'startup' ? 0.8 : 1);
        break;
      case 'flip':
        pose.centerPivot = act;
        pose.angle = act ? -f * (a.frame - a.startup) * 22 : f * -6;
        pose.sy = s * (phase === 'startup' ? 0.8 : 1);
        break;
      case 'counter':
        pose.angle = -f * 6;
        pose.sy = s * 0.96;
        pose.tint = act ? (a.frame % 6 < 3 ? 0xa8e4ff : 0xffffff) : null;
        break;
      default:
        break;
    }
    return pose;
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
