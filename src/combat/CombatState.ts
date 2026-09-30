// ============================================================
// CombatState — Fighter state machine
// ============================================================

export type FighterState =
  | 'IDLE'
  | 'WALKING_FORWARD'
  | 'WALKING_BACKWARD'
  | 'DASHING'
  | 'CROUCHING'
  | 'JUMPING'
  | 'ATTACKING'
  | 'BLOCKING'
  | 'HIT'
  | 'KNOCKED_DOWN'
  | 'GETTING_UP'
  | 'TAUNTING'
  | 'VICTORY'
  | 'DEFEAT'
  | 'SPECIAL';

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
  HIT:              'HIT_REACTION',
  KNOCKED_DOWN:     'KNOCKDOWN',
  GETTING_UP:       'GET_UP',
  TAUNTING:         'TAUNT',
  VICTORY:          'VICTORY',
  DEFEAT:           'DEFEAT',
  SPECIAL:          'SPECIAL_ATTACK',
};

/** States during which the fighter cannot move */
export const LOCKED_STATES: Set<FighterState> = new Set([
  'ATTACKING',
  'HIT',
  'KNOCKED_DOWN',
  'GETTING_UP',
  'TAUNTING',
  'VICTORY',
  'DEFEAT',
  'SPECIAL',
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
