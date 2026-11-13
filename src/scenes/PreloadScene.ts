// ============================================================
// PreloadScene — Loads all assets, shows progress bar
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ANNOUNCER_LINES, announcerKey } from '../systems/Announcer';
import { FIGHTER_ROSTER } from '../config/roster';
import { DRIVE_ASSETS } from '../combat/driveAssets';
import { CharacterManifest, isValidManifest, manifestKey, menuArtKey, sortAnimationFiles, superPortraitKey, UI_SOUNDS } from '../config/characters';

export class PreloadScene extends Phaser.Scene {
  private manifests: CharacterManifest[] = [];
  private failed = false;
  private loading!: LoadingScreen;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.failed = false;
    this.loading = new LoadingScreen(this);
    // The manifests are a handful of tiny files: they fill the first few percent of the bar.
    this.loading.setPhase(0, 0.04);
    this.load.on('loaderror', () => { this.failed = true; });

    // Load every roster manifest
    for (const fighter of FIGHTER_ROSTER) this.load.json(manifestKey(fighter.id), fighter.manifestPath);

    // We can't dynamically load files without the manifest, so on complete
    // we'll chain a second load phase
    this.load.on('complete', this.onFirstLoadComplete, this);
  }

  private onFirstLoadComplete(): void {
    this.load.off('complete', this.onFirstLoadComplete, this);

    this.manifests = [];
    for (const fighter of FIGHTER_ROSTER) {
      const manifest = this.cache.json.get(manifestKey(fighter.id));
      if (!isValidManifest(manifest) || manifest.characterId !== fighter.id) {
        console.error(`[PreloadScene] Invalid manifest for ${fighter.id}`);
        this.showLoadError();
        return;
      }
      this.manifests.push(manifest);
    }

    // Queue stage images and the layered title-screen artwork.
    GAME_CONFIG.STAGES.forEach(stage => {
      this.load.image(stage.textureKey, stage.imagePath);
    });
    this.load.image('menu_arica_coast', '/assets/menu/arica-coast.webp');
    for (const fighter of FIGHTER_ROSTER) {
      this.load.image(menuArtKey(fighter.id), fighter.menuArtPath);
      this.load.image(superPortraitKey(fighter.id), fighter.superPortraitPath);
    }
    for (const [key, path] of Object.entries(DRIVE_ASSETS)) this.load.image(key, path);
    for (const key of ['hit-light', 'hit-heavy', 'hit-special', 'hit-block', 'voice-canto', 'super-canto', 'super-drive', 'music-menu', 'music-fight', ...UI_SOUNDS, ...ANNOUNCER_LINES.map(announcerKey)]) {
      this.load.audio(key, `/assets/audio/${key}.wav`);
    }
    // The native HTML video owns loading and playback; avoid downloading it twice.

    // Queue all character images
    this.manifests.forEach(manifest => this.queueCharacterImages(manifest));
    this.loading.setPhase(0.04, 1);

    this.load.on('complete', () => {
      if (this.failed) {
        this.showLoadError();
        return;
      }
      for (const key of ['menu_arica_coast', ...Object.keys(DRIVE_ASSETS), ...FIGHTER_ROSTER.flatMap(f => [menuArtKey(f.id), superPortraitKey(f.id)]), ...GAME_CONFIG.STAGES.map(stage => stage.textureKey)]) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      this.scene.start('MenuScene', { manifest: this.manifests[0] });
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

  private queueCharacterImages(manifest: CharacterManifest): void {
    const { assetPath, animations, characterId } = manifest;

    let totalFiles = 0;

    for (const [animName, files] of Object.entries(animations)) {
      if (!files || files.length === 0) {
        console.warn(`[PreloadScene] Animation ${animName} has no files — skipping.`);
        continue;
      }

      const sorted = sortAnimationFiles(files);

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
