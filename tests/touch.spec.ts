import { test, expect, Page, CDPSession } from '@playwright/test';
import { startFight } from './fight-helper';

/** Real touch events through Chromium (Playwright's tap releases in the same frame). */
async function touch(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page);
}
const down = (cdp: CDPSession, points: { x: number; y: number; id: number }[]) =>
  cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
const up = (cdp: CDPSession) => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

const state = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('FightScene');
  return { x: s.player.x, attack: s.player.combatState.attackName, jumping: !s.player.isGrounded,
    visible: s.touchControls?.visible ?? null, footer: s.children.getByName('fight-controls').visible };
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('on-screen buttons move, jump and attack, and several fingers work at once', async ({ page }) => {
    await startFight(page, 'tilin', 'cesar', { mode: 'training' });
    await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
    const s0 = await state(page);
    expect(s0.visible).toBe(true);
    expect(s0.footer).toBe(false);
    const cdp = await touch(page);

    // Hold ▶ (pad x 190 + 88, y 575).
    await down(cdp, [{ x: 278, y: 575, id: 1 }]);
    await page.waitForTimeout(400);
    await up(cdp);
    expect((await state(page)).x).toBeGreaterThan(s0.x + 20);

    // PS (1000, 560) → light punch.
    await down(cdp, [{ x: 1000, y: 560, id: 2 }]);
    await expect.poll(async () => (await state(page)).attack).toBe('LIGHT_PUNCH');
    await up(cdp);
    await page.waitForTimeout(400);

    // Two fingers: hold ◀ and press ▲ at the same time.
    const before = (await state(page)).x;
    await down(cdp, [{ x: 102, y: 575, id: 3 }]);
    await page.waitForTimeout(120);
    await down(cdp, [{ x: 102, y: 575, id: 3 }, { x: 190, y: 487, id: 4 }]);
    await expect.poll(async () => (await state(page)).jumping).toBe(true);
    await page.waitForTimeout(250);
    await up(cdp);
    expect((await state(page)).x).toBeLessThan(before - 20);
  });

  test('a key press hides the buttons and the next touch brings them back', async ({ page }) => {
    await startFight(page, 'tilin', 'tilin', { mode: 'training' });
    await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
    await page.keyboard.press('d', { delay: 60 });
    await expect.poll(async () => (await state(page)).visible).toBe(false);
    expect((await state(page)).footer).toBe(true);
    const cdp = await touch(page);
    await down(cdp, [{ x: 640, y: 400, id: 1 }]);
    await up(cdp);
    await expect.poll(async () => (await state(page)).visible).toBe(true);
  });

  test('the DS button and a double tap on the pad dash', async ({ page }) => {
    await startFight(page, 'tilin', 'cesar', { mode: 'training' });
    await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.player.x = 600; s.opponent.x = 1200;
      (window as any).__game.loop.start((window as any).__game.loop.callback);
    });
    const dashing = () => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.combatState.state === 'DASHING');
    const cdp = await touch(page);
    // DS sits left of KS: (1000 − 104, 560 + 104).
    await down(cdp, [{ x: 896, y: 664, id: 1 }]);
    await expect.poll(dashing).toBe(true);
    await up(cdp);
    await page.waitForTimeout(500);
    // Double tap on ▶.
    await down(cdp, [{ x: 278, y: 575, id: 2 }]); await page.waitForTimeout(50); await up(cdp);
    await page.waitForTimeout(60);
    await down(cdp, [{ x: 278, y: 575, id: 3 }]);
    await expect.poll(dashing).toBe(true);
    await up(cdp);
  });

  test('the buttons stay clear of the HUD', async ({ page }) => {
    await startFight(page, 'tilin', 'tilin', { mode: 'training' });
    const tops = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').children.list
      .filter((c: any) => c.name?.startsWith('touch-')).map((c: any) => c.y - c.radius));
    expect(tops.length).toBe(11);
    expect(Math.min(...tops)).toBeGreaterThan(260);
  });

  test('player 2 keyboard input in versus mode does not hide player 1 touch controls', async ({ page }) => {
    await startFight(page, 'tilin', 'cesar', { mode: 'versus' });
    await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
    expect((await state(page)).visible).toBe(true);
    await page.keyboard.press('ArrowLeft', { delay: 60 });
    await page.keyboard.press('Insert', { delay: 60 });
    expect((await state(page)).visible).toBe(true);
    await page.keyboard.press('d', { delay: 60 });
    await expect.poll(async () => (await state(page)).visible).toBe(false);
  });
});

test('without a touch screen there are no on-screen buttons', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const s = await state(page);
  expect(s.visible).toBeNull();
  expect(s.footer).toBe(true);
});
