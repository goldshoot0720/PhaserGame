function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * 電腦對手：沿著中心線（加上隨機路線偏移）行駛，會甩尾、放氮氣、用道具，
 * 並以動態平衡（rubber-banding）讓比賽保持接近。
 */
export class AIDriver {
  constructor(kart, skill = 0.9, rng = Math.random) {
    this.kart = kart;
    this.skill = skill; // 0~1
    this.rng = rng;
    this.lane = (rng() * 2 - 1) * 0.4;
    this.laneTarget = this.lane;
    this.laneTimer = 1 + rng() * 3;
    this.driftHold = 0;
    this.nitroCooldown = 2 + rng() * 2;
    this.itemTimer = 1 + rng() * 2;
    this.itemHeld = 0;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.avoidTimer = 0;
    this.instantPending = -1;
  }

  /** ctx: { racers, player, items (ItemSystem 或 null), active } */
  update(dt, ctx) {
    const k = this.kart;
    const t = k.track;
    const inp = k.input;
    inp.throttle = 0;
    inp.brake = 0;
    inp.steer = 0;
    inp.drift = false;
    if (!ctx.active) {
      // 倒數時：部分電腦會在最後瞬間踩油門（起步加速）
      return;
    }

    // 路線偏移
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 1.5 + this.rng() * 3;
      this.laneTarget = (this.rng() * 2 - 1) * 0.5;
    }
    this.avoidTimer = Math.max(0, this.avoidTimer - dt);
    if (ctx.items && this.avoidTimer <= 0) {
      const hazard = ctx.items.hazardAhead(k, 420);
      if (hazard) {
        // 閃避香蕉皮
        this.laneTarget = hazard.lateral > 0 ? -0.55 : 0.55;
        this.avoidTimer = 0.8;
      }
    }
    this.lane += (this.laneTarget - this.lane) * Math.min(1, dt * 1.5);

    const speed = Math.max(0, k.vF);
    const lookDist = 110 + speed * 0.42;
    const idxAhead = Math.round(lookDist / t.ds);
    const curv = t.curvatureAhead(k.idx, idxAhead + 8);
    // 彎道時偏向內側
    let lane = this.lane * t.roadHalf;
    lane += Math.sign(curv) * Math.min(0.45, Math.abs(curv) * 0.6) * t.roadHalf;
    lane = Math.max(-t.roadHalf * 0.72, Math.min(t.roadHalf * 0.72, lane));

    const target = t.pointAt(k.s + lookDist, lane);
    const desired = Math.atan2(target.y - k.y, target.x - k.x);
    const diff = wrapAngle(desired - k.heading);

    // 卡住處理（倒車）
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      inp.brake = 1;
      inp.steer = -Math.sign(diff);
      return;
    }
    if (!k.locked && speed < 35 && !k.finished) {
      this.stuckTime += dt;
      if (this.stuckTime > 1.3) {
        this.stuckTime = 0;
        this.reverseTime = 0.7;
        this.stuckCount = (this.stuckCount || 0) + 1;
        if (this.stuckCount >= 3) {
          this.stuckCount = 0;
          k.respawn();
        }
      }
    } else {
      this.stuckTime = 0;
      if (speed > 200) this.stuckCount = 0;
    }

    inp.steer = Math.max(-1, Math.min(1, diff * 2.6));
    inp.throttle = 1;

    // 急彎減速
    const turnAhead = t.maxTurnAhead(k.idx, 2, 26);
    if (Math.abs(diff) > 0.9 && speed > 260) {
      inp.throttle = 0;
      inp.brake = 0.6;
    } else if (turnAhead > 0.85 && speed > k.phys.maxSpeed * 0.8 && k.boostTime <= 0) {
      inp.throttle = 0;
      if (speed > k.phys.maxSpeed * 0.92) inp.brake = 0.35;
    }

    // 甩尾
    if (this.driftHold > 0) {
      this.driftHold -= dt;
      inp.drift = true;
      if (turnAhead < 0.18 && this.driftHold < 0.6) this.driftHold = 0;
      if (this.driftHold <= 0) {
        // 放開後嘗試瞬間加速
        if (this.rng() < 0.35 + this.skill * 0.45) this.instantPending = 0.1 + this.rng() * 0.25;
      }
    } else if (turnAhead > 0.42 && speed > k.phys.maxSpeed * 0.55 && Math.abs(inp.steer) > 0.2) {
      if (this.rng() < 0.5 + this.skill * 0.5) this.driftHold = 0.5 + Math.min(1.2, turnAhead * 0.9);
    }
    if (this.instantPending >= 0) {
      this.instantPending -= dt;
      if (this.instantPending < 0) inp.instantTap = true;
    }

    // 氮氣
    this.nitroCooldown -= dt;
    if (k.nitroSlots > 0 && this.nitroCooldown <= 0 && !k.drifting) {
      const straight = t.maxTurnAhead(k.idx, 0, 45) < 0.35;
      if (straight || k.nitroSlots >= 2) {
        k.useNitro();
        this.nitroCooldown = 2.5 + this.rng() * 3;
      }
    }

    // 道具
    if (ctx.items && k.items.length > 0) {
      this.itemHeld += dt;
      this.itemTimer -= dt;
      if (this.itemTimer <= 0) {
        this.itemTimer = 0.3;
        if (this.shouldUse(k.items[0], ctx)) {
          inp.item = true;
          this.itemHeld = 0;
          this.itemTimer = 0.8 + this.rng() * 1.2;
        }
      }
    } else {
      this.itemHeld = 0;
    }

    // 動態平衡
    const player = ctx.player;
    let target2 = 0.955 + this.skill * 0.06;
    if (player && player !== k && !player.finished) {
      const gap = player.progress - k.progress;
      if (gap > 700) target2 += Math.min(0.13, (gap - 700) / 9000);
      else if (gap < -500) target2 -= Math.min(0.09, (-gap - 500) / 12000);
    }
    k.speedMul += (target2 - k.speedMul) * Math.min(1, dt * 0.8);
  }

  shouldUse(item, ctx) {
    const k = this.kart;
    const racers = ctx.racers;
    const ahead = racers.find((r) => r.rank === k.rank - 1);
    const behind = racers.find((r) => r.rank === k.rank + 1);
    const t = k.track;
    const r = this.rng();
    switch (item) {
      case 'missile':
        return (ahead && ahead.progress - k.progress < 2200) || this.itemHeld > 6;
      case 'water': {
        if (ahead) {
          const gap = ahead.progress - k.progress;
          if (gap > 120 && gap < 520) return true;
        }
        return this.itemHeld > 9 && r < 0.3;
      }
      case 'banana':
        return (behind && k.progress - behind.progress < 450) || this.itemHeld > 7;
      case 'shield':
        return (ctx.items && ctx.items.isTargeted(k)) || this.itemHeld > 14;
      case 'booster':
        return t.maxTurnAhead(k.idx, 0, 40) < 0.3 || this.itemHeld > 5;
      default:
        return true;
    }
  }
}
