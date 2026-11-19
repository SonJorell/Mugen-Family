import { test, expect, Page } from '@playwright/test';
import { bootGame } from './fight-helper';

const controls = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('ControlsScene');
  return { slot: s.slot, index: s.selectedIndex, listening: s.listening, message: s.message, p1: s.bindings.p1, p2: s.bindings.p2 };
});

async function openControls(page: Page) {
  await bootGame(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ControlsScene'));
}

/** Moves the cursor to an action row (0 = Izquierda … 4 = Puño suave …). */
async function selectRow(page: Page, row: number) {
  const now = (await controls(page)).index;
  for (let i = now; i < row; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await controls(page)).index).toBe(row);
}

test('remapping refuses duplicates and reserved keys, saves the change and the fight uses it', async ({ page }) => {
  await openControls(page);
  await selectRow(page, 4);                                   // Puño suave
  await page.keyboard.press('Enter');
  expect((await controls(page)).listening).toBe(true);
  await page.keyboard.press('k');                             // already Puño fuerte of J1
  await expect.poll(async () => (await controls(page)).message).toContain('Puño fuerte');
  expect((await controls(page)).p1.LIGHT_PUNCH).toEqual(['J']);

  await page.keyboard.press('Enter');
  await page.keyboard.press('m');                             // reserved for the music
  await expect.poll(async () => (await controls(page)).message).toContain('reservada');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Insert');                        // belongs to J2
  await expect.poll(async () => (await controls(page)).message).toContain('J2');

  await page.keyboard.press('Enter');
  await page.keyboard.press('g');
  await expect.poll(async () => (await controls(page)).p1.LIGHT_PUNCH).toEqual(['G']);
  expect((await controls(page)).message).toContain('Guardado');

  // J2 tab: remap J2's light kick to N.
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await controls(page)).slot).toBe('p2');
  await selectRow(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('n');
  await expect.poll(async () => (await controls(page)).p2.LIGHT_KICK).toEqual(['N']);

  // Saved across a reload.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fighter-keys') ?? '{}'));
  expect(saved.p1.LIGHT_PUNCH).toEqual(['G']);
  expect(saved.p2.LIGHT_KICK).toEqual(['N']);

  // In a fight, G punches and J no longer does.
  await page.evaluate(() => {
    const game = (window as any).__game;
    game.scene.stop('MenuScene');
    game.scene.start('FightScene', { mode: 'training', stageIndex: 0 });
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  const attack = () => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.combatState.attackName);
  await page.keyboard.press('j', { delay: 60 });
  await page.waitForTimeout(150);
  expect(await attack()).toBe('');
  await page.keyboard.press('g', { delay: 60 });
  await expect.poll(attack).toBe('LIGHT_PUNCH');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').children.getByName('fight-controls').text)).toContain('G K');
});

test('Restaurar valores brings back the default keys for both players', async ({ page }) => {
  await bootGame(page);
  await page.evaluate(() => localStorage.setItem('fighter-keys', JSON.stringify({ p1: { LIGHT_PUNCH: ['G'] }, p2: { LIGHT_KICK: ['NUMPAD_SEVEN'] } })));
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.evaluate(() => { const g = (window as any).__game; g.scene.stop('MenuScene'); g.scene.start('ControlsScene'); });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ControlsScene'));
  expect((await controls(page)).p1.LIGHT_PUNCH).toEqual(['G']);
  await selectRow(page, 12);                                  // Restaurar valores
  await page.keyboard.press('Enter');
  const after = await controls(page);
  expect(after.p1.LIGHT_PUNCH).toEqual(['J']);
  expect(after.p2.LIGHT_KICK).toEqual(['DELETE', 'NUMPAD_ONE']);
  expect(await page.evaluate(() => localStorage.getItem('fighter-keys'))).toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
});
