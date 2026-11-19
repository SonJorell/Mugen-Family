// ============================================================
// Timer — Round countdown in a ring that empties with the time left
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FONT_NUMBER } from './fonts';

const CX = GAME_CONFIG.WIDTH / 2, CY = 45, RADIUS = 37;

export class Timer {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private shown = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.plate = scene.add.graphics().setDepth(50).setScrollFactor(0);
    this.plate.fillStyle(0x0e3a80, 0.96).fillCircle(CX, CY, RADIUS + 5);
    this.plate.lineStyle(2, 0xffb02e, 0.9).strokeCircle(CX, CY, RADIUS + 5);
    this.plate.lineStyle(6, 0x2f86f0, 1).strokeCircle(CX, CY, RADIUS - 3);
    this.ring = scene.add.graphics().setDepth(51).setScrollFactor(0);
    this.text = scene.add.text(CX, CY, '99', {
      fontFamily: FONT_NUMBER, fontSize: '40px', color: '#ffffff', stroke: '#0e3a80', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0);
  }

  setTime(seconds: number): void {
    const display = Math.max(0, Math.ceil(seconds));
    if (display === this.shown) return;
    const first = this.shown < 0;
    this.shown = display;
    const urgent = display <= 10;
    this.text.setText(display.toString().padStart(2, '0')).setColor(urgent ? '#ff5a5a' : '#ffffff');
    const share = Phaser.Math.Clamp(display / GAME_CONFIG.ROUND_TIME, 0, 1);
    this.ring.clear().lineStyle(6, urgent ? 0xff4d4d : 0xffb02e, 1).beginPath()
      .arc(CX, CY, RADIUS - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share, false).strokePath();
    if (first || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Every second ticks; the last ten hit harder.
    this.scene.tweens.killTweensOf(this.text);
    this.text.setScale(urgent ? 1.4 : 1.12);
    this.scene.tweens.add({ targets: this.text, scale: 1, duration: urgent ? 420 : 220, ease: 'Cubic.easeOut' });
  }

  destroy(): void {
    this.text.destroy();
    this.ring.destroy();
    this.plate.destroy();
  }
}
