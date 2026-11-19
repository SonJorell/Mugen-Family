import Phaser from 'phaser';
import { Fighter } from '../characters/Fighter';
import { FighterStats, RosterEntry } from '../config/roster';
import { GAME_CONFIG } from '../config/gameConfig';
import { CesarDriveSequence } from './CesarDriveSequence';
import { JoakoBuildSequence } from './JoakoBuildSequence';
import { JorellKameSequence } from './JorellKameSequence';
import { TataBikeSequence } from './TataBikeSequence';
import { TilinCantoSequence } from './TilinCantoSequence';
import type { SuperContext, SuperSequence } from './SuperSequence';

type SuperSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
type SequenceFactory = (ctx: SuperContext) => SuperSequence;

const SUPER_SEQUENCES: Record<FighterStats['special'], SequenceFactory> = {
  sonic: ctx => new TilinCantoSequence(ctx.scene, ctx.attacker, ctx.defender, ctx.attackerEntry, ctx.fromRight, ctx.stageTexture),
  drive: ctx => new CesarDriveSequence(ctx.scene, ctx.attacker, ctx.defender, ctx.defenderId, ctx.stageTexture, ctx.fromRight),
  build: ctx => new JoakoBuildSequence(ctx.scene, ctx.attacker, ctx.defender, ctx.stageTexture, ctx.fromRight),
  kame: ctx => new JorellKameSequence(ctx.scene, ctx.attacker, ctx.defender, ctx.defenderId, ctx.stageTexture, ctx.fromRight),
  bike: ctx => new TataBikeSequence(ctx.scene, ctx.attacker, ctx.defender, ctx.defenderId, ctx.stageTexture, ctx.fromRight),
};

/** One simulation-clock timeline owns visuals, damage and cleanup. No delayed damage callbacks. */
export class SuperMove {
  active = false;
  elapsed = 0;
  private beat = 0;
  private damage = 0;
  private attacker?: Fighter;
  private defender?: Fighter;
  private sequence?: SuperSequence;
  private context?: SuperContext;
  private sound?: SuperSound;
  private fromRight = false;
  private controls?: Phaser.GameObjects.Text;
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pauseAudio = () => this.sound?.pause();
  private resumeAudio = () => { if (this.sound?.isPaused) this.sound.resume(); };

  get drive(): CesarDriveSequence | undefined { return this.sequence instanceof CesarDriveSequence ? this.sequence : undefined; }
  get build(): JoakoBuildSequence | undefined { return this.sequence instanceof JoakoBuildSequence ? this.sequence : undefined; }
  get kame(): JorellKameSequence | undefined { return this.sequence instanceof JorellKameSequence ? this.sequence : undefined; }
  get bike(): TataBikeSequence | undefined { return this.sequence instanceof TataBikeSequence ? this.sequence : undefined; }

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
    this.active = true; this.elapsed = 0; this.beat = 0; this.damage = 0;
    this.fromRight = attacker.x > defender.x;
    const context: SuperContext = {
      scene: this.scene,
      attacker,
      defender,
      attackerEntry: this.identify(attacker),
      defenderId: this.identify(defender).id,
      stageTexture: this.stageTexture(),
      fromRight: this.fromRight,
      casterOrigin: { x: attacker.x, y: attacker.y },
    };
    this.context = context;
    attacker.enterSuper(true); defender.enterSuper(false);
    attacker.sprite.setVisible(false); defender.sprite.setVisible(false);
    this.controls = this.scene.children.getByName('fight-controls') as Phaser.GameObjects.Text | undefined;
    this.controls?.setVisible(false);
    const factory = SUPER_SEQUENCES[attacker.stats.special] ?? SUPER_SEQUENCES.sonic;
    this.sequence = factory(context);
    if (this.scene.cache.audio.exists(this.sequence.soundKey)) {
      this.sound = this.scene.sound.add(this.sequence.soundKey, { volume: 0.72 }) as SuperSound;
      this.sound.play();
    }
    this.scene.sound.play('hit-special', { volume: 0.65 });
    this.update(0);
  }

  update(delta: number): void {
    if (!this.active || !this.attacker || !this.defender || !this.sequence || !this.context) return;
    const { beats, duration } = this.sequence;
    this.elapsed = Math.min(duration, this.elapsed + Math.max(0, delta));
    while (this.beat < beats.length && this.elapsed + 0.001 >= beats[this.beat].at) {
      this.damage += this.defender.takeSuperDamage(beats[this.beat].damage);
      this.beat++;
      if (this.beat === beats.length) this.defender.playAnimation('KNOCKDOWN', true);
    }
    this.attacker.updatePresentation(delta); this.defender.updatePresentation(delta);
    this.sequence.render(this.elapsed, this.damage, this.motion.matches);
    if (this.elapsed >= duration) {
      if (this.sequence.commitPosition) {
        this.sequence.commitPosition(this.context);
        // Stun and defeat lock normal turning: commit the cinematic's facing with its landing.
        this.defender.facingRight = this.attacker.x > this.defender.x;
        this.defender.sprite.setFlipX(!this.defender.facingRight);
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

  cancel(restoreFighters = true): void {
    if (this.active && restoreFighters) {
      this.attacker?.leaveSuper(true, !this.fromRight);
      this.defender?.leaveSuper(false, this.fromRight);
    }
    this.active = false;
    if (restoreFighters && this.controls?.scene) this.controls.setVisible(true);
    this.controls = undefined;
    this.sequence?.layer.destroy();
    this.sequence = undefined;
    this.context = undefined;
    this.sound?.destroy(); this.sound = undefined;
    this.attacker = undefined; this.defender = undefined;
  }
}
