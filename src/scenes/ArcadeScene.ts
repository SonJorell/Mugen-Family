// ============================================================
// ArcadeScene — Fighter pick, ladder, continue and ending of the arcade mode
// ============================================================

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FIGHTER_PALETTES, FIGHTER_ROSTER, fighterPalette, normalizeChoice, rosterEntry } from '../config/roster';
import { ArcadeRun, ArcadeStep, buildLadder, newRun } from '../config/arcade';
import { menuArtKey, playUiSound } from '../config/characters';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { recordArcadeClear } from '../systems/Stats';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

export type ArcadeView = 'pick' | 'ladder' | 'continue' | 'ending';
export type ArcadeResult = 'player' | 'opponent' | 'draw';

interface ArcadeData {
  run?: ArcadeRun;
  /** Outcome of the fight that just ended, if any. */
  result?: ArcadeResult;
}

const INK = '#fae8cb', MUTED = '#c9b8da', PINK = '#ef9dbb', AQUA = '#a1ece5', GOLD = '#f5bd75';

export class ArcadeScene extends Phaser.Scene {
  view: ArcadeView = 'pick';
  run: ArcadeRun | null = null;
  ladder: ArcadeStep[] = [];
  private pickIndex = 0;
  private paletteIndex = 0;
  private content!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'ArcadeScene' }); }

  init(data: ArcadeData): void {
    this.run = data?.run ? { ...data.run, player: normalizeChoice(data.run.player) } : null;
    this.view = 'pick';
    if (this.run) {
      this.ladder = buildLadder(this.run.player);
      if (data.result === 'player') {
        this.run.step++;
        this.view = this.run.step >= this.ladder.length ? 'ending' : 'ladder';
        if (this.view === 'ending') recordArcadeClear(this.run.player.characterId, this.run.continues);
      } else if (data.result) {
        this.view = 'continue';
      } else {
        this.view = 'ladder';
      }
    }
  }

  create(): void {
    isolateSceneKeyboard(this);
    GameAudio.for(this).play('music-menu');
    musicControls(this);
    const backdrop = this.add.image(640, 360, 'menu_arica_coast');
    if (backdrop.width > 1) backdrop.setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1280, 720, 0x0b0814, 0.78);
    this.content = this.add.container(0, 0);

    const key = (name: string, action: () => void) => this.input.keyboard!.on('keydown-' + name, (event: KeyboardEvent) => {
      event.preventDefault(); if (!event.repeat) action();
    });
    for (const k of ['LEFT', 'A']) key(k, () => this.move(-1, 0));
    for (const k of ['RIGHT', 'D']) key(k, () => this.move(1, 0));
    for (const k of ['UP', 'W']) key(k, () => this.move(0, -1));
    for (const k of ['DOWN', 'S']) key(k, () => this.move(0, 1));
    for (const k of ['ENTER', 'SPACE']) key(k, () => this.confirm());
    key('ESC', () => this.back());
    this.render();
  }

  // ── Input ────────────────────────────────────────────────

  private move(dx: number, dy: number): void {
    if (this.view !== 'pick') return;
    playUiSound(this, 'menu-move', 0.4);
    if (dx) this.pickIndex = (this.pickIndex + dx + FIGHTER_ROSTER.length) % FIGHTER_ROSTER.length;
    if (dy) this.paletteIndex = (this.paletteIndex + dy + FIGHTER_PALETTES.length) % FIGHTER_PALETTES.length;
    this.render();
  }

  confirm(): void {
    playUiSound(this, 'menu-whoosh', 0.5);
    if (this.view === 'pick') {
      this.run = newRun({ characterId: FIGHTER_ROSTER[this.pickIndex].id, paletteId: FIGHTER_PALETTES[this.paletteIndex].id });
      this.ladder = buildLadder(this.run.player);
      this.view = 'ladder';
      this.render();
    } else if (this.view === 'ladder') {
      this.startFight();
    } else if (this.view === 'continue') {
      this.run!.continues++;
      this.startFight();
    } else {
      this.scene.start('CreditsScene');
    }
  }

  back(): void {
    if (this.view === 'pick' || this.view === 'ladder' || this.view === 'continue') this.scene.start('MenuScene');
    else this.scene.start('CreditsScene');
  }

  private startFight(): void {
    const run = this.run!, step = this.ladder[run.step];
    this.scene.start('FightScene', {
      mode: 'cpu', difficulty: step.difficulty, stageIndex: step.stageIndex,
      playerChoice: { ...run.player }, opponentChoice: { ...step.opponent }, arcade: { ...run, player: { ...run.player } },
    });
  }

  // ── Views ────────────────────────────────────────────────

  private text(x: number, y: number, value: string, size: number, color = INK, headline = false, origin = 0) {
    const t = this.add.text(x, y, value, {
      fontFamily: headline ? FONT_IMPACT : FONT_UI, fontSize: size + 'px', color,
      stroke: '#0b0814', strokeThickness: color === '#241a35' ? 0 : headline ? 6 : 3, lineSpacing: 6,
    }).setOrigin(origin, 0);
    this.content.add(t);
    return t;
  }

  private art(x: number, y: number, characterId: string, height: number) {
    const key = menuArtKey(characterId);
    if (!this.textures.exists(key)) return null;
    const image = this.add.image(x, y, key).setOrigin(0.5, 1);
    image.setScale(height / image.height);
    this.content.add(image);
    return image;
  }

  private help(value: string): void {
    this.content.add(this.add.rectangle(640, 690, 1280, 60, 0x14101e, 0.95));
    this.text(640, 678, value, 17, MUTED, false, 0.5);
  }

  private render(): void {
    this.content.removeAll(true);
    if (this.view === 'pick') this.renderPick();
    else if (this.view === 'ladder') this.renderLadder();
    else if (this.view === 'continue') this.renderContinue();
    else this.renderEnding();
  }

  private renderPick(): void {
    this.text(48, 30, 'MODO ARCADE', 46, INK, true);
    this.text(50, 92, 'Elige a tu luchador y vence a todos los rivales', 19, AQUA);
    FIGHTER_ROSTER.forEach((fighter, i) => {
      const x = 640 + (i - (FIGHTER_ROSTER.length - 1) / 2) * 340, selected = i === this.pickIndex;
      const card = this.add.rectangle(x, 390, 300, 440, 0x14101e, selected ? 0.9 : 0.6)
        .setStrokeStyle(selected ? 4 : 1, selected ? 0xef709d : 0x473b72).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => { if (this.pickIndex === i) this.confirm(); else { this.pickIndex = i; this.render(); } });
      this.content.add(card);
      const image = this.art(x, 520, fighter.id, 330);
      if (image && !selected) image.setAlpha(0.55);
      this.text(x, 530, fighter.name.toUpperCase(), 34, selected ? INK : MUTED, true, 0.5);
      this.text(x, 572, fighter.power, 17, selected ? AQUA : MUTED, false, 0.5);
    });
    const palette = FIGHTER_PALETTES[this.paletteIndex];
    this.text(640, 616, `Color · ${palette.name}`, 19, PINK, false, 0.5);
    this.help('← →  Luchador     ↑ ↓  Color     Enter  Empezar     Esc  Menú');
  }

  private renderLadder(): void {
    const run = this.run!, player = rosterEntry(run.player.characterId);
    this.text(48, 30, 'MODO ARCADE', 46, INK, true);
    this.text(50, 92, `${player.name} · ${fighterPalette(run.player).name}` + (run.continues ? `   ·   Continuaciones: ${run.continues}` : ''), 19, PINK);
    this.art(250, 640, run.player.characterId, 470);
    this.ladder.forEach((step, i) => {
      const y = 170 + i * 92, done = i < run.step, current = i === run.step;
      const row = this.add.rectangle(800, y + 34, 700, 78, current ? 0x2a1d3f : 0x14101e, current ? 0.95 : 0.7)
        .setStrokeStyle(current ? 3 : 1, current ? 0xef709d : 0x473b72);
      this.content.add(row);
      const rival = rosterEntry(step.opponent.characterId);
      this.text(470, y + 12, done ? '✓' : current ? '▶' : String(i + 1), 34, done ? AQUA : current ? PINK : MUTED, true);
      this.text(520, y + 8, `vs. ${rival.name.toUpperCase()}` + (step.boss ? '  ·  JEFE FINAL' : ''), 26, current ? INK : done ? MUTED : INK, true);
      this.text(520, y + 44, `CPU ${GAME_CONFIG.CPU_DIFFICULTY[step.difficulty].label} · ${GAME_CONFIG.STAGES[step.stageIndex].name} · ${fighterPalette(step.opponent).name}`, 16, current ? AQUA : MUTED);
    });
    const step = this.ladder[run.step];
    this.text(800, 170 + this.ladder.length * 92 + 8, `Combate ${run.step + 1} de ${this.ladder.length}`, 22, GOLD, true, 0.5);
    const fight = this.add.rectangle(800, 170 + this.ladder.length * 92 + 74, 300, 52, 0xef709d).setInteractive({ useHandCursor: true });
    fight.on('pointerdown', () => this.confirm());
    this.content.add(fight);
    this.text(800, 170 + this.ladder.length * 92 + 56, step.boss ? '¡Jefe final!' : '¡A pelear!', 26, '#241a35', true, 0.5);
    this.help('Enter  ¡A pelear!     Esc  Abandonar y volver al menú');
  }

  private renderContinue(): void {
    const run = this.run!, step = this.ladder[run.step];
    this.text(640, 120, 'DERROTA', 90, PINK, true, 0.5);
    this.text(640, 250, `${rosterEntry(step.opponent.characterId).name} te ganó en el combate ${run.step + 1} de ${this.ladder.length}.`, 22, INK, false, 0.5);
    this.text(640, 300, '¿Continuar?', 44, INK, true, 0.5);
    const yes = this.add.rectangle(510, 420, 240, 56, 0xef709d).setInteractive({ useHandCursor: true });
    const no = this.add.rectangle(770, 420, 240, 56, 0x473b72).setInteractive({ useHandCursor: true });
    yes.on('pointerdown', () => this.confirm());
    no.on('pointerdown', () => this.back());
    this.content.add([yes, no]);
    this.text(510, 402, 'Continuar', 26, '#241a35', true, 0.5);
    this.text(770, 402, 'Menú principal', 24, INK, true, 0.5);
    if (run.continues) this.text(640, 480, `Continuaciones usadas: ${run.continues}`, 18, MUTED, false, 0.5);
    this.help('Enter  Continuar desde este combate     Esc  Menú principal');
  }

  private renderEnding(): void {
    const run = this.run!, fighter = rosterEntry(run.player.characterId);
    this.art(330, 680, fighter.id, 600);
    this.text(620, 70, '¡CAMPEÓN!', 64, GOLD, true);
    this.text(624, 150, fighter.name.toUpperCase(), 36, PINK, true);
    this.text(624, 220, fighter.ending, 22, INK).setWordWrapWidth(600);
    this.text(624, 540, run.continues ? `Completado con ${run.continues} continuación${run.continues === 1 ? '' : 'es'}.` : 'Completado sin continuar. ¡Impecable!', 18, AQUA);
    this.help('Enter  Ver créditos');
  }
}
