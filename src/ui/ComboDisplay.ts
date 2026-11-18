// ============================================================
// ComboDisplay — "N HITS" and total damage on the attacker's side
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Combo } from '../systems/ComboTracker';
import { FONT_UI, FONT_NUMBER } from './fonts';

/** One label per side (0 = player, 1 = opponent). Shown from the second hit of a combo. */
export class ComboDisplay {
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private hits: Phaser.GameObjects.Text[] = [];
  private damage: Phaser.GameObjects.Text[] = [];
  private hideTimers: (Phaser.Time.TimerEvent | null)[] = [null, null];

  constructor(private readonly scene: Phaser.Scene) {
    for (const side of [0, 1]) {
      const x = side === 0 ? 34 : GAME_CONFIG.WIDTH - 34, origin = side === 0 ? 0 : 1;
      this.hits.push(scene.add.text(x, 176, '', {
        fontFamily: FONT_NUMBER, fontSize: '48px', color: '#ffd166', stroke: '#2a0d16', strokeThickness: 7,
      }).setOrigin(origin, 0).setDepth(58).setScrollFactor(0).setVisible(false).setName(`combo-hits-${side}`));
      this.damage.push(scene.add.text(x, 230, '', {
        fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: '#fff7ec', stroke: '#0e3a80', strokeThickness: 4,
      }).setOrigin(origin, 0).setDepth(58).setScrollFactor(0).setVisible(false).setName(`combo-damage-${side}`));
    }
  }

  /** Text currently shown on a side, or '' (used by tests). */
  shown(side: number): string { return this.hits[side].visible ? this.hits[side].text : ''; }

  show(side: number, combo: Combo): void {
    if (combo.hits < GAME_CONFIG.COMBO.MIN_HITS_SHOWN) return;
    this.hideTimers[side]?.remove(); this.hideTimers[side] = null;
    const hits = this.hits[side], damage = this.damage[side];
    this.scene.tweens.killTweensOf([hits, damage]);
    hits.setText(`${combo.hits} HITS`).setVisible(true).setAlpha(1).setScale(1);
    damage.setText(`${combo.damage} de daño`).setVisible(true).setAlpha(1);
    if (!this.motion.matches) {
      hits.setScale(1.35);
      this.scene.tweens.add({ targets: hits, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
  }

  /** Keeps the final count on screen for a moment, then fades it out. */
  end(side: number): void {
    if (!this.hits[side].visible) return;
    this.hideTimers[side]?.remove();
    this.hideTimers[side] = this.scene.time.delayedCall(GAME_CONFIG.COMBO.LINGER_MS, () => {
      this.hideTimers[side] = null;
      this.scene.tweens.add({ targets: [this.hits[side], this.damage[side]], alpha: 0, duration: 220,
        onComplete: () => { this.hits[side].setVisible(false); this.damage[side].setVisible(false); } });
    });
  }

  clear(): void {
    for (const side of [0, 1]) {
      this.hideTimers[side]?.remove(); this.hideTimers[side] = null;
      this.scene.tweens.killTweensOf([this.hits[side], this.damage[side]]);
      this.hits[side].setVisible(false); this.damage[side].setVisible(false);
    }
  }

  destroy(): void {
    this.hideTimers.forEach(t => t?.remove());
    [...this.hits, ...this.damage].forEach(t => t.destroy());
  }
}
