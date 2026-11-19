// Minimal types for the parts of pixelfx's core that the game uses (src/systems/HitEffects.ts).
export interface FxFrame { w: number; h: number; ox: number; oy: number; color: Uint32Array; light: Uint32Array }
export interface FxMeta { name: string; size?: [number, number]; origin?: [number, number]; duration?: number; loop?: boolean; options?: Record<string, unknown> }
export interface FxModule { meta: FxMeta; create(options: Record<string, unknown>): unknown }
export interface FxInstance {
  readonly meta: FxMeta;
  readonly t: number;
  update(dt: number): void;
  draw(frame: FxFrame, layer?: 'back' | 'front'): void;
  stop(): void;
  done(): boolean;
}
export function createFrame(w: number, h: number, ox?: number, oy?: number): FxFrame;
export function clearFrame(frame: FxFrame): FxFrame;
export function createFx(mod: FxModule, options?: Record<string, unknown>): FxInstance;
export function composite(frame: FxFrame, out: Uint8ClampedArray, bg?: null | number | Uint32Array, lightK?: number): Uint8ClampedArray;
