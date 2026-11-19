import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

/** Which track the menu screens play: the supplied song or the original synthesized one. */
export type MenuTrack = 'cinturao' | 'original';

const instances = new WeakMap<Phaser.Game, GameAudio>();
type MusicSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
type SongState = 'idle' | 'loading' | 'ready' | 'failed';
/** A supplied MP3 that loads in the background; LOOP_START/LOOP_END skip silence at its ends. */
interface Song { KEY: string; URL: string; LOOP_START?: number; LOOP_END?: number }

/** One music voice per game, including across scene restarts. Effects remain independent. */
export class GameAudio {
  private music?: MusicSound;
  /** Marker the current music loops on, when it does not loop as a whole. */
  private marker?: string;
  menuTrack: MenuTrack = 'cinturao';
  /** The song a screen asked for while it was still loading. */
  private waitingFor?: Song;
  private songState = new Map<string, SongState>();
  muted = false;
  volume = 0.35;
  /** Overall level for music and effects (Phaser's global sound volume), 0–1. */
  masterVolume = 1;
  /** Level of the announcer voice, 0–1, applied on top of the overall level. */
  announcerVolume = 1;
  /** Level of hits, interface and super effects, 0–1, applied on top of the overall level. */
  sfxVolume = 1;
  /**
   * Sets the overall level. Phaser's Web Audio setter schedules the change with setValueAtTime,
   * which a suspended AudioContext (a reloaded page before the first key press) never applies:
   * the saved level was lost until then. Writing the gain's value as well applies it at once.
   */
  private applyMaster(): void {
    this.game.sound.volume = this.masterVolume;
    const node = (this.game.sound as Partial<Phaser.Sound.WebAudioSoundManager>).masterVolumeNode;
    if (node) node.gain.value = this.masterVolume;
  }

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
    this.applyMaster();
    this.scaleByCategory(game.sound);
    game.events.once(Phaser.Core.Events.DESTROY, () => this.stop());
  }
  /**
   * Menus play «Cinturão de Elite» (unless Configuración picks the original track) and fights play
   * «Hardline Beatdown»; each falls back to its synthesized track if the MP3 fails to load.
   */
  play(key: 'music-menu' | 'music-fight'): void {
    this.waitingFor = undefined;
    const song = key === 'music-fight' ? GAME_CONFIG.FIGHT_MUSIC : this.menuTrack === 'cinturao' ? GAME_CONFIG.MENU_MUSIC : undefined;
    const state = song ? this.state(song) : 'failed';
    if (!song || state === 'failed') { this.start(key); return; }
    if (state === 'ready') { this.start(song.KEY); return; }
    // Not loaded yet: stop the previous music and start the song as soon as it arrives.
    if (this.music?.key !== song.KEY) this.stop();
    this.waitingFor = song;
    this.loadSong(song);
  }

  /** The key the menu screens are playing (or about to play). */
  get menuMusicKey(): string {
    return this.menuTrack === 'cinturao' && this.state(GAME_CONFIG.MENU_MUSIC) !== 'failed' ? GAME_CONFIG.MENU_MUSIC.KEY : 'music-menu';
  }

  private state(song: Song): SongState { return this.songState.get(song.KEY) ?? 'idle'; }

  private fallbackFor(song: Song): string { return song.KEY === GAME_CONFIG.FIGHT_MUSIC.KEY ? 'music-fight' : 'music-menu'; }

  private start(key: string): void {
    if (!this.game.cache.audio.exists(key)) return;
    if (this.music?.key === key && !this.music.pendingRemove) { this.resume(); return; }
    this.stop();
    const config = { loop: true, volume: this.volume, mute: this.muted };
    this.music = this.game.sound.add(key, config) as MusicSound;
    const song: Song | undefined = [GAME_CONFIG.MENU_MUSIC, GAME_CONFIG.FIGHT_MUSIC].find(s => s.KEY === key);
    if (song?.LOOP_START !== undefined && song.LOOP_END !== undefined) {
      // Loop only the audible part, so the silence at both ends never makes a gap.
      const { LOOP_START, LOOP_END } = song;
      this.marker = 'loop';
      this.music.addMarker({ name: 'loop', start: LOOP_START, duration: LOOP_END - LOOP_START, config });
      this.music.play('loop');
    } else {
      this.marker = undefined;
      this.music.play();
    }
  }

  /** Loads a song with whichever scene is running; a scene change just retries later. */
  private loadSong(song: Song): void {
    const state = this.state(song);
    if (state === 'loading' || state === 'ready') return;
    // The newest running scene: the loading screen may be on its way out when the menu asks.
    const scene = [...this.game.scene.getScenes(true)].reverse().find(s => s.load && s.scene.key !== 'PreloadScene' && s.scene.key !== 'BootScene');
    // A scene still in create() is not running yet: try again on the next step.
    if (!scene) { this.game.events.once(Phaser.Core.Events.POST_STEP, () => this.loadSong(song)); return; }
    const { KEY, URL } = song;
    if (this.game.cache.audio.exists(KEY)) { this.onSongReady(song); return; }
    this.songState.set(KEY, 'loading');
    const done = () => { cleanup(); this.onSongReady(song); };
    const failed = (file: Phaser.Loader.File) => {
      if (file.key !== KEY) return;
      cleanup();
      this.songState.set(KEY, 'failed');
      if (this.waitingFor === song) { this.waitingFor = undefined; this.start(this.fallbackFor(song)); }
    };
    const aborted = () => {
      cleanup();
      if (this.state(song) !== 'loading') return;
      this.songState.set(KEY, 'idle');
      // The scene closed mid-download: carry on with whichever scene comes next.
      if (this.waitingFor === song) this.game.events.once(Phaser.Core.Events.POST_STEP, () => this.loadSong(song));
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

  private onSongReady(song: Song): void {
    this.songState.set(song.KEY, 'ready');
    if (this.waitingFor === song) { this.waitingFor = undefined; this.start(song.KEY); }
    // With the menu song in, the fight song downloads in the background, ready for the first fight.
    if (song !== GAME_CONFIG.FIGHT_MUSIC) this.loadSong(GAME_CONFIG.FIGHT_MUSIC);
  }

  /** Switches the menu track and, if a menu track is playing, changes it right away. */
  toggleMenuTrack(): void {
    const playingMenu = this.music?.key === 'music-menu' || this.music?.key === GAME_CONFIG.MENU_MUSIC.KEY || this.waitingFor === GAME_CONFIG.MENU_MUSIC;
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
    this.applyMaster();
    try {
      localStorage.setItem('tilin-audio', JSON.stringify({ muted: this.muted, volume: this.volume, master: this.masterVolume, announcer: this.announcerVolume, sfx: this.sfxVolume, menuTrack: this.menuTrack }));
    } catch { /* Optional persistence. */ }
    this.game.events.emit('music-settings');
  }
}

