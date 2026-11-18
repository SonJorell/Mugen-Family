// ============================================================
// fonts — The game's typefaces, bundled in public/assets/fonts
// ============================================================
//
// Roles ("Arcade Impact HUD"):
//   UI      Chivo for menus, data and interface text.
//   NAME    Bebas Neue for fighter names and headings.
//   NUMBER  Anton for the clock, health values, combo counter and button callouts.
//   IMPACT  Edo SZ, a brush face, for the big announcements (ROUND, ¡PELEA!, K.O., victory) and titles.
//           Jorell picked it; the design system suggests Bebas Neue (FONT_NAME) as the alternative.
//
// Licences: Chivo, Bebas Neue, Rajdhani, Teko, Anton and Black Ops One are SIL OFL (see the OFL-*.txt files). Edo SZ
// (Vic Fieger) is freeware with no written redistribution terms: settle its licence before the game
// is published. Black Ops One stays in the folder as the open replacement: add its face below and
// put it first in FONT_IMPACT to switch.
//
// Phaser draws text on a canvas, so a face must be loaded before the first text that uses it is
// created; BootScene waits for `loadGameFonts()` before the game goes on.

export const FONT_UI = "Chivo, 'Trebuchet MS', sans-serif";
export const FONT_NAME = "'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
export const FONT_NUMBER = "Anton, Impact, 'Arial Black', sans-serif";
export const FONT_IMPACT = "'Edo SZ', Impact, 'Arial Black', sans-serif";

const FACES: { family: string; file: string; weight: string }[] = [
  // Rajdhani's Regular is thin on a busy background; Medium stands in as the normal weight.
  { family: 'Rajdhani', file: 'Rajdhani-Medium.ttf', weight: '400' },
  { family: 'Rajdhani', file: 'Rajdhani-Bold.ttf', weight: '700' },
  { family: 'Teko', file: 'Teko[wght].ttf', weight: '300 700' },
  { family: 'Chivo', file: 'Chivo[wght].ttf', weight: '100 900' },
  { family: 'Bebas Neue', file: 'BebasNeue-Regular.ttf', weight: '400' },
  { family: 'Anton', file: 'Anton-Regular.ttf', weight: '400' },
  { family: 'Edo SZ', file: 'edosz.ttf', weight: '400' },
];

let loading: Promise<void> | null = null;

/** Registers and loads every bundled face. Never rejects: a face that fails falls back to the system font. */
export function loadGameFonts(): Promise<void> {
  if (loading) return loading;
  const base = `${import.meta.env.BASE_URL}assets/fonts/`;
  loading = Promise.all(FACES.map(async ({ family, file, weight }) => {
    try {
      const face = new FontFace(family, `url("${base}${encodeURIComponent(file)}")`, { weight });
      document.fonts.add(await face.load());
    } catch (error) {
      console.warn(`No se pudo cargar la fuente ${family} (${file})`, error);
    }
  })).then(() => undefined);
  return loading;
}
