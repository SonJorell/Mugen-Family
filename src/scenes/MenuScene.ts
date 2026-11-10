import Phaser from 'phaser';
import { CpuDifficulty, GAME_CONFIG, normalizeDifficulty } from '../config/gameConfig';
import { isolateSceneKeyboard } from '../input/SceneKeyboard';
import { SpriteSheetOptions } from '../animation/SpriteSheetLoader';
import { GameAudio, musicControls } from '../systems/GameAudio';
import { FighterChoice, FIGHTER_ROSTER, normalizeChoice, RosterEntry } from '../config/roster';
import { manifestKey, menuArtKey, playUiSound } from '../config/characters';
import { EmberField, GodRays, GroundPulse, Title3D } from '../ui/menu/MenuEffects';

interface MenuManifest {
  assetPath: string;
  animations: Record<string, string[]>;
  spriteSheet?: SpriteSheetOptions;
}

const HERO_X = 970, HERO_FOOT = 650, HERO_W = 400, HERO_H = 600;
/** Where the painted sun sits relative to the centre of the coast image. */
const SUN_OFFSET = { x: 128, y: -72 };
/** How long each fighter stays on the title screen before the next one turns in. */
const SHOWCASE_INTERVAL = 6500;

/**
 * Animated Arica title scene with a 3D look: a cinematic intro (camera dolly, title slam,
 * the fighter turning into place), perspective embers, sun rays and an extruded title.
 * Art responds to the pointer; the menu rows never move sideways so they stay easy to hit.
 */
export class MenuScene extends Phaser.Scene {
  private manifest!: MenuManifest;
  private selectedIndex = 0;
  private selectedStageIndex = 0;
  private mode: 'cpu' | 'training' = 'cpu';
  private difficulty: CpuDifficulty = GAME_CONFIG.DEFAULT_CPU_DIFFICULTY;
  private rows: Phaser.GameObjects.Container[] = [];
  private menuItems: Phaser.GameObjects.Text[] = [];
  private rowBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private coast!: Phaser.GameObjects.Image;
  /** A perspective plane in WebGL (so it can turn in 3D), a flat image in Canvas. */
  private hero!: Phaser.GameObjects.Plane | Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private title!: Title3D;
  private rays!: GodRays;
  private embersBack!: EmberField;
  private embersFront!: EmberField;
  private pulse!: GroundPulse;
  private cursor!: Phaser.GameObjects.Rectangle;
  /** Values the intro tweens toward zero; positionArt adds them on top of the parallax. */
  private intro = { spin: 0, rise: 0 };
  /** Roster in random order; the title screen cycles through it. */
  private showcase: RosterEntry[] = [];
  private showcaseIndex = 0;
  private heroTexts: Phaser.GameObjects.Text[] = [];
  private swapping = false;
  private introDone = false;
  private leaving = false;
  private pointerX = 0;
  private pointerY = 0;
  private viewX = 0;
  private viewY = 0;
  private elapsed = 0;
  private reducedMotion = false;
  private playerChoice = normalizeChoice();
  private opponentChoice = normalizeChoice(undefined, 'amethyst');

  // Arena and rival are chosen in the selection screen; audio and fullscreen live in Configuración.
  private get options() {
    return [
      { label: 'Elegir luchadores', action: () => this.goTo('SelectionScene') },
      { label: 'Galería de movimientos', action: () => this.goTo('CharacterTestScene') },
      { label: 'Configuración', action: () => this.goTo('SettingsScene') },
    ];
  }

  constructor() { super({ key: 'MenuScene' }); }

  init(data: { manifest?: MenuManifest; stageIndex?: number; mode?: 'cpu' | 'training'; difficulty?: string; playerChoice?: FighterChoice; opponentChoice?: FighterChoice }): void {
    this.manifest = data?.manifest ?? this.cache.json.get(manifestKey(FIGHTER_ROSTER[0].id));
    this.selectedStageIndex = data?.stageIndex ?? this.selectedStageIndex;
    this.mode = data?.mode ?? this.mode;
    this.difficulty = normalizeDifficulty(data?.difficulty ?? this.difficulty);
    this.playerChoice = normalizeChoice(data?.playerChoice ?? this.playerChoice);
    this.opponentChoice = normalizeChoice(data?.opponentChoice ?? this.opponentChoice, 'amethyst');
    this.selectedIndex = 0;
    this.rows = []; this.menuItems = []; this.rowBackgrounds = [];
    this.pointerX = 0; this.pointerY = 0; this.viewX = 0; this.viewY = 0; this.elapsed = 0;
    this.intro = { spin: 0, rise: 0 }; this.introDone = false; this.leaving = false;
    this.showcase = Phaser.Utils.Array.Shuffle([...FIGHTER_ROSTER]);
    this.showcaseIndex = 0; this.swapping = false;
  }
  /** Fighter currently shown on the title screen. */
  get featured(): RosterEntry { return this.showcase[this.showcaseIndex]; }

