// ============================================================
// HUD — Full heads-up display: health bars, timer, debug panel
// ============================================================

import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { Timer } from './Timer';
import { GAME_CONFIG } from '../config/gameConfig';
import { Fighter } from '../characters/Fighter';
import { FONT_UI } from './fonts';
import { C, CSS, drawGlass } from './theme';
import { ensureFaceTexture } from './selection/fighterFaces';

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
  private roundPips: Phaser.GameObjects.Polygon[][] = [[], []];

  private readonly BAR_MARGIN = 92;
  private readonly BAR_WIDTH = (GAME_CONFIG.WIDTH / 2) - 148;
  private readonly BAR_Y = 48;

  constructor(
    scene: Phaser.Scene,
    playerName: string,
    opponentName: string,
    playerMaxHealth = GAME_CONFIG.MAX_HEALTH,
    opponentMaxHealth = GAME_CONFIG.MAX_HEALTH,
    portraits?: [string, string],
    tints: [number, number] = [0xffffff, 0xffffff],
  ) {
    this.scene = scene;
    // No full-width band: each health bar has its own glass plate (HealthBar), so the stage shows through.

    // Framed fighter face medallions flanking both health bars.
    if (portraits) {
      portraits.forEach((id, side) => {
        const px = side === 0 ? 46 : GAME_CONFIG.WIDTH - 46, py = 44;
        const accent = side === 0 ? C.primary : C.tertiary;
        // Ivory glass medallion with a hard ink offset and the side's accent rim.
        const frame = drawGlass(scene.add.graphics(), px - 32, py - 32, 64, 64, { alpha: 0.7, chamfer: 8, shadow: 3, rim: accent, rimAlpha: 1 })
          .setDepth(52).setScrollFactor(0);
        this.decor.push(frame);
        const key = ensureFaceTexture(scene, id);
        if (key) {
          const face = scene.add.image(px, py, key).setDisplaySize(58, 58)
            .setFlipX(side === 1).setTint(tints[side]).setDepth(53).setScrollFactor(0)
            .setName(`hud-portrait-${side}`);
          this.decor.push(face);
        }
        const corner = scene.add.graphics().setDepth(54).setScrollFactor(0);
        corner.lineStyle(3, C.ink, 1);
        const cx = side === 0 ? px - 32 : px + 32, dir = side === 0 ? 1 : -1;
        corner.lineBetween(cx, py - 32, cx + dir * 12, py - 32);
        corner.lineBetween(cx, py - 32, cx, py - 20);
        this.decor.push(corner);
      });
    }

    this.playerBar = new HealthBar(
      scene,
      this.BAR_MARGIN, this.BAR_Y,
      this.BAR_WIDTH,
      playerMaxHealth,
      playerName,
      false,
      C.primary,
    );

    this.opponentBar = new HealthBar(
      scene,
      GAME_CONFIG.WIDTH - this.BAR_MARGIN - this.BAR_WIDTH, this.BAR_Y,
      this.BAR_WIDTH,
      opponentMaxHealth,
      opponentName,
      true,
      C.tertiary,
    );

    this.timer = new Timer(scene);
    // Round-win chips: diamonds on the name line, next to the timer (inner end of each bar).
    // Empty: ink outline at 30%; won: solid gold with an ink edge.
    for (let side = 0; side < 2; side++) {
      for (let r = 0; r < GAME_CONFIG.ROUNDS_TO_WIN; r++) {
        const x = side === 0
          ? this.BAR_MARGIN + this.BAR_WIDTH - 8 - r * 22
          : GAME_CONFIG.WIDTH - this.BAR_MARGIN - this.BAR_WIDTH + 8 + r * 22;
        this.roundPips[side].push(scene.add.polygon(x, this.BAR_Y - 16, [0, -9, 8, 0, 0, 9, -8, 0], C.ivory, 0.35)
          .setStrokeStyle(2, C.ink, 0.6).setDepth(56).setScrollFactor(0));
      }
    }
    // Left energy bar fills left→right from x=92; right bar sits clear of «Pausa · Esc» and fills right→left.
    const energyAnchors = [
      { left: 92, anchor: 92, origin: 0 },
      { left: 846, anchor: 1106, origin: 1 },
    ];
    for (const { left, anchor, origin } of energyAnchors) {
      this.decor.push(
        // Energy gauge: ink track on a strip of glass, filled orange, gold once the super is ready.
        drawGlass(scene.add.graphics(), left - 5, 88, 270, 16, { chamfer: 5, shadow: 2 }).setDepth(55).setScrollFactor(0),
        scene.add.rectangle(left, 91, 260, 10, C.ink, 0.85).setOrigin(0, 0).setDepth(55).setScrollFactor(0),
      );
      this.chantBars.push(scene.add.rectangle(anchor, 91, 260, 10, C.primary).setOrigin(origin, 0).setDepth(56).setScrollFactor(0));
      this.chantGlows.push(scene.add.rectangle(anchor, 91, 260, 10, 0xffffff, 0).setOrigin(origin, 0).setDepth(57).setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.ADD));
      const quarters = scene.add.graphics().setDepth(57).setScrollFactor(0).lineStyle(2, C.ivory, 0.9);
      for (let q = 1; q < 4; q++) quarters.lineBetween(left + 65 * q, 91, left + 65 * q, 101);
      this.decor.push(quarters);
      this.chantLabels.push(scene.add.text(anchor, 110, '', { fontFamily: FONT_UI, fontSize: '13px', fontStyle: 'bold', color: CSS.ink,
        backgroundColor: 'rgba(253, 251, 247, 0.72)', padding: { x: 6, y: 3 } }).setOrigin(origin, 0).setDepth(56).setScrollFactor(0));
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
      this.chantBars[i].setDisplaySize(260 * fighter.energy / 100, 10).setFillStyle(fighter.superReady ? C.gold : C.primary);
      this.chantLabels[i].setText(fighter.inSuper ? 'Súper en curso'
        : fighter.combatState.state === 'STUNNED' ? 'Aturdido'
        : fighter.superReady ? (i === 0 ? 'O · ' : '') + 'SÚPER LISTO'
        : 'Energía ' + Math.floor(fighter.energy) + '% · Carga al combatir');
      this.chantLabels[i].setColor(fighter.superReady ? CSS.secondary : CSS.ink);
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
      pip.setFillStyle(r < wins ? C.gold : C.ivory, r < wins ? 1 : 0.35).setStrokeStyle(2, C.ink, r < wins ? 1 : 0.6)));
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
