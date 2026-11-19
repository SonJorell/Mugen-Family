// ============================================================
// CharacterTestScene — Animation preview / debug tool
// ============================================================

import Phaser from 'phaser';
import { FighterChoice, FIGHTER_ROSTER, normalizeChoice, rosterEntry } from '../config/roster';
import { CharacterManifest, createCharacterLoader, getManifest } from '../config/characters';
import { GAME_CONFIG } from '../config/gameConfig';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader } from '../animation/SpriteSheetLoader';
import { Fighter } from '../characters/Fighter';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';


export class CharacterTestScene extends Phaser.Scene {
  private manifest!: CharacterManifest;
  private registry2!: AnimationRegistry;
  private loader!: SpriteSheetLoader;
  private fighter!: Fighter;

  private debugText!: Phaser.GameObjects.Text;
  private animListText!: Phaser.GameObjects.Text;
  private fighterLabel!: Phaser.GameObjects.Text;
  private fighterIndex: number = 0;
  private currentAnimIdx: number = 0;
  private availableAnims: string[] = [];
  private stageBgImage: Phaser.GameObjects.Image | null = null;
  private currentStageIdx: number = -1; // -1 = dark grid

  constructor() {
    super({ key: 'CharacterTestScene' });
  }

  init(data: { manifest?: CharacterManifest; playerChoice?: FighterChoice }): void {
    // The gallery shows the fighter the player picked; menu data may still carry a manifest.
    this.manifest = data?.playerChoice ? getManifest(this, normalizeChoice(data.playerChoice).characterId)
      : data?.manifest ?? getManifest(this, FIGHTER_ROSTER[0].id);
    this.fighterIndex = Math.max(0, FIGHTER_ROSTER.findIndex(f => f.id === this.manifest?.characterId));
    this.currentAnimIdx = 0;
    this.currentStageIdx = -1;
    this.stageBgImage = null;
    this.availableAnims = [];
  }

  create(): void {
    isolateSceneKeyboard(this);
    GameAudio.for(this).play('music-menu');
    musicControls(this, 1250, 24);

    if (!this.manifest) {
      this.scene.start('MenuScene');
      return;
    }

    this.drawBackground();
    this.setupAnimations();
    this.createFighter();
    this.createUI();
    this.registerKeys();
  }

  private drawBackground(): void {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a1a).setDepth(0);

