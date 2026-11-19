// ============================================================
// Timer — Round countdown on a hexagonal ivory badge
// ============================================================
//
// "Arcade Impact" look: ivory hexagon with a 4 px ink border and Anton digits in ink. An
// orange stroke round the inside empties with the time left. In the last ten seconds the
// digits and border flip to crimson and each tick jumps.

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FONT_NUMBER } from './fonts';
import { C, CSS } from './theme';

const CX = GAME_CONFIG.WIDTH / 2, CY = 47, R = 44;

/** Corners of a flat-sided hexagon (points left and right) of radius r. */
function hexagon(r: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(CX + Math.cos(i * Math.PI / 3) * r, CY + Math.sin(i * Math.PI / 3) * r * 0.92));
}

export class Timer {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private shown = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.plate = scene.add.graphics().setDepth(50).setScrollFactor(0);
    this.ring = scene.add.graphics().setDepth(51).setScrollFactor(0);
    this.drawPlate(false);
    this.text = scene.add.text(CX, CY, '99', {
      fontFamily: FONT_NUMBER, fontSize: '42px', color: CSS.ink,
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0);
  }

  private drawPlate(urgent: boolean): void {
    const outer = hexagon(R);
    this.plate.clear()
      .fillStyle(C.ink, 0.9).fillPoints(outer.map(p => new Phaser.Math.Vector2(p.x + 4, p.y + 4)), true)
      .fillStyle(C.ivory, 0.9).fillPoints(outer, true)
      .lineStyle(4, urgent ? C.secondary : C.ink, 1).strokePoints(outer, true);
  }

  setTime(seconds: number): void {
    const display = Math.max(0, Math.ceil(seconds));
    if (display === this.shown) return;
    const first = this.shown < 0;
    this.shown = display;
    const urgent = display <= 10;
    this.text.setText(display.toString().padStart(2, '0')).setColor(urgent ? CSS.secondary : CSS.ink);
    this.drawPlate(urgent);
    // The time left as a stroke tracing the inner hexagon from its top-left corner.
    const share = Phaser.Math.Clamp(display / GAME_CONFIG.ROUND_TIME, 0, 1);
    const inner = hexagon(R - 7), path = [...inner.slice(4), ...inner.slice(0, 5)];
    this.ring.clear().lineStyle(4, urgent ? C.secondary : C.primary, 1);
    let left = share * 6;
    for (let i = 0; i < 6 && left > 0; i++, left--) {
      const a = path[i], b = path[i + 1], k = Math.min(1, left);
      this.ring.lineBetween(a.x, a.y, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
    }
    if (first || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Every second ticks; the last ten hit harder.
    this.scene.tweens.killTweensOf(this.text);
    this.text.setScale(urgent ? 1.4 : 1.12);
    this.scene.tweens.add({ targets: this.text, scale: 1, duration: urgent ? 420 : 220, ease: 'Cubic.easeOut' });
  }

  destroy(): void {
    this.text.destroy();
    this.ring.destroy();
    this.plate.destroy();
  }
}
