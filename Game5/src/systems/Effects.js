import Phaser from 'phaser';

/** Short-lived visual effects drawn with Graphics + tweens. */
export class Effects {
  constructor(scene, depth = 50) {
    this.scene = scene;
    this.depth = depth;
  }

  graphics(x, y, depth = this.depth) {
    return this.scene.add.graphics({ x, y }).setDepth(depth);
  }

  fade(target, duration, extra = {}) {
    this.scene.tweens.add({ targets: target, alpha: 0, duration, ...extra, onComplete: () => target.destroy() });
  }

  /** Star-burst spark with flying shards; `heavy` makes it bigger. */
  hitSpark(x, y, heavy, color = 0xfff27a) {
    const g = this.graphics(x, y);
    const r = heavy ? 60 : 38;
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 ? r * 0.35 : r * Phaser.Math.FloatBetween(0.8, 1.2);
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
    }
    g.fillStyle(color, 1).fillPoints(pts, true);
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, r * 0.3);
    g.setScale(0.4);
    this.scene.tweens.add({ targets: g, scale: 1.2, duration: 90, ease: 'Quad.Out' });
    this.fade(g, 220, { delay: 60 });
    const shards = heavy ? 10 : 6;
    for (let i = 0; i < shards; i++) {
      const s = this.graphics(x, y);
      s.fillStyle(i % 2 ? 0xffffff : color, 1).fillRect(-3, -3, 6, 6);
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.Between(40, heavy ? 140 : 90);
      this.fade(s, 300, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 180 });
    }
  }

  blockSpark(x, y, facing) {
    const g = this.graphics(x, y);
    g.lineStyle(6, 0x8fd3ff, 1);
    g.beginPath();
    g.arc(0, 0, 44, Math.PI * (facing > 0 ? 0.65 : -0.35), Math.PI * (facing > 0 ? 1.35 : 0.35));
    g.strokePath();
    g.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 18);
    this.fade(g, 220, { scale: 1.4 });
  }

  /** Motion streak where an attack's hitbox is (makes T-pose attacks readable). */
  swipe(x, y, w, h, facing, color = 0xffffff) {
    const g = this.graphics(x, y, this.depth - 5);
    g.fillStyle(color, 0.55);
    g.fillEllipse(0, 0, w, h * 0.7);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(facing * w * 0.25, 0, w * 0.4, h * 0.35);
    this.fade(g, 140, { scaleX: 1.3 });
  }

  dust(x, y) {
    for (let i = -1; i <= 1; i += 2) {
      const g = this.graphics(x, y, 5);
      g.fillStyle(0xd8c8a8, 0.6).fillEllipse(0, 0, 50, 18);
      this.fade(g, 350, { x: x + i * 60, scaleX: 1.8, y: y - 8 });
    }
  }

  flame(x, y) {
    const g = this.graphics(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), this.depth - 5);
    g.fillStyle(Phaser.Math.RND.pick([0xff5a1f, 0xffb02e, 0xff2d2d]), 0.85).fillCircle(0, 0, Phaser.Math.Between(12, 24));
    this.fade(g, 300, { y: g.y - 50, scale: 0.2 });
  }

  counterFlash(x, y) {
    const g = this.graphics(x, y);
    g.lineStyle(8, 0xbfe8ff, 1).strokeCircle(0, 0, 40);
    g.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 70);
    this.fade(g, 350, { scale: 2 });
  }
}
