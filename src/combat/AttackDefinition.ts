// ============================================================
// AttackDefinition — Data for each attack move
// ============================================================

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
  /** Hitbox relative to fighter center (x, y, width, height) */
  hitbox: { x: number; y: number; width: number; height: number };
}

/** César's telegraphed grounded grab. Damage is owned by the confirmed cinematic. */
export const DRIVE_GRAB_ATTACK: AttackDefinition = {
  name: 'SPECIAL_ATTACK', startup: 18, active: 7, recovery: 40,
  damage: 0, hitstun: 0, knockback: 0, causesKnockdown: false, blockstun: 0, blockPushback: 0,
  hitbox: { x: 28, y: -230, width: 95, height: 170 },
};

export const ATTACK_DEFINITIONS: Record<string, AttackDefinition> = {
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
    cancelsInto: ['LIGHT_KICK', 'HEAVY_PUNCH', 'HEAVY_KICK'],
    hitbox: { x: 35, y: -210, width: 105, height: 60 },
  },
  HEAVY_PUNCH: {
    name: 'HEAVY_PUNCH',
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
    cancelsInto: ['HEAVY_PUNCH', 'HEAVY_KICK'],
    hitbox: { x: 35, y: -120, width: 110, height: 65 },
  },
  HEAVY_KICK: {
    name: 'HEAVY_KICK',
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
