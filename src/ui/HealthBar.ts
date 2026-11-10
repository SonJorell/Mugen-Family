// ============================================================
// HealthBar — Arcade health bar with damage trail, hit feedback and danger pulse
// ============================================================

import Phaser from 'phaser';

const H = 24;
/** How long the pale trail waits before it starts catching up with the real health. */
const TRAIL_DELAY = 420;

export class HealthBar {
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private readonly bar: Phaser.GameObjects.Rectangle;
  private readonly trail: Phaser.GameObjects.Rectangle;
  private readonly gloss: Phaser.GameObjects.Rectangle;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly danger: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Rectangle;
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
    private readonly accent = 0xef709d,
  ) {
    const add = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor>(object: T, depth: number) => {
      object.setDepth(depth).setScrollFactor(0); this.parts.push(object); return object;
    };
    this.frame = add(scene.add.rectangle(x - 4, y - 4, width + 8, H + 8, 0x07090f).setOrigin(0, 0).setStrokeStyle(2, accent, 0.9), 50);
    add(scene.add.rectangle(x, y, width, H, 0x35101a).setOrigin(0, 0), 50);
    this.trail = add(scene.add.rectangle(x, y, width, H, 0xffe6b0).setOrigin(0, 0), 51);
    this.bar = add(scene.add.rectangle(x, y, width, H, 0x00dd44).setOrigin(0, 0), 52);
    this.gloss = add(scene.add.rectangle(x, y + 2, width, 8, 0xffffff, 0.2).setOrigin(0, 0), 53);
    this.danger = add(scene.add.rectangle(x, y, width, H, 0xff2a2a, 0).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD), 53);
    this.flash = add(scene.add.rectangle(x, y, width, H, 0xffffff, 0).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD), 54);
    // Notches every tenth make the remaining health readable at a glance.
    const notches = add(scene.add.graphics(), 54).lineStyle(2, 0x07090f, 0.45);
    for (let i = 1; i < 10; i++) notches.lineBetween(x + width * i / 10, y, x + width * i / 10, y + H);

    this.nameText = add(scene.add.text(flipped ? x + width : x, y - 25, name.toUpperCase(), {
      fontFamily: 'Impact, Arial Black', fontSize: '19px', color: '#fff3d8', stroke: '#07090f', strokeThickness: 4,
    }).setOrigin(flipped ? 1 : 0, 0), 55);
    this.valueText = add(scene.add.text(flipped ? x + 8 : x + width - 8, y + H / 2, '', {
      fontFamily: 'Impact, Arial Black', fontSize: '17px', color: '#ffffff', stroke: '#07090f', strokeThickness: 4,
    }).setOrigin(flipped ? 0 : 1, 0.5), 55);
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
    this.nameText.setY(this.y - 25);
    tweens.add({ targets: this.nameText, y: this.y - 21, duration: 45, yoyo: true, repeat: 2 });
    // Sparks fly off the edge the bar just lost.
    const edge = this.flipped ? this.x + this.width * (1 - this.ratio) : this.x + this.width * this.ratio;
    for (let i = 0; i < 7; i++) {
      const spark = this.scene.add.rectangle(edge, this.y + Phaser.Math.Between(2, H - 2), Phaser.Math.Between(3, 7), 3, i % 2 ? 0xffe6b0 : 0xff8a4c)
        .setDepth(56).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setAngle(Phaser.Math.Between(0, 180));
      tweens.add({
        targets: spark, x: edge + Phaser.Math.Between(-70, 70), y: spark.y + Phaser.Math.Between(18, 70), alpha: 0, angle: spark.angle + 200,
        duration: Phaser.Math.Between(300, 520), ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
      });
    }
  }

  private layout(): void {
    const barW = Math.floor(this.width * this.shown), trailW = Math.floor(this.width * this.trailRatio);
    const left = (w: number) => this.flipped ? this.x + this.width - w : this.x;
    this.bar.setPosition(left(barW), this.y).setSize(barW, H);
    this.gloss.setPosition(left(barW), this.y + 2).setSize(barW, 8);
    this.flash.setPosition(left(barW), this.y).setSize(barW, H);
    this.danger.setPosition(left(barW), this.y).setSize(barW, H);
    this.trail.setPosition(left(trailW), this.y).setSize(trailW, H);

    // Colour shift: green → yellow → red.
    const r = this.shown;
    const from = r > 0.5 ? new Phaser.Display.Color(220, 220, 0) : new Phaser.Display.Color(200, 0, 0);
    const to = r > 0.5 ? new Phaser.Display.Color(0, 221, 68) : new Phaser.Display.Color(220, 220, 0);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.floor((r > 0.5 ? (r - 0.5) * 2 : r * 2) * 100));
    this.bar.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));

    // Under a quarter of health the bar and its frame throb.
    const low = this.ratio > 0 && this.ratio <= 0.25;
    const throb = low ? 0.5 + Math.sin(this.clock / 110) * 0.5 : 0;
    this.danger.setAlpha(throb * 0.55);
    this.frame.setStrokeStyle(2, low ? 0xff4d4d : this.accent, low ? 0.55 + throb * 0.45 : 0.9);
    this.valueText.setColor(low ? '#ff9a9a' : '#ffffff');
  }

  destroy(): void { this.parts.forEach(part => part.destroy()); }
}
