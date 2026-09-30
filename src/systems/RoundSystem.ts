// ============================================================
// RoundSystem — Manages round flow (intro, fight, end)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export type RoundPhase = 'INTRO' | 'FIGHT' | 'END';

export class RoundSystem {
  private scene: Phaser.Scene;
  private _phase: RoundPhase = 'INTRO';
  private _round: number = 1;
  private _timeLeft: number = GAME_CONFIG.ROUND_TIME;
  private _timerRunning: boolean = false;
  private _elapsed: number = 0;

  // UI
  private roundText: Phaser.GameObjects.Text;
  private fightText: Phaser.GameObjects.Text;

  onRoundEnd?: (winner: 'player' | 'opponent' | 'timeout') => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.roundText = scene.add.text(
      GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2,
      '', { fontFamily: 'Arial Black', fontSize: '64px', color: '#ffffff', stroke: '#000', strokeThickness: 8 }
    ).setOrigin(0.5).setDepth(200).setAlpha(0).setScrollFactor(0);

    this.fightText = scene.add.text(
      GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2,
      '', { fontFamily: 'Arial Black', fontSize: '80px', color: '#ffdd00', stroke: '#c00000', strokeThickness: 10 }
    ).setOrigin(0.5).setDepth(200).setAlpha(0).setScrollFactor(0);
  }

  get phase(): RoundPhase { return this._phase; }
  get timeLeft(): number  { return Math.ceil(this._timeLeft); }
  get round(): number     { return this._round; }

  startRound(): void {
    this._phase = 'INTRO';
    this._timeLeft = GAME_CONFIG.ROUND_TIME;
    this._timerRunning = false;

    this.showRoundIntro();
  }

  private showRoundIntro(): void {
    this.roundText.setText(`ROUND ${this._round}`).setAlpha(1);

    this.scene.tweens.add({
      targets: this.roundText,
      alpha: 0,
      delay: 1800,
      duration: 400,
      onComplete: () => this.showFight(),
    });
  }

  private showFight(): void {
    this.fightText.setText('FIGHT!').setAlpha(1);
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

    if (this._timeLeft <= 0) {
      this._timeLeft = 0;
      this.endRound(playerHP > opponentHP ? 'player' : opponentHP > playerHP ? 'opponent' : 'timeout');
    } else if (playerHP <= 0) {
      this.endRound('opponent');
    } else if (opponentHP <= 0) {
      this.endRound('player');
    }
  }

  private endRound(winner: 'player' | 'opponent' | 'timeout'): void {
    if (this._phase === 'END') return;
    this._phase = 'END';
    this._timerRunning = false;
    this.onRoundEnd?.(winner);
  }
}
