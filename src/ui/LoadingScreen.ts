import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FIGHTER_ROSTER } from '../config/roster';
import { menuArtKey } from '../config/characters';
import { FONT_UI, FONT_NUMBER, FONT_IMPACT } from './fonts';
import { C, CSS, MUTED_INK, SLANT, fillSlanted } from './theme';

/** Height of the loading gauge. */
const BAR_H = 16;

const TIPS = [
  'Conecta un golpe suave con J y continúa con K para encadenar un golpe fuerte.',
  'Bloquea de frente con L y aprovecha la recuperación del rival para contraatacar.',
  'Con la energía al 100 %, pulsa O para lanzar el súper de tu luchador.',
  'En práctica, abre la pausa para activar el visor de entradas y los datos de frames.',
  'Pulsa W otra vez en el aire para saltar por encima de tu rival.',
];

/** Reveals existing artwork as it arrives, without adding downloads or delaying the menu. */
export class LoadingScreen {
  /** Real file progress, spread over both loading phases. Never decreases. */
  progress = 0;
  private phaseStart = 0;
  private phaseEnd = 1;
  /** The gauge: an orange parallelogram slanted 12°, redrawn as files arrive. */
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly percent: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly width = 1152;
  private readonly left = 64;
  private readonly revealed = new Set<string>();
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private shadow?: Phaser.GameObjects.Ellipse;
  private readonly reveals: { art: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween }[] = [];
  private readonly onProgress = (value: number) => this.setProgress(this.phaseStart + value * (this.phaseEnd - this.phaseStart));
  private readonly onFile = (key: string, type: string) => { this.revealArt(key); this.describe(key, type); };
  private readonly onMotion = () => {
    if (this.motion.matches) this.reveals.forEach(({ art, tween }) => {
      if (tween.isPlaying()) { tween.stop(); art.setAlpha(1); }
    });
  };

