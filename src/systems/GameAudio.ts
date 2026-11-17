import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { FONT_UI } from '../ui/fonts';

/** Which track the menu screens play: the supplied song or the original synthesized one. */
export type MenuTrack = 'cinturao' | 'original';

const instances = new WeakMap<Phaser.Game, GameAudio>();
type MusicSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

/** One music voice per game, including across scene restarts. Effects remain independent. */
export class GameAudio {
  private music?: MusicSound;
  /** Marker the current music loops on, when it does not loop as a whole. */
  private marker?: string;
  menuTrack: MenuTrack = 'cinturao';
  /** The menu asked for music while the song was still loading. */
  private waitingForMenuSong = false;
  private menuSongState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  muted = false;
  volume = 0.35;
  /** Overall level for music and effects (Phaser's global sound volume), 0–1. */
  masterVolume = 1;
  /** Level of the announcer voice, 0–1, applied on top of the overall level. */
  announcerVolume = 1;
  /** Level of hits, interface and super effects, 0–1, applied on top of the overall level. */
  sfxVolume = 1;
  static for(scene: Phaser.Scene): GameAudio {
    let audio = instances.get(scene.game);
    if (!audio) { audio = new GameAudio(scene.game); instances.set(scene.game, audio); }
    return audio;
  }
  private constructor(private game: Phaser.Game) {
    try {
      const settings = JSON.parse(localStorage.getItem('tilin-audio') ?? '{}');
      this.muted = settings.muted === true;
      if (Number.isFinite(settings.volume)) this.volume = Phaser.Math.Clamp(settings.volume, 0, 0.7);
      if (Number.isFinite(settings.master)) this.masterVolume = Phaser.Math.Clamp(settings.master, 0, 1);
      if (Number.isFinite(settings.announcer)) this.announcerVolume = Phaser.Math.Clamp(settings.announcer, 0, 1);
      if (Number.isFinite(settings.sfx)) this.sfxVolume = Phaser.Math.Clamp(settings.sfx, 0, 1);
      if (settings.menuTrack === 'original' || settings.menuTrack === 'cinturao') this.menuTrack = settings.menuTrack;
    } catch { /* Audio still works when browser storage is unavailable. */ }
    game.sound.volume = this.masterVolume;
    this.scaleByCategory(game.sound);
    game.events.once(Phaser.Core.Events.DESTROY, () => this.stop());
  }
  play(key: 'music-menu' | 'music-fight'): void {
    this.waitingForMenuSong = false;
    if (key === 'music-menu' && this.menuTrack === 'cinturao' && this.menuSongState !== 'failed') {
      if (this.menuSongState === 'ready') { this.start(GAME_CONFIG.MENU_MUSIC.KEY); return; }
      // Not loaded yet: stop the fight music and start the song as soon as it arrives.
      if (this.music?.key !== GAME_CONFIG.MENU_MUSIC.KEY) this.stop();
      this.waitingForMenuSong = true;
      this.loadMenuSong();
      return;
    }
    this.start(key);
  }

  /** The key the menu screens are playing (or about to play). */
  get menuMusicKey(): string {
    return this.menuTrack === 'cinturao' && this.menuSongState !== 'failed' ? GAME_CONFIG.MENU_MUSIC.KEY : 'music-menu';
  }

  private start(key: string): void {
    if (!this.game.cache.audio.exists(key)) return;
    if (this.music?.key === key && !this.music.pendingRemove) { this.resume(); return; }
    this.stop();
    const config = { loop: true, volume: this.volume, mute: this.muted };
    this.music = this.game.sound.add(key, config) as MusicSound;
    if (key === GAME_CONFIG.MENU_MUSIC.KEY) {
      // Loop only the audible part, so the silence at both ends never makes a gap.
      const { LOOP_START, LOOP_END } = GAME_CONFIG.MENU_MUSIC;
      this.marker = 'loop';
      this.music.addMarker({ name: 'loop', start: LOOP_START, duration: LOOP_END - LOOP_START, config });
      this.music.play('loop');
    } else {
      this.marker = undefined;
      this.music.play();
    }
  }

