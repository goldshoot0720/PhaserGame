import Phaser from 'phaser';
import { TOTAL_LAPS } from '../config.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { getTrack } from '../data/tracks.js';
import { TrackGeometry } from '../systems/TrackGeometry.js';
import { TrackRenderer } from '../systems/TrackRenderer.js';
import { Effects } from '../systems/Effects.js';
import { Kart, KART_RADIUS } from '../objects/Kart.js';
import { AIDriver } from '../objects/AIDriver.js';
import { ItemSystem, ITEM_NAMES } from '../objects/ItemSystem.js';
import { Sound } from '../systems/Sound.js';
import { submitRecords } from '../systems/Storage.js';

const COUNTDOWN = 3;

export class RaceScene extends Phaser.Scene {
  constructor() {
    super('Race');
  }

  init(data) {
    this.params = {
      trackId: data.trackId || 'ocean',
      charId: data.charId || 'whale',
      mode: data.mode || 'item',
    };
  }

  create() {
    this.leaving = false;
    const P = this.params;
    this.trackData = getTrack(P.trackId);
    this.track = new TrackGeometry(this.trackData);
    this.renderer = new TrackRenderer(this, this.track);
    this.renderer.build(0);
    this.minimap = this.renderer.buildMinimap(200);
    this.fx = new Effects(this);

    // 參賽者：玩家 + 其他 7 位角色
    const playerChar = getCharacter(P.charId);
    const others = Phaser.Utils.Array.Shuffle(CHARACTERS.filter((c) => c.id !== playerChar.id));
    const order = Phaser.Utils.Array.Shuffle([playerChar, ...others]);
    const onEvent = (type, kart, data) => this.onKartEvent(type, kart, data);
    this.racers = order.map((c, i) => {
      const k = new Kart(this, c, this.track, { isPlayer: c === playerChar, fx: this.fx, events: onEvent });
      const row = Math.floor(i / 2);
      const p = this.track.pointAt(-70 - row * 80, i % 2 === 0 ? -52 : 52);
      k.placeAt(p.x, p.y, p.heading);
      k.gridSlot = i;
      return k;
    });
    this.player = this.racers.find((k) => k.isPlayer);
    const skills = Phaser.Utils.Array.Shuffle([0.72, 0.78, 0.82, 0.86, 0.9, 0.94, 0.98]);
    this.ais = this.racers.filter((k) => !k.isPlayer).map((k, i) => new AIDriver(k, skills[i]));
    this.autopilot = null;

    this.items = null;
    if (P.mode === 'item') {
      this.items = new ItemSystem(this, this.track, this.racers, this.fx, (t, k, d) => this.onItemEvent(t, k, d));
    }

    // 相機
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.track.width, this.track.height);
    cam.setZoom(1);
    cam.centerOn(this.player.x, this.player.y);
    this.camPos = new Phaser.Math.Vector2(this.player.x, this.player.y);
    this.camZoom = 1;
    cam.setBackgroundColor(this.trackData.theme.bg);

