// ============================================================
// HealthBar — Slanted glass health gauge with damage trail, hit feedback and danger pulse
// ============================================================
//
// "Arcade Impact" look (theme.ts): the bar sits on an ivory glass plate with a hard ink shadow,
// is a parallelogram slanted 12° and has a 3 px ink outline. Health shines Electric Orange,
// turning Gold above 75%; health just lost waits in Crimson before the trail catches up; under
// 25% the bar throbs with a Neon Cyan flash.

import Phaser from 'phaser';
import { FONT_NAME, FONT_NUMBER } from './fonts';
import { C, CSS, SLANT, drawGlass, fillSlanted } from './theme';

const H = 24;
/** How long the crimson trail waits before it starts catching up with the real health. */
const TRAIL_DELAY = 420;

export class HealthBar {
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  /** Remaining health (redrawn every frame). */
  private readonly bar: Phaser.GameObjects.Graphics;
  /** Health just lost, in crimson. */
  private readonly trail: Phaser.GameObjects.Graphics;
  /** White flash over the bar when a hit lands. */
  private readonly flash: Phaser.GameObjects.Graphics;
  /** Cyan throb under a quarter of health. */
  private readonly danger: Phaser.GameObjects.Graphics;
  /** Ink outline, crimson while in danger. */
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;

