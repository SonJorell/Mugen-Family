// ============================================================
// AssetUtils — Helpers for building asset manifests
// ============================================================

import { GAME_CONFIG } from '../config/gameConfig';

export interface AnimationFileManifest {
  animName: string;
  urls: string[];
}

/**
 * Build the list of known image URLs for a character animation,
 * given the basePath and animation folder name.
 *
 * This uses the character manifest JSON file served from public/assets/
 */
export function buildAnimationManifest(
  _basePath: string,
  _characterId: string,
): AnimationFileManifest[] {
  const manifests: AnimationFileManifest[] = [];

  for (const animName of GAME_CONFIG.ANIMATION_NAMES) {
    manifests.push({
      animName,
      urls: [], // Populated dynamically during preload using manifest JSON
    });
  }

  return manifests;
}

/**
 * Sort filenames numerically by their trailing number.
 * e.g. ["IDLE_1.jpg", "IDLE_10.jpg", "IDLE_2.jpg"] → ["IDLE_1.jpg", "IDLE_2.jpg", "IDLE_10.jpg"]
 */
export function sortFilesNumerically(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const numA = extractTrailingNumber(a);
    const numB = extractTrailingNumber(b);
    return numA - numB;
  });
}

function extractTrailingNumber(filename: string): number {
  const match = filename.match(/_(\d+)\.\w+$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Build all image URLs for a given animation folder, given a manifest list of files.
 */
export function buildImageUrls(basePath: string, animName: string, fileNames: string[]): string[] {
  const sorted = sortFilesNumerically(fileNames);
  return sorted.map(f => `${basePath}${animName}/${f}`);
}
