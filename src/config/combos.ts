// ============================================================
// combos — Example combos shown in the pause move list (data only)
// ============================================================

import type { KeyBindings } from '../input/InputMapping';

/**
 * One step of a combo: a button, a crouching button (D+…), the command special (↓ ↘ → + punch),
 * a dash, the super, or a jump.
 */
export type ComboToken = 'LP' | 'LK' | 'HP' | 'HK' | 'D+LK' | 'D+HP' | 'D+HK' | 'CMD' | 'DASH' | 'SUPER' | 'JUMP';

export interface ComboExample { title: string; route: ComboToken[]; note?: string }

const GENERIC: ComboExample[] = [
  { title: 'Cadena básica', route: ['LP', 'LK', 'HP'] },
  { title: 'Hasta el especial', route: ['LP', 'HP', 'CMD'] },
  { title: 'Lanzador', route: ['D+LK', 'D+HP', 'LP', 'LK'], note: 'los dos últimos con el rival en el aire' },
  { title: 'Dash cancel', route: ['HP', 'DASH', 'LP', 'LK', 'HK'] },
];

/** Examples per fighter id; fighters without their own list use the generic one. */
export const COMBO_EXAMPLES: Record<string, ComboExample[]> = {
  tilin: GENERIC,
  cesar: [
    { title: 'Cadena pesada', route: ['LP', 'LK', 'HK'] },
    { title: 'Pisotón', route: ['LK', 'HP', 'CMD'], note: 'de cerca' },
    { title: 'Barrido', route: ['D+LK', 'D+HK'] },
    { title: 'Con súper', route: ['LP', 'HP', 'CMD', 'SUPER'], note: 'con la energía al 100 %' },
  ],
  joako: [
    { title: 'Presión veloz', route: ['LP', 'LK', 'HP', 'DASH', 'LP', 'HK'], note: 'aprovecha su velocidad' },
    { title: 'Ataque rápido', route: ['D+LK', 'HP', 'CMD'] },
    { title: 'Aéreo largo', route: ['D+LK', 'D+HP', 'LP', 'LK'], note: 'los dos últimos en el aire' },
    { title: 'Pelotazo y obra', route: ['LP', 'HP', 'SUPER'], note: 'con la energía al 100 %' },
  ],
  jorell: [
    { title: 'Cadena equilibrada', route: ['LP', 'LK', 'HP', 'CMD'] },
    { title: 'Presión con dash', route: ['LP', 'HP', 'DASH', 'LK', 'HK'] },
    { title: 'Lanzador clásico', route: ['D+LK', 'D+HP', 'LP', 'LK'], note: 'los dos últimos en el aire' },
    { title: 'Despertar Saiyajin', route: ['LP', 'HP', 'CMD', 'SUPER'], note: 'de cerca, energía al 100 %' },
  ],
  tata: [
    { title: 'Ritmo firme', route: ['LP', 'LK', 'HK'] },
    { title: 'Paso y barrido', route: ['D+LK', 'D+HK'] },
    { title: 'Avance seguro', route: ['LK', 'HP', 'CMD'] },
    { title: 'Brindis a pedales', route: ['LP', 'HP', 'SUPER'], note: 'de cerca, energía al 100 %' },
  ],
};

export function comboExamples(fighterId: string): ComboExample[] {
  return COMBO_EXAMPLES[fighterId] ?? GENERIC;
}

const TOKEN_BINDING: Partial<Record<ComboToken, keyof KeyBindings>> = {
  LP: 'LIGHT_PUNCH', LK: 'LIGHT_KICK', HP: 'HEAVY_PUNCH', HK: 'HEAVY_KICK', DASH: 'DASH', SUPER: 'SPECIAL', JUMP: 'JUMP',
};

/** Readable route with the player's own keys, e.g. "J → U → K" or "S+U → S+K". */
export function describeCombo(route: ComboToken[], keys: (binding: keyof KeyBindings) => string): string {
  return route.map(token => {
    if (token === 'CMD') return `↓↘→+${keys('LIGHT_PUNCH')}`;
    if (token.startsWith('D+')) return `${keys('CROUCH')}+${keys(TOKEN_BINDING[token.slice(2) as ComboToken]!)}`;
    return keys(TOKEN_BINDING[token]!);
  }).join(' → ');
}
