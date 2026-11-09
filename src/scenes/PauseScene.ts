// ============================================================
// PauseScene — Overlay pause menu
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FightScene } from './FightScene';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { musicControls } from '../systems/GameAudio';

export class PauseScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];

  private readonly OPTIONS = [
    { label: 'CONTINUAR', action: () => this.resume() },
    { label: 'REINICIAR', action: () => this.restart() },
    { label: 'MENÚ PRINCIPAL', action: () => this.mainMenu() },
    { label: 'CAMBIAR SELECCIÓN', action: () => this.changeSelection() },
  ];

  constructor() {
    super({ key: 'PauseScene' });
  }

  create(): void {
    isolateSceneKeyboard(this);
    musicControls(this, 1250, 138);
    this.selectedIndex = 0;
    this.menuItems = [];
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);

    // Pause title
    this.add.text(W / 2, H / 2 - 140, 'PAUSA', {
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
    this.input.keyboard!.on('keydown-DOWN',  () => { this.selectedIndex = Math.min(this.OPTIONS.length - 1, this.selectedIndex + 1); this.updateSelection(); });
    this.input.keyboard!.on('keydown-ENTER', () => this.OPTIONS[this.selectedIndex].action());
    this.input.keyboard!.on('keydown-ESC', (event: KeyboardEvent) => { if (!event.repeat) this.resume(); });

    this.updateSelection();
  }

  private updateSelection(): void {
    this.menuItems.forEach((t, i) => {
      t.setColor(i === this.selectedIndex ? '#ffdd00' : '#ffffff');
      t.setScale(i === this.selectedIndex ? 1.06 : 1.0);
    });
  }

  private resume(): void {
    const fight = this.scene.get('FightScene');
    fight.input.keyboard?.resetKeys();
    this.scene.resume('FightScene');
    this.scene.stop();
  }

  private restart(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    this.scene.start('FightScene', data);
  }

  private mainMenu(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    this.scene.start('MenuScene', data);
  }

  private changeSelection(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    this.scene.start('SelectionScene', data);
  }
}
