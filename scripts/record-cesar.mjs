import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'artifacts/cesar-v2';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: output, size: { width: 1280, height: 720 } } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
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
await page.evaluate(() => {
  const s = window.__game.scene.getScene('FightScene');
  s.player.x = 700; s.opponent.x = 1100;
});
await page.waitForTimeout(600);
for (const key of ['KeyD', 'KeyA']) {
  await page.keyboard.down(key); await page.waitForTimeout(650); await page.keyboard.up(key);
}
for (const key of ['KeyJ', 'KeyK', 'KeyU', 'KeyI']) {
  await page.keyboard.press(key, { delay: 60 }); await page.waitForTimeout(900);
}
await page.keyboard.down('KeyS'); await page.waitForTimeout(650); await page.keyboard.up('KeyS');
await page.keyboard.down('KeyL'); await page.waitForTimeout(650); await page.keyboard.up('KeyL');
await page.keyboard.press('KeyW', { delay: 60 }); await page.waitForTimeout(300);
await page.keyboard.press('KeyW', { delay: 60 }); await page.keyboard.press('KeyU', { delay: 60 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = window.__game.scene.getScene('FightScene'); s.player.gainEnergy(100);
});
await page.keyboard.press('KeyO', { delay: 60 });
await page.waitForFunction(() => window.__game.scene.getScene('FightScene').superMove.active);
await page.waitForFunction(() => !window.__game.scene.getScene('FightScene').superMove.active);
await page.waitForTimeout(500);
assert.deepEqual(errors, []);
await context.close();
await copyFile(await page.video().path(), `${output}/gameplay.webm`);
await browser.close();
console.log('Recorded César walking, retreating, four strikes, crouch, guard, double jump, aerial kick and the seismic super without runtime errors.');
