// ============================================================
// BootScene — First scene, starts PreloadScene
// ============================================================

import Phaser from 'phaser';
import { loadGameFonts } from '../ui/fonts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load here — PreloadScene handles everything
  }

  create(): void {
    // Canvas text needs its faces loaded first; a slow or failed font never blocks the game.
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 4000));
    void Promise.race([loadGameFonts(), timeout]).then(() => this.scene.start('PreloadScene'));
  }
}
