// ============================================================
// GAME CONFIG — Central configuration for all game parameters
// ============================================================

/** Who controls the rival: the CPU, a passive practice dummy, or a second local player. */
export type GameMode = 'cpu' | 'training' | 'versus';
export const GAME_MODES: readonly GameMode[] = ['cpu', 'training', 'versus'];
export function normalizeMode(value?: string): GameMode {
  return GAME_MODES.includes(value as GameMode) ? value as GameMode : 'cpu';
}

export type CpuDifficulty = 'easy' | 'normal' | 'hard';
export const CPU_DIFFICULTIES: readonly CpuDifficulty[] = ['easy', 'normal', 'hard'];
export interface CpuProfile {
  label: string;
  reactionMs: number;
  blockChance: number;
  attackCooldownMs: [number, number];
  antiAirChance: number;
  punishChance: number;
  jumpCooldownMs: number;
  attacks: [number, number, number, number];
  /** Chance to cancel a light hit that connected into a heavy follow-up. */
  comboChance: number;
}
export function normalizeDifficulty(value?: string): CpuDifficulty {
  return CPU_DIFFICULTIES.includes(value as CpuDifficulty) ? value as CpuDifficulty : 'normal';
}

export const GAME_CONFIG = {
  // Canvas dimensions
  WIDTH: 1280,
  HEIGHT: 720,

  // Stage
  STAGE_WIDTH: 1920,
  STAGE_HEIGHT: 720,
  FLOOR_Y: 580,
  DEFAULT_STAGE_INDEX: 0,
  STAGES: [
    {
      id: 'arica_morro',
      name: 'Costanera del Morro',
      textureKey: 'stage_arica_morro',
      imagePath: '/assets/stages/arica/morro.webp',
      floorY: 580,
    },
    {
      id: 'arica_chinchorro',
      name: 'Playa Chinchorro',
      textureKey: 'stage_arica_chinchorro',
      imagePath: '/assets/stages/arica/chinchorro.webp',
      floorY: 580,
    },
    {
      id: 'arica_catedral',
      name: 'Catedral San Marcos',
      textureKey: 'stage_arica_catedral',
      imagePath: '/assets/stages/arica/catedral.webp',
      floorY: 580,
    },
    {
      id: 'arena_urbana',
      name: 'Arena Urbana Nocturna',
      textureKey: 'stage_arena_urbana',
      imagePath: '/assets/stages/ARENA URBANA NOCTURNA/ARENA URBANA NOCTURNA.webp',
      floorY: 580,
    },
    {
      id: 'templo_antiguo',
      name: 'Templo Antiguo',
      textureKey: 'stage_templo_antiguo',
      imagePath: '/assets/stages/TEMPLO ANTIGUO/TEMPLO ANTIGUO.webp',
      floorY: 580,
    },
    {
      id: 'azotea',
      name: 'Azotea de Rascacielos',
      textureKey: 'stage_azotea',
      imagePath: '/assets/stages/AZOTEA DE RASCACIELOS/AZOTEA DE RASCACIELOS.webp',
      floorY: 580,
    },
  ],

  // Physics
  GRAVITY: 1800,
  JUMP_VELOCITY: -820,
  DOUBLE_JUMP_VELOCITY: -650,
  MAX_JUMPS: 2,
  WALK_SPEED: 260,
  DASH_SPEED: 500,
  MAX_VELOCITY_X: 400,

  // Character
  CHAR_SCALE: 0.38,
  CHAR_ANCHOR_X: 0.5,
  CHAR_ANCHOR_Y: 0.975,

  // Combat
  MAX_HEALTH: 100,
  ROUND_TIME: 99,
  /** An attack pressed this long before the fighter can act again still comes out (ms). */
  INPUT_BUFFER_MS: 120,
  /** Rounds needed to win the match (best of 3). */
  ROUNDS_TO_WIN: 2,
  /** Hard cap so repeated draws cannot extend a match forever. */
  MAX_ROUNDS: 5,
  /** Pause between the end of a round and the next round's intro (ms). */
  ROUND_TRANSITION_MS: 3400,
  /** Pause after the deciding round before returning to the menu (ms). */
  MATCH_END_MS: 4500,

  /**
   * CPU behaviour per difficulty. Times in ms, chances 0–1.
   * reactionMs: pause between decisions · blockChance: guard against an incoming attack ·
   * attackCooldownMs: [min, max] gap between attacks · antiAirChance: heavy punch at a close jump ·
   * punishChance: strike a whiffed or blocked attack during its recovery · jumpCooldownMs: gap
   * between approach jumps · attacks: weights for LIGHT_PUNCH, LIGHT_KICK, HEAVY_PUNCH, HEAVY_KICK ·
   * comboChance: cancel a light hit that connected into a heavy one.
   */
  CPU_DIFFICULTY: {
    easy:   { label: 'Fácil',   reactionMs: 260, blockChance: 0.12, attackCooldownMs: [1150, 1550], antiAirChance: 0,    punishChance: 0,    jumpCooldownMs: 7000, attacks: [4, 4, 1, 1], comboChance: 0 },
    normal: { label: 'Normal',  reactionMs: 160, blockChance: 0.34, attackCooldownMs: [750, 950],   antiAirChance: 0.25, punishChance: 0.25, jumpCooldownMs: 5200, attacks: [3, 3, 2, 2], comboChance: 0.35 },
    hard:   { label: 'Difícil', reactionMs: 105, blockChance: 0.7,  attackCooldownMs: [420, 650],   antiAirChance: 0.65, punishChance: 0.75, jumpCooldownMs: 3800, attacks: [2, 2, 3, 3], comboChance: 0.8 },
  } as Record<CpuDifficulty, CpuProfile>,
  DEFAULT_CPU_DIFFICULTY: 'normal' as CpuDifficulty,

  /** Arcade ladder: fewest fights, and the arenas used in order. */
  ARCADE: { MIN_FIGHTS: 3, STAGE_ORDER: [0, 1, 2, 3, 4, 5] },

  /** Practice mode: inputs kept in the viewer, and the calm needed before health refills (ms). */
  TRAINING: { INPUT_HISTORY: 12, REFILL_DELAY_MS: 1000 },

  /** Combo counter: shown from this many hits, and kept on screen this long after it ends. */
  COMBO: { MIN_HITS_SHOWN: 2, LINGER_MS: 900 },

  /** Hit feel: freeze on contact, camera shake and sparks. Times in ms. */
  HIT_FEEL: {
    /** Both fighters freeze this long when a hit connects; the round clock keeps running. */
    HITSTOP_MS: { light: 55, heavy: 90, knockdown: 120, block: 50 },
    /** Camera shake on strong hits (skipped with prefers-reduced-motion). */
    SHAKE: {
      heavy: { duration: 110, intensity: 0.004 },
      knockdown: { duration: 170, intensity: 0.007 },
    },
    /** Spark bursts at the contact point. */
    SPARKS: {
      light: { size: 46, color: 0xffb347, duration: 170 },
      heavy: { size: 74, color: 0xff6a3d, duration: 230 },
      block: { size: 58, color: 0x7fd6ff, duration: 190 },
    },
  },

  // Camera
  CAMERA_ZOOM: 1.0,

  // Debug (Toggle with F1 in-game)
  DEBUG_MODE: false,
  SHOW_HITBOXES: true,
  SHOW_HURTBOXES: true,
  SHOW_ANCHOR: true,
  SHOW_DEBUG_TEXT: false,

  // Chroma key
  CHROMA_COLOR: { r: 0, g: 255, b: 0 },
  CHROMA_TOLERANCE: 145,

  // Animation frame rates
  ANIM_FRAMERATES: {
    IDLE:           { frameRate: 6,  repeat: -1 },
    WALK_FORWARD:   { frameRate: 10, repeat: -1 },
    WALK_BACKWARD:  { frameRate: 10, repeat: -1 },
    DASH:           { frameRate: 12, repeat: 0  },
    CROUCH:         { frameRate: 6,  repeat: 0  },
    JUMP:           { frameRate: 8,  repeat: 0  },
    LIGHT_PUNCH:    { frameRate: 14, repeat: 0  },
    HEAVY_PUNCH:    { frameRate: 10, repeat: 0  },
    LIGHT_KICK:     { frameRate: 14, repeat: 0  },
    HEAVY_KICK:     { frameRate: 10, repeat: 0  },
    BLOCK:          { frameRate: 6,  repeat: 0  },
    HIT_REACTION:   { frameRate: 10, repeat: 0  },
    KNOCKDOWN:      { frameRate: 8,  repeat: 0  },
    GET_UP:         { frameRate: 8,  repeat: 0  },
    TAUNT:          { frameRate: 8,  repeat: 0  },
    VICTORY:        { frameRate: 6,  repeat: -1 },
    DEFEAT:         { frameRate: 6,  repeat: 0  },
    SPECIAL_ATTACK: { frameRate: 12, repeat: 0  },
  } as Record<string, { frameRate: number; repeat: number }>,

  // All known animation names
  ANIMATION_NAMES: [
    'IDLE',
    'WALK_FORWARD',
    'WALK_BACKWARD',
    'DASH',
    'CROUCH',
    'JUMP',
    'LIGHT_PUNCH',
    'HEAVY_PUNCH',
    'LIGHT_KICK',
    'HEAVY_KICK',
    'BLOCK',
    'HIT_REACTION',
    'KNOCKDOWN',
    'GET_UP',
    'TAUNT',
    'VICTORY',
    'DEFEAT',
    'SPECIAL_ATTACK',
    'STUN',
    'AIR_PUNCH',
    'AIR_KICK',
    'DOUBLE_JUMP',
    'LANDING',
  ] as const,
};

export type AnimationName = typeof GAME_CONFIG.ANIMATION_NAMES[number] | string;
