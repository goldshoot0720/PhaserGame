// Power Pro 風格 Q 版角色：大頭 + 程序繪製的小身體，無手臂（浮空手套）
import Phaser from 'phaser';

// 各頭像的顯示縮放與偏移（頭像取景不同，讓 8 人視覺一致）
const HEAD_TUNE = {
  c1: { s: 0.5, y: 6 },
  c2: { s: 0.5, y: 4 },
  c3: { s: 0.4, y: 2 },
  c4: { s: 0.4, y: 2 },
  c5: { s: 0.44, y: 6 },
  c6: { s: 0.44, y: 6 },
  c7: { s: 0.47, y: 4 },
  c8: { s: 0.46, y: 4 },
};

export default class Chibi extends Phaser.GameObjects.Container {
  /**
   * @param role 'batter' | 'pitcher' | 'idle'
   */
  constructor(scene, x, y, player, team, role = 'idle') {
    super(scene, x, y);
    this.player = player;
    this.team = team;
    this.role = role;
    scene.add.existing(this);

    const g = (fn) => { const gr = scene.add.graphics(); fn(gr); return gr; };

    this.shadow = g((gr) => { gr.fillStyle(0x000000, 0.28); gr.fillEllipse(0, 0, 78, 18); });

    // 腳（白色球褲 + 釘鞋）
    this.legs = g((gr) => {
      gr.fillStyle(0xf4f4f4, 1); gr.lineStyle(2, 0x333333, 1);
      gr.fillRoundedRect(-20, -40, 17, 34, 6); gr.strokeRoundedRect(-20, -40, 17, 34, 6);
      gr.fillRoundedRect(3, -40, 17, 34, 6); gr.strokeRoundedRect(3, -40, 17, 34, 6);
      gr.fillStyle(team.color, 1); gr.fillRect(-19, -22, 15, 6); gr.fillRect(4, -22, 15, 6); // 襪
      gr.fillStyle(0x222222, 1);
      gr.fillEllipse(-12, -4, 24, 11); gr.fillEllipse(12, -4, 24, 11);
    });

    // 身體（隊服）
    this.torso = g((gr) => {
      gr.fillStyle(team.color, 1); gr.lineStyle(2.5, 0x1a1a1a, 1);
      gr.fillRoundedRect(-30, -86, 60, 52, 14); gr.strokeRoundedRect(-30, -86, 60, 52, 14);
      gr.fillStyle(0xffffff, 1);
      gr.fillRect(-3, -84, 6, 48); // 門襟
      gr.fillStyle(team.color2, 1);
      gr.fillRect(-30, -42, 60, 7); // 腰帶
      gr.fillStyle(0xffd23f, 1); gr.fillRect(-5, -42, 10, 7);
    });
    this.number = scene.add.text(14, -66, String(player.id.slice(1)), {
      fontFamily: 'Arial Black, Arial', fontSize: '15px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    // 頭
    const tune = HEAD_TUNE[player.id] || { s: 0.46, y: 4 };
    this.head = scene.add.image(0, -80 + tune.y, `head_${player.id}`).setOrigin(0.5, 0.95).setScale(tune.s);
    this.headBaseY = this.head.y;

    // 手（浮空的圓手）
    const hand = (color = 0xffffff) => g((gr) => {
      gr.fillStyle(color, 1); gr.lineStyle(2.5, 0x1a1a1a, 1);
      gr.fillCircle(0, 0, 10); gr.strokeCircle(0, 0, 10);
    });
    this.handL = hand();
    this.handR = hand();

    // 球棒 / 手套
    this.bat = g((gr) => {
      gr.fillStyle(0xc8873e, 1); gr.lineStyle(2, 0x3a2208, 1);
      gr.beginPath();
      gr.moveTo(-3, 0); gr.lineTo(3, 0); gr.lineTo(7, -78); gr.lineTo(-7, -78); gr.closePath();
      gr.fillPath(); gr.strokePath();
      gr.fillEllipse(0, -78, 14, 8);
      gr.fillStyle(0x222222, 1); gr.fillRect(-3.5, -14, 7, 14);
    });
    this.glove = g((gr) => {
      gr.fillStyle(0x9a5a22, 1); gr.lineStyle(2.5, 0x3a2208, 1);
      gr.fillEllipse(0, 0, 30, 34); gr.strokeEllipse(0, 0, 30, 34);
      gr.lineStyle(1.5, 0x3a2208, 1); gr.lineBetween(-6, -12, -6, 8); gr.lineBetween(3, -13, 3, 8);
    });
    this.ballInHand = g((gr) => { gr.fillStyle(0xffffff, 1); gr.lineStyle(1.5, 0x999999); gr.fillCircle(0, 0, 5); gr.strokeCircle(0, 0, 5); });

    this.add([this.shadow, this.legs, this.torso, this.number, this.bat, this.head, this.glove, this.handL, this.handR, this.ballInHand]);
    this.setRole(role);

    // 待機呼吸
    this.idleTween = scene.tweens.add({
      targets: this.head, y: this.headBaseY - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  setRole(role) {
    this.role = role;
    this.bat.setVisible(role === 'batter');
    this.glove.setVisible(role === 'pitcher' || role === 'fielder');
    this.ballInHand.setVisible(false);
    this.bat.setRotation(0);
    this.bat.setScale(1);
    if (role === 'batter') this.batReady();
    else if (role === 'pitcher') this.pitchReady();
    else { this.handL.setPosition(-38, -52); this.handR.setPosition(38, -52); }
  }

  // ---- 打者 ----
  batReady() {
    this.handL.setPosition(26, -64); this.handR.setPosition(30, -74);
    this.bat.setPosition(28, -68).setRotation(-0.55);
    this.buntMode = false;
  }

  buntStance(on) {
    this.buntMode = on;
    this.scene.tweens.killTweensOf([this.bat, this.handL, this.handR]);
    if (on) {
      this.handL.setPosition(20, -60); this.handR.setPosition(48, -64);
      this.bat.setPosition(20, -60).setRotation(1.45);
    } else this.batReady();
  }

  swing(onDone) {
    const sc = this.scene;
    sc.tweens.killTweensOf([this.bat, this.handL, this.handR]);
    this.batReady();
    sc.tweens.add({ targets: this.bat, rotation: { from: -0.55, to: 4.4 }, duration: 260, ease: 'Cubic.easeIn' });
    sc.tweens.add({ targets: [this.handL, this.handR], x: '+=34', y: '+=10', duration: 200, yoyo: true, hold: 120 });
    sc.tweens.add({ targets: this.bat, x: '+=34', y: '+=10', duration: 200, yoyo: true, hold: 120 });
    sc.tweens.add({ targets: this.torso, angle: { from: 0, to: 8 }, duration: 140, yoyo: true });
    sc.time.delayedCall(700, () => { if (this.active && this.role === 'batter') { this.batReady(); onDone && onDone(); } });
  }

  buntHit() {
    this.scene.tweens.add({ targets: this.bat, x: '+=6', duration: 60, yoyo: true });
  }

  // ---- 投手 ----
  pitchReady() {
    this.glove.setPosition(-30, -58);
    this.handL.setPosition(-30, -58).setVisible(false);
    this.handR.setPosition(30, -56).setVisible(true);
    this.ballInHand.setVisible(false);
  }

  windup(duration, onRelease) {
    const sc = this.scene;
    this.idleTween.pause();
    // 抬腿、手套和球放到胸前 → 手舉高 → 投出
    sc.tweens.chain({
      targets: this,
      tweens: [
        { targets: [this.glove, this.handR], x: 0, y: -70, duration: duration * 0.35, ease: 'Sine.easeOut' },
        { targets: this.handR, x: 44, y: -110, duration: duration * 0.35, ease: 'Sine.easeInOut' },
        {
          targets: this.handR, x: -30, y: -40, duration: duration * 0.3, ease: 'Cubic.easeIn',
          onStart: () => sc.tweens.add({ targets: this.glove, x: -44, y: -50, duration: duration * 0.3 }),
          onComplete: () => {
            onRelease && onRelease();
            sc.time.delayedCall(350, () => { if (this.active) { this.pitchReady(); this.idleTween.resume(); } });
          },
        },
      ],
    });
    sc.tweens.add({ targets: this.legs, y: -8, scaleY: 0.85, duration: duration * 0.5, yoyo: true, ease: 'Sine.easeInOut' });
  }

  // ---- 表情動作 ----
  jump(times = 3) {
    this.scene.tweens.add({ targets: this, y: this.y - 26, duration: 180, yoyo: true, repeat: times - 1, ease: 'Quad.easeOut' });
    this.handL.setPosition(-34, -110); this.handR.setPosition(34, -110);
  }

  droop() {
    this.scene.tweens.add({ targets: this.head, angle: 10, y: this.headBaseY + 6, duration: 300, yoyo: true, hold: 600 });
  }
}
