import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { playUiSound } from '../config/characters';
import { ensureGlowTexture, ensureRaysTexture, Title3D } from './menu/MenuEffects';
import { FONT_UI } from './fonts';
import { C, CSS, GLASS } from './theme';

const CX = GAME_CONFIG.WIDTH / 2, CY = GAME_CONFIG.HEIGHT / 2;

export interface BannerStyle {
  /** Extrusion colours, far → near. */
  side: [number, number];
  /** Face gradient, top → bottom. */
  face: [number, number];
  /** Band lines, rays and sparks. */
  accent: number;
  fontSize?: number;
  /** Smaller line under the headline. */
  caption?: string;
  /** Turning rays behind the text and a shower of sparks: for moments worth celebrating. */
  celebrate?: boolean;
  /** Red wash and slow falling embers: for a loss. */
  mourn?: boolean;
  /** Camera shake strength when the text lands. */
  shake?: number;
  /** Volume of the landing boom; 0 keeps it silent. */
  volume?: number;
  /** How long it stays before leaving, in ms. */
  hold?: number;
  depth?: number;
}

export const BANNER_STYLES = {
  // Arcade Impact palette (theme.ts): extrusion in ink toward the accent, faces from white.
  round: { side: [C.ink, 0x004f58], face: [C.white, C.tertiary], accent: C.tertiary, fontSize: 104, shake: 0.004, volume: 0.45 },
  fight: { side: [C.ink, 0x8a1c00], face: [0xfff1c2, C.primary], accent: C.primary, fontSize: 150, shake: 0.012, volume: 0.9 },
  ko: { side: [C.ink, 0x930019], face: [C.white, C.secondary], accent: C.secondary, fontSize: 190, shake: 0.016, volume: 1 },
  time: { side: [C.ink, 0x004f58], face: [C.white, C.tertiary], accent: C.tertiary, fontSize: 150, shake: 0.008, volume: 0.7 },
  victory: { side: [C.ink, 0x8a5a00], face: [0xfffbe0, C.gold], accent: C.gold, fontSize: 150, shake: 0.01, volume: 0.9, celebrate: true },
  defeat: { side: [C.ink, 0x930019], face: [0xffdad8, C.secondary], accent: C.secondary, fontSize: 150, shake: 0.006, volume: 0.8, mourn: true },
  draw: { side: [C.ink, 0x5e3f38], face: [C.white, 0xe6e1e5], accent: C.ivory, fontSize: 150, shake: 0.006, volume: 0.6 },
} satisfies Record<string, BannerStyle>;

/**
 * Full-screen announcement for the fight: a band sweeps across, extruded 3D lettering slams in
 * with a shake and a boom, holds, then bursts away. Everything is pinned to the screen and
 * cleans itself up. With reduced motion the text simply appears and fades.
 */
