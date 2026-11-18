import Phaser from 'phaser';
import { EmberField, ensureGlowTexture } from '../menu/MenuEffects';

const W = 1280, H = 720, HORIZON = 300;

/**
 * Living arena behind the selection screens: a floor grid in real perspective that rolls
 * toward the viewer, a glowing horizon, drifting light beams and embers. It owns its objects
 * and never touches the selectable content, so clicks and layout are unaffected.
 */
export class SelectionBackdrop {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly beams: Phaser.GameObjects.Graphics;
  private readonly horizon: Phaser.GameObjects.Image;
  private readonly embers: EmberField;
  private readonly base: Phaser.GameObjects.Rectangle;
  private shown = true;
  private time = 0;
  private viewX = 0;
  private viewY = 0;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.rectangle(W / 2, H / 2, W, H, 0x3b8ff0);
    this.beams = scene.add.graphics();
    this.horizon = scene.add.image(W / 2, HORIZON, ensureGlowTexture(scene)).setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff6a1f).setDisplaySize(1700, 300).setAlpha(0.55);
    this.grid = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setName('selection-grid');
    this.embers = new EmberField(scene, 46, 1, 0.6, 3);
    this.draw();
  }

  /** Hides the whole arena (embers included), e.g. while a video plays behind the canvas. */
  setVisible(visible: boolean): void {
    this.shown = visible;
    for (const object of [this.base, this.beams, this.horizon, this.grid]) object.setVisible(visible);
    this.embers.setVisible(visible);
  }

  /** `motion` false freezes the scene in a calm still frame. */
  update(dt: number, pointerX: number, pointerY: number, motion: boolean): void {
    this.embers.setVisible(motion && this.shown);
    if (!motion) {
      if (this.viewX !== 0 || this.viewY !== 0) { this.viewX = 0; this.viewY = 0; this.draw(); }
      return;
    }
    const ease = 1 - Math.exp(-dt / 160);
    this.time += dt / 1000;
    this.viewX = Phaser.Math.Linear(this.viewX, pointerX, ease);
    this.viewY = Phaser.Math.Linear(this.viewY, pointerY, ease);
    this.draw();
    this.embers.update(dt, this.viewX, this.viewY);
  }

  private draw(): void {
    const horizon = HORIZON - this.viewY * 14, vanish = W / 2 - this.viewX * 70;
    this.horizon.setPosition(vanish, horizon).setAlpha(0.5 + Math.sin(this.time * 1.1) * 0.08);

    // Diagonal light beams sliding slowly across the back wall.
    const b = this.beams.clear().fillStyle(0x2f86f0, 0.2);
    const shift = (this.time * 14) % 140 - this.viewX * 20;
    for (let x = -440 + shift; x < 1500; x += 140) b.fillTriangle(x, H, x + 400, 0, x + 460, 0);

    const g = this.grid.clear();
    // Lines running away from the viewer converge on the vanishing point.
    for (let i = -14; i <= 14; i++) {
      const alpha = 0.34 - Math.abs(i) * 0.016;
      g.lineStyle(2, 0xffffff, alpha).lineBetween(vanish + i * 16, horizon, W / 2 + i * 190 - this.viewX * 30, H);
    }
    // Cross lines: evenly spaced in depth, so they bunch up near the horizon and roll forward.
    const rows = 14, scroll = (this.time * 0.35) % 1;
    for (let k = 0; k < rows; k++) {
      const depth = (k + 1 - scroll) / rows;          // 1 = far, → 0 = at the viewer's feet
      const y = horizon + (H - horizon) * Math.pow(1 - depth, 2.4) + 2;
      g.lineStyle(2, 0x7fd4ff, 0.05 + (1 - depth) * 0.3).lineBetween(0, y, W, y);
    }
  }
}
