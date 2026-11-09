import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts/arica', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text()); });
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
});
await page.goto('http://127.0.0.1:3000');
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await page.mouse.move(640, 360);
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/arica/menu.png' });
await page.mouse.move(1200, 160);
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/arica/menu-depth.png' });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
await page.screenshot({ path: 'artifacts/arica/menu-narrow.png' });
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(200);
await page.mouse.click(450, 426);
await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
await page.screenshot({ path: 'artifacts/arica/selector.png' });
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('FightScene'));
await page.waitForTimeout(4000);
for (const name of ['morro', 'chinchorro', 'catedral']) {
  await page.screenshot({ path: `artifacts/arica/${name}.png` });
  await page.keyboard.press('F2'); await page.waitForTimeout(200);
}
await writeFile('artifacts/arica/inspection.json', JSON.stringify({ failures }, null, 2));
await browser.close();
if (failures.length) throw new Error(failures.join('\n'));
console.log('Arica visual inspection captured: menu, depth, narrow window, selector and three arenas. No runtime/resource errors.');
