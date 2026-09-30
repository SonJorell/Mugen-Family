// ============================================================
// BootScene — First scene, starts PreloadScene
// ============================================================

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load here — PreloadScene handles everything
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
