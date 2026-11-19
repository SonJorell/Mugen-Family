// ============================================================
// CombatJuice — Presentation-only afterimages, dust puffs, hit-flashes and callouts
// ============================================================

import Phaser from 'phaser';
import type { Fighter } from '../characters/Fighter';
import { GAME_CONFIG } from '../config/gameConfig';
import { FONT_IMPACT } from './fonts';

interface TrackedFighter {
  grounded: boolean;
  state: string;
  jumps: number;
  ghostTimer: number;
  baseTint: number;
  flashTimer: number;
}

/** Pure presentation effects observed from fighter state changes and combat callbacks. */
export class CombatJuice {
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly tracked = new WeakMap<Fighter, TrackedFighter>();
  private readonly live: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  register(fighter: Fighter): void {
    this.tracked.set(fighter, {
      grounded: fighter.isGrounded,
      state: fighter.combatState.state,
      jumps: fighter.jumpCount,
      ghostTimer: 0,
      baseTint: fighter.sprite.tintTopLeft,
      flashTimer: 0,
    });
  }

  /** Tracks movement transitions (jump, double-jump, land, dash, knockdown) to emit dust & ghosts. */
  update(delta: number, fighters: readonly Fighter[]): void {
    const reduced = this.motion.matches;
    for (const f of fighters) {
      const t = this.tracked.get(f);
      if (!t) continue;
      // Restore palette tint after a brief hit-flash.
      if (t.flashTimer > 0) {
        t.flashTimer -= delta;
        if (t.flashTimer <= 0) f.sprite.setTint(t.baseTint);
      }
      const state = f.combatState.state;
      if (!reduced) {
        // Jump takeoff / double-jump air ring
        if (f.jumpCount > t.jumps) {
          if (f.jumpCount === 1) this.spawnDust(f.x, GAME_CONFIG.FLOOR_Y, 1);
          else this.spawnAirRing(f.x, f.y - 16);
        }
        // Landing puff
        if (!t.grounded && f.isGrounded) {
          this.spawnDust(f.x, GAME_CONFIG.FLOOR_Y, state === 'KNOCKED_DOWN' ? 1.5 : 1);
        }
        // Dash launch dust
        if (state === 'DASHING' && t.state !== 'DASHING') {
          this.spawnDust(f.x, GAME_CONFIG.FLOOR_Y, 1.15, f.facingRight ? -1 : 1);
        }
        // Knockdown floor slam
        if (state === 'KNOCKED_DOWN' && t.state !== 'KNOCKED_DOWN' && f.isGrounded) {
          this.spawnDust(f.x, GAME_CONFIG.FLOOR_Y, 1.6);
        }
        // Ghost afterimages during dash or forward-travelling command moves (Paso veloz)
        const trail = state === 'DASHING' || (state === 'ATTACKING' && !!f.getActiveAttackDef()?.forwardSpeed);
        if (trail && f.sprite.visible) {
          t.ghostTimer -= delta;
          if (t.ghostTimer <= 0) {
            t.ghostTimer = 46;
            this.spawnAfterimage(f, f.dashBack ? 0x7fd4ff : 0xffb02e);
          }
        } else {
          t.ghostTimer = 0;
        }
      }
      t.grounded = f.isGrounded;
      t.state = state;
      t.jumps = f.jumpCount;
    }
  }

  /** Brief white/warm flash on a struck fighter, restoring its palette tint automatically. */
  flashHit(fighter: Fighter, blocked: boolean): void {
    const t = this.tracked.get(fighter);
    if (!t) return;
    fighter.sprite.setTintFill(blocked ? 0x9be6ff : 0xfff6dd);
    t.flashTimer = blocked ? 55 : 85;
  }

  /** Immediately restores base tints on all fighters (e.g. before a super cinematic or round end). */
  clearFlashes(fighters: readonly Fighter[]): void {
    for (const f of fighters) {
      const t = this.tracked.get(f);
      if (t && t.flashTimer > 0) {
        t.flashTimer = 0;
        f.sprite.setTint(t.baseTint);
      }
    }
  }

