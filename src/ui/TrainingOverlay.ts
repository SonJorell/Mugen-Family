// ============================================================
// TrainingOverlay — Input viewer and frame data for the practice mode
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { InputState } from '../input/InputManager';
import type { AttackDefinition } from '../combat/AttackDefinition';

export interface TrainingOptions {
  /** List of the player's recent inputs on the left. */
  inputs: boolean;
  /** Startup, active, recovery and advantage of the player's last attack on the right. */
  frames: boolean;
  /** Both fighters recover full health once a combo is over. */
  refill: boolean;
}

export const DEFAULT_TRAINING: TrainingOptions = { inputs: false, frames: false, refill: false };

/** Frame data of one attack; advantages are null until it touches the dummy. */
export interface FrameData {
  name: string;
  startup: number;
  active: number;
  recovery: number;
  onHit: number | null;
  onBlock: number | null;
}

const ATTACK_NAMES: Record<string, string> = {
  LIGHT_PUNCH: 'Puño suave', HEAVY_PUNCH: 'Puño fuerte', LIGHT_KICK: 'Patada suave', HEAVY_KICK: 'Patada fuerte', SPECIAL_ATTACK: 'Súper',
  RUSH: 'Paso veloz', STOMP: 'Pisotón sísmico', CROUCH_LIGHT: 'Patada baja', LAUNCHER: 'Lanzador', SWEEP: 'Barrido',
  AIR_PUNCH: 'Puño aéreo', AIR_KICK: 'Patada aérea', THROW: 'Agarre',
};

/** Signed frame count, e.g. +3, −11, 0. */
export const signed = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';

/** Presentation only: the scene feeds it inputs and attacks and toggles it from the pause. */
export class TrainingOverlay {
  options: TrainingOptions;
  /** Most recent first: a compact description of the input and how many frames it was held. */
  history: { text: string; frames: number }[] = [];
  lastAttack: FrameData | null = null;
  private inputText: Phaser.GameObjects.Text;
  private framesText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, options: TrainingOptions) {
    this.options = { ...options };
    const style = { fontFamily: 'Courier New, monospace', fontSize: '17px', color: '#fff7ec', backgroundColor: '#0b0d16cc', padding: { x: 10, y: 8 } };
    this.inputText = scene.add.text(28, 270, '', style).setDepth(59).setScrollFactor(0).setName('training-inputs');
    this.framesText = scene.add.text(GAME_CONFIG.WIDTH - 28, 176, '', { ...style, align: 'right' }).setOrigin(1, 0)
      .setDepth(59).setScrollFactor(0).setName('training-frames');
    this.refresh();
  }

  setOptions(options: TrainingOptions): void { this.options = { ...options }; this.refresh(); }

  /** Called once per simulated frame with the player's input. */
  recordInput(input: InputState | null, facingRight: boolean): void {
    if (!this.options.inputs || !input) return;
    const forward = facingRight ? input.moveRight : input.moveLeft, back = facingRight ? input.moveLeft : input.moveRight;
    const dir = input.jump ? (forward ? '↗' : back ? '↖' : '↑') : input.crouch ? (forward ? '↘' : back ? '↙' : '↓') : forward ? '→' : back ? '←' : '·';
    const buttons = [input.lightPunch && 'PS', input.heavyPunch && 'PF', input.lightKick && 'KS', input.heavyKick && 'KF',
      input.block && 'BL', input.special && 'SP'].filter(Boolean).join('+');
    const text = buttons ? `${dir} ${buttons}` : dir;
    const top = this.history[0];
    if (top && top.text === text && !buttons) top.frames++;
    else this.history.unshift({ text, frames: 1 });
    this.history.length = Math.min(this.history.length, GAME_CONFIG.TRAINING.INPUT_HISTORY);
    this.refresh();
  }

  /** The player started an attack: show its frames until it connects. */
  recordAttack(def: AttackDefinition): void {
    this.lastAttack = { name: def.name, startup: def.startup, active: def.active, recovery: def.recovery, onHit: null, onBlock: null };
    this.refresh();
  }

  /**
   * The attack touched the dummy `framesIn` frames after it started. Advantage = frames the
   * defender stays locked (hitstun or blockstun) minus frames the attacker still needs to recover.
   */
  recordContact(def: AttackDefinition, framesIn: number): void {
    if (!this.lastAttack || this.lastAttack.name !== def.name) this.recordAttack(def);
    const remaining = Math.max(0, def.startup + def.active + def.recovery - framesIn);
    this.lastAttack!.onHit = def.causesKnockdown ? null : def.hitstun - remaining;
    this.lastAttack!.onBlock = def.blockstun - remaining;
    this.refresh();
  }

  refresh(): void {
    this.inputText.setVisible(this.options.inputs);
    this.inputText.setText(['ENTRADAS', ...this.history.map(h => `${h.text.padEnd(9)} ${String(h.frames).padStart(3)}`)].join('\n'));
    this.framesText.setVisible(this.options.frames);
    const a = this.lastAttack;
    this.framesText.setText(a ? [
      ATTACK_NAMES[a.name] ?? a.name,
      `Inicio ${a.startup} · Activo ${a.active} · Recup. ${a.recovery}`,
      `Al golpear: ${a.onHit === null ? (['HEAVY_KICK', 'STOMP', 'SWEEP'].includes(a.name) ? 'derriba' : a.name === 'LAUNCHER' ? 'lanza' : '—') : signed(a.onHit)}`,
      `Al bloquear: ${a.onBlock === null ? '—' : signed(a.onBlock)}`,
    ].join('\n') : 'DATOS DE FRAMES\nAtaca al muñeco');
  }

  destroy(): void { this.inputText.destroy(); this.framesText.destroy(); }
}
