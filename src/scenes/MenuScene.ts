import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { SpriteSheetOptions } from '../animation/SpriteSheetLoader';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FighterChoice, FIGHTER_ROSTER, fighterPalette, normalizeChoice } from '../config/roster';
import { manifestKey } from '../config/characters';

interface MenuManifest {
  assetPath: string;
  animations: Record<string, string[]>;
  spriteSheet?: SpriteSheetOptions;
}

/** Layered Arica title scene. Art responds to the pointer; controls stay still. */
export class MenuScene extends Phaser.Scene {
  private manifest!: MenuManifest;
  private selectedIndex = 0;
  private selectedStageIndex = 0;
  private mode: 'cpu' | 'training' = 'cpu';
  private rows: Phaser.GameObjects.Container[] = [];
  private menuItems: Phaser.GameObjects.Text[] = [];
  private rowBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private coast!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private pointerX = 0;
  private pointerY = 0;
  private viewX = 0;
  private viewY = 0;
  private elapsed = 0;
  private reducedMotion = false;
  private playerChoice = normalizeChoice();
  private opponentChoice = normalizeChoice(undefined, 'amethyst');

  private get options() {
    const stage = GAME_CONFIG.STAGES[this.selectedStageIndex].name;
    return [
      { label: 'Elegir luchadores', action: () => this.goTo('SelectionScene') },
      { label: 'Escenario  ·  ' + stage, action: () => this.goTo('SelectionScene', 'stage') },
      { label: 'Rival  ·  ' + (this.mode === 'cpu' ? 'CPU' : 'Muñeco de práctica'), action: () => this.toggleMode() },
      { label: 'Galería de movimientos', action: () => this.goTo('CharacterTestScene') },
      { label: 'Pantalla completa', action: () => this.toggleFullscreen() },
      { label: 'Ver colisiones  ·  ' + (GAME_CONFIG.DEBUG_MODE ? 'Sí' : 'No'), action: () => this.toggleDebug() },
    ];
  }

  constructor() { super({ key: 'MenuScene' }); }

  init(data: { manifest?: MenuManifest; stageIndex?: number; mode?: 'cpu' | 'training'; playerChoice?: FighterChoice; opponentChoice?: FighterChoice }): void {
    this.manifest = data?.manifest ?? this.cache.json.get(manifestKey(FIGHTER_ROSTER[0].id));
    this.selectedStageIndex = data?.stageIndex ?? this.selectedStageIndex;
    this.mode = data?.mode ?? this.mode;
    this.playerChoice = normalizeChoice(data?.playerChoice ?? this.playerChoice);
    this.opponentChoice = normalizeChoice(data?.opponentChoice ?? this.opponentChoice, 'amethyst');
    this.selectedIndex = 0;
    this.rows = []; this.menuItems = []; this.rowBackgrounds = [];
    this.pointerX = 0; this.pointerY = 0; this.viewX = 0; this.viewY = 0; this.elapsed = 0;
  }

