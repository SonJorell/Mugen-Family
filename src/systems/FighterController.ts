// ============================================================
// FighterController — Bridges hitbox checks between fighters
// ============================================================

import { Fighter } from '../characters/Fighter';
import { rectsOverlap } from '../combat/CollisionSystem';

export class FighterController {
  checkCollisions(attacker: Fighter, defender: Fighter): void {
    if (!attacker.hitbox?.active) return;
    if (attacker.hasHitThisSwing) return;

    const hitRect  = attacker.hitbox.getWorldRect(attacker.x, attacker.y, attacker.facingRight);
    const hurtRect = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facingRight);

    if (rectsOverlap(hitRect, hurtRect)) {
      const attackDef = attacker.getActiveAttackDef();
      if (!attackDef) return;

      const fromRight = attacker.x > defender.x;
      defender.receiveHit(
        attackDef.damage,
        attackDef.hitstun,
        attackDef.knockback,
        attackDef.causesKnockdown,
        fromRight,
      );

      attacker.hasHitThisSwing = true;
      attacker.hitbox.active = false;
    }
  }
}
