// ============================================================
// Arcade — Ladder of rivals, run state and credits (data only)
// ============================================================

import { CPU_DIFFICULTIES, CpuDifficulty, GAME_CONFIG } from './gameConfig';
import { FIGHTER_PALETTES, FIGHTER_ROSTER, FighterChoice, normalizeChoice } from './roster';

/** One fight of the ladder. */
export interface ArcadeStep {
  opponent: FighterChoice;
  difficulty: CpuDifficulty;
  stageIndex: number;
  /** The last fight is announced as the final boss. */
  boss: boolean;
}

/** What survives between fights: who plays, which fight is next and how often they continued. */
export interface ArcadeRun {
  player: FighterChoice;
  step: number;
  continues: number;
}

/**
 * Every other fighter of the roster first, then the mirror match, then a final rematch against the
 * first rival on the hardest level. Difficulty climbs evenly from the first to the last fight.
 */
export function buildLadder(player: FighterChoice): ArcadeStep[] {
  const others = FIGHTER_ROSTER.filter(f => f.id !== player.characterId).map(f => f.id);
  const ids = [...others, player.characterId];
  ids.push(others[0] ?? player.characterId);
  const length = Math.max(GAME_CONFIG.ARCADE.MIN_FIGHTS, ids.length);
  while (ids.length < length) ids.push(ids[ids.length % Math.max(1, ids.length)]);
  // Rivals never wear the player's colour; the boss wears the last palette.
  const palettes = FIGHTER_PALETTES.map(p => p.id).filter(id => id !== player.paletteId);
  return ids.map((id, i) => {
    const boss = i === ids.length - 1;
    const level = ids.length === 1 ? CPU_DIFFICULTIES.length - 1 : Math.round(i * (CPU_DIFFICULTIES.length - 1) / (ids.length - 1));
    return {
      opponent: normalizeChoice({ characterId: id, paletteId: boss ? palettes[palettes.length - 1] : palettes[i % palettes.length] }),
      difficulty: CPU_DIFFICULTIES[level],
      stageIndex: GAME_CONFIG.ARCADE.STAGE_ORDER[i % GAME_CONFIG.ARCADE.STAGE_ORDER.length] % GAME_CONFIG.STAGES.length,
      boss,
    };
  });
}

export function newRun(player: FighterChoice): ArcadeRun {
  return { player: normalizeChoice(player), step: 0, continues: 0 };
}

/** Credits rolled after the ending. Provenance follows the records kept in art/ and scripts/. */
export const CREDITS: readonly { heading: string; lines: string[] }[] = [
  { heading: 'Fighter Family', lines: ['Juego de pelea 2D para navegador'] },
  { heading: 'Creación y dirección', lines: ['Jorell'] },
  { heading: 'Luchadores', lines: ['Tilin · Canto sónico', 'César · Furia del i30'] },
  { heading: 'Arte de luchadores', lines: [
    'Hojas de Tilin (v2 y v3) y de César (v2)',
    'generadas con ImageGen integrado a partir de los dibujos originales',
    'Prompts y procedencia: art/tilin-v2, art/tilin-v3, art/cesar-v2',
  ] },
  { heading: 'Escenarios e ilustraciones', lines: [
    'Costanera del Morro, Playa Chinchorro, Catedral San Marcos y portada:',
    'ImageGen integrado · art/arica',
    'Retratos del súper e ilustraciones del menú: art/super-canto, art/cesar-menu-3d, art/cesar-drive',
    'Arena Urbana, Templo Antiguo y Azotea: escenarios originales del proyecto',
  ] },
  { heading: 'Música y sonido', lines: [
    'Música, golpes, voces y efectos sintetizados por código, sin grabaciones externas',
    'scripts/generate-music.mjs · generate-sounds.mjs · generate-menu-sounds.mjs',
    'generate-super-sound.mjs · generate-drive-sound.mjs',
  ] },
  { heading: 'Programación', lines: ['TypeScript · Phaser 3 · Vite', 'Pruebas con Playwright', 'Desarrollo asistido por IA (Claude Code y Codex)'] },
  { heading: 'Gracias por jugar', lines: ['Arica, Chile'] },
];
