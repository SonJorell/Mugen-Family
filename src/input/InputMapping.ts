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
  DASH: string[];
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
  DASH:        ['SPACE'],
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

/** Rows of the pause move list, in display order. Keys always come from the bindings. */
export const MOVE_LIST: readonly { binding: keyof KeyBindings; with?: keyof KeyBindings; label: string; note?: string }[] = [
  { binding: 'MOVE_LEFT', label: 'Moverse' },
  { binding: 'JUMP', label: 'Saltar', note: 'otra vez en el aire: doble salto' },
  { binding: 'CROUCH', label: 'Agacharse' },
  { binding: 'LIGHT_PUNCH', label: 'Puño suave' },
  { binding: 'HEAVY_PUNCH', label: 'Puño fuerte' },
  { binding: 'LIGHT_KICK', label: 'Patada suave' },
  { binding: 'HEAVY_KICK', label: 'Patada fuerte', note: 'derriba' },
  { binding: 'BLOCK', label: 'Bloquear', note: 'solo de frente' },
  { binding: 'DASH', label: 'Dash', note: 'o doble toque → / ←' },
  { binding: 'LIGHT_PUNCH', with: 'LIGHT_KICK', label: 'Agarre', note: 'de cerca; rompe la guardia' },
  { binding: 'CROUCH', label: 'Ataques bajos', note: '+ suave, + puño fuerte lanza, + patada fuerte barre' },
  { binding: 'TAUNT', label: 'Provocar' },
];

const KEY_NAMES: Record<string, string> = {
  LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓', ESC: 'Esc', SPACE: 'Espacio', INSERT: 'Insert', HOME: 'Inicio',
  DELETE: 'Supr', END: 'Fin', PAGE_UP: 'RePág', PAGE_DOWN: 'AvPág', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt',
  BACKSPACE: 'Retroceso', NUMPAD_ADD: 'Num +', ENTER: 'Enter', TAB: 'Tab', COMMA: ',', PERIOD: '.', SEMICOLON: 'Ñ', MINUS: '-',
};
const DIGITS: Record<string, string> = {
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9',
};

/** Readable name of a Phaser key code name, e.g. NUMPAD_FOUR → "Num 4", LEFT → "←". */
export function keyLabel(key: string): string {
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  const numpad = key.match(/^NUMPAD_(\w+)$/);
  if (numpad) return 'Num ' + (DIGITS[numpad[1]] ?? numpad[1]);
  return DIGITS[key] ?? key;
}

/** Readable keys for one action, e.g. "A / ←" for MOVE_LEFT plus MOVE_RIGHT pairs. */
export function describeKeys(binding: keyof KeyBindings, bindings: KeyBindings = DEFAULT_BINDINGS): string {
  const keys = (b: keyof KeyBindings) => bindings[b].map(keyLabel);
  if (binding === 'MOVE_LEFT') {
    const left = keys('MOVE_LEFT'), right = keys('MOVE_RIGHT');
    return left.map((k, i) => `${k} ${right[i] ?? ''}`.trim()).join('  /  ');
  }
  return keys(binding).join(' / ');
}
