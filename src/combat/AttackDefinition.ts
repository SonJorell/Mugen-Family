// ============================================================
// AttackDefinition — Data for each attack move
// ============================================================

/** Which guard posture blocks the attack: mid (any), low (crouching), overhead (standing). */
export type GuardHeight = 'mid' | 'low' | 'overhead';

export interface AttackDefinition {
  name: string;
  /** Frames before the hit is active */
  startup: number;
  /** Frames the hitbox is active */
  active: number;
  /** Frames until the fighter can act again */
  recovery: number;
  /** Damage dealt */
  damage: number;
  /** Hitstun frames (opponent locked in hit state) */
  hitstun: number;
  /** Horizontal knockback force */
  knockback: number;
  /** Whether it causes knockdown */
  causesKnockdown: boolean;
  /** Frames a blocking defender stays locked in guard after contact. */
  blockstun: number;
  /** Horizontal push (px/s, before friction) given to a defender who blocks. */
  blockPushback: number;
  /** Attacks this one may be cancelled into once it has touched the defender (hit or block). */
  cancelsInto?: string[];
  /** Animation to play when it is not the attack's own name (command specials reuse animations). */
  animation?: string;
  /** Forward speed (px/s) during startup and active frames, for attacks that travel. */
  forwardSpeed?: number;
  /** Hit-feel strength when the name does not say it (hitstop and camera shake). */
  feel?: 'light' | 'heavy';
  /** Name shown to the player (move list, frame data). */
  label?: string;
  /** Distance (px, centre to centre) at which the CPU considers it. */
  cpuRange?: [number, number];
  /** Done from a crouch: keeps the crouching hurtbox. */
  crouch?: boolean;
  /** Sends the defender up into a juggle (see GAME_CONFIG.JUGGLE). */
  launches?: boolean;
  /** A throw: ignores guard, holds the defender and can be broken (see GAME_CONFIG.GRAB). */
  throw?: boolean;
  /** Guard height required to block: defaults to 'mid' (standing or crouching). */
  guard?: GuardHeight;
  /** Hitbox relative to fighter center (x, y, width, height) */
  hitbox: { x: number; y: number; width: number; height: number };
}

/** César's telegraphed grounded grab. Damage is owned by the confirmed cinematic. */
export const DRIVE_GRAB_ATTACK: AttackDefinition = {
  name: 'SPECIAL_ATTACK', startup: 18, active: 7, recovery: 40,
  damage: 0, hitstun: 0, knockback: 0, causesKnockdown: false, blockstun: 0, blockPushback: 0,
  hitbox: { x: 28, y: -230, width: 95, height: 170 },
};

/** Jorell must confirm a telegraphed stomach punch before the energy cinematic can start. */
export const JORELL_STOMACH_ATTACK: AttackDefinition = {
  name: 'SPECIAL_ATTACK', startup: 20, active: 6, recovery: 38,
  damage: 0, hitstun: 0, knockback: 0, causesKnockdown: false, blockstun: 12, blockPushback: 100,
  hitbox: { x: 25, y: -195, width: 90, height: 85 },
};

/** Tata's visible palm shove must connect before the beer-and-bicycle cinematic. */
export const TATA_SHOVE_ATTACK: AttackDefinition = {
  name: 'SPECIAL_ATTACK', startup: 22, active: 6, recovery: 36,
  damage: 0, hitstun: 0, knockback: 0, causesKnockdown: false, blockstun: 12, blockPushback: 100,
  hitbox: { x: 25, y: -235, width: 95, height: 105 },
};

/** Command specials (↓ ↘ → + punch). Each fighter names one in `FighterStats.commandMove`. */
export type CommandMoveId = 'rush' | 'stomp';
export const COMMAND_MOVES: Record<CommandMoveId, AttackDefinition> = {
  // Tilin: a quick dashing strike that covers ground; light damage, punishable if blocked.
  rush: {
    cancelsInto: ['SPECIAL_ATTACK'],
    name: 'RUSH', label: 'Paso veloz', animation: 'DASH', feel: 'heavy', forwardSpeed: 560, cpuRange: [150, 330],
    startup: 7, active: 8, recovery: 18, damage: 9, hitstun: 20, knockback: 220, causesKnockdown: false,
    blockstun: 14, blockPushback: 300,
    hitbox: { x: 30, y: -200, width: 120, height: 110 },
  },
  // César: a slow, low stomp in front of him that knocks down; very unsafe if blocked.
  stomp: {
    cancelsInto: ['SPECIAL_ATTACK'],
    name: 'STOMP', label: 'Pisotón sísmico', animation: 'HEAVY_KICK', feel: 'heavy', cpuRange: [0, 150],
    startup: 10, active: 6, recovery: 20, damage: 12, hitstun: 0, knockback: 160, causesKnockdown: true,
    blockstun: 16, blockPushback: 360,
    hitbox: { x: 10, y: -110, width: 150, height: 110 },
  },
};

