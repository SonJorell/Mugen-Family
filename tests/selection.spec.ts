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

test('keyboard selects both fighters and a stage before starting the match', async ({ page }) => {
  await openSelection(page);
  // Arrows move the active side's cursor over the faces; Tab hands the cursor to the rival.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  const match = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { data: s.getMatchData(), playerTint: s.player.sprite.tintTopLeft, opponentTint: s.opponent.sprite.tintTopLeft };
  });
  // Different fighters need no tint to be told apart.
  expect(match.data.playerChoice).toEqual({ characterId: 'cesar', paletteId: 'original' });
  expect(match.data.opponentChoice).toEqual({ characterId: 'tilin', paletteId: 'original' });
  expect(match.data.stageIndex).toBe(5);
  expect(match.playerTint).toBe(0xffffff); expect(match.opponentTint).toBe(0xffffff);
});

test('mouse selection and back navigation retain arena and practice mode, and a mirror match tints the rival', async ({ page }) => {
  await openSelection(page);
  // 2×2 buttons: Rival · CPU on top, Volver · Continuar below.
  await page.mouse.click(524, 528);
  await page.mouse.click(756, 584);
  await page.mouse.click(640, 370);
  await page.keyboard.press('Escape');
  await page.mouse.click(756, 584);
  await page.mouse.click(1080, 630);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  const data = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').getMatchData());
  expect(data.mode).toBe('training'); expect(data.stageIndex).toBe(1);
  expect(data.playerChoice).toEqual({ characterId: 'tilin', paletteId: 'original' });
  expect(data.opponentChoice).toEqual({ characterId: 'tilin', paletteId: 'amethyst' });
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
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice.characterId)).toBe('cesar');
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
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').getMatchData().playerChoice.characterId)).toBe('cesar');
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
    return [s.playerChoice.characterId, s.stageIndex];
  });
  expect(selection).toEqual(['cesar', 1]);
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

test('each fighter rises large from a bottom corner and the centre grid has one face per fighter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSelection(page);
  const screen = () => page.evaluate(() => {
    const game = (window as any).__game, s = game.scene.getScene('SelectionScene');
    const named = (prefix: string) => s.content.list.filter((o: any) => o.name?.startsWith(prefix));
    return {
      roster: named('selection-face-').map((o: any) => o.name.replace('selection-face-', '')),
      faces: named('selection-face-').map((o: any) => ({ x: o.x, y: o.y, size: o.displayWidth })),
      portraits: named('selection-portrait-').map((o: any) => ({ name: o.name, key: o.texture.key, x: o.x, height: o.displayHeight, flipX: o.flipX })),
      player: s.playerChoice.characterId, opponent: s.opponentChoice.characterId,
      labels: s.content.list.map((o: any) => o.text).filter(Boolean),
    };
  });
  const first = await screen();
  expect(first.roster.length).toBeGreaterThanOrEqual(2);
  expect(first.roster).toContain('tilin'); expect(first.roster).toContain('cesar');
  // Faces sit between the two corners; the portraits are several times larger and face each other.
  for (const face of first.faces) { expect(face.x).toBeGreaterThan(440); expect(face.x).toBeLessThan(840); }
  expect(first.portraits.map(p => p.name)).toEqual(['selection-portrait-player', 'selection-portrait-opponent']);
  expect(first.portraits[0].x).toBeLessThan(440); expect(first.portraits[1].x).toBeGreaterThan(840);
  expect(first.portraits[0].height).toBeGreaterThan(first.faces[0].size * 6);
  // No colour picker: nothing on the screen offers a palette.
  expect(first.labels.some((label: string) => /Color|Amatista|Menta|Coral/.test(label))).toBe(false);
  expect(first.portraits.map(p => p.flipX)).toEqual([false, true]);
  // Clicking a face picks that fighter for the active side and swaps the large art.
  const cesar = first.faces[first.roster.indexOf('cesar')];
  await page.mouse.click(cesar.x, cesar.y);
  const second = await screen();
  expect(second.player).toBe('cesar'); expect(second.opponent).toBe('tilin');
  expect(second.portraits[0].key).toBe('menu_cesar_3d'); expect(second.portraits[1].key).toBe('menu_tilin_3d');
});
