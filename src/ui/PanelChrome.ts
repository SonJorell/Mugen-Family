// ============================================================
// PanelChrome — Cohesive Arica Sunset Arcade backdrop for secondary screens
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Draws the shared coastal arcade backdrop used across Configuración, Controles y Estadísticas:
 * Arica coast art, deep Pacific gradient veil, warm sunset corner glow and subtle framing rules.
 */
export function drawArcadeBackdrop(scene: Phaser.Scene, overlayAlpha = 0.84): void {
  const W = GAME_CONFIG.WIDTH, H = GAME_CONFIG.HEIGHT;
  if (scene.textures.exists('menu_arica_coast')) {
    scene.add.image(W / 2, H / 2, 'menu_arica_coast').setDisplaySize(1324, 745).setAlpha(0.5);
  }
  scene.add.rectangle(W / 2, H / 2, W, H, 0x0b2a66, overlayAlpha);
  const g = scene.add.graphics();
  // Diagonal coastal light sweep and warm sunset highlight
  g.fillStyle(0x1b63d1, 0.22).fillTriangle(0, 0, W * 0.65, 0, W * 0.28, H);
  g.fillStyle(0xff842b, 0.08).fillCircle(W - 110, 96, 260);
  // Subtle structural rules matching the HUD and main menu
  g.lineStyle(2, 0xffb02e, 0.55).lineBetween(96, 128, W - 96, 128);
  g.fillStyle(0x061534, 0.72).fillRect(0, H - 54, W, 54);
  g.lineStyle(1, 0x7fd4ff, 0.35).lineBetween(0, H - 54, W, H - 54);
}
