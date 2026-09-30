// ============================================================
// FightMessages — Flash messages (KO, WIN, etc.)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class FightMessages {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showKO(): void {
    this.flash('K.O.!', '#ff2222', '#000000');
  }

  showWinner(name: string): void {
    this.flash(`${name.toUpperCase()} WINS!`, '#ffdd00', '#cc0000');
  }

  showTimeover(): void {
    this.flash('TIME OVER', '#ffffff', '#0000cc');
  }

  private flash(msg: string, color: string, stroke: string): void {
    const text = this.scene.add.text(
      GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2,
      msg,
      { fontFamily: 'Arial Black', fontSize: '80px', color, stroke, strokeThickness: 10 }
    ).setOrigin(0.5).setDepth(300).setAlpha(0).setScrollFactor(0);

    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      scaleX: { from: 0.4, to: 1 },
      scaleY: { from: 0.4, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
      hold: 1500,
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          alpha: 0,
          duration: 600,
          onComplete: () => text.destroy(),
        });
      }
    });
  }
}
