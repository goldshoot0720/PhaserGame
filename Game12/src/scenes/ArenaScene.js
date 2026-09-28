import Phaser from 'phaser';
import { CHARACTERS } from './characters.js';

const COLS = 15;
const ROWS = 11;
const CELL = 50;
const LEFT = 55;
const TOP = 125;
const SPAWNS = [[1, 1], [13, 1], [1, 9], [13, 9]];
const COLORS = [0xffd36b, 0xff819d, 0x73d9ef, 0xb5a0ff];
const keyOf = (x, y) => `${x},${y}`;
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

export class ArenaScene extends Phaser.Scene {
  constructor() { super('Arena'); }

  init(data) { this.characterIndex = data.character ?? 0; }

  create() {
    this.ended = false;
    this.startedAt = this.time.now;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.bombs = new Map();
    this.powerups = new Map();
    this.players = [];
    this.drawBackdrop();
    this.buildGrid();
    this.tiles = this.add.graphics();
    this.drawGrid();
    this.createPlayers();
    this.createHud();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown-SPACE', () => this.placeBomb(this.players[0]));
    this.createTouchControls();
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.updateAi() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateHud() });
  }

  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x10213e, 0x10213e, 0x0b1730, 0x0b1730);
    g.fillRect(0, 0, 1100, 760);
    g.fillStyle(0x193e5c, 1).fillRoundedRect(35, 105, 790, 590, 22);
    g.lineStyle(3, 0x71c3e3, 0.7).strokeRoundedRect(35, 105, 790, 590, 22);
    g.fillStyle(0x1c3553, 1).fillRoundedRect(845, 105, 225, 590, 22);
    g.lineStyle(2, 0x50799c, 1).strokeRoundedRect(845, 105, 225, 590, 22);
    this.add.text(55, 34, '水球大作戰', { fontFamily: 'Arial, sans-serif', fontSize: '42px', fontStyle: 'bold', color: '#fff1bf' });
    this.add.text(1060, 49, '爆爆王風格 · 四人對戰', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#a8cce9' }).setOrigin(1, 0.5);
  }

  buildGrid() {
    const safe = new Set();
    for (const [sx, sy] of SPAWNS) {
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => safe.add(keyOf(sx + dx, sy + dy)));
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) this.grid[y][x] = 1;
        else if (!safe.has(keyOf(x, y)) && Math.random() < 0.46) this.grid[y][x] = 2;
      }
    }
  }

  drawGrid() {
    const g = this.tiles;
    g.clear();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = LEFT + x * CELL;
        const py = TOP + y * CELL;
        g.fillStyle((x + y) % 2 ? 0x3a7180 : 0x397c87, 1).fillRect(px, py, CELL, CELL);
        g.lineStyle(1, 0x94d8c3, 0.16).strokeRect(px, py, CELL, CELL);
        if (this.grid[y][x] === 1) {
          g.fillStyle(0x234d77, 1).fillRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 6);
          g.fillStyle(0x356f9d, 1).fillRoundedRect(px + 5, py + 5, CELL - 11, 11, 3);
          g.lineStyle(2, 0x89d2eb, 0.75).strokeRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 6);
        } else if (this.grid[y][x] === 2) {
          g.fillStyle(0xa96a46, 1).fillRoundedRect(px + 4, py + 5, CELL - 8, CELL - 9, 5);
          g.fillStyle(0xd39a5c, 1).fillRect(px + 7, py + 8, CELL - 14, 9);
          g.lineStyle(3, 0x6e493c, 1).strokeRect(px + 8, py + 10, CELL - 16, CELL - 18);
          g.lineStyle(2, 0xf0c287, 0.8).lineBetween(px + 12, py + 14, px + CELL - 12, py + CELL - 14);
        }
      }
    }
  }

  createPlayers() {
    const opponents = Phaser.Utils.Array.Shuffle(CHARACTERS.map((_, i) => i).filter((i) => i !== this.characterIndex)).slice(0, 3);
    const chosen = [this.characterIndex, ...opponents];
    SPAWNS.forEach(([x, y], id) => {
      const char = CHARACTERS[chosen[id]];
      const shadow = this.add.ellipse(this.cx(x), this.cy(y) + 17, 37, 13, 0x102535, 0.5).setDepth(5);
      const sprite = this.add.image(this.cx(x), this.cy(y) + 12, char.key).setDisplaySize(42, 55).setOrigin(0.5, 1).setDepth(7);
      const badge = this.add.circle(this.cx(x), this.cy(y) - 20, 9, COLORS[id]).setStrokeStyle(2, 0xffffff).setDepth(8);
      this.players.push({ id, name: char.name, x, y, shadow, sprite, badge, alive: true, limit: 1, range: 2, active: 0, moveAt: 0, speed: id === 0 ? 125 : 270, aiAt: 0 });
    });
  }

  createHud() {
    const x = 862;
    this.add.text(x, 126, '對戰資訊', { fontFamily: 'Arial, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffe399' });
    this.timerText = this.add.text(x, 169, '時間 00:00', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#cee8fa' });
    this.playerTexts = this.players.map((p, i) => {
      this.add.circle(x + 10, 223 + i * 56, 8, COLORS[i]);
      return this.add.text(x + 28, 211 + i * 56, '', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff' });
    });
    this.add.text(x, 458, '道具', { fontFamily: 'Arial, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#ffe399' });
    this.powerText = this.add.text(x, 495, '', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d8f0ff', lineSpacing: 11 });
    this.add.text(55, 706, '移動：方向鍵 / WASD　　放水球：空白鍵　　炸開木箱可獲得道具', { fontFamily: 'Arial, sans-serif', fontSize: '19px', color: '#cde8f2' });
    this.updateHud();
  }

  createTouchControls() {
    const controls = [
      { label: '▲', x: 917, y: 590, dx: 0, dy: -1 },
      { label: '◀', x: 879, y: 627, dx: -1, dy: 0 },
      { label: '▼', x: 917, y: 627, dx: 0, dy: 1 },
      { label: '▶', x: 955, y: 627, dx: 1, dy: 0 },
    ];
    controls.forEach(({ label, x, y, dx, dy }) => {
      const button = this.add.circle(x, y, 19, 0x345a79).setStrokeStyle(2, 0x84cce4).setInteractive({ useHandCursor: true });
      this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#ffffff' }).setOrigin(0.5);
      button.on('pointerdown', () => this.move(this.players[0], dx, dy));
    });
    const bombButton = this.add.circle(1020, 620, 31, 0xf1b95e).setStrokeStyle(3, 0xffedb3).setInteractive({ useHandCursor: true });
    this.add.text(1020, 620, '水球', { fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#223149' }).setOrigin(0.5);
    bombButton.on('pointerdown', () => this.placeBomb(this.players[0]));
  }

  cx(x) { return LEFT + x * CELL + CELL / 2; }
  cy(y) { return TOP + y * CELL + CELL / 2; }
  inside(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  passable(x, y) { return this.inside(x, y) && this.grid[y][x] === 0 && !this.bombs.has(keyOf(x, y)); }

  move(player, dx, dy) {
    if (this.ended || !player.alive || this.time.now < player.moveAt) return false;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!this.passable(nx, ny)) return false;
    player.x = nx; player.y = ny;
    player.moveAt = this.time.now + player.speed;
    player.sprite.setFlipX(dx < 0);
    this.tweens.add({ targets: player.sprite, x: this.cx(nx), y: this.cy(ny) + 12, duration: player.speed * 0.72, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: player.badge, x: this.cx(nx), y: this.cy(ny) - 20, duration: player.speed * 0.72, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: player.shadow, x: this.cx(nx), y: this.cy(ny) + 17, duration: player.speed * 0.72, ease: 'Sine.easeOut' });
    this.pickup(player);
    return true;
  }

  placeBomb(player) {
    if (this.ended || !player?.alive || player.active >= player.limit) return false;
    const key = keyOf(player.x, player.y);
    if (this.bombs.has(key)) return false;
    const x = player.x; const y = player.y;
    const body = this.add.circle(this.cx(x), this.cy(y), 19, 0x7cddf2, 0.9).setStrokeStyle(3, 0xffffff).setDepth(6);
    const shine = this.add.circle(this.cx(x) - 6, this.cy(y) - 7, 5, 0xffffff, 0.8).setDepth(7);
    this.tweens.add({ targets: body, scale: 1.18, duration: 260, yoyo: true, repeat: 5 });
    const bomb = { x, y, owner: player, range: player.range, body, shine, detonated: false };
    bomb.timer = this.time.delayedCall(1900, () => this.detonate(bomb));
    this.bombs.set(key, bomb);
    player.active++;
    this.updateHud();
    return true;
  }

  blastCells(bomb) {
    const cells = [[bomb.x, bomb.y]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let n = 1; n <= bomb.range; n++) {
        const x = bomb.x + dx * n;
        const y = bomb.y + dy * n;
        if (!this.inside(x, y) || this.grid[y][x] === 1) break;
        cells.push([x, y]);
        if (this.grid[y][x] === 2) break;
      }
    }
    return cells;
  }

  detonate(bomb) {
    if (bomb.detonated || this.ended) return;
    bomb.detonated = true;
    bomb.timer.remove(false);
    this.bombs.delete(keyOf(bomb.x, bomb.y));
    bomb.owner.active = Math.max(0, bomb.owner.active - 1);
    bomb.body.destroy(); bomb.shine.destroy();
    const cells = this.blastCells(bomb);
    const chained = [];
    for (const [x, y] of cells) {
      const key = keyOf(x, y);
      const other = this.bombs.get(key);
      if (other && other !== bomb) chained.push(other);
      if (this.grid[y][x] === 2) {
        this.grid[y][x] = 0;
        if (Math.random() < 0.34) this.createPowerup(x, y);
      }
      const splash = this.add.circle(this.cx(x), this.cy(y), 23, 0x9beaff, 0.82).setStrokeStyle(3, 0xffffff, 0.75).setDepth(9);
      this.tweens.add({ targets: splash, scale: 1.35, alpha: 0, duration: 380, onComplete: () => splash.destroy() });
      for (const p of this.players) if (p.alive && p.x === x && p.y === y) this.eliminate(p);
    }
    this.drawGrid();
    chained.forEach((other) => this.detonate(other));
    this.updateHud();
    this.checkEnd();
  }

  createPowerup(x, y) {
    const type = randomItem(['range', 'bomb', 'speed']);
    const color = { range: 0xffc767, bomb: 0xf388a0, speed: 0xa3f19c }[type];
    const icon = this.add.circle(this.cx(x), this.cy(y), 15, color).setStrokeStyle(2, 0xffffff).setDepth(4);
    const label = this.add.text(this.cx(x), this.cy(y), { range: '↗', bomb: '+', speed: '⚡' }[type], { fontFamily: 'Arial, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#23334c' }).setOrigin(0.5).setDepth(5);
    this.powerups.set(keyOf(x, y), { type, icon, label });
  }

  pickup(player) {
    const key = keyOf(player.x, player.y);
    const item = this.powerups.get(key);
    if (!item) return;
    if (item.type === 'range') player.range = Math.min(6, player.range + 1);
    if (item.type === 'bomb') player.limit = Math.min(5, player.limit + 1);
    if (item.type === 'speed') player.speed = Math.max(75, player.speed - 18);
    item.icon.destroy(); item.label.destroy();
    this.powerups.delete(key);
    this.updateHud();
  }

  eliminate(player) {
    if (!player.alive) return;
    player.alive = false;
    this.tweens.add({ targets: [player.sprite, player.badge, player.shadow], alpha: 0, scale: 0.2, duration: 350 });
  }

  isThreatened(x, y) {
    for (const bomb of this.bombs.values()) {
      if (this.blastCells(bomb).some(([bx, by]) => bx === x && by === y)) return true;
    }
    return false;
  }

  updateAi() {
    if (this.ended) return;
    for (const p of this.players.slice(1)) {
      if (!p.alive || this.time.now < p.moveAt) continue;
      const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.passable(p.x + dx, p.y + dy));
      const safe = options.filter(([dx, dy]) => !this.isThreatened(p.x + dx, p.y + dy));
      const adjacentBox = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.inside(p.x + dx, p.y + dy) && this.grid[p.y + dy][p.x + dx] === 2);
      const adjacentEnemy = this.players.some((other) => other !== p && other.alive && Math.abs(other.x - p.x) + Math.abs(other.y - p.y) <= p.range);
      if (!this.isThreatened(p.x, p.y) && safe.length > 0 && p.active === 0 && Math.random() < (adjacentEnemy ? 0.44 : adjacentBox ? 0.27 : 0.08)) this.placeBomb(p);
      const choices = safe.length ? safe : options;
      if (choices.length) {
        const target = this.players.filter((other) => other !== p && other.alive).sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)))[0];
        choices.sort((a, b) => {
          const da = target ? Math.abs(p.x + a[0] - target.x) + Math.abs(p.y + a[1] - target.y) : 0;
          const db = target ? Math.abs(p.x + b[0] - target.x) + Math.abs(p.y + b[1] - target.y) : 0;
          return da - db + (Math.random() - 0.5) * 3;
        });
        this.move(p, ...choices[0]);
      }
    }
  }

  updateHud() {
    if (!this.timerText) return;
    const elapsed = Math.floor((this.time.now - this.startedAt) / 1000);
    this.timerText.setText(`時間 ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`);
    this.players.forEach((p, i) => this.playerTexts[i].setText(`${i === 0 ? '你' : '電腦'} ${p.name} ${p.alive ? '●' : '✕'}`).setColor(p.alive ? '#ffffff' : '#8192a9'));
    const p = this.players[0];
    this.powerText.setText(`水球數  ${p.limit}\n水柱長  ${p.range}\n移動力  ${Math.round(150 / p.speed * 10) / 10}`);
  }

  checkEnd() {
    if (this.ended) return;
    const alive = this.players.filter((p) => p.alive);
    if (alive.length > 1) return;
    this.ended = true;
    const win = alive.length === 1 && alive[0].id === 0;
    const overlay = this.add.rectangle(550, 380, 1100, 760, 0x0c1730, 0.82).setDepth(20);
    const panel = this.add.rectangle(550, 366, 500, 320, 0x224d69).setStrokeStyle(4, 0xfbd575).setDepth(21);
    this.add.text(550, 287, win ? '你贏了！' : alive.length ? '再接再厲！' : '平手！', { fontFamily: 'Arial, sans-serif', fontSize: '53px', fontStyle: 'bold', color: '#fff1bd' }).setOrigin(0.5).setDepth(22);
    this.add.text(550, 355, win ? '恭喜成為水球冠軍！' : '躲開水柱，再挑戰一次。', { fontFamily: 'Arial, sans-serif', fontSize: '23px', color: '#d8ebf8' }).setOrigin(0.5).setDepth(22);
    const button = this.add.rectangle(550, 443, 220, 58, 0xf0b94e).setInteractive({ useHandCursor: true }).setDepth(22);
    this.add.text(550, 443, '重新選角', { fontFamily: 'Arial, sans-serif', fontSize: '25px', fontStyle: 'bold', color: '#25334a' }).setOrigin(0.5).setDepth(23);
    button.on('pointerdown', () => this.scene.start('Title'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Title'));
  }

  update() {
    if (this.ended) return;
    const k = this.keys;
    if (k.LEFT.isDown || k.A.isDown) this.move(this.players[0], -1, 0);
    else if (k.RIGHT.isDown || k.D.isDown) this.move(this.players[0], 1, 0);
    else if (k.UP.isDown || k.W.isDown) this.move(this.players[0], 0, -1);
    else if (k.DOWN.isDown || k.S.isDown) this.move(this.players[0], 0, 1);
  }
}
