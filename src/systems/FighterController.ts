// ============================================================
// FighterController — Bridges hitbox checks between fighters
// ============================================================

import { Fighter } from '../characters/Fighter';
import { rectsOverlap } from '../combat/CollisionSystem';

export class FighterController {
  onSuperHit?: (attacker: Fighter, defender: Fighter) => void;
  checkCollisions(attacker: Fighter, defender: Fighter): void {
    if (attacker.inSuper || defender.inSuper) return;
    for (const wave of attacker.sonicWaves) {
      if (wave.active && rectsOverlap(wave.bounds, defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facingRight))) {
        wave.destroy();
        if (!defender.canReceiveHit) continue;
        if (defender.combatState.state === 'BLOCKING' && defender.facingRight === (wave.direction < 0)) {
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
      const result = defender.receiveHit(
        attackDef.damage,
        attackDef.hitstun,
        attackDef.knockback,
        attackDef.causesKnockdown,
        fromRight,
      );
      if (result === 'hit') attacker.gainEnergy(attackDef.damage * 2 + 6);
      else if (result === 'blocked') attacker.gainEnergy(4);

      attacker.hasHitThisSwing = true;
      attacker.hitbox.active = false;
    }
  }
}
