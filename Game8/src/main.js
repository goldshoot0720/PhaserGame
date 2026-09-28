import Phaser from 'phaser';
import { Battle, heroId } from './game/Battle.js';
import { chooseAction, applyAction } from './game/ai.js';
import { getCard } from './game/cards.js';
import xiang from '../assets/cards/xiang.png';
import calico from '../assets/cards/calico.png';
import whitecat from '../assets/cards/whitecat.png';
import yukino from '../assets/cards/yukino.png';
import luna from '../assets/cards/luna.png';
import penguin from '../assets/cards/penguin.png';
import xiaohong from '../assets/cards/xiaohong.png';
import zhe from '../assets/cards/zhe.png';
import background from '../assets/ui/background.png';

const ART = { xiang, calico, whitecat, yukino, luna, penguin, xiaohong, zhe };
const FONT = '"Noto Sans TC", "PingFang TC", sans-serif';

class DuelScene extends Phaser.Scene {
  constructor() { super('Duel'); }

  preload() {
    this.load.image('background', background);
    for (const [key, path] of Object.entries(ART)) this.load.image(key, path);
  }

  create() {
    this.battle = new Battle();
    this.battle.start();
    this.selected = null;
    this.busy = false;
    this.message = '選手牌召喚角色；選己方角色，再選敵方目標攻擊。';
    this.render();
  }

  text(x, y, value, size = 22, color = '#fff', origin = 0.5) {
    return this.add.text(x, y, String(value), {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#25120c', strokeThickness: 3, align: 'center',
      wordWrap: { width: 260 },
    }).setOrigin(origin);
  }

  button(x, y, w, h, label, enabled, click) {
    const rect = this.add.rectangle(x, y, w, h, enabled ? 0xeeb45d : 0x6b625c, 1)
      .setStrokeStyle(3, 0x402515);
    this.text(x, y, label, 21, enabled ? '#321908' : '#d0c9c4');
    if (enabled) rect.setInteractive({ useHandCursor: true }).on('pointerdown', click);
  }

  card(x, y, w, h, entity, { hand = false, enabled = false, selected = false, target = false, click = null } = {}) {
    const card = getCard(entity.cardId);
    this.add.rectangle(x, y, w, h, selected ? 0xffe49b : target ? 0xf4a4a4 : 0xf7e8cd)
      .setStrokeStyle(selected || target ? 5 : 3, selected ? 0x44d9ff : target ? 0xff6161 : 0x633b24);
    const imageH = hand ? 94 : 70;
    this.add.image(x, y - h / 2 + imageH / 2 + 7, card.id).setDisplaySize(w - 12, imageH);
    this.text(x, y + (hand ? 7 : -1), card.name, hand ? 16 : 15, '#2a1d15');
    if (hand) {
      this.text(x, y + h / 2 - 41, card.text, 12, '#382315');
      this.add.circle(x - w / 2 + 15, y - h / 2 + 15, 14, 0x4368bd);
      this.text(x - w / 2 + 15, y - h / 2 + 15, card.cost, 17);
    }
    const atk = hand ? card.atk : entity.atk;
    const hp = hand ? card.hp : entity.hp;
    this.text(x - w / 2 + 17, y + h / 2 - 18, `⚔ ${atk}`, 16, '#9a291e');
    this.text(x + w / 2 - 19, y + h / 2 - 18, `♥ ${hp}`, 16, '#227a40');
    if (!hand && entity.sleeping) this.text(x, y + h / 2 - 18, '休息', 12, '#6d5965');
    if (click) this.add.zone(x, y, w, h).setInteractive({ useHandCursor: enabled || target }).on('pointerdown', click);
  }

  row(entities, y, { hand = false, owner = 0 } = {}) {
    const w = hand ? 120 : 130;
    const h = hand ? 165 : 130;
    const gap = Math.min(hand ? 137 : 151, 940 / Math.max(entities.length, 1));
    const start = 650 - (entities.length - 1) * gap / 2;
    entities.forEach((entity, i) => {
      const x = start + i * gap;
      if (hand) {
        const enabled = !this.busy && this.battle.canPlay(0, entity.uid);
        this.card(x, y, w, h, entity, { hand, enabled, click: () => this.play(entity.uid) });
      } else if (owner === 0) {
        const enabled = !this.busy && this.battle.canAttack(0, entity.uid);
        this.card(x, y, w, h, entity, {
          enabled, selected: this.selected === entity.uid,
          click: () => { if (enabled) { this.selected = entity.uid; this.render(); } },
        });
      } else {
        const target = this.selected && this.battle.validTargets(0, this.selected).includes(entity.uid);
        this.card(x, y, w, h, entity, { target, click: () => { if (target) this.attack(entity.uid); } });
      }
    });
  }

