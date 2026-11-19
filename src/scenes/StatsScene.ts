// ============================================================
// StatsScene — Saved results, reachable from the main menu
// ============================================================

import Phaser from 'phaser';
import { FIGHTER_ROSTER, rosterEntry } from '../config/roster';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio } from '../systems/GameAudio';
import { PlayerStats, loadStats, resetStats } from '../systems/Stats';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';
import { drawArcadeBackdrop } from '../ui/PanelChrome';

const INK = '#fff7ec', AQUA = '#7fd4ff', GOLD = '#ffb02e', MUTED = '#d3dce2', RED = '#ff8f8f';

const pct = (part: number, total: number) => total ? `${Math.round(part / total * 100)} %` : '—';
/** «1 victoria», «3 victorias». */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export class StatsScene extends Phaser.Scene {
  stats!: PlayerStats;
  /** «Borrar» needs a second press to confirm. */
  confirmingReset = false;
  private returnData: Record<string, unknown> = {};
  private content!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'StatsScene' }); }

  init(data: Record<string, unknown>): void {
    this.returnData = { ...(data ?? {}) };
    delete this.returnData.selectionPhase;
    this.confirmingReset = false;
  }

  create(): void {
    isolateSceneKeyboard(this);
    GameAudio.for(this).play('music-menu');
    drawArcadeBackdrop(this, 0.86);
    // Subtle translucent column frames (outside content container so stats queries stay clean).
    this.add.rectangle(362, 355, 556, 434, 0x081c42, 0.52).setStrokeStyle(1, 0x7fd4ff, 0.25);
    this.add.rectangle(934, 355, 556, 434, 0x081c42, 0.52).setStrokeStyle(1, 0x7fd4ff, 0.25);
    this.add.text(96, 36, 'ESTADÍSTICAS', { fontFamily: FONT_IMPACT, fontSize: '56px', color: INK });
    this.add.text(100, 100, 'Se guardan en este navegador.', { fontFamily: FONT_UI, fontSize: '18px', color: AQUA });
    this.content = this.add.container(0, 0);
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.confirmingReset) { this.confirmingReset = false; this.render(); } else this.back();
    });
    this.input.keyboard!.on('keydown-ENTER', () => this.back());
    this.input.keyboard!.on('keydown-BACKSPACE', () => this.reset());
    this.input.keyboard!.on('keydown-DELETE', () => this.reset());
    this.render();
  }

  reset(): void {
    if (!this.confirmingReset) { this.confirmingReset = true; this.render(); return; }
    resetStats();
    this.confirmingReset = false;
    this.render();
  }

  private back(): void { this.scene.start('MenuScene', this.returnData); }

  private text(x: number, y: number, value: string, size = 20, color = INK, bold = false) {
    const t = this.add.text(x, y, value, { fontFamily: FONT_UI, fontSize: size + 'px', color, fontStyle: bold ? 'bold' : 'normal' });
    this.content.add(t);
    return t;
  }

  private button(x: number, y: number, width: number, label: string, color: number, action: () => void) {
    const bg = this.add.rectangle(x, y, width, 40, color, 0.92).setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x7fd4ff, 0.7).setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffb02e, 1));
    bg.on('pointerout', () => bg.setStrokeStyle(2, 0x7fd4ff, 0.7));
    bg.on('pointerdown', action);
    const txt = this.add.text(x + width / 2, y, label, {
      fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: INK,
    }).setOrigin(0.5);
    this.content.add([bg, txt]);
  }

  private render(): void {
    this.content.removeAll(true);
    this.stats = loadStats();
    const s = this.stats, cpu = s.vsCpu, total = cpu.wins + cpu.losses + cpu.draws;
    const leftX = 96, rightX = 668, rowStep = Math.min(30, Math.floor(170 / Math.max(1, FIGHTER_ROSTER.length)));

    // Left column: vs CPU + Two-Player
    this.text(leftX, 152, 'CONTRA LA CPU', 15, GOLD, true);
    this.text(leftX, 178, `${count(total, 'combate', 'combates')} · ${count(cpu.wins, 'victoria', 'victorias')} · ${count(cpu.losses, 'derrota', 'derrotas')} · ${count(cpu.draws, 'empate', 'empates')}`, 20)
      .setWordWrapWidth(540);
    this.text(leftX, 214, `Victorias: ${pct(cpu.wins, total)}`, 18, AQUA);
    FIGHTER_ROSTER.forEach((fighter, i) => {
      const r = s.byFighter[fighter.id] ?? { wins: 0, losses: 0, draws: 0 };
      const n = r.wins + r.losses + r.draws;
      this.text(leftX + 16, 250 + i * rowStep, `${fighter.name}: ${r.wins} V · ${r.losses} D · ${r.draws} E (${pct(r.wins, n)})`, 18, MUTED);
    });

    const versusY = 250 + FIGHTER_ROSTER.length * rowStep + 34;
    this.text(leftX, versusY, 'DOS JUGADORES', 15, GOLD, true);
    this.text(leftX, versusY + 26, `${count(s.versus.played, 'combate', 'combates')} · J1 ganó ${s.versus.p1} · J2 ganó ${s.versus.p2}`, 20);

    // Right column: Best Combo + Arcade Mode
    this.text(rightX, 152, 'MEJOR COMBO', 15, GOLD, true);
    this.text(rightX, 178, s.bestCombo
      ? `${s.bestCombo.hits} golpes · ${s.bestCombo.damage} de daño · con ${rosterEntry(s.bestCombo.fighter).name}`
      : 'Todavía no hay combos. Prueba J y luego K de cerca.', 20)
      .setWordWrapWidth(540).setName('stats-combo');

    this.text(rightX, 260, 'MODO ARCADE', 15, GOLD, true);
    FIGHTER_ROSTER.forEach((fighter, i) => {
      const a = s.arcade[fighter.id];
      this.text(rightX + 16, 288 + i * rowStep, a
        ? `${fighter.name}: completado ${count(a.clears, 'vez', 'veces')} · mejor: ${a.fewestContinues ? count(a.fewestContinues, 'continuación', 'continuaciones') : 'sin continuar'}`
        : `${fighter.name}: sin completar`, 18, a ? INK : MUTED).setName(`stats-arcade-${fighter.id}`);
    });

    // Clickable actions clear of both columns and the help footer.
    this.button(leftX, 616, 170, 'Volver', 0x2f86f0, () => this.back());
    this.button(leftX + 190, 616, this.confirmingReset ? 290 : 230,
      this.confirmingReset ? 'Confirmar borrado' : 'Borrar estadísticas',
      this.confirmingReset ? 0xc23838 : 0x1a4ca0, () => this.reset());

    this.text(leftX, 676, this.confirmingReset
      ? 'Pulsa Supr otra vez para borrar todas las estadísticas · Esc cancela'
      : 'Enter o Esc  Volver     Supr  Borrar estadísticas', 16, this.confirmingReset ? RED : MUTED, this.confirmingReset).setName('stats-help');
  }
}
