// ============================================================
// PauseScene — Overlay pause menu
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class PauseScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];

  private readonly OPTIONS = [
    { label: 'RESUME',    action: () => this.resume() },
    { label: 'RESTART',   action: () => this.restart() },
    { label: 'MAIN MENU', action: () => this.mainMenu() },
  ];

  constructor() {
    super({ key: 'PauseScene' });
  }

  create(): void {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);

    // Pause title
    this.add.text(W / 2, H / 2 - 140, 'PAUSED', {
      fontFamily: 'Arial Black',
      fontSize: '60px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    // Options
    this.OPTIONS.forEach((opt, i) => {
      const t = this.add.text(W / 2, H / 2 - 40 + i * 70, opt.label, {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      t.on('pointerover', () => { this.selectedIndex = i; this.updateSelection(); });
      t.on('pointerdown', () => opt.action());
      this.menuItems.push(t);
    });

    // Key listeners
    this.input.keyboard!.on('keydown-UP',    () => { this.selectedIndex = Math.max(0, this.selectedIndex - 1); this.updateSelection(); });
    this.input.keyboard!.on('keydown-DOWN',  () => { this.selectedIndex = Math.min(2, this.selectedIndex + 1); this.updateSelection(); });
    this.input.keyboard!.on('keydown-ENTER', () => this.OPTIONS[this.selectedIndex].action());
    this.input.keyboard!.on('keydown-ESC',   () => this.resume());

    this.updateSelection();
  }

  private updateSelection(): void {
    this.menuItems.forEach((t, i) => {
      t.setColor(i === this.selectedIndex ? '#ffdd00' : '#ffffff');
      t.setScale(i === this.selectedIndex ? 1.06 : 1.0);
    });
  }

  private resume(): void {
    const fight = this.scene.get('FightScene') as any;
    if (fight && fight.isPaused !== undefined) {
      fight.isPaused = false;
    }
    this.scene.stop();
  }

  private restart(): void {
    this.scene.stop('FightScene');
    this.scene.stop();
    const fight = this.scene.get('FightScene');
    const manifest = (fight as any)?.manifest;
    this.scene.start('FightScene', { manifest });
  }

  private mainMenu(): void {
    this.scene.stop('FightScene');
    this.scene.stop();
    this.scene.start('MenuScene');
  }
}
