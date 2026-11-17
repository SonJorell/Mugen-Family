// ============================================================
// ControlsScene — Remap each player's keys (Configuración → Controles)
// ============================================================

import Phaser from 'phaser';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio } from '../systems/GameAudio';
import {
  ACTION_LABELS, BindingSet, PlayerSlot, REMAPPABLE, assignKey, keyLabel, keyNameFromCode, loadBindings, resetBindings, saveBindings,
} from '../input/Bindings';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

const INK = '#fff3d8', AQUA = '#9fe8e1', GOLD = '#f5bd75', RED = '#ff8f8f', MUTED = '#d3dce2';

/** One row per remappable action, then «Restaurar valores» and «Volver». */
export class ControlsScene extends Phaser.Scene {
  slot: PlayerSlot = 'p1';
  selectedIndex = 0;
  /** True while waiting for the key to assign to the selected action. */
  listening = false;
  message = '';
  bindings!: BindingSet;
  private returnData: Record<string, unknown> = {};
  private content!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'ControlsScene' }); }

  init(data: Record<string, unknown>): void {
    this.returnData = { ...(data ?? {}) };
    this.slot = 'p1'; this.selectedIndex = 0; this.listening = false; this.message = '';
    this.bindings = loadBindings();
  }

  private get rowCount(): number { return REMAPPABLE.length + 2; }

  create(): void {
    isolateSceneKeyboard(this);
    GameAudio.for(this).play('music-menu');
    this.add.image(640, 360, 'menu_arica_coast').setDisplaySize(1324, 745).setAlpha(0.55);
    this.add.rectangle(640, 360, 1280, 720, 0x06111b, 0.86);
    this.add.text(96, 40, 'CONTROLES', { fontFamily: FONT_IMPACT, fontSize: '56px', color: INK });
    this.content = this.add.container(0, 0);

    // A single listener so a key being assigned is never also read as navigation.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.repeat) return;
      if (this.listening) { this.capture(event); return; }
      const name = keyNameFromCode(event.keyCode, Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>);
      if (name === 'UP' || name === 'W') this.navigate(-1);
      else if (name === 'DOWN' || name === 'S') this.navigate(1);
      else if (name === 'LEFT' || name === 'RIGHT' || name === 'A' || name === 'D' || name === 'TAB') this.switchSlot();
      else if (name === 'ENTER' || name === 'SPACE') this.activate();
      else if (name === 'ESC') this.back();
    });
    this.render();
  }

  // ── Actions ──────────────────────────────────────────────

  private navigate(delta: number): void {
    this.selectedIndex = (this.selectedIndex + delta + this.rowCount) % this.rowCount;
    this.message = '';
    this.render();
  }

  switchSlot(): void {
    this.slot = this.slot === 'p1' ? 'p2' : 'p1';
    this.message = '';
    this.render();
  }

  activate(): void {
    if (this.selectedIndex < REMAPPABLE.length) {
      this.listening = true;
      this.message = `Pulsa la nueva tecla para «${ACTION_LABELS[REMAPPABLE[this.selectedIndex]]}» · Esc cancela`;
    } else if (this.selectedIndex === REMAPPABLE.length) {
      this.bindings = resetBindings();
      this.message = 'Se restauraron las teclas de ambos jugadores.';
    } else {
      this.back();
      return;
    }
    this.render();
  }

  private capture(event: KeyboardEvent): void {
    this.listening = false;
    const name = keyNameFromCode(event.keyCode, Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>);
    if (name === 'ESC') { this.message = 'Sin cambios.'; this.render(); return; }
    if (!name) { this.message = '!Esa tecla no se puede usar.'; this.render(); return; }
    const action = REMAPPABLE[this.selectedIndex];
    const result = assignKey(this.bindings, this.slot, action, name);
    if (result.ok) {
      this.bindings = result.set;
      saveBindings(this.bindings);
      this.message = `«${ACTION_LABELS[action]}» ahora es ${keyLabel(name)}. Guardado.`;
    } else {
      this.message = '!' + result.reason;
    }
    this.render();
  }

  private back(): void { this.scene.start('SettingsScene', this.returnData); }

  // ── View ─────────────────────────────────────────────────

  private text(x: number, y: number, value: string, size: number, color = INK, bold = false) {
    const t = this.add.text(x, y, value, { fontFamily: FONT_UI, fontSize: size + 'px', color, fontStyle: bold ? 'bold' : 'normal' })
      .setOrigin(0, 0.5);
    this.content.add(t);
    return t;
  }

  private render(): void {
    this.content.removeAll(true);
    // Player tabs.
    (['p1', 'p2'] as const).forEach((slot, i) => {
      const active = this.slot === slot, x = 96 + i * 200;
      const tab = this.add.rectangle(x, 128, 186, 44, active ? 0x143a51 : 0x0c1c29, active ? 1 : 0.7).setOrigin(0, 0.5)
        .setStrokeStyle(active ? 2 : 1, active ? 0x9fe8e1 : 0x2c4a60).setInteractive({ useHandCursor: true });
      tab.on('pointerdown', () => { if (!active) this.switchSlot(); });
      this.content.add(tab);
      this.text(x + 20, 128, slot === 'p1' ? 'JUGADOR 1' : 'JUGADOR 2', 20, active ? AQUA : MUTED, true);
    });
    const keys = this.bindings[this.slot];
    REMAPPABLE.forEach((action, i) => {
      const y = 186 + i * 37, selected = i === this.selectedIndex;
      const bg = this.add.rectangle(96, y, 640, 33, 0x143a51, selected ? 0.95 : 0.35).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      if (selected) bg.setStrokeStyle(2, 0x9fe8e1);
      bg.on('pointerdown', () => { this.selectedIndex = i; this.activate(); });
      this.content.add(bg);
      this.text(116, y, ACTION_LABELS[action], 19, selected ? AQUA : INK, true);
      const listening = selected && this.listening;
      this.text(400, y, listening ? '…' : keys[action].map(keyLabel).join(' / '), 19, listening ? GOLD : GOLD, true);
    });
    const extraY = 186 + REMAPPABLE.length * 37 + 8;
    ['Restaurar valores', 'Volver'].forEach((label, j) => {
      const i = REMAPPABLE.length + j, selected = i === this.selectedIndex, y = extraY + j * 42;
      const bg = this.add.rectangle(96, y, 260, 36, j === 0 ? 0x4a2338 : 0x143a51, selected ? 0.95 : 0.45).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      if (selected) bg.setStrokeStyle(2, 0x9fe8e1);
      bg.on('pointerdown', () => { this.selectedIndex = i; this.activate(); });
      this.content.add(bg);
      this.text(116, y, label, 19, selected ? AQUA : INK, true);
    });
    // Side notes: gamepad layout and the message line.
    this.text(790, 186, 'MANDO (1 → J1, 2 → J2)', 16, GOLD, true);
    ['Cruceta o stick: moverse y saltar', 'X / Y: puño suave / fuerte', 'A / B: patada suave / fuerte',
      'RB o LT: bloquear', 'RT: súper   LB: provocar', 'Start: pausa'].forEach((line, i) => this.text(790, 220 + i * 28, line, 16, MUTED));
    this.text(790, 420, 'Esc, F1, F2, F11, M, Enter, Tab, , y .', 15, MUTED);
    this.text(790, 444, 'están reservadas para el juego.', 15, MUTED);
    if (this.message) {
      const error = this.message.startsWith('!');
      this.text(96, 676, error ? this.message.slice(1) : this.message, 18, error ? RED : AQUA, true).setName('controls-message');
    } else {
      this.text(96, 676, '↑ ↓  Elegir     ← → / Tab  Jugador     Enter  Cambiar tecla     Esc  Volver', 16, MUTED);
    }
  }
}
