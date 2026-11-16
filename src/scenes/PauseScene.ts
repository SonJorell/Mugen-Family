// ============================================================
// PauseScene — Overlay pause menu
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FightScene } from './FightScene';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { musicControls } from '../systems/GameAudio';
import { MOVE_LIST, describeKeys, keyLabel } from '../input/InputMapping';
import { activeKeys, loadBindings } from '../input/Bindings';
import { rosterEntry } from '../config/roster';
import { COMMAND_MOVES } from '../combat/AttackDefinition';
import { comboExamples, describeCombo } from '../config/combos';
import type { TrainingOptions } from '../ui/TrainingOverlay';

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
  /** True while the move list covers the pause menu. */
  get moveListOpen(): boolean { return !!this.moveList?.visible; }

  constructor() {
    super({ key: 'PauseScene' });
  }

  create(): void {
    isolateSceneKeyboard(this);
    musicControls(this, 1250, 138);
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

    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);

    // Pause title
    this.title = this.add.text(W / 2, training ? 110 : H / 2 - 140, 'PAUSA', {
      fontFamily: 'Arial Black',
      fontSize: '60px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    // Options
    this.items.forEach((opt, i) => {
      const t = this.add.text(W / 2, top + i * step, opt.label, {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
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
    frame.add(this.add.rectangle(W / 2, 440, 1040, 500, 0x10141c, 0.96).setStrokeStyle(3, 0xffdd77, 0.8));
    const box = this.add.container(0, 0), combos = this.add.container(0, 0);
    frame.add([box, combos]);
    this.movePages = [box, combos];
    box.add(this.add.text(W / 2, 228, 'MOVIMIENTOS', {
      fontFamily: 'Arial Black', fontSize: '36px', color: '#ffdd77', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5));
    const row = { fontFamily: 'Arial', fontSize: '20px', color: '#eee8d9' };
    const versus = data.mode === 'versus', set = loadBindings();
    const p1 = activeKeys(set, 'p1', versus), p2 = activeKeys(set, 'p2', true);
    if (versus) {
      box.add(this.add.text(360, 252, 'JUGADOR 1', { ...row, fontSize: '15px', color: '#ef9dbb', fontStyle: 'bold' }));
      box.add(this.add.text(560, 252, 'JUGADOR 2', { ...row, fontSize: '15px', color: '#a1ece5', fontStyle: 'bold' }));
    }
    const keysOf = (move: typeof MOVE_LIST[number], keys: typeof p1) =>
      move.with ? `${describeKeys(move.binding, keys)} + ${describeKeys(move.with, keys)}` : describeKeys(move.binding, keys);
    MOVE_LIST.forEach((move, i) => {
      const y = 270 + i * 29;
      const small = { ...row, fontSize: '18px' };
      box.add(this.add.text(160, y, move.label, { ...small, fontStyle: 'bold' }));
      box.add(this.add.text(versus ? 360 : 380, y, keysOf(move, p1), { ...small, color: '#ffdd77' }));
      if (versus) box.add(this.add.text(560, y, keysOf(move, p2), { ...small, color: '#ffdd77' }));
      else if (move.note) box.add(this.add.text(540, y, move.note, { ...row, color: '#9aa4b2', fontSize: '15px' }).setWordWrapWidth(260));
    });
    const superKeys = versus ? `J1 ${describeKeys('SPECIAL', p1)} · J2 ${describeKeys('SPECIAL', p2)}` : describeKeys('SPECIAL', p1);
    fighters.forEach((f, i) => {
      const x = 820, y = 282 + i * 140;
      box.add(this.add.text(x, y, f.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '22px', color: '#ffffff' }));
      box.add(this.add.text(x, y + 34, `${f.power}  ·  ${superKeys}`, { ...row, color: '#ffdd77' }));
      box.add(this.add.text(x, y + 64, 'Súper con la energía al 100 %', { ...row, fontSize: '16px', color: '#9aa4b2' }));
      box.add(this.add.text(x, y + 92, `${COMMAND_MOVES[f.stats.commandMove].label}  ·  ↓ ↘ → + Puño`, { ...row, fontSize: '17px', color: '#a1ece5' }));
    });
    box.add(this.add.text(W / 2, 668, '← →  Combos     Esc o Enter  Volver', { ...row, fontSize: '17px', color: '#9aa4b2' }).setOrigin(0.5));

    // Page 2: example combos for each fighter, written with player 1's keys.
    combos.add(this.add.text(W / 2, 228, 'COMBOS', {
      fontFamily: 'Arial Black', fontSize: '36px', color: '#ffdd77', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5));
    const first = (b: Parameters<typeof describeKeys>[0]) => keyLabel(p1[b][0] ?? '?');
    fighters.forEach((f, i) => {
      const x = 160 + i * 500;
      combos.add(this.add.text(x, 268, f.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '22px', color: '#ffffff' }));
      comboExamples(f.id).forEach((combo, j) => {
        const y = 306 + j * 82;
        combos.add(this.add.text(x, y, combo.title, { ...row, fontSize: '18px', fontStyle: 'bold', color: '#a1ece5' }));
        combos.add(this.add.text(x, y + 25, describeCombo(combo.route, first), { ...row, fontSize: '20px', color: '#ffdd77' }));
        if (combo.note) combos.add(this.add.text(x, y + 52, combo.note, { ...row, fontSize: '14px', color: '#9aa4b2' }));
      });
    });
    combos.add(this.add.text(W / 2, 668, '← →  Movimientos     Esc o Enter  Volver', { ...row, fontSize: '17px', color: '#9aa4b2' }).setOrigin(0.5));
    return frame;
  }

  private updateSelection(): void {
    this.menuItems.forEach((t, i) => {
      t.setColor(i === this.selectedIndex ? '#ffdd00' : '#ffffff');
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
