// ============================================================
// assetBase — Prefix for the absolute /assets/... paths used across the game
// ============================================================

/**
 * Vite's base path without the trailing slash. Empty in development and for builds served from
 * the site root; "/Mugen-Family" for a GitHub Pages project site built with BASE_PATH set.
 * Phaser's loader puts it in front of every relative-to-root asset URL.
 */
export const ASSET_BASE = ((): string => {
  const base = import.meta.env.BASE_URL ?? '/';
  return base === '/' || base === './' ? '' : base.replace(/\/$/, '');
})();
