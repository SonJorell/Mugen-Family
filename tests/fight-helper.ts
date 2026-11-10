import { Page } from '@playwright/test';

/** Exposes the Phaser game at the network boundary; production needs no testing API. */
export async function bootGame(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
}

/**
 * Starts a fight with the given fighters straight from the menu and stops the game loop,
 * so a test can step the simulation frame by frame.
 */
export async function startFight(page: Page, player = 'tilin', opponent = 'tilin', extra: Record<string, unknown> = {}) {
  await bootGame(page);
  await page.evaluate(({ player, opponent, extra }) => {
    const game = (window as any).__game;
    game.scene.stop('MenuScene');
    game.scene.start('FightScene', { mode: 'cpu', stageIndex: 0,
      playerChoice: { characterId: player, paletteId: 'original' },
      opponentChoice: { characterId: opponent, paletteId: 'amethyst' }, ...extra });
  }, { player, opponent, extra });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  await page.evaluate(() => { (window as any).__game.loop.stop(); });
}
