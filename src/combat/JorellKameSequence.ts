import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { GAME_CONFIG } from '../config/gameConfig';
import { getManifest, superPortraitKey } from '../config/characters';
import { FONT_IMPACT, FONT_UI } from '../ui/fonts';
import type { SuperContext, SuperSequence } from './SuperSequence';

export const KAME_DURATION = 6800;
export const KAME_BEATS = [
  { at: 0, damage: 10 }, { at: 4450, damage: 8 }, { at: 4700, damage: 8 },
  { at: 4950, damage: 8 }, { at: 5200, damage: 8 }, { at: 5550, damage: 18 },
] as const;
const span = (t: number, a: number, b: number) => Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
const ease = (t: number, a: number, b: number) => Phaser.Math.Easing.Sine.InOut(span(t, a, b));
const mix = Phaser.Math.Linear;
// Palm centres in the generated source cells. The energy follows the hands.
const CHARGE_HANDS = [[128, 70], [74, 133], [60, 137], [55, 138], [56, 140], [63, 144]];
const RELEASE_HANDS = [[122, 193], [91, 184], [81, 174], [52, 173], [202, 151], [223, 132],
  [221, 126], [201, 114], [289, 107], [248, 125], [225, 115], [204, 116]];

/** Closeups use a separate world, preserving the gameplay camera and HUD.
 * Every pose/effect shares the combat clock, including pause and cancellation. */
export class JorellKameSequence implements SuperSequence {
  readonly layer: Phaser.GameObjects.Container;
  readonly duration = KAME_DURATION;
  readonly beats = KAME_BEATS;
  readonly soundKey = 'super-kame';
  private world: Phaser.GameObjects.Container;
  private caster: Phaser.GameObjects.Image;
  private victim: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Graphics;
  private effects: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;
  private cutin: Phaser.GameObjects.Image;
  private cutinBackdrop: Phaser.GameObjects.Graphics;
  private cutinTitle: Phaser.GameObjects.Text;
  private phase: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private progress: Phaser.GameObjects.Rectangle;
  private halo: Phaser.GameObjects.Image;
  private orb: Phaser.GameObjects.Image;
  private impact: Phaser.GameObjects.Image;
  private beamGlow: Phaser.GameObjects.Image;
  private floor = 590;
  private bodyScale: number;
  private chargeSourceHeight: number;
  private releaseSourceHeight: number;
  private chargeGroundY: number;
  private releaseGroundY: number;

