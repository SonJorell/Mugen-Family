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

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createLoadingBar();

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

    const sub = this.add.text(W / 2, H / 2 - 30, 'Loading assets...', {
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
    if (!this.manifest) {
      console.error('[PreloadScene] Failed to load tilin manifest!');
      this.scene.start('MenuScene', { manifest: null });
      return;
    }

    // Queue stage images and menu video
    GAME_CONFIG.STAGES.forEach(stage => {
      this.load.image(stage.textureKey, stage.imagePath);
    });
    this.load.video('menu_video', '/assets/menu/MENU%20VIDEO.mp4', true);

    // Queue all character images
    this.queueCharacterImages();

    this.load.on('complete', () => {
      this.scene.start('MenuScene', { manifest: this.manifest });
    });

    this.load.start();
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
        const url = `${assetPath}${animName}/${fileName}`;
        this.load.image(key, url);
        totalFiles++;
      });
    }

    console.log(`[PreloadScene] Queued ${totalFiles} images for ${characterId}`);
  }
}
