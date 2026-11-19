// ============================================================
// StageAtmosphere — Per-stage ambient lighting, floor grounding and themed motes
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  color: number;
}

interface StageTheme {
  colors: readonly number[];
  tintOverlay: number;
  overlayAlpha: number;
  floorTint: number;
  speedX: [number, number];
  speedY: [number, number];
  size: [number, number];
  streak?: boolean;
}

const THEMES: readonly StageTheme[] = [
  // 0: Costanera del Morro (warm Arica sunset dust)
  { colors: [0xffd89b, 0xffa652, 0xfff3d6], tintOverlay: 0xff8c42, overlayAlpha: 0.06, floorTint: 0x0b1628, speedX: [16, 42], speedY: [-10, 6], size: [1.5, 3.5] },
  // 1: Playa Chinchorro (coastal mist & sunlit spray)
  { colors: [0xc7f0ff, 0xfff4d6, 0x7fd4ff], tintOverlay: 0x4fc3f7, overlayAlpha: 0.05, floorTint: 0x091d2e, speedX: [24, 58], speedY: [-6, 8], size: [1.5, 3.2] },
  // 2: Catedral San Marcos (plaza dusk fireflies / lantern sparks)
  { colors: [0xffcc66, 0xff9f40, 0xffe9b5], tintOverlay: 0x162452, overlayAlpha: 0.09, floorTint: 0x070d20, speedX: [-12, 12], speedY: [-22, -7], size: [1.8, 3.8] },
  // 3: Arena Urbana Nocturna (neon night drift)
  { colors: [0x68e1ff, 0xff6b9d, 0xd4f7ff], tintOverlay: 0x11153a, overlayAlpha: 0.1, floorTint: 0x060816, speedX: [-18, 18], speedY: [28, 60], size: [1.5, 2.8], streak: true },
  // 4: Templo Antiguo (incense embers rising)
  { colors: [0xffb75e, 0xff6f3c, 0xffe4b3], tintOverlay: 0x2b160c, overlayAlpha: 0.08, floorTint: 0x120a07, speedX: [-10, 14], speedY: [-28, -10], size: [1.6, 3.6] },
  // 5: Azotea de Rascacielos (high-altitude wind streaks)
  { colors: [0xb9e8ff, 0xffffff, 0xffd27d], tintOverlay: 0x0e1d3b, overlayAlpha: 0.07, floorTint: 0x070c18, speedX: [65, 130], speedY: [-4, 4], size: [1.4, 2.4], streak: true },
];

/** Pure presentation layer: gives each stage living atmosphere without affecting combat. */
export class StageAtmosphere {
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly tint: Phaser.GameObjects.Rectangle;
  private readonly floorShade: Phaser.GameObjects.Graphics;
  private readonly vignette: Phaser.GameObjects.Graphics;
  private readonly particles: Phaser.GameObjects.Graphics;
  private theme: StageTheme = THEMES[0];
  private motes: Mote[] = [];
  private clock = 0;

  constructor(private readonly scene: Phaser.Scene, stageIndex: number) {
    const W = GAME_CONFIG.STAGE_WIDTH, H = GAME_CONFIG.STAGE_HEIGHT;
    this.tint = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(0.4);
    this.floorShade = scene.add.graphics().setDepth(0.6);
    this.particles = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    // Soft edge vignette pinned to the viewport keeps focus on the center of the fight.
    this.vignette = scene.add.graphics().setDepth(42).setScrollFactor(0);
    this.drawVignette();
    this.setStage(stageIndex);
  }

  setStage(stageIndex: number): void {
    this.theme = THEMES[stageIndex % THEMES.length] ?? THEMES[0];
    this.tint.setFillStyle(this.theme.tintOverlay, this.theme.overlayAlpha);
    this.drawFloorGrounding();
    this.seedMotes();
    this.drawMotes();
  }

  update(delta: number): void {
    if (this.motion.matches) return;
    const dt = delta / 1000;
    this.clock += dt;
    const W = GAME_CONFIG.STAGE_WIDTH, H = GAME_CONFIG.FLOOR_Y + 30;
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x > W + 24) m.x = -24;
      if (m.x < -24) m.x = W + 24;
      if (m.y < 70) m.y = H;
      if (m.y > H + 12) m.y = 75;
    }
    this.drawMotes();
  }

  private drawFloorGrounding(): void {
    const g = this.floorShade.clear(), W = GAME_CONFIG.STAGE_WIDTH, floor = GAME_CONFIG.FLOOR_Y;
    // Layered translucent bands anchor fighters onto the stage floor cleanly.
    g.fillStyle(this.theme.floorTint, 0.14).fillRect(0, floor - 14, W, 18);
    g.fillStyle(this.theme.floorTint, 0.28).fillRect(0, floor + 4, W, GAME_CONFIG.STAGE_HEIGHT - floor);
    g.lineStyle(2, 0xffe4b5, 0.14).lineBetween(40, floor + 2, W - 40, floor + 2);
  }

  private drawVignette(): void {
    const g = this.vignette.clear(), W = GAME_CONFIG.WIDTH, H = GAME_CONFIG.HEIGHT;
    for (let i = 0; i < 4; i++) {
      const a = 0.055 * (4 - i), edge = 18 + i * 26;
      g.fillStyle(0x040b18, a).fillRect(0, 0, edge, H).fillRect(W - edge, 0, edge, H);
    }
    g.fillStyle(0x040b18, 0.26).fillRect(0, H - 56, W, 56);
  }

  private seedMotes(): void {
    const t = this.theme, W = GAME_CONFIG.STAGE_WIDTH, H = GAME_CONFIG.FLOOR_Y;
    this.motes = Array.from({ length: 28 }, (_, i) => ({
      x: ((i * 197 + 53) % W),
      y: 90 + ((i * 131 + 29) % (H - 90)),
      vx: Phaser.Math.Linear(t.speedX[0], t.speedX[1], ((i * 37) % 100) / 100),
      vy: Phaser.Math.Linear(t.speedY[0], t.speedY[1], ((i * 61) % 100) / 100),
      size: Phaser.Math.Linear(t.size[0], t.size[1], ((i * 23) % 100) / 100),
      alpha: 0.18 + ((i * 19) % 38) / 100,
      phase: i * 0.7,
      color: t.colors[i % t.colors.length],
    }));
  }

  private drawMotes(): void {
    const g = this.particles.clear(), streak = !!this.theme.streak;
    for (const m of this.motes) {
      const pulse = 0.65 + 0.35 * Math.sin(this.clock * 2.4 + m.phase);
      const a = m.alpha * pulse;
      if (streak) {
        g.lineStyle(m.size, m.color, a * 0.8).lineBetween(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
      } else {
        g.fillStyle(m.color, a * 0.35).fillCircle(m.x, m.y, m.size * 2.2);
        g.fillStyle(m.color, a).fillCircle(m.x, m.y, m.size);
      }
    }
  }

  destroy(): void {
    this.tint.destroy();
    this.floorShade.destroy();
    this.vignette.destroy();
    this.particles.destroy();
  }
}
