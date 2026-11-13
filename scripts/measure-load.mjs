// Measures what the game downloads and how long it takes until the menu, and until a fight with
// each fighter, with a cold browser cache. Usage (dev server or preview running):
//   node scripts/measure-load.mjs [runs]
// GAME_URL picks another server; THROTTLE_MBPS=20 simulates a 20 Mbit/s connection (Chromium).
// Prints transferred bytes by kind and median times.
import { chromium } from '@playwright/test';

const URL = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
const RUNS = Number(process.argv[2] ?? 3);
const browser = await chromium.launch();
const results = [];

for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  if (process.env.THROTTLE_MBPS) {
    const cdp = await context.newCDPSession(page);
    const bps = Number(process.env.THROTTLE_MBPS) * 1e6 / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: bps, uploadThroughput: bps });
  }
  const bytes = {};
  // Sizes reported by the network layer: response.body() misses large images decoded straight away.
  page.on('requestfinished', async request => {
    const url = new globalThis.URL(request.url());
    if (!url.pathname.startsWith('/assets/')) return;
    const kind = url.pathname.split('.').pop().toLowerCase();
    try { const sizes = await request.sizes(); bytes[kind] = (bytes[kind] ?? 0) + sizes.responseBodySize; } catch { /* aborted */ }
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  const start = Date.now();
  await page.goto(URL);
  await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 300000, polling: 50 });
  const menu = Date.now() - start;
  const fights = [];
  for (const id of ['tilin', 'cesar']) {
    const t0 = Date.now();
    await page.evaluate(id => {
      const g = window.__game;
      g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
      g.scene.start('FightScene', { mode: 'training', playerChoice: { characterId: id, paletteId: 'original' }, opponentChoice: { characterId: id, paletteId: 'amethyst' } });
    }, id);
    await page.waitForFunction(() => window.__game.scene.getScene('FightScene').roundSystem?.phase === 'INTRO'
      || window.__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT', null, { timeout: 300000, polling: 50 });
    fights.push(Date.now() - t0);
  }
  await page.waitForTimeout(500);
  results.push({ menu, fights, bytes });
  await context.close();
}
await browser.close();

const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const mb = n => (n / 1048576).toFixed(1) + ' MB';
const last = results[results.length - 1].bytes;
const total = Object.values(last).reduce((a, b) => a + b, 0);
console.log(`Runs: ${RUNS}`);
console.log(`Until the menu: ${median(results.map(r => r.menu))} ms (median)`);
console.log(`Tilin fight ready: ${median(results.map(r => r.fights[0]))} ms · César fight ready: ${median(results.map(r => r.fights[1]))} ms`);
console.log(`Transferred under /assets/: ${mb(total)} — ` + Object.entries(last).map(([k, v]) => `${k} ${mb(v)}`).join(', '));
console.log(`At 20 Mbit/s that is about ${(total * 8 / 20e6).toFixed(0)} s of download.`);
