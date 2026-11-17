// ============================================================
// TouchControls — On-screen pad and buttons for touch screens (player 1)
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { InputState } from '../input/InputManager';
import { FONT_UI } from './fonts';

type HeldAction = 'moveLeft' | 'moveRight' | 'jump' | 'crouch' | 'lightPunch' | 'heavyPunch' | 'lightKick' | 'heavyKick' | 'block' | 'special' | 'dash';
/** Actions that fire once per touch, like a key's JustDown; the rest act while held. */
const PRESS_ACTIONS: ReadonlySet<HeldAction> = new Set(['jump', 'lightPunch', 'heavyPunch', 'lightKick', 'heavyKick', 'special', 'dash']);

interface TouchButton { action: HeldAction; x: number; y: number; r: number; label: string; color: number; shape: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text; }

/** True on devices with a touch screen. */
export function isTouchDevice(game: Phaser.Game): boolean {
  return game.device.input.touch || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

/**
 * Each frame, every finger on the screen is matched to the button under it, so fingers can slide
 * from one arrow to another and press several buttons at once. Shown only on touch screens; a key
 * press hides it and the next touch brings it back.
 */
export class TouchControls {
  visible = true;
  private buttons: TouchButton[] = [];
  private held = new Set<HeldAction>();
  private previous = new Set<HeldAction>();

  constructor(private readonly scene: Phaser.Scene) {
    const layout = GAME_CONFIG.TOUCH;
    scene.input.addPointer(layout.EXTRA_POINTERS);
    const make = (action: HeldAction, x: number, y: number, label: string, color: number, r: number = layout.BUTTON_RADIUS) => {
      const shape = scene.add.circle(x, y, r, color, layout.ALPHA).setStrokeStyle(3, 0xffffff, 0.55)
        .setScrollFactor(0).setDepth(70).setName(`touch-${action}`);
      const text = scene.add.text(x, y, label, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: r > 40 ? '26px' : '22px', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(71);
      this.buttons.push({ action, x, y, r, label, color, shape, text });
    };
    const pad = layout.PAD, act = layout.ACTIONS;
    make('moveLeft', pad.x - pad.gap, pad.y, '◀', 0x2a3d55);
    make('moveRight', pad.x + pad.gap, pad.y, '▶', 0x2a3d55);
    make('jump', pad.x, pad.y - pad.gap, '▲', 0x2a3d55);
    make('crouch', pad.x, pad.y + pad.gap, '▼', 0x2a3d55);
    make('lightPunch', act.x, act.y, 'PS', 0xb04a73);
    make('heavyPunch', act.x + act.gap, act.y, 'PF', 0xb04a73);
    make('special', act.x + act.gap * 2, act.y, 'SP', 0xc98b2e);
    make('lightKick', act.x, act.y + act.gap, 'KS', 0x3a7f8a);
    make('heavyKick', act.x + act.gap, act.y + act.gap, 'KF', 0x3a7f8a);
    make('block', act.x + act.gap * 2, act.y + act.gap, 'BL', 0x4b4f63);
    // Dash with the d-pad direction held; a double tap on ◀ or ▶ also dashes.
    make('dash', act.x - act.gap, act.y + act.gap, 'DS', 0x5a4b8a, layout.BUTTON_RADIUS * 0.85);

    const keyboardHides = () => this.setVisible(false);
    const touchShows = (pointer: Phaser.Input.Pointer) => { if (pointer.wasTouch) this.setVisible(true); };
    scene.input.keyboard?.on('keydown', keyboardHides);
    scene.input.on('pointerdown', touchShows);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown', keyboardHides);
      scene.input.off('pointerdown', touchShows);
    });
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.buttons.forEach(b => { b.shape.setVisible(visible); b.text.setVisible(visible); });
    if (!visible) { this.held.clear(); this.previous.clear(); }
    this.scene.events.emit('touch-controls-visible', visible);
  }

  /** Which buttons the fingers on screen are holding right now. */
  private sample(): Set<HeldAction> {
    const held = new Set<HeldAction>();
    if (!this.visible) return held;
    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown || !pointer.wasTouch) continue;
      for (const b of this.buttons) {
        // A little slack around each button so a thumb on its edge still counts.
        if (Phaser.Math.Distance.Between(pointer.x, pointer.y, b.x, b.y) <= b.r * GAME_CONFIG.TOUCH.HIT_SLACK) held.add(b.action);
      }
    }
    return held;
  }

  /** Input for this frame. Call once per frame (the player's InputManager does). */
  poll(): Partial<InputState> {
    this.previous = this.held;
    this.held = this.sample();
    for (const b of this.buttons) b.shape.setFillStyle(b.color, this.held.has(b.action) ? 0.85 : GAME_CONFIG.TOUCH.ALPHA);
    const state: Partial<InputState> = {};
    for (const action of this.held) {
      state[action] = PRESS_ACTIONS.has(action) ? !this.previous.has(action) : true;
    }
    return state;
  }

  destroy(): void {
    this.buttons.forEach(b => { b.shape.destroy(); b.text.destroy(); });
    this.buttons = [];
  }
}
