// ============================================================
// CharacterDefinition — Blueprint for a fighter character
// ============================================================

export interface AnimationConfig {
  /** Sub-folder name, e.g. "IDLE" */
  folder: string;
  /** Ordered list of image URLs (each containing 3 frames) */
  files: string[];
}

export interface CharacterDefinition {
  id: string;
  name: string;
  /** Base public path to character assets */
  assetPath: string;
  /** Map of animation name → config */
  animations: Record<string, AnimationConfig>;
  /** Scale multiplier */
  scale: number;
  /** Max health points */
  maxHealth: number;
}

/** Build a CharacterDefinition automatically from known animations */
export function buildCharacterDefinition(
  id: string,
  name: string,
  assetPath: string,
  animationFolders: string[],
  scale: number = 1.8,
  maxHealth: number = 100,
): CharacterDefinition {
  const animations: Record<string, AnimationConfig> = {};

  for (const folder of animationFolders) {
    animations[folder] = {
      folder,
      files: [], // Populated dynamically in PreloadScene
    };
  }

  return { id, name, assetPath, animations, scale, maxHealth };
}
