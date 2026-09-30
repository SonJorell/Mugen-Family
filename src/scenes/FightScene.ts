// ============================================================
// FightScene — Main combat scene
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader } from '../animation/SpriteSheetLoader';
import { PlayerFighter } from '../characters/PlayerFighter';
import { TrainingOpponent } from '../characters/TrainingOpponent';
import { InputManager } from '../input/InputManager';
import { FacingSystem } from '../systems/FacingSystem';
import { FighterController } from '../systems/FighterController';
import { RoundSystem } from '../systems/RoundSystem';
import { HUD } from '../ui/HUD';
import { FightMessages } from '../ui/FightMessages';

interface CharacterManifest {
  characterId: string;
  name: string;
  assetPath: string;
  animations: Record<string, string[]>;
}

export class FightScene extends Phaser.Scene {
  private manifest!: CharacterManifest;

  private player!: PlayerFighter;
  private opponent!: TrainingOpponent;

  private registry2!: AnimationRegistry;
  private loader!: SpriteSheetLoader;
  private opponentRegistry!: AnimationRegistry;
  private opponentLoader!: SpriteSheetLoader;

  private facingSystem = new FacingSystem();
  private fighterController = new FighterController();
  private roundSystem!: RoundSystem;
  private hud!: HUD;
  private messages!: FightMessages;

  private isPaused: boolean = false;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private inputManager!: InputManager;
  private stageIndex: number = 0;
  private stageBgImage!: Phaser.GameObjects.Image;

