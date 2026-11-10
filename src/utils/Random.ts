// ============================================================
// Random — Small seedable generator (mulberry32)
// ============================================================

/** Returns a function giving floats in [0, 1). The same seed always yields the same series. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded generator when a seed is given (tests), otherwise Math.random. */
export function makeRandom(seed?: number): () => number {
  return typeof seed === 'number' && Number.isFinite(seed) ? seededRandom(seed) : Math.random;
}
