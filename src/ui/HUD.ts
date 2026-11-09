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
  private chantLabels: Phaser.GameObjects.Text[] = [];
  private chantBars: Phaser.GameObjects.Rectangle[] = [];
  private debugBg: Phaser.GameObjects.Rectangle | null = null;

  private readonly BAR_MARGIN = 28;
  private readonly BAR_WIDTH = (GAME_CONFIG.WIDTH / 2) - 80;
  private readonly BAR_Y = 48;

  constructor(scene: Phaser.Scene, playerName: string, opponentName: string) {
    this.scene = scene;
    scene.add.rectangle(GAME_CONFIG.WIDTH / 2, 43, GAME_CONFIG.WIDTH, 86, 0x10121b, 0.88)
      .setDepth(49).setScrollFactor(0);

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
    for (const x of [28, 700]) {
      scene.add.rectangle(x, 91, 260, 10, 0x263c51).setOrigin(0, 0).setDepth(55).setScrollFactor(0);
      this.chantBars.push(scene.add.rectangle(x, 91, 260, 10, 0x9fe8e1).setOrigin(0, 0).setDepth(56).setScrollFactor(0));
      this.chantLabels.push(scene.add.text(x, 107, '', { fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#fae8cb',
        backgroundColor: '#241a35', padding: { x: 5, y: 3 } }).setDepth(56).setScrollFactor(0));
    }

    {
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
    [player, opponent].forEach((fighter, i) => {
      this.chantBars[i].setDisplaySize(260 * fighter.energy / 100, 10).setFillStyle(fighter.superReady ? 0xf5bd75 : 0x9fe8e1);
      this.chantLabels[i].setText(fighter.inSuper ? 'Canto resonante'
        : fighter.combatState.state === 'STUNNED' ? 'Aturdido por el canto'
        : fighter.superReady ? (i === 0 ? 'O · ' : '') + 'SÚPER LISTO'
        : 'Energía ' + Math.floor(fighter.energy) + '% · Carga al combatir');
      this.chantLabels[i].setColor(fighter.superReady ? '#f5bd75' : '#fae8cb');
    });
    const showDebug = GAME_CONFIG.DEBUG_MODE && GAME_CONFIG.SHOW_DEBUG_TEXT;
    this.debugPanel?.setVisible(showDebug);
    this.debugBg?.setVisible(showDebug);
    this.fpsText?.setVisible(showDebug);

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
    this.chantLabels.forEach(label => label.destroy());
    this.chantBars.forEach(bar => bar.destroy());
  }
}
