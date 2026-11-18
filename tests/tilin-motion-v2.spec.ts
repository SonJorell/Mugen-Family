import { test, expect } from '@playwright/test';
import { startFight } from './fight-helper';

test('Tilin moves continuously through airborne pose changes instead of teleporting her body', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const transitions = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const surface = s.add.renderTexture(0, 0, 1280, 720).setVisible(false);
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const visibleCenter = async () => {
      const actor = s.children.getByName('super-cinematic').getByName('drive-victim');
      surface.clear().draw(actor, actor.x, actor.y);
      const image = await new Promise<HTMLImageElement>(resolve => surface.snapshot(resolve));
      context.clearRect(0, 0, 1280, 720);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 1280, 720).data;
      let totalX = 0, totalY = 0, count = 0;
      for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
        if (pixels[(y * 1280 + x) * 4 + 3] <= 64) continue;
        totalX += x; totalY += y; count++;
      }
      return { x: totalX / count, y: totalY / count, count };
    };
    const results = [];
    try {
      for (const fromRight of [false, true]) {
        // These adjacent instants reproduced visible body jumps in flight and after the car hit.
        for (const beforeTime of [700, 850, 3633]) {
          s.superMove.cancel();
          s.player.resetForRound(fromRight ? 1320 : 600); s.opponent.resetForRound(fromRight ? 1205 : 715);
          s.superMove.start(s.player, s.opponent);
          s.superMove.update(beforeTime);
          const before = await visibleCenter();
          s.superMove.update(1);
          const after = await visibleCenter();
          results.push({ fromRight, beforeTime, before, after,
            jump: Math.hypot(after.x - before.x, after.y - before.y) });
        }
      }
    } finally {
      surface.destroy();
      s.superMove.cancel();
    }
    return results;
  });
  for (const transition of transitions) {
    expect(transition.before.count, 'the preceding body drawing is visible').toBeGreaterThan(2000);
    expect(transition.after.count, 'the following body drawing is visible').toBeGreaterThan(2000);
    expect.soft(transition.jump,
      `one millisecond must not move the visible body abruptly: ${JSON.stringify(transition)}`)
      .toBeLessThanOrEqual(12);
  }
});
