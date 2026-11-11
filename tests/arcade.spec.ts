import { test, expect, Page } from '@playwright/test';
import { bootGame } from './fight-helper';

const arcade = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('ArcadeScene');
  return { active: (window as any).__game.scene.isActive('ArcadeScene'), view: s.view, run: s.run,
    ladder: s.ladder.map((st: any) => ({ id: st.opponent.characterId, difficulty: st.difficulty, boss: st.boss })) };
});
const fightData = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('FightScene');
  return { opponent: s.opponentChoice.characterId, difficulty: s.opponent.difficulty, arcade: s.getMatchData().arcade };
});

async function openArcade(page: Page) {
  await bootGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('MenuScene').selectedIndex)).toBe(1);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ArcadeScene'));
}

/** Ends the running arcade fight as if its deciding round had just finished. */
async function finishFight(page: Page, winner: 'player' | 'opponent') {
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  await page.evaluate(w => (window as any).__game.scene.getScene('FightScene').leaveMatch(w), winner);
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ArcadeScene'));
}

test('arcade: pick a fighter, climb a ladder of rising difficulty, continue after a loss, and reach the ending and credits', async ({ page }) => {
  await openArcade(page);
  expect((await arcade(page)).view).toBe('pick');
  await page.keyboard.press('ArrowDown');            // colour: Amatista
  await page.keyboard.press('Enter');
  const ladder = await arcade(page);
  expect(ladder.view).toBe('ladder');
  expect(ladder.run).toEqual({ player: { characterId: 'tilin', paletteId: 'amethyst' }, step: 0, continues: 0 });
  expect(ladder.ladder).toEqual([
    { id: 'cesar', difficulty: 'easy', boss: false },
    { id: 'tilin', difficulty: 'normal', boss: false },
    { id: 'cesar', difficulty: 'hard', boss: true },
  ]);

  // Fight 1 against an easy César, and win.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  expect(await fightData(page)).toMatchObject({ opponent: 'cesar', difficulty: 'easy', arcade: { step: 0 } });
  await finishFight(page, 'player');
  expect(await arcade(page)).toMatchObject({ view: 'ladder', run: { step: 1, continues: 0 } });

  // Fight 2 (mirror, normal): lose, continue, and win the rematch.
  await page.keyboard.press('Enter');
  await finishFight(page, 'opponent');
  expect(await arcade(page)).toMatchObject({ view: 'continue', run: { step: 1 } });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  expect(await fightData(page)).toMatchObject({ opponent: 'tilin', difficulty: 'normal', arcade: { step: 1, continues: 1 } });
  await finishFight(page, 'player');

  // Final boss on hard, then the ending and the credits.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  expect(await fightData(page)).toMatchObject({ opponent: 'cesar', difficulty: 'hard' });
  await finishFight(page, 'player');
  expect((await arcade(page)).view).toBe('ending');
  const ending = await page.evaluate(() => (window as any).__game.scene.getScene('ArcadeScene').content.list
    .map((c: any) => c.text).filter(Boolean).join('\n'));
  expect(ending).toContain('¡CAMPEÓN!');
  expect(ending).toContain('canción de Tilin');
  expect(ending).toContain('1 continuación');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('CreditsScene'));
  const credits = await page.evaluate(() => (window as any).__game.scene.getScene('CreditsScene').roll.list.map((c: any) => c.text).join('\n'));
  expect(credits).toContain('ImageGen');
  expect(credits).toContain('scripts/generate-music.mjs');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
});

test('arcade: losing offers continue or menu, and Esc returns to the main menu', async ({ page }) => {
  await openArcade(page);
  await page.keyboard.press('ArrowRight');           // César
  await page.keyboard.press('Enter');
  expect((await arcade(page)).ladder[0]).toEqual({ id: 'tilin', difficulty: 'easy', boss: false });
  await page.keyboard.press('Enter');
  await finishFight(page, 'opponent');
  expect((await arcade(page)).view).toBe('continue');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
});

test('arcade: a real best-of-3 knockout returns to the ladder, and the pause keeps the arcade run', async ({ page }) => {
  await openArcade(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  // Pause → restart keeps the arcade data.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  expect((await fightData(page)).arcade).toMatchObject({ step: 0 });
  for (let round = 0; round < 2; round++) {
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
    await page.evaluate(() => { (window as any).__game.scene.getScene('FightScene').opponent.currentHealth = 0; });
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'END');
  }
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ArcadeScene'), null, { timeout: 15000 });
  expect(await arcade(page)).toMatchObject({ view: 'ladder', run: { step: 1 } });
});