  constructor(private readonly scene: Phaser.Scene) {
    const W = GAME_CONFIG.WIDTH;
    this.drawBackdrop();
    // Title like the menu's: ink relief, deep orange, then the Electric Orange face.
    const titleStyle = { fontFamily: FONT_IMPACT, fontSize: '112px', color: CSS.primary,
      stroke: CSS.ink, strokeThickness: 3, lineSpacing: -12 };
    scene.add.text(70, 110, 'FIGHTER\nFAMILY', { ...titleStyle, color: CSS.ink, strokeThickness: 6 }).setDepth(5);
    scene.add.text(67, 107, 'FIGHTER\nFAMILY', { ...titleStyle, color: CSS.primaryDeep, strokeThickness: 4 }).setDepth(5);
    scene.add.text(64, 104, 'FIGHTER\nFAMILY', titleStyle).setDepth(6).setName('loading-title');
    scene.add.text(69, 352, 'Arica es tu escenario.', {
      fontFamily: FONT_UI, fontSize: '24px', fontStyle: 'bold', color: CSS.primary,
    }).setDepth(6);
    scene.add.rectangle(70, 416, 30, 4, C.primary).setOrigin(0, 0.5).setDepth(6);
    scene.add.text(113, 404, 'Consejo de combate', {
      fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: CSS.ink,
    }).setDepth(6);
    scene.add.text(70, 441, TIPS[Math.floor(Math.random() * TIPS.length)], {
      fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: MUTED_INK, lineSpacing: 6,
      wordWrap: { width: 410 },
    }).setDepth(6).setName('loading-tip');

    scene.add.text(this.left, 560, 'Preparando el combate', {
      fontFamily: FONT_UI, fontSize: '24px', fontStyle: 'bold', color: CSS.ink,
    }).setDepth(6);
    this.percent = scene.add.text(W - this.left, 540, '0 %', {
      fontFamily: FONT_NUMBER, fontSize: '53px', color: CSS.ink,
    }).setOrigin(1, 0).setDepth(6).setName('loading-percent');
    // Gauge: ink track with a hard offset shadow and a 3 px ink outline, orange fill, slanted 12°.
    const track = scene.add.graphics().setDepth(6);
    fillSlanted(track, this.left + 4, 610 + 4, this.width, BAR_H, C.ink, 0.9);
    fillSlanted(track, this.left, 610, this.width, BAR_H, C.ivory, 1);
    this.fill = scene.add.graphics().setDepth(7);
    const s = BAR_H * SLANT, x = this.left, y = 610, w = this.width;
    scene.add.graphics().setDepth(8).lineStyle(3, C.ink, 1).strokePoints([
      new Phaser.Math.Vector2(x + s, y), new Phaser.Math.Vector2(x + w + s, y),
      new Phaser.Math.Vector2(x + w, y + BAR_H), new Phaser.Math.Vector2(x, y + BAR_H),
    ], true);
    this.status = scene.add.text(this.left, 644, 'Preparando…', {
      fontFamily: FONT_UI, fontSize: '16px', fontStyle: 'bold', color: MUTED_INK,
    }).setDepth(6).setName('loading-status');
    scene.add.text(W - this.left, 644, 'Arica, Chile', {
      fontFamily: FONT_UI, fontSize: '16px', fontStyle: 'bold', color: MUTED_INK,
    }).setOrigin(1, 0).setDepth(6);

    this.revealArt('menu_arica_coast');
    FIGHTER_ROSTER.forEach(fighter => this.revealArt(menuArtKey(fighter.id)));
    scene.load.on(Phaser.Loader.Events.PROGRESS, this.onProgress);
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFile);
    this.motion.addEventListener('change', this.onMotion);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.load.off(Phaser.Loader.Events.PROGRESS, this.onProgress);
      scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFile);
      this.motion.removeEventListener('change', this.onMotion);
    });
  }

  /** A native canvas coast silhouette appears before the first file arrives. */
  private drawBackdrop(): void {
    const s = this.scene, W = GAME_CONFIG.WIDTH, H = GAME_CONFIG.HEIGHT;
    if (!s.textures.exists('loading-dusk')) {
      const texture = s.textures.createCanvas('loading-dusk', W, H)!;
      const c = texture.context;
      const sky = c.createLinearGradient(0, 0, W, H);
      sky.addColorStop(0, '#fdfbf7'); sky.addColorStop(0.55, '#f3c9a4'); sky.addColorStop(1, '#ff8a4a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const sun = c.createRadialGradient(900, 273, 16, 900, 273, 245);
      sun.addColorStop(0, 'rgba(255,220,156,0.55)'); sun.addColorStop(1, 'rgba(242,137,83,0)');
      c.fillStyle = sun; c.fillRect(600, 0, 680, 560);
      c.fillStyle = '#edbb85'; c.beginPath(); c.arc(900, 273, 44, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8bdb3'; c.fillRect(0, 394, W, H - 394);
      c.fillStyle = '#936f66'; c.beginPath(); c.moveTo(743, 394); c.lineTo(910, 313);
      c.lineTo(957, 205); c.lineTo(1124, 166); c.lineTo(W, 192); c.lineTo(W, 478); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(18,17,20,0.14)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const y = 407 + i * i * 1.8;
        c.beginPath(); c.moveTo(160 - i * 20, y); c.lineTo(860 + i * 35, y); c.stroke();
      }
      texture.refresh();
    }
    s.add.image(W / 2, H / 2, 'loading-dusk').setDepth(0);
    this.shadow = s.add.ellipse(928, 527, 468, 37, C.ink, 0.4).setDepth(2).setVisible(false);
    if (!s.textures.exists('loading-shade')) {
      const texture = s.textures.createCanvas('loading-shade', W, H)!;
      const c = texture.context;
      const side = c.createLinearGradient(0, 0, W, 0);
      // Ivory glass over the left and along the bottom (it used to be a blue wash), so the
      // ink text and the gauge read like the menu.
      side.addColorStop(0, 'rgba(253,251,247,0.94)'); side.addColorStop(0.37, 'rgba(253,251,247,0.82)');
      side.addColorStop(0.6, 'rgba(253,251,247,0.14)'); side.addColorStop(1, 'rgba(253,251,247,0.04)');
      c.fillStyle = side; c.fillRect(0, 0, W, H);
      const floor = c.createLinearGradient(0, 470, 0, H);
      floor.addColorStop(0, 'rgba(253,251,247,0)'); floor.addColorStop(0.4, 'rgba(253,251,247,0.9)');
      floor.addColorStop(1, 'rgba(253,251,247,0.97)'); c.fillStyle = floor; c.fillRect(0, 470, W, H - 470);
      texture.refresh();
    }
    s.add.image(W / 2, H / 2, 'loading-shade').setDepth(4);
  }

  private revealArt(key: string): void {
    if (this.revealed.has(key) || !this.scene.textures.exists(key)) return;
    let art: Phaser.GameObjects.Image;
    if (key === 'menu_arica_coast') {
      art = this.scene.add.image(640, 360, key).setDisplaySize(1280, 720).setDepth(1).setName('loading-coast');
    } else if (key === menuArtKey('tilin')) {
      art = this.scene.add.image(782, 534, key).setOrigin(0.5, 1).setDisplaySize(290, 435).setDepth(3).setName('loading-tilin');
    } else if (key === menuArtKey('cesar')) {
      art = this.scene.add.image(1080, 534, key).setOrigin(0.5, 1).setDisplaySize(320, 480)
        .setFlipX(true).setDepth(3).setName('loading-cesar');
    } else return;
    this.revealed.add(key);
    if (key !== 'menu_arica_coast') this.shadow?.setVisible(true);
    if (!this.motion.matches) {
      art.setAlpha(0);
      this.reveals.push({ art, tween: this.scene.tweens.add({ targets: art, alpha: 1, duration: 450, ease: 'Sine.easeOut' }) });
    }
  }

  setPhase(start: number, end: number): void {
    this.phaseStart = start; this.phaseEnd = end;
    this.setProgress(start);
  }

  setProgress(value: number): void {
    this.progress = Phaser.Math.Clamp(Math.max(this.progress, value), 0, 1);
    const w = Math.max(1, this.width * this.progress);
    this.fill.clear();
    fillSlanted(this.fill, this.left, 610, w, BAR_H, C.primary);
    fillSlanted(this.fill, this.left, 612, w, 4, C.white, 0.35);
    this.percent.setText(`${Math.round(this.progress * 100)} %`);
  }

  private describe(key: string, type: string): void {
    const load = this.scene.load;
    const what = key.includes('_RAW_') ? 'Luchadores' : key.startsWith('stage_') ? 'Escenarios'
      : type === 'audio' ? 'Música y sonidos' : key.endsWith('_manifest') ? 'Plantel' : 'Ilustraciones';
    this.status.setText(`${what} · ${load.totalComplete} de ${load.totalToLoad} archivos`);
  }
}