  render() {
    this.children.removeAll(true);
    const b = this.battle;
    this.add.image(640, 360, 'background').setDisplaySize(1280, 720).setAlpha(0.65);
    this.add.rectangle(640, 360, 1280, 720, 0x261419, 0.42);
    this.text(640, 22, '萌寵卡牌對決', 29, '#ffe2a4');
    this.text(640, 59, this.message, 18, '#fff7e6');
    const enemy = b.players[1];
    const me = b.players[0];
    this.add.rectangle(122, 124, 205, 100, 0x5b2731).setStrokeStyle(3, 0xe7b1a1);
    this.text(122, 100, `電腦　♥ ${enemy.hp}`, 23);
    this.text(122, 140, `手牌 ${enemy.hand.length}　牌庫 ${enemy.deck.length}`, 16);
    const heroTarget = this.selected && b.validTargets(0, this.selected).includes(heroId(1));
    if (heroTarget) this.add.zone(122, 124, 205, 100).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.attack(heroId(1)));
    this.row(enemy.board, 240, { owner: 1 });
    this.add.rectangle(640, 352, 1250, 4, 0xffda9a);
    this.row(me.board, 455);
    this.add.rectangle(122, 546, 205, 85, 0x284f46).setStrokeStyle(3, 0xb2edb8);
    this.text(122, 525, `你　♥ ${me.hp}`, 23);
    this.text(122, 563, `法力 ${me.mana}/${me.maxMana}　牌庫 ${me.deck.length}`, 15);
    this.row(me.hand, 624, { hand: true });
    this.button(1138, 358, 180, 65, b.isOver ? '再玩一次' : '結束回合', b.isOver || (!this.busy && b.current === 0), () => {
      if (b.isOver) this.scene.restart(); else this.endTurn();
    });
    if (b.isOver) {
      this.add.rectangle(640, 354, 580, 140, 0x241923, 0.94).setStrokeStyle(4, 0xffd88e);
      this.text(640, 345, b.winner === 0 ? '勝利！' : b.winner === 1 ? '落敗！' : '平手！', 48, '#ffe7a7');
      this.text(640, 392, '點右側「再玩一次」重新開始', 19);
    }
  }

  play(uid) {
    if (this.busy || !this.battle.canPlay(0, uid)) return;
    const card = getCard(this.battle.players[0].hand.find((c) => c.uid === uid).cardId);
    this.battle.playCard(0, uid);
    this.message = `你召喚了 ${card.name}。`;
    this.selected = null;
    this.render();
  }

  attack(target) {
    if (!this.selected || !this.battle.validTargets(0, this.selected).includes(target)) return;
    this.battle.attack(0, this.selected, target);
    this.message = target === heroId(1) ? '直接攻擊敵方英雄！' : '雙方角色交戰！';
    this.selected = null;
    this.render();
  }

  endTurn() {
    this.busy = true;
    this.selected = null;
    this.battle.endTurn(0);
    this.message = '電腦正在思考…';
    this.render();
    this.time.delayedCall(450, () => this.aiStep());
  }

  aiStep() {
    if (this.battle.isOver || this.battle.current === 0) {
      this.busy = false;
      this.message = this.battle.isOver ? '對戰結束。' : '輪到你了！';
      this.render();
      return;
    }
    const action = chooseAction(this.battle, 1);
    applyAction(this.battle, 1, action);
    this.message = action.type === 'play' ? `電腦召喚了 ${getCard(this.battle.findCharacter(action.uid).entity.cardId).name}。`
      : action.type === 'attack' ? '電腦發動攻擊！' : '輪到你了！';
    this.render();
    this.time.delayedCall(440, () => this.aiStep());
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#251720',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [DuelScene],
});
