import Phaser from 'phaser';

const instances = new WeakMap<Phaser.Game, GameAudio>();
type MusicSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

/** One music voice per game, including across scene restarts. Effects remain independent. */
export class GameAudio {
  private music?: MusicSound;
  muted = false;
  volume = 0.35;
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
    } catch { /* Audio still works when browser storage is unavailable. */ }
    game.events.once(Phaser.Core.Events.DESTROY, () => this.stop());
  }
  play(key: 'music-menu' | 'music-fight'): void {
    if (!this.game.cache.audio.exists(key)) return;
    if (this.music?.key === key && !this.music.pendingRemove) { this.resume(); return; }
    this.stop();
    this.music = this.game.sound.add(key, { loop: true, volume: this.volume, mute: this.muted }) as MusicSound;
    this.music.play();
  }
  pause(): void { this.music?.pause(); }
  resume(): void {
    if (this.music?.isPaused) this.music.resume();
    else if (this.music && !this.music.isPlaying) this.music.play();
  }
  stop(): void { this.music?.destroy(); this.music = undefined; }
  toggle(): void { this.muted = !this.muted; this.applySettings(); }
  changeVolume(delta: number): void {
    this.volume = Math.round(Phaser.Math.Clamp(this.volume + delta, 0, 0.7) * 100) / 100;
    this.applySettings();
  }
  private applySettings(): void {
    this.music?.setMute(this.muted);
    this.music?.setVolume(this.volume);
    try { localStorage.setItem('tilin-audio', JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* Optional persistence. */ }
    this.game.events.emit('music-settings');
  }
}

export function musicControls(scene: Phaser.Scene, x = 1250, y = 24): void {
  const audio = GameAudio.for(scene);
  const style = { fontFamily: 'Trebuchet MS, Arial', fontSize: '16px', color: '#fae8cb', backgroundColor: '#241a35', padding: { x: 8, y: 6 } };
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
