// ============================================================
// Timer — Round countdown display
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class Timer {
  private text: Phaser.GameObjects.Text;
  private bg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const cx = GAME_CONFIG.WIDTH / 2;
    this.bg = scene.add.rectangle(cx, 30, 70, 50, 0x000000, 0.7)
      .setOrigin(0.5, 0).setDepth(50).setScrollFactor(0);
    this.text = scene.add.text(cx, 32, '99', {
      fontFamily: 'Arial Black',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(51).setScrollFactor(0);
  }

  setTime(seconds: number): void {
    const display = Math.max(0, Math.ceil(seconds));
    this.text.setText(display.toString().padStart(2, '0'));
    if (display <= 10) {
      this.text.setColor('#ff4444');
    } else {
      this.text.setColor('#ffffff');
    }
  }

  destroy(): void {
    this.text.destroy();
    this.bg.destroy();
  }
}
