import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { RosterEntry } from '../config/roster';
import { superPortraitKey } from '../config/characters';
import { GAME_CONFIG } from '../config/gameConfig';
import { CesarDriveSequence } from './CesarDriveSequence';
import { DRIVE_BEATS, DRIVE_DURATION } from './driveAssets';

const BEATS = [
  { at: 0, damage: 4 }, { at: 900, damage: 7 }, { at: 1200, damage: 7 },
  { at: 1500, damage: 7 }, { at: 1800, damage: 7 }, { at: 2100, damage: 8 }, { at: 2600, damage: 20 },
];
const DURATION = 3000;
type SuperSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

/** One simulation-clock timeline owns visuals, damage and cleanup. No delayed damage callbacks. */
export class SuperMove {
  active = false;
  elapsed = 0;
  private beat = 0;
  private damage = 0;
  private attacker?: Fighter;
  private defender?: Fighter;
  private layer?: Phaser.GameObjects.Container;
  private art!: Phaser.GameObjects.Graphics;
  private portrait!: Phaser.GameObjects.Image;
  private caster!: Phaser.GameObjects.Image;
  private victim!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Rectangle;
  private sound?: SuperSound;
  private casterX = 330;
  private victimX = 950;
  private fromRight = false;
  private expanded = false;
  private controls?: Phaser.GameObjects.Text;
  private drive?: CesarDriveSequence;
  private casterOrigin = { x: 0, y: 0 };
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pauseAudio = () => this.sound?.pause();
  private resumeAudio = () => { if (this.sound?.isPaused) this.sound.resume(); };

