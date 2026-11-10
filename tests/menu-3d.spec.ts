import { test, expect, Page } from '@playwright/test';

async function menu(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
}

const state = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('MenuScene');
  return {
    introDone: s.introDone as boolean,
    titleScale: s.title.lines.map((line: any) => line.scale) as number[],
    titleAlpha: s.title.lines.map((line: any) => line.alpha) as number[],
    rowScaleY: s.rows.map((row: any) => row.scaleY) as number[],
    heroTurn: s.hero.modelRotation ? s.hero.modelRotation.y - Math.PI : null,
    heroAlpha: s.hero.alpha as number,
    zoom: s.cameras.main.zoom as number,
    embers: s.children.list.filter((c: any) => c.name === 'menu-embers').map((c: any) => c.visible) as boolean[],
  };
});

test('the intro animates in and settles on the final layout', async ({ page }) => {
  await menu(page);
  await page.mouse.move(640, 360);
  await expect.poll(async () => (await state(page)).introDone, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await state(page)).zoom, { timeout: 15000 }).toBeCloseTo(1, 2);
  await expect.poll(async () => Math.abs((await state(page)).heroTurn ?? 0), { timeout: 15000 }).toBeLessThan(0.02);
  const s = await state(page);
  expect(s.titleScale).toEqual([1, 1]);
  expect(s.titleAlpha).toEqual([1, 1]);
  expect(s.heroAlpha).toBe(1);
  s.rowScaleY.forEach(scale => expect(scale).toBeGreaterThan(0.99));
  expect(s.embers).toEqual([true, true]);
});

test('the fighter turns in 3D toward the pointer', async ({ page }) => {
  await menu(page);
  test.skip((await state(page)).heroTurn === null, 'Canvas renderer draws the fighter flat');
  await page.mouse.move(640, 360);
  await expect.poll(async () => Math.abs((await state(page)).heroTurn!), { timeout: 15000 }).toBeLessThan(0.02);
  await page.mouse.move(1260, 360);
  await expect.poll(async () => (await state(page)).heroTurn!).toBeGreaterThan(0.2);
  await page.mouse.move(20, 360);
  await expect.poll(async () => (await state(page)).heroTurn!).toBeLessThan(-0.2);
});

test('reduced motion shows the finished menu at once and navigates without a transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await menu(page);
  const s = await state(page);
  expect(s.introDone).toBe(true);
  expect(s.titleScale).toEqual([1, 1]);
  expect(s.rowScaleY).toEqual([1, 1, 1]);
  expect(s.zoom).toBe(1);
  expect(s.embers).toEqual([false, false]);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'), undefined, { timeout: 1000 });
});

test('confirming twice during the exit transition opens the next screen only once', async ({ page }) => {
  await menu(page);
  await page.evaluate(() => {
    const game = (window as any).__game;
    (window as any).__starts = 0;
    game.scene.getScene('SelectionScene').events.on('create', () => { (window as any).__starts++; });
    const s = game.scene.getScene('MenuScene');
    s.options[0].action(); s.options[1].action();
  });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => ({ starts: (window as any).__starts, gallery: (window as any).__game.scene.isActive('CharacterTestScene') })))
    .toEqual({ starts: 1, gallery: false });
});
