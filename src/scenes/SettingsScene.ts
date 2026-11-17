// ============================================================
// SettingsScene — Audio and display options
// ============================================================

import Phaser from 'phaser';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio } from '../systems/GameAudio';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

type Row = {
  label: string;
  value: () => string;
  /** Fill of the level bar, 0–1, for rows adjusted with ← →. */
  level?: () => number;
  adjust?: (direction: number) => void;
  activate?: () => void;
};

/** Configuración: fullscreen, music on/off, music volume and overall volume. */
export class SettingsScene extends Phaser.Scene {
  private selectedIndex = 0;
  private returnData: Record<string, unknown> = {};
  private rows: Row[] = [];
  private rowObjects: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text;
    bar?: Phaser.GameObjects.Rectangle; barBack?: Phaser.GameObjects.Rectangle }[] = [];

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: Record<string, unknown>): void {
    this.returnData = { ...(data ?? {}) };
    delete this.returnData.selectionPhase;
    this.selectedIndex = 0;
    this.rowObjects = [];
  }

  create(): void {
    isolateSceneKeyboard(this);
    const audio = GameAudio.for(this);
    audio.play('music-menu');
    this.rows = [
      {
        label: 'Pantalla completa',
        value: () => this.scale.isFullscreen ? 'Sí' : 'No',
        activate: () => this.toggleFullscreen(),
        adjust: () => this.toggleFullscreen(),
      },
      {
        label: 'Música',
        value: () => audio.muted ? 'Apagada' : 'Activada',
        activate: () => audio.toggle(),
        adjust: () => audio.toggle(),
      },
      {
        label: 'Volumen de la música',
        value: () => `${Math.round(audio.volume / 0.7 * 100)}%`,
        level: () => audio.volume / 0.7,
        adjust: direction => audio.changeVolume(direction * 0.07),
      },
      {
        label: 'Volumen general',
        value: () => `${Math.round(audio.masterVolume * 100)}%`,
        level: () => audio.masterVolume,
        adjust: direction => { audio.changeMasterVolume(direction * 0.1); this.sound.play('hit-light', { volume: 0.5 }); },
      },
      {
        label: 'Volumen de efectos',
        value: () => `${Math.round(audio.sfxVolume * 100)}%`,
        level: () => audio.sfxVolume,
        adjust: direction => { audio.changeSfxVolume(direction * 0.1); this.sound.play('hit-heavy', { volume: 0.6 }); },
      },
      {
        label: 'Volumen del locutor',
        value: () => `${Math.round(audio.announcerVolume * 100)}%`,
        level: () => audio.announcerVolume,
        adjust: direction => { audio.changeAnnouncerVolume(direction * 0.1); this.sound.play('announcer-fight'); },
      },
      {
        label: 'Música del menú',
        value: () => audio.menuTrack === 'cinturao' ? 'Cinturão de Elite' : 'Original',
        activate: () => audio.toggleMenuTrack(),
        adjust: () => audio.toggleMenuTrack(),
      },
      {
        label: 'Teclas de J1 y J2',
        value: () => 'Cambiar ›',
        activate: () => this.scene.start('ControlsScene', this.returnData),
      },
      { label: 'Volver', value: () => '', activate: () => this.back() },
    ];

    this.add.image(640, 360, 'menu_arica_coast').setDisplaySize(1324, 745).setAlpha(0.55);
    this.add.rectangle(640, 360, 1280, 720, 0x06111b, 0.82);
    this.add.text(96, 40, 'CONFIGURACIÓN', { fontFamily: FONT_IMPACT, fontSize: '60px', color: '#fff3d8' });
    this.add.text(100, 112, 'Pantalla, audio y teclas. Los cambios se guardan solos.', {
      fontFamily: FONT_UI, fontSize: '20px', color: '#9fe8e1',
    });
    this.add.text(100, 160, 'PANTALLA', { fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: '#f5bd75' });
    this.add.text(100, 236, 'AUDIO', { fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: '#f5bd75' });
    this.add.text(100, 562, 'CONTROLES', { fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: '#f5bd75' });

    const ys = [200, 276, 326, 376, 426, 476, 526, 600, 654];
    this.rows.forEach((row, i) => {
      const y = ys[i], back = i === this.rows.length - 1;
      const bg = this.add.rectangle(96, y, back ? 240 : 760, 44, 0x143a51, 0.4).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(back ? 216 : 120, y, row.label, {
        fontFamily: back ? FONT_IMPACT : FONT_UI, fontSize: back ? '24px' : '22px', color: '#fff3d8',
      }).setOrigin(back ? 0.5 : 0, 0.5);
      const value = this.add.text(row.level ? 612 : 830, y, '', {
        fontFamily: FONT_UI, fontSize: '22px', fontStyle: 'bold', color: '#9fe8e1',
      }).setOrigin(1, 0.5);
      const objects: (typeof this.rowObjects)[number] = { bg, label, value };
      if (row.level) {
        objects.barBack = this.add.rectangle(632, y, 150, 10, 0x263c51).setOrigin(0, 0.5);
        objects.bar = this.add.rectangle(632, y, 150, 10, 0x9fe8e1).setOrigin(0, 0.5);
        this.smallButton(800, y, '−', () => { this.selectedIndex = i; row.adjust!(-1); this.refresh(); });
        this.smallButton(838, y, '+', () => { this.selectedIndex = i; row.adjust!(1); this.refresh(); });
      }
      bg.on('pointerover', () => { this.selectedIndex = i; this.refresh(); });
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.selectedIndex = i;
        if (row.activate) row.activate();
        else if (row.adjust) row.adjust(pointer.x > 720 ? 1 : -1);
        this.refresh();
      });
      this.rowObjects.push(objects);
    });

    this.add.text(96, 690, '↑ ↓  Elegir     ← →  Ajustar     Enter  Cambiar     Esc  Volver', {
      fontFamily: FONT_UI, fontSize: '16px', color: '#d3dce2',
    });

    const key = (name: string, action: () => void) => this.input.keyboard!.on('keydown-' + name, (event: KeyboardEvent) => {
      event.preventDefault(); if (!event.repeat || name === 'LEFT' || name === 'RIGHT' || name === 'A' || name === 'D') action();
    });
    for (const k of ['UP', 'W']) key(k, () => this.navigate(-1));
    for (const k of ['DOWN', 'S']) key(k, () => this.navigate(1));
    for (const k of ['LEFT', 'A']) key(k, () => { this.rows[this.selectedIndex].adjust?.(-1); this.refresh(); });
    for (const k of ['RIGHT', 'D']) key(k, () => { this.rows[this.selectedIndex].adjust?.(1); this.refresh(); });
    for (const k of ['ENTER', 'SPACE']) key(k, () => { this.rows[this.selectedIndex].activate?.(); this.refresh(); });
    key('ESC', () => this.back());
    key('F11', () => this.toggleFullscreen());

    const refresh = () => this.refresh();
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, refresh);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, refresh);
    this.game.events.on('music-settings', refresh);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, refresh);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, refresh);
      this.game.events.off('music-settings', refresh);
    });
    this.refresh();
  }

  private smallButton(x: number, y: number, text: string, action: () => void): void {
    this.add.text(x, y, text, {
      fontFamily: FONT_UI, fontSize: '22px', color: '#fae8cb', backgroundColor: '#241a35', padding: { x: 9, y: 2 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true }).on('pointerdown', action);
  }

  private navigate(delta: number): void {
    this.selectedIndex = (this.selectedIndex + delta + this.rows.length) % this.rows.length;
    this.refresh();
  }

  private refresh(): void {
    this.rows.forEach((row, i) => {
      const o = this.rowObjects[i]; if (!o) return;
      const selected = i === this.selectedIndex;
      o.bg.setFillStyle(selected ? 0x143a51 : 0x143a51, selected ? 0.95 : 0.4);
      if (selected) o.bg.setStrokeStyle(2, 0x9fe8e1); else o.bg.setStrokeStyle();
      o.label.setColor(selected ? '#9fe8e1' : '#fff3d8');
      o.value.setText(row.value());
      if (o.bar && row.level) o.bar.setDisplaySize(Math.max(1, 150 * Phaser.Math.Clamp(row.level(), 0, 1)), 10);
    });
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
  }

  private back(): void { this.scene.start('MenuScene', this.returnData); }
}
