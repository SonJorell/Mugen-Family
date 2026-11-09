import Phaser from 'phaser';
import { ActiveBox } from './Hitbox';
import { GAME_CONFIG } from '../config/gameConfig';

/** One travelling note: world-space hitbox and artwork share the same position. */
export class SonicWave {
  active = true;
  private age = 0;
  private art: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, public x: number, public y: number, readonly direction: number) {
    this.art = scene.add.graphics().setDepth(18);
    this.draw();
  }
  update(delta: number): void {
    if (!this.active) return;
    this.age += delta;
    this.x += this.direction * 640 * delta / 1000;
    if (this.age >= 900 || this.x < 0 || this.x > GAME_CONFIG.STAGE_WIDTH) this.destroy();
    else this.draw();
  }
  get bounds(): ActiveBox { return { worldX: this.x - 32, worldY: this.y - 75, width: 64, height: 150 }; }
  private draw(): void {
    this.art.clear().setPosition(this.x, this.y).setScale(this.direction, 1);
    for (let i = 0; i < 3; i++) {
      this.art.lineStyle(12 - i * 3, [0x65438e, 0xef709d, 0xb6fff3][i], 0.85);
      this.art.beginPath();
      this.art.arc(-42 - i * 13, 0, 62 + i * 7, -1.05, 1.05, false);
      this.art.strokePath();
    }
    this.art.lineStyle(2, 0xfff2d8, 0.9);
    this.art.beginPath();
    for (let i = 0; i <= 32; i++) {
      const x = -38 + i * 2, y = Math.sin(i * 0.65 - this.age * 0.03) * 12;
      if (!i) this.art.moveTo(x, y); else this.art.lineTo(x, y);
    }
    this.art.strokePath();
  }
  destroy(): void { if (this.active) { this.active = false; this.art.destroy(); } }
}
