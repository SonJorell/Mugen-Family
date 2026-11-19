import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

// Same network-boundary instrumentation as game.spec.ts: production needs no testing API.
async function fight(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await confirmSelection(page);
  await waitForRound(page, 1);
}

async function waitForRound(page: Page, round: number) {
  await page.waitForFunction(r => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return s.roundSystem?.phase === 'FIGHT' && s.roundSystem.round === r;
  }, round, { timeout: 20000 });
}

/** Knocks the CPU out through the real round flow. */
async function koOpponent(page: Page) {
  await page.evaluate(() => { (window as any).__game.scene.getScene('FightScene').opponent.currentHealth = 0; });
}

test('a KO wins the round, resets both fighters and starts round 2', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await fight(page);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.currentHealth = 40; s.player.x = 300;
  });
  await koOpponent(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'END');
  expect(await page.evaluate(() => (window as any).__game.scene.isActive('FightScene'))).toBe(true);

  await waitForRound(page, 2);
  const state = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return {
      wins: s.roundSystem.wins,
      player: [s.player.currentHealth, s.player.maxHealth, Math.round(s.player.x), s.player.combatState.state],
      opponent: [s.opponent.currentHealth, s.opponent.maxHealth, s.opponent.combatState.state],
      time: s.roundSystem.timeLeft,
      pips: s.hud.roundPips.map((side: any[]) => side.map(p => p.fillColor === 0xffb800)),
    };
  });
  expect(state.wins).toEqual({ player: 1, opponent: 0 });
  expect(state.player[0]).toBe(state.player[1]);
  expect(state.player[2]).toBe(Math.round(1920 * 0.35));
  expect(state.opponent[0]).toBe(state.opponent[1]);
  expect(state.opponent[2]).not.toBe('DEFEAT');
  expect(state.time).toBe(99);
  expect(state.pips).toEqual([[true, false], [false, false]]);
  expect(errors).toEqual([]);
});

test('winning two rounds ends the match and returns to the menu', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await fight(page);
  await koOpponent(page);
  await waitForRound(page, 2);
  await koOpponent(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'END');
  const result = await page.evaluate(() => {
    const rs = (window as any).__game.scene.getScene('FightScene').roundSystem;
    return { over: rs.matchOver, winner: rs.matchWinner, wins: rs.wins };
  });
  expect(result).toEqual({ over: true, winner: 'player', wins: { player: 2, opponent: 0 } });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'), undefined, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test('a draw scores for nobody and the match goes on', async ({ page }) => {
  await fight(page);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.currentHealth = s.player.maxHealth; s.opponent.currentHealth = s.opponent.maxHealth;
    s.roundSystem.update(99000, 100, 100);
  });
  const result = await page.evaluate(() => {
    const rs = (window as any).__game.scene.getScene('FightScene').roundSystem;
    return { phase: rs.phase, over: rs.matchOver, wins: rs.wins };
  });
  expect(result).toEqual({ phase: 'END', over: false, wins: { player: 0, opponent: 0 } });
  await waitForRound(page, 2);
});

test('the round cap stops endless draws and splits a tied match', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const rs = s.roundSystem;
    rs.onRoundEnd = () => {};
    s.time.removeAllEvents();
    const outcomes: boolean[] = [];
    // Rounds 1-2 split, then draws until the cap.
    const results = [[100, 50], [50, 100], [100, 100], [100, 100], [100, 100]];
    for (const [i, [p, o]] of results.entries()) {
      if (i > 0) { rs.nextRound(); rs._phase = 'FIGHT'; rs._timerRunning = true; }
      rs.update(99000, p, o);
      outcomes.push(rs.matchOver);
    }
    return { outcomes, round: rs.round, winner: rs.matchWinner, wins: rs.wins };
  });
  expect(result).toEqual({ outcomes: [false, false, false, false, true], round: 5, winner: 'draw', wins: { player: 1, opponent: 1 } });
});
