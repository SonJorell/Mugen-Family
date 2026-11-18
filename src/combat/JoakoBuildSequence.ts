import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { superPortraitKey } from '../config/characters';
import { JoakoRiflePose } from './JoakoRiflePose';
import { drawJoakoConstruction, JOAKO_FORT } from './JoakoConstruction';

export const BUILD_DURATION = 5200;
export const BUILD_BEATS = [
  { at: 0, damage: 10 },
  { at: 2850, damage: 8 }, { at: 3200, damage: 8 }, { at: 3550, damage: 8 },
  { at: 3900, damage: 8 }, { at: 4350, damage: 18 },
] as const;
const span = (t: number, start: number, end: number) => Phaser.Math.Clamp((t - start) / (end - start), 0, 1);

/** Construction, climbing and the volley all follow the combat clock, including pause and cancel. */
export class JoakoBuildSequence {
  readonly layer: Phaser.GameObjects.Container;
  private readonly wall: Phaser.GameObjects.Graphics;
  private readonly stairs: Phaser.GameObjects.Graphics;
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly caster: Phaser.GameObjects.Image;
  private readonly rifle: JoakoRiflePose;
  private readonly victim: Phaser.GameObjects.Image;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Rectangle;
  private readonly floor = JOAKO_FORT.floor;
  private readonly direction: number;

