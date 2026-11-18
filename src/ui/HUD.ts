// ============================================================
// HUD — Full heads-up display: health bars, timer, debug panel
// ============================================================

import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { Timer } from './Timer';
import { GAME_CONFIG } from '../config/gameConfig';
import { Fighter } from '../characters/Fighter';
import { FONT_UI } from './fonts';

export class HUD {
  private scene: Phaser.Scene;
  private playerBar: HealthBar;
  private opponentBar: HealthBar;
  private timer: Timer;
  private debugPanel: Phaser.GameObjects.Text | null = null;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private chantLabels: Phaser.GameObjects.Text[] = [];
  private chantBars: Phaser.GameObjects.Rectangle[] = [];
  private chantGlows: Phaser.GameObjects.Rectangle[] = [];
  private decor: Phaser.GameObjects.GameObject[] = [];
  private wasReady = [false, false];
  private debugBg: Phaser.GameObjects.Rectangle | null = null;
  /** Round-win markers: [player pips, opponent pips], filled as rounds are won. */
  private roundPips: Phaser.GameObjects.Arc[][] = [[], []];

  private readonly BAR_MARGIN = 28;
  private readonly BAR_WIDTH = (GAME_CONFIG.WIDTH / 2) - 80;
  private readonly BAR_Y = 48;

  constructor(scene: Phaser.Scene, playerName: string, opponentName: string, playerMaxHealth = GAME_CONFIG.MAX_HEALTH, opponentMaxHealth = GAME_CONFIG.MAX_HEALTH) {
    this.scene = scene;
    this.decor.push(
      scene.add.rectangle(GAME_CONFIG.WIDTH / 2, 43, GAME_CONFIG.WIDTH, 86, 0x0e3a80, 0.9).setDepth(49).setScrollFactor(0),
      scene.add.rectangle(GAME_CONFIG.WIDTH / 2, 86, GAME_CONFIG.WIDTH, 2, 0xffb02e, 0.55).setDepth(49).setScrollFactor(0),
    );

    this.playerBar = new HealthBar(
      scene,
      this.BAR_MARGIN, this.BAR_Y,
      this.BAR_WIDTH,
      playerMaxHealth,
      playerName,
      false,
      0xff6a1f,
    );

    this.opponentBar = new HealthBar(
      scene,
      GAME_CONFIG.WIDTH - this.BAR_MARGIN - this.BAR_WIDTH, this.BAR_Y,
      this.BAR_WIDTH,
      opponentMaxHealth,
      opponentName,
      true,
      0x7fd4ff,
    );

    this.timer = new Timer(scene);
    // Round-win pips on the name line, next to the timer (inner end of each bar).
    for (let side = 0; side < 2; side++) {
      for (let r = 0; r < GAME_CONFIG.ROUNDS_TO_WIN; r++) {
        const x = side === 0
          ? this.BAR_MARGIN + this.BAR_WIDTH - 8 - r * 22
          : GAME_CONFIG.WIDTH - this.BAR_MARGIN - this.BAR_WIDTH + 8 + r * 22;
        this.roundPips[side].push(scene.add.circle(x, this.BAR_Y - 14, 7, 0x1f6fd6)
          .setStrokeStyle(2, 0xffb02e, 0.9).setDepth(56).setScrollFactor(0));
      }
    }
    for (const x of [28, 700]) {
      this.decor.push(
        scene.add.rectangle(x - 3, 88, 266, 16, 0x0e3a80).setOrigin(0, 0).setStrokeStyle(1, 0x7fd4ff, 0.6).setDepth(55).setScrollFactor(0),
        scene.add.rectangle(x, 91, 260, 10, 0x1f6fd6).setOrigin(0, 0).setDepth(55).setScrollFactor(0),
      );
      this.chantBars.push(scene.add.rectangle(x, 91, 260, 10, 0x7fd4ff).setOrigin(0, 0).setDepth(56).setScrollFactor(0));
      this.chantGlows.push(scene.add.rectangle(x, 91, 260, 10, 0xffffff, 0).setOrigin(0, 0).setDepth(57).setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.ADD));
      const quarters = scene.add.graphics().setDepth(57).setScrollFactor(0).lineStyle(2, 0x0e3a80, 0.6);
      for (let q = 1; q < 4; q++) quarters.lineBetween(x + 65 * q, 91, x + 65 * q, 101);
      this.decor.push(quarters);
      this.chantLabels.push(scene.add.text(x, 108, '', { fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: '#fff7ec',
        backgroundColor: '#0e3a80', padding: { x: 6, y: 3 } }).setDepth(56).setScrollFactor(0));
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
    const dt = Math.min(this.scene.game.loop.delta || 16, 50), now = this.scene.time.now;
    const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.playerBar.setHealth(player.currentHealth);
    this.opponentBar.setHealth(opponent.currentHealth);
    this.playerBar.update(dt); this.opponentBar.update(dt);
    this.timer.setTime(timeLeft);
    [player, opponent].forEach((fighter, i) => {
      // A full bar glows and its label jumps the moment the super becomes available.
      this.chantGlows[i].setAlpha(fighter.superReady && motion ? 0.25 + Math.sin(now / 90) * 0.25 : 0);
      if (fighter.superReady && !this.wasReady[i] && motion) {
        const label = this.chantLabels[i];
        this.scene.tweens.killTweensOf(label);
        label.setScale(1.5);
        this.scene.tweens.add({ targets: label, scale: 1, duration: 380, ease: 'Back.easeOut' });
      }
      this.wasReady[i] = fighter.superReady;
      this.chantBars[i].setDisplaySize(260 * fighter.energy / 100, 10).setFillStyle(fighter.superReady ? 0xffb02e : 0x7fd4ff);
      this.chantLabels[i].setText(fighter.inSuper ? 'Súper en curso'
        : fighter.combatState.state === 'STUNNED' ? 'Aturdido'
        : fighter.superReady ? (i === 0 ? 'O · ' : '') + 'SÚPER LISTO'
        : 'Energía ' + Math.floor(fighter.energy) + '% · Carga al combatir');
      this.chantLabels[i].setColor(fighter.superReady ? '#ffb02e' : '#fff7ec');
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

  /** Fills one pip per round won by each side. */
  setRoundWins(player: number, opponent: number): void {
    [player, opponent].forEach((wins, side) => this.roundPips[side].forEach((pip, r) =>
      pip.setFillStyle(r < wins ? 0xffc93c : 0x1f6fd6)));
  }

  destroy(): void {
    this.roundPips.flat().forEach(pip => pip.destroy());
    this.playerBar.destroy();
    this.opponentBar.destroy();
    this.timer.destroy();
    this.debugPanel?.destroy();
    this.fpsText?.destroy();
    this.debugBg?.destroy();
    this.chantLabels.forEach(label => label.destroy());
    this.chantBars.forEach(bar => bar.destroy());
    this.chantGlows.forEach(glow => glow.destroy());
    this.decor.forEach(part => part.destroy());
  }
}