    // 按鍵
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      up: KC.UP, down: KC.DOWN, left: KC.LEFT, right: KC.RIGHT,
      w: KC.W, a: KC.A, s: KC.S, d: KC.D,
      shift: KC.SHIFT, ctrl: KC.CTRL, space: KC.SPACE,
      z: KC.Z, x: KC.X, r: KC.R,
    });
    // 以按下事件鎖存單次按鍵（避免極短的點按在同一影格內按下又放開而遺失）
    this.taps = { nitro: false, item: false, up: false, respawn: false };
    const latch = (key, name) => key.on('down', () => { this.taps[name] = true; });
    latch(this.keys.ctrl, 'nitro');
    latch(this.keys.space, 'nitro');
    latch(this.keys.z, 'item');
    latch(this.keys.x, 'item');
    latch(this.keys.up, 'up');
    latch(this.keys.w, 'up');
    latch(this.keys.r, 'respawn');

    // 比賽狀態
    this.state = 'countdown';
    this.countdown = COUNTDOWN + 0.8;
    this.lastBeep = COUNTDOWN + 1;
    this.raceTime = 0;
    this.finishTimer = 0;
    this.earlyThrottle = false;
    this.startBoost = false;
    this.respawnCooldown = 0;
    this.finishOrder = [];
    this.updateRanks();

    Sound.startEngine();
    this.scene.launch('HUD', { race: this });
    this.hud = this.scene.get('HUD');

    this.events.once('shutdown', () => {
      Sound.stopEngine();
      this.scene.stop('HUD');
    });
    this.cameras.main.fadeIn(400);
  }

  message(text, color, size, duration) {
    if (this.hud && this.hud.showMessage) this.hud.showMessage(text, color, size, duration);
  }

  nearPlayer(x, y, dist = 700) {
    return Math.hypot(x - this.player.x, y - this.player.y) < dist;
  }

  onKartEvent(type, kart, data) {
    const isP = kart === this.player;
    switch (type) {
      case 'nitroReady':
        if (isP) {
          Sound.nitroReady();
          if (this.hud) this.hud.flashNitro();
        }
        break;
      case 'driftEnd':
        if (isP && this.hud) this.hud.showInstantPrompt();
        break;
      case 'instant':
        if (isP) {
          Sound.instant();
          this.message('瞬間加速！', '#7df9ff', 40, 700);
        }
        break;
      case 'nitro':
        if (isP) {
          Sound.boost();
          this.cameras.main.shake(220, 0.004);
          this.message('氮氣加速！', '#ffb347', 44, 700);
        } else if (this.nearPlayer(kart.x, kart.y, 500)) {
          Sound.noise(0.4, 0.12, 900, 0.7);
        }
        break;
      case 'wall':
        this.fx.sparks(data.x, data.y, 8);
        if (isP) {
          Sound.wall();
          if (data.power > 300) this.cameras.main.shake(120, 0.003);
        }
        break;
      case 'hit':
        this.fx.stars(kart.x, kart.y, 12);
        if (isP) {
          Sound.hit();
          this.cameras.main.shake(300, 0.008);
          const txt = data.kind === 'water' ? '被水炸彈困住了！' : data.kind === 'missile' ? '被飛彈擊中！' : '踩到香蕉皮！';
          this.message(txt, '#ff8787', 36, 1000);
        } else if (this.nearPlayer(kart.x, kart.y)) {
          Sound.bump();
        }
        break;
      case 'blocked':
        this.fx.sparks(kart.x, kart.y, 16);
        if (isP) {
          Sound.shield();
          this.message('護盾抵擋！', '#ffe066', 36, 800);
        }
        break;
      case 'lap':
        if (isP) {
          Sound.lap();
          if (data.lap === TOTAL_LAPS) this.message('最後一圈！', '#ff6b6b', 56, 1400);
          else this.message(`第 ${data.lap} 圈`, '#ffffff', 50, 1100);
        }
        break;
      case 'finish':
        this.finishOrder.push(kart);
        if (isP) this.onPlayerFinish();
        break;
      default:
        break;
    }
  }

  onItemEvent(type, kart, data) {
    const isP = kart === this.player;
    switch (type) {
      case 'pickup':
        if (isP) {
          Sound.pickup();
          if (this.hud) this.hud.itemPicked(data.type);
        }
        break;
      case 'use':
        if (data.type === 'missile' && (isP || this.nearPlayer(kart.x, kart.y))) Sound.launch();
        if (isP) {
          if (data.type === 'shield') Sound.shield();
          if (data.type === 'booster') {
            Sound.boost();
            this.cameras.main.shake(180, 0.003);
          }
          if (data.type === 'banana' || data.type === 'water') Sound.click();
          this.message(ITEM_NAMES[data.type], '#ffffff', 30, 600);
        }
        break;
      case 'targeted':
        if (isP) {
          Sound.wrong();
          if (this.hud) this.hud.missileWarning(data.owner);
        }
        break;
      case 'missileHit':
      case 'banana':
      case 'waterHit':
        if (data.owner === this.player && !isP && data.affected) {
          this.message(`命中 ${kart.char.name}！`, '#69db7c', 32, 900);
        }
        break;
      case 'splash':
        if (this.nearPlayer(data.x, data.y)) Sound.splash();
        break;
      case 'explode':
        if (this.nearPlayer(data.x, data.y)) Sound.hit();
        break;
      default:
        break;
    }
  }

  onPlayerFinish() {
    this.state = 'finished';
    this.finishTimer = 0;
    Sound.finish();
    const p = this.player;
    this.records = submitRecords(this.trackData.id, p.bestLap, p.finishTime);
    this.message(p.rank === 1 ? '冠軍！FINISH！' : 'FINISH！', '#ffe066', 72, 2500);
    this.autopilot = new AIDriver(p, 0.9);
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(i * 40, () => this.fx.stars(p.x + Phaser.Math.Between(-80, 80), p.y + Phaser.Math.Between(-80, 80), 3));
    }
  }

  readPlayerInput() {
    const k = this.keys;
    const inp = this.player.input;
    const taps = this.taps;
    const upTap = taps.up;
    inp.throttle = k.up.isDown || k.w.isDown ? 1 : 0;
    inp.brake = k.down.isDown || k.s.isDown ? 1 : 0;
    inp.steer = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    inp.drift = k.shift.isDown;
    if (taps.nitro) inp.nitro = true;
    if (taps.item) inp.item = true;
    if (upTap) inp.instantTap = true;
    const wantRespawn = taps.respawn;
    taps.nitro = taps.item = taps.up = taps.respawn = false;
    if (wantRespawn && this.respawnCooldown <= 0 && this.state === 'racing') {
      this.respawnCooldown = 3;
      this.player.respawn();
      this.message('回到賽道', '#ffffff', 28, 600);
    }
    return upTap;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    const active = this.state !== 'countdown';
    this.respawnCooldown = Math.max(0, this.respawnCooldown - dt);

    // 倒數
    if (this.state === 'countdown') {
      const upTap = this.readPlayerInput();
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n <= COUNTDOWN && n < this.lastBeep && n > 0) {
        this.lastBeep = n;
        Sound.countdown();
        if (this.hud) this.hud.showCountdown(String(n));
      }
      // 起步加速：在 GO 前 0.4 秒內按下 ↑，太早按則失效
      if (upTap) {
        if (this.countdown > 0.4) this.earlyThrottle = true;
        else if (!this.earlyThrottle) this.startBoost = true;
      }
      if (this.countdown <= 0) {
        this.state = 'racing';
        Sound.go();
        if (this.hud) this.hud.showCountdown('GO!');
        if (this.startBoost) {
          this.player.addBoost(1.0, 1.3, 'instant');
          this.message('起步加速！', '#7df9ff', 40, 900);
        }
        for (const ai of this.ais) {
          if (Math.random() < 0.25 + ai.skill * 0.3) ai.kart.addBoost(0.9, 1.25, 'instant');
        }
      }
    } else if (!this.player.finished) {
      this.readPlayerInput();
    }

    if (this.state !== 'countdown') this.raceTime += dt * 1000;

    const ctx = { racers: this.racers, player: this.player, items: this.items, active };
    for (const ai of this.ais) ai.update(dt, ctx);
    if (this.autopilot) this.autopilot.update(dt, { ...ctx, player: null });

    // 氮氣 / 道具使用
    for (const k of this.racers) {
      if (k.input.nitro) k.useNitro();
      if (k.input.item && this.items && active) this.items.use(k);
    }

    for (const k of this.racers) k.update(dt, active, this.raceTime);
    this.collideKarts();
    if (this.items) this.items.update(dt);
    this.updateRanks();
    this.fx.update();
    this.updateCamera(dt);

    const p = this.player;
    Sound.updateEngine(Math.min(1.3, p.speed / p.phys.maxSpeed), p.drifting, p.boostTime > 0);

    // 完賽
    if (this.state === 'finished') {
      this.finishTimer += dt;
      const allDone = this.racers.every((k) => k.finished);
      if ((allDone && this.finishTimer > 2.5) || this.finishTimer > 9) this.gotoResults();
    }
  }

  collideKarts() {
    const rs = this.racers;
    const min = KART_RADIUS * 2;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i];
      for (let j = i + 1; j < rs.length; j++) {
        const b = rs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const ma = a.boostTime > 0 ? 2.2 : 1;
        const mb = b.boostTime > 0 ? 2.2 : 1;
        const tot = ma + mb;
        const overlap = min - d;
        a.x -= nx * overlap * (mb / tot);
        a.y -= ny * overlap * (mb / tot);
        b.x += nx * overlap * (ma / tot);
        b.y += ny * overlap * (ma / tot);
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const jimp = (-(1 + 0.45) * rel) / (1 / ma + 1 / mb);
          a.vx -= (nx * jimp) / ma;
          a.vy -= (ny * jimp) / ma;
          b.vx += (nx * jimp) / mb;
          b.vy += (ny * jimp) / mb;
          if (-rel > 120 && (a === this.player || b === this.player)) {
            Sound.bump();
            this.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
          }
        }
      }
    }
  }

  updateRanks() {
    const sorted = [...this.racers].sort((a, b) => b.progress - a.progress);
    sorted.forEach((k, i) => (k.rank = i + 1));
    this.sorted = sorted;
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.cameras.main;
    const look = 0.32;
    const tx = p.x + Phaser.Math.Clamp(p.vx * look, -260, 260);
    const ty = p.y + Phaser.Math.Clamp(p.vy * look, -170, 170);
    const lerp = 1 - Math.exp(-dt * 5);
    this.camPos.x += (tx - this.camPos.x) * lerp;
    this.camPos.y += (ty - this.camPos.y) * lerp;
    const speedRatio = Math.min(1.4, p.speed / p.phys.maxSpeed);
    const targetZoom = 1.02 - speedRatio * 0.1 - (p.boostTime > 0 ? 0.06 : 0);
    this.camZoom += (targetZoom - this.camZoom) * (1 - Math.exp(-dt * 2.5));
    cam.setZoom(this.camZoom);
    cam.centerOn(this.camPos.x, this.camPos.y);
  }

  gotoResults() {
    if (this.leaving) return;
    this.leaving = true;
    const standings = this.sorted.map((k) => ({
      charId: k.char.id,
      name: k.char.name,
      isPlayer: k.isPlayer,
      finished: k.finished,
      time: k.finishTime,
      bestLap: k.bestLap,
      rank: k.rank,
    }));
    const data = {
      standings,
      trackId: this.trackData.id,
      trackName: this.trackData.name,
      mode: this.params.mode,
      charId: this.params.charId,
      records: this.records || { newLap: false, newRace: false },
      playerLaps: this.player.lapTimes.slice(),
    };
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Results', data));
  }

  restartRace() {
    this.scene.start('Race', { ...this.params });
  }

  quitToMenu() {
    this.scene.start('Title');
  }
}
