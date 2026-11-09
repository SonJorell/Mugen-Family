import { Page } from '@playwright/test';

/** Complete the real selection UI for combat-focused tests. */
export async function confirmSelection(page: Page) {
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  const phase = await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').phase);
  if (phase === 'fighters') {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
}
