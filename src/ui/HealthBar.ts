// ============================================================
// HealthBar — Arcade-style health bar widget
// ============================================================

import Phaser from 'phaser';

export class HealthBar {
  private bg: Phaser.GameObjects.Rectangle;
  private bar: Phaser.GameObjects.Rectangle;
  private dangerBar: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;

  private maxHealth: number;
  private currentHealth: number;
  private _x: number;
  private _y: number;
  private _width: number;
  private flipped: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    width: number,
    maxHealth: number,
    name: string,
    flipped: boolean = false,
  ) {
    this._x = x;
    this._y = y;
    this._width = width;
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
    this.flipped = flipped;

    const H = 24;

    // Background (dark)
    this.bg = scene.add.rectangle(x, y, width, H, 0x111111).setOrigin(0, 0).setDepth(50).setScrollFactor(0);

    // Danger bar (red, always full width)
    this.dangerBar = scene.add.rectangle(x, y, width, H, 0xaa0000).setOrigin(0, 0).setDepth(51).setScrollFactor(0);

    // Health bar (green → yellow → red)
    this.bar = scene.add.rectangle(x, y, width, H, 0x00dd44).setOrigin(0, 0).setDepth(52).setScrollFactor(0);

    // Name tag
    this.nameText = scene.add.text(
      flipped ? x + width : x,
      y - 22,
      name.toUpperCase(),
      { fontFamily: 'Arial Black', fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 4 }
    ).setOrigin(flipped ? 1 : 0, 0).setDepth(52).setScrollFactor(0);
  }

  setHealth(value: number): void {
    this.currentHealth = Phaser.Math.Clamp(value, 0, this.maxHealth);
    const ratio = this.currentHealth / this.maxHealth;
    const barW = Math.floor(this._width * ratio);

    if (this.flipped) {
      this.bar.setPosition(this._x + this._width - barW, this._y);
    }
    this.bar.setSize(barW, 24);

    // Color shift: green → yellow → red
    if (ratio > 0.5) {
      const t = (ratio - 0.5) * 2; // 0..1
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(220, 220, 0),
        new Phaser.Display.Color(0, 221, 68),
        100, Math.floor(t * 100),
      );
      this.bar.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    } else {
      const t = ratio * 2; // 0..1
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(200, 0, 0),
        new Phaser.Display.Color(220, 220, 0),
        100, Math.floor(t * 100),
      );
      this.bar.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.bar.destroy();
    this.dangerBar.destroy();
    this.nameText.destroy();
  }
}
