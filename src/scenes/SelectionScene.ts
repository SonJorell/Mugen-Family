import Phaser from 'phaser';
import { CPU_DIFFICULTIES, CpuDifficulty, GAME_CONFIG, GAME_MODES, GameMode, normalizeDifficulty, normalizeMode } from '../config/gameConfig';
import { FighterChoice, FIGHTER_PALETTES, FIGHTER_ROSTER, fighterPalette, normalizeChoice, rosterEntry } from '../config/roster';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { SpriteSheetLoader, SpriteSheetOptions } from '../animation/SpriteSheetLoader';
import { animationUrls, getManifest, menuArtKey, playUiSound } from '../config/characters';
import { SelectionBackdrop } from '../ui/selection/SelectionBackdrop';
import { ensureFaceTexture } from '../ui/selection/fighterFaces';
import { ensureGlowTexture, Title3D } from '../ui/menu/MenuEffects';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FONT_UI, FONT_IMPACT } from '../ui/fonts';

interface SelectionData {
  manifest?: { assetPath: string; animations: Record<string, string[]>; spriteSheet?: SpriteSheetOptions };
  stageIndex?: number;
  mode?: string;
  difficulty?: string;
  playerChoice?: FighterChoice;
  opponentChoice?: FighterChoice;
  selectionPhase?: 'fighters' | 'stage';
}

const MODE_LABELS: Record<GameMode, string> = { cpu: 'CPU', training: 'Práctica', versus: 'Jugador 2' };

type Animatable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;
/** Starting offsets for an entrance: x/y are added, every other property is multiplied. */
type EnterFrom = Partial<Record<'x' | 'y' | 'scaleX' | 'scaleY' | 'alpha', number>>;

/**
 * Fighter, arena and versus screens. Every change rebuilds `content` at its final layout
 * (so clicks resolve instantly) and then plays entrances on top; nothing here blocks input.
 */
