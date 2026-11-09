import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FighterChoice, FIGHTER_PALETTES, FIGHTER_ROSTER, fighterPalette, normalizeChoice, rosterEntry } from '../config/roster';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader, SpriteSheetOptions } from '../animation/SpriteSheetLoader';
import { animationUrls, getManifest } from '../config/characters';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio, musicControls } from '../systems/GameAudio';

interface SelectionData {
  manifest?: { assetPath: string; animations: Record<string, string[]>; spriteSheet?: SpriteSheetOptions };
  stageIndex?: number;
  mode?: 'cpu' | 'training';
  playerChoice?: FighterChoice;
  opponentChoice?: FighterChoice;
  selectionPhase?: 'fighters' | 'stage';
}

export class SelectionScene extends Phaser.Scene {
  private manifest!: NonNullable<SelectionData['manifest']>;
  private playerChoice = normalizeChoice();
  private opponentChoice = normalizeChoice(undefined, 'amethyst');
  private stageIndex = 0;
  private mode: 'cpu' | 'training' = 'cpu';
  private phase: 'fighters' | 'stage' | 'versus' = 'fighters';
  private activeSide: 'player' | 'opponent' = 'player';
  private content!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private steps!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private transition?: Phaser.Time.TimerEvent;
  /** IDLE animation key per character id. */
  private idleKeys = new Map<string, string>();
  private hitTargets: { bounds: Phaser.Geom.Rectangle; action: () => void }[] = [];

