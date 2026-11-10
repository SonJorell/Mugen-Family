import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

const selection = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('SelectionScene');
  return { difficulty: s.difficulty, labels: s.content.list.map((c: any) => c.text).filter(Boolean) };
});

test('X cycles the CPU difficulty on the fighter screen and the fight uses it', async ({ page }) => {
  await bootGame(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  expect((await selection(page)).difficulty).toBe('normal');
  expect((await selection(page)).labels).toContain('CPU: Normal');
  for (const [expected, label] of [['hard', 'CPU: Difícil'], ['easy', 'CPU: Fácil'], ['normal', 'CPU: Normal'], ['hard', 'CPU: Difícil']]) {
    await page.keyboard.press('x');
    await expect.poll(async () => (await selection(page)).difficulty).toBe(expected);
    expect((await selection(page)).labels).toContain(label);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('SelectionScene').phase === 'stage');
  expect((await selection(page)).labels.join(' ')).toContain('Combate contra CPU · Difícil');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  const fight = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { difficulty: s.opponent.difficulty, data: s.getMatchData().difficulty };
  });
  expect(fight).toEqual({ difficulty: 'hard', data: 'hard' });
});

/** Throws the same series of attacks at the CPU and counts how many it blocks. */
async function blocksOutOf(page: Page, difficulty: string, trials: number) {
  await startFight(page, 'tilin', 'tilin', { difficulty, cpuSeed: 1234 });
  return page.evaluate(trials => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    let blocked = 0;
    for (let t = 0; t < trials; t++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
      o.decisionTimer = 0;
      p.executeAttack(t % 2 ? 'HEAVY_PUNCH' : 'HEAVY_KICK');
      let wasBlocked = false;
      for (let f = 0; f < 40 && !wasBlocked; f++) {
        o.think(1000 / 60, p);
        p.update(1000 / 60); o.update(1000 / 60);
        const before = o.combatState.state;
        s.fighterController.checkCollisions(p, o);
        wasBlocked = o.combatState.state === 'BLOCKSTUN' && before !== 'BLOCKSTUN';
      }
      if (wasBlocked) blocked++;
    }
    return blocked;
  }, trials);
}

test('with the same seed, Hard blocks clearly more than Easy and Normal sits between them', async ({ page }) => {
  const easy = await blocksOutOf(page, 'easy', 40);
  const normal = await blocksOutOf(page, 'normal', 40);
  const hard = await blocksOutOf(page, 'hard', 40);
  expect(hard).toBeGreaterThan(easy + 10);
  expect(normal).toBeGreaterThanOrEqual(easy);
  expect(hard).toBeGreaterThanOrEqual(normal);
});

test('the same seed makes the CPU repeat the same decisions', async ({ page }) => {
  const first = await blocksOutOf(page, 'normal', 20);
  const second = await blocksOutOf(page, 'normal', 20);
  expect(second).toBe(first);
});

test('the hard CPU meets a close jump-in with an anti-air more often than the easy one', async ({ page }) => {
  const antiAirs: Record<string, number> = {};
  for (const difficulty of ['easy', 'hard']) {
    await startFight(page, 'tilin', 'tilin', { difficulty, cpuSeed: 99 });
    antiAirs[difficulty] = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      const p = s.player, o = s.opponent;
      p.input.getState = () => ({});
      let count = 0;
      for (let t = 0; t < 20; t++) {
        p.finishRound('IDLE'); o.finishRound('IDLE');
        p.x = 780; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
        o.decisionTimer = 999; o.think(0, p);   // the CPU sees the fighter back on the ground
        o.decisionTimer = 0;
        p.jump();
        o.think(1000 / 60, p);
        if (o.combatState.state === 'ATTACKING' && o.combatState.attackName === 'HEAVY_PUNCH') count++;
      }
      return count;
    });
  }
  expect(antiAirs.easy).toBe(0);
  expect(antiAirs.hard).toBeGreaterThan(5);
});
