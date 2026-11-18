import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = process.env.OUTPUT_DIR ?? 'artifacts/cesar-drive';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: output, size: { width: 1280, height: 720 } } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`) });
  });
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:4173');
  await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE'); await page.mouse.click(640, 565);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.waitForTimeout(1000);
  for (const right of [true, false]) {
    await page.evaluate(right => {
      const s = window.__game.scene.getScene('FightScene');
      s.player.resetForRound(right ? 600 : 1320); s.opponent.resetForRound(right ? 715 : 1205);
      s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x); s.player.gainEnergy(100);
    }, right);
    await page.keyboard.press('KeyO', { delay: 60 });
    await page.waitForFunction(() => window.__game.scene.getScene('FightScene').superMove.active);
    await page.waitForFunction(() => !window.__game.scene.getScene('FightScene').superMove.active);
    assert.equal(await page.evaluate(() => window.__game.scene.getScene('FightScene').opponent.currentHealth), 40);
    await page.waitForTimeout(800);
  }
  assert.deepEqual(errors, []);
  await context.close();
  await copyFile(await page.video().path(), `${output}/gameplay.webm`);
  console.log('Recorded the i30 grab super through real keyboard input in both directions, without runtime errors.');
} finally { await browser.close(); }
