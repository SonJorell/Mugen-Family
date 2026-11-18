import type { CommandMoveId } from '../combat/AttackDefinition';
export interface FighterChoice { characterId: string; paletteId: string; }

/** Supplied real heights. Tilin defines the existing game's reference scale. */
export const FIGHTER_HEIGHT_CM = { tilin: 167, cesar: 183, joako: 181, jorell: 182, tata: 165 } as const;
export const heightScale = (heightCm: number) => heightCm / FIGHTER_HEIGHT_CM.tilin;

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
  /** Opener for the super with O: a sonic wave or a close-range grab. */
  special: 'sonic' | 'drive' | 'build' | 'kame' | 'bike';
  /** Command special (↓ ↘ → + punch), from `COMMAND_MOVES` in AttackDefinition.ts. */
  commandMove: CommandMoveId;
}

export const DEFAULT_STATS: FighterStats = {
  size: 1, maxHealth: 100, walkSpeed: 1, jumpPower: 1, attackSpeed: 1, damage: 1, weight: 1, special: 'sonic', commandMove: 'rush',
};

export interface RosterEntry {
  /** Identificador único; prefija texturas, animaciones y claves de caché. */
  id: string;
  /** Nombre visible en selector, HUD y súper. */
  name: string;
  heightCm: number;
  /** Nombre del poder especial (tecla O). */
  power: string;
  /** Descripción corta del poder para el selector. */
  description: string;
  /** Ruta al manifiesto de animaciones del personaje. */
  manifestPath: string;
  /** Retrato que se muestra durante la secuencia del súper. */
  superPortraitPath: string;
  /** Ilustración de cuerpo entero (transparente, 2:3) que rota en la portada. */
  menuArtPath: string;
  /** Lema corto bajo el nombre en la portada (admite salto de línea). */
  motto: string;
  /** Título de la secuencia del súper (admite salto de línea). */
  superName: string;
  /** Final del modo arcade (admite saltos de línea). */
  ending: string;
  /** Frase de victoria que se muestra al ganar el combate. */
  victoryQuote: string;
  stats: FighterStats;
}

export const FIGHTER_ROSTER: readonly RosterEntry[] = [
  {
    id: 'tilin',
    name: 'Tilin',
    heightCm: FIGHTER_HEIGHT_CM.tilin,
    power: 'Canto sónico',
    description: 'Conecta la onda con\nla energía al máximo.',
    manifestPath: '/assets/characters/tilin/manifest.json',
    superPortraitPath: '/assets/effects/tilin-super-canto.webp',
    menuArtPath: '/assets/menu/tilin-3d.webp',
    motto: 'Haz que\nte escuchen.',
    superName: 'CANTO\nRESONANTE',
    victoryQuote: '¿Me escuchaste? Porque toda Arica sí.',
    ending: 'La última nota retumbó por toda la costanera.\nDesde el Morro hasta Chinchorro, Arica entera\naprendió la canción de Tilin.\n\nY esta vez, todos la escucharon.',
    stats: DEFAULT_STATS,
  },
  {
    id: 'cesar',
    name: 'César',
    heightCm: FIGHTER_HEIGHT_CM.cesar,
    power: 'Furia del i30',
    description: 'Acércate y agarra con O. Requiere energía completa.',
    manifestPath: '/assets/characters/cesar/manifest.json',
    superPortraitPath: '/assets/effects/cesar-super.webp',
    menuArtPath: '/assets/menu/cesar-3d-v2.webp',
    motto: 'A fondo\npor Arica.',
    superName: 'FURIA\nDEL i30',
    victoryQuote: 'Súbete al i30, que te llevo a casa.',
    ending: 'Con el motor todavía caliente y una Monster en la mano,\nCésar estacionó el i30 frente a la Catedral.\n\nNadie volvió a discutirle el último puesto\nen la fila del completo.',
    // Big and heavy: more health and damage, slower legs and fists, barely moved by hits.
    stats: { size: heightScale(FIGHTER_HEIGHT_CM.cesar), maxHealth: 125, walkSpeed: 0.72, jumpPower: 0.86, attackSpeed: 0.8, damage: 1.2, weight: 1.7, special: 'drive', commandMove: 'stomp' },
  },
  {
    id: 'joako', name: 'Joako', power: 'Cancha y construcción',
    heightCm: FIGHTER_HEIGHT_CM.joako,
    description: 'Pelotazo, construye y dispara.\nO · Energía al máximo.',
    manifestPath: '/assets/characters/joako/manifest.json',
    superPortraitPath: '/assets/characters/joako/portrait.webp',
    menuArtPath: '/assets/characters/joako/portrait.webp',
    motto: 'Piensa rápido.\nLlega primero.', superName: 'CANCHA Y\nCONSTRUCCIÓN',
    victoryQuote: '¡Golazo! Y todavía me sobró tiempo para construir.',
    ending: 'Joako dominó la cancha con velocidad y una buena idea.\nDesde lo alto de su escalera miró la costa de Arica\ny levantó la pelota para celebrar.\n\nLa próxima partida ya tenía un nuevo favorito.',
    stats: { size: heightScale(FIGHTER_HEIGHT_CM.joako), maxHealth: 90, walkSpeed: 1.3, jumpPower: 1.12, attackSpeed: 1.25, damage: 0.88, weight: 0.85, special: 'build', commandMove: 'rush' },
  },
  {
    id: 'jorell', name: 'Jorell', power: 'Kamehameha',
    heightCm: FIGHTER_HEIGHT_CM.jorell,
    description: 'Golpe al estómago.\nO · Cerca · Energía 100 %',
    manifestPath: '/assets/characters/jorell/manifest.json',
    superPortraitPath: '/assets/characters/jorell-unified/super-cutin.webp',
    menuArtPath: '/assets/characters/jorell-unified/portrait.webp',
    motto: 'Calma por fuera.\nPoder por dentro.', superName: 'DESPERTAR\nSAIYAJIN',
    victoryQuote: 'Y eso que todavía estoy calentando.',
    ending: 'Un destello dorado iluminó el Morro de Arica.\nJorell bajó las manos, recuperó la calma\ny volvió a caminar por la costanera.\n\nLas sandalias seguían intactas.',
    stats: { ...DEFAULT_STATS, size: heightScale(FIGHTER_HEIGHT_CM.jorell), special: 'kame' },
  },
  {
    id: 'tata', name: 'Tata', power: 'Brindis a pedales',
    heightCm: FIGHTER_HEIGHT_CM.tata,
    description: 'Conecta de cerca, brinda y arrolla.\nO · Energía 100 %',
    manifestPath: '/assets/characters/tata/manifest.json',
    superPortraitPath: '/assets/characters/tata-unified/super-cutin.webp',
    menuArtPath: '/assets/characters/tata-unified/portrait.webp',
    motto: 'La experiencia\nva sobre ruedas.', superName: 'BRINDIS\nA PEDALES',
    victoryQuote: '¡Permiso, que el Tata todavía tiene pedal!',
    ending: 'Tata dejó la bicicleta junto al mar y levantó su cerveza.\nLa costanera volvía a estar tranquila.\n\nDespués de tantas vueltas, había demostrado\nque la experiencia también gana carreras.',
    stats: { ...DEFAULT_STATS, size: heightScale(FIGHTER_HEIGHT_CM.tata), maxHealth: 110,
      walkSpeed: 0.9, jumpPower: 0.94, attackSpeed: 0.95, damage: 1.04, weight: 1.15, special: 'bike' },
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

