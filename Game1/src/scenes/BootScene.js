import Phaser from 'phaser';

// 產生程序化貼圖（球、火花、彩帶等）
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 棒球
    g.clear();
    g.fillStyle(0xffffff, 1); g.fillCircle(32, 32, 30);
    g.lineStyle(3, 0xd32f2f, 1);
    g.beginPath(); g.arc(8, 32, 22, -0.9, 0.9); g.strokePath();
    g.beginPath(); g.arc(56, 32, 22, Math.PI - 0.9, Math.PI + 0.9); g.strokePath();
    g.lineStyle(2, 0xbbbbbb, 1); g.strokeCircle(32, 32, 30);
    g.generateTexture('ball', 64, 64);

    // 柔和圓形（陰影 / 光暈）
    g.clear();
    for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.06); g.fillCircle(32, 32, r); }
    g.generateTexture('glow', 64, 64);

    // 火花
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(16, 0, 20, 16, 12, 16); g.fillTriangle(16, 32, 20, 16, 12, 16);
    g.fillTriangle(0, 16, 16, 12, 16, 20); g.fillTriangle(32, 16, 16, 12, 16, 20);
    g.generateTexture('spark', 32, 32);

    // 彩帶
    g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 10, 16);
    g.generateTexture('confetti', 10, 16);

    // 白色像素
    g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4);
    g.generateTexture('px', 4, 4);

    g.destroy();
    this.scene.start('Preload');
  }
}
