import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';

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
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pauseAudio = () => this.sound?.pause();
  private resumeAudio = () => { if (this.sound?.isPaused) this.sound.resume(); };

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pauseAudio);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resumeAudio);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancel();
      scene.events.off(Phaser.Scenes.Events.PAUSE, this.pauseAudio);
      scene.events.off(Phaser.Scenes.Events.RESUME, this.resumeAudio);
    });
  }

  start(attacker: Fighter, defender: Fighter): void {
    if (this.active || !defender.canReceiveHit || attacker.currentHealth <= 0) return;
    this.attacker = attacker; this.defender = defender;
    this.active = true; this.elapsed = 0; this.beat = 0; this.damage = 0; this.expanded = false;
    this.fromRight = attacker.x > defender.x;
    this.casterX = this.fromRight ? 950 : 330; this.victimX = this.fromRight ? 330 : 950;
    attacker.enterSuper(true); defender.enterSuper(false);
    attacker.sprite.setVisible(false); defender.sprite.setVisible(false);
    this.createArt();
    if (this.scene.cache.audio.exists('super-canto')) {
      this.sound = this.scene.sound.add('super-canto', { volume: 0.72 }) as SuperSound;
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
    this.portrait = s.add.image(this.fromRight ? 890 : 390, 399, 'tilin_super_portrait')
      .setDisplaySize(780, 520).setFlipX(this.fromRight).setTint(this.attacker!.sprite.tintTopLeft);
    this.layer.add(this.portrait);
    this.title = s.add.text(this.fromRight ? 360 : 900, 220, 'CANTO\nRESONANTE', {
      fontFamily: 'Impact, Arial Black', fontSize: '66px', color: '#fff3d8', align: 'center',
      stroke: '#143a51', strokeThickness: 4, lineSpacing: -6,
    }).setOrigin(0.5, 0);
    this.counter = s.add.text(this.fromRight ? 360 : 900, 402, 'El poder de Tilin', {
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
    this.elapsed = Math.min(DURATION, this.elapsed + Math.max(0, delta));
    while (this.beat < BEATS.length && this.elapsed + 0.001 >= BEATS[this.beat].at) {
      this.damage += this.defender.takeSuperDamage(BEATS[this.beat].damage);
      this.beat++;
      if (this.beat === BEATS.length) this.defender.playAnimation('KNOCKDOWN', true);
    }
    this.attacker.updatePresentation(delta); this.defender.updatePresentation(delta);
    this.render();
    if (this.elapsed >= DURATION) this.cancel();
  }

  private render(): void {
    const t = this.elapsed, reduced = this.motion.matches;
    const intro = t < 800;
    this.caster.setTexture(this.attacker!.sprite.texture.key).setVisible(!intro);
    this.victim.setTexture(this.defender!.sprite.texture.key).setVisible(!intro);
    this.portrait.setAlpha(intro ? 1 : Math.max(0, 1 - (t - 800) / 180));
    if (!intro && !this.expanded) {
      this.expanded = true;
      this.title.setText('CANTO RESONANTE').setFontSize(40).setPosition(640, 153);
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
    const mouth = this.casterX + direction * 72;
    g.fillStyle(0x9fe8e1, 0.06 + pulse * 0.1)
      .fillTriangle(mouth, 368, this.victimX + direction * 70, 230, this.victimX + direction * 70, 590);
    for (let i = 0; i < 6; i++) {
      const travel = reduced ? i / 6 : ((t - 800) / 520 + i / 6) % 1;
      const x = mouth + (this.victimX - mouth) * travel;
      const size = 75 + travel * 150;
      g.lineStyle(8 - travel * 4, i % 2 ? 0xf5bd75 : 0x9fe8e1, 0.7 * (1 - travel * 0.5));
      g.strokeEllipse(x, 390, 30 + travel * 50, size);
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

  cancel(): void {
    if (this.active) {
      this.attacker?.leaveSuper(true, !this.fromRight);
      this.defender?.leaveSuper(false, this.fromRight);
    }
    this.active = false;
    this.layer?.destroy(); this.layer = undefined;
    this.sound?.destroy(); this.sound = undefined;
    this.attacker = undefined; this.defender = undefined;
  }
}
