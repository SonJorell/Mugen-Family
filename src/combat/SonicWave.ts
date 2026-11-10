import Phaser from 'phaser';
import { ActiveBox } from './Hitbox';
import { GAME_CONFIG } from '../config/gameConfig';

export type WaveStyle = 'sonic' | 'quake';

/**
 * One travelling super opener: world-space hitbox and artwork share the same position.
 * 'sonic' is Tilin's flying note; the optional 'quake' variant travels along the floor.
 */
export class SonicWave {
  active = true;
  private age = 0;
  private art: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, public x: number, public y: number, readonly direction: number, readonly style: WaveStyle = 'sonic') {
    this.art = scene.add.graphics().setDepth(18);
    this.draw();
  }
  update(delta: number): void {
    if (!this.active) return;
    this.age += delta;
    const quake = this.style === 'quake';
    this.x += this.direction * (quake ? 520 : 640) * delta / 1000;
    if (this.age >= (quake ? 1050 : 900) || this.x < 0 || this.x > GAME_CONFIG.STAGE_WIDTH) this.destroy();
    else this.draw();
  }
  get bounds(): ActiveBox {
    // The quake hugs the floor (y is 70 px above it), so a jump clears it.
    return this.style === 'quake'
      ? { worldX: this.x - 45, worldY: this.y - 40, width: 90, height: 110 }
      // Only the solid core hits; the outer sound trails leave room for a timed double jump.
      : { worldX: this.x - 32, worldY: this.y - 40, width: 64, height: 80 };
  }
  private draw(): void {
    if (this.style === 'quake') { this.drawQuake(); return; }
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
  private drawQuake(): void {
    const g = this.art.clear().setPosition(this.x, this.y + 70).setScale(this.direction, 1);
    const pulse = Math.sin(this.age * 0.03);
    // Dust cloud and cracked earth rising from the floor.
    g.fillStyle(0x8a6a4a, 0.55).fillEllipse(-20, -10, 150, 34 + pulse * 6);
    g.fillStyle(0xc9a37a, 0.6).fillEllipse(-5, -22, 96, 26);
    for (let i = 0; i < 5; i++) {
      const h = 30 + ((i * 37 + Math.floor(this.age / 60) * 13) % 45);
      const x = -60 + i * 26;
      g.fillStyle([0x5b4430, 0x7d5c3d, 0x9c7a55][i % 3], 0.95);
      g.fillTriangle(x - 10, 0, x + 10, 0, x + 2, -h);
    }
    g.lineStyle(4, 0xf5bd75, 0.8).beginPath();
    g.arc(-30, 0, 58 + pulse * 5, -1.4, 0, false); g.strokePath();
  }
  destroy(): void { if (this.active) { this.active = false; this.art.destroy(); } }
}