  constructor(private scene: Phaser.Scene, private identify: (fighter: Fighter) => RosterEntry,
    private stageTexture: () => string = () => GAME_CONFIG.STAGES[0].textureKey) {
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pauseAudio);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resumeAudio);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // The scene display list may already have destroyed its fighters.
      this.cancel(false);
      scene.events.off(Phaser.Scenes.Events.PAUSE, this.pauseAudio);
      scene.events.off(Phaser.Scenes.Events.RESUME, this.resumeAudio);
    });
  }

  start(attacker: Fighter, defender: Fighter): void {
    if (this.active || !defender.canReceiveHit || attacker.currentHealth <= 0) return;
    this.attacker = attacker; this.defender = defender;
    this.active = true; this.elapsed = 0; this.beat = 0; this.damage = 0; this.expanded = false;
    this.fromRight = attacker.x > defender.x;
    this.casterOrigin = { x: attacker.x, y: attacker.y };
    this.casterX = this.fromRight ? 950 : 330; this.victimX = this.fromRight ? 330 : 950;
    attacker.enterSuper(true); defender.enterSuper(false);
    attacker.sprite.setVisible(false); defender.sprite.setVisible(false);
    this.controls = this.scene.children.getByName('fight-controls') as Phaser.GameObjects.Text | undefined;
    this.controls?.setVisible(false);
    if (attacker.stats.special === 'drive') {
      this.drive = new CesarDriveSequence(this.scene, attacker, defender, this.identify(defender).id, this.stageTexture(), this.fromRight);
      this.layer = this.drive.layer;
    } else this.createArt();
    const soundKey = this.drive ? 'super-drive' : 'super-canto';
    if (this.scene.cache.audio.exists(soundKey)) {
      this.sound = this.scene.sound.add(soundKey, { volume: 0.72 }) as SuperSound;
      this.sound.play();
    }
    this.scene.sound.play('hit-special', { volume: 0.65 });
    this.update(0);
  }

  private createArt(): void {
    const s = this.scene;
    this.layer = s.add.container(0, 0).setDepth(45).setScrollFactor(0).setName('super-cinematic');
    this.layer.add(s.add.rectangle(640, 360, 1280, 720, 0x071321, 0.95));
    this.art = s.add.graphics(); this.layer.add(this.art);
    this.caster = s.add.image(this.casterX, 605, this.attacker!.sprite.texture.key).setOrigin(0.5, 0.975)
      .setScale(1.06).setFlipX(this.fromRight).setTint(this.attacker!.sprite.tintTopLeft);
    this.victim = s.add.image(this.victimX, 605, this.defender!.sprite.texture.key).setOrigin(0.5, 0.975)
      .setScale(1.06).setFlipX(!this.fromRight).setTint(this.defender!.sprite.tintTopLeft);
    this.layer.add([this.caster, this.victim]);
    const caster = this.identify(this.attacker!);
    this.portrait = s.add.image(this.fromRight ? 890 : 390, 399, superPortraitKey(caster.id))
      .setDisplaySize(780, 520).setFlipX(this.fromRight).setTint(this.attacker!.sprite.tintTopLeft);
    this.layer.add(this.portrait);
    this.title = s.add.text(this.fromRight ? 360 : 900, 220, caster.superName, {
      fontFamily: 'Impact, Arial Black', fontSize: '66px', color: '#fff3d8', align: 'center',
      stroke: '#143a51', strokeThickness: 4, lineSpacing: -6,
    }).setOrigin(0.5, 0);
    this.counter = s.add.text(this.fromRight ? 360 : 900, 402, `El poder de ${caster.name}`, {
      fontFamily: 'Trebuchet MS', fontSize: '22px', color: '#f5bd75',
    }).setOrigin(0.5, 0);
    this.layer.add([this.title, this.counter]);
    this.layer.add(s.add.rectangle(280, 653, 720, 4, 0x263c51).setOrigin(0, 0.5));
    this.progress = s.add.rectangle(280, 653, 1, 4, 0x9fe8e1).setOrigin(0, 0.5);
    this.layer.add(this.progress);
    this.layer.add(s.add.text(640, 677, 'Súper confirmado · Esc para pausar', {
      fontFamily: 'Trebuchet MS', fontSize: '17px', color: '#c7d6dd',
    }).setOrigin(0.5, 0));
  }

  update(delta: number): void {
    if (!this.active || !this.attacker || !this.defender) return;
    const beats = this.drive ? DRIVE_BEATS : BEATS, duration = this.drive ? DRIVE_DURATION : DURATION;
    this.elapsed = Math.min(duration, this.elapsed + Math.max(0, delta));
    while (this.beat < beats.length && this.elapsed + 0.001 >= beats[this.beat].at) {
      this.damage += this.defender.takeSuperDamage(beats[this.beat].damage);
      this.beat++;
      if (this.beat === beats.length) this.defender.playAnimation('KNOCKDOWN', true);
    }
    this.attacker.updatePresentation(delta); this.defender.updatePresentation(delta);
    if (this.drive) this.drive.render(this.elapsed, this.damage, this.motion.matches);
    else this.render();
    if (this.elapsed >= duration) {
      if (this.drive) {
        // Commit the throw only on completion; cancelling never teleports either fighter.
        this.attacker.x = this.casterOrigin.x; this.attacker.y = this.casterOrigin.y;
        this.defender.x = this.fromRight ? 180 : GAME_CONFIG.STAGE_WIDTH - 180;
        this.defender.y = GAME_CONFIG.FLOOR_Y;
        this.defender.isGrounded = true; this.defender.velocityY = 0;
        this.attacker.sprite.setPosition(this.attacker.x, this.attacker.y);
        this.defender.sprite.setPosition(this.defender.x, this.defender.y);
        this.scene.cameras.main.scrollX = Phaser.Math.Clamp(
          (this.attacker.x + this.defender.x - GAME_CONFIG.WIDTH) / 2,
          0, GAME_CONFIG.STAGE_WIDTH - GAME_CONFIG.WIDTH);
        this.scene.cameras.main.scrollY = 0;
      }
      this.cancel();
    }
  }

  private render(): void {
    const t = this.elapsed, reduced = this.motion.matches;
    const intro = t < 800;
    this.caster.setTexture(this.attacker!.sprite.texture.key).setVisible(!intro);
    this.victim.setTexture(this.defender!.sprite.texture.key).setVisible(!intro);
    this.portrait.setAlpha(intro ? 1 : Math.max(0, 1 - (t - 800) / 180));
    if (!intro && !this.expanded) {
      this.expanded = true;
      this.title.setText(this.identify(this.attacker!).superName.replace('\n', ' ')).setFontSize(40).setPosition(640, 153);
      this.counter.setPosition(640, 210);
    }
    if (!intro) this.counter.setText(`${this.beat} impactos   ·   ${this.damage} de daño`);
    this.progress.setDisplaySize(720 * t / DURATION, 4);
    const sinceHit = t - BEATS[Math.max(0, this.beat - 1)].at;
    const pulse = Math.max(0, 1 - sinceHit / 230);
    const direction = this.fromRight ? -1 : 1;
    this.victim.setX(this.victimX + (reduced ? 0 : Math.sin(sinceHit * 0.11) * pulse * 10));
    const g = this.art.clear();
    // Broad quiet light cones keep the portrait readable before the full vocal barrage.
    g.fillStyle(0x143a51, 0.5).fillTriangle(0, 640, 640, 170, 1280, 640);
    g.lineStyle(2, 0xf5bd75, 0.5).lineBetween(40, 140, 1240, 140);
    if (intro) {
      for (let i = 0; i < 5; i++) {
        g.lineStyle(2, 0x9fe8e1, 0.12 + i * 0.02);
        g.strokeCircle(this.fromRight ? 900 : 380, 390, 120 + i * 47 + (reduced ? 0 : t * 0.035));
      }
      return;
    }
    const mouth = this.casterX + direction * 54;
    g.fillStyle(0x9fe8e1, 0.06 + pulse * 0.1)
      .fillTriangle(mouth, 315, this.victimX + direction * 70, 230, this.victimX + direction * 70, 590);
    for (let i = 0; i < 6; i++) {
      const travel = reduced ? i / 6 : ((t - 800) / 520 + i / 6) % 1;
      const x = mouth + (this.victimX - mouth) * travel;
      const size = 75 + travel * 150;
      g.lineStyle(8 - travel * 4, i % 2 ? 0xf5bd75 : 0x9fe8e1, 0.7 * (1 - travel * 0.5));
      g.strokeEllipse(x, 315 + travel * 80, 30 + travel * 50, size);
    }
    // Musical notes and concentric pressure rings are driven by the same beat as damage.
    for (let i = 0; i < 8; i++) {
      const x = 480 + (i % 4) * 95, y = 285 + Math.floor(i / 4) * 220 - (reduced ? 0 : Math.sin(t / 240 + i) * 20);
      g.fillStyle(i % 2 ? 0xf5bd75 : 0x9fe8e1, 0.6).fillEllipse(x, y, 12, 8);
      g.lineStyle(2, 0xfff3d8, 0.6).lineBetween(x + 5, y, x + 5, y - 24);
    }
    if (pulse > 0) {
      const final = this.beat === BEATS.length;
      for (let i = 0; i < (final ? 5 : 3); i++) {
        g.lineStyle(final ? 6 : 3, i % 2 ? 0x9fe8e1 : 0xf5bd75, pulse * 0.8);
        g.strokeCircle(this.victimX, 395, 45 + i * 40 + (reduced ? 0 : (1 - pulse) * 90));
      }
      if (final) g.lineStyle(8, 0xf5bd75, pulse * 0.7).strokeRect(12, 143, 1256, 497);
    }
  }

  cancel(restoreFighters = true): void {
    if (this.active && restoreFighters) {
      this.attacker?.leaveSuper(true, !this.fromRight);
      this.defender?.leaveSuper(false, this.fromRight);
    }
    this.active = false;
    if (restoreFighters && this.controls?.scene) this.controls.setVisible(true);
    this.controls = undefined;
    this.layer?.destroy(); this.layer = undefined;
    this.drive = undefined;
    this.sound?.destroy(); this.sound = undefined;
    this.attacker = undefined; this.defender = undefined;
  }
}