    // Grid
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, 0x222244, 0.5);
    for (let x = 0; x < W; x += 60) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 60) g.lineBetween(0, y, W, y);

    // Floor
    g.lineStyle(3, 0x4444aa, 0.9);
    g.lineBetween(0, GAME_CONFIG.FLOOR_Y, W, GAME_CONFIG.FLOOR_Y);
    this.add.rectangle(W / 2, GAME_CONFIG.FLOOR_Y + 1, W, 3, 0x4444aa).setDepth(1);
  }

  private toggleStageBg(): void {
    const stages = GAME_CONFIG.STAGES;
    this.currentStageIdx = (this.currentStageIdx + 2) % (stages.length + 1) - 1; // cycles -1, 0, 1...
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    if (this.currentStageIdx === -1) {
      if (this.stageBgImage) this.stageBgImage.setVisible(false);
    } else {
      const stage = stages[this.currentStageIdx];
      if (this.textures.exists(stage.textureKey)) {
        if (!this.stageBgImage) {
          this.stageBgImage = this.add.image(W / 2, H / 2, stage.textureKey).setDepth(0);
        } else {
          this.stageBgImage.setTexture(stage.textureKey);
          this.stageBgImage.setVisible(true);
        }
        this.stageBgImage.setDisplaySize(W, H);
      }
    }
  }

  private setupAnimations(): void {
    const { registry, loader } = createCharacterLoader(this, this.manifest);
    this.registry2 = registry;
    this.loader = loader;
    this.availableAnims = this.registry2.getAvailable();
  }

  private createFighter(): void {
    const entry = rosterEntry(this.manifest.characterId);
    this.fighter = new Fighter({
      scene: this,
      registry: this.registry2,
      loader: this.loader,
      characterId: this.manifest.characterId,
      x: GAME_CONFIG.WIDTH / 2,
      y: GAME_CONFIG.FLOOR_Y,
      scale: GAME_CONFIG.CHAR_SCALE,
      stats: entry.stats,
    });

    // Disable gravity for test scene
    this.fighter['isGrounded'] = true;
  }

  private switchFighter(delta: number): void {
    this.fighterIndex = (this.fighterIndex + delta + FIGHTER_ROSTER.length) % FIGHTER_ROSTER.length;
    const entry = FIGHTER_ROSTER[this.fighterIndex];
    const facing = this.fighter?.facingRight ?? true;
    this.fighter?.destroy();
    this.manifest = getManifest(this, entry.id);
    this.currentAnimIdx = 0;
    this.setupAnimations();
    this.createFighter();
    this.fighter.facingRight = facing;
    this.fighter.sprite.setFlipX(!facing);
    this.updateFighterLabel();
    this.updateAnimList();
    this.updateDebugText();
  }

  private updateFighterLabel(): void {
    const entry = FIGHTER_ROSTER[this.fighterIndex];
    this.fighterLabel?.setText(`${entry.name.toUpperCase()} (${this.fighterIndex + 1}/${FIGHTER_ROSTER.length}) · ${entry.heightCm} cm`);
  }

  private createUI(): void {
    const W = GAME_CONFIG.WIDTH;

    // Title + fighter switcher
    this.add.text(W / 2, 20, 'GALERÍA DE MOVIMIENTOS', {
      fontFamily: FONT_IMPACT,
      fontSize: '20px',
      color: '#00ff88',
      stroke: '#003322',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);

    const navStyle = { fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: '#00ff88', backgroundColor: '#0e2438', padding: { x: 10, y: 2 } };
    this.add.text(W / 2 - 175, 50, '◀', navStyle).setOrigin(0.5).setDepth(51)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.switchFighter(-1));
    this.fighterLabel = this.add.text(W / 2, 50, '', {
      fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: '#fff7ec',
    }).setOrigin(0.5).setDepth(51).setName('gallery-fighter');
    this.add.text(W / 2 + 175, 50, '▶', navStyle).setOrigin(0.5).setDepth(51)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.switchFighter(1));
    this.updateFighterLabel();

    // Debug info box
    const dbgBg = this.add.rectangle(8, 80, 290, 200, 0x000000, 0.75)
      .setOrigin(0, 0).setDepth(50);
    this.debugText = this.add.text(14, 86, '', {
      fontFamily: 'Courier New',
      fontSize: '13px',
      color: '#00ff88',
    }).setDepth(51).setOrigin(0, 0);
    void dbgBg;

    // Animation list panel
    const listBg = this.add.rectangle(W - 8, 80, 230, 520, 0x000000, 0.75)
      .setOrigin(1, 0).setDepth(50);
    this.animListText = this.add.text(W - 230, 86, '', {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#aaffcc',
    }).setDepth(51).setOrigin(0, 0);
    void listBg;

    // Controls legend
    this.add.text(W / 2, GAME_CONFIG.HEIGHT - 30, 
      'Q / E  Luchador   |   1–0  Animaciones   |   ← →  Elegir   |   A  Girar   |   F2  Escenario   |   F1  Colisiones   |   Esc  Menú',
      { fontFamily: FONT_UI, fontSize: '13px', color: '#8888cc' }
    ).setOrigin(0.5).setDepth(50);

    this.updateAnimList();
    this.updateDebugText();
  }

  private registerKeys(): void {
    // Number keys for animation switching
    const numKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO','MINUS','PLUS'];
    numKeys.forEach((key, idx) => {
      this.input.keyboard!.on(`keydown-${key}`, () => {
        if (idx < this.availableAnims.length) {
          this.currentAnimIdx = idx;
          this.fighter.playAnimation(this.availableAnims[idx], true);
          this.updateAnimList();
        }
      });
    });

    // Arrow keys to cycle
    this.input.keyboard!.on('keydown-LEFT', () => {
      this.currentAnimIdx = (this.currentAnimIdx - 1 + this.availableAnims.length) % this.availableAnims.length;
      this.fighter.playAnimation(this.availableAnims[this.currentAnimIdx], true);
      this.updateAnimList();
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this.currentAnimIdx = (this.currentAnimIdx + 1) % this.availableAnims.length;
      this.fighter.playAnimation(this.availableAnims[this.currentAnimIdx], true);
      this.updateAnimList();
    });

    // Q/E or Tab to switch fighters across the roster
    this.input.keyboard!.on('keydown-Q', () => this.switchFighter(-1));
    this.input.keyboard!.on('keydown-E', () => this.switchFighter(1));
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => { e.preventDefault(); this.switchFighter(1); });

    // A/D to flip
    this.input.keyboard!.on('keydown-A', () => {
      this.fighter.facingRight = !this.fighter.facingRight;
      this.fighter.sprite.setFlipX(!this.fighter.facingRight);
    });

    // ESC back to menu
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start('MenuScene', { manifest: this.manifest });
    });

    // F1 toggle debug
    this.input.keyboard!.on('keydown-F1', () => {
      GAME_CONFIG.DEBUG_MODE = !GAME_CONFIG.DEBUG_MODE;
    });

    // F2 toggle stage background
    this.input.keyboard!.on('keydown-F2', () => {
      this.toggleStageBg();
    });
  }

  private updateAnimList(): void {
    const lines = ['── ANIMATIONS ──', ''];
    this.availableAnims.forEach((anim, i) => {
      const selected = i === this.currentAnimIdx;
      const prefix = selected ? '► ' : '  ';
      const num = i < 10 ? `[${i === 9 ? '0' : i + 1}] ` : '    ';
      lines.push(`${prefix}${num}${anim}`);
    });

    // Also show unavailable
    const allNames = GAME_CONFIG.ANIMATION_NAMES as readonly string[];
    const unavail = allNames.filter(n => !this.availableAnims.includes(n));
    if (unavail.length > 0) {
      lines.push('');
      lines.push('── MISSING ──');
      unavail.forEach(n => lines.push(`  ✗ ${n}`));
    }

    this.animListText.setText(lines.join('\n'));
  }

  private updateDebugText(): void {
    if (!this.fighter) return;
    const info = this.fighter.getDebugInfo();
    const fps = Math.round(this.game.loop.actualFps);
    const lines = [
      `── DEBUG INFO ──`,
      `FPS: ${fps}`,
      ...Object.entries(info).map(([k, v]) => `${k}: ${v}`),
    ];
    this.debugText.setText(lines.join('\n'));
  }

  update(_time: number, delta: number): void {
    if (!this.fighter) return;
    this.fighter.updatePresentation(Math.min(delta, 50));
    this.updateDebugText();
  }
}
