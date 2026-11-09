// ============================================================
// GAME CONFIG — Central configuration for all game parameters
// ============================================================

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
      imagePath: '/assets/stages/arica/morro.png',
      floorY: 580,
    },
    {
      id: 'arica_chinchorro',
      name: 'Playa Chinchorro',
      textureKey: 'stage_arica_chinchorro',
      imagePath: '/assets/stages/arica/chinchorro.png',
      floorY: 580,
    },
    {
      id: 'arica_catedral',
      name: 'Catedral San Marcos',
      textureKey: 'stage_arica_catedral',
      imagePath: '/assets/stages/arica/catedral.png',
      floorY: 580,
    },
    {
      id: 'arena_urbana',
      name: 'Arena Urbana Nocturna',
      textureKey: 'stage_arena_urbana',
      imagePath: '/assets/stages/ARENA URBANA NOCTURNA/ARENA URBANA NOCTURNA.jpg',
      floorY: 580,
    },
    {
      id: 'templo_antiguo',
      name: 'Templo Antiguo',
      textureKey: 'stage_templo_antiguo',
      imagePath: '/assets/stages/TEMPLO ANTIGUO/TEMPLO ANTIGUO.jpg',
      floorY: 580,
    },
    {
      id: 'azotea',
      name: 'Azotea de Rascacielos',
      textureKey: 'stage_azotea',
      imagePath: '/assets/stages/AZOTEA DE RASCACIELOS/AZOTEA DE RASCACIELOS.jpg',
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
