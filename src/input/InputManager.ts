// ============================================================
// InputManager — Wraps Phaser keyboard and exposes clean API
// ============================================================

import Phaser from 'phaser';
import { DEFAULT_BINDINGS } from './InputMapping';

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

export class InputManager {
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.registerKeys();
  }

  private registerKeys(): void {
    if (!this.scene.input.keyboard) return;

    const allKeys = new Set<string>();
    for (const arr of Object.values(DEFAULT_BINDINGS)) {
      for (const k of arr) allKeys.add(k);
    }

    allKeys.forEach(k => {
      const key = this.scene.input.keyboard!.addKey(k, false);
      this.keys.set(k, key);
    });
  }

  private isDown(...keys: string[]): boolean {
    return keys.some(k => this.keys.get(k)?.isDown ?? false);
  }

  private justDown(...keys: string[]): boolean {
    return keys.some(k => Phaser.Input.Keyboard.JustDown(this.keys.get(k)!));
  }

  getState(): InputState {
    const b = DEFAULT_BINDINGS;
    return {
      moveLeft:   this.isDown(...b.MOVE_LEFT),
      moveRight:  this.isDown(...b.MOVE_RIGHT),
      jump:       this.justDown(...b.JUMP),
      crouch:     this.isDown(...b.CROUCH),
      lightPunch: this.justDown(...b.LIGHT_PUNCH),
      heavyPunch: this.justDown(...b.HEAVY_PUNCH),
      lightKick:  this.justDown(...b.LIGHT_KICK),
      heavyKick:  this.justDown(...b.HEAVY_KICK),
      block:      this.isDown(...b.BLOCK),
      special:    this.justDown(...b.SPECIAL),
      taunt:      this.justDown(...b.TAUNT),
      pause:      this.justDown(...b.PAUSE),
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