export function showBanner(scene: Phaser.Scene, text: string, style: BannerStyle): void {
  const depth = style.depth ?? 300, hold = style.hold ?? 1100;
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts: { destroy(): void }[] = [];
  const pin = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor>(object: T, layer = 0) => {
    object.setDepth(depth + layer).setScrollFactor(0); parts.push(object); return object;
  };
  const tweens = scene.tweens;

  // A band of ivory glass between hard ink rules, each with an accent line.
  const band = pin(scene.add.rectangle(CX, CY, GAME_CONFIG.WIDTH, style.caption ? 250 : 200, C.ivory, GLASS.fill * 0.8));
  const edges = [-1, 1].flatMap(side => [
    pin(scene.add.rectangle(CX, CY + side * (band.height / 2 + 2), GAME_CONFIG.WIDTH, 4, C.ink, 0.9), 1),
    pin(scene.add.rectangle(CX, CY + side * (band.height / 2 - 3), GAME_CONFIG.WIDTH, 3, style.accent, 0.95), 1),
  ]);
  const wash = style.mourn ? pin(scene.add.rectangle(CX, CY, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x410006, 0.32), -1) : null;
  const rays = style.celebrate ? pin(scene.add.image(CX, CY, ensureRaysTexture(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(style.accent).setScale(1.5).setAlpha(0), 1) : null;

  const title = new Title3D(scene, CX, CY - (style.fontSize ?? 150) * 0.62 - (style.caption ? 26 : 0), [text], depth + 3, {
    fontSize: style.fontSize ?? 150, centered: true, side: style.side, face: style.face, shine: false, fixed: true,
  });
  parts.push(title);
  const line = title.lines[0];
  const caption = style.caption ? pin(scene.add.text(CX, CY + (style.fontSize ?? 150) * 0.36, style.caption, {
    fontFamily: FONT_UI, fontStyle: 'bold', fontSize: '38px', color: CSS.ink, stroke: CSS.ivory, strokeThickness: 5,
  }).setOrigin(0.5), 3) : null;

  const leave = () => {
    const done = () => parts.forEach(part => part.destroy());
    if (!motion) { tweens.add({ targets: [band, ...edges, line, caption, wash, rays].filter(Boolean), alpha: 0, duration: 400, onComplete: done }); return; }
    tweens.add({ targets: line, scale: 1.5, alpha: 0, duration: 300, ease: 'Cubic.easeIn' });
    tweens.add({ targets: [caption, wash, rays].filter(Boolean), alpha: 0, duration: 260 });
    tweens.add({ targets: [band, ...edges], scaleY: 0, alpha: 0, duration: 300, delay: 60, ease: 'Cubic.easeIn', onComplete: done });
  };

  if (!motion) {
    if (style.volume) playUiSound(scene, 'menu-impact', style.volume);
    rays?.setAlpha(0.3);
    scene.time.delayedCall(hold + 300, leave);
    return;
  }

  // Band and accent lines sweep open from the centre line.
  band.setScale(1, 0); edges.forEach(edge => edge.setScale(0, 1));
  tweens.add({ targets: band, scaleY: 1, duration: 160, ease: 'Cubic.easeOut' });
  tweens.add({ targets: edges, scaleX: 1, duration: 260, ease: 'Cubic.easeOut' });
  if (wash) { wash.setAlpha(0); tweens.add({ targets: wash, alpha: 0.38, duration: 500 }); }
  caption?.setAlpha(0);

  line.setScale(3.6).setAlpha(0);
  tweens.add({
    targets: line, scale: 1, alpha: 1, duration: 230, delay: 90, ease: 'Quart.easeIn',
    onComplete: () => {
      if (style.volume) playUiSound(scene, 'menu-impact', style.volume);
      scene.cameras.main.shake(220, style.shake ?? 0.008);
      const flash = pin(scene.add.image(CX, CY, ensureGlowTexture(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(style.accent).setScale(1, 0.3), 2);
      tweens.add({ targets: flash, scaleX: 6, scaleY: 1.2, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
      // After the hit the lettering keeps drifting toward the viewer.
      tweens.add({ targets: line, scale: 1.08, duration: hold + 200, ease: 'Sine.easeOut' });
      if (caption) { caption.setY(caption.y + 24); tweens.add({ targets: caption, alpha: 1, y: caption.y - 24, duration: 320, delay: 120, ease: 'Back.easeOut' }); }
      if (rays) {
        tweens.add({ targets: rays, alpha: 0.42, duration: 300 });
        tweens.add({ targets: rays, angle: 40, duration: hold + 600 });
      }
      sparks(scene, style, pin, hold);
      scene.time.delayedCall(hold, leave);
    },
  });
}

/** Sparks thrown by the landing; a celebration rains gold, a loss lets embers sink. */
function sparks(scene: Phaser.Scene, style: BannerStyle, pin: <T extends Phaser.GameObjects.Rectangle>(object: T, layer?: number) => T, hold: number): void {
  const count = style.celebrate ? 70 : style.mourn ? 30 : 22;
  for (let i = 0; i < count; i++) {
    const color = i % 3 === 0 ? 0xffffff : style.accent;
    if (style.mourn) {
      const ember = pin(scene.add.rectangle(Phaser.Math.Between(40, GAME_CONFIG.WIDTH - 40), Phaser.Math.Between(-60, 200), 4, 4, color, 0.8).setBlendMode(Phaser.BlendModes.ADD), 2);
      scene.tweens.add({ targets: ember, y: ember.y + Phaser.Math.Between(380, 620), x: ember.x + Phaser.Math.Between(-50, 50), alpha: 0,
        duration: Phaser.Math.Between(hold, hold + 1200), delay: Phaser.Math.Between(0, 500) });
      continue;
    }
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2), reach = Phaser.Math.Between(180, style.celebrate ? 620 : 420);
    const spark = pin(scene.add.rectangle(CX + Math.cos(angle) * 60, CY + Math.sin(angle) * 20, Phaser.Math.Between(4, 12), 4, color)
      .setBlendMode(Phaser.BlendModes.ADD).setRotation(angle), 2);
    scene.tweens.add({
      targets: spark, x: CX + Math.cos(angle) * reach, y: CY + Math.sin(angle) * reach * 0.6 + (style.celebrate ? Phaser.Math.Between(60, 260) : 0),
      alpha: 0, angle: spark.angle + Phaser.Math.Between(-200, 200),
      duration: Phaser.Math.Between(500, style.celebrate ? 1500 : 800), delay: style.celebrate ? Phaser.Math.Between(0, 500) : 0, ease: 'Cubic.easeOut',
    });
  }
}
