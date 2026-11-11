// ============================================================
// FightMessages — End-of-round announcements (K.O., time, victory, defeat, draw)
// ============================================================

import Phaser from 'phaser';
import { BANNER_STYLES, showBanner } from './EpicBanner';

export class FightMessages {
  /** In a two-player match the verdict names J1 or J2 instead of victory or defeat. */
  constructor(private readonly scene: Phaser.Scene, private readonly versus = false) {}

  /** The reason lands first (K.O. or time), then the verdict takes over the screen. */
  showResult(winner: 'player' | 'opponent' | 'draw', reason: 'ko' | 'timeout'): void {
    this.showReason(reason);
    this.scene.time.delayedCall(1250, () => {
      if (this.versus && winner !== 'draw') {
        showBanner(this.scene, winner === 'player' ? '¡GANA J1!' : '¡GANA J2!', { ...BANNER_STYLES.victory, caption: winner === 'player' ? 'Jugador 1 se lleva el combate' : 'Jugador 2 se lleva el combate', hold: 2300 });
      } else if (winner === 'draw') showBanner(this.scene, 'EMPATE', { ...BANNER_STYLES.draw, caption: 'Nadie cede terreno', hold: 2300 });
      else if (winner === 'player') showBanner(this.scene, '¡VICTORIA!', { ...BANNER_STYLES.victory, caption: '¡Ganaste el combate!', hold: 2300 });
      else showBanner(this.scene, 'DERROTA', { ...BANNER_STYLES.defeat, caption: 'Gana el rival', hold: 2300 });
    });
  }

  /** A round that does not decide the match: reason, then who takes the round and the score. */
  showRoundResult(winner: 'player' | 'opponent' | 'draw', reason: 'ko' | 'timeout', wins: { player: number; opponent: number }): void {
    this.showReason(reason);
    const caption = `Marcador ${wins.player} – ${wins.opponent}`;
    this.scene.time.delayedCall(1250, () => {
      if (winner === 'draw') showBanner(this.scene, 'EMPATE', { ...BANNER_STYLES.draw, fontSize: 110, caption: 'Nadie suma el round', hold: 1500 });
      else if (this.versus) showBanner(this.scene, winner === 'player' ? 'ROUND J1' : 'ROUND J2', { ...BANNER_STYLES.victory, celebrate: false, fontSize: 110, caption, hold: 1500 });
      else if (winner === 'player') showBanner(this.scene, 'ROUND TUYO', { ...BANNER_STYLES.victory, celebrate: false, fontSize: 110, caption, hold: 1500 });
      else showBanner(this.scene, 'ROUND RIVAL', { ...BANNER_STYLES.defeat, mourn: false, fontSize: 110, caption, hold: 1500 });
    });
  }

  private showReason(reason: 'ko' | 'timeout'): void {
    showBanner(this.scene, reason === 'timeout' ? 'TIEMPO' : 'K.O.', { ...(reason === 'timeout' ? BANNER_STYLES.time : BANNER_STYLES.ko), hold: 700 });
  }
}
