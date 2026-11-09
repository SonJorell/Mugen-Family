import { test, expect, Page } from '@playwright/test';

async function menu(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
}

test('six arenas are reachable by grid navigation and the selected Arica image is used in combat', async ({ page }) => {
  await menu(page);
  await page.mouse.click(450, 426);
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  const index = () => page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').stageIndex);
  await page.keyboard.press('ArrowDown');
  await expect.poll(index).toBe(3);
  await page.keyboard.press('ArrowRight');
  await expect.poll(index).toBe(4);
  await page.keyboard.press('ArrowUp');
  await expect.poll(index).toBe(1);
  await page.mouse.click(1050, 370);
  await expect.poll(index).toBe(2);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  const background = () => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').stageBgImage.texture.key);
  await expect.poll(background).toBe('stage_arica_catedral');
  for (const key of ['stage_arena_urbana', 'stage_templo_antiguo', 'stage_azotea', 'stage_arica_morro', 'stage_arica_chinchorro']) {
    await page.keyboard.press('F2');
    await expect.poll(background).toBe(key);
  }
});

test('menu depth responds to the pointer while navigation stays fixed', async ({ page }) => {
  await menu(page);
  const positions = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('MenuScene');
    const background = s.children.getByName('menu-coast');
    const fighter = s.children.getByName('menu-fighter');
    return { background: background?.x, fighter: fighter?.x, row: s.rows[0].x };
  });
  await page.mouse.move(640, 360);
  await page.waitForTimeout(500);
  const before = await positions();
  expect(before.background).toBeDefined(); expect(before.fighter).toBeDefined();
  await page.mouse.move(1200, 160);
  await expect.poll(async () => Math.abs((await positions()).background - before.background)).toBeGreaterThan(3);
  await expect.poll(async () => Math.abs((await positions()).fighter - before.fighter)).toBeGreaterThan(8);
  expect((await positions()).row).toBe(before.row);
});

test('reduced motion disables menu parallax, including changes while open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await menu(page);
  const positions = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('MenuScene');
    return ['menu-coast', 'menu-fighter'].map(name => {
      const image = s.children.getByName(name); return image ? [image.x, image.y] : null;
    });
  });
  const before = await positions(); expect(before[0]).not.toBeNull();
  await page.mouse.move(1220, 140); await page.waitForTimeout(500);
  expect(await positions()).toEqual(before);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(positions).not.toEqual(before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(positions).toEqual(before);
});
