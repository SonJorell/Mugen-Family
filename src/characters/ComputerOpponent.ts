import { Fighter } from './Fighter';
import { GAME_CONFIG } from '../config/gameConfig';

/** A sparring partner with readable decisions and gaps between attacks. */
export class ComputerOpponent extends Fighter {
  private decisionTimer = 0;
  private attackCooldown = 600;
  private attackIndex = 0;
  private jumpCooldown = 1800;

  think(delta: number, target: Fighter): void {
    this.decisionTimer -= delta;
    this.attackCooldown -= delta;
    this.jumpCooldown -= delta;
    if (!this.combatState.canAct() || this.decisionTimer > 0) return;
    this.decisionTimer = 160;
    // Keep the original direction in the air so crossing over does not turn into orbiting.
    if (!this.isGrounded) {
      if (this.velocityY >= -80) this.jump();
      return;
    }
    this.updateFacing(target.x);
    const distance = Math.abs(target.x - this.x);
    if (this.jumpCooldown <= 0 && distance > 60 && distance < 230) {
      this.velocityX = (this.facingRight ? 1 : -1) * GAME_CONFIG.WALK_SPEED;
      this.jump();
      this.jumpCooldown = 5200;
      return;
    }
    if (distance < 190 && target.getActiveAttackDef() && this.attackIndex % 3 === 1) {
      this.velocityX = 0;
      this.combatState.setState('BLOCKING');
      this.playAnimation('BLOCK');
      return;
    }
    if (distance > 125) {
      this.combatState.setState('WALKING_FORWARD');
      this.playAnimation('WALK_FORWARD');
    } else if (this.attackCooldown <= 0 && !['KNOCKED_DOWN', 'GETTING_UP'].includes(target.combatState.state)) {
      this.combatState.setState('IDLE');
      const attacks = ['LIGHT_PUNCH', 'LIGHT_KICK', 'HEAVY_PUNCH', 'HEAVY_KICK'];
      this.executeAttack(this.superReady ? 'SPECIAL_ATTACK' : attacks[this.attackIndex++ % attacks.length]);
      this.attackCooldown = 850;
    } else {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }
    this.velocityX = 0;
  }

  override update(delta: number): void {
    if (this.combatState.state === 'WALKING_FORWARD') {
      this.velocityX = (this.facingRight ? 1 : -1) * GAME_CONFIG.WALK_SPEED * 0.8;
    }
    super.update(delta);
  }
}
