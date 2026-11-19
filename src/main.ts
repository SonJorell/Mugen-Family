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
import { StatsScene } from './scenes/StatsScene';
import { ASSET_BASE } from './config/assetBase';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000000',
  transparent: true,
  pixelArt: false,
  antialias: true,
  roundPixels: false,
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
    StatsScene,
  ],
  // Every /assets/... URL is loaded under Vite's base path (GitHub Pages serves from a subfolder).
  loader: { baseURL: ASSET_BASE },
  // Gamepads: the first pad drives player 1, the second one player 2.
  input: { gamepad: true },
  scale: {
    mode: Phaser.Scale.FIT,
    // #game-container already centres the canvas with flexbox; Phaser's own margins would add a second
    // offset, shifting the game off the video background and cutting its right edge.
    autoCenter: Phaser.Scale.NO_CENTER,
    fullscreenTarget: 'game-container',
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: false,
    roundPixels: false,
  },
};

new Phaser.Game(config);
