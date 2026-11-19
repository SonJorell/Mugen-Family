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
  /** Clock (ms, from delta) and the moments ↓ and then → were last held, for the command special. */
  private motionClock = 0;
  private lastDown = -Infinity;
  private lastForwardAfterDown = -Infinity;
  /** Double-tap detection: when ← / → (relative to facing) were last pressed, and held last frame. */
  private lastTap = { forward: -Infinity, back: -Infinity };
  private wasHeld = { forward: false, back: false };
  /** When light punch and light kick were last pressed, for the throw and breaking a throw. */
  private lastLight = { punch: -Infinity, kick: -Infinity };
  /** Dash asked for this frame by a double tap or the dash key: 'forward', 'back' or null. */
  private dashRequest: 'forward' | 'back' | null = null;

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
    this.trackMotion(state, delta);
    this.trackDash(state);
    // A dash wins over walking this frame; blocking wins over dashing.
    if (this.dashRequest && !state.block && (this.combatState.canAct() || this.canCancelInto('DASH'))) this.dash(this.dashRequest === 'back');
    this.dashRequest = null;
    this.handleMovement(state, delta);
    this.handleCombat(state, delta);
  }

  private handleMovement(state: InputState, _delta: number): void {
    if (!this.combatState.canAct()) return;

    if (state.block && this.isGrounded) {
      this.velocityX = 0;
      this.crouchGuarding = !!state.crouch;
      this.hurtbox.rect = this.crouchGuarding ? this.crouchHurtbox : this.standingHurtbox;
      if (this.combatState.state !== 'BLOCKING') this.combatState.setState('BLOCKING');
      this.playAnimation(this.crouchGuarding && this.registry.has('CROUCH') ? 'CROUCH' : 'BLOCK');
      return;
    }
    if (this.combatState.state === 'BLOCKING') {
      this.crouchGuarding = false;
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

    // Light punch + light kick (together, or a moment apart) is a throw; when held, it breaks one.
    if (state.lightPunch) this.lastLight.punch = this.motionClock;
    if (state.lightKick) this.lastLight.kick = this.motionClock;
    // Not pressed together, it only counts while the first light attack is still starting up and
    // has not landed; otherwise J then U stays the light chain of a combo.
    const together = !!(state.lightPunch && state.lightKick);
    const bothLights = (state.lightPunch || state.lightKick)
      && Math.abs(this.lastLight.punch - this.lastLight.kick) <= GAME_CONFIG.GRAB.PRESS_WINDOW_MS
      && (together || this.combatState.state === 'GRABBED' || this.combatState.canAct() || this.canCancelInto('THROW'));
    if (bothLights) this.lastLight = { punch: -Infinity, kick: -Infinity };
    if (this.combatState.state === 'GRABBED') { if (bothLights) this.techThrow(); return; }
    // Holding ↓ on the ground turns buttons into crouching attacks: light → low kick,
    // heavy punch → launcher, heavy kick → sweep.
    const low = !!state.crouch && this.isGrounded;
    const punch = state.lightPunch || state.heavyPunch;
    // Only read grounded quarter-circle commands when not holding crouch (preserves air punches and ↓+K launcher).
    const command = this.isGrounded && !low && punch && this.readCommand();
    const pressed = command ? 'COMMAND_SPECIAL' : bothLights && !low ? 'THROW'
      : low && (state.lightPunch || state.lightKick) ? 'CROUCH_LIGHT' : low && state.heavyPunch ? 'LAUNCHER' : low && state.heavyKick ? 'SWEEP'
      : state.lightPunch ? 'LIGHT_PUNCH' : state.heavyPunch ? 'HEAVY_PUNCH'
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

  /** Tracks ↓ then → (relative to facing) for the ↓ ↘ → + punch command. */
  private trackMotion(state: InputState, delta: number): void {
    this.motionClock += delta;
    const forward = this.facingRight ? state.moveRight : state.moveLeft;
    if (state.crouch) this.lastDown = this.motionClock;
    if (forward && this.motionClock - this.lastDown <= GAME_CONFIG.COMMAND.WINDOW_MS) this.lastForwardAfterDown = this.motionClock;
  }

  /**
   * Double tap: two presses of the same direction within DASH.DOUBLE_TAP_MS, releasing in between.
   * Presses made while holding ↓ never count, so ↓ ↘ → + punch stays a command, and holding a
   * direction to walk is a single press. The dash key dashes toward the held direction.
   */
  private trackDash(state: InputState): void {
    const forward = !!(this.facingRight ? state.moveRight : state.moveLeft);
    const back = !!(this.facingRight ? state.moveLeft : state.moveRight);
    for (const [dir, held] of [['forward', forward], ['back', back]] as const) {
      if (held && !this.wasHeld[dir]) {
        if (state.crouch) this.lastTap[dir] = -Infinity;
        else if (this.motionClock - this.lastTap[dir] <= GAME_CONFIG.DASH.DOUBLE_TAP_MS) {
          this.dashRequest = dir;
          this.lastTap[dir] = -Infinity;
        } else this.lastTap[dir] = this.motionClock;
      }
      this.wasHeld[dir] = held;
    }
    if (state.dash) this.dashRequest = back ? 'back' : 'forward';
  }

  /** True when ↓ and then → were entered in time for the punch pressed now. */
  private readCommand(): boolean {
    const ok = this.lastForwardAfterDown >= this.lastDown
      && this.lastForwardAfterDown - this.lastDown <= GAME_CONFIG.COMMAND.WINDOW_MS
      && this.motionClock - this.lastForwardAfterDown <= GAME_CONFIG.COMMAND.PRESS_MS;
    if (ok) { this.lastDown = -Infinity; this.lastForwardAfterDown = -Infinity; }
    return ok;
  }

  override update(delta: number): void {
    this.processInput(delta);
    super.update(delta);
  }
}
