// 萌友戰棋・八方對決 — 棋盤式回合制戰略遊戲 (Phaser 3)

const W = 1280, H = 720;
const TILE = 64, COLS = 12, ROWS = 9, BX = 24, BY = 110;
const PX = 820, PW = 436;
const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// crop: [中心x比例, 中心y比例, 邊長(佔圖寬比例)] — 用於從立繪裁出頭像
const CHARS = [
  { key: 'c1', name: '小鯨', title: '鯨之女僕', role: '治療師', hp: 22, atk: 5, def: 3, mov: 4, rmin: 1, rmax: 2, swim: true, heal: 8, color: 0x5ab0ff, crop: [0.5, 0.21, 0.42], desc: '可為友軍恢復 8 HP，並能在水面上行走。' },
  { key: 'c2', name: '小企', title: '企鵝衛士', role: '重裝', hp: 32, atk: 7, def: 7, mov: 3, rmin: 1, rmax: 1, color: 0xf2c14e, crop: [0.5, 0.19, 0.40], desc: '血量與防禦極高的前線坦克。' },
  { key: 'c3', name: '阿哲', title: '眼鏡軍師', role: '弓手', hp: 20, atk: 8, def: 3, mov: 4, rmin: 2, rmax: 3, color: 0xd2b48c, crop: [0.49, 0.145, 0.26], desc: '射程 2-3 的遠程攻擊，無法反擊貼身敵人。' },
  { key: 'c4', name: '小翔', title: '熱血少年', role: '格鬥家', hp: 27, atk: 9, def: 4, mov: 5, rmin: 1, rmax: 1, color: 0x9aa0a6, crop: [0.5, 0.135, 0.26], desc: '攻守均衡、耐打的近戰突擊手。' },
  { key: 'c5', name: '三花', title: '街頭貓俠', role: '盜賊', hp: 21, atk: 8, def: 3, mov: 6, rmin: 1, rmax: 1, crit: 0.3, color: 0xf08a3c, crop: [0.5, 0.2, 0.34], desc: '移動力 6，攻擊有 30% 機率造成雙倍爆擊。' },
  { key: 'c6', name: '雪球', title: '書庫魔導', role: '魔法師', hp: 18, atk: 10, def: 2, mov: 4, rmin: 1, rmax: 2, magic: true, color: 0xb57bff, crop: [0.515, 0.2, 0.32], desc: '魔法攻擊無視目標一半的防禦。' },
  { key: 'c7', name: '緋音', title: '紅焰劍士', role: '劍士', hp: 24, atk: 10, def: 4, mov: 5, rmin: 1, rmax: 1, color: 0xe0443e, crop: [0.5, 0.15, 0.34], desc: '攻擊力出眾的近戰劍士。' },
  { key: 'c8', name: '澪', title: '水手長槍', role: '槍兵', hp: 25, atk: 8, def: 5, mov: 4, rmin: 1, rmax: 2, color: 0x3a5ba0, crop: [0.5, 0.15, 0.28], desc: '射程 1-2 的長槍，攻守兼備。' },
];

const TERRAIN = {
  '.': { name: '草地', cost: 1, def: 0 },
  F: { name: '森林', cost: 2, def: 2 },
  W: { name: '水域', cost: 99, def: 0 },
  M: { name: '山岳', cost: 3, def: 3 },
  H: { name: '民房', cost: 1, def: 1, heal: 5 },
};

const MAP = [
  '..F....M..F.',
  '.FF..W....F.',
  '....WW..H...',
  'M...W...FF..',
  '..F.......M.',
  '..FF...W....',
  '...H..WW....',
  '.F....W..FF.',
  '.F..M....F..',
];
const P_SPAWN = [[1, 2], [0, 4], [1, 6], [0, 7]];
const E_SPAWN = [[11, 1], [10, 3], [11, 5], [10, 7]];

const charByKey = k => CHARS.find(c => c.key === k);

function makeButton(scene, x, y, w, h, label, cb, color = 0x3b6fd8) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  let enabled = true;
  const draw = hover => {
    g.clear();
    const col = !enabled ? 0x4a4f5a : color;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 10);
    g.fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    if (hover && enabled) g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(2, 0xffffff, enabled ? 0.55 : 0.2).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  };
  draw(false);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: Math.round(h * 0.42) + 'px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); if (enabled) cb(); });
  c.setEnabled = on => { enabled = on; t.setAlpha(on ? 1 : 0.5); draw(false); return c; };
  c.setLabel = s => t.setText(s);
  return c;
}

function drawBackdrop(scene) {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1d2740, 0x1d2740, 0x0e131d, 0x0e131d, 1);
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.03, 0.1));
    g.fillCircle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), Phaser.Math.Between(1, 3));
  }
  return g;
}

