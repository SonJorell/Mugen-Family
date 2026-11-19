import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

/** Starts a running (not stepped) two-player fight and waits for FIGHT. */
async function versusFight(page: Page) {
  await startFight(page, 'tilin', 'cesar', { mode: 'versus' });
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
}

const positions = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('FightScene');
  return { p1: s.player.x, p2: s.opponent.x, p1Attack: s.player.combatState.attackName, p2Attack: s.opponent.combatState.attackName };
});

async function hold(page: Page, key: string, ms = 350) {
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}

test('selection cycles CPU → Práctica → Jugador 2 and starts a two-player match', async ({ page }) => {
  await bootGame(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  const mode = () => page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').mode);
  await page.mouse.click(524, 528); await expect.poll(mode).toBe('training');
  await page.mouse.click(524, 528); await expect.poll(mode).toBe('versus');
  const labels = await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').content.list.map((c: any) => c.text).filter(Boolean));
  expect(labels).toContain('Rival: Jugador 2');
  expect(labels).not.toContain('CPU: Normal');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  const fight = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { human: typeof s.opponent.processInput === 'function', think: typeof s.opponent.think, footer: s.children.getByName('fight-controls') };
  });
  expect(fight.human).toBe(true);
  expect(fight.think).toBe('undefined');
  // The fight shows no keyboard footer; the keys live in the pause menu.
  expect(fight.footer).toBeNull();
});

test('each player moves and attacks with their own keys; the arrows belong to player 2 only', async ({ page }) => {
  await versusFight(page);
  let before = await positions(page);
  await hold(page, 'ArrowLeft');
  let after = await positions(page);
  expect(after.p2).toBeLessThan(before.p2 - 20);
  expect(Math.abs(after.p1 - before.p1)).toBeLessThan(2);

  before = after;
  await hold(page, 'd');
  after = await positions(page);
  expect(after.p1).toBeGreaterThan(before.p1 + 20);

  // Keep each press across a rendered frame: Phaser clears JustDown on keyup.
  await page.keyboard.press('Insert', { delay: 60 });
  await expect.poll(async () => (await positions(page)).p2Attack).toBe('LIGHT_PUNCH');
  await page.waitForTimeout(400);
  await page.keyboard.press('j', { delay: 60 });
  await expect.poll(async () => (await positions(page)).p1Attack).toBe('LIGHT_PUNCH');
});

test('playing alone, the arrows still move player 1', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  const before = await positions(page);
  await hold(page, 'ArrowRight');
  expect((await positions(page)).p1).toBeGreaterThan(before.p1 + 20);
});

test('two gamepads drive player 1 and player 2', async ({ page }) => {
  // Fake standard gamepads behind navigator.getGamepads before the game boots.
  await page.addInitScript(() => {
    const makePad = (index: number) => ({
      id: `Test pad ${index}`, index, connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0], vibrationActuator: null,
    });
    const pads = [makePad(0), makePad(1)];
    (window as any).__pads = pads;
    (window as any).__press = (pad: number, button: number, down: boolean) => {
      // Phaser ignores pad data older than the pad itself, so stamp it like a real browser does.
      pads[pad].buttons[button] = { pressed: down, touched: down, value: down ? 1 : 0 }; pads[pad].timestamp = performance.now();
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
    window.addEventListener('load', () => pads.forEach(pad => {
      const event = new Event('gamepadconnected') as any; event.gamepad = pad; window.dispatchEvent(event);
    }));
  });
  await versusFight(page);
  await page.waitForFunction(() => (window as any).__game.input.gamepad?.total >= 2 || !!(window as any).__game.scene.getScene('FightScene').input.gamepad.getPad(1));
  const before = await positions(page);
  await page.evaluate(() => (window as any).__press(0, 15, true));      // pad 1: d-pad right
  await page.waitForTimeout(350);
  await page.evaluate(() => (window as any).__press(0, 15, false));
  expect((await positions(page)).p1).toBeGreaterThan(before.p1 + 20);
  await page.evaluate(() => (window as any).__press(1, 2, true));       // pad 2: X → light punch
  await expect.poll(async () => (await positions(page)).p2Attack).toBe('LIGHT_PUNCH');
  await page.evaluate(() => (window as any).__press(1, 2, false));
  await page.evaluate(() => (window as any).__press(0, 9, true));       // pad 1: Start → pause
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
});

test('the pause move list shows both players\' keys in a two-player match', async ({ page }) => {
  await versusFight(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').showMoveList(true));
  const text = await page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => { if (!c.visible) return; if (typeof c.text === 'string') texts.push(c.text); if (c.list) walk(c.list); });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts;
  });
  expect(text).toContain('JUGADOR 1');
  expect(text).toContain('JUGADOR 2');
  expect(text).toContain('Insert / Num 4');
  expect(text).toContain('J');
  // Player 1 lost the arrows to player 2.
  expect(text).toContain('A D');
  // Page 2 (COMBOS) also uses P2's own keys for the second fighter.
  await page.keyboard.press('ArrowRight');
  const combosText = await page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => { if (!c.visible) return; if (typeof c.text === 'string') texts.push(c.text); if (c.list) walk(c.list); });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts.join('\n');
  });
  expect(combosText).toContain('TILIN · J1');
  expect(combosText).toContain('CÉSAR · J2');
  expect(combosText).toContain('Insert → Supr → Fin');
});