  /** Loads the menu song with whichever scene is running; a scene change just retries later. */
  private loadMenuSong(): void {
    if (this.menuSongState === 'loading' || this.menuSongState === 'ready') return;
    // The newest running scene: the loading screen may be on its way out when the menu asks.
    const scene = [...this.game.scene.getScenes(true)].reverse().find(s => s.load && s.scene.key !== 'PreloadScene' && s.scene.key !== 'BootScene');
    // A scene still in create() is not running yet: try again on the next step.
    if (!scene) { this.game.events.once(Phaser.Core.Events.POST_STEP, () => this.loadMenuSong()); return; }
    const { KEY, URL } = GAME_CONFIG.MENU_MUSIC;
    if (this.game.cache.audio.exists(KEY)) { this.onMenuSongReady(); return; }
    this.menuSongState = 'loading';
    const done = () => { cleanup(); this.onMenuSongReady(); };
    const failed = (file: Phaser.Loader.File) => {
      if (file.key !== KEY) return;
      cleanup();
      this.menuSongState = 'failed';
      if (this.waitingForMenuSong) { this.waitingForMenuSong = false; this.start('music-menu'); }
    };
    const aborted = () => {
      cleanup();
      if (this.menuSongState !== 'loading') return;
      this.menuSongState = 'idle';
      // The scene closed mid-download: carry on with whichever scene comes next.
      if (this.waitingForMenuSong) this.game.events.once(Phaser.Core.Events.POST_STEP, () => this.loadMenuSong());
    };
    const cleanup = () => {
      scene.load.off(`filecomplete-audio-${KEY}`, done);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, aborted);
    };
    scene.load.once(`filecomplete-audio-${KEY}`, done);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, aborted);
    scene.load.audio(KEY, URL);
    scene.load.start();
  }

  private onMenuSongReady(): void {
    this.menuSongState = 'ready';
    if (this.waitingForMenuSong) { this.waitingForMenuSong = false; this.start(GAME_CONFIG.MENU_MUSIC.KEY); }
  }

  /** Switches the menu track and, if a menu track is playing, changes it right away. */
  toggleMenuTrack(): void {
    const playingMenu = this.music?.key === 'music-menu' || this.music?.key === GAME_CONFIG.MENU_MUSIC.KEY || this.waitingForMenuSong;
    this.menuTrack = this.menuTrack === 'cinturao' ? 'original' : 'cinturao';
    this.applySettings();
    if (playingMenu) this.play('music-menu');
  }
  pause(): void { this.music?.pause(); }
  resume(): void {
    if (this.music?.isPaused) this.music.resume();
    else if (this.music && !this.music.isPlaying) this.music.play(this.marker ?? '');
  }
  stop(): void { this.music?.destroy(); this.music = undefined; }
  toggle(): void { this.muted = !this.muted; this.applySettings(); }
  changeVolume(delta: number): void {
    this.volume = Math.round(Phaser.Math.Clamp(this.volume + delta, 0, 0.7) * 100) / 100;
    this.applySettings();
  }
  /** Extra gain for a sound key: the announcer and the effects follow their own volume. */
  gainFor(key: string): number {
    return key.startsWith('announcer-') ? this.announcerVolume : key.startsWith('music-') ? 1 : this.sfxVolume;
  }

  changeSfxVolume(delta: number): void {
    this.sfxVolume = Math.round(Phaser.Math.Clamp(this.sfxVolume + delta, 0, 1) * 100) / 100;
    this.applySettings();
  }

  /**
   * Every sound in the game goes through the global manager's play/add, so the per-category volume
   * is applied once here instead of at each call site.
   */
  private scaleByCategory(manager: Phaser.Sound.BaseSoundManager): void {
    const play = manager.play.bind(manager), add = manager.add.bind(manager);
    const scaled = (key: string, config?: Phaser.Types.Sound.SoundConfig) =>
      key.startsWith('music-') ? config : { ...(config ?? {}), volume: (config?.volume ?? 1) * this.gainFor(key) };
    manager.play = ((key: string, extra?: Phaser.Types.Sound.SoundConfig | Phaser.Types.Sound.SoundMarker) =>
      play(key, extra && 'name' in extra ? extra : scaled(key, extra as Phaser.Types.Sound.SoundConfig))) as typeof manager.play;
    manager.add = ((key: string, config?: Phaser.Types.Sound.SoundConfig) => add(key, scaled(key, config))) as typeof manager.add;
  }

  changeAnnouncerVolume(delta: number): void {
    this.announcerVolume = Math.round(Phaser.Math.Clamp(this.announcerVolume + delta, 0, 1) * 100) / 100;
    this.applySettings();
  }

  changeMasterVolume(delta: number): void {
    this.masterVolume = Math.round(Phaser.Math.Clamp(this.masterVolume + delta, 0, 1) * 100) / 100;
    this.applySettings();
  }
  private applySettings(): void {
    this.music?.setMute(this.muted);
    this.music?.setVolume(this.volume);
    this.game.sound.volume = this.masterVolume;
    try {
      localStorage.setItem('tilin-audio', JSON.stringify({ muted: this.muted, volume: this.volume, master: this.masterVolume, announcer: this.announcerVolume, sfx: this.sfxVolume, menuTrack: this.menuTrack }));
    } catch { /* Optional persistence. */ }
    this.game.events.emit('music-settings');
  }
}

export function musicControls(scene: Phaser.Scene, x = 1250, y = 24): void {
  const audio = GameAudio.for(scene);
  const style = { fontFamily: FONT_UI, fontSize: '16px', color: '#fae8cb', backgroundColor: '#241a35', padding: { x: 8, y: 6 } };
  const label = scene.add.text(x - 62, y, '', style).setOrigin(1, 0).setDepth(240).setScrollFactor(0)
    .setInteractive({ useHandCursor: true }).on('pointerdown', () => audio.toggle());
  const refresh = () => label.setText(audio.muted ? 'M · Música apagada' : `M · Música ${Math.round(audio.volume * 100)}%`);
  refresh();
  scene.add.text(x - 52, y, '−', style).setDepth(240).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => audio.changeVolume(-0.1));
  scene.add.text(x - 19, y, '+', style).setDepth(240).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => audio.changeVolume(0.1));
  scene.input.keyboard?.on('keydown-M', (e: KeyboardEvent) => { if (!e.repeat) audio.toggle(); });
  scene.input.keyboard?.on('keydown-COMMA', () => audio.changeVolume(-0.1));
  scene.input.keyboard?.on('keydown-PERIOD', () => audio.changeVolume(0.1));
  scene.game.events.on('music-settings', refresh);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off('music-settings', refresh));
}
