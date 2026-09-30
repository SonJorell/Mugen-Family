// ============================================================
// AnimationRegistry — Stores and retrieves animation definitions
// ============================================================

import { AnimationDefinition } from './AnimationDefinition';

export class AnimationRegistry {
  private animations: Map<string, AnimationDefinition> = new Map();

  register(def: AnimationDefinition): void {
    this.animations.set(def.name, def);
    if (!def.available) {
      console.warn(`[AnimationRegistry] Animation "${def.name}" registered but not available (missing assets).`);
    }
  }

  get(name: string): AnimationDefinition | undefined {
    return this.animations.get(name);
  }

  has(name: string): boolean {
    const def = this.animations.get(name);
    return !!def && def.available;
  }

  getAvailable(): string[] {
    return Array.from(this.animations.values())
      .filter(d => d.available)
      .map(d => d.name);
  }

  getAll(): AnimationDefinition[] {
    return Array.from(this.animations.values());
  }

  /** Returns 'IDLE' as fallback if requested animation is unavailable */
  getFallback(name: string): AnimationDefinition | undefined {
    if (this.has(name)) return this.get(name);
    console.warn(`[AnimationRegistry] Animation "${name}" not available — falling back to IDLE.`);
    return this.get('IDLE');
  }
}
