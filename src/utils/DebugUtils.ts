// ============================================================
// DebugUtils — Draw helpers for debug overlay
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export function drawStageGrid(graphics: Phaser.GameObjects.Graphics): void {
  if (!GAME_CONFIG.DEBUG_MODE) return;

  graphics.lineStyle(1, 0x333333, 0.4);

  // Vertical lines every 100px
  for (let x = 0; x <= GAME_CONFIG.STAGE_WIDTH; x += 100) {
    graphics.lineBetween(x, 0, x, GAME_CONFIG.STAGE_HEIGHT);
  }

  // Floor line
  graphics.lineStyle(2, 0xff8800, 0.6);
  graphics.lineBetween(0, GAME_CONFIG.FLOOR_Y, GAME_CONFIG.STAGE_WIDTH, GAME_CONFIG.FLOOR_Y);
}