  private currentHealth = -1;
  /** Real health as a share of the maximum. */
  private ratio = 0;
  /** Share currently drawn: it climbs when the round opens and drops at once on a hit. */
  private shown = 0;
  private trailRatio = 0;
  private trailWait = 0;
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number, private readonly y: number,
    private readonly width: number,
    private readonly maxHealth: number,
    name: string,
    private readonly flipped = false,
    private readonly accent: number = C.primary,
  ) {
    const add = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor>(object: T, depth: number) => {
      object.setDepth(depth).setScrollFactor(0); this.parts.push(object); return object;
    };
    // Glass plate behind name and bar, chamfered on the outer top and inner bottom corners.
    add(drawGlass(scene.add.graphics(), x - 14, y - 34, width + 28, H + 46, { chamfer: 12, skew: flipped ? -8 : 8 }), 49);
    // Accent flag on the outer edge of the plate (player colour).
    const flag = add(scene.add.graphics(), 49);
    fillSlanted(flag, flipped ? x + width + 6 : x - 14, y - 34, 8, H + 46, accent, 1, flipped);
    // Track: the empty gauge in ink.
    const track = add(scene.add.graphics(), 50);
    fillSlanted(track, x, y, width, H, C.ink, 0.88, flipped);
    this.trail = add(scene.add.graphics(), 51);
    this.bar = add(scene.add.graphics(), 52);
    this.danger = add(scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0), 53);
    this.flash = add(scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0), 54);
    // Notches every tenth make the remaining health readable at a glance.
    const notches = add(scene.add.graphics(), 54).lineStyle(2, C.ink, 0.45);
    const s = H * SLANT;
    for (let i = 1; i < 10; i++) {
      const nx = x + width * i / 10;
      if (flipped) notches.lineBetween(nx, y, nx - s, y + H); else notches.lineBetween(nx + s, y, nx, y + H);
    }
    this.frame = add(scene.add.graphics(), 55);

    this.nameText = add(scene.add.text(flipped ? x + width : x, y - 31, name.toUpperCase(), {
      fontFamily: FONT_NAME, fontSize: '26px', color: CSS.ink, stroke: CSS.ivory, strokeThickness: 3,
    }).setOrigin(flipped ? 1 : 0, 0), 56);
    this.valueText = add(scene.add.text(flipped ? x + 10 : x + width - 4, y + H / 2, '', {
      fontFamily: FONT_NUMBER, fontSize: '17px', color: CSS.ivory, stroke: CSS.ink, strokeThickness: 4,
    }).setOrigin(flipped ? 0 : 1, 0.5), 56);
    this.setHealth(maxHealth);
    this.layout();
  }

  setHealth(value: number): void {
    const next = Phaser.Math.Clamp(value, 0, this.maxHealth);
    if (this.currentHealth === next) return;
    const lost = this.currentHealth >= 0 && next < this.currentHealth;
    this.currentHealth = next;
    this.ratio = next / this.maxHealth;
    this.valueText.setText(String(Math.ceil(next)));
    if (lost) this.hit();
  }

  /** Advances the animated parts; call once per frame with the frame time in ms. */
  update(dt: number): void {
    this.clock += dt;
    // Filling eases in (round start); damage shows immediately so the bar never lies.
    this.shown = this.ratio < this.shown ? this.ratio : Math.min(this.ratio, this.shown + dt / 650);
    if (this.trailRatio <= this.shown) this.trailRatio = this.shown;
    else if (this.trailWait > 0) this.trailWait -= dt;
    else this.trailRatio = Math.max(this.shown, this.trailRatio - dt / 1400);
    this.layout();
  }

  private hit(): void {
    this.trailWait = TRAIL_DELAY;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tweens = this.scene.tweens;
    this.flash.setAlpha(0.85);
    tweens.add({ targets: this.flash, alpha: 0, duration: 260, ease: 'Cubic.easeOut' });
    tweens.killTweensOf(this.nameText);
    this.nameText.setY(this.y - 31);
    tweens.add({ targets: this.nameText, y: this.y - 27, duration: 45, yoyo: true, repeat: 2 });
    // Sparks fly off the edge the bar just lost.
    const edge = this.flipped ? this.x + this.width * (1 - this.ratio) : this.x + this.width * this.ratio;
    for (let i = 0; i < 7; i++) {
      const spark = this.scene.add.rectangle(edge, this.y + Phaser.Math.Between(2, H - 2), Phaser.Math.Between(3, 7), 3, i % 2 ? C.gold : C.primary)
        .setDepth(57).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setAngle(Phaser.Math.Between(0, 180));
      tweens.add({
        targets: spark, x: edge + Phaser.Math.Between(-70, 70), y: spark.y + Phaser.Math.Between(18, 70), alpha: 0, angle: spark.angle + 200,
        duration: Phaser.Math.Between(300, 520), ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
      });
    }
  }

  /** Fills a share of the gauge from its outer edge. */
  private fill(g: Phaser.GameObjects.Graphics, share: number, color: number, alpha = 1): void {
    g.clear();
    const w = Math.floor(this.width * share);
    fillSlanted(g, this.flipped ? this.x + this.width - w : this.x, this.y, w, H, color, alpha, this.flipped);
  }

  private layout(): void {
    const r = this.shown;
    const low = this.ratio > 0 && this.ratio <= 0.25;
    this.fill(this.trail, this.trailRatio, C.secondary);
    this.fill(this.bar, r, low ? C.secondary : r > 0.75 ? C.gold : C.primary);
    // A thin sheen on the top quarter of the fill.
    const w = Math.floor(this.width * r);
    if (w > 0) fillSlanted(this.bar, this.flipped ? this.x + this.width - w : this.x, this.y + 2, w, 5, C.white, 0.28, this.flipped);
    this.fill(this.flash, r, C.white);
    this.fill(this.danger, r, C.tertiary);

    // Under a quarter of health the bar flashes cyan and the outline turns crimson.
    const throb = low ? 0.5 + Math.sin(this.clock / 110) * 0.5 : 0;
    this.danger.setAlpha(throb * 0.55);
    const s = H * SLANT, x = this.x, y = this.y, wd = this.width;
    const pts = this.flipped
      ? [[x, y], [x + wd, y], [x + wd - s, y + H], [x - s, y + H]]
      : [[x + s, y], [x + wd + s, y], [x + wd, y + H], [x, y + H]];
    this.frame.clear().lineStyle(3, low && throb > 0.5 ? C.secondary : C.ink, 1)
      .strokePoints(pts.map(([px, py]) => new Phaser.Math.Vector2(px, py)), true);
    this.valueText.setColor(low ? '#ffdad6' : CSS.ivory);
  }

  destroy(): void { this.parts.forEach(part => part.destroy()); }
}