  // Stage graphics
  private stageLayer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'FightScene' });
  }

  init(data: { manifest: CharacterManifest; stageIndex?: number }): void {
    this.manifest = data?.manifest;
    this.stageIndex = data?.stageIndex ?? 0;
  }

  create(): void {
    const htmlVideo = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (htmlVideo) {
      htmlVideo.style.display = 'none';
      htmlVideo.pause();
    }

    if (!this.manifest) {
      console.error('[FightScene] No manifest found — returning to menu.');
      this.scene.start('MenuScene');
      return;
    }

    this.createStage();
    this.setupAnimations();
    this.createFighters();
    this.createSystems();

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
    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());
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

    // Floor shadow line for contact
    this.add.rectangle(W / 2, GAME_CONFIG.FLOOR_Y + 10, W, 20, 0x000000, 0.35).setDepth(1);

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
    this.cameras.main.setBounds(0, 0, W, GAME_CONFIG.HEIGHT);
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
    // Player animations
    this.registry2 = new AnimationRegistry();
    this.loader = new SpriteSheetLoader(this, this.registry2, 'tilin', '/assets/characters/tilin/');

    // Opponent reuses tilin's already-processed frame textures via sourceCharacterId
    this.opponentRegistry = new AnimationRegistry();
    this.opponentLoader = new SpriteSheetLoader(this, this.opponentRegistry, 'dummy', '/assets/characters/tilin/', 'tilin');

    const { animations } = this.manifest;

    // Sort helper
    const sortFiles = (files: string[]) =>
      [...files].sort((a, b) => {
        const na = parseInt(a.match(/_(\d+)\./)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/_(\d+)\./)?.[1] ?? '0', 10);
        return na - nb;
      });

    // Process all animations for player (loads and processes textures)
    for (const [animName, files] of Object.entries(animations)) {
      if (!files || files.length === 0) {
        this.loader.loadAnimationFromUrls(animName, []);
        continue;
      }
      const sorted = sortFiles(files);
      const urls = sorted.map(f => `/assets/characters/tilin/${animName}/${f}`);
      this.loader.loadAnimationFromUrls(animName, urls);
    }

    // Process all animations for dummy (reuses tilin's processed frame textures)
    for (const [animName, files] of Object.entries(animations)) {
      this.opponentLoader.loadAnimationFromUrls(animName, files ?? []);
    }

    // Log available animations
    const avail = this.registry2.getAvailable();
    console.log(`[FightScene] Available animations: ${avail.join(', ')}`);
  }

  // ── Fighters ──────────────────────────────────────────────

  private createFighters(): void {
    this.inputManager = new InputManager(this);

    this.player = new PlayerFighter({
      scene: this,
      registry: this.registry2,
      loader: this.loader,
      characterId: 'tilin',
      x: GAME_CONFIG.STAGE_WIDTH * 0.35,
      y: GAME_CONFIG.FLOOR_Y,
      maxHealth: GAME_CONFIG.MAX_HEALTH,
      scale: GAME_CONFIG.CHAR_SCALE,
    }, this.inputManager);

    this.opponent = new TrainingOpponent({
      scene: this,
      registry: this.opponentRegistry,
      loader: this.opponentLoader,
      characterId: 'dummy',
      x: GAME_CONFIG.STAGE_WIDTH * 0.65,
      y: GAME_CONFIG.FLOOR_Y,
      maxHealth: GAME_CONFIG.MAX_HEALTH,
      scale: GAME_CONFIG.CHAR_SCALE,
    });
  }

  // ── Systems ───────────────────────────────────────────────

  private createSystems(): void {
    this.roundSystem = new RoundSystem(this);
    this.roundSystem.onRoundEnd = (winner) => this.onRoundEnd(winner);

    this.hud = new HUD(this, 'TILIN', 'DUMMY');
    this.messages = new FightMessages(this);

    this.roundSystem.startRound();
  }

  // ── Camera follow ─────────────────────────────────────────

  private updateCamera(): void {
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
  }

  // ── Round callbacks ───────────────────────────────────────

  private onRoundEnd(winner: 'player' | 'opponent' | 'timeout'): void {
    if (winner === 'timeout') {
      this.messages.showTimeover();
      const playerWon = this.player.currentHealth >= this.opponent.currentHealth;
      if (playerWon) {
        this.player.combatState.setState('VICTORY');
        this.player.playAnimation('VICTORY', true);
        this.opponent.combatState.setState('DEFEAT');
        this.opponent.playAnimation('DEFEAT', true);
      } else {
        this.opponent.combatState.setState('VICTORY');
        this.opponent.playAnimation('VICTORY', true);
        this.player.combatState.setState('DEFEAT');
        this.player.playAnimation('DEFEAT', true);
      }
    } else if (winner === 'player') {
      this.messages.showWinner('Tilin');
      // Winner plays VICTORY
      this.player.combatState.setState('VICTORY');
      this.player.playAnimation('VICTORY', true);
      // Defeated plays DEFEAT
      this.opponent.combatState.setState('DEFEAT');
      this.opponent.playAnimation('DEFEAT', true);
    } else {
      this.messages.showKO();
      // Winner plays VICTORY
      this.opponent.combatState.setState('VICTORY');
      this.opponent.playAnimation('VICTORY', true);
      // Defeated plays DEFEAT
      this.player.combatState.setState('DEFEAT');
      this.player.playAnimation('DEFEAT', true);
    }

    // Return to menu after delay
    this.time.delayedCall(4500, () => {
      this.scene.start('MenuScene', { manifest: this.manifest, stageIndex: this.stageIndex });
    });
  }

  // ── Pause ─────────────────────────────────────────────────

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.pause();
      this.scene.launch('PauseScene');
      this.scene.bringToTop('PauseScene');
    } else {
      this.physics.resume();
      this.scene.stop('PauseScene');
    }
  }

  // ── Update ────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // During round end, keep advancing animations so VICTORY and DEFEAT play out completely
    if (this.roundSystem.phase === 'END') {
      this.player.update(delta);
      this.opponent.update(delta);
      this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);
      this.updateCamera();
      return;
    }

    if (this.roundSystem.phase !== 'FIGHT') {
      // Still update round intro
      this.roundSystem.update(delta, this.player.currentHealth, this.opponent.currentHealth);
      return;
    }

    // Update fighters
    this.player.update(delta);
    this.opponent.update(delta);

    // Facing
    this.facingSystem.update(this.player, this.opponent);

    // Collision detection (both directions)
    this.fighterController.checkCollisions(this.player, this.opponent);
    this.fighterController.checkCollisions(this.opponent, this.player);

    // Round logic
    this.roundSystem.update(delta, this.player.currentHealth, this.opponent.currentHealth);

    // HUD
    this.hud.update(this.player, this.opponent, this.roundSystem.timeLeft);

    // Camera
    this.updateCamera();
  }
}
