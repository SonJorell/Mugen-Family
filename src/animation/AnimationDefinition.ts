// ============================================================
// AnimationDefinition — Data model for a single animation
// ============================================================

export interface AnimationDefinition {
  /** Internal name matching folder/animation key (e.g. "IDLE") */
  name: string;
  /** Ordered list of texture frame keys */
  frames: string[];
  /** Frames per second */
  frameRate: number;
  /** -1 = loop forever, 0 = play once */
  repeat: number;
  /** Whether this animation is available (assets loaded) */
  available: boolean;
}