// ---------------------------------------------------------------- Boot
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const t = this.add.text(W / 2, H / 2, '載入中… 0%', { fontFamily: FONT, fontSize: '28px', color: '#fff' }).setOrigin(0.5);
    this.load.on('progress', v => t.setText('載入中… ' + Math.round(v * 100) + '%'));
    this.load.on('loaderror', f => t.setText('無法載入 ' + f.src + '\n請用本機伺服器開啟（見 README）').setAlign('center'));
    CHARS.forEach((c, i) => this.load.image(c.key, `assets/char${i + 1}.png`));
  }
  create() {
    CHARS.forEach(c => {
      const src = this.textures.get(c.key).getSourceImage();
      const w = src.width, h = src.height;
      const [fx, fy, fs] = c.crop;
      const s = fs * w;

      // 圓形棋子頭像
      const tok = this.textures.createCanvas('tok_' + c.key, 128, 128);
      let ctx = tok.getContext();
      ctx.save();
      ctx.beginPath(); ctx.arc(64, 64, 63, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#e9eef8'; ctx.fillRect(0, 0, 128, 128);
      ctx.drawImage(src, fx * w - s / 2, fy * h - s / 2, s, s, 0, 0, 128, 128);
      ctx.restore();
      tok.refresh();

      // 角色卡用的半身像
      const s2 = Math.min(s * 1.6, w);
      const sx = Phaser.Math.Clamp(fx * w - s2 / 2, 0, w - s2);
      const sy = Phaser.Math.Clamp(fy * h - s2 * 0.32, 0, h - s2);
      const face = this.textures.createCanvas('face_' + c.key, 200, 200);
      ctx = face.getContext();
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, 200, 200, 18); else ctx.rect(0, 0, 200, 200);
      ctx.clip();
      ctx.fillStyle = '#e9eef8'; ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(src, sx, sy, s2, s2, 0, 0, 200, 200);
      ctx.restore();
      face.refresh();
    });
    this.scene.start('Title');
  }
}

// ---------------------------------------------------------------- Title
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    drawBackdrop(this);
    this.add.text(W / 2, 130, '萌友戰棋・八方對決', { fontFamily: FONT, fontSize: '64px', color: '#ffffff', fontStyle: 'bold', stroke: '#2a4d8f', strokeThickness: 10 }).setOrigin(0.5);
    this.add.text(W / 2, 205, '回合制棋盤戰略遊戲', { fontFamily: FONT, fontSize: '24px', color: '#a9c4ff' }).setOrigin(0.5);

    CHARS.forEach((c, i) => {
      const x = W / 2 + (i - 3.5) * 120, y = 340;
      const ring = this.add.circle(x, y, 50, c.color).setStrokeStyle(4, 0xffffff);
      const img = this.add.image(x, y, 'tok_' + c.key).setDisplaySize(92, 92);
      this.tweens.add({ targets: [ring, img], y: y - 12, duration: 900, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.add.text(x, y + 66, c.name, { fontFamily: FONT, fontSize: '18px', color: '#fff' }).setOrigin(0.5);
    });

    const rules = [
      '• 從 8 位角色中挑選 4 位組成我方隊伍，其餘 4 位由電腦操控',
      '• 點擊我方角色 → 選擇移動格 → 選擇攻擊 / 治療 / 待命',
      '• 森林、山岳、民房提供防禦加成；站在民房上每回合恢復 5 HP',
      '• 攻擊後若在對方射程內會遭到反擊。擊敗所有敵人即獲勝！',
    ];
    this.add.text(W / 2, 500, rules.join('\n'), { fontFamily: FONT, fontSize: '19px', color: '#d8e2f5', lineSpacing: 10 }).setOrigin(0.5);
    makeButton(this, W / 2, 640, 240, 60, '開始遊戲', () => this.scene.start('Select'), 0x3b6fd8);
  }
}

