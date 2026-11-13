// ============================================================
// RoundSystem — Manages round flow (intro, fight, end)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { BANNER_STYLES, showBanner } from '../ui/EpicBanner';
import { announce, roundLine } from './Announcer';

export type RoundPhase = 'INTRO' | 'FIGHT' | 'END';
export type RoundWinner = 'player' | 'opponent' | 'draw';
export type RoundEndReason = 'ko' | 'timeout';

export class RoundSystem {
  private scene: Phaser.Scene;
  private _phase: RoundPhase = 'INTRO';
  private _round: number = 1;
  private _timeLeft: number = GAME_CONFIG.ROUND_TIME;
  private _timerRunning: boolean = false;
  private _elapsed: number = 0;
  private _wins = { player: 0, opponent: 0 };

  // Invisible timing carriers: their tweens drive the intro; the visible text is an EpicBanner.
  private roundText: Phaser.GameObjects.Text;
  private fightText: Phaser.GameObjects.Text;

  onRoundEnd?: (winner: RoundWinner, reason: RoundEndReason) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.roundText = scene.add.text(
      GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2,
      '', { fontFamily: 'Arial Black', fontSize: '64px', color: '#ffffff', stroke: '#000', strokeThickness: 8 }
    ).setOrigin(0.5).setDepth(200).setAlpha(0).setScrollFactor(0).setVisible(false);

    this.fightText = scene.add.text(
      GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2,
      '', { fontFamily: 'Arial Black', fontSize: '80px', color: '#ffdd00', stroke: '#c00000', strokeThickness: 10 }
    ).setOrigin(0.5).setDepth(200).setAlpha(0).setScrollFactor(0).setVisible(false);
  }

  get phase(): RoundPhase { return this._phase; }
  get timeLeft(): number  { return Math.ceil(this._timeLeft); }
  get round(): number     { return this._round; }
  /** Rounds won by each side; a draw scores for nobody. */
  get wins(): { player: number; opponent: number } { return { ...this._wins }; }

  /** True once a side reached ROUNDS_TO_WIN, or the round cap was played. */
  get matchOver(): boolean {
    return this._wins.player >= GAME_CONFIG.ROUNDS_TO_WIN || this._wins.opponent >= GAME_CONFIG.ROUNDS_TO_WIN ||
      (this._phase === 'END' && this._round >= GAME_CONFIG.MAX_ROUNDS);
  }

  /** Match winner by rounds won; 'draw' when tied (only possible at the round cap). */
  get matchWinner(): RoundWinner {
    const { player, opponent } = this._wins;
    return player > opponent ? 'player' : opponent > player ? 'opponent' : 'draw';
  }

  /** Advances to the next round of the match and plays its intro. */
  nextRound(): void {
    if (this.matchOver) return;
    this._round++;
    this.startRound();
  }

  startRound(): void {
    this._phase = 'INTRO';
    this._timeLeft = GAME_CONFIG.ROUND_TIME;
    this._timerRunning = false;

    this.showRoundIntro();
  }

  private showRoundIntro(): void {
    announce(this.scene, roundLine(this._round));
    this.roundText.setText(`ROUND ${this._round}`).setAlpha(1);
    showBanner(this.scene, `ROUND ${this._round}`, { ...BANNER_STYLES.round, hold: 1250, depth: 200 });

    this.scene.tweens.add({
      targets: this.roundText,
      alpha: 0,
      delay: 1800,
      duration: 400,
      onComplete: () => this.showFight(),
    });
  }

  private showFight(): void {
    announce(this.scene, 'fight');
    this.fightText.setText('FIGHT!').setAlpha(1);
    showBanner(this.scene, '¡PELEA!', { ...BANNER_STYLES.fight, hold: 520, depth: 200 });
    this.scene.tweens.add({
      targets: this.fightText,
      alpha: 0,
      delay: 700,
      duration: 400,
      onComplete: () => {
        this._phase = 'FIGHT';
        this._timerRunning = true;
      },
    });
  }

  update(delta: number, playerHP: number, opponentHP: number): void {
    if (this._phase !== 'FIGHT' || !this._timerRunning) return;

    this._timeLeft -= delta / 1000;

    if (playerHP <= 0 || opponentHP <= 0) {
      this.endRound(playerHP <= 0 && opponentHP <= 0 ? 'draw' : playerHP <= 0 ? 'opponent' : 'player', 'ko');
    } else if (this._timeLeft <= 0) {
      this._timeLeft = 0;
      this.endRound(playerHP > opponentHP ? 'player' : opponentHP > playerHP ? 'opponent' : 'draw', 'timeout');
    }
  }

  private endRound(winner: RoundWinner, reason: RoundEndReason): void {
    if (this._phase === 'END') return;
    this._phase = 'END';
    this._timerRunning = false;
    if (winner !== 'draw') this._wins[winner]++;
    this.onRoundEnd?.(winner, reason);
  }
}
