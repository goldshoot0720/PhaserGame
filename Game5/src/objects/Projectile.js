import Phaser from 'phaser';
import { STAGE_LEFT, STAGE_RIGHT } from '../config.js';

const LAUNCH_HEIGHT = 180; // above the feet, for a 320px fighter

/** A travelling attack (e.g. 鯨浪波). Owns its own hit counter; drawn with Graphics. */
export class Projectile {
  constructor(scene, owner, move) {
    const p = move.projectile;
    this.scene = scene;
    this.owner = owner;
    this.move = move;
    this.dir = owner.facing;
    this.speed = p.speed;
    this.w = p.w;
    this.h = p.h;
    this.life = p.life;
    this.hitsLeft = p.hits ?? 1;
    this.hitEvery = p.hitEvery ?? 0;
    this.cooldown = 0;
    this.style = p.style;
    this.color = p.color;
    this.age = 0;
    this.x = owner.x + this.dir * 70 * owner.unit;
    this.y = owner.y - LAUNCH_HEIGHT * owner.unit + (p.style === 'bigwave' ? 60 : 0);
    this.gfx = scene.add.graphics().setDepth(30);
    this.alive = true;
  }

  step() {
    this.age++;
    this.x += this.dir * this.speed;
    if (this.cooldown > 0) this.cooldown--;
    if (--this.life <= 0 || this.x < STAGE_LEFT - 150 || this.x > STAGE_RIGHT + 150) this.destroy();
  }

  hitbox() {
    if (!this.alive || this.cooldown > 0) return null;
    return new Phaser.Geom.Rectangle(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
  }

  /** Called when it connects (hit or block). */
  consumeHit() {
    this.hitsLeft--;
    this.cooldown = this.hitEvery;
    if (this.hitsLeft <= 0) this.destroy();
  }

  render() {
    if (!this.alive) return;
    const g = this.gfx;
    const t = this.age;
    g.clear();
    g.setPosition(this.x, this.y);
    g.setScale(this.dir, 1);
    if (this.style === 'bigwave') {
      for (let i = 0; i < 4; i++) {
        const r = this.h * (0.5 - i * 0.09) + Math.sin(t * 0.3 + i) * 6;
        g.fillStyle(i % 2 ? 0x9fe3ff : this.color, 0.55 + i * 0.1);
        g.fillEllipse(-i * 18, 0, r * 1.2, r * 2);
      }
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 6; i++) g.fillCircle(20 + Math.sin(t * 0.4 + i * 2) * 30, -80 + i * 32, 8);
    } else {
      const wob = Math.sin(t * 0.4) * 5;
      g.fillStyle(this.color, 0.35).fillEllipse(-30, 0, 110, this.h + wob);
      g.lineStyle(10, this.color, 0.95);
      g.beginPath();
      g.arc(-10, 0, this.h * 0.5, -1.1, 1.1);
      g.strokePath();
      g.lineStyle(5, 0xffffff, 0.95);
      g.beginPath();
      g.arc(0, 0, this.h * 0.38 + wob * 0.3, -1.0, 1.0);
      g.strokePath();
      g.fillStyle(0xffffff, 0.8).fillCircle(-40, Math.sin(t * 0.5) * 12, 6);
    }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.effects.hitSpark(this.x, this.y, false, this.color);
    this.gfx.destroy();
  }
}