  create(): void {
    isolateSceneKeyboard(this);
    const video = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (video) { video.pause(); video.style.display = 'none'; }
    this.drawBackground();
    this.add.text(68, 35, 'Creado por Jorell', { fontFamily: 'Trebuchet MS', fontSize: '17px', color: '#d3dce2' }).setDepth(10);
    this.add.text(69, 77, 'FIGHTER\nFAMILY', {
      fontFamily: 'Impact, Arial Black', fontSize: '98px', color: '#78472b', lineSpacing: -18,
      stroke: '#1a171a', strokeThickness: 5,
    }).setDepth(9);
    this.add.text(62, 69, 'FIGHTER\nFAMILY', {
      fontFamily: 'Impact, Arial Black', fontSize: '98px', color: '#ffffff', lineSpacing: -18,
      stroke: '#ffdfad', strokeThickness: 1,
    }).setTint(0xfff3d8, 0xfff3d8, 0xd99b58, 0xd99b58).setDepth(10);
    this.add.text(67, 278, 'Arica es tu escenario.', {
      fontFamily: 'Trebuchet MS', fontSize: '22px', color: '#f5bd75',
    }).setDepth(10);
    this.createHero();
    this.buildMenu();
    this.add.text(64, 682, '↑ ↓  Elegir    Enter  Confirmar    ← →  Escenario', {
      fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#d3dce2',
    }).setDepth(10);
    this.add.text(1214, 682, 'W / ↑ ×2  Doble salto     O  Canto sónico', {
      fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#d3dce2',
    }).setOrigin(1, 0).setDepth(10);
    GameAudio.for(this).play('music-menu');
    musicControls(this);

    for (const key of ['UP', 'W']) this.input.keyboard!.on('keydown-' + key, () => this.navigate(-1));
    for (const key of ['DOWN', 'S']) this.input.keyboard!.on('keydown-' + key, () => this.navigate(1));
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard!.on('keydown-' + key, (event: KeyboardEvent) => {
      if (!event.repeat) this.options[this.selectedIndex]?.action();
    });
    this.input.keyboard!.on('keydown-LEFT', () => { if (this.selectedIndex === 1) this.cycleStage(-1); });
    this.input.keyboard!.on('keydown-RIGHT', () => { if (this.selectedIndex === 1) this.cycleStage(1); });
    this.input.keyboard!.on('keydown-F11', () => this.toggleFullscreen());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refreshMotion = () => {
      this.reducedMotion = media.matches;
      if (this.reducedMotion) { this.viewX = 0; this.viewY = 0; this.elapsed = 0; this.positionArt(); }
    };
    refreshMotion(); media.addEventListener('change', refreshMotion);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerX = Phaser.Math.Clamp((pointer.x - 640) / 640, -1, 1);
      this.pointerY = Phaser.Math.Clamp((pointer.y - 360) / 360, -1, 1);
    });
    this.input.on('gameout', () => { this.pointerX = 0; this.pointerY = 0; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => media.removeEventListener('change', refreshMotion));
  }

  private drawBackground(): void {
    this.coast = this.add.image(640, 360, 'menu_arica_coast').setName('menu-coast').setDisplaySize(1324, 745);
    if (!this.textures.exists('menu_arica_shade')) {
      const texture = this.textures.createCanvas('menu_arica_shade', 1280, 720)!;
      const ctx = texture.context;
      const shade = ctx.createLinearGradient(0, 0, 1120, 0);
      shade.addColorStop(0, 'rgba(6,17,27,0.94)');
      shade.addColorStop(0.46, 'rgba(6,17,27,0.8)');
      shade.addColorStop(0.72, 'rgba(6,17,27,0.14)');
      shade.addColorStop(1, 'rgba(6,17,27,0)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, 1280, 720);
      const vignette = ctx.createLinearGradient(0, 540, 0, 720);
      vignette.addColorStop(0, 'rgba(6,17,27,0)'); vignette.addColorStop(1, 'rgba(6,17,27,0.9)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 540, 1280, 180);
      texture.refresh();
    }
    this.add.image(640, 360, 'menu_arica_shade').setDepth(2);
    this.add.rectangle(640, 695, 1280, 50, 0x08121b, 0.85).setDepth(8);
    this.add.rectangle(640, 670, 1152, 1, 0x9fe8e1, 0.25).setDepth(8);
  }

  private createHero(): void {
    this.shadow = this.add.ellipse(970, 641, 310, 28, 0x040b12, 0.55).setDepth(3);
    this.hero = this.add.image(970, 650, 'menu_tilin_3d').setName('menu-fighter').setOrigin(0.5, 1)
      .setDisplaySize(400, 600).setFlipX(true).setTint(fighterPalette(this.playerChoice).tint).setDepth(4);
    this.add.text(650, 123, 'TILIN', {
      fontFamily: 'Impact, Arial Black', fontSize: '66px', color: '#fff3d8', stroke: '#143a51', strokeThickness: 2,
    }).setDepth(12);
    this.add.text(654, 207, 'Haz que\nte escuchen.', {
      fontFamily: 'Trebuchet MS', fontSize: '23px', color: '#fff3d8', lineSpacing: 3,
      shadow: { offsetX: 1, offsetY: 2, color: '#08121b', blur: 6, fill: true },
    }).setDepth(12);
    this.add.text(654, 583, 'Canto sónico', { fontFamily: 'Trebuchet MS', fontSize: '23px', fontStyle: 'bold', color: '#9fe8e1' }).setDepth(13);
    this.add.text(654, 617, 'Tu voz daña\ny aturde.', { fontFamily: 'Trebuchet MS', fontSize: '17px', color: '#fff3d8' }).setDepth(13);
  }

  private buildMenu(): void {
    this.rows.forEach(row => row.destroy());
    this.rows = []; this.menuItems = []; this.rowBackgrounds = [];
    const positions = [352, 426, 477, 528, 579, 630];
    this.options.forEach((option, i) => {
      const row = this.add.container(64, positions[i]).setDepth(15);
      if (i === 0) row.add(this.add.rectangle(5, 6, 516, 64, 0x754a30).setOrigin(0, 0.5));
      const bg = this.add.rectangle(0, 0, 516, i === 0 ? 64 : 44, 0x143a51, 0.2).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(20, 0, option.label, {
        fontFamily: i === 0 ? 'Impact, Arial Black' : 'Trebuchet MS',
        fontSize: i === 0 ? '36px' : i === 1 ? '18px' : '21px', color: '#fae8cb',
      }).setOrigin(0, 0.5);
      row.add([bg, text]);
      if (i === 0) row.add(this.add.text(484, 0, '▶', { fontSize: '25px', color: '#241a35' }).setOrigin(1, 0.5));
      bg.on('pointerover', () => { this.selectedIndex = i; this.updateSelection(); });
      bg.on('pointerdown', () => { this.selectedIndex = i; this.options[i].action(); });
      this.rows.push(row); this.menuItems.push(text); this.rowBackgrounds.push(bg);
    });
    this.updateSelection();
  }

  private navigate(delta: number): void {
    this.selectedIndex = (this.selectedIndex + delta + this.options.length) % this.options.length;
    this.updateSelection();
  }
  private updateSelection(): void {
    this.rowBackgrounds.forEach((bg, i) => {
      const selected = i === this.selectedIndex;
      bg.setFillStyle(i === 0 ? 0xf5bd75 : 0x143a51, i === 0 ? 1 : selected ? 0.94 : 0.38);
      if (selected) bg.setStrokeStyle(2, 0x9fe8e1); else bg.setStrokeStyle();
      this.menuItems[i].setColor(i === 0 ? '#132938' : selected ? '#9fe8e1' : '#fff3d8');
    });
  }
  private cycleStage(direction: number): void {
    this.selectedStageIndex = (this.selectedStageIndex + direction + GAME_CONFIG.STAGES.length) % GAME_CONFIG.STAGES.length;
    this.buildMenu();
  }
  private toggleMode(): void { this.mode = this.mode === 'cpu' ? 'training' : 'cpu'; this.buildMenu(); }
  private toggleDebug(): void {
    GAME_CONFIG.DEBUG_MODE = !GAME_CONFIG.DEBUG_MODE; GAME_CONFIG.SHOW_DEBUG_TEXT = GAME_CONFIG.DEBUG_MODE; this.buildMenu();
  }
  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
  }
  private goTo(scene: string, selectionPhase: 'fighters' | 'stage' = 'fighters'): void {
    this.scene.start(scene, { manifest: this.manifest, stageIndex: this.selectedStageIndex, mode: this.mode,
      playerChoice: this.playerChoice, opponentChoice: this.opponentChoice, selectionPhase });
  }
  private positionArt(): void {
    const drift = this.reducedMotion ? 0 : Math.sin(this.elapsed / 9000) * 1.5;
    this.coast.setPosition(640 - this.viewX * 8 + drift, 360 - this.viewY * 5);
    this.hero.setPosition(970 - this.viewX * 24 + drift * 2, 650 - this.viewY * 8);
    this.shadow.setPosition(this.hero.x, this.hero.y - 9);
  }
  update(_time: number, delta: number): void {
    if (this.reducedMotion) return;
    const dt = Math.min(delta, 50), ease = 1 - Math.exp(-dt / 140);
    this.elapsed += dt;
    this.viewX = Phaser.Math.Linear(this.viewX, this.pointerX, ease);
    this.viewY = Phaser.Math.Linear(this.viewY, this.pointerY, ease);
    this.positionArt();
  }
}
