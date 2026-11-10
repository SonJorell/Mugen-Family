import { test, expect, Page } from '@playwright/test';

async function openSelection(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
}

/** Position, scale and alpha of everything in the selectable content, in creation order. */
const layout = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('SelectionScene');
  const round = (n: number) => Math.round(n * 100) / 100;
  return s.content.list.filter((o: any) => o.type !== 'Ellipse' && o.type !== 'Image')
    .map((o: any) => [o.type, round(o.x), round(o.y), round(o.scaleX), round(o.scaleY), round(o.alpha)]);
});
const tweens = (page: Page) => page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').tweens.getTweens().length);

test('selection entrances settle on the same layout that reduced motion shows at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSelection(page);
  expect(await tweens(page)).toBe(0);
  const still = { fighters: await layout(page), stage: [] as unknown[] };
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  expect(await tweens(page)).toBe(0);
  still.stage = await layout(page);
  await page.keyboard.press('Escape');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  expect(await tweens(page)).toBeGreaterThan(5);
  // Only the endless VS pulse remains once the entrances finish.
  await expect.poll(() => tweens(page), { timeout: 15000 }).toBeLessThanOrEqual(1);
  expect(await layout(page)).toEqual(still.fighters);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  await expect.poll(() => tweens(page), { timeout: 15000 }).toBe(0);
  expect(await layout(page)).toEqual(still.stage);
});

test('choices made in the middle of an entrance are not lost', async ({ page }) => {
  await openSelection(page);
  // No waiting: every key lands while the previous screen is still animating.
  await page.keyboard.press('e');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const s = await page.evaluate(() => {
    const scene = (window as any).__game.scene.getScene('SelectionScene');
    return { phase: scene.phase, player: scene.playerChoice, stage: scene.stageIndex };
  });
  expect(s).toEqual({ phase: 'stage', player: { characterId: 'cesar', paletteId: 'amethyst' }, stage: 4 });
});

test('the versus screen shows a 3D VS and leaves nothing behind when cancelled', async ({ page }) => {
  await openSelection(page);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'versus');
  const extras = () => page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').extras.length);
  expect(await extras()).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'fighters');
  // Back on the fighters screen only its own VS title remains outside the content.
  expect(await extras()).toBe(1);
  const stray = await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').children.list
    .filter((o: any) => o.type === 'Container' && o.depth === 26).length);
  expect(stray).toBe(1);
});
