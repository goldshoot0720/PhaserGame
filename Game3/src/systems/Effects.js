import Phaser from 'phaser';

/** 粒子與胎痕等視覺特效 */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    // 胎痕池
    this.skids = [];
    this.skidIdx = 0;
    const SKIDS = 700;
    for (let i = 0; i < SKIDS; i++) {
      const im = scene.add.image(-100, -100, 'skid').setDepth(1).setVisible(false);
      im.birth = 0;
      this.skids.push(im);
    }

    const mk = (tex, cfg, depth) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      return e;
    };
    this.flameE = mk('flame', {
      lifespan: 260, speed: { min: 30, max: 90 }, scale: { start: 0.9, end: 0.1 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD',
    }, 4.5);
    this.blueE = mk('blueflame', {
      lifespan: 240, speed: { min: 30, max: 90 }, scale: { start: 0.8, end: 0.1 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD',
    }, 4.5);
    this.smokeE = mk('smoke', {
      lifespan: 700, speed: { min: 10, max: 40 }, scale: { start: 0.5, end: 1.6 },
      alpha: { start: 0.45, end: 0 },
    }, 3);
    this.dustE = mk('smoke', {
      lifespan: 500, speed: { min: 20, max: 60 }, scale: { start: 0.4, end: 1.1 },
      alpha: { start: 0.6, end: 0 },
    }, 3);
    this.sparkE = mk('spark', {
      lifespan: 400, speed: { min: 120, max: 320 }, scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD',
    }, 9);
    this.starE = mk('star', {
      lifespan: 700, speed: { min: 60, max: 180 }, scale: { start: 1, end: 0.2 },
      rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 },
    }, 9);
    this.splashE = mk('glow', {
      lifespan: 600, speed: { min: 80, max: 260 }, scale: { start: 0.5, end: 0 },
      tint: [0x74c0fc, 0xa5d8ff, 0xffffff], alpha: { start: 0.9, end: 0 },
    }, 9);
    this.boomE = mk('flame', {
      lifespan: 500, speed: { min: 60, max: 240 }, scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD',
    }, 9);
    this.trailE = mk('smoke', {
      lifespan: 400, speed: { min: 0, max: 15 }, scale: { start: 0.35, end: 0.9 },
      alpha: { start: 0.5, end: 0 },
    }, 6);
  }

  skid(x, y, rot) {
    const im = this.skids[this.skidIdx];
    this.skidIdx = (this.skidIdx + 1) % this.skids.length;
    im.setPosition(x, y).setRotation(rot).setVisible(true).setAlpha(0.7);
    im.birth = this.scene.time.now;
  }

  update() {
    const now = this.scene.time.now;
    for (const im of this.skids) {
      if (!im.visible) continue;
      const age = now - im.birth;
      if (age > 5000) im.setVisible(false);
      else if (age > 3000) im.setAlpha(0.7 * (1 - (age - 3000) / 2000));
    }
  }

  flame(x, y, heading, kind = 'flame') {
    const e = kind === 'blueflame' ? this.blueE : this.flameE;
    e.emitParticleAt(x + Phaser.Math.Between(-2, 2), y + Phaser.Math.Between(-2, 2), 1);
  }

  smoke(x, y) { this.smokeE.emitParticleAt(x, y, 1); }

  dust(x, y, color) {
    this.dustE.setParticleTint(Phaser.Display.Color.HexStringToColor(color).color);
    this.dustE.emitParticleAt(x, y, 1);
  }

  sparks(x, y, n = 10) { this.sparkE.emitParticleAt(x, y, n); }
  stars(x, y, n = 10) { this.starE.emitParticleAt(x, y, n); }
  splash(x, y, n = 30) { this.splashE.emitParticleAt(x, y, n); }
  boom(x, y, n = 24) { this.boomE.emitParticleAt(x, y, n); }
  trail(x, y) { this.trailE.emitParticleAt(x, y, 1); }
}
