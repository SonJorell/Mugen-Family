// ============================================================
// CreditsScene — Rolling credits after the arcade ending
// ============================================================

import Phaser from 'phaser';
import { CREDITS } from '../config/arcade';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio } from '../systems/GameAudio';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

/** Scroll speed of the credits (px/s). */
const SCROLL_SPEED = 46;

export class CreditsScene extends Phaser.Scene {
  private roll!: Phaser.GameObjects.Container;
  private rollHeight = 0;
  private reduced = false;
  private leaving = false;

  constructor() { super({ key: 'CreditsScene' }); }

  create(): void {
    isolateSceneKeyboard(this);
    this.leaving = false;
    GameAudio.for(this).play('music-menu');
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.add.rectangle(640, 360, 1280, 720, 0x0e47a8);
    this.roll = this.add.container(0, 0);
    let y = 0;
    for (const block of CREDITS) {
      this.roll.add(this.add.text(640, y, block.heading.toUpperCase(), {
        fontFamily: FONT_IMPACT, fontSize: '30px', color: '#ffb02e',
      }).setOrigin(0.5, 0));
      y += 44;
      for (const line of block.lines) {
        this.roll.add(this.add.text(640, y, line, { fontFamily: FONT_UI, fontSize: '20px', color: '#fff7ec' }).setOrigin(0.5, 0));
        y += 30;
      }
      y += 34;
    }
    this.rollHeight = y;
    // Reduced motion: no scrolling, the credits fit as a still, scaled page.
    if (this.reduced) {
      const scale = Math.min(1, 600 / this.rollHeight);
      this.roll.setScale(scale).setPosition(640 * (1 - scale), 40);
    } else {
      this.roll.setY(720);
    }
    this.add.text(640, 694, 'Enter o Esc · Menú principal', { fontFamily: FONT_UI, fontSize: '15px', color: '#e3f1ff' })
      .setOrigin(0.5).setName('credits-help');
    for (const k of ['ENTER', 'SPACE', 'ESC']) this.input.keyboard!.on('keydown-' + k, () => this.finish());
  }

  /** True once the whole roll has passed (always true with reduced motion). */
  get rolledOut(): boolean { return this.reduced || this.roll.y + this.rollHeight < 0; }

  update(_time: number, delta: number): void {
    if (this.reduced || this.leaving) return;
    this.roll.y -= SCROLL_SPEED * Math.min(delta, 50) / 1000;
    if (this.rolledOut) this.finish();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('MenuScene');
  }
}
