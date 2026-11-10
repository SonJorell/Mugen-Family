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
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT');
  await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

/**
 * Starts a heavy punch, presses light punch `msBeforeEnd` before its recovery ends, then keeps
 * stepping the player. Returns every attack the player started after the heavy punch.
 */
async function pressDuringRecovery(page: Page, msBeforeEnd: number) {
  return page.evaluate(msBeforeEnd => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const f = s.player;
    f.x = 200; s.opponent.x = 1700;             // keep the swing from connecting
    f.executeAttack('HEAVY_PUNCH');
    const d = f.currentAttackDef;
    const totalMs = (d.startup + d.active + d.recovery) * 1000 / 60;
    const pressAt = totalMs - msBeforeEnd;
    let t = 0, pressed = false;
    const started: string[] = [];
    let last = 'HEAVY_PUNCH';
    for (let i = 0; i < 80; i++) {
      const press = !pressed && t >= pressAt;
      if (press) pressed = true;
      f.input.getState = () => ({ lightPunch: press });
      f.update(16); t += 16;
      const now = f.combatState.state === 'ATTACKING' ? f.combatState.getAnimationName() : 'NONE';
      if (now !== last && now !== 'NONE') started.push(now);
      last = now;
    }
    return started;
  }, msBeforeEnd);
}

test('a light punch pressed just before a heavy punch ends comes out once, as soon as it ends', async ({ page }) => {
  await fight(page);
  expect(await pressDuringRecovery(page, 70)).toEqual(['LIGHT_PUNCH']);
});

test('a press made well before the move ends is dropped, not stored indefinitely', async ({ page }) => {
  await fight(page);
  expect(await pressDuringRecovery(page, 300)).toEqual([]);
});
