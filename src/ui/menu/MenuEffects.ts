import Phaser from 'phaser';

/*
 * Visual building blocks for the animated title screen. Each piece owns its game objects and
 * exposes `update(dt, viewX, viewY)`, where view is the eased pointer in [-1, 1]. MenuScene only
 * orchestrates them, so any effect can be swapped or removed without touching the menu logic.
 */

const W = 1280, H = 720;

interface Ember { x: number; y: number; z: number; vx: number; vy: number; vz: number; color: number; phase: number; }

/** Embers and sea sparks in true perspective: they rise and drift toward the viewer. */
export class EmberField {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly embers: Ember[] = [];
  private time = 0;

  constructor(scene: Phaser.Scene, count: number, depth: number, private readonly near: number, private readonly far: number) {
    this.graphics = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setName('menu-embers');
    for (let i = 0; i < count; i++) this.embers.push(this.spawn(true));
  }

  private spawn(anywhere: boolean): Ember {
    const z = anywhere ? Phaser.Math.FloatBetween(this.near, this.far) : this.far;
    return {
      x: Phaser.Math.FloatBetween(-760, 760) * z,
      y: (anywhere ? Phaser.Math.FloatBetween(-380, 420) : Phaser.Math.FloatBetween(240, 460)) * z,
      z,
      vx: Phaser.Math.FloatBetween(-14, 22),
      vy: Phaser.Math.FloatBetween(-62, -26),
      vz: -Phaser.Math.FloatBetween(0.04, 0.12),
      color: Math.random() < 0.72 ? (Math.random() < 0.5 ? 0xffb347 : 0xff8a4c) : 0x9fe8e1,
      phase: Math.random() * Math.PI * 2,
    };
  }

  setVisible(visible: boolean): void { this.graphics.setVisible(visible); }

  update(dt: number, viewX: number, viewY: number): void {
    const s = dt / 1000;
    this.time += s;
    const g = this.graphics;
    g.clear();
    for (let i = 0; i < this.embers.length; i++) {
      let e = this.embers[i];
      e.x += (e.vx + Math.sin(this.time * 1.7 + e.phase) * 18) * s;
      e.y += e.vy * s;
      e.z += e.vz * s;
      // Perspective projection: near embers move more with the pointer (depth parallax).
      const sx = W / 2 + (e.x - viewX * 90) / e.z;
      const sy = H / 2 + (e.y - viewY * 55) / e.z;
      if (e.z < this.near * 0.6 || sy < -40 || sx < -60 || sx > W + 60) { e = this.embers[i] = this.spawn(false); continue; }
      const size = Phaser.Math.Clamp(1.6 / e.z, 0.8, 6);
      const flicker = 0.65 + Math.sin(this.time * 9 + e.phase) * 0.35;
      const fade = Phaser.Math.Clamp((this.far - e.z) / (this.far - this.near) * 1.6, 0, 1) * flicker;
      g.fillStyle(e.color, 0.16 * fade).fillCircle(sx, sy, size * 3.2);
      g.fillStyle(e.color, 0.85 * fade).fillCircle(sx, sy, size);
    }
  }
}

/** Soft warm radial glow shared by the sun, impact flashes and spotlights. */
export function ensureGlowTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('menu_sun_glow')) {
    const size = 512, r = size / 2;
    const texture = scene.textures.createCanvas('menu_sun_glow', size, size)!;
    const ctx = texture.context;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,240,200,0.9)');
    gradient.addColorStop(0.18, 'rgba(255,190,110,0.5)');
    gradient.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }
  return 'menu_sun_glow';
}

/** Radial light rays shared by the title sun and the result banners. */
export function ensureRaysTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('menu_god_rays')) {
    const size = 1100, r = size / 2;
    const texture = scene.textures.createCanvas('menu_god_rays', size, size)!;
    const ctx = texture.context;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,226,170,0.95)');
    gradient.addColorStop(0.35, 'rgba(255,170,96,0.35)');
    gradient.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = gradient;
    const rays = 26;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.08;
      const spread = 0.025 + Math.abs(Math.sin(i * 78.233)) * 0.05;
      ctx.beginPath(); ctx.moveTo(r, r);
      ctx.arc(r, r, r, angle - spread, angle + spread); ctx.closePath(); ctx.fill();
    }
    texture.refresh();
  }
  return 'menu_god_rays';
}

/** Slowly turning sun rays plus a breathing sun glow, anchored to the painted sun. */
export class GodRays {
  readonly rays: Phaser.GameObjects.Image;
  readonly glow: Phaser.GameObjects.Image;
  private time = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    ensureRaysTexture(scene);
    ensureGlowTexture(scene);
    this.rays = scene.add.image(0, 0, 'menu_god_rays').setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setName('menu-rays');
    this.glow = scene.add.image(0, 0, 'menu_sun_glow').setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
  }

  /** Keeps both layers on the sun of the coast image wherever its parallax puts it. */
  place(x: number, y: number): void { this.rays.setPosition(x, y); this.glow.setPosition(x, y); }

  update(dt: number): void {
    this.time += dt / 1000;
    this.rays.rotation += dt * 0.000035;
    this.rays.setAlpha(0.17 + Math.sin(this.time * 0.9) * 0.05);
    this.glow.setScale(1 + Math.sin(this.time * 1.3) * 0.06).setAlpha(0.45 + Math.sin(this.time * 1.3) * 0.08);
  }
}

