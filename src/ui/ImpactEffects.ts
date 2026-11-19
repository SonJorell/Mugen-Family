// ============================================================
// ImpactEffects — Spark bursts drawn where a hit or a block lands
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export type ImpactKind = 'light' | 'heavy' | 'block';

/** Presentation only: combat code reports the contact point and strength through a callback. */
export class ImpactEffects {
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private live: Phaser.GameObjects.Graphics[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Number of bursts still on screen (used by tests and to cap clutter). */
  get count(): number { return this.live.length; }

  spawn(x: number, y: number, kind: ImpactKind, facingRight: boolean, lowBlock = false): void {
    const fx = GAME_CONFIG.HIT_FEEL.SPARKS[kind];
    const reduced = this.motion.matches;
    const g = this.scene.add.graphics({ x, y }).setDepth(40).setName(`impact-${kind}`);
    g.setBlendMode(Phaser.BlendModes.ADD);
    if (kind === 'block') this.drawBlock(g, fx.size, fx.color, facingRight, lowBlock);
    else this.drawHit(g, fx.size, fx.color, kind === 'heavy');
    this.live.push(g);

    const done = () => { this.live = this.live.filter(item => item !== g); g.destroy(); };
    if (reduced) {
      // No motion: the spark appears at full size and simply fades.
      this.scene.tweens.add({ targets: g, alpha: 0, duration: fx.duration, ease: 'Linear', onComplete: done });
      return;
    }
    g.setScale(0.45).setRotation(Phaser.Math.FloatBetween(-0.3, 0.3));
    this.scene.tweens.add({ targets: g, scale: kind === 'heavy' ? 1.3 : 1.15, alpha: 0, duration: fx.duration, ease: 'Cubic.easeOut', onComplete: done });
    if (kind === 'heavy') {
      // Expanding shockwave ring emphasizes heavy impacts and knockdowns.
      const ring = this.scene.add.circle(x, y, fx.size * 0.35).setStrokeStyle(4, fx.color, 0.9)
        .setDepth(39).setBlendMode(Phaser.BlendModes.ADD);
      ring.isFilled = false;
      this.scene.tweens.add({ targets: ring, scale: 2.3, alpha: 0, duration: fx.duration + 40, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
  }

  private drawHit(g: Phaser.GameObjects.Graphics, size: number, color: number, heavy: boolean): void {
    const rays = heavy ? 12 : 8;
    g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, size * 0.28);
    g.fillStyle(color, 0.55).fillCircle(0, 0, size * 0.5);
    for (let i = 0; i < rays; i++) {
      const angle = i / rays * Math.PI * 2;
      const length = size * (i % 2 === 0 ? 1 : 0.62);
      const side = size * 0.09;
      const tipX = Math.cos(angle) * length, tipY = Math.sin(angle) * length;
      const nx = -Math.sin(angle) * side, ny = Math.cos(angle) * side;
      g.fillStyle(i % 2 === 0 ? 0xffffff : color, 0.95);
      g.fillTriangle(nx, ny, -nx, -ny, tipX, tipY);
    }
    if (heavy) g.lineStyle(4, color, 0.9).strokeCircle(0, 0, size * 0.8);
  }

  private drawBlock(g: Phaser.GameObjects.Graphics, size: number, color: number, facingRight: boolean, lowBlock: boolean): void {
    // A shield arc that opens toward the attacker; crouching guard draws a tighter low hexagonal glow.
    const dir = facingRight ? 0 : Math.PI;
    const span = lowBlock ? 0.82 : 1.05;
    const shieldColor = lowBlock ? 0x66ffe3 : color;
    g.lineStyle(7, shieldColor, 0.92).beginPath().arc(0, 0, size * 0.72, dir - span, dir + span).strokePath();
    g.lineStyle(3, 0xffffff, 0.95).beginPath().arc(0, 0, size * 0.5, dir - span * 0.76, dir + span * 0.76).strokePath();
    g.fillStyle(0xffffff, 0.85).fillCircle(Math.cos(dir) * size * 0.25, 0, size * 0.16);
  }

  destroy(): void {
    this.live.forEach(g => g.destroy());
    this.live = [];
  }
}
