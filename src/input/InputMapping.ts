// ============================================================
// InputMapping — Key bindings configuration
// ============================================================

export interface KeyBindings {
  MOVE_LEFT: string[];
  MOVE_RIGHT: string[];
  JUMP: string[];
  CROUCH: string[];
  LIGHT_PUNCH: string[];
  HEAVY_PUNCH: string[];
  LIGHT_KICK: string[];
  HEAVY_KICK: string[];
  BLOCK: string[];
  SPECIAL: string[];
  TAUNT: string[];
  PAUSE: string[];
  DEBUG_TOGGLE: string[];
}

export const DEFAULT_BINDINGS: KeyBindings = {
  MOVE_LEFT:   ['A', 'LEFT'],
  MOVE_RIGHT:  ['D', 'RIGHT'],
  JUMP:        ['W', 'UP'],
  CROUCH:      ['S', 'DOWN'],
  LIGHT_PUNCH: ['J'],
  HEAVY_PUNCH: ['K'],
  LIGHT_KICK:  ['U'],
  HEAVY_KICK:  ['I'],
  BLOCK:       ['L'],
  SPECIAL:     ['O'],
  TAUNT:       ['P'],
  PAUSE:       ['ESC'],
  DEBUG_TOGGLE: ['F1'],
};

/** Animation test scene keybindings (number keys) */
export const TEST_SCENE_BININGS: Record<string, string> = {
  ONE:   'IDLE',
  TWO:   'WALK_FORWARD',
  THREE: 'WALK_BACKWARD',
  FOUR:  'DASH',
  FIVE:  'CROUCH',
  SIX:   'JUMP',
  SEVEN: 'LIGHT_PUNCH',
  EIGHT: 'HEAVY_PUNCH',
  NINE:  'LIGHT_KICK',
  ZERO:  'HEAVY_KICK',
  MINUS: 'BLOCK',
  PLUS:  'SPECIAL_ATTACK',
};
