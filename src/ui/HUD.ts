// ============================================================
// HUD — Full heads-up display: health bars, timer, debug panel
// ============================================================

import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { Timer } from './Timer';
import { GAME_CONFIG } from '../config/gameConfig';
import { Fighter } from '../characters/Fighter';

export class HUD {
  private scene: Phaser.Scene;
  private playerBar: HealthBar;
  private opponentBar: HealthBar;
  private timer: Timer;
  private debugPanel: Phaser.GameObjects.Text | null = null;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private debugBg: Phaser.GameObjects.Rectangle | null = null;

  private readonly BAR_MARGIN = 20;
  private readonly BAR_WIDTH = (GAME_CONFIG.WIDTH / 2) - 80;
  private readonly BAR_Y = 20;

  constructor(scene: Phaser.Scene, playerName: string, opponentName: string) {
    this.scene = scene;

    this.playerBar = new HealthBar(
      scene,
      this.BAR_MARGIN, this.BAR_Y,
      this.BAR_WIDTH,
      GAME_CONFIG.MAX_HEALTH,
      playerName,
      false,
    );

    this.opponentBar = new HealthBar(
      scene,
      GAME_CONFIG.WIDTH - this.BAR_MARGIN - this.BAR_WIDTH, this.BAR_Y,
      this.BAR_WIDTH,
      GAME_CONFIG.MAX_HEALTH,
      opponentName,
      true,
    );

    this.timer = new Timer(scene);

    if (GAME_CONFIG.DEBUG_MODE && GAME_CONFIG.SHOW_DEBUG_TEXT) {
      this.debugBg = scene.add.rectangle(4, GAME_CONFIG.HEIGHT - 220, 280, 215, 0x000000, 0.65)
        .setOrigin(0, 0).setDepth(90).setScrollFactor(0);
      this.debugPanel = scene.add.text(8, GAME_CONFIG.HEIGHT - 218, '', {
        fontFamily: 'Courier New',
        fontSize: '13px',
        color: '#00ff88',
      }).setDepth(91).setOrigin(0, 0).setScrollFactor(0);

      this.fpsText = scene.add.text(GAME_CONFIG.WIDTH - 80, 90, '', {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: '#ffff44',
      }).setDepth(91).setOrigin(0, 0).setScrollFactor(0);
    }
  }

  update(player: Fighter, opponent: Fighter, timeLeft: number): void {
    this.playerBar.setHealth(player.currentHealth);
    this.opponentBar.setHealth(opponent.currentHealth);
    this.timer.setTime(timeLeft);

    if (this.debugPanel && GAME_CONFIG.DEBUG_MODE && GAME_CONFIG.SHOW_DEBUG_TEXT) {
      const info = player.getDebugInfo();
      const lines = [
        '── PLAYER DEBUG ──',
        ...Object.entries(info).map(([k, v]) => `${k}: ${v}`),
      ];
      this.debugPanel.setText(lines.join('\n'));
    }

    if (this.fpsText) {
      const fps = Math.round(this.scene.game.loop.actualFps);
      this.fpsText.setText(`FPS: ${fps}`);
    }
  }

  destroy(): void {
    this.playerBar.destroy();
    this.opponentBar.destroy();
    this.timer.destroy();
    this.debugPanel?.destroy();
    this.fpsText?.destroy();
    this.debugBg?.destroy();
  }
}
