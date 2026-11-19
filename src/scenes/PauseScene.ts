// ============================================================
// PauseScene — Overlay pause menu
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FightScene } from './FightScene';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { MOVE_LIST, describeKeys, keyLabel } from '../input/InputMapping';
import { activeKeys, loadBindings } from '../input/Bindings';
import { rosterEntry } from '../config/roster';
import { COMMAND_MOVES } from '../combat/AttackDefinition';
import { comboExamples, describeCombo } from '../config/combos';
import type { TrainingOptions } from '../ui/TrainingOverlay';
import { FONT_UI, FONT_NAME, FONT_IMPACT } from '../ui/fonts';
import { C, CSS, MUTED_INK, TERTIARY_INK, drawGlass } from '../ui/theme';

export class PauseScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];

  private readonly OPTIONS = [
    { label: 'CONTINUAR', action: () => this.resume() },
    { label: 'REINICIAR', action: () => this.restart() },
    { label: 'MENÚ PRINCIPAL', action: () => this.mainMenu() },
    { label: 'CAMBIAR SELECCIÓN', action: () => this.changeSelection() },
    { label: 'MOVIMIENTOS', action: () => this.showMoveList(true) },
  ];
  /** Menu rows: the options above, plus the practice tools in the practice mode. */
  private items: { label: string; action: () => void }[] = [];
  private moveList: Phaser.GameObjects.Container | null = null;
  /** Pages of the move list: 0 controls and moves, 1 example combos. */
  private movePages: Phaser.GameObjects.Container[] = [];
  movePage = 0;
  private title!: Phaser.GameObjects.Text;
  private panel?: Phaser.GameObjects.Graphics;
  /** True while the move list covers the pause menu. */
  get moveListOpen(): boolean { return !!this.moveList?.visible; }

  constructor() {
    super({ key: 'PauseScene' });
  }

  create(): void {
    isolateSceneKeyboard(this);
    this.selectedIndex = 0;
    this.menuItems = [];
    this.moveList = null;
    const fight = this.scene.get('FightScene') as FightScene;
    const training = fight.getMatchData().mode === 'training';
    this.items = [...this.OPTIONS];
    if (training) {
      const toggle = (key: keyof TrainingOptions, label: string) => ({
        label: `${label}: ${fight.trainingOptions[key] ? 'SÍ' : 'NO'}`,
        action: () => {
          const options = fight.trainingOptions;
          options[key] = !options[key];
          fight.setTrainingOptions(options);
          this.items[this.selectedIndex].label = `${label}: ${options[key] ? 'SÍ' : 'NO'}`;
          this.menuItems[this.selectedIndex].setText(this.items[this.selectedIndex].label);
        },
      });
      this.items.push(toggle('inputs', 'VISOR DE ENTRADAS'), toggle('frames', 'DATOS DE FRAMES'), toggle('refill', 'VIDA QUE SE RECUPERA'));
    }
    // Practice adds three rows: tighten the list so all eight fit.
    const top = training ? 190 : GAME_CONFIG.HEIGHT / 2 - 50, step = training ? 52 : 60;
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;

    // Dim the fight, then a glass card (Jorell's size and place) behind the title and the options.
    this.add.rectangle(W / 2, H / 2, W, H, C.ink, 0.38);
    const titleY = training ? 110 : H / 2 - 140;
    const cardH = training ? 580 : 470, cardY = training ? 375 : H / 2 + 12;
    this.panel = drawGlass(this.add.graphics(), W / 2 - 270, cardY - cardH / 2, 540, cardH, { alpha: 0.62, chamfer: 22, shadow: 4 });
    this.panel.fillStyle(C.primary, 1).fillRect(W / 2 - 270, cardY - cardH / 2 + 22, 8, cardH - 22);

    // Pause title
    this.title = this.add.text(W / 2, titleY, 'PAUSA', {
      fontFamily: FONT_IMPACT,
      fontSize: '64px',
      color: CSS.ink,
    }).setOrigin(0.5);

    // Options
    this.items.forEach((opt, i) => {
      const t = this.add.text(W / 2, top + i * step, opt.label, {
        fontFamily: FONT_UI,
        fontStyle: 'bold',
        fontSize: '28px',
        color: CSS.ink,
        padding: { x: 18, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      t.on('pointerover', () => { this.selectedIndex = i; this.updateSelection(); });
      t.on('pointerdown', () => opt.action());
      this.menuItems.push(t);
    });

    // Key listeners
    // ← → or Tab flip the move list between its two pages.
    for (const key of ['LEFT', 'RIGHT', 'TAB']) {
      this.input.keyboard!.on(`keydown-${key}`, (event: KeyboardEvent) => {
        event.preventDefault?.();
        if (this.moveListOpen) this.showMovePage(this.movePage === 0 ? 1 : 0);
      });
    }
    this.input.keyboard!.on('keydown-UP',    () => { if (this.moveListOpen) return; this.selectedIndex = Math.max(0, this.selectedIndex - 1); this.updateSelection(); });
    this.input.keyboard!.on('keydown-DOWN',  () => { if (this.moveListOpen) return; this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1); this.updateSelection(); });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.moveListOpen) this.showMoveList(false); else this.items[this.selectedIndex].action();
    });
    this.input.keyboard!.on('keydown-ESC', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (this.moveListOpen) this.showMoveList(false); else this.resume();
    });

    this.updateSelection();
  }

  /** Builds the move list once from the key map and the roster, then shows or hides it. */
  private showMoveList(open: boolean): void {
    if (open && !this.moveList) this.moveList = this.buildMoveList();
    this.moveList?.setVisible(open);
    if (open) this.showMovePage(0);
    this.menuItems.forEach(t => t.setVisible(!open));
    this.title.setVisible(!open);
    this.panel?.setVisible(!open);
  }

  showMovePage(page: number): void {
    this.movePage = page;
    this.movePages.forEach((p, i) => p.setVisible(i === page));
  }

  private buildMoveList(): Phaser.GameObjects.Container {
    const W = GAME_CONFIG.WIDTH;
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    const fighters = [rosterEntry(data.playerChoice.characterId), rosterEntry(data.opponentChoice.characterId)];
    const frame = this.add.container(0, 0).setDepth(10);
    frame.add(drawGlass(this.add.graphics(), W / 2 - 520, 190, 1040, 500, { alpha: 0.86, chamfer: 26, shadow: 4 }));
    const box = this.add.container(0, 0), combos = this.add.container(0, 0);
    frame.add([box, combos]);
    this.movePages = [box, combos];
    box.add(this.add.text(W / 2, 228, 'MOVIMIENTOS', {
      fontFamily: FONT_IMPACT, fontSize: '36px', color: CSS.ink,
    }).setOrigin(0.5));
    const row = { fontFamily: FONT_UI, fontSize: '20px', color: CSS.ink };
    const versus = data.mode === 'versus', set = loadBindings();
    const p1 = activeKeys(set, 'p1', versus), p2 = activeKeys(set, 'p2', true);
    if (versus) {
      box.add(this.add.text(360, 252, 'JUGADOR 1', { ...row, fontSize: '15px', color: CSS.primary, fontStyle: 'bold' }));
      box.add(this.add.text(560, 252, 'JUGADOR 2', { ...row, fontSize: '15px', color: TERTIARY_INK, fontStyle: 'bold' }));
    }
    const keysOf = (move: typeof MOVE_LIST[number], keys: typeof p1) =>
      move.with ? `${describeKeys(move.binding, keys)} + ${describeKeys(move.with, keys)}` : describeKeys(move.binding, keys);
    MOVE_LIST.forEach((move, i) => {
      const y = 270 + i * 29;
      const small = { ...row, fontSize: '18px' };
      box.add(this.add.text(160, y, move.label, { ...small, fontStyle: 'bold' }));
      box.add(this.add.text(versus ? 360 : 380, y, keysOf(move, p1), { ...small, color: CSS.primary }));
      if (versus) box.add(this.add.text(560, y, keysOf(move, p2), { ...small, color: CSS.primary }));
      else if (move.note) box.add(this.add.text(540, y, move.note, { ...row, color: MUTED_INK, fontSize: '15px' }).setWordWrapWidth(260));
    });
    const superKeys = versus ? `J1 ${describeKeys('SPECIAL', p1)} · J2 ${describeKeys('SPECIAL', p2)}` : describeKeys('SPECIAL', p1);
    fighters.forEach((f, i) => {
      const x = 820, y = 282 + i * 140;
      box.add(this.add.text(x, y, f.name.toUpperCase(), { fontFamily: FONT_NAME, fontSize: '30px', color: CSS.ink }));
      box.add(this.add.text(x, y + 34, `${f.power}  ·  ${superKeys}`, { ...row, color: CSS.primary }));
      box.add(this.add.text(x, y + 64, 'Súper con la energía al 100 %', { ...row, fontSize: '16px', color: MUTED_INK }));
      box.add(this.add.text(x, y + 92, `${COMMAND_MOVES[f.stats.commandMove].label}  ·  ↓ ↘ → + Puño`, { ...row, fontSize: '17px', color: TERTIARY_INK }));
    });
    box.add(this.add.text(W / 2, 668, '← →  Combos     Esc o Enter  Volver', { ...row, fontSize: '17px', color: MUTED_INK }).setOrigin(0.5));

    // Page 2: example combos for each fighter (each side uses its own keys in two-player mode).
    combos.add(this.add.text(W / 2, 228, 'COMBOS', {
      fontFamily: FONT_IMPACT, fontSize: '36px', color: CSS.ink,
    }).setOrigin(0.5));
    const firstOf = (keys: typeof p1) => (b: Parameters<typeof describeKeys>[0]) => keyLabel(keys[b][0] ?? '?');
    fighters.forEach((f, i) => {
      const x = 160 + i * 500;
      const sideKeys = versus && i === 1 ? p2 : p1;
      const heading = versus ? `${f.name.toUpperCase()} · J${i + 1}` : f.name.toUpperCase();
      combos.add(this.add.text(x, 268, heading, { fontFamily: FONT_NAME, fontSize: '30px', color: CSS.ink }));
      comboExamples(f.id).forEach((combo, j) => {
        const y = 306 + j * 82;
        combos.add(this.add.text(x, y, combo.title, { ...row, fontSize: '18px', fontStyle: 'bold', color: TERTIARY_INK }));
        combos.add(this.add.text(x, y + 25, describeCombo(combo.route, firstOf(sideKeys)), { ...row, fontSize: '20px', color: CSS.primary }));
        if (combo.note) combos.add(this.add.text(x, y + 52, combo.note, { ...row, fontSize: '14px', color: MUTED_INK }));
      });
    });
    combos.add(this.add.text(W / 2, 668, '← →  Movimientos     Esc o Enter  Volver', { ...row, fontSize: '17px', color: MUTED_INK }).setOrigin(0.5));
    return frame;
  }

  private updateSelection(): void {
    this.menuItems.forEach((t, i) => {
      // Selected: inverted ink chip with ivory text; the rest ink on the glass.
      const on = i === this.selectedIndex;
      t.setColor(on ? CSS.ivory : CSS.ink).setBackgroundColor(on ? CSS.ink : 'rgba(0,0,0,0)');
      t.setScale(i === this.selectedIndex ? 1.06 : 1.0);
    });
  }

  private resume(): void {
    const fight = this.scene.get('FightScene');
    fight.input.keyboard?.resetKeys();
    this.scene.resume('FightScene');
    this.scene.stop();
  }

  private restart(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    this.scene.start('FightScene', data);
  }

  private mainMenu(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    this.scene.start('MenuScene', data);
  }

  private changeSelection(): void {
    const data = (this.scene.get('FightScene') as FightScene).getMatchData();
    this.scene.stop('FightScene');
    // In the arcade the matchup belongs to the ladder: go back to it instead of the free selection.
    if (data.arcade) { this.scene.start('ArcadeScene', { run: data.arcade }); return; }
    this.scene.start('SelectionScene', data);
  }
}
