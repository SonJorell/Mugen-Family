import type Phaser from 'phaser';

/** Consume events once: Phaser can revisit the DOM queue before the next frame. */
export function isolateSceneKeyboard(scene: Phaser.Scene): void {
  const consume = (event: KeyboardEvent) => event.stopPropagation();
  scene.input.keyboard?.on('keydown', consume);
  scene.input.keyboard?.on('keyup', consume);
}
