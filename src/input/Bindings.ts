// ============================================================
// Bindings — Per-player key maps, saved in the browser, with validation
// ============================================================

import { DEFAULT_BINDINGS, KeyBindings, keyLabel } from './InputMapping';

export type PlayerSlot = 'p1' | 'p2';

/** Actions a player can remap, in the order shown in Configuración. */
export const REMAPPABLE: readonly (keyof KeyBindings)[] = [
  'MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'CROUCH', 'LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK', 'BLOCK', 'DASH', 'SPECIAL', 'TAUNT',
];

/** Spanish names for the remappable actions. */
export const ACTION_LABELS: Record<string, string> = {
  MOVE_LEFT: 'Izquierda', MOVE_RIGHT: 'Derecha', JUMP: 'Saltar', CROUCH: 'Agacharse',
  LIGHT_PUNCH: 'Puño suave', HEAVY_PUNCH: 'Puño fuerte', LIGHT_KICK: 'Patada suave', HEAVY_KICK: 'Patada fuerte',
  BLOCK: 'Bloquear', DASH: 'Dash', SPECIAL: 'Súper', TAUNT: 'Provocar',
};

/**
 * Player 2 sits on the arrows plus the Insert/Home/PageUp/Delete/End/PageDown block, with the
 * numeric keypad as an alternative, so it never touches player 1's keys nor the music keys.
 */
export const DEFAULT_P2_BINDINGS: KeyBindings = {
  MOVE_LEFT:   ['LEFT'],
  MOVE_RIGHT:  ['RIGHT'],
  JUMP:        ['UP'],
  CROUCH:      ['DOWN'],
  LIGHT_PUNCH: ['INSERT', 'NUMPAD_FOUR'],
  HEAVY_PUNCH: ['HOME', 'NUMPAD_FIVE'],
  LIGHT_KICK:  ['DELETE', 'NUMPAD_ONE'],
  HEAVY_KICK:  ['END', 'NUMPAD_TWO'],
  BLOCK:       ['PAGE_DOWN', 'NUMPAD_THREE'],
  DASH:        ['BACKSPACE', 'NUMPAD_ADD'],
  SPECIAL:     ['PAGE_UP', 'NUMPAD_SIX'],
  TAUNT:       ['NUMPAD_ZERO'],
  PAUSE:       ['ESC'],
  DEBUG_TOGGLE: [],
};

/** Keys that already do something else in the game and cannot be assigned to an action. */
export const RESERVED_KEYS: readonly string[] = ['ESC', 'F1', 'F2', 'F11', 'M', 'COMMA', 'PERIOD', 'ENTER', 'TAB'];

const STORAGE_KEY = 'fighter-keys';

export interface BindingSet { p1: KeyBindings; p2: KeyBindings; }

const clone = (b: KeyBindings): KeyBindings =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as unknown as KeyBindings;

export function defaultBindings(): BindingSet {
  return { p1: clone(DEFAULT_BINDINGS), p2: clone(DEFAULT_P2_BINDINGS) };
}

/** Saved maps merged over the defaults; anything unreadable falls back to the defaults. */
export function loadBindings(): BindingSet {
  const set = defaultBindings();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    for (const slot of ['p1', 'p2'] as const) {
      for (const action of REMAPPABLE) {
        const keys = saved?.[slot]?.[action];
        if (Array.isArray(keys) && keys.length && keys.every((k: unknown) => typeof k === 'string')) set[slot][action] = [...keys];
      }
    }
  } catch { /* Defaults still work when browser storage is unavailable. */ }
  return set;
}

export function saveBindings(set: BindingSet): void {
  try {
    const pick = (b: KeyBindings) => Object.fromEntries(REMAPPABLE.map(a => [a, b[a]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ p1: pick(set.p1), p2: pick(set.p2) }));
  } catch { /* Not saved, but the change applies for this session. */ }
}

export function resetBindings(): BindingSet {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return defaultBindings();
}

/**
 * The keys a player actually listens to. Alone, player 1 also gets the arrows; in a two-player
 * match player 1 drops any key that belongs to player 2.
 */
export function activeKeys(set: BindingSet, slot: PlayerSlot, versus: boolean): KeyBindings {
  if (slot === 'p2') return set.p2;
  const result = clone(set.p1);
  const p2Keys = new Set(REMAPPABLE.flatMap(a => set.p2[a]));
  for (const action of REMAPPABLE) {
    if (versus) result[action] = result[action].filter(k => !p2Keys.has(k));
    else if (['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'CROUCH'].includes(action)) {
      for (const k of set.p2[action]) if (!result[action].includes(k)) result[action].push(k);
    }
  }
  return result;
}

export type AssignResult = { ok: true; set: BindingSet } | { ok: false; reason: string };

/** Assigns `key` as the only key of an action, refusing reserved keys and duplicates. */
export function assignKey(set: BindingSet, slot: PlayerSlot, action: keyof KeyBindings, key: string): AssignResult {
  if (RESERVED_KEYS.includes(key)) return { ok: false, reason: `${keyLabel(key)} está reservada para el juego.` };
  for (const other of ['p1', 'p2'] as const) {
    for (const a of REMAPPABLE) {
      if (other === slot && a === action) continue;
      // Player 1's arrows are only a solo convenience: they never clash with player 2.
      if (set[other][a].includes(key)) {
        return { ok: false, reason: `${keyLabel(key)} ya está en «${ACTION_LABELS[a]}» de ${other === 'p1' ? 'J1' : 'J2'}.` };
      }
    }
  }
  const next: BindingSet = { p1: clone(set.p1), p2: clone(set.p2) };
  next[slot][action] = [key];
  return { ok: true, set: next };
}

export { keyLabel };

/** Phaser key-code name for a DOM keyCode, or null when Phaser has none. */
export function keyNameFromCode(keyCode: number, codes: Record<string, number>): string | null {
  return Object.keys(codes).find(name => codes[name] === keyCode) ?? null;
}