  constructor(private scene: Phaser.Scene, private attacker: Fighter, private defender: Fighter,
    stage: string, private fromRight: boolean) {
    const s = scene;
    this.direction = fromRight ? -1 : 1;
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.layer.add(s.add.image(640, 360, stage).setDisplaySize(1280, 720).setTint(0x7691b0));
    this.layer.add(s.add.rectangle(640, 360, 1280, 720, 0x071222, 0.3));
    this.layer.add(s.add.rectangle(640, 61, 1280, 122, 0x071222, 0.95));
    this.layer.add(s.add.rectangle(640, 666, 1280, 108, 0x071222, 0.95));
    this.wall = s.add.graphics().setName('joako-wall');
    this.stairs = s.add.graphics().setName('joako-stairs');
    this.caster = s.add.image(this.x(260), this.floor, attacker.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(0.72 * attacker.stats.size).setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft).setName('joako-caster');
    this.victim = s.add.image(this.x(1000), this.floor, defender.sprite.texture.key)
      .setOrigin(0.5, 0.975).setScale(0.72 * defender.stats.size).setFlipX(!fromRight)
      .setTint(defender.sprite.tintTopLeft).setName('joako-victim');
    this.effects = s.add.graphics();
    this.portrait = s.add.image(this.x(285), 390, superPortraitKey('joako')).setDisplaySize(300, 450)
      .setFlipX(fromRight).setTint(attacker.sprite.tintTopLeft);
    this.layer.add([this.wall, this.stairs, this.caster]);
    this.rifle = new JoakoRiflePose(s, this.caster, this.direction);
    this.layer.add([this.victim, this.effects, this.portrait]);
    this.title = s.add.text(this.x(665), 225, 'CANCHA Y\nCONSTRUCCIÓN', {
      fontFamily: 'Impact, Arial Black', fontSize: '48px', color: '#9ce8ff',
      stroke: '#10253c', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5, 0);
    this.layer.add(this.title);
    this.phase = s.add.text(54, 641, '', {
      fontFamily: 'Impact, Arial Black', fontSize: '27px', color: '#fff0ca',
    }).setOrigin(0, 0.5).setName('joako-phase');
    this.counter = s.add.text(1226, 641, '', { fontFamily: 'Trebuchet MS', fontSize: '22px', color: '#fff0ca' }).setOrigin(1, 0.5);
    this.layer.add(s.add.rectangle(280, 676, 720, 4, 0x28445d).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 676, 1, 4, 0x9ce8ff).setOrigin(0, 0.5);
    this.layer.add([this.phase, this.counter, this.progress]);
    this.layer.add(s.add.text(640, 693, 'Esc para pausar', { fontFamily: 'Trebuchet MS', fontSize: '14px', color: '#b5cad8' }).setOrigin(0.5));
  }

  private x(value: number): number { return this.fromRight ? 1280 - value : value; }

  private pose(name: string, frame: number): void {
    const frames = this.scene.anims.get(`joako_anim_${name}`)?.frames ?? [];
    const key = frames[Phaser.Math.Clamp(Math.floor(frame), 0, frames.length - 1)]?.textureKey;
    if (key && this.scene.textures.exists(key)) this.caster.setTexture(key);
  }

  render(t: number, damage: number, reduced: boolean): void {
    const intro = t < 800, shooting = t >= 2650 && t < 4550;
    this.portrait.setVisible(intro).setAlpha(1 - span(t, 620, 800));
    this.title.setVisible(intro);
    this.caster.setVisible(!intro);
    this.victim.setTexture(this.defender.sprite.texture.key);
    const climb = Phaser.Math.Easing.Sine.InOut(span(t, 2050, 2470));
    const crossDeck = Phaser.Math.Easing.Sine.InOut(span(t, 2470, 2650));
    const landingX = JOAKO_FORT.stairX + JOAKO_FORT.stairRun;
    this.caster.setPosition(this.x(JOAKO_FORT.casterStart + climb * (landingX - JOAKO_FORT.casterStart)
      + crossDeck * (JOAKO_FORT.casterX - landingX)), this.floor - climb * JOAKO_FORT.deckHeight);
    if (t < 900) this.pose('SPECIAL_ATTACK', 5);
    else if (t < 2050) this.pose('BUILD', 1 + Math.floor((t - 900) / 100) % 5);
    else if (t < 2650) this.pose('DASH', Math.floor((t - 2050) / 90) % 6);
    else if (shooting) this.pose('FIRE', 2);
    else {
      const dance = this.scene.anims.get('joako_anim_VICTORY');
      this.pose('VICTORY', Math.floor((t - 4550) * (dance?.frameRate ?? 18) / 1000) % (dance?.frames.length || 1));
    }

    const lastHit = [...BUILD_BEATS].reverse().find(b => b.at <= t)!;
    const age = t - lastHit.at, pulse = Math.max(0, 1 - age / 200);
    const recoil = lastHit.at > 0 ? Math.sin(Math.min(1, age / 180) * Math.PI) : 0;
    this.rifle.render(shooting, t, recoil, reduced);
    this.wall.setPosition(this.x(JOAKO_FORT.wallX), this.floor).setScale(this.direction, 1);
    this.stairs.setPosition(this.x(JOAKO_FORT.stairX), this.floor).setScale(this.direction, 1);
    drawJoakoConstruction(this.wall, this.stairs, t, reduced);
    this.victim.setX(this.x(1000) + (reduced ? 0 : this.direction * Math.sin(age * 0.07) * pulse * 9));
    this.phase.setText(intro ? 'JOAKO · ¡PELOTAZO!'
      : t < 1400 ? '¡MURALLA!' : t < 2050 ? '¡ESCALERA!' : t < 2650 ? 'GANANDO ALTURA'
        : t < 4550 ? '¡RÁFAGA DESDE ARRIBA!' : '¡TRABAJO TERMINADO!');
    this.counter.setText(`${BUILD_BEATS.filter(b => b.at <= t).length} impactos  ·  ${damage} de daño`);
    this.progress.setDisplaySize(720 * t / BUILD_DURATION, 4);

    const g = this.effects.clear();
    const headY = this.floor - 220 * this.defender.stats.size;
    if (t < 850) {
      const q = span(t, 0, 650), ballX = this.x(972 - q * 85), ballY = headY - Math.sin(q * Math.PI) * 95 + q * 90;
      g.fillStyle(0xfff4dd).fillCircle(ballX, ballY, 24);
      g.fillStyle(0x152c44).fillCircle(ballX, ballY, 9);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + t * 0.01;
        g.fillCircle(ballX + Math.cos(a) * 19, ballY + Math.sin(a) * 19, 5);
      }
    }
    if (t < 4350) for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + (reduced ? 0 : t * 0.006);
      const x = this.x(1000) + Math.cos(a) * 34, y = headY - 24 + Math.sin(a) * 9;
      g.fillStyle(0xffdc77).fillTriangle(x, y - 6, x - 6, y + 5, x + 6, y + 5);
    }
    if (lastHit.at > 0 && age < 180) {
      const { x: muzzleX, y: muzzleY } = this.rifle.muzzle();
      const targetX = this.x(1000), targetY = headY + 24;
      // A brief rifle tracer and a compact directional flash, not a lingering beam.
      const flashAlpha = Math.max(0, 1 - age / 65);
      const angle = Math.atan2(targetY - muzzleY, targetX - muzzleX);
      const dx = Math.cos(angle), dy = Math.sin(angle), flash = reduced ? 5 : 11;
      g.lineStyle(reduced ? 1.5 : 2.5, 0xffd98e, flashAlpha).lineBetween(muzzleX, muzzleY, targetX, targetY);
      g.fillStyle(0xffb84f, flashAlpha).fillTriangle(muzzleX - dy * flash / 2, muzzleY + dx * flash / 2,
        muzzleX + dx * flash * 2, muzzleY + dy * flash * 2, muzzleX + dy * flash / 2, muzzleY - dx * flash / 2);
      g.fillStyle(0xfff4ce, flashAlpha).fillCircle(muzzleX, muzzleY, reduced ? 3 : 5);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r = reduced ? 25 : 20 + age * 0.22;
        g.lineStyle(3, i % 2 ? 0xffdc77 : 0x9ce8ff, pulse)
          .lineBetween(targetX + Math.cos(a) * 12, targetY + Math.sin(a) * 12, targetX + Math.cos(a) * r, targetY + Math.sin(a) * r);
      }
    }
  }

}

