// ============================================================
// PlayerFighter — Human-controlled fighter
// ============================================================

import { Fighter, FighterOptions } from './Fighter';
import { InputManager, InputState } from '../input/InputManager';
import { GAME_CONFIG } from '../config/gameConfig';

export class PlayerFighter extends Fighter {
  private input: InputManager;
  /** Input read on the last frame (the scene checks the gamepad's Start button here). */
  lastInput: InputState | null = null;
  /** Last attack pressed while the fighter could not act, and how long ago (ms). */
  private bufferedAttack: { name: string; age: number } | null = null;

  constructor(opts: FighterOptions, input: InputManager) {
    super(opts);
    this.input = input;
  }

  processInput(delta: number): void {
    if (this.combatState.state === 'DEFEAT' || this.combatState.state === 'VICTORY') {
      this.velocityX = 0;
      this.bufferedAttack = null;
      return;
    }
    const state = this.input.getState();
    this.lastInput = state;
    this.handleMovement(state, delta);
    this.handleCombat(state, delta);
  }

  private handleMovement(state: InputState, _delta: number): void {
    if (!this.combatState.canAct()) return;

    if (state.block && this.isGrounded) {
      this.velocityX = 0;
      this.hurtbox.rect = this.standingHurtbox;
      if (this.combatState.state !== 'BLOCKING') {
        this.combatState.setState('BLOCKING');
        this.playAnimation('BLOCK');
      }
      return;
    }
    if (this.combatState.state === 'BLOCKING') {
      this.combatState.setState('IDLE');
      this.playAnimation('IDLE');
    }

    if (state.jump) {
      this.hurtbox.rect = this.standingHurtbox;
      this.velocityX = (Number(!!state.moveRight) - Number(!!state.moveLeft)) * this.walkSpeed;
      this.jump();
      return;
    }

    if (state.crouch && this.isGrounded) {
      if (this.combatState.state !== 'CROUCHING') {
        this.combatState.setState('CROUCHING');
        this.hurtbox.rect = this.crouchHurtbox;
        this.playAnimation('CROUCH');
      }
      this.velocityX = 0;
      return;
    }

    if (this.combatState.state === 'CROUCHING') {
      this.combatState.setState('IDLE');
      this.hurtbox.rect = this.standingHurtbox;
      this.playAnimation('IDLE');
    }

    this.hurtbox.rect = this.standingHurtbox;
    if (state.moveRight && !state.moveLeft) {
      this.velocityX = this.walkSpeed;

      if (this.isGrounded) {
        const newState = this.facingRight ? 'WALKING_FORWARD' : 'WALKING_BACKWARD';
        if (this.combatState.state !== newState) {
          this.combatState.setState(newState);
          this.playAnimation(this.facingRight ? 'WALK_FORWARD' : 'WALK_BACKWARD');
        }
      }
    } else if (state.moveLeft && !state.moveRight) {
      this.velocityX = -this.walkSpeed;

      if (this.isGrounded) {
        const newState = this.facingRight ? 'WALKING_BACKWARD' : 'WALKING_FORWARD';
        if (this.combatState.state !== newState) {
          this.combatState.setState(newState);
          this.playAnimation(this.facingRight ? 'WALK_BACKWARD' : 'WALK_FORWARD');
        }
      }
    } else {
      // No movement — return to IDLE if was walking
      if (
        this.combatState.state === 'WALKING_FORWARD' ||
        this.combatState.state === 'WALKING_BACKWARD'
      ) {
        this.combatState.setState('IDLE');
        this.playAnimation('IDLE');
      }
      if (this.isGrounded) this.velocityX = 0;
    }

  }

  private handleCombat(state: InputState, delta: number): void {
    if (this.combatState.state === 'BLOCKING') { this.bufferedAttack = null; return; }

    const pressed = state.lightPunch ? 'LIGHT_PUNCH' : state.heavyPunch ? 'HEAVY_PUNCH'
      : state.lightKick ? 'LIGHT_KICK' : state.heavyKick ? 'HEAVY_KICK' : state.special ? 'SPECIAL_ATTACK' : null;
    if (pressed) {
      this.bufferedAttack = { name: pressed, age: 0 };
    } else if (this.bufferedAttack) {
      // Input buffer: a press made just before the fighter can act is kept for a short window.
      this.bufferedAttack.age += delta;
      if (this.bufferedAttack.age > GAME_CONFIG.INPUT_BUFFER_MS) this.bufferedAttack = null;
    }
    if (this.bufferedAttack && (this.combatState.canAct() || this.canCancelInto(this.bufferedAttack.name))) {
      const { name } = this.bufferedAttack;
      this.bufferedAttack = null;
      this.executeAttack(name);
      return;
    }
    if (pressed) return;
    if (state.taunt && this.combatState.canAct()) {
      this.combatState.setState('TAUNTING');
      this.playAnimation('TAUNT', true);
    }
  }

  override update(delta: number): void {
    this.processInput(delta);
    super.update(delta);
  }
}
