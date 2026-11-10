import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { menuArtKey } from '../config/characters';
import { DRIVE_DURATION } from './driveAssets';

const clamp = (v: number) => Phaser.Math.Clamp(v, 0, 1);
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const mix = Phaser.Math.Linear;
const ease = (v: number) => 1 - Math.pow(1 - v, 3);

/** Presentation only: all poses follow the combat clock, including pause and reduced motion. */
export class CesarDriveSequence {
  readonly layer: Phaser.GameObjects.Container;
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
  private readonly floor = 622;

  constructor(scene: Phaser.Scene, attacker: Fighter, defender: Fighter, targetId: string,
    stageTexture: string, private fromRight: boolean) {
    const s = scene;
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.layer.add(s.add.image(640, 360, stageTexture).setDisplaySize(1320, 744).setTint(0x9aaaba));
    this.layer.add(s.add.rectangle(640, 360, 1320, 744, 0x061019, 0.3));
    this.road = s.add.graphics(); this.layer.add(this.road);
    this.victimHeight = 315 * defender.stats.size;
    this.victim = s.add.image(this.x(430), 465, menuArtKey(targetId)).setName('drive-victim')
      .setDisplaySize(this.victimHeight * 2 / 3, this.victimHeight).setFlipX(!fromRight).setTint(defender.sprite.tintTopLeft);
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
      fontFamily: 'Impact, Arial Black', fontSize: '43px', color: '#f8db99',
      stroke: '#08121b', strokeThickness: 5,
    }));
    this.phase = s.add.text(58, 204, '', {
      fontFamily: 'Trebuchet MS', fontSize: '19px', fontStyle: 'bold', color: '#bcff66',
      stroke: '#08121b', strokeThickness: 4,
    }).setName('drive-phase');
    this.counter = s.add.text(1218, 160, '', {
      fontFamily: 'Trebuchet MS', fontSize: '24px', color: '#fff4d8',
      stroke: '#08121b', strokeThickness: 4,
    }).setOrigin(1, 0);
    this.layer.add([this.phase, this.counter]);
    this.layer.add(s.add.rectangle(280, 668, 720, 4, 0x263c51).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 668, 1, 4, 0xa9ed52).setOrigin(0, 0.5);
    this.layer.add(this.progress);
    this.layer.add(s.add.text(640, 687, 'Agarre confirmado · Esc para pausar', {
      fontFamily: 'Trebuchet MS', fontSize: '16px', color: '#d2dfdf',
    }).setOrigin(0.5, 0));
  }

  private x(value: number): number { return this.fromRight ? 1280 - value : value; }

  render(t: number, damage: number, reduced: boolean): void {
    const sign = this.fromRight ? -1 : 1, floor = this.floor;
    this.progress.setDisplaySize(720 * t / DRIVE_DURATION, 4);
    this.counter.setText(`${damage} de daño`);
    this.phase.setText(t < 550 ? 'AGARRE' : t < 1450 ? 'AL OTRO LADO DEL ESCENARIO' :
      t < 2450 ? 'CÉSAR SUBE A SU i30' : t < 2600 ? 'MOTOR ENCENDIDO' :
      t < 3300 ? 'A TODA VELOCIDAD' : t < 4050 ? '¡IMPACTO!' : 'DE VUELTA CON SU MONSTER');
    this.caster.setVisible(t < 1650 || t >= 4050).setAlpha(1).setAngle(0);
    this.victim.setVisible(true).setAlpha(1);
    this.entry.setVisible(t >= 1450 && t < 2450);
    this.car.setVisible(t >= 2300 && t < 3900).setAlpha(span(t, 2300, 2450));

    if (t < 550) {
      const q = ease(span(t, 0, 550));
      this.caster.setTexture('cesar-drive-grab').setOrigin(0.5, 0.98242).setPosition(this.x(mix(240, 285, q)), floor);
      this.victim.setPosition(this.x(mix(440, 410, q)), mix(465, 430, q)).setAngle(-sign * 12 * q);
    } else if (t < 1450) {
      const q = span(t, 550, 1450);
      this.caster.setTexture('cesar-drive-throw').setOrigin(0.5, 0.96094).setPosition(this.x(285), floor);
      this.victim.setPosition(this.x(mix(410, 1060, q)), mix(430, 516, q) - Math.sin(q * Math.PI) * 150)
        .setAngle(sign * (reduced ? 80 * q : 440 * q));
    } else if (t < 3300) {
      this.victim.setPosition(this.x(1060), 516).setAngle(sign * 90);
      this.caster.setAlpha(1 - span(t, 1450, 1650));
    } else {
      const q = span(t, 3300, 4000);
      this.victim.setPosition(this.x(mix(1060, 1070, q)), 516 - Math.sin(q * Math.PI) * 220)
        .setAngle(sign * (90 + (reduced ? 0 : 360 * q)));
    }

    const entryQ = ease(span(t, 1450, 1800));
    this.entry.setPosition(this.x(mix(-380, 360, entryQ)), floor).setAlpha(1 - span(t, 2300, 2450));
    let carX = 360;
    if (t >= 2600 && t < 3300) carX = mix(360, 725, Math.pow(span(t, 2600, 3300), 2));
    else if (t >= 3300) carX = mix(725, 1700, span(t, 3300, 3900));
    this.car.setPosition(this.x(carX), floor - (reduced || t < 2600 ? 0 : Math.sin(t * 0.06) * 2));

    if (t >= 4050) {
      const q = ease(span(t, 4050, 4500));
      this.caster.setTexture('cesar-drive-celebrate').setOrigin(0.5, 0.99219)
        .setPosition(this.x(mix(150, 285, q)), floor).setAlpha(q);
    }

    const g = this.road.clear(), fx = this.effects.clear();
    g.fillStyle(0x061019, 0.36).fillEllipse(this.x(285), floor + 4, 200, 20);
    g.fillStyle(0x061019, 0.38).fillEllipse(t < 1450 ? this.victim.x : this.x(1060), floor + 4, 190, 20);
    if (t >= 1450 && t < 3900) {
      const cx = t < 2300 ? mix(-380, 360, entryQ) : carX;
      g.fillStyle(0x061019, 0.5).fillEllipse(this.x(cx), floor + 3, 670, 26);
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
        for (const offset of [-252, 136]) {
          for (let i = 0; i < 3; i++) {
            const angle = t * 0.055 + i * Math.PI * 2 / 3;
            fx.lineStyle(3, 0xd1e9ee, 0.32).beginPath();
            fx.arc(this.x(carX + offset), floor - 54, 47, angle, angle + 0.9).strokePath();
          }
        }
      }
      // Headlights and exhaust dust make the acceleration readable in reduced motion too.
      g.fillStyle(0xd4f5ff, 0.13).fillTriangle(this.x(carX + 305), floor - 105, this.x(carX + 530), floor - 170, this.x(carX + 530), floor - 35);
      for (let i = 0; i < 7; i++) {
        const drift = reduced ? i * 20 : ((t * 0.35 + i * 31) % 180);
        g.fillStyle(0xb6bdbe, 0.15).fillCircle(this.x(carX - 280 - drift), floor - 20 - i * 4, 12 + drift * 0.16);
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
    const shake = !reduced && t >= 3300 && t < 3600 ? Math.sin(t * 0.095) * 8 * (1 - span(t, 3300, 3600)) : 0;
    this.layer.setPosition(shake, shake * 0.35);
  }
}
