import Phaser from 'phaser';
import { BOARD, NAMES, KEYS, PLAYER_COLORS, MAX_ROUNDS, createPlayers, worth, pay, buy, advance } from './rules.js';

const W = 1100, H = 760, CELL = 74, X = 54, Y = 80;
const STYLE = { fontFamily: 'Arial, "PingFang TC", sans-serif', color: '#ffffff' };
const txt = (scene, x, y, value, size = 20, color = '#ffffff') => scene.add.text(x, y, value, { ...STYLE, fontSize: `${size}px`, color, wordWrap: { width: 340 } });

function button(scene, x, y, width, label, callback, color = 0x3288aa) {
  const bg = scene.add.rectangle(x, y, width, 48, color).setStrokeStyle(2, 0xa9efff).setInteractive({ useHandCursor: true });
  const text = txt(scene, x, y, label, 20).setOrigin(.5);
  bg.on('pointerdown', callback);
  return { setVisible(visible) { bg.setVisible(visible); text.setVisible(visible); if (visible) bg.setInteractive(); else bg.disableInteractive(); } };
}

class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }
  preload() { KEYS.forEach(key => this.load.image(key, `/assets/characters/${key}.png`)); }
  create() {
    this.cameras.main.setBackgroundColor('#132342');
    txt(this, W / 2, 48, '萌友大富翁', 54, '#ffe293').setOrigin(.5);
    txt(this, W / 2, 105, '選擇角色，和三名電腦對手一起買地收租', 22, '#bbdfea').setOrigin(.5);
    NAMES.forEach((name, i) => {
      const x = 160 + (i % 4) * 260, y = 230 + Math.floor(i / 4) * 215;
      this.add.rectangle(x, y, 218, 184, 0x244969).setStrokeStyle(3, 0x70b8d0);
      this.add.image(x, y - 20, KEYS[i]).setDisplaySize(103, 130);
      txt(this, x, y + 68, name, 22).setOrigin(.5);
      this.add.zone(x, y, 218, 184).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Board', { chosen: i }));
    });
    txt(this, W / 2, 690, '擲骰前進・購買土地・收取租金・18 回合後比總資產', 20, '#d3e9f6').setOrigin(.5);
  }
}

