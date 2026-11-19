// ============================================================
// assetBase — Prefix for the absolute /assets/... paths used across the game
// ============================================================

/**
 * Prefix placed in front of the root-relative `/assets/...` paths used across the game.
 * - Development (`/`): empty string so requests go to `/assets/...`.
 * - Explicit BASE_PATH (e.g. `/Mugen-Family/` on GitHub Pages): `/Mugen-Family`.
 * - Relative build (`./`, e.g. itch.io HTML5 ZIPs hosted at `/html/<id>/index.html`):
 *   derives the current directory pathname from `window.location.href` so `/assets/...`
 *   resolves next to `index.html` regardless of the host subpath.
 */
export const ASSET_BASE = ((): string => {
  const base = import.meta.env.BASE_URL ?? '/';
  if (base === './' && typeof window !== 'undefined') {
    return new URL('.', window.location.href).pathname.replace(/\/$/, '');
  }
  return base === '/' || base === './' ? '' : base.replace(/\/$/, '');
})();