  create(): void {
    isolateSceneKeyboard(this);
    const video = document.getElementById('menu-video-bg') as HTMLVideoElement | null;
    if (video) { video.pause(); video.style.display = 'none'; }
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.drawBackground();
    const credit = this.add.text(68, 35, 'Creado por Jorell', { fontFamily: 'Trebuchet MS', fontSize: '17px', color: '#d3dce2' }).setDepth(10);
    this.title = new Title3D(this, 62, 69, ['FIGHTER', 'FAMILY'], 10);
    const tagline = this.add.text(67, 278, 'Arica es tu escenario.', {
      fontFamily: 'Trebuchet MS', fontSize: '22px', color: '#f5bd75',
    }).setDepth(10);
    const heroTexts = this.createHero();
    this.buildMenu();
    const hints = [
      this.add.text(64, 682, '↑ ↓  Elegir    Enter  Confirmar', {
        fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#d3dce2',
      }).setDepth(10),
      this.add.text(1214, 682, 'W / ↑ ×2  Doble salto     O  Poder especial', {
        fontFamily: 'Trebuchet MS', fontSize: '15px', color: '#d3dce2',
      }).setOrigin(1, 0).setDepth(10),
    ];
    this.embersBack = new EmberField(this, 70, 3, 1.4, 3.2);
    this.embersFront = new EmberField(this, 22, 14, 0.45, 1.3);
    this.pulse = new GroundPulse(this, 3);
    this.positionArt();
    if (this.reducedMotion) this.skipIntro(); else this.playIntro(credit, tagline, heroTexts, hints);
    this.time.addEvent({ delay: SHOWCASE_INTERVAL, loop: true, callback: () => this.nextFighter() });
    GameAudio.for(this).play('music-menu');
    musicControls(this);

    for (const key of ['UP', 'W']) this.input.keyboard!.on('keydown-' + key, () => this.navigate(-1));
    for (const key of ['DOWN', 'S']) this.input.keyboard!.on('keydown-' + key, () => this.navigate(1));
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard!.on('keydown-' + key, (event: KeyboardEvent) => {
      if (!event.repeat) this.options[this.selectedIndex]?.action();
    });
    this.input.keyboard!.on('keydown-F11', () => this.toggleFullscreen());
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refreshMotion = () => {
      this.reducedMotion = media.matches;
      if (this.reducedMotion) { this.skipIntro(); this.viewX = 0; this.viewY = 0; this.elapsed = 0; this.positionArt(); }
      this.setAmbientMotion(!this.reducedMotion);
    };
    refreshMotion(); media.addEventListener('change', refreshMotion);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerX = Phaser.Math.Clamp((pointer.x - 640) / 640, -1, 1);
      this.pointerY = Phaser.Math.Clamp((pointer.y - 360) / 360, -1, 1);
    });
    this.input.on('gameout', () => { this.pointerX = 0; this.pointerY = 0; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { media.removeEventListener('change', refreshMotion); this.pulse.stop(); });
  }

  private drawBackground(): void {
    this.coast = this.add.image(640, 360, 'menu_arica_coast').setName('menu-coast').setDisplaySize(1324, 745);
    this.rays = new GodRays(this, 1);
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

  private createHero(): Phaser.GameObjects.Text[] {
    this.shadow = this.add.ellipse(HERO_X, HERO_FOOT - 9, 310, 28, 0x040b12, 0.55).setDepth(3);
    const art = menuArtKey(this.featured.id);
    if (this.renderer.type === Phaser.WEBGL) {
      const plane = this.add.plane(HERO_X, HERO_FOOT - HERO_H / 2, art);
      plane.setViewHeight(HERO_H);
      this.hero = plane;
    } else {
      this.hero = this.add.image(HERO_X, HERO_FOOT, art).setOrigin(0.5, 1).setDisplaySize(HERO_W, HERO_H).setFlipX(true);
    }
    this.hero.setName('menu-fighter').setDepth(4);
    this.heroTexts = [
      this.add.text(650, 123, '', {
        fontFamily: 'Impact, Arial Black', fontSize: '66px', color: '#fff3d8', stroke: '#143a51', strokeThickness: 2,
      }).setDepth(12),
      this.add.text(654, 207, '', {
        fontFamily: 'Trebuchet MS', fontSize: '23px', color: '#fff3d8', lineSpacing: 3,
        shadow: { offsetX: 1, offsetY: 2, color: '#08121b', blur: 6, fill: true },
      }).setDepth(12),
      this.add.text(654, 583, '', { fontFamily: 'Trebuchet MS', fontSize: '23px', fontStyle: 'bold', color: '#9fe8e1' }).setDepth(13),
      this.add.text(654, 617, '', { fontFamily: 'Trebuchet MS', fontSize: '17px', color: '#fff3d8', wordWrap: { width: 230 } }).setDepth(13),
    ];
    this.describeFeatured();
    return this.heroTexts;
  }

  private describeFeatured(): void {
    const fighter = this.featured;
    const [name, motto, power, blurb] = this.heroTexts;
    name.setText(fighter.name.toUpperCase());
    motto.setText(fighter.motto);
    power.setText(fighter.power);
    blurb.setText(fighter.description.replace(/\n/g, ' '));
    if (this.hero.texture.key !== menuArtKey(fighter.id)) this.hero.setTexture(menuArtKey(fighter.id));
  }

  /** Turns the current fighter away in 3D and brings the next one of the shuffled roster in. */
  nextFighter(): void {
    if (this.leaving || this.swapping || this.showcase.length < 2) return;
    this.showcaseIndex = (this.showcaseIndex + 1) % this.showcase.length;
    if (this.reducedMotion || !this.introDone) { this.describeFeatured(); return; }
    this.swapping = true;
    playUiSound(this, 'menu-whoosh', 0.35);
    this.tweens.add({ targets: this.heroTexts, alpha: 0, duration: 220 });
    this.tweens.add({
      targets: this.intro, spin: Math.PI / 2, duration: 280, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.describeFeatured();
        this.intro.spin = -Math.PI / 2;
        this.burst(HERO_X, HERO_FOOT - 20);
        this.tweens.add({ targets: this.intro, spin: 0, duration: 520, ease: 'Back.easeOut', onComplete: () => { this.swapping = false; } });
        this.tweens.add({ targets: this.heroTexts, alpha: 1, duration: 320 });
      },
    });
    if (!(this.hero instanceof Phaser.GameObjects.Plane)) {
      this.tweens.add({ targets: this.hero, alpha: 0, duration: 260, yoyo: true, hold: 40 });
    }
  }

  /** Cinematic entrance, about 1.6 s. Input works from the first frame. */
  private playIntro(credit: Phaser.GameObjects.Text, tagline: Phaser.GameObjects.Text,
    heroTexts: Phaser.GameObjects.Text[], hints: Phaser.GameObjects.Text[]): void {
    const cam = this.cameras.main;
    cam.fadeIn(650, 6, 17, 27);
    cam.setZoom(1.16);
    this.tweens.add({ targets: cam, zoom: 1, duration: 1500, ease: 'Expo.easeOut' });
    // The fighter swings round in 3D and rises into her stance.
    this.intro = { spin: 1.25, rise: 46 };
    this.tweens.add({ targets: this.intro, spin: 0, duration: 1400, delay: 250, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.intro, rise: 0, duration: 900, delay: 250, ease: 'Back.easeOut' });
    this.hero.setAlpha(0);
    this.tweens.add({ targets: this.hero, alpha: 1, duration: 600, delay: 250 });
    // Title lines slam in from the screen towards their place, one after the other.
    this.title.lines.forEach((line, i) => {
      line.setScale(2.6).setAlpha(0);
      this.tweens.add({
        targets: line, scale: 1, alpha: 1, duration: 360, delay: 260 + i * 190, ease: 'Quart.easeIn',
        onComplete: () => {
          if (this.leaving) return;
          cam.shake(150, 0.0045 + i * 0.002); this.burst(line.x, line.y);
          playUiSound(this, 'menu-impact', 0.5 + i * 0.2);
        },
      });
    });
    const fadeUp = (targets: Phaser.GameObjects.Text[], delay: number) => targets.forEach((t, i) => {
      const y = t.y; t.setAlpha(0).setY(y + 14);
      this.tweens.add({ targets: t, alpha: 1, y, duration: 450, delay: delay + i * 80, ease: 'Cubic.easeOut' });
    });
    fadeUp([credit], 120);
    fadeUp([tagline], 760);
    fadeUp(heroTexts, 900);
    fadeUp(hints, 1250);
    // Menu rows flip open around their horizontal axis like cards.
    this.rows.forEach((row, i) => {
      row.setScale(1, 0).setAlpha(0);
      this.tweens.add({ targets: row, scaleY: 1, alpha: 1, duration: 420, delay: 820 + i * 110, ease: 'Back.easeOut' });
    });
    this.cursor.setAlpha(0);
    this.tweens.add({ targets: this.cursor, alpha: 1, duration: 300, delay: 1150 });
    this.time.delayedCall(1250, () => { this.introDone = true; this.updateSelection(); });
    this.setAmbientMotion(true);
  }

  /** Jumps straight to the final layout (reduced motion, or motion turned off mid-intro). */
  private skipIntro(): void {
    this.tweens.killAll();
    this.cameras.main.resetFX(); this.cameras.main.setZoom(1);
    this.intro = { spin: 0, rise: 0 }; this.swapping = false;
    this.children.list.forEach(child => {
      const obj = child as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject;
      if (obj.name !== 'menu-shine' && typeof obj.setAlpha === 'function' && !this.isEffect(child)) obj.setAlpha(1);
    });
    this.title.lines.forEach(line => line.setScale(1));
    this.rows.forEach(row => row.setScale(1));
    this.introDone = true;
    this.updateSelection();
  }

  private isEffect(child: Phaser.GameObjects.GameObject): boolean {
    return child === this.shadow || child === this.rays?.rays || child === this.rays?.glow || child.name === 'menu-embers'
      || child.name === 'menu-burst' || child.type === 'Ellipse';
  }

  /** Ambient life (embers, rays, floor pulses) only runs when motion is welcome. */
  private setAmbientMotion(on: boolean): void {
    this.embersBack?.setVisible(on); this.embersFront?.setVisible(on);
    this.pulse?.stop();
    if (on) this.pulse.start(() => ({ x: this.shadow.x, y: this.shadow.y }));
  }

  /** A quick ring of sparks where a title line lands. */
  private burst(x: number, y: number): void {
    const flash = this.add.image(x, y, 'menu_sun_glow').setDepth(9).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5, 0.18).setAlpha(0.9).setName('menu-burst');
    this.tweens.add({ targets: flash, scaleX: 1.9, scaleY: 0.5, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  }

  private buildMenu(): void {
    this.rows.forEach(row => row.destroy());
    this.rows = []; this.menuItems = []; this.rowBackgrounds = [];
    const positions = [380, 462, 520];
    this.cursor?.destroy();
    this.cursor = this.add.rectangle(52, positions[0], 6, 64, 0x9fe8e1, 1).setDepth(16)
      .setBlendMode(Phaser.BlendModes.ADD).setName('menu-cursor');
    this.options.forEach((option, i) => {
      const row = this.add.container(64, positions[i]).setDepth(15).setData('baseY', positions[i]);
      if (i === 0) row.add(this.add.rectangle(5, 6, 516, 64, 0x754a30).setOrigin(0, 0.5));
      const bg = this.add.rectangle(0, 0, 516, i === 0 ? 64 : 48, 0x143a51, 0.2).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(20, 0, option.label, {
        fontFamily: i === 0 ? 'Impact, Arial Black' : 'Trebuchet MS',
        fontSize: i === 0 ? '36px' : '23px', color: '#fae8cb',
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
    playUiSound(this, 'menu-move', 0.4);
    this.selectedIndex = (this.selectedIndex + delta + this.options.length) % this.options.length;
    this.updateSelection();
  }
  private updateSelection(): void {
    this.rowBackgrounds.forEach((bg, i) => {
      const selected = i === this.selectedIndex;
      bg.setFillStyle(i === 0 ? 0xf5bd75 : 0x143a51, i === 0 ? 1 : selected ? 0.94 : 0.38);
      if (selected) bg.setStrokeStyle(2, 0x9fe8e1); else bg.setStrokeStyle();
      this.menuItems[i].setColor(i === 0 ? '#132938' : selected ? '#9fe8e1' : '#fff3d8');
      const row = this.rows[i];
      // A light sweep runs across the chosen row (WebGL only; Canvas simply skips it).
      row.postFX?.clear();
      if (selected) row.postFX?.addShine(0.9, 0.18, 5);
      if (this.introDone && !this.reducedMotion) {
        this.tweens.killTweensOf(row);
        this.tweens.add({ targets: row, scale: selected ? 1.035 : 1, duration: 180, ease: 'Back.easeOut' });
      } else if (this.introDone) row.setScale(1);
    });
    const target = this.rows[this.selectedIndex];
    if (!this.cursor || !target) return;
    const height = this.selectedIndex === 0 ? 64 : 48, y = target.getData('baseY') as number;
    if (this.reducedMotion || !this.introDone) { this.cursor.setPosition(52, y).setScale(1, height / 64); return; }
    this.tweens.killTweensOf(this.cursor);
    this.tweens.add({ targets: this.cursor, y, scaleY: height / 64, duration: 200, ease: 'Cubic.easeOut' });
  }
  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
  }
  private goTo(scene: string, selectionPhase: 'fighters' | 'stage' = 'fighters'): void {
    if (this.leaving) return;
    this.leaving = true;
    const start = () => this.startScene(scene, selectionPhase);
    if (this.reducedMotion) { start(); return; }
    // Dive into the screen: quick push-in, flash and fade, then the next scene.
    const cam = this.cameras.main;
    const row = this.rows[this.selectedIndex];
    if (row) { this.tweens.killTweensOf(row); this.tweens.add({ targets: row, scale: 1.08, duration: 120, yoyo: true }); }
    playUiSound(this, 'menu-whoosh', 0.55);
    cam.flash(140, 255, 236, 200);
    this.tweens.add({ targets: cam, zoom: 1.22, duration: 300, ease: 'Cubic.easeIn' });
    cam.fadeOut(300, 6, 17, 27);
    this.time.delayedCall(310, start);
  }
  private startScene(scene: string, selectionPhase: 'fighters' | 'stage'): void {
    this.scene.start(scene, { manifest: this.manifest, stageIndex: this.selectedStageIndex, mode: this.mode, difficulty: this.difficulty,
      playerChoice: this.playerChoice, opponentChoice: this.opponentChoice, selectionPhase });
  }
  private positionArt(): void {
    const drift = this.reducedMotion ? 0 : Math.sin(this.elapsed / 9000) * 1.5;
    this.coast.setPosition(640 - this.viewX * 8 + drift, 360 - this.viewY * 5);
    this.rays?.place(this.coast.x + SUN_OFFSET.x, this.coast.y + SUN_OFFSET.y);
    const x = HERO_X - this.viewX * 24 + drift * 2, foot = HERO_FOOT - this.viewY * 8 + this.intro.rise;
    const breath = this.reducedMotion ? 0 : Math.sin(this.elapsed / 650);
    if (this.hero instanceof Phaser.GameObjects.Plane) {
      this.hero.setPosition(x, foot - HERO_H / 2);
      // Turn the fighter toward the pointer: real perspective, not a flat slide.
      this.hero.modelRotation.y = Math.PI + this.viewX * 0.32 + this.intro.spin;
      this.hero.modelRotation.x = -this.viewY * 0.08;
      this.hero.modelRotation.z = breath * 0.006;
    } else {
      this.hero.setPosition(x, foot);
    }
    this.shadow.setPosition(x - this.viewX * 10, HERO_FOOT - 9 - this.viewY * 8).setScale(1 + breath * 0.02, 1);
    this.title?.update(this.viewX, this.viewY);
  }
  update(_time: number, delta: number): void {
    if (this.reducedMotion) return;
    const dt = Math.min(delta, 50), ease = 1 - Math.exp(-dt / 140);
    this.elapsed += dt;
    this.viewX = Phaser.Math.Linear(this.viewX, this.pointerX, ease);
    this.viewY = Phaser.Math.Linear(this.viewY, this.pointerY, ease);
    this.positionArt();
    this.rays.update(dt);
    this.embersBack.update(dt, this.viewX, this.viewY);
    this.embersFront.update(dt, this.viewX, this.viewY);
  }
}
