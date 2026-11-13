// ============================================================
// Announcer — Synthesized voice lines for rounds, K.O., time and verdicts
// ============================================================

import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

/** Every line has a WAV made by scripts/generate-announcer.mjs: announcer-<line>.wav. */
export const ANNOUNCER_LINES = [
  'round-1', 'round-2', 'round-3', 'round-4', 'round-5',
  'fight', 'ko', 'time', 'victory', 'defeat', 'draw', 'p1-wins', 'p2-wins',
] as const;
export type AnnouncerLine = typeof ANNOUNCER_LINES[number];

export const announcerKey = (line: AnnouncerLine) => `announcer-${line}`;

/** Line for a round number; rounds past the last recorded one reuse it. */
export function roundLine(round: number): AnnouncerLine {
  const n = Math.max(1, Math.min(GAME_CONFIG.MAX_ROUNDS, 5, Math.round(round)));
  return `round-${n}` as AnnouncerLine;
}

/**
 * Plays one line. Only one line speaks at a time: a new one cuts the previous. Its loudness is
 * scaled by the announcer volume in Configuración (see GameAudio).
 */
export function announce(scene: Phaser.Scene, line: AnnouncerLine): void {
  const key = announcerKey(line);
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.getAllPlaying().forEach(sound => { if (sound.key.startsWith('announcer-')) sound.stop(); });
  scene.sound.play(key, { volume: GAME_CONFIG.ANNOUNCER_GAIN });
}