class BoardScene extends Phaser.Scene {
  constructor() { super('Board'); }
  init(data) { this.chosen = data.chosen ?? 0; }
  create() {
    this.cameras.main.setBackgroundColor('#11233d');
    this.board = BOARD.map(tile => ({ ...tile }));
    this.players = createPlayers(this.chosen);
    this.current = 0; this.round = 1; this.busy = false; this.finished = false;
    this.cells = []; this.tokens = [];
    this.drawBoard(); this.drawPanel(); this.updateTokens(); this.refresh();
    this.message('輪到你了！按「擲骰子」開始。');
  }
  cellPosition(i) {
    let gx, gy;
    if (i < 8) { gx = i; gy = 0; }
    else if (i < 14) { gx = 7; gy = i - 7; }
    else if (i < 21) { gx = 20 - i; gy = 7; }
    else { gx = 0; gy = 28 - i; }
    return { x: X + gx * CELL + CELL / 2, y: Y + gy * CELL + CELL / 2 };
  }
  drawBoard() {
    this.add.rectangle(X + 4 * CELL, Y + 4 * CELL, 8 * CELL + 12, 8 * CELL + 12, 0x2b6071).setStrokeStyle(3, 0x9ad9da);
    this.add.rectangle(X + 4 * CELL, Y + 4 * CELL, 6 * CELL, 6 * CELL, 0x173756);
    txt(this, X + 4 * CELL, Y + 3.35 * CELL, '萌友大富翁', 39, '#ffe28d').setOrigin(.5);
    txt(this, X + 4 * CELL, Y + 4.05 * CELL, '繞行棋盤・買地收租', 21, '#c1e9f6').setOrigin(.5);
    this.centerLog = txt(this, X + 4 * CELL, Y + 4.7 * CELL, '', 17, '#ffe5ae').setOrigin(.5).setWordWrapWidth(360);
    this.board.forEach((tile, i) => {
      const p = this.cellPosition(i);
      const group = Math.floor(i / 7);
      const fill = tile.kind === 'property' ? [0x205b77, 0x426185, 0x5a4d7c, 0x376b67][group] : 0x976c43;
      const bg = this.add.rectangle(p.x, p.y, CELL - 3, CELL - 3, fill).setStrokeStyle(1, 0x99cbd5);
      this.add.text(p.x, p.y - 14, tile.name, { ...STYLE, fontSize: '12px', align: 'center', wordWrap: { width: 69 } }).setOrigin(.5);
      if (tile.kind === 'property') txt(this, p.x, p.y + 16, `$${tile.price}`, 13, '#ffe5a8').setOrigin(.5);
      this.cells.push(bg);
    });
    for (const p of this.players) {
      const halo = this.add.circle(0, 0, 20, PLAYER_COLORS[p.id], .87).setStrokeStyle(2, 0xffffff).setDepth(5);
      const image = this.add.image(0, 0, KEYS[p.character]).setDisplaySize(25, 31).setDepth(6);
      this.tokens.push({ halo, image });
    }
  }
  drawPanel() {
    this.add.rectangle(848, 376, 380, 682, 0x203f5c).setStrokeStyle(3, 0x65b6d0);
    txt(this, 683, 53, '對戰資訊', 29, '#ffdb84');
    this.roundText = txt(this, 683, 95, '', 20, '#bce6f6');
    this.playerTexts = this.players.map((_, i) => txt(this, 685, 139 + i * 62, '', 20));
    this.diceText = txt(this, 683, 412, '骰子：—', 23, '#ffe293');
    this.infoText = txt(this, 683, 455, '', 18, '#d9eff8').setWordWrapWidth(330);
    this.rollButton = button(this, 785, 653, 180, '擲骰子', () => this.roll());
    this.endButton = button(this, 976, 653, 150, '結束回合', () => this.nextTurn(), 0x6d70b4);
    this.buyButton = button(this, 785, 594, 180, '購買土地', () => this.purchase(), 0x328a72);
    this.skipButton = button(this, 976, 594, 150, '先不買', () => this.afterAction(), 0xa17450);
  }
  message(value) { this.infoText.setText(value); this.centerLog.setText(value); }
  updateTokens() {
    this.players.forEach((player, i) => {
      const { x, y } = this.cellPosition(player.pos);
      const dx = [-16, 16, -16, 16][i], dy = [-4, -4, 19, 19][i];
      this.tokens[i].halo.setPosition(x + dx, y + dy).setVisible(player.alive);
      this.tokens[i].image.setPosition(x + dx, y + dy).setVisible(player.alive);
    });
  }
  refresh() {
    this.roundText.setText(`第 ${this.round} / ${MAX_ROUNDS} 回合`);
    this.players.forEach((p, i) => this.playerTexts[i].setText(`${i === this.current ? '▶ ' : '   '}${i ? '電腦' : '你'} ${p.name}\n   現金 $${p.cash}｜總資產 $${worth(p, this.board)}`).setColor(p.alive ? '#ffffff' : '#8ea6b6'));
    const human = this.current === 0 && !this.finished;
    this.rollButton.setVisible(human && !this.busy && !this.awaitingBuy && !this.turnReady);
    this.endButton.setVisible(human && !!this.turnReady);
    this.buyButton.setVisible(human && !!this.awaitingBuy);
    this.skipButton.setVisible(human && !!this.awaitingBuy);
    this.cells.forEach((bg, i) => {
      const owner = this.board[i].owner;
      bg.setStrokeStyle(owner < 0 ? 1 : 4, owner < 0 ? 0x99cbd5 : PLAYER_COLORS[owner]);
    });
  }
  roll() {
    if (this.busy || this.finished || this.awaitingBuy || this.turnReady) return;
    const p = this.players[this.current];
    if (!p.alive) return this.nextTurn();
    if (p.jailed > 0) { p.jailed--; this.message(`${p.name}在警局休息一回合。`); return this.afterAction(); }
    const a = Phaser.Math.Between(1, 6), b = Phaser.Math.Between(1, 6);
    this.diceText.setText(`骰子：${a} + ${b} = ${a + b}`);
    this.busy = true; this.refresh();
    const old = p.pos;
    let moved = 0;
    this.time.addEvent({ delay: 110, repeat: a + b - 1, callback: () => {
      p.pos = (old + ++moved) % this.board.length;
      if (p.pos === 0) p.cash += 200;
      this.updateTokens();
      if (moved === a + b) { this.busy = false; this.land(p); }
    }});
  }
  land(p) {
    const tile = this.board[p.pos];
    let note = `${p.name}來到 ${tile.name}。`;
    if (tile.kind === 'property') {
      if (tile.owner === -1) {
        if (p.cash >= tile.price && p.id === 0) { this.awaitingBuy = true; this.message(`${note} 售價 $${tile.price}，租金 $${tile.rent}。要買嗎？`); this.refresh(); return; }
        if (p.cash >= tile.price + 140 && p.id !== 0) { buy(p, tile); note += ` 買下土地，花費 $${tile.price}。`; }
        else note += ' 暫時不買。';
      } else if (tile.owner !== p.id && this.players[tile.owner].alive) {
        const owner = this.players[tile.owner];
        owner.cash += tile.rent;
        const sold = pay(p, tile.rent, this.board);
        note += ` 向${owner.name}付租金 $${tile.rent}。${sold.length ? `出售 ${sold.join('、')}。` : ''}`;
      } else note += ' 自己的土地，安全通行。';
    } else if (tile.kind === 'chance') {
      const events = [['抽到獎金 $160！', 160], ['繳交修繕費 $120。', -120], ['贏得比賽 $220！', 220], ['購物花費 $80。', -80]];
      const [label, amount] = Phaser.Utils.Array.GetRandom(events);
      if (amount > 0) p.cash += amount; else pay(p, -amount, this.board);
      note += ` ${label}`;
    } else if (tile.kind === 'tax') { pay(p, 140, this.board); note += ' 繳稅 $140。'; }
    else if (tile.kind === 'jail') { p.jailed = 1; note += ' 下一回合休息。'; }
    else if (tile.kind === 'bonus') { p.cash += 180; note += ' 領取獎金 $180！'; }
    if (!p.alive) note += ' 已破產！';
    this.message(note); this.afterAction();
  }
  purchase() {
    if (!this.awaitingBuy) return;
    const p = this.players[0], tile = this.board[p.pos];
    if (buy(p, tile)) this.message(`${p.name}買下 ${tile.name}，花費 $${tile.price}！`);
    this.afterAction();
  }
  afterAction() {
    this.awaitingBuy = false;
    this.turnReady = true;
    this.refresh();
    if (this.players.filter(p => p.alive).length <= 1) return this.endGame();
    if (this.current !== 0) this.time.delayedCall(800, () => this.nextTurn());
  }
  nextTurn() {
    if (this.finished || !this.turnReady) return;
    this.turnReady = false;
    let next = this.current;
    do {
      next = (next + 1) % this.players.length;
      if (next === 0) this.round++;
    } while (!this.players[next].alive && this.players.some(p => p.alive));
    if (this.round > MAX_ROUNDS) return this.endGame();
    this.current = next;
    this.message(`輪到${next === 0 ? '你' : this.players[next].name}了。`);
    this.refresh();
    if (next !== 0) this.time.delayedCall(650, () => this.roll());
  }
  endGame() {
    if (this.finished) return;
    this.finished = true; this.refresh();
    const ranked = this.players.filter(p => p.alive).sort((a, b) => worth(b, this.board) - worth(a, this.board));
    const winner = ranked[0];
    this.add.rectangle(550, 380, 1100, 760, 0x08172e, .88).setDepth(20);
    txt(this, 550, 290, winner?.id === 0 ? '你贏了！' : `${winner?.name ?? '無人'}獲勝`, 54, '#ffe089').setOrigin(.5).setDepth(21);
    txt(this, 550, 355, `最終資產 $${winner ? worth(winner, this.board) : 0}`, 27).setOrigin(.5).setDepth(21);
    const retry = button(this, 550, 460, 230, '重新選角', () => this.scene.start('Select'), 0x347c99);
    // button creates its own display objects, so lift them above the result overlay.
    this.children.list.slice(-2).forEach(child => child.setDepth(22));
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#11233d', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [SelectScene, BoardScene] });
