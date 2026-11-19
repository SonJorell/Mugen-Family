// ============================================================
// fonts — The game's typefaces, bundled in public/assets/fonts
// ============================================================
//
// Three roles:
//   UI      Rajdhani for menus and interface text; Teko for fighter names over the health bars.
//   NUMBER  Anton for the clock, health values and the combo counter.
//   IMPACT  Black Ops One, an arcade display face, for big announcements (ROUND, ¡PELEA!, K.O., victory) and titles.
//
// Licences: Rajdhani, Teko, Anton and Black Ops One are all SIL OFL (see the OFL-*.txt files).
//
// Phaser draws text on a canvas, so a face must be loaded before the first text that uses it is
// created; BootScene waits for `loadGameFonts()` before the game goes on.

export const FONT_UI = "Rajdhani, 'Trebuchet MS', sans-serif";
export const FONT_NAME = "Teko, Impact, 'Arial Narrow', sans-serif";
export const FONT_NUMBER = "Anton, Impact, 'Arial Black', sans-serif";
export const FONT_IMPACT = "'Black Ops One', Impact, 'Arial Black', sans-serif";

const FACES: { family: string; file: string; weight: string }[] = [
  // Rajdhani's Regular is thin on a busy background; Medium stands in as the normal weight.
  { family: 'Rajdhani', file: 'Rajdhani-Medium.ttf', weight: '400' },
  { family: 'Rajdhani', file: 'Rajdhani-Bold.ttf', weight: '700' },
  { family: 'Teko', file: 'Teko[wght].ttf', weight: '300 700' },
  { family: 'Anton', file: 'Anton-Regular.ttf', weight: '400' },
  { family: 'Black Ops One', file: 'BlackOpsOne-Regular.ttf', weight: '400' },
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