  constructor() { super({ key: 'SelectionScene' }); }
  init(data: SelectionData): void {
    this.manifest = data?.manifest ?? getManifest(this, FIGHTER_ROSTER[0].id);
    this.playerChoice = normalizeChoice(data?.playerChoice);
    this.opponentChoice = normalizeChoice(data?.opponentChoice, 'amethyst');
    this.stageIndex = GAME_CONFIG.STAGES[data?.stageIndex ?? 0] ? data?.stageIndex ?? 0 : 0;
    this.mode = data?.mode === 'training' ? 'training' : 'cpu';
    this.phase = data?.selectionPhase === 'stage' ? 'stage' : 'fighters';
    this.activeSide = 'player'; this.transition = undefined;
  }
  create(): void {
    isolateSceneKeyboard(this);
    const video = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (video) { video.pause(); video.style.display = 'none'; }
    GameAudio.for(this).play('music-menu');
    this.add.rectangle(640, 360, 1280, 720, 0x241a35);
    const stripes = this.add.graphics().fillStyle(0x473b72, 0.2);
    for (let x = -300; x < 1400; x += 140) stripes.fillTriangle(x, 720, x + 400, 0, x + 460, 0);
    this.add.rectangle(640, 677, 1280, 86, 0x14101e).setDepth(20);
    this.title = this.add.text(48, 30, '', { fontFamily: 'Impact, Arial Black', fontSize: '43px', color: '#fae8cb' }).setDepth(30);
    this.steps = this.add.text(50, 88, '', { fontFamily: 'Trebuchet MS', fontSize: '18px', color: '#a1ece5' }).setDepth(30);
    this.help = this.add.text(48, 683, '', { fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#c9b8da' }).setDepth(30);
    this.content = this.add.container(0, 0).setDepth(25);
    // Rendering replaces the preview objects. Resolve clicks against current bounds
    // immediately, without waiting for Phaser's next interactive-object queue flush.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const target = [...this.hitTargets].reverse().find(item => item.bounds.contains(pointer.x, pointer.y));
      target?.action();
    });
    for (const fighter of FIGHTER_ROSTER) {
      const manifest = getManifest(this, fighter.id);
      const loader = new SpriteSheetLoader(this, new AnimationRegistry(), fighter.id, manifest.assetPath, null, manifest.spriteSheet);
      loader.loadAnimationFromUrls('IDLE', animationUrls(manifest, 'IDLE'));
      this.idleKeys.set(fighter.id, loader.getPhaserAnimKey('IDLE'));
    }
    musicControls(this);
    const key = (name: string, action: () => void) => this.input.keyboard!.on('keydown-' + name, (event: KeyboardEvent) => {
      event.preventDefault(); if (!event.repeat) action();
    });
    for (const k of ['LEFT', 'A']) key(k, () => this.navigate(-1));
    for (const k of ['RIGHT', 'D']) key(k, () => this.navigate(1));
    key('TAB', () => this.changeSide());
    for (const k of ['UP', 'W']) key(k, () => this.phase === 'stage' ? this.navigate(-3) : this.changeSide());
    for (const k of ['DOWN', 'S']) key(k, () => this.phase === 'stage' ? this.navigate(3) : this.changeSide());
    for (const k of ['ENTER', 'SPACE']) key(k, () => this.confirm());
    key('ESC', () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.transition?.remove());
    this.render();
  }
  private text(x: number, y: number, value: string, size = 20, color = '#fae8cb', centered = false, headline = false) {
    const text = this.add.text(x, y, value, { fontFamily: headline ? 'Impact, Arial Black' : 'Trebuchet MS', fontSize: size + 'px', color });
    if (centered) text.setOrigin(0.5, 0);
    this.content.add(text); return text;
  }
  private rectangle(x: number, y: number, width: number, height: number, color: number, alpha = 1) {
    const rect = this.add.rectangle(x, y, width, height, color, alpha);
    this.content.add(rect); return rect;
  }
  private button(x: number, y: number, width: number, label: string, action: () => void, primary = false) {
    const rect = this.clickable(this.rectangle(x, y, width, 46, primary ? 0xef709d : 0x473b72), action);
    rect.on('pointerover', () => rect.setStrokeStyle(2, 0xa1ece5));
    rect.on('pointerout', () => rect.setStrokeStyle());
    this.text(x, y - 14, label, 22, primary ? '#241a35' : '#fae8cb', true, primary);
  }
  private clickable(rect: Phaser.GameObjects.Rectangle, action: () => void) {
    this.hitTargets.push({ bounds: rect.getBounds(), action });
    return rect.setInteractive({ useHandCursor: true });
  }
  private preview(x: number, y: number, scale: number, choice: FighterChoice, flip = false) {
    const sprite = this.add.sprite(x, y, `${choice.characterId}_IDLE_0`).setOrigin(0.5, 0.975).setScale(scale * 2)
      .setTint(fighterPalette(choice).tint).setFlipX(flip).play(this.idleKeys.get(choice.characterId) ?? '');
    this.content.add(sprite); return sprite;
  }
  private render(): void {
    this.hitTargets = [];
    this.content.removeAll(true);
    if (this.phase === 'fighters') this.renderFighters();
    else if (this.phase === 'stage') this.renderStages();
    else this.renderVersus();
  }
  private renderFighters(): void {
    this.title.setText('ELIGE TU LUCHADORA');
    this.steps.setText('Luchadores   /   Escenario');
    this.help.setText('← → / A D  Color     Tab / ↑ ↓  Cambiar lado     Enter  Confirmar     Esc  Volver');
    for (const side of ['player', 'opponent'] as const) {
      const player = side === 'player', x = player ? 275 : 1000;
      const choice = player ? this.playerChoice : this.opponentChoice;
      const accent = player ? 0xef709d : 0xa1ece5;
      this.clickable(this.rectangle(x, 322, 420, 360, 0x14101e, 0.65)
        .setStrokeStyle(this.activeSide === side ? 3 : 1, accent, this.activeSide === side ? 1 : 0.35),
        () => { this.activeSide = side; this.render(); });
      this.text(x - 186, 155, player ? '1P · Tu personaje' : this.mode === 'cpu' ? 'CPU · Rival' : 'Práctica · Rival', 19, player ? '#ef9dbb' : '#a1ece5');
      this.text(x - 186, 185, rosterEntry(choice.characterId).name.toUpperCase(), 45, '#fae8cb', false, true);
      this.preview(x + 30, 495, 0.43, choice, !player);
      this.text(x, 506, 'Color · ' + fighterPalette(choice).name, 18, '#fae8cb', true);
      FIGHTER_PALETTES.forEach((palette, index) => {
        const cx = (player ? 140 : 866) + index * 90;
        this.clickable(this.rectangle(cx, 550, 78, 32, palette.swatch).setStrokeStyle(choice.paletteId === palette.id ? 3 : 1,
          choice.paletteId === palette.id ? 0xffffff : 0x473b72),
          () => { this.activeSide = side; choice.paletteId = palette.id; this.render(); });
        this.text(cx, 574, palette.name, 13, choice.paletteId === palette.id ? '#ffffff' : '#b6a6c7', true);
      });
    }
    this.text(640, 148, 'VS', 62, '#ef709d', true, true);
    const activeChoice = this.activeSide === 'player' ? this.playerChoice : this.opponentChoice;
    const activeFighter = rosterEntry(activeChoice.characterId);
    this.text(640, 235, activeFighter.power, 24, '#a1ece5', true);
    this.text(640, 270, activeFighter.description, 17, '#c9b8da', true).setAlign('center').setWordWrapWidth(240);
    // One portrait tile per roster entry, centred as a row under the VS.
    FIGHTER_ROSTER.forEach((fighter, index) => {
      const x = 640 + (index - (FIGHTER_ROSTER.length - 1) / 2) * 184;
      const selected = activeChoice.characterId === fighter.id;
      this.clickable(this.rectangle(x, 399, 174, 164, 0x473b72).setStrokeStyle(selected ? 2 : 1, selected ? 0xfae8cb : 0x726182), () => {
        activeChoice.characterId = fighter.id; this.render();
      });
      this.preview(x, 466, 0.2, { ...activeChoice, characterId: fighter.id });
      this.text(x, 486, fighter.name + (selected ? ' · Seleccionada' : ''), 18, selected ? '#fae8cb' : '#b6a6c7', true);
    });
    this.button(640, 565, 220, this.mode === 'cpu' ? 'Rival: CPU' : 'Rival: Práctica', () => {
      this.mode = this.mode === 'cpu' ? 'training' : 'cpu'; this.render();
    });
    this.button(164, 630, 216, 'Volver', () => this.back());
    this.button(1072, 630, 288, 'Elegir escenario', () => this.confirm(), true);
  }
  private renderStages(): void {
    this.title.setText('ELIGE EL ESCENARIO');
    this.steps.setText('Luchadores ✓   /   Escenario');
    this.help.setText('Flechas / W A S D  Escenario     Enter  Confirmar combate     Esc  Volver a luchadores');
    const stage = GAME_CONFIG.STAGES[this.stageIndex];
    const image = this.add.image(890, 218, stage.textureKey).setDisplaySize(650, 174);
    this.content.add(image);
    this.rectangle(890, 218, 650, 174, 0x000000, 0).setStrokeStyle(2, 0xa1ece5);
    this.text(58, 137, stage.name, 35, '#fae8cb', false, true).setWordWrapWidth(450);
    this.text(60, 214, rosterEntry(this.playerChoice.characterId).name + ' · ' + fighterPalette(this.playerChoice).name, 20, '#ef9dbb');
    this.text(60, 245, 'vs. ' + rosterEntry(this.opponentChoice.characterId).name + ' · ' + fighterPalette(this.opponentChoice).name, 20, '#a1ece5');
    this.text(60, 280, this.mode === 'cpu' ? 'Combate contra CPU' : 'Muñeco de práctica', 17, '#c9b8da');
    GAME_CONFIG.STAGES.forEach((entry, i) => {
      const x = 230 + (i % 3) * 410, y = 386 + Math.floor(i / 3) * 142, selected = this.stageIndex === i;
      const thumb = this.add.image(x, y - 13, entry.textureKey).setDisplaySize(360, 102);
      this.content.add(thumb);
      this.rectangle(x, y + 45, 360, 32, 0x14101e, 0.96);
      this.text(x, y + 33, entry.name, 18, selected ? '#a1ece5' : '#fae8cb', true);
      this.clickable(this.rectangle(x, y, 360, 124, 0x000000, 0).setStrokeStyle(selected ? 4 : 1, selected ? 0xa1ece5 : 0x726182),
        () => { this.stageIndex = i; this.render(); });
      if (selected) this.text(x - 172, y - 54, 'Elegido', 14, '#241a35').setBackgroundColor('#a1ece5').setPadding(7, 3);
    });
    this.button(164, 630, 216, 'Luchadores', () => this.back());
    this.button(1072, 630, 288, '¡A pelear!', () => this.confirm(), true);
  }
  private renderVersus(): void {
    this.title.setText('COMBATE LISTO'); this.steps.setText('Luchadores ✓   /   Escenario ✓');
    this.help.setText('Esc  Volver a la selección');
    const stage = GAME_CONFIG.STAGES[this.stageIndex];
    this.content.add(this.add.image(640, 370, stage.textureKey).setDisplaySize(1280, 540).setAlpha(0.45));
    this.preview(330, 570, 0.5, this.playerChoice);
    this.preview(950, 570, 0.5, this.opponentChoice, true);
    this.text(640, 270, 'VS', 112, '#fae8cb', true, true);
    this.text(310, 145, rosterEntry(this.playerChoice.characterId).name.toUpperCase(), 52, '#ef9dbb', true, true);
    this.text(970, 145, rosterEntry(this.opponentChoice.characterId).name.toUpperCase(), 52, '#a1ece5', true, true);
    this.text(310, 207, fighterPalette(this.playerChoice).name + ' · 1P', 21, '#fae8cb', true);
    this.text(970, 207, fighterPalette(this.opponentChoice).name + (this.mode === 'cpu' ? ' · CPU' : ' · Práctica'), 21, '#fae8cb', true);
    this.rectangle(640, 622, 680, 50, 0x14101e, 0.95);
    this.text(640, 606, stage.name, 26, '#fae8cb', true);
  }
  private navigate(delta: number): void {
    if (this.phase === 'versus') return;
    if (this.phase === 'stage') this.stageIndex = (this.stageIndex + delta + GAME_CONFIG.STAGES.length) % GAME_CONFIG.STAGES.length;
    else {
      const choice = this.activeSide === 'player' ? this.playerChoice : this.opponentChoice;
      const index = FIGHTER_PALETTES.findIndex(p => p.id === choice.paletteId);
      choice.paletteId = FIGHTER_PALETTES[(index + delta + FIGHTER_PALETTES.length) % FIGHTER_PALETTES.length].id;
    }
    this.render();
  }
  private changeSide(): void {
    if (this.phase !== 'fighters') return;
    this.activeSide = this.activeSide === 'player' ? 'opponent' : 'player'; this.render();
  }
  private confirm(): void {
    if (this.phase === 'versus') return;
    if (this.phase === 'fighters') this.phase = 'stage';
    else {
      this.phase = 'versus';
      this.transition = this.time.delayedCall(1000, () => this.scene.start('FightScene', this.matchData()));
    }
    this.render();
  }
  private back(): void {
    if (this.phase === 'fighters') { this.scene.start('MenuScene', this.matchData()); return; }
    this.transition?.remove(); this.transition = undefined;
    this.phase = this.phase === 'versus' ? 'stage' : 'fighters'; this.render();
  }
  private matchData() {
    return { manifest: this.manifest, stageIndex: this.stageIndex, mode: this.mode,
      playerChoice: { ...this.playerChoice }, opponentChoice: { ...this.opponentChoice } };
  }
}