export class SelectionScene extends Phaser.Scene {
  private manifest!: NonNullable<SelectionData['manifest']>;
  private playerChoice = normalizeChoice();
  private opponentChoice = normalizeChoice(undefined, 'amethyst');
  private stageIndex = 0;
  private mode: GameMode = 'cpu';
  private difficulty: CpuDifficulty = GAME_CONFIG.DEFAULT_CPU_DIFFICULTY;
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
  private backdrop!: SelectionBackdrop;
  /** Objects outside `content` that belong to the current render (3D titles, flashes). */
  private extras: { destroy(): void }[] = [];
  /** Per-frame ambient animation of the current render; receives seconds. */
  private live: ((t: number) => void)[] = [];
  private bucket?: Animatable[];
  private clock = 0;
  private pointerX = 0;
  private pointerY = 0;
  /** What the previous render showed, to animate only what changed. */
  private shown: { phase?: string; player?: string; opponent?: string; stage?: number } = {};
  private get motion(): boolean { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  constructor() { super({ key: 'SelectionScene' }); }
  init(data: SelectionData): void {
    this.manifest = data?.manifest ?? getManifest(this, FIGHTER_ROSTER[0].id);
    this.playerChoice = normalizeChoice(data?.playerChoice);
    this.opponentChoice = normalizeChoice(data?.opponentChoice, 'amethyst');
    this.stageIndex = GAME_CONFIG.STAGES[data?.stageIndex ?? 0] ? data?.stageIndex ?? 0 : 0;
    this.mode = normalizeMode(data?.mode);
    this.difficulty = normalizeDifficulty(data?.difficulty);
    this.phase = data?.selectionPhase === 'stage' ? 'stage' : 'fighters';
    this.activeSide = 'player'; this.transition = undefined;
    this.syncPalettes();
    this.extras = []; this.live = []; this.shown = {}; this.clock = 0; this.pointerX = 0; this.pointerY = 0;
  }
  create(): void {
    isolateSceneKeyboard(this);
    const video = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (video) { video.pause(); video.style.display = 'none'; }
    GameAudio.for(this).play('music-menu');
    this.backdrop = new SelectionBackdrop(this);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerX = Phaser.Math.Clamp((pointer.x - 640) / 640, -1, 1);
      this.pointerY = Phaser.Math.Clamp((pointer.y - 360) / 360, -1, 1);
    });
    this.input.on('gameout', () => { this.pointerX = 0; this.pointerY = 0; });
    this.add.rectangle(640, 677, 1280, 86, 0x14101e).setDepth(20);
    this.title = this.add.text(48, 30, '', { fontFamily: FONT_IMPACT, fontSize: '43px', color: '#fae8cb' }).setDepth(30);
    this.steps = this.add.text(50, 88, '', { fontFamily: FONT_UI, fontSize: '18px', color: '#a1ece5' }).setDepth(30);
    this.help = this.add.text(48, 683, '', { fontFamily: FONT_UI, fontSize: '15px', color: '#c9b8da' }).setDepth(30);
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
    key('Q', () => this.cycleFighter(-1));
    key('E', () => this.cycleFighter(1));
    key('X', () => this.cycleDifficulty());
    for (const k of ['UP', 'W']) key(k, () => this.phase === 'stage' ? this.navigate(-3) : this.changeSide());
    for (const k of ['DOWN', 'S']) key(k, () => this.phase === 'stage' ? this.navigate(3) : this.changeSide());
    for (const k of ['ENTER', 'SPACE']) key(k, () => this.confirm());
    key('ESC', () => this.back());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.transition?.remove());
    this.render();
  }
  private text(x: number, y: number, value: string, size = 20, color = '#fae8cb', centered = false, headline = false) {
    const text = this.add.text(x, y, value, { fontFamily: headline ? FONT_IMPACT : FONT_UI, fontSize: size + 'px', color });
    if (centered) text.setOrigin(0.5, 0);
    this.content.add(text); this.bucket?.push(text); return text;
  }
  private rectangle(x: number, y: number, width: number, height: number, color: number, alpha = 1) {
    const rect = this.add.rectangle(x, y, width, height, color, alpha);
    this.content.add(rect); this.bucket?.push(rect); return rect;
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
    this.content.add(sprite); this.bucket?.push(sprite); return sprite;
  }
  /** Adds any other object to the content (and to the group being collected). */
  private place<T extends Animatable>(object: T): T { this.content.add(object); this.bucket?.push(object); return object; }
  /** Runs `build` and returns everything it created, to animate it as one group. */
  private collect(build: () => void): Animatable[] {
    const outer = this.bucket, group: Animatable[] = [];
    this.bucket = group; build(); this.bucket = outer;
    outer?.push(...group);
    return group;
  }
  /** Plays objects from an offset state into the layout they already have. No-op without motion. */
  private enter(targets: Animatable[], from: EnterFrom, config: { duration?: number; delay?: number; ease?: string; onComplete?: () => void } = {}): void {
    if (!this.motion) { config.onComplete?.(); return; }
    targets.forEach((target, index) => {
      const to: Record<string, number> = {};
      for (const [key, value] of Object.entries(from) as [keyof EnterFrom, number][]) {
        to[key] = target[key];
        target[key] = key === 'x' || key === 'y' ? target[key] + value : target[key] * value;
      }
      this.tweens.add({ targets: target, ...to, duration: config.duration ?? 380, delay: config.delay ?? 0,
        ease: config.ease ?? 'Cubic.easeOut', onComplete: index === 0 ? config.onComplete : undefined });
    });
  }
  /** Glowing pedestal in perspective with rings that ripple outward and a spotlight above. */
  private pedestal(x: number, y: number, width: number, accent: number, active: boolean): void {
    const light = this.place(this.add.image(x, y - width * 0.62, ensureGlowTexture(this)).setDisplaySize(width * 1.25, width * 1.7)
      .setTint(accent).setBlendMode(Phaser.BlendModes.ADD).setAlpha(active ? 0.3 : 0.14));
    this.place(this.add.ellipse(x, y, width, width * 0.15, accent, active ? 0.3 : 0.14));
    const rings = [0, 0.5].map(offset => {
      const ring = this.place(this.add.ellipse(x, y, width, width * 0.15).setStrokeStyle(2, accent, 1).setBlendMode(Phaser.BlendModes.ADD));
      ring.isFilled = false;
      return { ring, offset };
    });
    rings.forEach(({ ring }) => ring.setAlpha(active ? 0.5 : 0.2));
    this.live.push(t => {
      for (const { ring, offset } of rings) {
        const f = (t * 0.45 + offset) % 1;
        ring.setScale(0.7 + f * 0.75).setAlpha((1 - f) * (active ? 0.8 : 0.3));
      }
      if (active) light.setAlpha(0.28 + Math.sin(t * 2.2) * 0.05);
    });
  }
  /** Border that breathes, for whatever is currently chosen. */
  private pulseBorder(rect: Phaser.GameObjects.Rectangle, width: number, color: number): void {
    this.live.push(t => rect.setStrokeStyle(width, color, 0.62 + Math.sin(t * 4) * 0.38));
  }
  /** Extruded 3D lettering that slams onto the screen (or simply appears without motion). */
  private slamTitle(x: number, y: number, word: string, fontSize: number, colors: { side?: [number, number]; face?: [number, number] },
    slam: { from: number; delay: number; shake: number; volume: number } | null): void {
    const title = new Title3D(this, x, y, [word], 26, { fontSize, centered: true, shine: false, ...colors });
    const line = title.lines[0];
    this.extras.push(title);
    this.live.push(() => title.update(this.pointerX, this.pointerY));
    const pulse = () => { if (this.motion) this.tweens.add({ targets: line, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); };
    if (!slam) { pulse(); return; }
    const land = () => {
      playUiSound(this, 'menu-impact', slam.volume);
      if (!this.motion) return;
      this.cameras.main.shake(180, slam.shake);
      const flash = this.add.image(line.x, line.y, ensureGlowTexture(this)).setDepth(25).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5, 0.2);
      this.extras.push(flash);
      this.tweens.add({ targets: flash, scaleX: 3, scaleY: 0.9, alpha: 0, duration: 450, ease: 'Cubic.easeOut' });
      pulse();
    };
    if (!this.motion) { land(); return; }
    line.setScale(slam.from).setAlpha(0);
    this.tweens.add({ targets: line, scale: 1, alpha: 1, duration: 280, delay: slam.delay, ease: 'Quart.easeIn', onComplete: land });
  }
  private render(): void {
    this.hitTargets = [];
    this.tweens.killAll();
    this.live = [];
    this.extras.forEach(extra => extra.destroy()); this.extras = [];
    this.content.removeAll(true);
    this.title.setPosition(48, 30).setAlpha(1); this.steps.setPosition(50, 88).setAlpha(1);
    this.help.setOrigin(0, 0).setPosition(48, 683);
    this.syncPalettes();
    const fresh = this.shown.phase !== this.phase;
    const now = { phase: this.phase, player: this.playerChoice.characterId + this.playerChoice.paletteId,
      opponent: this.opponentChoice.characterId + this.opponentChoice.paletteId, stage: this.stageIndex };
    if (this.phase === 'fighters') this.renderFighters(fresh, { player: !fresh && now.player !== this.shown.player, opponent: !fresh && now.opponent !== this.shown.opponent });
    else if (this.phase === 'stage') this.renderStages(fresh, !fresh && now.stage !== this.shown.stage);
    else this.renderVersus();
    if (fresh) {
      if (this.shown.phase) playUiSound(this, 'menu-whoosh', 0.45);
      this.enter([this.title, this.steps], { x: -36, alpha: 0 }, { duration: 320 });
    }
    this.shown = now;
  }
  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50), motion = this.motion;
    this.backdrop.update(dt, this.pointerX, this.pointerY, motion);
    if (!motion) return;
    this.clock += dt;
    for (const animate of this.live) animate(this.clock / 1000);
  }
  /** Full-body art of a choice, rising from its corner; falls back to the sprite when a fighter has no art. */
  private portrait(x: number, foot: number, height: number, choice: FighterChoice, flip: boolean): Animatable {
    const key = menuArtKey(choice.characterId);
    if (!this.textures.exists(key)) return this.preview(x, Math.min(foot, 630), 0.5, choice, flip);
    const source = this.textures.get(key).getSourceImage();
    return this.place(this.add.image(x, foot, key).setOrigin(0.5, 1).setDisplaySize(height * source.width / source.height, height)
      .setTint(fighterPalette(choice).tint).setFlipX(flip).setName(`selection-portrait-${flip ? 'opponent' : 'player'}`));
  }
  /** Colours are no longer picked here: a mirror match tints the rival so the two can be told apart. */
  private syncPalettes(): void {
    const mirror = this.opponentChoice.characterId === this.playerChoice.characterId;
    this.playerChoice.paletteId = FIGHTER_PALETTES[0].id;
    this.opponentChoice.paletteId = FIGHTER_PALETTES[mirror ? 1 : 0].id;
  }
  private renderFighters(fresh: boolean, changed: { player: boolean; opponent: boolean }): void {
    this.title.setText('ELIGE TU LUCHADOR');
    this.steps.setText('Luchadores   /   Escenario');
    this.help.setText('Q E / ← →  Luchador     Tab / ↑ ↓  Lado     X  Dificultad     Enter  Confirmar     Esc  Volver')
      .setOrigin(0.5, 0).setX(640);
    const rivalTag = this.mode === 'cpu' ? 'CPU' : this.mode === 'versus' ? '2P' : 'PRÁCTICA';
    // Each fighter rises out of a bottom corner inside a big arc, with the name written over the art.
    for (const side of ['player', 'opponent'] as const) {
      const player = side === 'player', corner = player ? 0 : 1280, out = player ? 1 : -1;
      const choice = player ? this.playerChoice : this.opponentChoice;
      const accent = player ? 0xef709d : 0xa1ece5, active = this.activeSide === side;
      const edge = corner + out * 36, origin = player ? 0 : 1;
      let art!: Animatable;
      const card = this.collect(() => {
        this.clickable(this.rectangle(corner + out * 220, 385, 440, 500, 0x000000, 0), () => { this.activeSide = side; this.render(); });
        const arc = this.place(this.add.circle(corner, 720, 500, accent, active ? 0.2 : 0.08).setStrokeStyle(active ? 4 : 2, accent, active ? 1 : 0.4));
        this.place(this.add.circle(corner, 720, 468).setStrokeStyle(1, accent, active ? 0.55 : 0.2)).isFilled = false;
        if (active) this.live.push(t => arc.setStrokeStyle(4, accent, 0.62 + Math.sin(t * 4) * 0.38));
        art = this.portrait(corner + out * 222, 770, 650, choice, !player);
        this.text(edge, 532, player ? '1P · Tu personaje' : rivalTag + ' · Rival', 19, player ? '#ef9dbb' : '#a1ece5')
          .setOrigin(origin, 0).setFontStyle('bold').setStroke('#14101e', 5);
        // The name sits over the art, outlined so it reads on any fighter, and shrinks to stay in its corner.
        const name = this.text(edge, 552, rosterEntry(choice.characterId).name.toUpperCase(), 66, '#fae8cb', false, true)
          .setOrigin(origin, 0).setStroke('#14101e', 10);
        if (name.width > 350) name.setFontSize(Math.floor(66 * 350 / name.width));
      });
      // Corners rise in from off-screen; a changed fighter pops up from its corner.
      if (fresh) this.enter(card, { x: -out * 140, y: 90, alpha: 0 }, { duration: 460, delay: 60 });
      else if (changed[side]) this.enter([art], { x: -out * 70, y: 60, alpha: 0.2 }, { duration: 300, ease: 'Back.easeOut' });
    }
    const activeChoice = this.activeSide === 'player' ? this.playerChoice : this.opponentChoice;
    const activeFighter = rosterEntry(activeChoice.characterId);
    // Faces of the whole roster in a compact grid between the corners, with each side's cursor.
    const TILE = 78, STEP = 86, TOP = 196, cols = Math.min(4, FIGHTER_ROSTER.length), rows = Math.ceil(FIGHTER_ROSTER.length / cols);
    FIGHTER_ROSTER.forEach((fighter, index) => {
      const row = Math.floor(index / cols), inRow = row === rows - 1 ? FIGHTER_ROSTER.length - row * cols : cols;
      const x = 640 + (index % cols - (inRow - 1) / 2) * STEP, y = TOP + row * STEP;
      const p1 = this.playerChoice.characterId === fighter.id, p2 = this.opponentChoice.characterId === fighter.id;
      const tile = this.collect(() => {
        const frame = this.rectangle(x, y, TILE, TILE, 0x241a35).setStrokeStyle(1, 0x726182);
        this.clickable(frame, () => { activeChoice.characterId = fighter.id; this.render(); });
        const face = ensureFaceTexture(this, fighter.id);
        if (face) this.place(this.add.image(x, y, face).setDisplaySize(TILE - 4, TILE - 4).setName(`selection-face-${fighter.id}`));
        this.rectangle(x, y + TILE / 2 - 10, TILE - 4, 18, 0x14101e, 0.85);
        this.text(x, y + TILE / 2 - 19, fighter.name.toUpperCase(), 14, p1 || p2 ? '#fae8cb' : '#b6a6c7', true).setFontStyle('bold');
        // Cursors: 1P outside in pink, the rival just inside in aqua, so both show on the same face.
        if (p1) {
          const cursor = this.rectangle(x, y, TILE + 4, TILE + 4, 0x000000, 0).setStrokeStyle(3, 0xef709d);
          if (this.activeSide === 'player') this.pulseBorder(cursor, 3, 0xef709d);
          this.text(x - TILE / 2 - 2, y - TILE / 2 - 9, '1P', 13, '#241a35').setFontStyle('bold').setBackgroundColor('#ef709d').setPadding(4, 0);
        }
        if (p2) {
          const cursor = this.rectangle(x, y, TILE - 4, TILE - 4, 0x000000, 0).setStrokeStyle(3, 0xa1ece5);
          if (this.activeSide === 'opponent') this.pulseBorder(cursor, 3, 0xa1ece5);
          this.text(x + TILE / 2 + 2, y - TILE / 2 - 9, rivalTag === 'PRÁCTICA' ? 'PR' : rivalTag, 13, '#241a35').setFontStyle('bold').setBackgroundColor('#a1ece5').setPadding(4, 0).setOrigin(1, 0);
        }
      });
      if (fresh) this.enter(tile, { y: 34, alpha: 0 }, { duration: 380, delay: 300 + index * 70, ease: 'Back.easeOut' });
    });
    // VS under the faces, then what the highlighted fighter does.
    const below = TOP + (rows - 1) * STEP + TILE / 2;
    this.slamTitle(640, below + 16, 'VS', 62, { side: [0x3d0f27, 0xb0406c], face: [0xffd9e6, 0xef709d] },
      fresh ? { from: 2.8, delay: 260, shake: 0.004, volume: 0.35 } : null);
    this.text(640, below + 108, activeFighter.power, 24, '#a1ece5', true).setFontStyle('bold');
    this.text(640, below + 142, activeFighter.description, 17, '#c9b8da', true).setAlign('center').setWordWrapWidth(300);
    // CPU → Práctica → Jugador 2 → CPU.
    this.button(640, 565, 220, 'Rival: ' + MODE_LABELS[this.mode], () => {
      this.mode = GAME_MODES[(GAME_MODES.indexOf(this.mode) + 1) % GAME_MODES.length]; this.render();
    });
    if (this.mode === 'cpu') this.button(640, 630, 200, 'CPU: ' + GAME_CONFIG.CPU_DIFFICULTY[this.difficulty].label, () => this.cycleDifficulty());
    this.button(468, 630, 116, 'Volver', () => this.back());
    this.button(826, 630, 156, 'Continuar', () => this.confirm(), true);
  }
  private renderStages(fresh: boolean, changed: boolean): void {
    this.title.setText('ELIGE EL ESCENARIO');
    this.steps.setText('Luchadores ✓   /   Escenario');
    this.help.setText('Flechas / W A S D  Escenario     Enter  Confirmar combate     Esc  Volver a luchadores');
    const stage = GAME_CONFIG.STAGES[this.stageIndex];
    // Wide window onto the arena: the camera pans slowly inside it instead of squashing the image.
    const source = this.textures.get(stage.textureKey).getSourceImage(), fit = 650 / source.width, band = 174 / fit;
    const image = this.place(this.add.image(890, 218, stage.textureKey));
    const window = this.rectangle(890, 218, 650, 174, 0x000000, 0).setStrokeStyle(2, 0xa1ece5);
    if (band < source.height) {
      const pan = (f: number) => {
        const top = (source.height - band) * f;
        image.setCrop(0, top, source.width, band);
        image.setPosition(890 + this.pointerX * 5, 218 - (top + band / 2 - source.height / 2) * fit);
      };
      image.setScale(fit); pan(0.5);
      this.live.push(t => pan(0.5 + Math.sin(t * 0.35) * 0.3));
    } else image.setDisplaySize(650, 174);
    const name = this.text(58, 137, stage.name, 35, '#fae8cb', false, true).setWordWrapWidth(450);
    // A new arena swings open like a door, around its vertical axis.
    if (fresh || changed) {
      this.enter([image, window], { scaleX: 0.04 }, { duration: 340, ease: 'Back.easeOut', delay: fresh ? 120 : 0 });
      this.enter([name], { x: -28, alpha: 0 }, { duration: 300, delay: fresh ? 120 : 0 });
    }
    this.text(60, 214, rosterEntry(this.playerChoice.characterId).name, 20, '#ef9dbb');
    this.text(60, 245, 'vs. ' + rosterEntry(this.opponentChoice.characterId).name, 20, '#a1ece5');
    this.text(60, 280, this.mode === 'cpu' ? 'Combate contra CPU · ' + GAME_CONFIG.CPU_DIFFICULTY[this.difficulty].label : this.mode === 'versus' ? 'Dos jugadores' : 'Muñeco de práctica', 17, '#c9b8da');
    GAME_CONFIG.STAGES.forEach((entry, i) => {
      const x = 230 + (i % 3) * 410, y = 386 + Math.floor(i / 3) * 142, selected = this.stageIndex === i;
      let thumb!: Phaser.GameObjects.Image, border!: Phaser.GameObjects.Rectangle;
      const tile = this.collect(() => {
        thumb = this.place(this.add.image(x, y - 13, entry.textureKey).setDisplaySize(360, 102));
        this.rectangle(x, y + 45, 360, 32, 0x14101e, 0.96);
        this.text(x, y + 33, entry.name, 18, selected ? '#a1ece5' : '#fae8cb', true);
        border = this.rectangle(x, y, 360, 124, 0x000000, 0).setStrokeStyle(selected ? 4 : 1, selected ? 0xa1ece5 : 0x726182);
        this.clickable(border, () => { this.stageIndex = i; this.render(); });
        if (selected) {
          this.pulseBorder(border, 4, 0xa1ece5);
          this.text(x - 172, y - 54, 'Elegido', 14, '#241a35').setBackgroundColor('#a1ece5').setPadding(7, 3);
        }
      });
      // Tiles flip up one after another; the newly chosen one pops forward.
      if (fresh) this.enter(tile, { scaleY: 0.04, alpha: 0 }, { duration: 400, delay: 160 + i * 55, ease: 'Back.easeOut' });
      else if (selected && changed) this.enter([thumb, border], { scaleX: 0.9, scaleY: 0.9 }, { duration: 260, ease: 'Back.easeOut' });
    });
    this.button(164, 630, 216, 'Luchadores', () => this.back());
    this.button(1072, 630, 288, '¡A pelear!', () => this.confirm(), true);
  }
  private renderVersus(): void {
    this.title.setText('COMBATE LISTO'); this.steps.setText('Luchadores ✓   /   Escenario ✓');
    this.help.setText('Esc  Volver a la selección');
    const stage = GAME_CONFIG.STAGES[this.stageIndex];
    const arena = this.place(this.add.image(640, 370, stage.textureKey).setDisplaySize(1280, 540).setAlpha(0.45));
    this.enter([arena], { scaleX: 1.2, scaleY: 1.2, alpha: 0 }, { duration: 950 });
    // Both fighters charge in from their corners and stop face to face.
    for (const player of [true, false]) {
      const choice = player ? this.playerChoice : this.opponentChoice, x = player ? 330 : 950;
      const fighter = this.collect(() => {
        this.pedestal(x, 568, 300, player ? 0xef709d : 0xa1ece5, true);
        this.preview(x, 570, 0.5, choice, !player);
      });
      this.enter(fighter, { x: player ? -560 : 560 }, { duration: 420, ease: 'Back.easeOut' });
    }
    const names = this.collect(() => {
      this.text(310, 145, rosterEntry(this.playerChoice.characterId).name.toUpperCase(), 52, '#ef9dbb', true, true);
      this.text(970, 145, rosterEntry(this.opponentChoice.characterId).name.toUpperCase(), 52, '#a1ece5', true, true);
      this.text(310, 207, '1P', 21, '#fae8cb', true);
      this.text(970, 207, MODE_LABELS[this.mode], 21, '#fae8cb', true);
    });
    this.enter(names, { y: -46, alpha: 0 }, { duration: 340, delay: 140 });
    this.slamTitle(640, 270, 'VS', 112, {}, { from: 3.4, delay: 240, shake: 0.011, volume: 0.85 });
    if (this.motion) {
      // A blade of light crosses the screen as the VS lands.
      const slash = this.add.rectangle(-300, 360, 150, 1200, 0xffffff, 0.22).setAngle(24).setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
      this.extras.push(slash);
      this.tweens.add({ targets: slash, x: 1600, duration: 460, delay: 300, ease: 'Cubic.easeIn' });
    }
    const banner = this.collect(() => {
      this.rectangle(640, 622, 680, 50, 0x14101e, 0.95);
      this.text(640, 606, stage.name, 26, '#fae8cb', true);
    });
    this.enter(banner, { y: 50, alpha: 0 }, { duration: 320, delay: 320 });
  }
  private navigate(delta: number): void {
    if (this.phase === 'versus') return;
    playUiSound(this, 'menu-move', 0.4);
    if (this.phase === 'stage') this.stageIndex = (this.stageIndex + delta + GAME_CONFIG.STAGES.length) % GAME_CONFIG.STAGES.length;
    else { this.cycleFighter(delta, false); return; }
    this.render();
  }
  private cycleFighter(delta: number, sound = true): void {
    if (this.phase !== 'fighters') return;
    if (sound) playUiSound(this, 'menu-move', 0.4);
    const choice = this.activeSide === 'player' ? this.playerChoice : this.opponentChoice;
    const index = FIGHTER_ROSTER.findIndex(f => f.id === choice.characterId);
    choice.characterId = FIGHTER_ROSTER[(index + delta + FIGHTER_ROSTER.length) % FIGHTER_ROSTER.length].id;
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
  /** Easy → Normal → Hard → Easy. Only on the fighter screen and against the CPU. */
  private cycleDifficulty(): void {
    if (this.phase !== 'fighters' || this.mode !== 'cpu') return;
    this.difficulty = CPU_DIFFICULTIES[(CPU_DIFFICULTIES.indexOf(this.difficulty) + 1) % CPU_DIFFICULTIES.length];
    this.render();
  }
  private back(): void {
    if (this.phase === 'fighters') { this.scene.start('MenuScene', this.matchData()); return; }
    this.transition?.remove(); this.transition = undefined;
    this.phase = this.phase === 'versus' ? 'stage' : 'fighters'; this.render();
  }
  private matchData() {
    return { manifest: this.manifest, stageIndex: this.stageIndex, mode: this.mode, difficulty: this.difficulty,
      playerChoice: { ...this.playerChoice }, opponentChoice: { ...this.opponentChoice } };
  }
}
