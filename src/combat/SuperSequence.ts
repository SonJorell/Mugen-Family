// ============================================================
// SuperSequence — Polymorphic contract for fighter super cinematics
// ============================================================

import Phaser from 'phaser';
import type { Fighter } from '../characters/Fighter';
import type { RosterEntry } from '../config/roster';

export interface SuperBeat {
  readonly at: number;
  readonly damage: number;
}

export interface SuperContext {
  scene: Phaser.Scene;
  attacker: Fighter;
  defender: Fighter;
  attackerEntry: RosterEntry;
  defenderId: string;
  stageTexture: string;
  fromRight: boolean;
  casterOrigin: { x: number; y: number };
}

/**
 * Presentation and timeline specification for a fighter's super cinematic.
 * SuperMove owns the simulation clock, damage beats, pause/cancel and audio lifecycle;
 * each fighter sequence owns only its visual stage and optional post-super repositioning.
 */
export interface SuperSequence {
  readonly layer: Phaser.GameObjects.Container;
  readonly duration: number;
  readonly beats: readonly SuperBeat[];
  readonly soundKey: string;
  render(elapsed: number, damage: number, reduced: boolean): void;
  /** Called only when the cinematic finishes cleanly (never on cancel). */
  commitPosition?(ctx: SuperContext): void;
}
