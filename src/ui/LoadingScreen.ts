// ============================================================
// LoadingScreen — Title, real progress bar and what is being loaded
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FONT_UI, FONT_IMPACT } from './fonts';

const TIPS = [
  'Un golpe suave que conecta se puede cancelar en uno fuerte: prueba J y luego K.',
  'Bloquear con L de frente te deja contraatacar tras un golpe fuerte.',
  'Con la energía al 100 %, O lanza el súper de tu luchador.',
  'En el modo práctica, la pausa activa el visor de entradas y los datos de frames.',
  'Pulsa W otra vez en el aire para el doble salto.',
];

/**
 * Progress is spread over loading phases (the manifests first, then everything they list), so
 * the bar only moves forward. Phaser reports progress by files completed, which is real progress.
 */
export class LoadingScreen {
  /** Shown progress, 0–1. Never decreases. */
  progress = 0;
  private phaseStart = 0;
  private phaseEnd = 1;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly glow: Phaser.GameObjects.Rectangle;
  private readonly percent: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly width = 640;

  constructor(private readonly scene: Phaser.Scene) {
    const W = GAME_CONFIG.WIDTH, H = GAME_CONFIG.HEIGHT, x = W / 2 - this.width / 2;
    scene.add.rectangle(W / 2, H / 2, W, H, 0x0b0814);
    scene.add.text(W / 2, H / 2 - 150, 'FIGHTER\nFAMILY', {
      fontFamily: FONT_IMPACT, fontSize: '74px', color: '#f5bd75', align: 'center',
      stroke: '#3d1f0f', strokeThickness: 10, lineSpacing: -12,
    }).setOrigin(0.5).setName('loading-title');
    scene.add.text(W / 2, H / 2 - 24, 'Arica es tu escenario.', { fontFamily: FONT_UI, fontSize: '20px', color: '#a1ece5' })
      .setOrigin(0.5);
    scene.add.rectangle(W / 2, H / 2 + 40, this.width + 8, 26, 0x14101e).setStrokeStyle(2, 0xf5bd75, 0.8);
    this.fill = scene.add.rectangle(x, H / 2 + 40, 1, 18, 0xef709d).setOrigin(0, 0.5);
    this.glow = scene.add.rectangle(x, H / 2 + 40, 1, 6, 0xffffff, 0.45).setOrigin(0, 1).setBlendMode(Phaser.BlendModes.ADD);
    this.percent = scene.add.text(W / 2 + this.width / 2, H / 2 + 62, '0 %', {
      fontFamily: FONT_IMPACT, fontSize: '22px', color: '#fae8cb',
    }).setOrigin(1, 0).setName('loading-percent');
    this.status = scene.add.text(W / 2 - this.width / 2, H / 2 + 66, 'Preparando…', {
      fontFamily: FONT_UI, fontSize: '17px', color: '#c9b8da',
    }).setName('loading-status');
    scene.add.text(W / 2, H - 70, TIPS[Math.floor(Math.random() * TIPS.length)], {
      fontFamily: FONT_UI, fontSize: '17px', color: '#9aa4b2', align: 'center', wordWrap: { width: 900 },
    }).setOrigin(0.5);

    scene.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => this.setProgress(this.phaseStart + value * (this.phaseEnd - this.phaseStart)));
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string, type: string) => this.describe(key, type));
  }

  /** The next files fill the bar from `start` to `end` (0–1). */
  setPhase(start: number, end: number): void {
    this.phaseStart = start;
    this.phaseEnd = end;
    this.setProgress(start);
  }

  setProgress(value: number): void {
    this.progress = Phaser.Math.Clamp(Math.max(this.progress, value), 0, 1);
    const w = Math.max(1, this.width * this.progress);
    this.fill.setSize(w, 18);
    this.glow.setSize(w, 6);
    this.percent.setText(`${Math.round(this.progress * 100)} %`);
  }

  private describe(key: string, type: string): void {
    const load = this.scene.load;
    const what = key.includes('_RAW_') ? 'Luchadores' : key.startsWith('stage_') ? 'Escenarios'
      : type === 'audio' ? 'Música y sonidos' : key.endsWith('_manifest') ? 'Plantel' : 'Ilustraciones';
    this.status.setText(`${what} · ${load.totalComplete} de ${load.totalToLoad} archivos`);
  }
}
