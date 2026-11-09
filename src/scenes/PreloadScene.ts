// ============================================================
// PreloadScene — Loads all assets, shows progress bar
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

interface CharacterManifest {
  characterId: string;
  name: string;
  assetPath: string;
  animations: Record<string, string[]>;
}

export class PreloadScene extends Phaser.Scene {
  private manifest!: CharacterManifest;
  private failed = false;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.failed = false;
    this.createLoadingBar();
    this.load.on('loaderror', () => { this.failed = true; });

    // Load character manifest
    this.load.json('tilin_manifest', '/assets/characters/tilin/manifest.json');

    // We can't dynamically load files without the manifest, so on complete
    // we'll chain a second load phase
    this.load.on('complete', this.onFirstLoadComplete, this);
  }

  private createLoadingBar(): void {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    const title = this.add.text(W / 2, H / 2 - 80, 'MUGEN WEB FIGHTER', {
      fontFamily: 'Arial Black',
      fontSize: '42px',
      color: '#ffdd00',
      stroke: '#c00000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const sub = this.add.text(W / 2, H / 2 - 30, 'Cargando escenarios y movimientos…', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cccccc',
    }).setOrigin(0.5);

    // Progress bar frame
    this.add.rectangle(W / 2, H / 2 + 20, 500, 30, 0x333333).setOrigin(0.5);
    const progressBar = this.add.rectangle(W / 2 - 248, H / 2 + 5, 2, 22, 0x00dd55).setOrigin(0, 0);

    this.load.on('progress', (value: number) => {
      progressBar.setSize(496 * value, 22);
    });

    // Suppress TS "unused" warnings
    void title; void sub;
  }

  private onFirstLoadComplete(): void {
    this.load.off('complete', this.onFirstLoadComplete, this);

    this.manifest = this.cache.json.get('tilin_manifest') as CharacterManifest;
    if (!this.manifest || typeof this.manifest.characterId !== 'string' || typeof this.manifest.assetPath !== 'string' ||
      !this.manifest.animations || !Array.isArray(this.manifest.animations.IDLE) || this.manifest.animations.IDLE.length === 0 ||
      !Object.values(this.manifest.animations).every(files => Array.isArray(files) && files.every(f => typeof f === 'string'))) {
      this.showLoadError();
      return;
    }

    // Queue stage images and the layered title-screen artwork.
    GAME_CONFIG.STAGES.forEach(stage => {
      this.load.image(stage.textureKey, stage.imagePath);
    });
    this.load.image('menu_arica_coast', '/assets/menu/arica-coast.png');
    this.load.image('menu_tilin_3d', '/assets/menu/tilin-3d.png');
    this.load.image('tilin_super_portrait', '/assets/effects/tilin-super-canto.png');
    for (const key of ['hit-light', 'hit-heavy', 'hit-special', 'hit-block', 'voice-canto', 'super-canto', 'music-menu', 'music-fight']) {
      this.load.audio(key, `/assets/audio/${key}.wav`);
    }
    // The native HTML video owns loading and playback; avoid downloading it twice.

    // Queue all character images
    this.queueCharacterImages();

    this.load.on('complete', () => {
      if (this.failed) {
        this.showLoadError();
        return;
      }
      for (const key of ['menu_arica_coast', 'menu_tilin_3d', 'tilin_super_portrait', ...GAME_CONFIG.STAGES.map(stage => stage.textureKey)]) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      this.scene.start('MenuScene', { manifest: this.manifest });
    });

    this.load.start();
  }

  private showLoadError(): void {
    this.add.rectangle(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, 800, 250, 0x12121c).setDepth(10);
    this.add.text(GAME_CONFIG.WIDTH / 2, 320, 'No se pudieron cargar los archivos del juego.\nComprueba la conexión y vuelve a intentarlo.', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(GAME_CONFIG.WIDTH / 2, 410, 'Reintentar · Enter', {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#ffdd00',
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true }).on('pointerdown', () => window.location.reload());
    this.input.keyboard?.once('keydown-ENTER', () => window.location.reload());
  }

  private queueCharacterImages(): void {
    const { assetPath, animations, characterId } = this.manifest;

    let totalFiles = 0;

    for (const [animName, files] of Object.entries(animations)) {
      if (!files || files.length === 0) {
        console.warn(`[PreloadScene] Animation ${animName} has no files — skipping.`);
        continue;
      }

      // Sort numerically
      const sorted = [...files].sort((a, b) => {
        const na = parseInt(a.match(/_(\d+)\./)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/_(\d+)\./)?.[1] ?? '0', 10);
        return na - nb;
      });

      sorted.forEach((fileName, idx) => {
        const key = `${characterId}_RAW_${animName}_${idx}`;
        const url = fileName.startsWith('/') ? fileName : `${assetPath}${animName}/${fileName}`;
        this.load.image(key, url);
        totalFiles++;
      });
    }

    console.log(`[PreloadScene] Queued ${totalFiles} images for ${characterId}`);
  }
}
