// ============================================================
// TrainingOpponent — Static dummy that receives hits
// ============================================================

import { Fighter, FighterOptions } from './Fighter';
import { GAME_CONFIG } from '../config/gameConfig';

export class TrainingOpponent extends Fighter {
  private getUpTimer: number = 0;

  constructor(opts: FighterOptions) {
    super(opts);
    // Tint the dummy slightly to distinguish it
    this.sprite.setTint(0xddaaaa);
  }

  override update(delta: number): void {
    // Dummy is passive — no input processing
    super.update(delta);

    // Slowly reset health only if NOT in DEFEAT state
    if (this.currentHealth <= 0 && this.combatState.state !== 'DEFEAT') {
      this.getUpTimer += delta;
      if (this.getUpTimer > 4000) {
        this.currentHealth = this.maxHealth;
        this.combatState.setState('IDLE');
        this.playAnimation('IDLE', true);
        this.y = GAME_CONFIG.FLOOR_Y;
        this.isGrounded = true;
        this.velocityX = 0;
        this.velocityY = 0;
        this.getUpTimer = 0;
      }
    }
  }
}
