export interface FighterChoice { characterId: string; paletteId: string; }

/**
 * Ficha de un luchador. Para agregar uno nuevo basta con sumar una entrada aquí
 * y crear su carpeta en public/assets/characters/<id>/ con su manifest.json.
 */
/** Physical and combat traits. Every multiplier is 1 for the reference fighter (Tilin). */
export interface FighterStats {
  /** Visual and collision size (sprite scale, hurtbox, reach). */
  size: number;
  maxHealth: number;
  walkSpeed: number;
  jumpPower: number;
  /** Above 1 is faster; startup, active and recovery frames are divided by it. */
  attackSpeed: number;
  damage: number;
  /** Knockback received is divided by it. */
  weight: number;
  /** Projectile that opens the super with O. */
  special: 'sonic' | 'quake';
}

export const DEFAULT_STATS: FighterStats = {
  size: 1, maxHealth: 100, walkSpeed: 1, jumpPower: 1, attackSpeed: 1, damage: 1, weight: 1, special: 'sonic',
};

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
  stats: FighterStats;
}

export const FIGHTER_ROSTER: readonly RosterEntry[] = [
  {
    id: 'tilin',
    name: 'Tilin',
    power: 'Canto sónico',
    description: 'Conecta la onda con\nla energía al máximo.',
    manifestPath: '/assets/characters/tilin/manifest.json',
    superPortraitPath: '/assets/effects/tilin-super-canto.png',
    superName: 'CANTO\nRESONANTE',
    stats: DEFAULT_STATS,
  },
  {
    id: 'cesar',
    name: 'César',
    power: 'Pisotón sísmico',
    description: 'Una onda por el suelo; se esquiva saltando.',
    manifestPath: '/assets/characters/cesar/manifest.json',
    superPortraitPath: '/assets/effects/cesar-super.png',
    superName: 'TERREMOTO\nDEL MORRO',
    // Big and heavy: more health and damage, slower legs and fists, barely moved by hits.
    stats: { size: 1.14, maxHealth: 125, walkSpeed: 0.72, jumpPower: 0.86, attackSpeed: 0.8, damage: 1.3, weight: 1.7, special: 'quake' },
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
