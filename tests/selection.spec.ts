import { test, expect, Page } from '@playwright/test';

async function openSelection(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('SelectionScene'))).toBe(true);
}

test('keyboard selects both fighter colors and a stage before starting the match', async ({ page }) => {
  await openSelection(page);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  const match = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { data: s.getMatchData(), playerTint: s.player.sprite.tintTopLeft, opponentTint: s.opponent.sprite.tintTopLeft };
  });
  expect(match.data.playerChoice).toEqual({ characterId: 'tilin', paletteId: 'mint' });
  expect(match.data.opponentChoice).toEqual({ characterId: 'tilin', paletteId: 'coral' });
  expect(match.data.stageIndex).toBe(5);
  expect(match.playerTint).toBe(0xa5e0d4); expect(match.opponentTint).toBe(0xf2b8ad);
});

test('mouse selection and back navigation retain colors, arena and practice mode', async ({ page }) => {
  await openSelection(page);
  await page.mouse.click(230, 550);
  await page.mouse.click(1046, 550);
  await page.mouse.click(640, 565);
  await page.mouse.click(1080, 630);
  await page.mouse.click(640, 370);
  await page.keyboard.press('Escape');
  await page.mouse.click(1080, 630);
  await page.mouse.click(1080, 630);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  const data = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').getMatchData());
  expect(data.mode).toBe('training'); expect(data.stageIndex).toBe(1);
  expect(data.playerChoice.paletteId).toBe('amethyst'); expect(data.opponentChoice.paletteId).toBe('mint');
});

test('returning to menu preserves the selection and holding Enter does not skip screens', async ({ page }) => {
  await openSelection(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  await page.keyboard.down('Enter'); await page.keyboard.down('Enter');
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SelectionScene');
    return (window as any).__game.scene.isActive('SelectionScene') && s.phase;
  })).toBe('fighters');
  await page.keyboard.up('Enter');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice.paletteId)).toBe('amethyst');
});

test('restart and changing selection preserve the selected matchup', async ({ page }) => {
  await openSelection(page);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').selectedIndex)).toBe(1);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene') && (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').getMatchData().playerChoice.paletteId)).toBe('amethyst');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').selectedIndex)).toBe(i + 1);
  }
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('SelectionScene'))).toBe(true);
  const selection = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SelectionScene');
    return [s.playerChoice.paletteId, s.stageIndex];
  });
  expect(selection).toEqual(['amethyst', 1]);
});

test('cancelling the versus screen prevents the pending fight from starting', async ({ page }) => {
  await openSelection(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'versus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1300);
  const state = await page.evaluate(() => ({
    phase: (window as any).__game.scene.getScene('SelectionScene').phase,
    selection: (window as any).__game.scene.isActive('SelectionScene'),
    fight: (window as any).__game.scene.isActive('FightScene'),
  }));
  expect(state).toEqual({ phase: 'stage', selection: true, fight: false });
});