// ---------------------------------------------------------------- Select
class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }
  create() {
    drawBackdrop(this);
    this.picked = [];
    this.add.text(W / 2, 40, '選擇 4 位我方角色', { fontFamily: FONT, fontSize: '34px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.countText = this.add.text(W / 2, 80, '', { fontFamily: FONT, fontSize: '18px', color: '#a9c4ff' }).setOrigin(0.5);

    const cw = 280, ch = 255;
    this.cards = CHARS.map((c, i) => {
      const x = 50 + cw / 2 + (i % 4) * 300, y = 240 + Math.floor(i / 4) * 272;
      const card = this.add.container(x, y);
      const bg = this.add.graphics();
      const face = this.add.image(0, -52, 'face_' + c.key).setDisplaySize(140, 140);
      const name = this.add.text(0, 32, `${c.name}・${c.title}`, { fontFamily: FONT, fontSize: '21px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      const role = this.add.text(0, 60, c.role, { fontFamily: FONT, fontSize: '15px', color: '#' + c.color.toString(16).padStart(6, '0') }).setOrigin(0.5);
      const stats = this.add.text(0, 88, `HP ${c.hp}  攻 ${c.atk}  防 ${c.def}  移 ${c.mov}  射 ${c.rmin}-${c.rmax}`, { fontFamily: FONT, fontSize: '14px', color: '#cfd8ea' }).setOrigin(0.5);
      const tag = this.add.text(cw / 2 - 12, -ch / 2 + 12, '', { fontFamily: FONT, fontSize: '15px', color: '#fff', fontStyle: 'bold', padding: { x: 8, y: 3 } }).setOrigin(1, 0);
      card.add([bg, face, name, role, stats, tag]);
      card.setSize(cw, ch).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.toggle(c.key));
      card.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.03, duration: 120 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 120 }));
      return { c, card, bg, tag, w: cw, h: ch };
    });

    makeButton(this, W / 2 - 150, 680, 200, 48, '隨機選擇', () => {
      this.picked = Phaser.Utils.Array.Shuffle(CHARS.map(c => c.key)).slice(0, 4);
      this.refresh();
    }, 0x5b6b8c);
    this.startBtn = makeButton(this, W / 2 + 150, 680, 200, 48, '開始戰鬥', () => {
      this.scene.start('Battle', { player: this.picked.slice() });
    }, 0x2f9e5b);
    this.refresh();
  }
  toggle(k) {
    const i = this.picked.indexOf(k);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length < 4) this.picked.push(k);
    this.refresh();
  }
  refresh() {
    const full = this.picked.length === 4;
    this.cards.forEach(({ c, bg, tag, w, h }) => {
      const on = this.picked.includes(c.key);
      bg.clear();
      bg.fillStyle(on ? 0x24406e : 0x1f2636, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      bg.lineStyle(on ? 4 : 2, on ? 0x6fb4ff : (full ? 0xff6b6b : 0x3a4458), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
      if (on) tag.setText('我方').setBackgroundColor('#3b6fd8').setVisible(true);
      else if (full) tag.setText('敵方').setBackgroundColor('#c9423d').setVisible(true);
      else tag.setVisible(false);
    });
    this.countText.setText(`已選擇 ${this.picked.length} / 4　（未選的角色將成為敵人）`);
    this.startBtn.setEnabled(full);
  }
}

// ---------------------------------------------------------------- Battle
class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(data) { this.playerKeys = data.player; }

  create() {
    drawBackdrop(this);
    this.map = MAP.map(r => r.split(''));
    this.units = [];
    this.logs = [];
    this.turn = 1;
    this.state = 'idle';
    this.phase = 'P';
    this.busy = true;
    this.sel = null;

    this.add.text(BX, 28, '萌友戰棋・八方對決', { fontFamily: FONT, fontSize: '30px', color: '#fff', fontStyle: 'bold' });
    this.add.text(BX, 70, '目標：擊敗所有敵方角色　｜　左鍵：選擇／移動　右鍵或 Esc：取消　E：結束回合', { fontFamily: FONT, fontSize: '16px', color: '#9fb0c8' });

    this.drawBoard();
    this.hl = this.add.graphics().setDepth(5);
    this.hoverG = this.add.graphics().setDepth(6);

    const enemyKeys = CHARS.map(c => c.key).filter(k => !this.playerKeys.includes(k));
    this.playerKeys.forEach((k, i) => this.spawn(k, 'P', P_SPAWN[i]));
    enemyKeys.forEach((k, i) => this.spawn(k, 'E', E_SPAWN[i]));

    this.buildUI();

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', p => {
      if (p.rightButtonDown()) { this.cancel(); return; }
      const t = this.pointerTile(p);
      if (t) this.onTileClick(t.x, t.y);
    });
    this.input.on('pointermove', p => this.onHover(this.pointerTile(p)));
    this.input.keyboard.on('keydown-ESC', () => this.cancel());
    this.input.keyboard.on('keydown-E', () => { if (!this.busy && this.phase === 'P') this.endPlayerTurn(); });

    this.log('戰鬥開始！');
    this.startPlayerPhase();
  }

  // ---------- helpers
  tileCenter(x, y) { return { px: BX + x * TILE + TILE / 2, py: BY + y * TILE + TILE / 2 }; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  pointerTile(p) {
    const x = Math.floor((p.x - BX) / TILE), y = Math.floor((p.y - BY) / TILE);
    return this.inBounds(x, y) ? { x, y } : null;
  }
  unitAt(x, y) { return this.units.find(u => u.hp > 0 && u.x === x && u.y === y); }
  team(t) { return this.units.filter(u => u.team === t && u.hp > 0); }
  dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  terrainAt(x, y) { return TERRAIN[this.map[y][x]]; }
  terrainDef(x, y) { return this.terrainAt(x, y).def; }
  moveCost(u, x, y) {
    const t = this.map[y][x];
    if (t === 'W') return u.c.swim ? 1 : 99;
    return TERRAIN[t].cost;
  }
  wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }
  tweenP(cfg) { return new Promise(r => this.tweens.add({ ...cfg, onComplete: r })); }

  // ---------- board
  drawBoard() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(BX - 8, BY - 8, COLS * TILE + 16, ROWS * TILE + 16, 12);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.map[y][x];
        const ox = BX + x * TILE, oy = BY + y * TILE, cx = ox + TILE / 2, cy = oy + TILE / 2;
        const v = (x * 7 + y * 13) % 3;
        const grass = [0x7cc46a, 0x76bd63, 0x82c970][v];
        if (t === 'W') {
          g.fillStyle([0x4a9fe0, 0x4598d8, 0x50a6e6][v]).fillRect(ox, oy, TILE, TILE);
          g.lineStyle(2, 0xa8dbff, 0.7);
          for (let k = 0; k < 2; k++) {
            const wy = oy + 20 + k * 22, wx = ox + 10 + ((x + k) % 2) * 14;
            g.beginPath(); g.arc(wx + 6, wy, 6, Math.PI, 0); g.arc(wx + 18, wy, 6, Math.PI, 0, true); g.strokePath();
          }
          continue;
        }
        g.fillStyle(grass).fillRect(ox, oy, TILE, TILE);
        if (t === '.') {
          g.fillStyle(0x5fa64e, 0.6);
          g.fillRect(ox + 12 + v * 9, oy + 16 + v * 5, 3, 7);
          g.fillRect(ox + 40 - v * 6, oy + 42 - v * 4, 3, 7);
        } else if (t === 'F') {
          [[-14, 6], [12, 8], [0, -10]].forEach(([dx, dy]) => {
            g.fillStyle(0x6b4a2b).fillRect(cx + dx - 2, cy + dy + 6, 4, 8);
            g.fillStyle(0x2f7d3a).fillTriangle(cx + dx, cy + dy - 14, cx + dx - 11, cy + dy + 8, cx + dx + 11, cy + dy + 8);
            g.fillStyle(0x3e9a4a).fillTriangle(cx + dx, cy + dy - 14, cx + dx - 5, cy + dy - 2, cx + dx + 5, cy + dy - 2);
          });
        } else if (t === 'M') {
          g.fillStyle(0xa89878).fillRect(ox, oy, TILE, TILE);
          g.fillStyle(0x7d7f86).fillTriangle(cx - 26, cy + 22, cx - 4, cy - 22, cx + 18, cy + 22);
          g.fillStyle(0x92959c).fillTriangle(cx - 6, cy + 22, cx + 12, cy - 10, cx + 28, cy + 22);
          g.fillStyle(0xffffff).fillTriangle(cx - 4, cy - 22, cx - 11, cy - 8, cx + 3, cy - 8);
        } else if (t === 'H') {
          g.fillStyle(0xc49a6c).fillRect(cx - 18, cy - 4, 36, 24);
          g.fillStyle(0xd9534f).fillTriangle(cx - 24, cy - 2, cx, cy - 24, cx + 24, cy - 2);
          g.fillStyle(0x6b4a2b).fillRect(cx - 5, cy + 6, 10, 14);
          g.fillStyle(0xfff3b0).fillRect(cx + 8, cy + 2, 7, 7);
        }
      }
    }
    g.lineStyle(1, 0x000000, 0.14);
    for (let x = 0; x <= COLS; x++) g.lineBetween(BX + x * TILE, BY, BX + x * TILE, BY + ROWS * TILE);
    for (let y = 0; y <= ROWS; y++) g.lineBetween(BX, BY + y * TILE, BX + COLS * TILE, BY + y * TILE);
  }

  spawn(key, team, [x, y]) {
    const c = charByKey(key);
    const u = { c, team, x, y, hp: c.hp, acted: false };
    const { px, py } = this.tileCenter(x, y);
    const cont = this.add.container(px, py).setDepth(10);
    const col = team === 'P' ? 0x4aa3ff : 0xff5a5a;
    const ring = this.add.graphics();
    ring.fillStyle(0x000000, 0.35).fillEllipse(0, 24, 46, 12);
    ring.fillStyle(col, 1).fillCircle(0, -2, 29);
    ring.lineStyle(2, 0xffffff, 0.9).strokeCircle(0, -2, 29);
    const img = this.add.image(0, -2, 'tok_' + key).setDisplaySize(52, 52);
    const hpg = this.add.graphics();
    cont.add([ring, img, hpg]);
    Object.assign(u, { cont, img, hpg });
    u.bob = this.tweens.add({ targets: img, y: -6, duration: 800 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.drawHp(u);
    this.units.push(u);
  }

  drawHp(u) {
    const g = u.hpg, r = u.hp / u.c.hp;
    g.clear();
    g.fillStyle(0x000000, 0.75).fillRect(-25, 24, 50, 7);
    g.fillStyle(r > 0.5 ? 0x5be35b : r > 0.25 ? 0xf2c14e : 0xf25c54, 1).fillRect(-24, 25, 48 * r, 5);
  }

  refreshTint(u) {
    if (u.acted) { u.img.setTint(0x6a6a6a); u.bob.pause(); }
    else { u.img.clearTint(); u.bob.resume(); }
  }

  // ---------- UI
  buildUI() {
    const g = this.add.graphics();
    g.fillStyle(0x10151f, 0.92).fillRoundedRect(PX - 8, 100, PW + 16, 614, 14);
    g.fillStyle(0x222b3d, 1).fillRoundedRect(PX + 4, 146, PW - 8, 290, 12);

    this.turnText = this.add.text(PX + 8, 112, '', { fontFamily: FONT, fontSize: '21px', color: '#fff', fontStyle: 'bold' });
    this.infoImg = this.add.image(PX + 102, 430, 'c1').setOrigin(0.5, 1).setVisible(false);
    this.infoMask = this.make.graphics({ add: false }).fillRect(PX + 8, 150, 188, 282);
    this.infoImg.setMask(this.infoMask.createGeometryMask());
    this.infoName = this.add.text(PX + 206, 160, '', { fontFamily: FONT, fontSize: '26px', color: '#fff', fontStyle: 'bold' });
    this.infoSub = this.add.text(PX + 206, 196, '', { fontFamily: FONT, fontSize: '15px', color: '#aab6cc' });
    this.infoHp = this.add.graphics();
    this.infoStats = this.add.text(PX + 206, 244, '', { fontFamily: FONT, fontSize: '17px', color: '#e6ecf7', lineSpacing: 6 });
    this.infoDesc = this.add.text(PX + 206, 340, '', { fontFamily: FONT, fontSize: '14px', color: '#b9e3c6', wordWrap: { width: 214, useAdvancedWrap: true }, lineSpacing: 4 });
    this.infoEmpty = this.add.text(PX + PW / 2, 290, '將滑鼠移到角色上\n查看詳細資料', { fontFamily: FONT, fontSize: '18px', color: '#6f7d96', align: 'center' }).setOrigin(0.5);

    this.terrainText = this.add.text(PX + 8, 446, '', { fontFamily: FONT, fontSize: '15px', color: '#cfd8ea' });
    this.hintText = this.add.text(PX + 8, 472, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe28a', wordWrap: { width: PW - 16, useAdvancedWrap: true } });
    this.menu = [];
    this.logText = this.add.text(PX + 8, 568, '', { fontFamily: FONT, fontSize: '13px', color: '#9fb0c8', lineSpacing: 3, wordWrap: { width: PW - 16, useAdvancedWrap: true } });
    this.endBtn = makeButton(this, PX + PW / 2, 686, 200, 40, '結束回合 (E)', () => this.endPlayerTurn(), 0xc9423d);
  }

  showInfo(u) {
    if (!u) return;
    this.infoEmpty.setVisible(false);
    const src = this.textures.get(u.c.key).getSourceImage();
    const s = Math.min(186 / src.width, 280 / src.height);
    this.infoImg.setTexture(u.c.key).setScale(s).setVisible(true);
    this.infoName.setText(u.c.name).setColor(u.team === 'P' ? '#7fc0ff' : '#ff8a80');
    this.infoSub.setText(`${u.c.title}・${u.c.role}・${u.team === 'P' ? '我方' : '敵方'}`);
    const r = u.hp / u.c.hp;
    this.infoHp.clear();
    this.infoHp.fillStyle(0x000000, 0.6).fillRoundedRect(PX + 206, 222, 214, 12, 5);
    this.infoHp.fillStyle(r > 0.5 ? 0x5be35b : r > 0.25 ? 0xf2c14e : 0xf25c54, 1).fillRoundedRect(PX + 207, 223, Math.max(4, 212 * r), 10, 5);
    this.infoStats.setText(`HP  ${u.hp} / ${u.c.hp}\n攻擊 ${u.c.atk}　 防禦 ${u.c.def}\n移動 ${u.c.mov}　 射程 ${u.c.rmin}-${u.c.rmax}`);
    this.infoDesc.setText(u.c.desc + (u.acted ? '\n（本回合已行動）' : ''));
  }

  updateTurnText() {
    this.turnText.setText(`第 ${this.turn} 回合　${this.phase === 'P' ? '▶ 我方回合' : '▶ 敵方回合'}`)
      .setColor(this.phase === 'P' ? '#7fc0ff' : '#ff8a80');
    this.endBtn.setEnabled(this.phase === 'P' && !this.busy);
  }

  log(s) {
    this.logs.push(s);
    if (this.logs.length > 6) this.logs.shift();
    this.logText.setText(this.logs.join('\n'));
  }

  hint(s) { this.hintText.setText(s || ''); }

  openMenu() {
    this.closeMenu();
    this.state = 'menu';
    const u = this.sel;
    const atk = this.attackTargets(u);
    const heal = this.healTargets(u);
    const items = [['攻擊', atk.length > 0, () => this.chooseTargets('atk', atk), 0xc9423d]];
    if (u.c.heal) items.push(['治療', heal.length > 0, () => this.chooseTargets('heal', heal), 0x2f9e5b]);
    items.push(['待命', true, () => { this.closeMenu(); this.finishUnit(u); }, 0x5b6b8c]);
    items.push(['取消', true, () => this.undoMove(), 0x3a4458]);
    const bw = 98, gap = 8, start = PX + 8 + bw / 2;
    items.forEach(([label, on, cb, col], i) => {
      this.menu.push(makeButton(this, start + i * (bw + gap), 530, bw, 40, label, cb, col).setEnabled(on).setDepth(40));
    });
    this.drawHighlights([{ x: u.x, y: u.y }], 0xffe066, 0.45);
    this.hint(`${u.c.name}：請選擇行動`);
  }
  closeMenu() { this.menu.forEach(b => b.destroy()); this.menu = []; }

  // ---------- highlights
  drawHighlights(tiles, color, alpha, clear = true) {
    if (clear) this.hl.clear();
    tiles.forEach(({ x, y }) => {
      this.hl.fillStyle(color, alpha).fillRect(BX + x * TILE + 2, BY + y * TILE + 2, TILE - 4, TILE - 4);
      this.hl.lineStyle(2, color, 0.9).strokeRect(BX + x * TILE + 2, BY + y * TILE + 2, TILE - 4, TILE - 4);
    });
  }

  showRange(u, reach) {
    const moves = [...reach.values()].filter(n => !n.blocked);
    const moveSet = new Set(moves.map(n => n.x + ',' + n.y));
    const atk = new Map();
    moves.forEach(n => this.tilesInRange(n.x, n.y, u.c.rmin, u.c.rmax).forEach(t => {
      const k = t.x + ',' + t.y;
      if (!moveSet.has(k)) atk.set(k, t);
    }));
    this.drawHighlights(moves, u.team === 'P' ? 0x3aa0ff : 0xff7a50, 0.35);
    this.drawHighlights([...atk.values()], 0xff3030, 0.18, false);
  }

  tilesInRange(x, y, rmin, rmax) {
    const out = [];
    for (let dy = -rmax; dy <= rmax; dy++) for (let dx = -rmax; dx <= rmax; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d >= rmin && d <= rmax && this.inBounds(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    }
    return out;
  }

  // ---------- movement
  reachable(u) {
    const key = (x, y) => x + ',' + y;
    const nodes = new Map([[key(u.x, u.y), { x: u.x, y: u.y, c: 0, prev: null }]]);
    const q = [{ x: u.x, y: u.y, c: 0 }];
    while (q.length) {
      q.sort((a, b) => a.c - b.c);
      const cur = q.shift();
      if (cur.c > nodes.get(key(cur.x, cur.y)).c) continue;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const o = this.unitAt(nx, ny);
        if (o && o.team !== u.team) continue;
        const nc = cur.c + this.moveCost(u, nx, ny);
        if (nc > u.c.mov) continue;
        const k = key(nx, ny), ex = nodes.get(k);
        if (ex && ex.c <= nc) continue;
        nodes.set(k, { x: nx, y: ny, c: nc, prev: key(cur.x, cur.y) });
        q.push({ x: nx, y: ny, c: nc });
      }
    }
    for (const n of nodes.values()) { const o = this.unitAt(n.x, n.y); n.blocked = !!(o && o !== u); }
    return nodes;
  }

  pathTo(reach, x, y) {
    const path = [];
    let k = x + ',' + y;
    while (k) { const n = reach.get(k); path.unshift(n); k = n.prev; }
    return path.slice(1);
  }

  moveAlong(u, path) {
    if (!path.length) return Promise.resolve();
    const last = path[path.length - 1];
    u.x = last.x; u.y = last.y;
    return new Promise(res => this.tweens.chain({
      targets: u.cont,
      tweens: path.map(n => { const p = this.tileCenter(n.x, n.y); return { x: p.px, y: p.py, duration: 110 }; }),
      onComplete: res,
    }));
  }

  placeAt(u, x, y) {
    u.x = x; u.y = y;
    const p = this.tileCenter(x, y);
    u.cont.setPosition(p.px, p.py);
  }

  // ---------- player input
  onTileClick(x, y) {
    if (this.busy || this.phase !== 'P' || this.state === 'over') return;
    const u = this.unitAt(x, y);
    if (this.state === 'idle') {
      if (!u) { this.hl.clear(); return; }
      this.showInfo(u);
      if (u.team === 'P' && !u.acted) this.selectUnit(u);
      else if (u.team === 'E') { this.showRange(u, this.reachable(u)); this.hint(`${u.c.name} 的移動與攻擊範圍`); }
    } else if (this.state === 'move') {
      const n = this.reach.get(x + ',' + y);
      if (n && !n.blocked) this.doMove(x, y);
      else if (u && u.team === 'P' && !u.acted && u !== this.sel) this.selectUnit(u);
      else this.deselect();
    } else if (this.state === 'menu') {
      this.undoMove();
    } else if (this.state === 'target') {
      const t = this.targets.find(t => t.x === x && t.y === y);
      if (t) this.executeAction(t);
      else this.openMenu();
    }
  }

  onHover(t) {
    this.hoverG.clear();
    if (!t) return;
    this.hoverG.lineStyle(3, 0xffffff, 0.9).strokeRect(BX + t.x * TILE + 1, BY + t.y * TILE + 1, TILE - 2, TILE - 2);
    const ter = this.terrainAt(t.x, t.y);
    this.terrainText.setText(`地形：${ter.name}　防禦 +${ter.def}　移動消耗 ${ter.cost >= 99 ? '無法通行' : ter.cost}${ter.heal ? '　每回合恢復 ' + ter.heal : ''}`);
    const u = this.unitAt(t.x, t.y);
    if (u) this.showInfo(u); else if (this.sel) this.showInfo(this.sel);
    if (this.state === 'target' && this.phase === 'P') {
      const tg = this.targets.find(q => q.x === t.x && q.y === t.y);
      if (tg && this.actionType === 'atk') {
        const a = this.sel, d = tg.unit;
        const dmg = this.calcDamage(a, d).dmg;
        const kill = dmg >= d.hp;
        const counter = !kill && this.inRange(d, a) ? this.calcDamage(d, a).dmg : 0;
        this.hint(`預測：${a.c.name} 對 ${d.c.name} 造成 ${dmg} 傷害${kill ? '（擊倒！）' : ''}${a.c.crit ? '，30% 爆擊' : ''}\n${counter ? `反擊：受到 ${counter} 傷害` : '對方無法反擊'}`);
      } else if (tg) {
        this.hint(`治療 ${tg.unit.c.name}：恢復 ${Math.min(this.sel.c.heal, tg.unit.c.hp - tg.unit.hp)} HP`);
      }
    }
  }

  selectUnit(u) {
    this.closeMenu();
    this.sel = u;
    this.origin = { x: u.x, y: u.y };
    this.reach = this.reachable(u);
    this.state = 'move';
    this.showInfo(u);
    this.showRange(u, this.reach);
    this.hint(`${u.c.name}：點擊藍色格子移動（點自己原地行動）`);
  }

  deselect() {
    this.sel = null;
    this.state = 'idle';
    this.hl.clear();
    this.hint('');
  }

  async doMove(x, y) {
    this.busy = true;
    this.hl.clear();
    await this.moveAlong(this.sel, this.pathTo(this.reach, x, y));
    this.busy = false;
    this.openMenu();
  }

  undoMove() {
    this.closeMenu();
    this.placeAt(this.sel, this.origin.x, this.origin.y);
    this.selectUnit(this.sel);
  }

  cancel() {
    if (this.busy || this.phase !== 'P') return;
    if (this.state === 'move') this.deselect();
    else if (this.state === 'menu') this.undoMove();
    else if (this.state === 'target') this.openMenu();
    else { this.hl.clear(); this.hint(''); }
  }

  inRange(a, b, ax = a.x, ay = a.y) {
    const d = Math.abs(ax - b.x) + Math.abs(ay - b.y);
    return d >= a.c.rmin && d <= a.c.rmax;
  }

  attackTargets(u) { return this.units.filter(o => o.hp > 0 && o.team !== u.team && this.inRange(u, o)); }
  healTargets(u) {
    if (!u.c.heal) return [];
    return this.units.filter(o => o.hp > 0 && o !== u && o.team === u.team && o.hp < o.c.hp && this.inRange(u, o));
  }

  chooseTargets(type, list) {
    this.closeMenu();
    this.state = 'target';
    this.actionType = type;
    this.targets = list.map(o => ({ x: o.x, y: o.y, unit: o }));
    this.drawHighlights(this.targets, type === 'atk' ? 0xff3030 : 0x40e070, 0.4);
    this.drawHighlights([{ x: this.sel.x, y: this.sel.y }], 0xffe066, 0.45, false);
    this.hint(type === 'atk' ? '選擇攻擊目標（右鍵返回）' : '選擇治療對象（右鍵返回）');
  }

  async executeAction(t) {
    const u = this.sel;
    this.busy = true;
    this.hl.clear();
    this.hint('');
    if (this.actionType === 'atk') await this.combat(u, t.unit);
    else await this.heal(u, t.unit);
    this.busy = false;
    if (u.hp > 0) this.finishUnit(u);
    else { this.deselect(); if (!this.checkEnd()) this.checkAllActed(); }
  }

  finishUnit(u) {
    u.acted = true;
    this.refreshTint(u);
    this.deselect();
    if (this.checkEnd()) return;
    this.checkAllActed();
  }

  checkAllActed() {
    if (this.state === 'over') return;
    if (this.team('P').every(u => u.acted)) {
      this.busy = true;
      this.time.delayedCall(450, () => { this.busy = false; this.endPlayerTurn(); });
    }
  }

  // ---------- combat
  calcDamage(a, d, roll = false, dx = d.x, dy = d.y) {
    let dv = d.c.def + this.terrainDef(dx, dy);
    if (a.c.magic) dv = Math.floor(dv / 2);
    let dmg = Math.max(1, a.c.atk - dv);
    const crit = roll && !!a.c.crit && Math.random() < a.c.crit;
    if (crit) dmg *= 2;
    return { dmg, crit };
  }

  async combat(a, d) {
    await this.strike(a, d, false);
    if (d.hp > 0 && a.hp > 0 && this.inRange(d, a)) {
      await this.wait(180);
      await this.strike(d, a, true);
    }
  }

  async strike(a, d, isCounter) {
    const { dmg, crit } = this.calcDamage(a, d, true);
    const ranged = this.dist(a, d) > 1;
    const ax = a.cont.x, ay = a.cont.y, tx = d.cont.x, ty = d.cont.y;
    if (ranged) {
      const orb = this.add.circle(ax, ay - 4, a.c.magic ? 9 : 6, a.c.color).setStrokeStyle(2, 0xffffff).setDepth(30);
      await this.tweenP({ targets: orb, x: tx, y: ty - 4, duration: 240, ease: 'Quad.in' });
      orb.destroy();
    } else {
      const ang = Math.atan2(ty - ay, tx - ax);
      a.cont.setDepth(12);
      await this.tweenP({ targets: a.cont, x: ax + Math.cos(ang) * 20, y: ay + Math.sin(ang) * 20, duration: 110, yoyo: true, ease: 'Quad.out' });
      a.cont.setDepth(10);
    }
    d.hp = Math.max(0, d.hp - dmg);
    this.drawHp(d);
    d.img.setTintFill(0xffffff);
    this.time.delayedCall(110, () => { if (d.img.active) this.refreshTint(d); });
    this.tweens.add({ targets: d.cont, x: tx + 5, duration: 45, yoyo: true, repeat: 2 });
    this.cameras.main.shake(crit ? 220 : 110, crit ? 0.008 : 0.003);
    this.floatText(d, (crit ? '爆擊！' : '') + '-' + dmg, crit ? '#ffd23f' : '#ff6b6b', crit ? 30 : 24);
    this.log(`${a.c.name} ${isCounter ? '反擊' : '攻擊'} ${d.c.name}，造成 ${dmg} 點傷害${crit ? '（爆擊）' : ''}`);
    if (this.sel === d || this.sel === a) this.showInfo(d);
    await this.wait(260);
    if (d.hp <= 0) await this.kill(d);
  }

  async heal(a, t) {
    const amt = Math.min(a.c.heal, t.c.hp - t.hp);
    await this.healFx(t, amt);
    this.log(`${a.c.name} 治療 ${t.c.name}，恢復 ${amt} HP`);
  }

  async healFx(t, amt) {
    t.hp += amt;
    this.drawHp(t);
    const ring = this.add.circle(t.cont.x, t.cont.y, 10).setStrokeStyle(4, 0x6dff9a).setDepth(30);
    this.tweens.add({ targets: ring, radius: 36, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    this.floatText(t, '+' + amt, '#6dff9a', 24);
    await this.wait(450);
  }

  async kill(u) {
    this.log(`★ ${u.c.name} 倒下了！`);
    u.bob.stop();
    await this.tweenP({ targets: u.cont, alpha: 0, scale: 0.3, angle: 90, duration: 380 });
    u.cont.destroy();
    this.units = this.units.filter(o => o !== u);
  }

  floatText(u, s, color, size = 24) {
    const t = this.add.text(u.cont.x, u.cont.y - 30, s, { fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(35);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1000, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  async banner(text, color) {
    const band = this.add.rectangle(W / 2, H / 2, W, 90, color, 0.85).setDepth(50).setAlpha(0);
    const t = this.add.text(W / 2, H / 2, text, { fontFamily: FONT, fontSize: '44px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(51).setAlpha(0);
    t.x -= 80;
    await this.tweenP({ targets: [band, t], alpha: 1, x: '+=40', duration: 250 });
    await this.wait(550);
    await this.tweenP({ targets: [band, t], alpha: 0, x: '+=40', duration: 250 });
    band.destroy(); t.destroy();
  }

  async phaseHeal(team) {
    for (const u of this.team(team)) {
      const ter = this.terrainAt(u.x, u.y);
      if (ter.heal && u.hp < u.c.hp) {
        const amt = Math.min(ter.heal, u.c.hp - u.hp);
        this.log(`${u.c.name} 在民房休息，恢復 ${amt} HP`);
        await this.healFx(u, amt);
      }
    }
  }

  // ---------- turns
  async startPlayerPhase() {
    this.phase = 'P';
    this.busy = true;
    this.units.forEach(u => { u.acted = false; this.refreshTint(u); });
    this.updateTurnText();
    await this.banner(`第 ${this.turn} 回合・我方行動`, 0x2a5fb8);
    await this.phaseHeal('P');
    this.busy = false;
    this.state = 'idle';
    this.updateTurnText();
    this.hint('選擇一名我方角色開始行動');
  }

  async endPlayerTurn() {
    if (this.phase !== 'P' || this.busy || this.state === 'over') return;
    if (this.sel && (this.state === 'menu' || this.state === 'target')) { this.sel.acted = true; this.refreshTint(this.sel); }
    this.deselect();
    this.closeMenu();
    this.phase = 'E';
    this.busy = true;
    this.updateTurnText();
    this.hint('');
    await this.banner('敵方回合', 0xb83a36);
    await this.phaseHeal('E');
    for (const e of this.team('E')) {
      if (e.hp <= 0) continue;
      await this.aiAct(e);
      if (this.checkEnd()) return;
      await this.wait(160);
    }
    this.hl.clear();
    this.turn++;
    this.startPlayerPhase();
  }

  // ---------- AI
  async aiAct(e) {
    const reach = this.reachable(e);
    const foes = this.team('P');
    const allies = this.team('E').filter(o => o !== e);
    let best = null;
    for (const n of reach.values()) {
      if (n.blocked) continue;
      const tb = this.terrainDef(n.x, n.y) * 1.5 - n.c * 0.05;
      if (e.c.heal) {
        for (const al of allies) {
          const miss = al.c.hp - al.hp;
          if (miss <= 0 || !this.inRange(e, al, n.x, n.y)) continue;
          const s = Math.min(e.c.heal, miss) * 2.5 + (al.hp < al.c.hp * 0.5 ? 15 : 0) + tb;
          if (!best || s > best.s) best = { s, n, type: 'heal', t: al };
        }
      }
      for (const f of foes) {
        if (!this.inRange(e, f, n.x, n.y)) continue;
        const dmg = this.calcDamage(e, f).dmg;
        const kill = dmg >= f.hp;
        const counter = !kill && this.inRange(f, { x: n.x, y: n.y }) ? this.calcDamage(f, e, false, n.x, n.y).dmg : 0;
        const s = dmg + (kill ? 40 : 0) - counter * 0.7 + tb + (f.c.heal ? 4 : 0) + (1 - f.hp / f.c.hp) * 6;
        if (!best || s > best.s) best = { s, n, type: 'atk', t: f };
      }
    }

    this.showInfo(e);
    this.showRange(e, reach);
    await this.wait(350);
    this.hl.clear();

    if (best) {
      await this.moveAlong(e, this.pathTo(reach, best.n.x, best.n.y));
      await this.wait(120);
      if (best.type === 'atk') await this.combat(e, best.t);
      else await this.heal(e, best.t);
      return;
    }

    // 沒有可攻擊目標：沿地形距離接近最近的我方角色
    const field = this.distanceField(e, foes);
    let dest = null;
    for (const n of reach.values()) {
      if (n.blocked) continue;
      const v = field.get(n.x + ',' + n.y) ?? 999;
      if (!dest || v < dest.v || (v === dest.v && n.c < dest.n.c)) dest = { v, n };
    }
    if (dest) await this.moveAlong(e, this.pathTo(reach, dest.n.x, dest.n.y));
  }

  distanceField(u, targets) {
    const d = new Map(), q = [];
    targets.forEach(t => { d.set(t.x + ',' + t.y, 0); q.push({ x: t.x, y: t.y, c: 0 }); });
    while (q.length) {
      q.sort((a, b) => a.c - b.c);
      const cur = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const cost = this.moveCost(u, nx, ny);
        if (cost >= 99) continue;
        const nc = cur.c + cost, k = nx + ',' + ny;
        if (d.has(k) && d.get(k) <= nc) continue;
        d.set(k, nc);
        q.push({ x: nx, y: ny, c: nc });
      }
    }
    return d;
  }

  // ---------- end
  checkEnd() {
    if (this.state === 'over') return true;
    const p = this.team('P').length, e = this.team('E').length;
    if (p && e) return false;
    this.state = 'over';
    this.busy = true;
    this.closeMenu();
    this.hl.clear();
    this.time.delayedCall(500, () => this.showResult(p > 0));
    return true;
  }

  showResult(win) {
    this.updateTurnText();
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(60).setInteractive();
    const t = this.add.text(W / 2, 230, win ? '勝利！' : '戰敗…', { fontFamily: FONT, fontSize: '84px', color: win ? '#ffd23f' : '#ff8a80', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(61).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 450, ease: 'Back.out' });
    const survivors = this.team(win ? 'P' : 'E');
    survivors.forEach((u, i) => {
      const x = W / 2 + (i - (survivors.length - 1) / 2) * 110;
      this.add.circle(x, 370, 44, win ? 0x4aa3ff : 0xff5a5a).setStrokeStyle(3, 0xffffff).setDepth(61);
      this.add.image(x, 370, 'tok_' + u.c.key).setDisplaySize(80, 80).setDepth(62);
    });
    this.add.text(W / 2, 450, `共經過 ${this.turn} 回合`, { fontFamily: FONT, fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(61);
    makeButton(this, W / 2 - 130, 540, 220, 56, '再戰一場', () => this.scene.start('Select'), 0x2f9e5b).setDepth(63);
    makeButton(this, W / 2 + 130, 540, 220, 56, '回到標題', () => this.scene.start('Title'), 0x3b6fd8).setDepth(63);
    shade.on('pointerdown', (p, x, y, ev) => ev.stopPropagation());
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0d1119',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, SelectScene, BattleScene],
});
