import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { GAME_CONFIG } from '../config/gameConfig';
import { menuArtKey } from '../config/characters';
import { DRIVE_BEATS, DRIVE_DURATION } from './driveAssets';
import { DriveClip, prepareDriveAtlas, setDrivePose } from '../animation/DriveSpriteAtlas';
import { TilinDriveReaction } from './TilinDriveReaction';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';
import type { SuperContext, SuperSequence } from './SuperSequence';

const clamp = (v: number) => Phaser.Math.Clamp(v, 0, 1);
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const mix = Phaser.Math.Linear;
const ease = (v: number) => 1 - Math.pow(1 - v, 3);
const smooth = (v: number) => v * v * (3 - 2 * v);
const CAR_START = 406;
const IMPACT_X = 725;
const IMPACT_SPEED = 2 * (IMPACT_X - CAR_START) / 700;
const EXIT_ACCELERATION = 2 * (1700 - IMPACT_X - IMPACT_SPEED * 600) / (600 * 600);

/** Presentation only: all poses follow the combat clock, including pause and reduced motion. */
export class CesarDriveSequence implements SuperSequence {
  readonly layer: Phaser.GameObjects.Container;
  readonly duration = DRIVE_DURATION;
  readonly beats = DRIVE_BEATS;
  readonly soundKey = 'super-drive';
  private road: Phaser.GameObjects.Graphics;
  private effects: Phaser.GameObjects.Graphics;
  private caster: Phaser.GameObjects.Image;
  private victim: Phaser.GameObjects.Image;
  private car: Phaser.GameObjects.Image;
  private entry: Phaser.GameObjects.Image;
  private phase: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private progress: Phaser.GameObjects.Rectangle;
  private victimHeight: number;
  private clips: Map<string, DriveClip>;
  private tilinReaction?: TilinDriveReaction;
  private readonly floor = 622;

