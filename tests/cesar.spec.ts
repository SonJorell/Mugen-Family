import { test, expect } from '@playwright/test';
test('César can be picked with E, is bigger and sturdier, and his close grab opens the i30 super', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const pc = await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice);
  expect(pc.characterId).toBe('cesar');
  // A passive target makes the opener observable; CPU defense is covered separately.
  await page.mouse.click(640, 565);
  // Wait for each screen instead of sleeping: a slow frame used to swallow the second Enter.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  const r = await page.evaluate(() => { const s = (window as any).__game.scene.getScene('FightScene');
    return { anims: s.registry2.getAvailable().length, hp: s.player.maxHealth, scaleP: s.player.sprite.scaleX, scaleO: s.opponent.sprite.scaleX, key: s.player.sprite.texture.key }; });
  expect(r.anims).toBe(23); expect(r.hp).toBe(125); expect(r.key.startsWith('cesar_')).toBe(true);
  expect(Math.abs(r.scaleP)).toBeGreaterThan(Math.abs(r.scaleO));
  await page.keyboard.press('k'); await page.waitForTimeout(260);
  await page.waitForTimeout(900);
  await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d');
  await page.keyboard.press('i'); await page.waitForTimeout(330);
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.finishRound('IDLE'); s.opponent.finishRound('IDLE');
    s.player.x = 700; s.opponent.x = 815;
    s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
    s.player.gainEnergy(100);
  });
  await page.keyboard.press('o', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').superMove.active);
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').superMove.sound?.key)).toBe('super-drive');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.energy)).toBe(0);
  expect(errors).toEqual([]);
});
