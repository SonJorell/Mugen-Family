// ============================================================
// MenuScene — Main menu with arcade styling & video background
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class MenuScene extends Phaser.Scene {
  private manifest: unknown;
  private selectedIndex: number = 0;
  private selectedStageIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private videoBg: Phaser.GameObjects.Video | null = null;

  private get options() {
    const stageName = GAME_CONFIG.STAGES[this.selectedStageIndex]?.name ?? 'Default';
    return [
      { label: 'START GAME', action: () => this.startFight() },
      { label: `STAGE: ${stageName}`, action: () => this.cycleStage() },
      { label: 'TRAINING MODE', action: () => this.goTo('CharacterTestScene') },
      { label: 'PANTALLA COMPLETA ⛶', action: () => this.toggleFullscreen() },
      { label: `DEBUG: ${GAME_CONFIG.DEBUG_MODE ? 'ON' : 'OFF'}`, action: () => this.toggleDebug() },
    ];
  }

  constructor() {
    super({ key: 'MenuScene' });
  }

  init(data: { manifest: unknown }): void {
    this.manifest = data?.manifest;
  }

  create(): void {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    this.drawBackground();

    // Title
    this.add.text(W / 2, 120, 'FIGHTER FAMILY', {
      fontFamily: 'Arial Black',
      fontSize: '96px',
      color: '#ffdd00',
      stroke: '#c00000',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 220, 'ALPHA', {
      fontFamily: 'Arial Black',
      fontSize: '34px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    // Subtitle
    this.add.text(W / 2, 270, '── CREADO POR JORELL ──', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#00ffcc',
    }).setOrigin(0.5).setDepth(10);

    // Build menu options
    this.buildMenu();

    // Footer legend
    this.add.text(W / 2, H - 30, '↑↓ / W S: Select  •  ENTER: Confirm / Toggle  •  F1: Debug in Fight', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Keyboard navigation
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.enterKey = this.input.keyboard!.addKey('ENTER');

    this.input.keyboard!.on('keydown-UP', () => { this.navigate(-1); });
    this.input.keyboard!.on('keydown-DOWN', () => { this.navigate(1); });
    this.input.keyboard!.on('keydown-W', () => { this.navigate(-1); });
    this.input.keyboard!.on('keydown-S', () => { this.navigate(1); });
    this.input.keyboard!.on('keydown-ENTER', () => { this.activateCurrent(); });
    this.input.keyboard!.on('keydown-SPACE', () => { this.activateCurrent(); });
    this.input.keyboard!.on('keydown-LEFT', () => { if (this.selectedIndex === 1) this.cycleStage(-1); });
    this.input.keyboard!.on('keydown-RIGHT', () => { if (this.selectedIndex === 1) this.cycleStage(1); });
    this.input.keyboard!.on('keydown-F11', () => { this.toggleFullscreen(); });

    this.updateSelection();

    // Flashing cursor pulse
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.updateSelection(),
    });
  }

  private drawBackground(): void {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    // 1. Play native HTML5 video element at native 1280x720 resolution behind transparent canvas
    const htmlVideo = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (htmlVideo) {
      htmlVideo.style.display = 'block';
      htmlVideo.muted = true;
      htmlVideo.play().catch(e => {
        console.warn('[MenuScene] Autoplay waiting for user gesture:', e);
      });
    }

    // 2. Fallback / in-Phaser video if HTML video is not available
    let hasVideo = !!htmlVideo;
    if (!htmlVideo) {
      try {
        if (this.cache.video.exists('menu_video')) {
          this.videoBg = this.add.video(W / 2, H / 2, 'menu_video');
          this.videoBg.setOrigin(0.5, 0.5);
          this.videoBg.setDisplaySize(W, H);
          this.videoBg.setMute(true);
          this.videoBg.play(true);
          this.videoBg.setDepth(0);
          hasVideo = true;
        }
      } catch (err) {
        console.warn('[MenuScene] Could not play Phaser video background:', err);
      }
    }

    if (!hasVideo) {
      // Fallback: Gradient background
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const ratio = i / steps;
        const r = Math.floor(Phaser.Math.Linear(0x05, 0x11, ratio));
        const b = Math.floor(Phaser.Math.Linear(0x1a, 0x3a, ratio));
        this.add.rectangle(W / 2, (H / steps) * i + H / (steps * 2), W, H / steps + 1,
          Phaser.Display.Color.GetColor(r, 0, b)).setDepth(0);
      }
    }

    // Subtle dark vignette overlay so menu text is crisp over the video
    this.add.rectangle(W / 2, H / 2, W, H, 0x050510, 0.35).setDepth(2);
  }

  private buildMenu(): void {
    const W = GAME_CONFIG.WIDTH;
    this.menuItems.forEach(item => item.destroy());
    this.menuItems = [];

    const opts = this.options;
    opts.forEach((opt, i) => {
      const t = this.add.text(W / 2, 350 + i * 65, opt.label, {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

      t.on('pointerover', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
      t.on('pointerdown', () => {
        this.selectedIndex = i;
        this.activateCurrent();
      });

      this.menuItems.push(t);
    });
  }

  private navigate(delta: number): void {
    const count = this.options.length;
    this.selectedIndex = (this.selectedIndex + delta + count) % count;
    this.updateSelection();
  }

  private activateCurrent(): void {
    this.options[this.selectedIndex]?.action();
  }

  private updateSelection(): void {
    this.menuItems.forEach((t, i) => {
      if (i === this.selectedIndex) {
        t.setColor('#ffdd00');
        t.setScale(1.08);
        t.setStroke('#c00000', 6);
      } else {
        t.setColor('#e0e0e0');
        t.setScale(1.0);
        t.setStroke('#000000', 5);
      }
    });
  }

  private cycleStage(direction: number = 1): void {
    const total = GAME_CONFIG.STAGES.length;
    this.selectedStageIndex = (this.selectedStageIndex + direction + total) % total;
    this.buildMenu();
    this.updateSelection();
  }

  private toggleDebug(): void {
    GAME_CONFIG.DEBUG_MODE = !GAME_CONFIG.DEBUG_MODE;
    GAME_CONFIG.SHOW_DEBUG_TEXT = GAME_CONFIG.DEBUG_MODE;
    this.buildMenu();
    this.updateSelection();
  }

  private toggleFullscreen(): void {
    if (!this.scale.isFullscreen) {
      this.scale.startFullscreen();
    } else {
      this.scale.stopFullscreen();
    }
  }

  private startFight(): void {
    const htmlVideo = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (htmlVideo) {
      htmlVideo.style.display = 'none';
      htmlVideo.pause();
    }

    this.scene.start('FightScene', {
      manifest: this.manifest,
      stageIndex: this.selectedStageIndex,
    });
  }

  private goTo(scene: string): void {
    const htmlVideo = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (htmlVideo) {
      htmlVideo.style.display = 'none';
      htmlVideo.pause();
    }

    this.scene.start(scene, {
      manifest: this.manifest,
      stageIndex: this.selectedStageIndex,
    });
  }
}
