import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { superPortraitKey } from '../config/characters';
import { FONT_IMPACT, FONT_UI } from '../ui/fonts';
import type { SuperSequence } from './SuperSequence';

export const BIKE_DURATION = 6000;
export const BIKE_BEATS = [
  { at: 0, damage: 6 }, { at: 3200, damage: 42 }, { at: 3750, damage: 12 },
] as const;
const span = (t: number, a: number, b: number) => Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
const mix = Phaser.Math.Linear;

/** The beer, mounting, pedal cycle and collision share the pauseable combat clock. */
export class TataBikeSequence implements SuperSequence {
  readonly layer: Phaser.GameObjects.Container;
  readonly duration = BIKE_DURATION;
  readonly beats = BIKE_BEATS;
  readonly soundKey = 'super-bike';
  private readonly world: Phaser.GameObjects.Container;
  private readonly caster: Phaser.GameObjects.Image;
  private readonly victim: Phaser.GameObjects.Image;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly shadows: Phaser.GameObjects.Graphics;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Rectangle;
  private readonly floor = 590;

  constructor(private scene: Phaser.Scene, attacker: Fighter, private defender: Fighter,
    private defenderId: string, stage: string, private fromRight: boolean) {
    const s = scene;
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.world = s.add.container(0, 0).setName('tata-world');
    this.layer.add(this.world);
    this.world.add(s.add.image(640, 360, stage).setDisplaySize(1580, 900).setTint(0xb4a897));
    this.world.add(s.add.rectangle(640, 360, 1580, 900, 0x091510, 0.28));
    this.shadows = s.add.graphics();
    this.caster = s.add.image(this.x(320), this.floor, attacker.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(0.9 * attacker.stats.size).setFlipX(fromRight)
      .setTint(attacker.sprite.tintTopLeft).setName('tata-caster');
    this.victim = s.add.image(this.x(960), this.floor, defender.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(0.9 * defender.stats.size).setFlipX(!fromRight)
      .setTint(defender.sprite.tintTopLeft).setName('tata-victim');
    this.effects = s.add.graphics().setName('tata-bike-effects');
    this.world.add([this.shadows, this.victim, this.caster, this.effects]);
    this.portrait = s.add.image(this.x(360), 360, superPortraitKey('tata'))
      .setDisplaySize(720, 480).setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft);
    this.title = s.add.text(this.x(950), 280, 'TATA\nBRINDIS\nA PEDALES', {
      fontFamily: FONT_IMPACT, fontSize: '48px', color: '#ffe4a4', stroke: '#102b22', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5);
    this.layer.add([this.portrait, this.title]);
    this.layer.add(s.add.rectangle(640, 49, 1280, 98, 0x071811, 0.97));
    this.layer.add(s.add.rectangle(640, 669, 1280, 102, 0x071811, 0.97));
    this.layer.add(s.add.text(640, 166, 'BRINDIS A PEDALES', {
      fontFamily: FONT_IMPACT, fontSize: '29px', color: '#ffe4a4', stroke: '#102b22', strokeThickness: 4,
    }).setOrigin(0.5));
    this.phase = s.add.text(48, 646, '', { fontFamily: FONT_IMPACT, fontSize: '28px', color: '#ffe4a4' })
      .setOrigin(0, 0.5).setName('tata-phase');
    this.counter = s.add.text(1232, 646, '', { fontFamily: FONT_UI, fontSize: '21px', color: '#fff4db' }).setOrigin(1, 0.5);
    this.layer.add(s.add.rectangle(280, 679, 720, 4, 0x294a3c).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 679, 1, 4, 0xe5b761).setOrigin(0, 0.5);
    this.layer.add([this.phase, this.counter, this.progress]);
    this.layer.add(s.add.text(640, 699, 'Súper confirmado · Esc para pausar', {
      fontFamily: FONT_UI, fontSize: '14px', color: '#c4d6c8',
    }).setOrigin(0.5));
  }

  private x(v: number): number { return this.fromRight ? 1280 - v : v; }

  private pose(actor: Phaser.GameObjects.Image, id: string, name: string, progress: number): void {
    const frames = this.scene.anims.get(`${id}_anim_${name}`)?.frames ?? [];
    const key = frames[Phaser.Math.Clamp(Math.floor(progress * frames.length), 0, frames.length - 1)]?.textureKey;
    if (key) actor.setTexture(key);
  }

  render(t: number, damage: number, reduced: boolean): void {
    const intro = 1 - span(t, 430, 650), riding = t >= 2200 && t < 4850;
    const returning = t >= 3700 && t < 5450;
    let riderX = 320;
    if (t >= 2200 && t < 3200) riderX = mix(320, 870, Phaser.Math.Easing.Quadratic.In(span(t, 2200, 3200)));
    else if (t >= 3200 && t < 3700) riderX = mix(870, 1470, span(t, 3200, 3700));
    else if (t >= 3700 && t < 4850) riderX = mix(1470, 320, Phaser.Math.Easing.Quadratic.Out(span(t, 3700, 4850)));
    this.caster.setVisible(t >= 550).setAlpha(span(t, 550, 700))
      .setPosition(this.x(riderX), this.floor).setFlipX(returning ? !this.fromRight : this.fromRight).setAngle(0);
    if (t < 1350) this.pose(this.caster, 'tata', 'DRINK', span(t, 550, 1320));
    else if (t < 2200) this.pose(this.caster, 'tata', 'MOUNT_BIKE', span(t, 1350, 2180));
    else if (riding) this.pose(this.caster, 'tata', 'CYCLE', ((t - 2200) * 0.018 % 6) / 6);
    else if (t < 5450) this.pose(this.caster, 'tata', 'MOUNT_BIKE', 1 - span(t, 4850, 5420));
    else this.pose(this.caster, 'tata', 'CELEBRATE', span(t, 5450, 5999));
    if (riding && !reduced) this.caster.y -= Math.sin(t / 70) * 1.5;
    this.portrait.setVisible(intro > 0).setAlpha(intro);
    this.title.setVisible(intro > 0).setAlpha(intro);

    const flight = span(t, 3200, 3750), victimX = mix(960, 1080, flight);
    const victimY = this.floor - Math.sin(flight * Math.PI) * 155;
    this.victim.setPosition(this.x(victimX), victimY);
    // Opponent instances use a collision alias; animation keys use their roster ID.
    const id = this.defenderId;
    if (t < 400) this.pose(this.victim, id, 'HIT_REACTION', span(t, 0, 400));
    else if (t < 3200) this.pose(this.victim, id, 'STUN', (t % 720) / 720);
    else if (t < 5050) this.pose(this.victim, id, 'KNOCKDOWN', flight);
    else this.pose(this.victim, id, this.defender.currentHealth <= 0 ? 'DEFEAT' : 'GET_UP', span(t, 5050, 5999));
    const hit = Math.max(0, 1 - (t - 3200) / 250) * (t >= 3200 ? 1 : 0);
    const landing = Math.max(0, 1 - (t - 3750) / 320) * (t >= 3750 ? 1 : 0);
    const focus = 1 - span(t, 1300, 2150), zoom = reduced ? 1 : 1 + 0.1 * focus * (1 - intro);
    this.world.setScale(zoom).setPosition(640 - this.x(mix(640, 480, focus)) * zoom,
      360 - 360 * zoom + (reduced ? 0 : Math.sin(t / 14) * (hit * 7 + landing * 4)));
    this.shadows.clear().fillStyle(0x020907, 0.35)
      .fillEllipse(this.x(riderX), this.floor, riding || t >= 1350 && t < 5450 ? 300 : 130, 19)
      .fillEllipse(this.x(victimX), this.floor, 150, 18);

    this.phase.setText(t < 1350 ? '¡SALUD!' : t < 2200 ? '¡AL MANUBRIO!' : t < 3200 ? '¡PEDAL A FONDO!'
      : t < 3750 ? '¡PERMISO, QUE VOY!' : t < 5450 ? 'VUELTA POR LA COSTANERA' : '¡EL TATA MANDA!');
    this.counter.setText(`${BIKE_BEATS.filter(b => b.at <= t).length} impactos · ${damage} de daño`);
    this.progress.setDisplaySize(720 * t / BIKE_DURATION, 4);
    const g = this.effects.clear(), direction = this.fromRight ? -1 : 1;
    if (riding) {
      const travelDirection = direction * (returning ? -1 : 1);
      for (let i = 0; i < 10; i++) {
        const phase = reduced ? i / 10 : (t / 240 + i / 10) % 1;
        const x = this.x(riderX) - travelDirection * (80 + phase * 180);
        g.lineStyle(1 + i % 2, 0xf6dfac, (1 - phase) * 0.45)
          .lineBetween(x, 390 + i * 18, x - travelDirection * (30 + i * 5), 390 + i * 18);
      }
      for (let i = 0; i < 7; i++) {
        const phase = reduced ? i / 7 : (t / 430 + i / 7) % 1;
        g.fillStyle(0xdac8a1, (1 - phase) * 0.2)
          .fillCircle(this.x(riderX) - travelDirection * (100 + phase * 170), this.floor - phase * 25, 3 + phase * 15);
      }
    }
    if (hit > 0) {
      g.fillStyle(0xffe9af, hit * 0.5).fillCircle(this.x(960), 465, 60 * (2 - hit));
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8, radius = 45 + (1 - hit) * 160;
        g.lineStyle(3, i % 2 ? 0xffc45c : 0xfff8de, hit).lineBetween(this.x(960) + Math.cos(angle) * 25,
          465 + Math.sin(angle) * 25, this.x(960) + Math.cos(angle) * radius, 465 + Math.sin(angle) * radius);
      }
    }
    if (landing > 0) {
      g.lineStyle(4, 0xffe6b1, landing).strokeEllipse(this.x(1080), this.floor, 90 + (1 - landing) * 190, 24);
      for (let i = 0; i < 9; i++) g.fillStyle(0xd9bf89, landing * 0.3)
        .fillCircle(this.x(1080 + (i - 4) * 26), this.floor - Math.sin(i * 2.4) * 10 - (1 - landing) * 30, 7 + i % 3 * 4);
    }
  }
}
