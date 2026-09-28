import Phaser from 'phaser';
import { WIDTH, HEIGHT, WEAPONS, makeTerrain, surface, traceShot, damageAt, carveCrater, chooseAiShot } from './ballistics.js';

const KEYS = ['luna', 'penguin', 'xiang', 'zhe', 'calico', 'whitecat', 'xiaohong', 'yukino'];
const NAMES = ['小鯨', '企鵝妹', '眼鏡哥', '阿弟', '三花貓', '白貓', '紅貓娘', '水手服'];
const STYLE = { fontFamily: 'Arial, "PingFang TC", sans-serif', color: '#ffffff' };
const text = (scene, x, y, value, size = 20, color = '#ffffff') => scene.add.text(x, y, value, { ...STYLE, fontSize: `${size}px`, color });

function button(scene, x, y, w, label, callback, color = 0x315d86) {
  const bg = scene.add.rectangle(x, y, w, 42, color).setStrokeStyle(2, 0x9ed9f2).setInteractive({ useHandCursor: true });
  const labelText = text(scene, x, y, label, 19).setOrigin(.5);
  bg.on('pointerdown', callback);
  return { setVisible(show) { bg.setVisible(show); labelText.setVisible(show); if (show) bg.setInteractive(); else bg.disableInteractive(); } };
}

class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  preload() { KEYS.forEach(key => this.load.image(key, `/assets/characters/${key}.png`)); }
  create() {
    this.cameras.main.setBackgroundColor('#102342');
    text(this, 550, 53, '萌友瘋狂坦克', 53, '#ffe188').setOrigin(.5);
    text(this, 550, 111, '選飛行員，調整角度與火力，利用地形擊倒敵方坦克！', 21, '#c9e5f7').setOrigin(.5);
    NAMES.forEach((name, i) => {
      const x = 158 + i % 4 * 262, y = 231 + Math.floor(i / 4) * 212;
      this.add.rectangle(x, y, 222, 182, 0x26486a).setStrokeStyle(2, 0x83b6d4);
      this.add.image(x, y - 19, KEYS[i]).setDisplaySize(105, 125);
      text(this, x, y + 67, name, 22).setOrigin(.5);
      this.add.zone(x, y, 222, 182).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Battle', { chosen: i }));
    });
    text(this, 550, 694, 'A / D 調角度　W / S 調火力　1 / 2 / 3 換武器　Space 開火', 20, '#d0e9f7').setOrigin(.5);
  }
}

