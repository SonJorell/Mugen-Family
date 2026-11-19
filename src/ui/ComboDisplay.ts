// ============================================================
// ComboDisplay — Hit counter on the attacker's side: big number over an ink "HITS" ribbon
// ============================================================
//
// "Arcade Impact" combo counter: an Anton number with an ink ribbon reading HITS under it and
// the damage dealt below, at mid height on the attacker's side (player left, rival right) so it
// never covers the middle of the stage. Shown from the second hit, pops on every hit and fades
// a moment after the combo ends.

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Combo } from '../systems/ComboTracker';
import { FONT_UI, FONT_NUMBER } from './fonts';
import { C, CSS, CHIP } from './theme';

/** Top of the counter: below the HUD, above the fighters' heads. */
const Y = 196;
const RIBBON_W = 112, RIBBON_H = 30;

/** One counter per side (0 = player, 1 = opponent). */
export class ComboDisplay {
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly groups: Phaser.GameObjects.Container[] = [];
  private readonly counts: Phaser.GameObjects.Text[] = [];
  private readonly ribbonTexts: Phaser.GameObjects.Text[] = [];
  private readonly damage: Phaser.GameObjects.Text[] = [];
  private hideTimers: (Phaser.Time.TimerEvent | null)[] = [null, null];

  constructor(private readonly scene: Phaser.Scene) {
    for (const side of [0, 1]) {
      const left = side === 0, x = left ? 40 : GAME_CONFIG.WIDTH - 40, origin = left ? 0 : 1;
      const group = scene.add.container(x, Y).setDepth(58).setScrollFactor(0).setVisible(false).setName(`combo-${side}`);
      const count = scene.add.text(0, 0, '', {
        fontFamily: FONT_NUMBER, fontSize: '76px', color: CSS.ink, stroke: CSS.ivory, strokeThickness: 7,
      }).setOrigin(origin, 0).setName(`combo-hits-${side}`);
      // Ink ribbon with a hard offset in the side's accent, slanted toward the centre.
      const rx = left ? 4 : -4 - RIBBON_W;
      const flag = scene.add.rectangle(rx + 4, 96, RIBBON_W, RIBBON_H, left ? C.primary : C.tertiary).setOrigin(0, 0);
      const ribbon = scene.add.rectangle(rx, 92, RIBBON_W, RIBBON_H, C.ink).setOrigin(0, 0);
      const label = scene.add.text(rx + RIBBON_W / 2, 92 + RIBBON_H / 2, 'HITS', {
        fontFamily: FONT_NUMBER, fontSize: '22px', color: CSS.ivory,
      }).setOrigin(0.5);
      // The damage chip stays a top-level object (tests and tools find it by name).
      const dmg = scene.add.text(x, Y + 132, '', {
        fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', ...CHIP, padding: { x: 8, y: 3 },
      }).setOrigin(origin, 0).setName(`combo-damage-${side}`).setDepth(58).setScrollFactor(0).setVisible(false);
      group.add([flag, ribbon, label, count]);
      this.groups.push(group); this.counts.push(count); this.ribbonTexts.push(label); this.damage.push(dmg);
    }
  }

  /** Text currently shown on a side as «N HITS», or '' (used by tests). */
  shown(side: number): string { return this.groups[side].visible ? `${this.counts[side].text} HITS` : ''; }

  show(side: number, combo: Combo): void {
    if (combo.hits < GAME_CONFIG.COMBO.MIN_HITS_SHOWN) return;
    this.hideTimers[side]?.remove(); this.hideTimers[side] = null;
    const group = this.groups[side], count = this.counts[side];
    this.scene.tweens.killTweensOf([group, count, this.damage[side]]);
    group.setVisible(true).setAlpha(1);
    this.damage[side].setVisible(true).setAlpha(1);
    // 2–9 hits in ink, 10–29 in Electric Orange, 30+ in Neon Cyan edged in gold (gold ribbon text).
    const tier = combo.hits >= 30 ? 2 : combo.hits >= 10 ? 1 : 0;
    count.setText(String(combo.hits))
      .setColor([CSS.ink, CSS.primary, CSS.tertiary][tier])
      .setStroke(tier === 2 ? CSS.gold : CSS.ivory, 7).setScale(1);
    this.ribbonTexts[side].setColor(tier === 2 ? CSS.gold : CSS.ivory);
    this.damage[side].setText(`${combo.damage} de daño`);
    if (!this.motion.matches) {
      count.setScale(1.4);
      this.scene.tweens.add({ targets: count, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
  }

  /** Keeps the final count on screen for a moment, then fades it out. */
  end(side: number): void {
    if (!this.groups[side].visible) return;
    this.hideTimers[side]?.remove();
    this.hideTimers[side] = this.scene.time.delayedCall(GAME_CONFIG.COMBO.LINGER_MS, () => {
      this.hideTimers[side] = null;
      this.scene.tweens.add({ targets: [this.groups[side], this.damage[side]], alpha: 0, duration: 220,
        onComplete: () => { this.groups[side].setVisible(false); this.damage[side].setVisible(false); } });
    });
  }

  clear(): void {
    for (const side of [0, 1]) {
      this.hideTimers[side]?.remove(); this.hideTimers[side] = null;
      this.scene.tweens.killTweensOf([this.groups[side], this.counts[side], this.damage[side]]);
      this.groups[side].setVisible(false); this.damage[side].setVisible(false);
    }
  }

  destroy(): void {
    this.hideTimers.forEach(t => t?.remove());
    [...this.groups, ...this.damage].forEach(g => g.destroy());
  }
}
