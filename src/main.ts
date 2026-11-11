// ============================================================
// main.ts — Entry point
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { FightScene } from './scenes/FightScene';
import { CharacterTestScene } from './scenes/CharacterTestScene';
import { PauseScene } from './scenes/PauseScene';
import { SelectionScene } from './scenes/SelectionScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ArcadeScene } from './scenes/ArcadeScene';
import { CreditsScene } from './scenes/CreditsScene';
import { ControlsScene } from './scenes/ControlsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000000',
  transparent: true,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    SelectionScene,
    FightScene,
    CharacterTestScene,
    PauseScene,
    SettingsScene,
    ArcadeScene,
    CreditsScene,
    ControlsScene,
  ],
  // Gamepads: the first pad drives player 1, the second one player 2.
  input: { gamepad: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: 'game-container',
  },
  render: {
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
