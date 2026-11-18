// ============================================================
// StatsScene — Saved results, reachable from the main menu
// ============================================================

import Phaser from 'phaser';
import { FIGHTER_ROSTER, rosterEntry } from '../config/roster';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio } from '../systems/GameAudio';
import { PlayerStats, loadStats, resetStats } from '../systems/Stats';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

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
    this.add.image(640, 360, 'menu_arica_coast').setDisplaySize(1324, 745).setAlpha(0.55);
    this.add.rectangle(640, 360, 1280, 720, 0x1257c4, 0.86);
    this.add.text(96, 40, 'ESTADÍSTICAS', { fontFamily: FONT_IMPACT, fontSize: '56px', color: INK });
    this.add.text(100, 110, 'Se guardan en este navegador.', { fontFamily: FONT_UI, fontSize: '18px', color: AQUA });
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

  private render(): void {
    this.content.removeAll(true);
    this.stats = loadStats();
    const s = this.stats, cpu = s.vsCpu, total = cpu.wins + cpu.losses + cpu.draws;

    this.text(100, 160, 'CONTRA LA CPU', 15, GOLD, true);
    this.text(100, 188, `${count(total, 'combate', 'combates')} · ${count(cpu.wins, 'victoria', 'victorias')} · ${count(cpu.losses, 'derrota', 'derrotas')} · ${count(cpu.draws, 'empate', 'empates')}`, 22);
    this.text(100, 222, `Victorias: ${pct(cpu.wins, total)}`, 18, AQUA);
    FIGHTER_ROSTER.forEach((fighter, i) => {
      const r = s.byFighter[fighter.id] ?? { wins: 0, losses: 0, draws: 0 };
      const n = r.wins + r.losses + r.draws;
      this.text(120, 258 + i * 30, `${fighter.name}: ${r.wins} V · ${r.losses} D · ${r.draws} E (${pct(r.wins, n)})`, 18, MUTED);
    });

    const y2 = 258 + FIGHTER_ROSTER.length * 30 + 30;
    this.text(100, y2, 'MEJOR COMBO', 15, GOLD, true);
    this.text(100, y2 + 28, s.bestCombo
      ? `${s.bestCombo.hits} golpes · ${s.bestCombo.damage} de daño · con ${rosterEntry(s.bestCombo.fighter).name}`
      : 'Todavía no hay combos. Prueba J y luego K de cerca.', 22).setName('stats-combo');

    const y3 = y2 + 92;
    this.text(100, y3, 'MODO ARCADE', 15, GOLD, true);
    FIGHTER_ROSTER.forEach((fighter, i) => {
      const a = s.arcade[fighter.id];
      this.text(120, y3 + 28 + i * 30, a
        ? `${fighter.name}: completado ${count(a.clears, 'vez', 'veces')} · mejor: ${a.fewestContinues ? count(a.fewestContinues, 'continuación', 'continuaciones') : 'sin continuar'}`
        : `${fighter.name}: sin completar`, 18, a ? INK : MUTED).setName(`stats-arcade-${fighter.id}`);
    });

    const y4 = y3 + 28 + FIGHTER_ROSTER.length * 30 + 22;
    this.text(100, y4, 'DOS JUGADORES', 15, GOLD, true);
    this.text(100, y4 + 28, `${count(s.versus.played, 'combate', 'combates')} · J1 ganó ${s.versus.p1} · J2 ganó ${s.versus.p2}`, 20);

    this.text(100, 676, this.confirmingReset
      ? 'Pulsa Supr otra vez para borrar todas las estadísticas · Esc cancela'
      : 'Enter o Esc  Volver     Supr  Borrar estadísticas', 16, this.confirmingReset ? RED : MUTED, this.confirmingReset).setName('stats-help');
  }
}
