// ============================================================
// characters — Acceso genérico a manifiestos y texturas por luchador
// ============================================================

import Phaser from 'phaser';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader, SpriteSheetOptions } from '../animation/SpriteSheetLoader';
import { FIGHTER_ROSTER, rosterEntry } from './roster';

export interface CharacterManifest {
  characterId: string;
  name: string;
  assetPath: string;
  animations: Record<string, string[]>;
  spriteSheet?: SpriteSheetOptions;
}

export const manifestKey = (characterId: string) => `${characterId}_manifest`;
export const superPortraitKey = (characterId: string) => `${characterId}_super_portrait`;
/** Textura de la ilustración de portada de un luchador. */
export const menuArtKey = (characterId: string) => `menu_${characterId}_3d`;
/** Efectos de interfaz (portada y selección). */
export const UI_SOUNDS = ['menu-impact', 'menu-whoosh', 'menu-move'] as const;
export type UiSound = typeof UI_SOUNDS[number];

/**
 * Reproduce un efecto de interfaz. Se omite mientras el navegador mantiene el audio bloqueado
 * (antes del primer clic o tecla), para que no suene con retraso al desbloquearse.
 */
export function playUiSound(scene: Phaser.Scene, key: UiSound, volume = 0.6): void {
  if (scene.sound.locked || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume });
}

/** Valida la forma mínima de un manifiesto cargado. */
export function isValidManifest(manifest: unknown): manifest is CharacterManifest {
  const m = manifest as CharacterManifest | undefined;
  return !!m && typeof m.characterId === 'string' && typeof m.assetPath === 'string' && !!m.animations &&
    Array.isArray(m.animations.IDLE) && m.animations.IDLE.length > 0 &&
    Object.values(m.animations).every(files => Array.isArray(files) && files.every(f => typeof f === 'string'));
}

/** Manifiesto del luchador desde la caché; si no existe, el del primer personaje del plantel. */
export function getManifest(scene: Phaser.Scene, characterId: string): CharacterManifest {
  const id = rosterEntry(characterId).id;
  return (scene.cache.json.get(manifestKey(id)) ?? scene.cache.json.get(manifestKey(FIGHTER_ROSTER[0].id))) as CharacterManifest;
}

/** Ordena los archivos de una animación por su sufijo numérico (_1, _2, …). */
export function sortAnimationFiles(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const na = parseInt(a.match(/_(\d+)\./)?.[1] ?? '0', 10);
    const nb = parseInt(b.match(/_(\d+)\./)?.[1] ?? '0', 10);
    return na - nb;
  });
}

/** URLs absolutas de las imágenes de una animación. */
export function animationUrls(manifest: CharacterManifest, animName: string): string[] {
  return sortAnimationFiles(manifest.animations[animName] ?? [])
    .map(f => f.startsWith('/') ? f : `${manifest.assetPath}${animName}/${f}`);
}

/**
 * Procesa (una sola vez por partida del navegador) las texturas de un luchador y
 * registra todas sus animaciones con el prefijo de su id.
 */
export function createCharacterLoader(scene: Phaser.Scene, manifest: CharacterManifest, registry = new AnimationRegistry()) {
  const loader = new SpriteSheetLoader(scene, registry, manifest.characterId, manifest.assetPath, null, manifest.spriteSheet);
  for (const animName of Object.keys(manifest.animations)) {
    loader.loadAnimationFromUrls(animName, animationUrls(manifest, animName));
  }
  return { registry, loader };
}

/**
 * Crea un alias de un luchador ya procesado (por ejemplo, el rival cuando ambos
 * eligen al mismo personaje). Reutiliza las texturas sin volver a recortarlas.
 */
export function createAliasLoader(scene: Phaser.Scene, aliasId: string, manifest: CharacterManifest) {
  const registry = new AnimationRegistry();
  const loader = new SpriteSheetLoader(scene, registry, aliasId, manifest.assetPath, manifest.characterId, manifest.spriteSheet);
  for (const [animName, files] of Object.entries(manifest.animations)) {
    loader.loadAnimationFromUrls(animName, files ?? []);
  }
  return { registry, loader };
}
