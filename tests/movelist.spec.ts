import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

async function openMoveList(page: Page) {
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').selectedIndex)).toBe(4);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').moveListOpen)).toBe(true);
  return page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => {
      if (!c.visible) return;
      if (typeof c.text === 'string') texts.push(c.text);
      if (c.list) walk(c.list);
    });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts.join('\n');
  });
}

test('the pause menu lists each fighter\'s moves and power from the key map, and Esc goes back', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar');
  const text = await openMoveList(page);
  expect(text).toContain('MOVIMIENTOS');
  expect(text).toContain('Puño suave');
  expect(text).toMatch(/Puño suave\s*\n?.*J/);
  expect(text).toContain('Canto sónico');
  expect(text).toContain('Furia del i30');
  expect(text).toContain('TILIN');
  expect(text).toContain('CÉSAR');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').moveListOpen)).toBe(false);
  expect(await page.evaluate(() => (window as any).__game.scene.isActive('PauseScene'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('PauseScene'))).toBe(false);
});
