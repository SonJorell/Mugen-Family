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

test('← → flips the move list to example combos written with the player\'s keys', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar');
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').showMoveList(true));
  const visibleText = () => page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => { if (!c.visible) return; if (typeof c.text === 'string') texts.push(c.text); if (c.list) walk(c.list); });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts.join('\n');
  });
  const first = await visibleText();
  expect(first).toContain('Agarre');
  expect(first).toContain('J + U');
  await page.keyboard.press('ArrowRight');
  await expect.poll(visibleText).toContain('COMBOS');
  const combos = await visibleText();
  expect(combos).toContain('J → U → K');
  expect(combos).toContain('S+U → S+I');
  expect(combos).not.toContain('MOVIMIENTOS');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(visibleText).toContain('MOVIMIENTOS');
});

test('every example combo only uses cancels the attack data allows', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const problems = await page.evaluate(async () => {
    const { COMBO_EXAMPLES } = await import('/src/config/combos.ts');
    const { ATTACK_DEFINITIONS, COMMAND_MOVES } = await import('/src/combat/AttackDefinition.ts');
    const name: Record<string, string> = { LP: 'LIGHT_PUNCH', LK: 'LIGHT_KICK', HP: 'HEAVY_PUNCH', HK: 'HEAVY_KICK',
      'D+LK': 'CROUCH_LIGHT', 'D+HP': 'LAUNCHER', 'D+HK': 'SWEEP', CMD: 'COMMAND_SPECIAL', SUPER: 'SPECIAL_ATTACK', DASH: 'DASH' };
    const cancels = (attack: string): string[] => attack === 'COMMAND_SPECIAL' ? COMMAND_MOVES.rush.cancelsInto ?? []
      : ATTACK_DEFINITIONS[attack]?.cancelsInto ?? [];
    const out: string[] = [];
    for (const [fighter, list] of Object.entries(COMBO_EXAMPLES) as [string, any[]][]) {
      for (const combo of list) {
        for (let i = 1; i < combo.route.length; i++) {
          const from = name[combo.route[i - 1]], to = name[combo.route[i]];
          // After a dash any ground attack may follow; after the launcher the next hits are juggle hits.
          if (from === 'DASH' || from === 'LAUNCHER' || combo.route[i - 2] === 'D+HP') continue;
          if (!cancels(from).includes(to)) out.push(`${fighter} «${combo.title}»: ${from} → ${to}`);
        }
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});
