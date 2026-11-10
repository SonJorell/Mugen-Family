// ============================================================
// FightScene — Main combat scene
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader } from '../animation/SpriteSheetLoader';
import { PlayerFighter } from '../characters/PlayerFighter';
import { TrainingOpponent } from '../characters/TrainingOpponent';
import { ComputerOpponent } from '../characters/ComputerOpponent';
import { Fighter } from '../characters/Fighter';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { InputManager } from '../input/InputManager';
import { FacingSystem } from '../systems/FacingSystem';
import { FighterController } from '../systems/FighterController';
import { RoundSystem, RoundWinner, RoundEndReason } from '../systems/RoundSystem';
import { HUD } from '../ui/HUD';
import { FightMessages } from '../ui/FightMessages';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FighterChoice, fighterPalette, normalizeChoice, rosterEntry } from '../config/roster';
import { CharacterManifest, createAliasLoader, createCharacterLoader, getManifest } from '../config/characters';
import { SuperMove } from '../combat/SuperMove';

/** Starting marks, reused at the start of every round. */
const PLAYER_START_X = GAME_CONFIG.STAGE_WIDTH * 0.35;
const OPPONENT_START_X = GAME_CONFIG.STAGE_WIDTH * 0.65;

export class FightScene extends Phaser.Scene {
  private manifest!: CharacterManifest;
  private playerManifest!: CharacterManifest;
  private opponentManifest!: CharacterManifest;

  private player!: PlayerFighter;
  private opponent!: Fighter;
  private mode: 'cpu' | 'training' = 'cpu';
  private playerChoice = normalizeChoice();
  private opponentChoice = normalizeChoice(undefined, 'amethyst');
  private bodyPhysics = new PhysicsSystem();

  private registry2!: AnimationRegistry;
  private loader!: SpriteSheetLoader;
  private opponentRegistry!: AnimationRegistry;
  private opponentLoader!: SpriteSheetLoader;

  private facingSystem = new FacingSystem();
  private fighterController = new FighterController();
  private superMove!: SuperMove;
  private roundSystem!: RoundSystem;
  private hud!: HUD;
  private messages!: FightMessages;

  private debugKey!: Phaser.Input.Keyboard.Key;
  private inputManager!: InputManager;
  private stageIndex: number = 0;
  private stageBgImage!: Phaser.GameObjects.Image;
  private fighterShadows: Phaser.GameObjects.Ellipse[] = [];

