export interface FighterChoice { characterId: string; paletteId: string; }

/**
 * Ficha de un luchador. Para agregar uno nuevo basta con sumar una entrada aquí
 * y crear su carpeta en public/assets/characters/<id>/ con su manifest.json.
 */
export interface RosterEntry {
  /** Identificador único; prefija texturas, animaciones y claves de caché. */
  id: string;
  /** Nombre visible en selector, HUD y súper. */
  name: string;
  /** Nombre del poder especial (tecla O). */
  power: string;
  /** Descripción corta del poder para el selector. */
  description: string;
  /** Ruta al manifiesto de animaciones del personaje. */
  manifestPath: string;
  /** Retrato que se muestra durante la secuencia del súper. */
  superPortraitPath: string;
  /** Título de la secuencia del súper (admite salto de línea). */
  superName: string;
}

export const FIGHTER_ROSTER: readonly RosterEntry[] = [
  {
    id: 'tilin',
    name: 'Tilin',
    power: 'Canto sónico',
    description: 'Una onda de voz que daña y aturde.',
    manifestPath: '/assets/characters/tilin/manifest.json',
    superPortraitPath: '/assets/effects/tilin-super-canto.png',
    superName: 'CANTO\nRESONANTE',
  },
];

export const FIGHTER_PALETTES = [
  { id: 'original', name: 'Original', tint: 0xffffff, swatch: 0xc7b58d },
  { id: 'amethyst', name: 'Amatista', tint: 0xc8b3e8, swatch: 0xc8b3e8 },
  { id: 'mint', name: 'Menta', tint: 0xa5e0d4, swatch: 0xa5e0d4 },
  { id: 'coral', name: 'Coral', tint: 0xf2b8ad, swatch: 0xf2b8ad },
] as const;

export function rosterEntry(characterId: string): RosterEntry {
  return FIGHTER_ROSTER.find(f => f.id === characterId) ?? FIGHTER_ROSTER[0];
}

export function normalizeChoice(choice?: FighterChoice, defaultPalette = 'original'): FighterChoice {
  return {
    characterId: rosterEntry(choice?.characterId ?? '').id,
    paletteId: FIGHTER_PALETTES.find(p => p.id === choice?.paletteId)?.id ?? defaultPalette,
  };
}
export function fighterPalette(choice: FighterChoice) {
  return FIGHTER_PALETTES.find(p => p.id === choice.paletteId) ?? FIGHTER_PALETTES[0];
}