class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(data) { this.chosen = data.chosen ?? 0; }
  create() {
    this.terrain = makeTerrain();
    this.wind = Phaser.Math.Between(-4, 4);
    this.turn = 0; this.shots = 0; this.finished = false; this.flying = false;
    this.tanks = [
      { x: 160, character: this.chosen, hp: 100, angle: 45, power: 70, weapon: 0, side: 1 },
      { x: 930, character: (this.chosen + 3) % 8, hp: 100, angle: 45, power: 70, weapon: 0, side: -1 },
    ];
    this.drawBackdrop();
    this.terrainGraphics = this.add.graphics();
    this.tankGraphics = this.add.graphics();
    this.tanks.forEach(tank => { tank.image = this.add.image(tank.x, surface(this.terrain, tank.x) - 55, KEYS[tank.character]).setDisplaySize(37, 47).setDepth(5); });
    this.projectile = this.add.circle(0, 0, 8, 0xffdb8b).setVisible(false).setDepth(10);
    this.drawTerrain(); this.drawTanks(); this.drawHud(); this.bindKeys();
    this.notice('輪到你。調整角度和火力，按空白鍵開火。');
  }
  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x142849, 0x142849, 0x376386, 0x376386).fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < 60; i++) this.add.circle((i * 137 + 31) % WIDTH, 120 + (i * 211) % 340, 1 + i % 3, 0xd9eeff, .15 + i % 3 * .07);
    g.fillStyle(0x183956, .6).fillTriangle(0, 565, 220, 370, 420, 565).fillTriangle(350, 580, 700, 330, 960, 580).fillTriangle(790, 580, 1000, 395, 1100, 580);
    this.add.rectangle(550, 51, 1100, 102, 0x122741, .95);
    text(this, 550, 25, '瘋狂坦克 · 2026', 30, '#ffe08d').setOrigin(.5, 0);
  }
  drawTerrain() {
    const g = this.terrainGraphics; g.clear();
    g.fillStyle(0x254d4d).beginPath().moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 3) g.lineTo(x, surface(this.terrain, x));
    g.lineTo(WIDTH, HEIGHT).closePath().fillPath();
    g.lineStyle(5, 0x82c887).beginPath().moveTo(0, surface(this.terrain, 0));
    for (let x = 3; x <= WIDTH; x += 3) g.lineTo(x, surface(this.terrain, x));
    g.strokePath();
  }
  drawTanks() {
    const g = this.tankGraphics; g.clear();
    this.tanks.forEach((tank, i) => {
      if (tank.hp <= 0) { tank.image.setVisible(false); return; }
      const y = surface(this.terrain, tank.x);
      g.fillStyle(i ? 0xf16f81 : 0x68d4e2).fillRoundedRect(tank.x - 25, y - 26, 50, 22, 6);
      g.fillStyle(0x182d46).fillRoundedRect(tank.x - 29, y - 9, 58, 13, 5);
      const r = tank.angle * Math.PI / 180;
      g.lineStyle(8, i ? 0xffa0a2 : 0xb4f2f2).lineBetween(tank.x, y - 28, tank.x + tank.side * Math.cos(r) * 35, y - 28 - Math.sin(r) * 35);
      tank.image.setPosition(tank.x, y - 55);
    });
  }
  drawHud() {
    this.leftHp = text(this, 50, 112, '', 23, '#8de8ec');
    this.rightHp = text(this, 1050, 112, '', 23, '#ffadb7').setOrigin(1, 0);
    this.windText = text(this, 550, 112, '', 19, '#e6eefe').setOrigin(.5, 0);
    this.aimText = text(this, 550, 147, '', 21, '#ffe9ab').setOrigin(.5, 0);
    this.statusText = text(this, 550, 186, '', 20, '#ffffff').setOrigin(.5, 0);
    this.add.rectangle(550, 706, 1100, 108, 0x10233a, .94);
    button(this, 75, 688, 100, '角度 −', () => this.adjust('angle', -2));
    button(this, 185, 688, 100, '角度 ＋', () => this.adjust('angle', 2));
    button(this, 305, 688, 100, '火力 −', () => this.adjust('power', -2));
    button(this, 415, 688, 100, '火力 ＋', () => this.adjust('power', 2));
    this.weaponButtons = WEAPONS.map((weapon, i) => button(this, 560 + i * 130, 688, 119, `${i + 1} ${weapon.name}`, () => this.selectWeapon(i), 0x536b93));
    this.fireButton = button(this, 987, 688, 190, '開火  ▶', () => this.fire(), 0xa67945);
    text(this, 550, 738, 'A / D 角度・W / S 火力・1 / 2 / 3 換武器・Space 開火', 15, '#a9cee0').setOrigin(.5);
    this.refreshHud();
  }
  bindKeys() {
    this.input.keyboard.on('keydown-A', () => this.adjust('angle', -2));
    this.input.keyboard.on('keydown-D', () => this.adjust('angle', 2));
    this.input.keyboard.on('keydown-W', () => this.adjust('power', 2));
    this.input.keyboard.on('keydown-S', () => this.adjust('power', -2));
    this.input.keyboard.on('keydown-ONE', () => this.selectWeapon(0));
    this.input.keyboard.on('keydown-TWO', () => this.selectWeapon(1));
    this.input.keyboard.on('keydown-THREE', () => this.selectWeapon(2));
    this.input.keyboard.on('keydown-SPACE', () => this.fire());
  }
  notice(value) { this.statusText.setText(value); }
  refreshHud() {
    const [human, ai] = this.tanks;
    this.leftHp.setText(`你 ${NAMES[human.character]}  生命 ${Math.max(0, human.hp)}`);
    this.rightHp.setText(`電腦 ${NAMES[ai.character]}  生命 ${Math.max(0, ai.hp)}`);
    this.windText.setText(`風向 ${this.wind > 0 ? '→' : this.wind < 0 ? '←' : '無風'} 風力 ${Math.abs(this.wind)}`);
    this.aimText.setText(`角度 ${human.angle}°　火力 ${human.power}%　武器 ${WEAPONS[human.weapon].name}`);
    this.fireButton.setVisible(this.turn === 0 && !this.flying && !this.finished);
  }
  adjust(field, delta) {
    if (this.turn !== 0 || this.flying || this.finished) return;
    const tank = this.tanks[0];
    tank[field] = Phaser.Math.Clamp(tank[field] + delta, field === 'angle' ? 15 : 30, field === 'angle' ? 80 : 100);
    this.drawTanks(); this.refreshHud();
  }
  selectWeapon(index) {
    if (this.turn !== 0 || this.flying || this.finished) return;
    this.tanks[0].weapon = index; this.refreshHud();
  }
  fire() {
    if (this.flying || this.finished || this.turn !== 0) return;
    this.shoot(0);
  }
  shoot(index) {
    const tank = this.tanks[index], enemy = this.tanks[1 - index];
    this.flying = true; this.refreshHud();
    this.notice(`${index ? '電腦' : '你'}發射 ${WEAPONS[tank.weapon].name}！`);
    const result = traceShot({ x: tank.x, angle: tank.angle, power: tank.power, side: tank.side, wind: this.wind, terrain: this.terrain, targetX: enemy.x });
    const points = result.points;
    let i = 0;
    this.projectile.setFillStyle(WEAPONS[tank.weapon].color).setVisible(true);
    const event = this.time.addEvent({ delay: 20, loop: true, callback: () => {
      const point = points[i++];
      if (point) this.projectile.setPosition(point.x, point.y);
      if (i >= points.length) { event.remove(false); this.projectile.setVisible(false); this.explode(result, index); }
    }});
  }
  explode(impact, index) {
    const weapon = WEAPONS[this.tanks[index].weapon];
    const burst = this.add.circle(impact.x, impact.y, weapon.radius, weapon.color, .75).setDepth(9);
    this.tweens.add({ targets: burst, scale: 1.35, alpha: 0, duration: 410, onComplete: () => burst.destroy() });
    let note = '';
    this.tanks.forEach((tank, i) => {
      if (tank.hp <= 0) return;
      const damage = damageAt(impact, tank.x, surface(this.terrain, tank.x) - 17, weapon);
      if (damage) { tank.hp = Math.max(0, tank.hp - damage); note += `${i ? '電腦' : '你'}受傷 ${damage}！ `; }
    });
    if (impact.x >= 0 && impact.x <= WIDTH && impact.y >= surface(this.terrain, impact.x) - 30) {
      carveCrater(this.terrain, impact.x, weapon.radius);
      this.drawTerrain();
    }
    this.drawTanks(); this.notice(note || '砲彈落空。');
    this.shots++;
    if (this.tanks.some(tank => tank.hp <= 0) || this.shots >= 30) return this.endGame();
    this.turn = 1 - index; this.flying = false;
    this.wind = Phaser.Math.Between(-4, 4);
    this.refreshHud();
    if (this.turn === 1) this.time.delayedCall(850, () => this.aiTurn());
    else this.time.delayedCall(700, () => this.notice('輪到你。調整角度和火力，再次開火。'));
  }
  aiTurn() {
    if (this.finished || this.turn !== 1) return;
    const ai = this.tanks[1];
    const chosen = chooseAiShot(this.terrain, ai.x, this.tanks[0].x, this.wind);
    ai.angle = chosen.angle; ai.power = chosen.power;
    ai.weapon = Phaser.Math.Between(0, 2);
    this.drawTanks(); this.shoot(1);
  }
  endGame() {
    this.finished = true; this.flying = false; this.refreshHud();
    const [human, ai] = this.tanks;
    const outcome = human.hp === ai.hp ? '平手！' : human.hp > ai.hp ? '你贏了！' : '電腦獲勝';
    this.add.rectangle(550, 380, 1100, 760, 0x08152a, .82).setDepth(20);
    text(this, 550, 305, outcome, 58, '#ffe493').setOrigin(.5).setDepth(21);
    text(this, 550, 380, `你 ${human.hp} HP　電腦 ${ai.hp} HP`, 26).setOrigin(.5).setDepth(21);
    const bg = this.add.rectangle(550, 472, 250, 60, 0x377d9d).setStrokeStyle(3, 0x8edff0).setDepth(21).setInteractive({ useHandCursor: true });
    text(this, 550, 472, '重新選角', 25).setOrigin(.5).setDepth(22);
    bg.on('pointerdown', () => this.scene.start('Title'));
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: WIDTH, height: HEIGHT, backgroundColor: '#102342', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [Title, Battle] });
