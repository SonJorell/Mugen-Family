// ============================================================
// CombatState — Fighter state machine
// ============================================================

export type FighterState =
  | 'IDLE'
  | 'WALKING_FORWARD'
  | 'WALKING_BACKWARD'
  /**
   * Forward dash or back dash. Entered from IDLE/walking/crouching with `Fighter.dash`; ends in
   * IDLE after its active and recovery time (GAME_CONFIG.DASH), or earlier if hit.
   */
  | 'DASHING'
  | 'CROUCHING'
  | 'JUMPING'
  | 'ATTACKING'
  | 'BLOCKING'
  /**
   * Guard held after blocking a hit. Entered from BLOCKING (or BLOCKSTUN) when a frontal hit
   * with blockstun is blocked; leaves to IDLE when the blockstun runs out. Locked, still guards.
   */
  | 'BLOCKSTUN'
  | 'HIT'
  | 'STUNNED'
  /**
   * In the air after a launcher. Entered from a launching hit (or another air hit while juggled);
   * ends knocked down on landing. Only GAME_CONFIG.JUGGLE.MAX_HITS hits land while in it.
   */
  | 'JUGGLED'
  /**
   * Held by a throw. Entered when a THROW connects; leaves to IDLE if broken (light punch + light
   * kick within GAME_CONFIG.GRAB.TECH_WINDOW_MS) or knocked down when the throw lands.
   */
  | 'GRABBED'
  | 'LANDING'
  | 'KNOCKED_DOWN'
  | 'GETTING_UP'
  | 'TAUNTING'
  | 'VICTORY'
  | 'DEFEAT'
  | 'SPECIAL'
  | 'SUPER_CAUGHT';

/** Map fighter state to animation name */
export const STATE_TO_ANIMATION: Record<FighterState, string> = {
  IDLE:             'IDLE',
  WALKING_FORWARD:  'WALK_FORWARD',
  WALKING_BACKWARD: 'WALK_BACKWARD',
  DASHING:          'DASH',
  CROUCHING:        'CROUCH',
  JUMPING:          'JUMP',
  ATTACKING:        'IDLE',     // overridden by specific attack name
  BLOCKING:         'BLOCK',
  BLOCKSTUN:        'BLOCK',
  HIT:              'HIT_REACTION',
  STUNNED:          'STUN',
  JUGGLED:          'HIT_REACTION',
  GRABBED:          'HIT_REACTION',
  LANDING:          'LANDING',
  KNOCKED_DOWN:     'KNOCKDOWN',
  GETTING_UP:       'GET_UP',
  TAUNTING:         'TAUNT',
  VICTORY:          'VICTORY',
  DEFEAT:           'DEFEAT',
  SPECIAL:          'SPECIAL_ATTACK',
  SUPER_CAUGHT:     'STUN',
};

/** States during which the fighter cannot move */
export const LOCKED_STATES: Set<FighterState> = new Set([
  'ATTACKING',
  'DASHING',
  'BLOCKSTUN',
  'HIT',
  'STUNNED',
  'JUGGLED',
  'GRABBED',
  'KNOCKED_DOWN',
  'GETTING_UP',
  'TAUNTING',
  'VICTORY',
  'DEFEAT',
  'SPECIAL',
  'SUPER_CAUGHT',
]);

export class CombatState {
  private _state: FighterState = 'IDLE';
  private _attackName: string = '';
  private _stateTimer: number = 0;

  get state(): FighterState { return this._state; }
  get attackName(): string { return this._attackName; }
  get stateTimer(): number { return this._stateTimer; }

  setState(newState: FighterState, attackName: string = ''): void {
    this._state = newState;
    this._attackName = attackName;
    this._stateTimer = 0;
  }

  tick(delta: number): void {
    this._stateTimer += delta;
  }

  isLocked(): boolean {
    return LOCKED_STATES.has(this._state);
  }

  isGrounded(): boolean {
    return this._state !== 'JUMPING';
  }

  canAct(): boolean {
    return !this.isLocked();
  }

  getAnimationName(): string {
    if (this._state === 'ATTACKING' && this._attackName) {
      return this._attackName;
    }
    return STATE_TO_ANIMATION[this._state] ?? 'IDLE';
  }
}