export const ATTACK_DEFINITIONS: Record<string, AttackDefinition> = {
  // Crouching attacks (↓ + button). They reuse the standing animations with low hitboxes.
  CROUCH_LIGHT: {
    name: 'CROUCH_LIGHT', label: 'Patada baja', animation: 'LIGHT_KICK', crouch: true, guard: 'low',
    startup: 3, active: 5, recovery: 9, damage: 5, hitstun: 14, knockback: 60, causesKnockdown: false,
    blockstun: 13, blockPushback: 200,
    cancelsInto: ['HEAVY_PUNCH', 'COMMAND_SPECIAL', 'LAUNCHER', 'SWEEP'],
    hitbox: { x: 30, y: -90, width: 115, height: 80 },
  },
  LAUNCHER: {
    name: 'LAUNCHER', label: 'Lanzador', animation: 'HEAVY_PUNCH', crouch: true, launches: true, feel: 'heavy',
    startup: 6, active: 6, recovery: 24, damage: 9, hitstun: 0, knockback: 0, causesKnockdown: false,
    blockstun: 12, blockPushback: 260,
    hitbox: { x: 30, y: -250, width: 105, height: 170 },
  },
  SWEEP: {
    name: 'SWEEP', label: 'Barrido', animation: 'HEAVY_KICK', crouch: true, guard: 'low', feel: 'heavy',
    startup: 7, active: 6, recovery: 22, damage: 11, hitstun: 0, knockback: 140, causesKnockdown: true,
    blockstun: 13, blockPushback: 300,
    hitbox: { x: 20, y: -80, width: 150, height: 80 },
  },
  // Throw: light punch + light kick up close. Beats a guard; damage lands when it is not broken.
  THROW: {
    name: 'THROW', label: 'Agarre', animation: 'HEAVY_PUNCH', throw: true, feel: 'heavy',
    startup: 3, active: 3, recovery: 26, damage: 13, hitstun: 0, knockback: 420, causesKnockdown: true,
    blockstun: 0, blockPushback: 0,
    hitbox: { x: 25, y: -230, width: 70, height: 200 },
  },
  // Jump attacks: longer hitstun, so a jump-in links into a ground hit after landing; overhead beats crouching guard.
  AIR_PUNCH: {
    name: 'AIR_PUNCH', label: 'Puño aéreo', guard: 'overhead',
    startup: 3, active: 8, recovery: 10, damage: 7, hitstun: 22, knockback: 60, causesKnockdown: false,
    blockstun: 14, blockPushback: 200,
    hitbox: { x: 20, y: -230, width: 115, height: 120 },
  },
  AIR_KICK: {
    name: 'AIR_KICK', label: 'Patada aérea', guard: 'overhead',
    startup: 4, active: 8, recovery: 12, damage: 9, hitstun: 24, knockback: 80, causesKnockdown: false,
    blockstun: 15, blockPushback: 220,
    hitbox: { x: 15, y: -170, width: 125, height: 130 },
  },
  LIGHT_PUNCH: {
    name: 'LIGHT_PUNCH',
    startup: 2,
    active: 6,
    recovery: 8,
    damage: 5,
    hitstun: 12,
    knockback: 80,
    causesKnockdown: false,
    blockstun: 13,
    blockPushback: 220,
    // Light chain is one step only (punch → kick), so lights cannot loop on each other.
    cancelsInto: ['LIGHT_KICK', 'HEAVY_PUNCH', 'HEAVY_KICK', 'COMMAND_SPECIAL', 'LAUNCHER', 'SWEEP'],
    hitbox: { x: 35, y: -210, width: 105, height: 60 },
  },
  HEAVY_PUNCH: {
    name: 'HEAVY_PUNCH',
    // Heavy → command special → super, or a forward dash to keep the pressure.
    cancelsInto: ['COMMAND_SPECIAL', 'SPECIAL_ATTACK', 'DASH'],
    startup: 4,
    active: 8,
    recovery: 14,
    damage: 12,
    hitstun: 18,
    knockback: 180,
    causesKnockdown: false,
    blockstun: 12,
    blockPushback: 330,
    hitbox: { x: 40, y: -215, width: 130, height: 70 },
  },
  LIGHT_KICK: {
    name: 'LIGHT_KICK',
    startup: 3,
    active: 6,
    recovery: 9,
    damage: 6,
    hitstun: 14,
    knockback: 100,
    causesKnockdown: false,
    blockstun: 13,
    blockPushback: 240,
    cancelsInto: ['HEAVY_PUNCH', 'HEAVY_KICK', 'COMMAND_SPECIAL', 'LAUNCHER', 'SWEEP'],
    hitbox: { x: 35, y: -120, width: 110, height: 65 },
  },
  HEAVY_KICK: {
    name: 'HEAVY_KICK',
    cancelsInto: ['SPECIAL_ATTACK'],
    startup: 6,
    active: 8,
    recovery: 16,
    damage: 15,
    hitstun: 24,
    knockback: 250,
    causesKnockdown: true,
    blockstun: 12,
    blockPushback: 380,
    hitbox: { x: 35, y: -200, width: 135, height: 120 },
  },
  SPECIAL_ATTACK: {
    name: 'SPECIAL_ATTACK',
    startup: 21,
    active: 8,
    recovery: 52,
    damage: 0, // The opener confirms the cinematic; SuperMove owns its damage timeline.
    hitstun: 105,
    knockback: 90,
    causesKnockdown: false,
    blockstun: 0,
    blockPushback: 0,
    hitbox: { x: 30, y: -230, width: 155, height: 160 },
  },
};