  constructor(private readonly scene: Phaser.Scene, attacker: Fighter, private defender: Fighter, private readonly targetId: string,
    stageTexture: string, private fromRight: boolean) {
    const s = scene;
    this.clips = prepareDriveAtlas(s);
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.layer.add(s.add.image(640, 360, stageTexture).setDisplaySize(1320, 744).setTint(0x9aaaba));
    this.layer.add(s.add.rectangle(640, 360, 1320, 744, 0x061019, 0.3));
    this.road = s.add.graphics(); this.layer.add(this.road);
    this.victimHeight = 315 * defender.stats.size;
    if (targetId === 'tilin') {
      this.victim = s.add.image(this.x(430), 465, menuArtKey(targetId)).setName('drive-victim')
        .setDisplaySize(this.victimHeight * 2 / 3, this.victimHeight).setFlipX(!fromRight).setTint(defender.sprite.tintTopLeft);
      this.tilinReaction = new TilinDriveReaction(
        this.victim, this.clips, fromRight, defender.stats.size, this.floor, defender.currentHealth);
    } else {
      this.victim = s.add.image(this.x(430), this.floor, defender.sprite.texture.key).setName('drive-victim')
        .setOrigin(0.5, 0.975).setScale(0.92 * defender.stats.size).setFlipX(!fromRight).setTint(defender.sprite.tintTopLeft);
    }
    this.caster = s.add.image(this.x(270), this.floor, 'cesar-drive-grab').setName('drive-caster')
      .setOrigin(0.5, 0.98242).setDisplaySize(270, 405).setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft);
    this.entry = s.add.image(this.x(360), this.floor, 'cesar-drive-entry').setName('drive-entry')
      .setOrigin(0.5, 0.93624).setDisplaySize(700, 394).setFlipX(fromRight).setVisible(false);
    this.car = s.add.image(this.x(360), this.floor, 'cesar-drive-car').setName('drive-car')
      .setOrigin(0.5, 0.92774).setDisplaySize(700, 394).setFlipX(fromRight).setVisible(false);
    this.layer.add([this.victim, this.caster, this.entry, this.car]);
    this.effects = s.add.graphics(); this.layer.add(this.effects);
    this.layer.add(s.add.rectangle(640, 103, 1320, 75, 0x061019, 0.96));
    this.layer.add(s.add.rectangle(640, 686, 1320, 90, 0x061019, 0.96));
    this.layer.add(s.add.text(56, 153, 'FURIA DEL i30', {
      fontFamily: FONT_IMPACT, fontSize: '43px', color: '#f8db99',
      stroke: '#08121b', strokeThickness: 5,
    }));
    this.phase = s.add.text(58, 204, '', {
      fontFamily: FONT_UI, fontSize: '19px', fontStyle: 'bold', color: '#bcff66',
      stroke: '#08121b', strokeThickness: 4,
    }).setName('drive-phase');
    this.counter = s.add.text(1218, 160, '', {
      fontFamily: FONT_UI, fontSize: '24px', color: '#fff4d8',
      stroke: '#08121b', strokeThickness: 4,
    }).setOrigin(1, 0);
    this.layer.add([this.phase, this.counter]);
    this.layer.add(s.add.rectangle(280, 668, 720, 4, 0x263c51).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 668, 1, 4, 0xa9ed52).setOrigin(0, 0.5);
    this.layer.add(this.progress);
    this.layer.add(s.add.text(640, 687, 'Agarre confirmado · Esc para pausar', {
      fontFamily: FONT_UI, fontSize: '16px', color: '#d2dfdf',
    }).setOrigin(0.5, 0));
    this.render(0, 0, false);
  }

  private x(value: number): number { return this.fromRight ? 1280 - value : value; }

  private poseVictim(name: string, progress: number): void {
    const frames = this.scene.anims.get(`${this.targetId}_anim_${name}`)?.frames ?? [];
    const key = frames[Phaser.Math.Clamp(Math.floor(progress * frames.length), 0, frames.length - 1)]?.textureKey;
    if (key && this.scene.textures.exists(key)) this.victim.setTexture(key);
  }

  commitPosition(ctx: SuperContext): void {
    const { attacker, defender, fromRight, casterOrigin } = ctx;
    attacker.x = casterOrigin.x;
    attacker.y = casterOrigin.y;
    // Keep the defender within PhysicsSystem's max separation so there is no snap on the next frame.
    const maxDist = GAME_CONFIG.WIDTH - 200;
    defender.x = fromRight
      ? Math.max(180, attacker.x - maxDist)
      : Math.min(GAME_CONFIG.STAGE_WIDTH - 180, attacker.x + maxDist);
    defender.y = GAME_CONFIG.FLOOR_Y;
    defender.isGrounded = true;
    defender.velocityY = 0;
  }

  render(t: number, damage: number, reduced: boolean): void {
    t = Phaser.Math.Clamp(t, 0, DRIVE_DURATION);
    const sign = this.fromRight ? -1 : 1, floor = this.floor;
    this.progress.setDisplaySize(720 * t / DRIVE_DURATION, 4);
    this.counter.setText(`${damage} de daño`);
    this.phase.setText(t < 550 ? 'AGARRE' : t < 1450 ? 'AL OTRO LADO DEL ESCENARIO' :
      t < 2450 ? 'CÉSAR SUBE A SU i30' : t < 2600 ? 'MOTOR ENCENDIDO' :
      t < 3300 ? 'A TODA VELOCIDAD' : t < 4050 ? '¡IMPACTO!' : 'DE VUELTA CON SU MONSTER');
    this.caster.setVisible(t < 1650 || t >= 4050).setAlpha(1).setAngle(0);
    this.victim.setVisible(true).setAlpha(1);
    this.entry.setVisible(t >= 1450 && t < 2450);
    this.car.setVisible(t >= 2350 && t < 3900).setAlpha(smooth(span(t, 2350, 2450)));

    // Every transform and pose is calculated from time, not inherited from a prior phase.
    const returning = t >= 4050;
    const casterClip = this.clips.get(returning ? 'cesar-drive-celebrate' : 'cesar-drive-grab')!;
    const casterPose = returning
      ? (t < 4550 ? 6 * span(t, 4050, 4550) : 6 + 5.999 * smooth(span(t, 4550, 5400)))
      : (t < 550 ? 6 * span(t, 0, 550) : 6 + 5.999 * ease(span(t, 550, 1250)));
    setDrivePose(this.caster, casterClip, casterPose);
    this.caster.setPosition(this.x(t < 550 ? mix(240, 285, smooth(span(t, 0, 550))) : 285), floor);
    const windup = Math.sin(span(t, 0, 550) * Math.PI);
    const followThrough = Math.sin(span(t, 550, 1250) * Math.PI);
    if (!returning && !reduced) this.caster.setAngle(sign * (-3 * windup + 2 * followThrough))
      .setScale(casterClip.scale * (1 + windup * 0.012), casterClip.scale * (1 - windup * 0.012));

    const entryClip = this.clips.get('cesar-drive-entry')!;
    setDrivePose(this.entry, entryClip, 8 * span(t, 1450, 2350));
    // The final boarding drawing is the driving drawing: no car or driver size jump.
    setDrivePose(this.car, entryClip, 7);

    if (this.tilinReaction) {
      this.tilinReaction.render(t, this.defender.currentHealth <= 0, reduced);
    } else if (t < 550) {
      const q = smooth(span(t, 0, 550));
      this.poseVictim('HIT_REACTION', q);
      this.victim.setOrigin(0.5, 0.975).setPosition(this.x(mix(440, 410, q)), floor - q * 24).setAngle(0);
    } else if (t < 1450) {
      const q = span(t, 550, 1450);
      this.poseVictim('KNOCKDOWN', q * 0.7);
      this.victim.setOrigin(0.5, 0.975).setPosition(this.x(mix(410, 1040, q)), floor - 24 * (1 - q) - Math.sin(q * Math.PI) * (reduced ? 85 : 190))
        .setAngle(0);
    } else if (t < 3300) {
      const settle = span(t, 1450, 1850);
      const bounce = reduced ? 0 : Math.sin(settle * Math.PI) * (1 - settle);
      if (t < 2100) this.poseVictim('KNOCKDOWN', 0.7 + span(t, 1450, 2100) * 0.3);
      else this.poseVictim(this.defender.currentHealth <= 0 ? 'DEFEAT' : 'GET_UP', span(t, 2100, 3250));
      this.victim.setOrigin(0.5, 0.975).setPosition(this.x(1040), floor - bounce * 20).setAngle(0);
    } else if (t < 4250) {
      const q = span(t, 3300, 4250);
      this.poseVictim('KNOCKDOWN', q);
      this.victim.setOrigin(0.5, 0.975).setPosition(this.x(mix(1040, 1060, smooth(q))), floor - Math.sin(q * Math.PI) * (reduced ? 85 : 195))
        .setAngle(0);
    } else {
      const defeated = this.defender.currentHealth <= 0;
      this.poseVictim(defeated ? 'DEFEAT' : 'GET_UP', span(t, 4250, 5650));
      this.victim.setOrigin(0.5, 0.975).setPosition(this.x(1060), floor).setAngle(0);
    }

    if (!returning) this.caster.setAlpha(1 - smooth(span(t, 1450, 1650)));
    this.entry.setPosition(this.x(CAR_START), floor)
      .setAlpha(smooth(span(t, 1450, 1650)) * (1 - smooth(span(t, 2350, 2450))));
    let carX = CAR_START;
    if (t >= 2600 && t < 3300) carX = mix(CAR_START, IMPACT_X, Math.pow(span(t, 2600, 3300), 2));
    else if (t >= 3300) {
      const elapsed = Math.min(600, t - 3300);
      carX = IMPACT_X + IMPACT_SPEED * elapsed + 0.5 * EXIT_ACCELERATION * elapsed * elapsed;
    }
    const suspension = reduced ? 0 : Math.sin(span(t, 2600, 3300) * Math.PI);
    const recoil = reduced ? 0 : Math.sin(span(t, 3300, 3520) * Math.PI);
    this.car.setPosition(this.x(carX), floor - suspension * 2 - recoil * 3)
      .setAngle(-sign * (suspension * 1.2 + recoil * 1.5));

    if (t >= 4050) {
      const q = smooth(span(t, 4050, 4550));
      const stride = reduced ? 0 : Math.sin(span(t, 4050, 4550) * Math.PI * 4) * Math.sin(q * Math.PI);
      const breath = reduced ? 0 : Math.sin((t - 5400) / 240) * smooth(span(t, 5400, 5600));
      this.caster.setPosition(this.x(mix(150, 285, q)), floor - Math.abs(stride) * 2)
        .setAlpha(smooth(span(t, 4050, 4140))).setAngle(sign * stride * 0.7)
        .setScale(casterClip.scale * (1 + breath * 0.003), casterClip.scale * (1 - breath * 0.003));
    }

    const g = this.road.clear(), fx = this.effects.clear();
    if (this.caster.visible) g.fillStyle(0x061019, 0.36 * this.caster.alpha).fillEllipse(this.caster.x, floor + 4, 200, 20);
    const victimLift = this.tilinReaction?.groundDistance ?? 0;
    const shadowWidth = this.tilinReaction ? Phaser.Math.Clamp(this.victim.displayWidth * 0.8, 110, 280) : 190;
    g.fillStyle(0x061019, 0.38 - Math.min(0.2, victimLift / 1200))
      .fillEllipse(this.victim.x, floor + 4, shadowWidth, 20 - Math.min(8, victimLift / 30));
    if (t >= 1450 && t < 3900) {
      g.fillStyle(0x061019, 0.5 * smooth(span(t, 1450, 1650))).fillEllipse(this.x(carX), floor + 3, 670, 26);
    }
    if (t >= 2600 && t < 3900) {
      g.lineStyle(5, 0x151b20, 0.6);
      for (const y of [floor - 5, floor + 8]) g.lineBetween(this.x(160), y, this.x(Math.min(carX, 1230)), y);
      if (!reduced) {
        for (let i = 0; i < 18; i++) {
          const px = (i * 173 + t * 1.7) % 1500 - 100, py = 280 + (i * 31) % 310;
          fx.lineStyle(i % 3 ? 2 : 4, i % 2 ? 0xefffff : 0xa9ed52, 0.18 + (i % 4) * 0.07);
          fx.lineBetween(this.x(px), py, this.x(px - 100 - i * 5), py);
        }
        // Wheel centres measured on the painted i30 (perspective makes the rear
        // wheel sit higher). Keep motion accents attached to the actual tyres.
        for (const [offset, rise, radius] of [[-273, 104, 70], [136, 72, 66]]) {
          for (let i = 0; i < 3; i++) {
            const angle = sign * (carX - CAR_START) / 47 + i * Math.PI * 2 / 3;
            fx.lineStyle(3, 0xd1e9ee, 0.32).beginPath();
            fx.arc(this.x(carX + offset), floor - rise, radius, angle, angle + 0.9).strokePath();
          }
        }
      }
      // Headlights and exhaust dust make the acceleration readable in reduced motion too.
      g.fillStyle(0xd4f5ff, 0.13).fillTriangle(this.x(carX + 305), floor - 105, this.x(carX + 530), floor - 170, this.x(carX + 530), floor - 35);
      for (let i = 0; i < 7; i++) {
        const age = reduced ? i / 7 : ((t - 2600) / 500 + i / 7) % 1;
        const drift = age * 180;
        g.fillStyle(0xb6bdbe, 0.2 * Math.sin(age * Math.PI)).fillCircle(this.x(carX - 280 - drift), floor - 20 - i * 4, 12 + drift * 0.16);
      }
    }
    const sinceHit = t >= 3300 ? t - 3300 : t >= 1450 ? t - 1450 : t;
    const pulse = Math.max(0, 1 - sinceHit / 380);
    if (pulse > 0 && t >= 1450) {
      const hitX = this.x(1060), hitY = t >= 3300 ? 480 : floor - 25;
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5, radius = 65 + (1 - pulse) * (reduced ? 30 : 130);
        fx.lineStyle(t >= 3300 ? 7 : 3, i % 2 ? 0xffefb9 : 0xa9ed52, pulse * 0.9)
          .lineBetween(hitX + Math.cos(angle) * radius * 0.3, hitY + Math.sin(angle) * radius * 0.3,
            hitX + Math.cos(angle) * radius, hitY + Math.sin(angle) * radius);
      }
      if (t >= 3300 && !reduced) fx.fillStyle(0xfff8d5, pulse * 0.13).fillRect(0, 140, 1280, 500);
    }
    if (t >= 4050) {
      const q = span(t, 4050, 4500);
      g.lineStyle(3, 0xa9ed52, (1 - q) * 0.8).strokeEllipse(this.x(285), floor, 180 + q * 180, 30 + q * 25);
      if (!reduced) for (let i = 0; i < 9; i++) {
        const y = 600 - ((t - 4050 + i * 90) * 0.15) % 300;
        fx.fillStyle(0xa9ed52, 0.5).fillCircle(this.x(170 + i * 28), y, 2);
      }
    }
    const shake = !reduced && t >= 3300 && t < 3600 ? Math.sin((t - 3300) * 0.095) * 6 * (1 - smooth(span(t, 3300, 3600))) : 0;
    this.layer.setPosition(shake, shake * 0.35);
  }
}