  constructor(private scene: Phaser.Scene, attacker: Fighter, private defender: Fighter, private defenderId: string,
    stage: string, private fromRight: boolean) {
    const s = scene;
    this.bodyScale = 0.86 * attacker.stats.size;
    const sheet = getManifest(scene, 'jorell').spriteSheet;
    this.chargeSourceHeight = sheet?.animations?.CHARGE?.sourceBodyHeight ?? sheet?.sourceBodyHeight ?? 238;
    this.releaseSourceHeight = sheet?.animations?.BEAM?.sourceBodyHeight ?? 306;
    this.chargeGroundY = sheet?.animations?.CHARGE?.groundY ?? 248;
    this.releaseGroundY = sheet?.animations?.BEAM?.groundY ?? 331;
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.world = s.add.container(0, 0).setName('jorell-world');
    this.layer.add(this.world);
    this.world.add(s.add.image(640, 360, stage).setDisplaySize(1580, 900).setTint(0x8497b1));
    this.world.add(s.add.rectangle(640, 360, 1580, 900, 0x040c1c, 0.52));
    this.shadow = s.add.graphics();
    this.aura = s.add.graphics().setName('jorell-aura');
    const glow = 'jorell-ki-glow';
    if (!s.textures.exists(glow)) {
      const texture = s.textures.createCanvas(glow, 256, 256)!;
      const ctx = texture.context, gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.23)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256); texture.refresh();
    }
    this.halo = s.add.image(this.x(260), 420, glow).setTint(0xffbf40).setBlendMode(Phaser.BlendModes.ADD);
    this.caster = s.add.image(this.x(835), this.floor, attacker.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(this.bodyScale).setFlipX(fromRight)
      .setTint(attacker.sprite.tintTopLeft).setName('jorell-caster');
    this.victim = s.add.image(this.x(950), this.floor, defender.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(0.86 * defender.stats.size).setFlipX(!fromRight)
      .setTint(defender.sprite.tintTopLeft).setName('jorell-victim');
    this.effects = s.add.graphics().setName('jorell-energy');
    this.orb = s.add.image(0, 0, glow).setTint(0x54d7ff).setBlendMode(Phaser.BlendModes.ADD);
    this.impact = s.add.image(this.x(950), 402, glow).setTint(0x70e1ff).setBlendMode(Phaser.BlendModes.ADD);
    this.beamGlow = s.add.image(0, 0, glow).setTint(0x39baff).setBlendMode(Phaser.BlendModes.ADD);
    this.world.add([this.shadow, this.halo, this.aura, this.victim, this.caster, this.beamGlow, this.orb, this.effects, this.impact]);
    this.cutinBackdrop = s.add.graphics();
    this.cutin = s.add.image(380, 365, superPortraitKey('jorell')).setName('jorell-cutin').setFlipX(fromRight);
    this.cutinTitle = s.add.text(this.x(925), 300, 'JORELL\nDESPERTAR\nSAIYAJIN', {
      fontFamily: FONT_IMPACT, fontSize: '53px', color: '#fff0ba', stroke: '#111b2e', strokeThickness: 5,
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);
    this.layer.add([this.cutinBackdrop, this.cutin, this.cutinTitle]);
    this.layer.add(s.add.rectangle(640, 49, 1280, 98, 0x050b19, 0.97));
    this.layer.add(s.add.rectangle(640, 668, 1280, 104, 0x050b19, 0.97));
    this.layer.add(s.add.text(640, 175, 'DESPERTAR SAIYAJIN', { fontFamily: FONT_IMPACT, fontSize: '28px', color: '#fff2ce', stroke: '#08152a', strokeThickness: 4 }).setOrigin(0.5));
    this.phase = s.add.text(48, 645, '', { fontFamily: FONT_IMPACT, fontSize: '29px', color: '#b0efff' })
      .setOrigin(0, 0.5).setName('jorell-phase');
    this.counter = s.add.text(1232, 645, '', { fontFamily: FONT_UI, fontSize: '21px', color: '#fff2ce' }).setOrigin(1, 0.5);
    this.layer.add(s.add.rectangle(280, 678, 720, 4, 0x263954).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 678, 1, 4, 0xf0c96f).setOrigin(0, 0.5);
    this.layer.add([this.phase, this.counter, this.progress]);
    this.layer.add(s.add.text(640, 699, 'Súper confirmado · Esc para pausar', { fontFamily: FONT_UI, fontSize: '14px', color: '#a3b7ce' }).setOrigin(0.5));
  }

  commitPosition(ctx: SuperContext): void {
    const { attacker, defender, fromRight, casterOrigin } = ctx;
    attacker.x = Phaser.Math.Clamp(defender.x + (fromRight ? 650 : -650), 80, GAME_CONFIG.STAGE_WIDTH - 80);
    attacker.y = casterOrigin.y;
    defender.y = GAME_CONFIG.FLOOR_Y;
    defender.isGrounded = true;
    defender.velocityY = 0;
  }

  private x(value: number): number { return this.fromRight ? 1280 - value : value; }
  private pose(actor: Phaser.GameObjects.Image, id: string, name: string, progress: number): void {
    const frames = this.scene.anims.get(`${id}_anim_${name}`)?.frames ?? [];
    const key = frames[Phaser.Math.Clamp(Math.floor(progress * frames.length), 0, frames.length - 1)]?.textureKey;
    if (key && this.scene.textures.exists(key)) actor.setTexture(key);
  }

  render(t: number, damage: number, reduced: boolean): void {
    const power = span(t, 1250, 2750) * (1 - span(t, 5950, 6500));
    const fire = t >= 4250 && t < 5800;
    const beat = [...KAME_BEATS].reverse().find(b => b.at <= t)!;
    const pulse = Math.max(0, 1 - (t - beat.at) / 230);
    const casterX = t < 800 ? 835 : 260;
    this.caster.setPosition(this.x(casterX), this.floor).setAlpha(t < 800 ? 1 - span(t, 610, 760) : span(t, 830, 1030));
    if (t < 450) this.pose(this.caster, 'jorell', 'SPECIAL_ATTACK', 0.5 + span(t, 0, 450) * 0.49);
    else if (t < 1150) this.pose(this.caster, 'jorell', 'TELEPORT', span(t, 450, 1100));
    else if (t < 2850) this.pose(this.caster, 'jorell', 'TRANSFORM', span(t, 1150, 2750));
    else if (t < 3950) this.pose(this.caster, 'jorell', 'CHARGE', span(t, 2850, 3850));
    else if (t < 6000) this.pose(this.caster, 'jorell', 'BEAM', span(t, 3950, 4350));
    else if (t < 6600) this.pose(this.caster, 'jorell', 'POWER_RETURN', span(t, 6000, 6570));
    else this.pose(this.caster, 'jorell', 'IDLE', ((t - 6600) % 750) / 750);

    const id = this.defenderId;
    if (t < 450) this.pose(this.victim, id, 'HIT_REACTION', 0.35 + span(t, 0, 450) * 0.65);
    else if (t < 4450) this.pose(this.victim, id, 'STUN', (t % 660) / 660);
    else if (t < 5550) this.pose(this.victim, id, 'HIT_REACTION', 0.35 + (t % 340) / 340 * 0.65);
    else if (t < 6150) this.pose(this.victim, id, 'KNOCKDOWN', span(t, 5550, 6150));
    else this.pose(this.victim, id, this.defender.currentHealth <= 0 ? 'DEFEAT' : 'GET_UP', span(t, 6150, 6799));
    this.victim.setX(this.x(950 + (reduced ? 0 : Math.sin((t - beat.at) / 22) * pulse * 8)));
    this.frameWorld(t, pulse, reduced);
    const reveal = span(t, 1150, 1310) * (1 - span(t, 1900, 2200));
    this.cutin.setVisible(reveal > 0).setAlpha(reveal).setScale(0.48)
      .setPosition(this.x(375 + (reduced ? 0 : 48 * (1 - ease(t, 1150, 1550)))), 365);
    this.cutinTitle.setAlpha(reveal);
    const panel = this.cutinBackdrop.clear();
    if (reveal > 0) {
      panel.fillStyle(0x050d22, reveal * 0.93).fillRect(0, 98, 1280, 518);
      panel.fillStyle(0x725324, reveal * 0.45).fillTriangle(this.x(0), 616, this.x(880), 98, this.x(690), 616);
      for (let i = 0; i < 10; i++) panel.lineStyle(1 + i % 3, 0xffd875, reveal * 0.3)
        .lineBetween(this.x(0), 170 + i * 45, this.x(1280), 120 + i * 45);
    }
    this.phase.setText(t < 450 ? '¡GOLPE AL ESTÓMAGO!' : t < 1150 ? 'TELETRANSPORTE'
      : t < 2850 ? '¡SUPER SAIYAJIN!' : t < 3950 ? 'KA… ME… HA… ME…' : t < 6000 ? '¡HAAAA!' : 'PODER BAJO CONTROL');
    this.counter.setText(`${KAME_BEATS.filter(b => b.at <= t).length} impactos · ${damage} de daño`);
    this.progress.setDisplaySize(720 * t / KAME_DURATION, 4);

    const a = this.aura.clear(), g = this.effects.clear(), shadow = this.shadow.clear();
    shadow.fillStyle(0x020714, 0.4).fillEllipse(this.x(casterX), this.floor, 155, 23)
      .fillEllipse(this.x(950), this.floor, 160, 25);
    this.halo.setAlpha(power * 0.72).setDisplaySize(390, 520);
    this.orb.setAlpha(0); this.impact.setAlpha(0); this.beamGlow.setAlpha(0);
    if (power > 0) this.drawAura(a, t, power, reduced);
    if (t >= 540 && t < 1150) {
      const q = t < 800 ? span(t, 540, 800) : 1 - span(t, 800, 1150), at = this.x(casterX);
      for (let i = 0; i < 13; i++) {
        const dx = (i - 6) * 12;
        g.lineStyle(i % 2 ? 2 : 4, 0xc9f4ff, q * 0.8).lineBetween(at + dx, 265 - i * 3, at + dx, this.floor + 5);
      }
      g.lineStyle(3, 0xe6fbff, q).strokeEllipse(at, 420, 110 + q * 90, 340);
    }
    if (t >= 3000 && t < 6000) {
      const releasing = t >= 3950;
      const frame = Math.floor(releasing ? span(t, 3950, 4350) * 11.99 : span(t, 2850, 3850) * 5.99);
      const [hx, hy] = (releasing ? RELEASE_HANDS : CHARGE_HANDS)[frame];
      const spriteScale = 330 / (releasing ? this.releaseSourceHeight : this.chargeSourceHeight) * this.bodyScale;
      const handX = this.x(260 + (hx - (releasing ? 192 : 128)) * spriteScale);
      const handY = this.floor + (hy - (releasing ? this.releaseGroundY : this.chargeGroundY)) * spriteScale;
      const charge = span(t, 2850, 3950), fade = 1 - span(t, 5680, 5900);
      const radius = (7 + charge * 23) * fade;
      this.orb.setPosition(handX, handY).setDisplaySize(radius * 7, radius * 7).setAlpha(fade * 0.85);
      g.fillStyle(0xeaffff, fade).fillCircle(handX, handY, radius * 0.6);
      if (!fire && t < 4250) for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6 + (reduced ? 0 : t / 520), d = 35 + (reduced ? 25 : (1 - ((t / 550 + i / 12) % 1)) * 100);
        g.lineStyle(2, 0xa5edff, charge * 0.7).lineBetween(handX + Math.cos(angle) * d, handY + Math.sin(angle) * d,
          handX + Math.cos(angle) * (d + 20), handY + Math.sin(angle) * (d + 20));
      }
      if (fire) this.drawBeam(g, handX, handY, t, fade, reduced);
    }
    if (pulse > 0 && (t < 450 || t >= 4450)) {
      const y = t < 450 ? 451 : 396;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6, size = reduced ? 45 : 30 + (1 - pulse) * 135;
        g.lineStyle(3, t < 450 ? 0xffd68a : 0xb2f5ff, pulse)
          .lineBetween(this.x(950) + Math.cos(angle) * 18, y + Math.sin(angle) * 18,
            this.x(950) + Math.cos(angle) * size, y + Math.sin(angle) * size);
      }
    }
    if (t >= 5550 && t < 6350) {
      const q = span(t, 5550, 6350), size = 100 + ease(t, 5550, 6050) * 210;
      this.impact.setDisplaySize(size * 1.8, size * 1.5).setAlpha((1 - q) * 0.9);
      g.lineStyle(5 * (1 - q), 0xb8faff, (1 - q) * 0.65).strokeEllipse(this.x(950), 406, size, size * 1.2);
      for (let i = 0; i < 14; i++) {
        const theta = i * 2.4, d = 35 + q * (100 + i * 6);
        g.fillStyle(i % 2 ? 0xc4efff : 0x607791, (1 - q) * 0.6)
          .fillCircle(this.x(950 + Math.cos(theta) * d), 421 + Math.sin(theta) * d + q * 80, 4 + q * 16);
      }
    }
  }

  private frameWorld(t: number, pulse: number, reduced: boolean): void {
    let zoom = 1, focus = 640, focusY = 360, screenY = 360;
    if (!reduced) {
      if (t < 1150) {
        const q = ease(t, 450, 1120);
        zoom = mix(1.22, 1, q); focus = mix(860, 640, q); focusY = mix(440, 360, q); screenY = mix(410, 360, q);
      } else if (t < 4250) {
        const q = ease(t, 1150, 2250) * (1 - ease(t, 3950, 4250));
        zoom = 1 + 0.18 * q; focus = mix(640, 420, q); focusY = mix(360, 440, q); screenY = mix(360, 410, q);
      }
    }
    const shake = !reduced && (t < 230 || t >= 4450) ? pulse * (t >= 5550 ? 6 : 3) : 0;
    this.world.setScale(zoom).setPosition(640 - this.x(focus) * zoom + Math.sin(t / 18) * shake,
      screenY - focusY * zoom + Math.cos(t / 23) * shake * 0.6);
  }

  private drawAura(a: Phaser.GameObjects.Graphics, t: number, power: number, reduced: boolean): void {
    for (let ring = 0; ring < 3; ring++) {
      const points = [], width = 115 - ring * 24, height = 350 - ring * 23;
      points.push(new Phaser.Geom.Point(this.x(260 - width), this.floor));
      for (let j = 0; j <= 24; j++) {
        const u = j / 24, flame = (j % 2 ? 17 : -4) + (reduced ? 0 : Math.sin(t / 110 + j * 1.8) * 12);
        points.push(new Phaser.Geom.Point(this.x(260 - width + u * width * 2), this.floor - Math.sin(u * Math.PI) * height - flame));
      }
      points.push(new Phaser.Geom.Point(this.x(260 + width), this.floor));
      a.fillStyle(ring === 2 ? 0xffefad : 0xffbf3b, (0.12 + ring * 0.025) * power).fillPoints(points, true);
    }
    a.lineStyle(2, 0xffdf73, 0.65 * power).strokeEllipse(this.x(260), this.floor, 260, 26);
    for (let i = 0; i < 22; i++) {
      const q = reduced ? i / 22 : (t / 1300 + i / 22) % 1;
      const px = this.x(260 + Math.sin(i * 2.4) * (75 + q * 55)), py = this.floor - q * 335;
      a.fillStyle(i % 3 ? 0xffe9a2 : 0x948474, (1 - q) * power).fillRect(px, py, i % 3 ? 3 : 8, i % 3 ? 8 : 6);
    }
    for (const side of [-1, 1]) {
      a.lineStyle(2, 0xfff0b7, power * 0.65).beginPath();
      for (let j = 0; j < 7; j++) {
        const px = this.x(260 + side * (85 + Math.sin(j * 3 + (reduced ? 0 : Math.floor(t / 100))) * 18));
        if (j === 0) a.moveTo(px, 270); else a.lineTo(px, 270 + j * 46);
      }
      a.strokePath();
    }
  }

  private drawBeam(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, fade: number, reduced: boolean): void {
    const reach = Phaser.Math.Easing.Cubic.Out(span(t, 4250, 4450)), end = mix(x, this.x(1010), reach);
    this.beamGlow.setPosition(mix(x, end, 0.5), y).setDisplaySize(Math.abs(end - x) + 170, 230 * fade).setAlpha(0.55 * fade);
    for (let layer = 0; layer < 3; layer++) {
      const width = [67, 39, 17][layer] * fade, points: Phaser.Geom.Point[] = [];
      for (const side of [-1, 1]) for (let j = 0; j <= 24; j++) {
        const q = side === -1 ? j / 24 : 1 - j / 24;
        const wave = reduced ? 0 : Math.sin(q * 19 - t / 65) * (layer === 2 ? 2 : 6);
        points.push(new Phaser.Geom.Point(mix(x, end, q), y + side * (width * (0.26 + 0.74 * Math.sin(q * Math.PI / 2)) + wave)));
      }
      g.fillStyle([0x208fff, 0x58d8ff, 0xf0ffff][layer], [0.24, 0.82, 0.97][layer] * fade).fillPoints(points, true);
      g.fillEllipse(end, y, width * 0.8, width * 2);
    }
    for (let i = 0; i < 7; i++) {
      const q = reduced ? i / 7 : (t / 370 + i / 7) % 1;
      g.lineStyle(2, 0xc2f7ff, fade * 0.65).strokeEllipse(mix(x, end, q), y, 15 + q * 26, (25 + q * 85) * fade);
    }
    if (t >= 4450) this.impact.setPosition(this.x(950), y).setDisplaySize(240, 300).setAlpha(fade * 0.75);
    g.fillStyle(0x46caff, fade * 0.1).fillEllipse(mix(x, end, 0.5), this.floor, Math.abs(end - x), 40);
  }
}


