// ============================================================
// InputManager — One player's keyboard keys and gamepad, as a clean input state
// ============================================================

import Phaser from 'phaser';
import { DEFAULT_BINDINGS, KeyBindings } from './InputMapping';
import type { TouchControls } from '../ui/TouchControls';

export interface InputState {
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  crouch: boolean;
  lightPunch: boolean;
  heavyPunch: boolean;
  lightKick: boolean;
  heavyKick: boolean;
  block: boolean;
  special: boolean;
  taunt: boolean;
  pause: boolean;
}

/**
 * Standard-layout gamepad buttons per action (Xbox names): X/Y punches, A/B kicks, RB or LT
 * block, RT super, LB taunt, Start pause. Movement uses the d-pad or the left stick.
 */
export const PAD_BUTTONS = {
  lightPunch: [2], heavyPunch: [3], lightKick: [0], heavyKick: [1],
  block: [5, 6], special: [7], taunt: [4], pause: [9],
} as const;
const STICK_DEADZONE = 0.55;

type PressAction = 'jump' | 'lightPunch' | 'heavyPunch' | 'lightKick' | 'heavyKick' | 'special' | 'taunt' | 'pause';

export class InputManager {
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private scene: Phaser.Scene;
  private readonly bindings: KeyBindings;
  /** Gamepad slot (0 = first pad) or null for keyboard only. */
  private readonly padIndex: number | null;
  /** Pad buttons held on the previous poll, so presses fire once like JustDown. */
  private padHeld = new Set<PressAction>();

  /** On-screen buttons on touch screens (player 1 only). */
  private readonly touch: TouchControls | null;

  constructor(scene: Phaser.Scene, bindings: KeyBindings = DEFAULT_BINDINGS, padIndex: number | null = 0, touch: TouchControls | null = null) {
    this.scene = scene;
    this.bindings = bindings;
    this.padIndex = padIndex;
    this.touch = touch;
    this.registerKeys();
  }

  private registerKeys(): void {
    if (!this.scene.input.keyboard) return;
    const allKeys = new Set<string>();
    for (const arr of Object.values(this.bindings)) for (const k of arr) allKeys.add(k);
    allKeys.forEach(k => {
      try { this.keys.set(k, this.scene.input.keyboard!.addKey(k, false)); }
      catch { /* An unknown key name in saved settings is ignored instead of breaking the fight. */ }
    });
  }

  private isDown(keys: string[]): boolean {
    return keys.some(k => this.keys.get(k)?.isDown ?? false);
  }

  private justDown(keys: string[]): boolean {
    let any = false;
    for (const k of keys) { const key = this.keys.get(k); if (key && Phaser.Input.Keyboard.JustDown(key)) any = true; }
    return any;
  }

  /** The connected pad for this player, if any. */
  private get pad(): Phaser.Input.Gamepad.Gamepad | null {
    if (this.padIndex === null) return null;
    const plugin = this.scene.input.gamepad;
    if (!plugin || !plugin.enabled) return null;
    return plugin.getPad(this.padIndex) ?? null;
  }

  private padState(): Partial<InputState> {
    const pad = this.pad;
    if (!pad || !pad.connected) { this.padHeld.clear(); return {}; }
    const button = (ids: readonly number[]) => ids.some(i => pad.buttons[i]?.pressed ?? false);
    const stick = pad.leftStick;
    const held: Record<PressAction, boolean> = {
      jump: pad.up || stick.y < -STICK_DEADZONE,
      lightPunch: button(PAD_BUTTONS.lightPunch), heavyPunch: button(PAD_BUTTONS.heavyPunch),
      lightKick: button(PAD_BUTTONS.lightKick), heavyKick: button(PAD_BUTTONS.heavyKick),
      special: button(PAD_BUTTONS.special), taunt: button(PAD_BUTTONS.taunt), pause: button(PAD_BUTTONS.pause),
    };
    const pressed = {} as Record<PressAction, boolean>;
    for (const action of Object.keys(held) as PressAction[]) {
      pressed[action] = held[action] && !this.padHeld.has(action);
      if (held[action]) this.padHeld.add(action); else this.padHeld.delete(action);
    }
    return {
      ...pressed,
      moveLeft: pad.left || stick.x < -STICK_DEADZONE,
      moveRight: pad.right || stick.x > STICK_DEADZONE,
      crouch: pad.down || stick.y > STICK_DEADZONE,
      block: button(PAD_BUTTONS.block),
    };
  }

  getState(): InputState {
    const b = this.bindings, pad = { ...this.padState() };
    // Touch buttons merge in like a second gamepad.
    for (const [action, on] of Object.entries(this.touch?.poll() ?? {})) {
      if (on) (pad as Record<string, boolean>)[action] = true;
    }
    return {
      moveLeft:   this.isDown(b.MOVE_LEFT) || !!pad.moveLeft,
      moveRight:  this.isDown(b.MOVE_RIGHT) || !!pad.moveRight,
      jump:       this.justDown(b.JUMP) || !!pad.jump,
      crouch:     this.isDown(b.CROUCH) || !!pad.crouch,
      lightPunch: this.justDown(b.LIGHT_PUNCH) || !!pad.lightPunch,
      heavyPunch: this.justDown(b.HEAVY_PUNCH) || !!pad.heavyPunch,
      lightKick:  this.justDown(b.LIGHT_KICK) || !!pad.lightKick,
      heavyKick:  this.justDown(b.HEAVY_KICK) || !!pad.heavyKick,
      block:      this.isDown(b.BLOCK) || !!pad.block,
      special:    this.justDown(b.SPECIAL) || !!pad.special,
      taunt:      this.justDown(b.TAUNT) || !!pad.taunt,
      pause:      !!pad.pause,
    };
  }

  isKeyJustDown(keyCode: string): boolean {
    const key = this.keys.get(keyCode);
    if (!key) return false;
    return Phaser.Input.Keyboard.JustDown(key);
  }

  destroy(): void {
    this.keys.clear();
  }
}