  /** Dramatic radial flash behind a knocked-out fighter. */
  spawnKoFlash(x: number, y: number): void {
    if (this.motion.matches) return;
    const g = this.track(this.scene.add.graphics({ x, y: y - 130 }).setDepth(41).setBlendMode(Phaser.BlendModes.ADD));
    g.fillStyle(0xffffff, 0.85).fillCircle(0, 0, 52);
    g.lineStyle(8, 0xffb02e, 0.95).strokeCircle(0, 0, 88);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      g.lineStyle(i % 2 ? 3 : 6, i % 2 ? 0xffffff : 0xff6a1f, 0.9)
        .lineBetween(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 210, Math.sin(a) * 210);
    }
    this.scene.tweens.add({
      targets: g, scale: 2.1, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => this.release(g),
    });
  }

  /**
   * Short lateral combat callout («¡CONTRAATAQUE!», «¡AGARRE ROTO!», «¡GOLPE BAJO!»).
   * Top-level Text (never wrapped in a scrollFactor-0 Container) so screen banners stay isolated.
   */
  showCallout(side: 0 | 1, text: string, color = '#ffd166'): void {
    const x = side === 0 ? 34 : GAME_CONFIG.WIDTH - 34;
    const originX = side === 0 ? 0 : 1;
    const label = this.track(this.scene.add.text(x, 146, text, {
      fontFamily: FONT_IMPACT, fontSize: '22px', color, stroke: '#081c42', strokeThickness: 5,
    }).setOrigin(originX, 0).setDepth(59).setScrollFactor(0).setName(`callout-${side}`));
    if (this.motion.matches) {
      this.scene.time.delayedCall(900, () => this.release(label));
      return;
    }
    const offset = side === 0 ? -24 : 24;
    label.setX(x + offset).setAlpha(0);
    this.scene.tweens.chain({
      targets: label,
      tweens: [
        { x, alpha: 1, duration: 140, ease: 'Cubic.easeOut' },
        { alpha: 1, duration: 680 },
        { alpha: 0, y: 136, duration: 220, ease: 'Sine.easeIn' },
      ],
      onComplete: () => this.release(label),
    });
  }

  private spawnAfterimage(fighter: Fighter, tint: number): void {
    const s = fighter.sprite;
    const ghost = this.track(
      this.scene.add.image(s.x, s.y, s.texture.key)
        .setOrigin(s.originX, s.originY)
        .setScale(s.scaleX, s.scaleY)
        .setFlipX(s.flipX)
        .setTint(tint)
        .setAlpha(0.36)
        .setDepth(Math.max(1, s.depth - 1))
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    this.scene.tweens.add({
      targets: ghost, alpha: 0, duration: 170, ease: 'Quad.easeOut',
      onComplete: () => this.release(ghost),
    });
  }

  private spawnDust(x: number, y: number, power = 1, dir = 0): void {
    const puffs = Math.round(4 * power);
    for (let i = 0; i < puffs; i++) {
      const spread = dir ? dir * (18 + i * 16) : (i - (puffs - 1) / 2) * 26;
      const radius = (7 + (i % 3) * 4) * power;
      const puff = this.track(
        this.scene.add.circle(x + spread * 0.35, y - 4, radius, 0xf2e6d0, 0.36).setDepth(3),
      );
      this.scene.tweens.add({
        targets: puff,
        x: x + spread * 1.45,
        y: y - 10 - (i % 2) * 14 * power,
        scale: 1.65,
        alpha: 0,
        duration: 280 + i * 35,
        ease: 'Cubic.easeOut',
        onComplete: () => this.release(puff),
      });
    }
  }

  private spawnAirRing(x: number, y: number): void {
    const ring = this.track(
      this.scene.add.ellipse(x, y, 44, 14).setStrokeStyle(3, 0x7fd4ff, 0.85).setDepth(3).setBlendMode(Phaser.BlendModes.ADD),
    );
    ring.isFilled = false;
    this.scene.tweens.add({
      targets: ring, scaleX: 2.3, scaleY: 1.5, alpha: 0, duration: 240, ease: 'Cubic.easeOut',
      onComplete: () => this.release(ring),
    });
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.live.push(obj);
    return obj;
  }

  private release(obj: Phaser.GameObjects.GameObject): void {
    const idx = this.live.indexOf(obj);
    if (idx >= 0) this.live.splice(idx, 1);
    if (obj.scene) obj.destroy();
  }

  destroy(): void {
    for (const obj of this.live) if (obj.scene) obj.destroy();
    this.live.length = 0;
  }
}
