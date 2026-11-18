import Phaser from 'phaser';
import { getManifest } from '../config/characters';

/** The rifle and gripping hands are painted into FIRE, so recoil moves them together. */
export class JoakoRiflePose {
  private readonly sourceScale: number;
  private readonly groundY: number;

  constructor(scene: Phaser.Scene, private readonly body: Phaser.GameObjects.Image,
    private readonly direction: number) {
    const sheet = getManifest(scene, 'joako').spriteSheet;
    const layout = { ...sheet, ...sheet?.animations?.FIRE };
    this.sourceScale = 330 / (layout.sourceBodyHeight ?? 238);
    this.groundY = layout.groundY ?? 248;
  }

  render(active: boolean, t: number, recoil: number, reduced: boolean): void {
    if (!active) { this.body.setAngle(0); return; }
    this.body.setTexture('joako_FIRE_2')
      .setAngle(this.direction * (reduced ? 0 : -1.5 * recoil + Math.sin(t * 0.004) * 0.18));
  }

  muzzle(): { x: number; y: number } {
    // Barrel tip in FIRE frame 2's 256 px source cell, using the loader's
    // scale/floor normalization to keep the flash attached at either height.
    const x = (245 - 128) * this.sourceScale * this.direction;
    const y = (54 - this.groundY) * this.sourceScale + 0.1;
    return this.body.getWorldTransformMatrix().transformPoint(x, y);
  }
}
