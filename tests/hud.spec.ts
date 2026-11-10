import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function fight(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.mouse.click(640, 565); // Rival: CPU → Práctica
  await confirmSelection(page);
}
/** Screen-pinned banner lettering currently alive in the fight (Title3D containers). */
const banners = (page: Page) => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').children.list
  .filter((o: any) => o.type === 'Container' && o.scrollFactorX === 0 && o.list.some((c: any) => c.type === 'Text'))
  .map((o: any) => o.list[o.list.length - 1].text as string));

test('round and fight banners announce the start and clean up without delaying the fight', async ({ page }) => {
  await fight(page);
  await expect.poll(() => banners(page), { timeout: 10000 }).toContain('ROUND 1');
  await expect.poll(() => banners(page), { timeout: 10000 }).toContain('¡PELEA!');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
  await expect.poll(() => banners(page), { timeout: 10000 }).toEqual([]);
});

test('the health bar drops at once, leaves a trail that catches up and warns when low', async ({ page }) => {
  await fight(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
  const result = await page.evaluate(() => {
    const game = (window as any).__game; game.loop.stop();
    const s = game.scene.getScene('FightScene'), bar = s.hud.opponentBar;
    for (let i = 0; i < 120; i++) bar.update(16);                    // let the opening fill finish
    const full = { shown: bar.shown, trail: bar.trailRatio, value: bar.valueText.text };
    bar.setHealth(40); bar.update(16);
    const hit = { shown: bar.shown, trail: bar.trailRatio, value: bar.valueText.text };
    for (let i = 0; i < 20; i++) bar.update(16);                     // still inside the trail delay
    const waiting = bar.trailRatio;
    for (let i = 0; i < 200; i++) bar.update(16);
    const settled = { shown: bar.shown, trail: bar.trailRatio, danger: bar.danger.alpha };
    bar.setHealth(20); let danger = 0;
    for (let i = 0; i < 60; i++) { bar.update(16); danger = Math.max(danger, bar.danger.alpha); }
    return { full, hit, waiting, settled, danger };
  });
  expect(result.full).toEqual({ shown: 1, trail: 1, value: '100' });
  expect(result.hit).toEqual({ shown: 0.4, trail: 1, value: '40' });
  expect(result.waiting).toBe(1);
  expect(result.settled).toEqual({ shown: 0.4, trail: 0.4, danger: 0 });
  expect(result.danger).toBeGreaterThan(0.3);
});

test('the countdown ring follows the clock and turns urgent in the last ten seconds', async ({ page }) => {
  await fight(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
  const result = await page.evaluate(() => {
    const game = (window as any).__game; game.loop.stop();
    const timer = game.scene.getScene('FightScene').hud.timer;
    timer.setTime(57); const calm = [timer.text.text, timer.text.style.color];
    timer.setTime(9.2); const urgent = [timer.text.text, timer.text.style.color];
    timer.setTime(-3); const over = timer.text.text;
    return { calm, urgent, over };
  });
  expect(result).toEqual({ calm: ['57', '#ffffff'], urgent: ['10', '#ff5a5a'], over: '00' });
});

// Best of 3: each case is the deciding round (one round already won each way; the double K.O. at the round cap).
for (const [name, health, verdict, wins, round] of [
  ['a win', [100, 0], '¡VICTORIA!', { player: 1, opponent: 0 }, 2],
  ['a loss', [0, 100], 'DERROTA', { player: 0, opponent: 1 }, 2],
  ['a double K.O.', [0, 0], 'EMPATE', { player: 1, opponent: 1 }, 5],
] as const) {
  test(`${name} in the deciding round shows K.O. and then ${verdict}`, async ({ page }) => {
    await fight(page);
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
    await page.evaluate(([[player, opponent], wins, round]) => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.roundSystem._wins = { ...wins }; s.roundSystem._round = round;
      s.player.currentHealth = player; s.opponent.currentHealth = opponent;
    }, [health, wins, round] as const);
    await expect.poll(() => banners(page), { timeout: 10000 }).toContain('K.O.');
    await expect.poll(() => banners(page), { timeout: 10000 }).toContain(verdict);
    await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'), null, { timeout: 20000 });
  });
}

test('a round that does not decide the match shows the round winner and the score, then the next round', async ({ page }) => {
  await fight(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
  await page.evaluate(() => { (window as any).__game.scene.getScene('FightScene').opponent.currentHealth = 0; });
  await expect.poll(() => banners(page), { timeout: 10000 }).toContain('K.O.');
  await expect.poll(() => banners(page), { timeout: 10000 }).toContain('ROUND TUYO');
  await expect.poll(() => banners(page), { timeout: 15000 }).toContain('ROUND 2');
});
