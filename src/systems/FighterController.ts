// ============================================================
// FighterController — Bridges hitbox checks between fighters
// ============================================================

import { Fighter } from '../characters/Fighter';
import { rectsOverlap } from '../combat/CollisionSystem';
import { AttackDefinition } from '../combat/AttackDefinition';

/** A normal attack that touched the defender, with the centre of the overlap. */
export interface ImpactEvent {
  attacker: Fighter;
  defender: Fighter;
  attack: AttackDefinition;
  result: 'hit' | 'blocked';
  /** Damage actually dealt on a hit, after combo scaling. */
  damage: number;
  x: number;
  y: number;
}

export class FighterController {
  onSuperHit?: (attacker: Fighter, defender: Fighter) => void;
  /** Reports landed or blocked normal attacks so the scene can add hitstop and sparks. */
  onImpact?: (event: ImpactEvent) => void;
  /**
   * Combo damage scaling, supplied by the scene: the damage this hit should deal and whether it
   * must end the combo with a knockdown (hit limit or damage cap reached).
   */
  scaleHit?: (attacker: Fighter, defender: Fighter, damage: number) => { damage: number; endCombo: boolean };
  checkCollisions(attacker: Fighter, defender: Fighter): void {
    if (attacker.inSuper || defender.inSuper) return;
    for (const wave of attacker.sonicWaves) {
      if (wave.active && rectsOverlap(wave.bounds, defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facingRight))) {
        wave.destroy();
        if (!defender.canReceiveHit) continue;
        if (defender.isGuarding && defender.facingRight === (wave.direction < 0)) {
          defender.receiveHit(0, 0, 0, false, wave.direction < 0);
        } else if (attacker.currentHealth > 0) {
          this.onSuperHit?.(attacker, defender);
          return;
        }
      }
    }
    if (!attacker.hitbox?.active) return;
    if (attacker.hasHitThisSwing) return;

    const hitRect  = attacker.hitbox.getWorldRect(attacker.x, attacker.y, attacker.facingRight);
    const hurtRect = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facingRight);

    if (rectsOverlap(hitRect, hurtRect)) {
      const attackDef = attacker.getActiveAttackDef();
      if (!attackDef) return;

      const fromRight = attacker.x > defender.x;
      if (attackDef.throw) {
        // Throws ignore the guard; they miss fighters in the air, stunned, guarding a hit or down.
        attacker.hasHitThisSwing = true;
        attacker.hitbox.active = false;
        if (defender.throwable) defender.grabbedFrom(attacker);
        return;
      }
      if (attackDef.name === 'SPECIAL_ATTACK' && attacker.stats.special === 'drive') {
        // Airborne opponents escape a grounded grab; frontal guard also stops the opener.
        if (!defender.isGrounded || !defender.canReceiveHit) return;
        attacker.hasHitThisSwing = true;
        attacker.hitbox.active = false;
        if (defender.isGuarding && defender.facingRight === fromRight) {
          defender.receiveHit(0, 0, 0, false, fromRight);
        } else {
          this.onSuperHit?.(attacker, defender);
        }
        return;
      }
      const scaled = this.scaleHit?.(attacker, defender, attackDef.damage) ?? { damage: attackDef.damage, endCombo: false };
      const guarding = defender.isGuarding && defender.facingRight === fromRight;
      const result = defender.receiveHit(
        guarding ? attackDef.damage : scaled.damage,
        attackDef.hitstun,
        attackDef.knockback,
        attackDef.causesKnockdown || scaled.endCombo,
        fromRight,
        false,
        attackDef.blockstun,
        attackDef.blockPushback,
        !!attackDef.launches && !scaled.endCombo,
      );
      if (result === 'hit') attacker.gainEnergy(attackDef.damage * 2 + 6);
      else if (result === 'blocked') attacker.gainEnergy(4);
      if (result !== 'ignored') {
        const left = Math.max(hitRect.worldX, hurtRect.worldX), right = Math.min(hitRect.worldX + hitRect.width, hurtRect.worldX + hurtRect.width);
        const top = Math.max(hitRect.worldY, hurtRect.worldY), bottom = Math.min(hitRect.worldY + hitRect.height, hurtRect.worldY + hurtRect.height);
        this.onImpact?.({ attacker, defender, attack: attackDef, result, damage: result === 'hit' ? scaled.damage : 0, x: (left + right) / 2, y: (top + bottom) / 2 });
      }

      attacker.hasHitThisSwing = true;
      attacker.hitbox.active = false;
    }
  }
}
