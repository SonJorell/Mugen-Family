// ============================================================
// theme — "Arcade Impact HUD" tokens with a glass finish
// ============================================================
//
// One place for the interface colours and the glass panel recipe. Phaser draws on a canvas, so
// there is no backdrop-filter: glass is simulated with a translucent ivory fill, a thin light rim
// and a hard 3 px Sumi Ink offset shadow (no blur). Corners are never rounded; panels use 45°
// chamfers and gauges are parallelograms slanted 12°.

import Phaser from 'phaser';

/** Palette as Phaser colour numbers. */
export const C = {
  ivory: 0xfdfbf7,
  ink: 0x121114,
  primary: 0xff3b00,
  secondary: 0xd60029,
  tertiary: 0x00e5ff,
  gold: 0xffb800,
  white: 0xffffff,
  /** Deep tones for 3D lettering extrusions and dark accents. */
  crimsonDeep: 0x5c0a1c,
  primaryDeep: 0x8a1c00,
  secondaryDeep: 0x930019,
  tertiaryDeep: 0x004f58,
  goldDeep: 0x8a5a00,
  /** Warm cream for the top of lettering faces. */
  cream: 0xfff1c2,
} as const;

/** The same palette as CSS strings, for Phaser text styles. */
export const CSS = {
  ivory: '#fdfbf7',
  ink: '#121114',
  primary: '#ff3b00',
  secondary: '#d60029',
  tertiary: '#00e5ff',
  gold: '#ffb800',
  white: '#ffffff',
} as const;

export const GLASS = {
  /** Fill opacity of the ivory glass over the stage. */
  fill: 0.42,
  /** Darker glass for text that must stay readable over bright stages. */
  inkFill: 0.62,
  rim: 0.85,
  shadow: 3,
} as const;

/** Slant of gauges (12°) as a horizontal offset per pixel of height. */
export const SLANT = Math.tan(12 * Math.PI / 180);

export interface GlassOptions {
  /** Fill colour and opacity; defaults to ivory glass. */
  fill?: number;
  alpha?: number;
  /** Rim colour (thin light border). */
  rim?: number;
  rimAlpha?: number;
  /** Size of the 45° chamfers on the top-left and bottom-right corners (0 = square). */
  chamfer?: number;
  /** Horizontal slant of the left/right edges in px (positive leans right, like "/"). */
  skew?: number;
  /** Hard offset shadow in Sumi Ink; 0 turns it off. */
  shadow?: number;
}

/** Corner points of a chamfered, optionally slanted box. */
export function glassPoints(x: number, y: number, w: number, h: number, chamfer = 0, skew = 0): Phaser.Math.Vector2[] {
  const k = Math.min(chamfer, w / 2, h / 2);
  const tl = x + skew, tr = x + w + skew, bl = x, br = x + w;
  return [
    new Phaser.Math.Vector2(tl + k, y), new Phaser.Math.Vector2(tr, y),
    new Phaser.Math.Vector2(br, y + h - k), new Phaser.Math.Vector2(br - k, y + h),
    new Phaser.Math.Vector2(bl, y + h), new Phaser.Math.Vector2(tl, y + k),
  ].filter((p, i, all) => i === 0 || !p.equals(all[i - 1]));
}

/** Draws a glass panel into `g` (which is not cleared). */
export function drawGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: GlassOptions = {}): Phaser.GameObjects.Graphics {
  const pts = glassPoints(x, y, w, h, o.chamfer ?? 0, o.skew ?? 0);
  const shadow = o.shadow ?? GLASS.shadow;
  if (shadow > 0) {
    // Hard offset shadow along the right and bottom edges only: filling the whole shifted shape
    // would show through the translucent glass and turn it grey.
    const right = pts.reduce((m, p) => Math.max(m, p.x), -Infinity), bottom = pts.reduce((m, p) => Math.max(m, p.y), -Infinity);
    g.lineStyle(shadow, C.ink, 0.9);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      // Edges facing down or right: the right side, the bottom chamfer and the bottom.
      const facing = (b.y - a.y) * 1 + (a.x - b.x) * 1 > 0 || (a.y === bottom && b.y === bottom) || (a.x === right && b.x === right);
      if (facing) g.lineBetween(a.x + shadow / 2, a.y + shadow / 2, b.x + shadow / 2, b.y + shadow / 2);
    }
  }
  g.fillStyle(o.fill ?? C.ivory, o.alpha ?? GLASS.fill).fillPoints(pts, true);
  // A brighter sheen along the top edge sells the glass.
  g.lineStyle(1, C.white, 0.5).lineBetween(pts[0].x, pts[0].y + 1, pts[1].x, pts[1].y + 1);
  g.lineStyle(1.5, o.rim ?? C.ivory, o.rimAlpha ?? GLASS.rim).strokePoints(pts, true);
  return g;
}

/** A parallelogram fill (gauges), slanted by SLANT; `fromRight` grows it from the right edge. */
export function fillSlanted(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1, flip = false): void {
  if (w <= 0) return;
  const s = h * SLANT;
  const pts = flip
    ? [[x, y], [x + w, y], [x + w - s, y + h], [x - s, y + h]]
    : [[x + s, y], [x + w + s, y], [x + w, y + h], [x, y + h]];
  g.fillStyle(color, alpha).fillPoints(pts.map(([px, py]) => new Phaser.Math.Vector2(px, py)), true);
}

/** Darker accents for small text on ivory glass (the bright tokens are too light to read there). */
export const TERTIARY_INK = '#006672';
export const MUTED_INK = '#5e3f38';

/** Text chips (buttons, labels): ink on ivory glass. Phaser text cannot draw a border, so the glass does the work. */
export const CHIP = { color: CSS.ink, backgroundColor: 'rgba(253, 251, 247, 0.78)' } as const;
/** Focused / call-to-action chip: inverted ink fill with ivory text. */
export const CHIP_ACTIVE = { color: CSS.ivory, backgroundColor: 'rgba(18, 17, 20, 0.86)' } as const;
/** Accent chip for the main action on screen (pause, continue). */
export const CHIP_PRIMARY = { color: CSS.white, backgroundColor: CSS.primary } as const;

/** Standard text strokes on glass: ink outline for light text, none for ink text. */
export const TEXT_ON_GLASS = { color: CSS.ink } as const;
export const TEXT_ON_STAGE = { color: CSS.ivory, stroke: CSS.ink, strokeThickness: 4 } as const;
