// ============================================================
// HitEffects — pixel-art hit sparks from pixelfx (prototype)
// ============================================================
//
// Each burst simulates in its own low-resolution pixelfx frame placed in world space, is composited
// to RGBA and uploaded into a small Phaser CanvasTexture, then shown at an integer scale (GAME_CONFIG.HIT_EFFECT_SCALE) so
// its pixels stay crisp next to the fighters. Textures are only redrawn while a burst is alive.
//
// pixelfx keeps two buffers: opaque color and additive light. Its composite() turns light over a
// transparent background into a translucent color, so faint glow darkens the stage behind it. Here
// the color goes into one texture drawn normally and the light into a second one drawn with ADD.

import Phaser from 'phaser';
import { createFrame, clearFrame, createFx, composite, FxFrame, FxInstance, FxModule } from '../vendor/pixelfx/core/index.js';
import * as hitSpark from '../vendor/pixelfx/fx/impacts/hit-spark.js';
import * as critHit from '../vendor/pixelfx/fx/impacts/crit-hit.js';
import * as shieldBlock from '../vendor/pixelfx/fx/impacts/shield-block.js';
import * as parry from '../vendor/pixelfx/fx/impacts/parry.js';
import { GAME_CONFIG } from '../config/gameConfig';
import type { ImpactKind } from '../ui/ImpactEffects';

/** Where shield-block's dome takes the blow, in its local pixels (see HIT in shield-block.js). */
/**
 * How a block looks: 'parry' (a clash star in guard blue at the contact point) or 'shield'
 * (pixelfx's energy dome). The dome sits over the defender's body and reads as a glass panel
 * next to these sprites, so parry is the default.
 */
const BLOCK_STYLE: 'parry' | 'shield' = 'parry';
/** Guard blue for the parry burst, dark to white. */
const BLOCK_PALETTE = ['#0b1830', '#123a6a', '#1f6fb0', '#3fa8e8', '#7fd6ff', '#cdf2ff', '#ffffff'];
const SHIELD_HIT = { x: 3 + 28 * Math.cos(0.5) * Math.sin(1.18), y: -44 * Math.sin(0.5) };

interface Layer {
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  pixels: ImageData;
}

interface LiveBurst {
  fx: FxInstance;
  frame: FxFrame;
  /** The frame with an empty light buffer, so composite() writes the color layer alone. */
  colorOnly: FxFrame;
  color: Layer;
  light: Layer;
}

let serial = 0;
/** Screen pixels per pixelfx pixel (an integer, so the pixels stay square). */
const SCALE = () => Math.max(1, Math.round(GAME_CONFIG.HIT_EFFECT_SCALE));

/** Same surface as ImpactEffects (spawn / count / destroy) plus update(), which must run every frame. */
export class HitEffects {
  private live: LiveBurst[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get count(): number { return this.live.length; }

  /**
   * (x, y): contact point in world pixels. defenderFacingRight tells the blow's direction: a defender
   * facing right was hit from the right, so the blow travels left.
   */
  spawn(x: number, y: number, kind: ImpactKind, defenderFacingRight: boolean, _lowBlock = false): void {
    const floor = Math.round(GAME_CONFIG.FLOOR_Y / SCALE());
    const lx = Math.round(x / SCALE()), ly = Math.round(y / SCALE());
    const blowLeft = defenderFacingRight;
    const seed = (serial * 7919 + 13) % 1000;
    let mod: FxModule, ox: number, oy: number, flip: boolean;
    const options: Record<string, unknown> = { seed };
    let frame: FxFrame;
    if (kind === 'block' && BLOCK_STYLE === 'shield') {
      // The dome opens toward the attacker: place it so the spot where it takes the blow is the contact point.
      mod = shieldBlock as FxModule;
      flip = !defenderFacingRight;
      ox = Math.round(lx - SHIELD_HIT.x * (flip ? -1 : 1));
      oy = Math.round(ly - SHIELD_HIT.y);
      frame = createFrame(150, 120, ox - 75, oy - 92);
    } else {
      // Sparks start at the contact point and their chips fall to the stage floor.
      mod = (kind === 'heavy' ? critHit : kind === 'block' ? parry : hitSpark) as FxModule;
      if (kind === 'block') options.palette = BLOCK_PALETTE;
      flip = blowLeft;
      ox = lx; oy = Math.max(ly, floor);
      options.height = oy - ly;
      const [w, h] = mod.meta.size ?? [136, 80];
      const top = ly - h, bottom = oy + 6;
      frame = createFrame(w * 2, bottom - top, ox - w, top);
    }
    const fx = createFx(mod, { ...options, x: ox, y: oy, flip, light: GAME_CONFIG.HIT_EFFECT_GLOW });
    const id = serial++;
    const color = this.layer(`pixelfx-${id}`, frame, `impact-${kind}`);
    const light = this.layer(`pixelfx-${id}-light`, frame, `impact-${kind}-light`);
    light.image.setBlendMode(Phaser.BlendModes.ADD).setDepth(41);
    const burst = { fx, frame, colorOnly: { ...frame, light: new Uint32Array(frame.w * frame.h) }, color, light };
    this.live.push(burst);
    this.render(burst);
  }

  private layer(key: string, frame: FxFrame, name: string): Layer {
    const texture = this.scene.textures.createCanvas(key, frame.w, frame.h)!;
    // Crisp pixels even when the game renders with smoothing (pixelArt: false).
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const pixels = texture.context.createImageData(frame.w, frame.h);
    const image = this.scene.add.image(frame.ox * SCALE(), frame.oy * SCALE(), key)
      .setOrigin(0, 0).setScale(SCALE()).setDepth(40).setName(name);
    return { key, texture, image, pixels };
  }

  /** Advances every burst; keeps running during hitstop so the sparks play while the fighters freeze. */
  update(deltaMs: number): void {
    if (this.live.length === 0) return;
    const dt = deltaMs / 1000;
    for (const burst of [...this.live]) {
      burst.fx.update(dt);
      if (burst.fx.done()) this.remove(burst);
      else this.render(burst);
    }
  }

  private render(burst: LiveBurst): void {
    clearFrame(burst.frame);
    burst.fx.draw(burst.frame);
    composite(burst.colorOnly, burst.color.pixels.data, null);
    const L = burst.frame.light, out = burst.light.pixels.data;
    for (let i = 0, j = 0; i < L.length; i++, j += 4) {
      const l = L[i];
      out[j] = l & 255; out[j + 1] = (l >>> 8) & 255; out[j + 2] = (l >>> 16) & 255; out[j + 3] = l ? 255 : 0;
    }
    for (const layer of [burst.color, burst.light]) {
      layer.texture.context.putImageData(layer.pixels, 0, 0);
      layer.texture.refresh();
    }
  }

  private remove(burst: LiveBurst): void {
    this.live = this.live.filter(item => item !== burst);
    for (const layer of [burst.color, burst.light]) {
      layer.image.destroy();
      this.scene.textures.remove(layer.key);
    }
  }

  destroy(): void {
    [...this.live].forEach(burst => this.remove(burst));
  }
}
