import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts/tilin-v3', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
});
await page.goto('http://127.0.0.1:3000');
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await page.screenshot({ path: 'artifacts/tilin-v3/menu.png' });
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
await page.evaluate(() => {
  const game = window.__game, s = game.scene.getScene('FightScene');
  game.loop.stop(); s.player.finishRound('IDLE'); s.opponent.finishRound('IDLE');
  s.player.x = 700; s.opponent.x = 1100;
  s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
  s.player.executeAttack('SPECIAL_ATTACK');
  for (let i = 0; i < 24; i++) { s.player.update(1000 / 60); s.fighterController.checkCollisions(s.player, s.opponent); }
  s.opponent.sprite.setPosition(s.opponent.x, s.opponent.y);
  s.hud.update(s.player, s.opponent, 99); s.sys.pause(); game.step(performance.now(), 0);
});
await page.screenshot({ path: 'artifacts/tilin-v3/canto.png' });
await page.evaluate(() => {
  const game = window.__game, s = game.scene.getScene('FightScene');
  for (let i = 0; i < 24; i++) { s.player.update(1000 / 60); s.fighterController.checkCollisions(s.player, s.opponent); }
  for (let i = 0; i < 18; i++) s.opponent.update(1000 / 60);
  s.hud.update(s.player, s.opponent, 99); game.step(performance.now(), 0);
});
await page.screenshot({ path: 'artifacts/tilin-v3/stun.png' });
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.log('Captured menu, travelling chant and stun without resource or runtime errors.');