/** Shockwave rings on the floor under the fighter, squashed into perspective. */
export class GroundPulse {
  private readonly rings: Phaser.GameObjects.Ellipse[] = [];
  private timer?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {}

  start(getOrigin: () => { x: number; y: number }, every = 2300): void {
    const emit = () => {
      const { x, y } = getOrigin();
      const ring = this.scene.add.ellipse(x, y, 330, 46).setDepth(this.depth)
        .setStrokeStyle(3, 0x9fe8e1, 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.9);
      ring.isFilled = false;
      this.rings.push(ring);
      this.scene.tweens.add({
        targets: ring, scale: 1.55, alpha: 0, duration: 1700, ease: 'Cubic.easeOut',
        onUpdate: () => { const o = getOrigin(); ring.setPosition(o.x, o.y); },
        onComplete: () => { ring.destroy(); this.rings.splice(this.rings.indexOf(ring), 1); },
      });
    };
    emit();
    this.timer = this.scene.time.addEvent({ delay: every, loop: true, callback: emit });
  }

  stop(): void { this.timer?.remove(); this.rings.forEach(r => r.destroy()); this.rings.length = 0; }
}

/**
 * Extruded title: stacked darker copies behind the face form a solid 3D block whose sides
 * shift with the viewer, so the letters feel carved rather than printed.
 */
export class Title3D {
  readonly lines: Phaser.GameObjects.Container[] = [];
  private readonly extrusions: { layers: Phaser.GameObjects.Text[]; face: Phaser.GameObjects.Text; w: number; h: number }[] = [];
  private static readonly DEPTH = 10;

  /**
   * @param x Left edge of the lines, or their centre when `options.centered` is set.
   * @param options Font size, extrusion colours (far → near) and face gradient (top, bottom).
   */
  constructor(scene: Phaser.Scene, x: number, y: number, words: string[], depth: number, options: {
    fontSize?: number; centered?: boolean; side?: [number, number]; face?: [number, number]; shine?: boolean;
    /** Pin to the screen instead of the world (for HUD banners over a scrolling camera). */
    fixed?: boolean;
  } = {}) {
    const fontSize = options.fontSize ?? 98, [far, near] = options.side ?? [0x24150e, 0x9a5a33];
    const [faceTop, faceBottom] = options.face ?? [0xfff3d8, 0xd99b58];
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Impact, Arial Black', fontSize: fontSize + 'px' };
    const back = Phaser.Display.Color.ValueToColor(far), front = Phaser.Display.Color.ValueToColor(near);
    let top = y;
    for (const word of words) {
      const probe = scene.add.text(0, 0, word, style);
      const w = probe.width, h = probe.height;
      probe.destroy();
      const line = scene.add.container(options.centered ? x : x + w / 2, top + h / 2).setDepth(depth);
      if (options.fixed) line.setScrollFactor(0);
      const layers: Phaser.GameObjects.Text[] = [];
      for (let i = Title3D.DEPTH; i >= 1; i--) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(back, front, Title3D.DEPTH - 1, Title3D.DEPTH - i);
        const color = Phaser.Display.Color.RGBToString(Math.round(c.r), Math.round(c.g), Math.round(c.b), 255, '#');
        const layer = scene.add.text(-w / 2, -h / 2, word, {
          ...style, color, ...(i === Title3D.DEPTH ? { stroke: '#120d10', strokeThickness: 5 } : {}),
        });
        layers.unshift(layer);
      }
      const face = scene.add.text(-w / 2, -h / 2, word, { ...style, color: '#ffffff', stroke: '#ffdfad', strokeThickness: 1 })
        .setTint(faceTop, faceTop, faceBottom, faceBottom);
      if (options.shine !== false) face.postFX?.addShine(0.45, 0.22, 4);
      line.add([...[...layers].reverse(), face]);
      this.lines.push(line);
      this.extrusions.push({ layers, face, w, h });
      top += h - Math.round(fontSize * 0.18);
    }
    this.update(0, 0);
  }

  destroy(): void { this.lines.forEach(line => line.destroy()); }

  update(viewX: number, viewY: number): void {
    const dx = 0.75 - viewX * 0.55, dy = 0.82 - viewY * 0.4;
    for (const { layers, face, w, h } of this.extrusions) {
      face.setPosition(-w / 2 + viewX * 3, -h / 2 + viewY * 2);
      layers.forEach((layer, k) => layer.setPosition(-w / 2 + (k + 1) * dx, -h / 2 + (k + 1) * dy));
    }
  }
}