  // Stage graphics
  private stageLayer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'FightScene' });
  }

  init(data: { manifest: CharacterManifest; stageIndex?: number; mode?: 'cpu' | 'training'; playerChoice?: FighterChoice; opponentChoice?: FighterChoice }): void {
    this.stageIndex = GAME_CONFIG.STAGES[data?.stageIndex ?? 0] ? data?.stageIndex ?? 0 : 0;
    this.mode = data?.mode === 'training' ? 'training' : 'cpu';
    this.playerChoice = normalizeChoice(data?.playerChoice);
    this.opponentChoice = normalizeChoice(data?.opponentChoice, 'amethyst');
    this.playerManifest = getManifest(this, this.playerChoice.characterId);
    this.opponentManifest = getManifest(this, this.opponentChoice.characterId);
    // Menu and selection scenes still receive this to return to the same state.
    this.manifest = data?.manifest ?? this.playerManifest;
  }

  create(): void {
    isolateSceneKeyboard(this);
    const audio = GameAudio.for(this);
    audio.play('music-fight');
    musicControls(this, 1250, 138);
    this.events.on(Phaser.Scenes.Events.PAUSE, audio.pause, audio);
    this.events.on(Phaser.Scenes.Events.RESUME, audio.resume, audio);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, audio.pause, audio);
      this.events.off(Phaser.Scenes.Events.RESUME, audio.resume, audio);
      audio.stop();
    });
    const htmlVideo = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (htmlVideo) {
      htmlVideo.style.display = 'none';
      htmlVideo.pause();
    }

    if (!this.playerManifest || !this.opponentManifest) {
      console.error('[FightScene] No manifest found — returning to menu.');
      this.scene.start('MenuScene');
      return;
    }

    this.createStage();
    this.setupAnimations();
    this.createFighters();
    this.fighterShadows = [this.player, this.opponent].map(fighter =>
      this.add.ellipse(fighter.x, GAME_CONFIG.FLOOR_Y + 2, 150, 16, 0x09121a, 0.26).setDepth(1));
    this.createSystems();
    this.add.text(GAME_CONFIG.WIDTH / 2, 682,
      'A D / ← →  Mover    W / ↑ ×2  Doble salto    S / ↓  Agacharse    J K  Puños    U I  Patadas    L  Bloquear    O  Poder',
      { fontFamily: 'Arial', fontSize: '16px', color: '#eee8d9', backgroundColor: '#12151c', padding: { x: 16, y: 10 } }
    ).setOrigin(0.5).setDepth(60).setScrollFactor(0).setName('fight-controls');
    this.add.text(GAME_CONFIG.WIDTH - 26, 92, 'Pausa · Esc', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffdd77', backgroundColor: '#12151c', padding: { x: 12, y: 8 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(60).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.pauseFight());

    this.debugKey = this.input.keyboard!.addKey('F1');
    this.input.keyboard!.on('keydown-F1', () => {
      GAME_CONFIG.DEBUG_MODE = !GAME_CONFIG.DEBUG_MODE;
      GAME_CONFIG.SHOW_DEBUG_TEXT = GAME_CONFIG.DEBUG_MODE;
    });
    this.input.keyboard!.on('keydown-F2', () => this.cycleStage());
    this.input.keyboard!.on('keydown-F11', () => {
      if (!this.scale.isFullscreen) this.scale.startFullscreen();
      else this.scale.stopFullscreen();
    });
    this.input.keyboard!.on('keydown-ESC', (event: KeyboardEvent) => { if (!event.repeat) this.pauseFight(); });
    this.game.events.on(Phaser.Core.Events.BLUR, this.pauseFight, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.pauseFight, this);
      this.inputManager.destroy();
    });
  }

  // ── Stage ─────────────────────────────────────────────────

  private createStage(): void {
    const W = GAME_CONFIG.STAGE_WIDTH;
    const H = GAME_CONFIG.STAGE_HEIGHT;
    const currentStage = GAME_CONFIG.STAGES[this.stageIndex] ?? GAME_CONFIG.STAGES[0];

    // Background image
    if (this.textures.exists(currentStage.textureKey)) {
      this.stageBgImage = this.add.image(W / 2, H / 2, currentStage.textureKey).setDepth(0);
      this.stageBgImage.setDisplaySize(W, H);
    } else {
      this.drawCityBackground(W, H);
    }

    // Stage boundary indicators
    this.add.rectangle(40, GAME_CONFIG.FLOOR_Y - 100, 6, 200, 0xcc3333, 0.4).setDepth(3);
    this.add.rectangle(W - 40, GAME_CONFIG.FLOOR_Y - 100, 6, 200, 0xcc3333, 0.4).setDepth(3);

    // Debug grid
    if (GAME_CONFIG.DEBUG_MODE) {
      const dbg = this.add.graphics().setDepth(5);
      dbg.lineStyle(1, 0x444444, 0.3);
      for (let x = 0; x < W; x += 100) {
        dbg.lineBetween(x, 0, x, H);
      }
      for (let y = 0; y < H; y += 100) {
        dbg.lineBetween(0, y, W, y);
      }
      dbg.lineStyle(2, 0xff6600, 0.6);
      dbg.lineBetween(0, GAME_CONFIG.FLOOR_Y, W, GAME_CONFIG.FLOOR_Y);
    }

    // Camera setup
    // The top 80 px remain covered by the fixed HUD when following a double jump.
    this.cameras.main.setBounds(0, -80, W, GAME_CONFIG.HEIGHT + 80);
    this.cameras.main.scrollY = 0;
    this.cameras.main.setZoom(GAME_CONFIG.CAMERA_ZOOM);
  }

  private cycleStage(): void {
    const total = GAME_CONFIG.STAGES.length;
    this.stageIndex = (this.stageIndex + 1) % total;
    const currentStage = GAME_CONFIG.STAGES[this.stageIndex];
    if (this.stageBgImage && this.textures.exists(currentStage.textureKey)) {
      this.stageBgImage.setTexture(currentStage.textureKey);
      this.stageBgImage.setDisplaySize(GAME_CONFIG.STAGE_WIDTH, GAME_CONFIG.STAGE_HEIGHT);
    }
    console.log(`[FightScene] Switched stage to: ${currentStage.name}`);
  }

  private drawCityBackground(W: number, H: number): void {
    const g = this.add.graphics().setDepth(0);

    // Buildings
    const buildings = [
      { x: 100, w: 120, h: 300, color: 0x1a1a3e },
      { x: 250, w: 80,  h: 200, color: 0x111128 },
      { x: 450, w: 140, h: 350, color: 0x0d0d20 },
      { x: 700, w: 90,  h: 280, color: 0x1a1a3e },
      { x: 900, w: 160, h: 320, color: 0x111128 },
      { x: 1100, w: 100, h: 250, color: 0x0d0d20 },
      { x: 1300, w: 130, h: 300, color: 0x1a1a3e },
      { x: 1500, w: 80,  h: 220, color: 0x111128 },
      { x: 1700, w: 150, h: 360, color: 0x0d0d20 },
      { x: 1950, w: 100, h: 280, color: 0x1a1a3e },
      { x: 2100, w: 120, h: 300, color: 0x111128 },
      { x: 2250, w: 80,  h: 200, color: 0x0d0d20 },
    ];

    for (const b of buildings) {
      g.fillStyle(b.color);
      g.fillRect(b.x, GAME_CONFIG.FLOOR_Y - b.h, b.w, b.h);

      // Windows
      g.fillStyle(0x334455, 0.8);
      for (let wy = GAME_CONFIG.FLOOR_Y - b.h + 20; wy < GAME_CONFIG.FLOOR_Y - 20; wy += 30) {
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 25) {
          if (Math.random() > 0.4) {
            g.fillRect(wx, wy, 12, 12);
          }
        }
      }
    }

    // Moon / light source
    g.fillStyle(0xddddff, 0.9);
    g.fillCircle(W * 0.8, 80, 40);
    g.fillStyle(0x8888dd, 0.2);
    g.fillCircle(W * 0.8, 80, 70);
  }

  // ── Animation Setup ───────────────────────────────────────

  private setupAnimations(): void {
    // Each fighter's textures are processed under its own character id.
    const player = createCharacterLoader(this, this.playerManifest);
    this.registry2 = player.registry;
    this.loader = player.loader;
    if (this.opponentManifest.characterId !== this.playerManifest.characterId) {
      createCharacterLoader(this, this.opponentManifest);
    }

    // The rival reuses those processed textures through a per-character alias, so its
    // animation keys never collide with the player's nor with a different earlier rival.
    const rival = createAliasLoader(this, `${this.opponentManifest.characterId}_rival`, this.opponentManifest);
    this.opponentRegistry = rival.registry;
    this.opponentLoader = rival.loader;

    console.log(`[FightScene] Available animations: ${this.registry2.getAvailable().join(', ')}`);
  }

  // ── Fighters ──────────────────────────────────────────────

  private createFighters(): void {
    this.inputManager = new InputManager(this);

    this.player = new PlayerFighter({
      scene: this,
      registry: this.registry2,
      loader: this.loader,
      characterId: this.playerManifest.characterId,
      x: PLAYER_START_X,
      y: GAME_CONFIG.FLOOR_Y,
      maxHealth: rosterEntry(this.playerChoice.characterId).stats.maxHealth,
      scale: GAME_CONFIG.CHAR_SCALE,
      stats: rosterEntry(this.playerChoice.characterId).stats,
    }, this.inputManager);

    const OpponentClass = this.mode === 'training' ? TrainingOpponent : ComputerOpponent;
    this.opponent = new OpponentClass({
      scene: this,
      registry: this.opponentRegistry,
      loader: this.opponentLoader,
      characterId: 'dummy',
      x: OPPONENT_START_X,
      y: GAME_CONFIG.FLOOR_Y,
      maxHealth: rosterEntry(this.opponentChoice.characterId).stats.maxHealth,
      scale: GAME_CONFIG.CHAR_SCALE,
      stats: rosterEntry(this.opponentChoice.characterId).stats,
    });
    this.player.sprite.setTint(fighterPalette(this.playerChoice).tint);
    this.opponent.sprite.setTint(fighterPalette(this.opponentChoice).tint);
    this.facingSystem.update(this.player, this.opponent);
  }

  // ── Systems ───────────────────────────────────────────────

  private createSystems(): void {
    this.superMove = new SuperMove(this, fighter =>
      rosterEntry(fighter === this.player ? this.playerChoice.characterId : this.opponentChoice.characterId));
    this.fighterController.onSuperHit = (attacker, defender) => this.superMove.start(attacker, defender);
    this.roundSystem = new RoundSystem(this);
    this.roundSystem.onRoundEnd = (winner, reason) => this.onRoundEnd(winner, reason);

    const playerName = rosterEntry(this.playerChoice.characterId).name.toUpperCase();
    const opponentName = rosterEntry(this.opponentChoice.characterId).name.toUpperCase();
    this.hud = new HUD(this, `${playerName} · JUGADOR`, this.mode === 'training' ? 'MUÑECO · PRÁCTICA' : `${opponentName} · CPU`,
      this.player.maxHealth, this.opponent.maxHealth);
    this.messages = new FightMessages(this);
    this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);

    this.roundSystem.startRound();
  }

  /** Timeouts compare remaining health as a share, so a 125-HP fighter gets no free win. */
  private healthPct(fighter: Fighter): number {
    return fighter.currentHealth <= 0 ? 0 : fighter.currentHealth / fighter.maxHealth * GAME_CONFIG.MAX_HEALTH;
  }

  // ── Camera follow ─────────────────────────────────────────

  private updateCamera(): void {
    for (const [i, fighter] of [this.player, this.opponent].entries()) {
      const height = Math.max(0, GAME_CONFIG.FLOOR_Y - fighter.y);
      this.fighterShadows[i].setX(fighter.x).setScale(1 / (1 + height / 600))
        .setAlpha(0.26 / (1 + height / 300));
    }
    const midX = (this.player.x + this.opponent.x) / 2;
    const targetX = Phaser.Math.Clamp(
      midX - GAME_CONFIG.WIDTH / 2,
      0,
      GAME_CONFIG.STAGE_WIDTH - GAME_CONFIG.WIDTH,
    );
    this.cameras.main.scrollX = Phaser.Math.Linear(
      this.cameras.main.scrollX,
      targetX,
      0.08
    );
    const targetY = Phaser.Math.Clamp(Math.min(this.player.y, this.opponent.y) - (GAME_CONFIG.FLOOR_Y - 220), -80, 0);
    this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.12);
  }

  // ── Round callbacks ───────────────────────────────────────

  private onRoundEnd(winner: RoundWinner, reason: RoundEndReason): void {
    this.superMove.cancel();
    const wins = this.roundSystem.wins;
    this.hud.setRoundWins(wins.player, wins.opponent);
    this.player.finishRound(winner === 'draw' ? 'IDLE' : winner === 'player' ? 'VICTORY' : 'DEFEAT');
    this.opponent.finishRound(winner === 'draw' ? 'IDLE' : winner === 'opponent' ? 'VICTORY' : 'DEFEAT');

    if (this.roundSystem.matchOver) {
      // Best of 3 decided (or round cap reached): announce the match and return to the menu.
      this.messages.showResult(this.roundSystem.matchWinner, reason);
      this.time.delayedCall(GAME_CONFIG.MATCH_END_MS, () => {
        this.scene.start('MenuScene', this.getMatchData());
      });
      return;
    }

    this.messages.showRoundResult(winner, reason, wins);
    this.time.delayedCall(GAME_CONFIG.ROUND_TRANSITION_MS, () => this.startNextRound());
  }

  /** Puts both fighters back on their marks with full health and plays the next round's intro. */
  private startNextRound(): void {
    this.player.resetForRound(PLAYER_START_X);
    this.opponent.resetForRound(OPPONENT_START_X);
    this.facingSystem.update(this.player, this.opponent);
    this.hud.update(this.player, this.opponent, GAME_CONFIG.ROUND_TIME);
    this.roundSystem.nextRound();
  }

  // ── Pause ─────────────────────────────────────────────────

  private pauseFight(): void {
    if (!this.scene.isActive() || this.scene.isActive('PauseScene')) return;
    this.input.keyboard?.resetKeys();
    this.scene.launch('PauseScene', this.getMatchData());
    this.scene.pause();
  }

  getMatchData() {
    return { manifest: this.manifest, stageIndex: this.stageIndex, mode: this.mode,
      playerChoice: { ...this.playerChoice }, opponentChoice: { ...this.opponentChoice } };
  }

  // ── Update ────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this.roundSystem || !this.player || !this.opponent) return;
    delta = Math.min(Math.max(delta, 0), 50);
    if (this.superMove.active) {
      this.superMove.update(delta);
      this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);
      if (!this.superMove.active) this.roundSystem.update(0, this.healthPct(this.player), this.healthPct(this.opponent));
      return;
    }

    // During round end, keep advancing animations so VICTORY and DEFEAT play out completely
    if (this.roundSystem.phase === 'END') {
      this.player.updatePresentation(delta);
      this.opponent.updatePresentation(delta);
      this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);
      this.updateCamera();
      return;
    }

    if (this.roundSystem.phase !== 'FIGHT') {
      // Still update round intro
      this.roundSystem.update(delta, this.healthPct(this.player), this.healthPct(this.opponent));
      this.player.updatePresentation(delta);
      this.opponent.updatePresentation(delta);
      this.facingSystem.update(this.player, this.opponent);
      this.updateCamera();
      return;
    }

    // Update fighters
    this.facingSystem.update(this.player, this.opponent);
    if (this.opponent instanceof ComputerOpponent) this.opponent.think(delta, this.player);
    this.player.update(delta);
    this.opponent.update(delta);
    this.bodyPhysics.resolve(this.player, this.opponent);

    // Facing
    this.facingSystem.update(this.player, this.opponent);

    // Collision detection (both directions)
    this.fighterController.checkCollisions(this.player, this.opponent);
    if (!this.superMove.active) this.fighterController.checkCollisions(this.opponent, this.player);
    if (this.superMove.active) { this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft); return; }

    // Round logic
    this.roundSystem.update(delta, this.healthPct(this.player), this.healthPct(this.opponent));

    // HUD
    this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);

    // Camera
    this.updateCamera();
  }
}
