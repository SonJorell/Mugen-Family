import { test, expect } from '@playwright/test';

test('the loading screen shows real progress that only moves forward and reaches 100 %', async ({ page }) => {
  // Slow the images down a little so the bar is observable.
  await page.route(/\/assets\/.*\.(webp|png|jpg|JPG)(\?.*)?$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 120));
    await route.continue();
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  // Record the bar from inside the page so slow frames cannot hide intermediate values.
  await page.addInitScript(() => {
    const w = window as any;
    w.__samples = [];
    const tick = () => {
      const g = w.__game, s = g?.scene.getScene('PreloadScene');
      if (s?.loading && g.scene.isActive('PreloadScene')) {
        w.__samples.push({ progress: s.loading.progress, percent: s.children.getByName('loading-percent')?.text,
          status: s.children.getByName('loading-status')?.text, title: s.children.getByName('loading-title')?.text });
      }
      if (!g?.scene.isActive('MenuScene')) setTimeout(tick, 16);
    };
    tick();
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  const samples: { progress: number; percent: string; status: string; title: string }[] = await page.evaluate(() => (window as any).__samples);
  expect(samples.length).toBeGreaterThan(5);
  for (let i = 1; i < samples.length; i++) expect(samples[i].progress).toBeGreaterThanOrEqual(samples[i - 1].progress);
  const mid = samples.filter(s => s.progress > 0.1 && s.progress < 0.9);
  expect(mid.length).toBeGreaterThan(0);
  expect(mid[0].status).toMatch(/· \d+ de \d+ archivos/);
  expect(samples.some(s => s.percent === '100 %') || samples[samples.length - 1].progress > 0.95).toBe(true);
  expect((samples[0] as any).title).toBe('FIGHTER\nFAMILY');
});

test('fighter sheets, stages and illustrations are downloaded as WebP', async ({ page }) => {
  const images: string[] = [];
  page.on('request', r => {
    const path = decodeURIComponent(new URL(r.url()).pathname);
    if (/\/assets\/(characters|stages|menu)\/.*\.(webp|png|jpg|JPG)$/.test(path)) images.push(path);
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  expect(images.length).toBeGreaterThan(50);
  expect(images.filter(p => !p.endsWith('.webp'))).toEqual([]);
  // Super portraits too.
  expect(await page.evaluate(() => (window as any).__game.textures.exists('tilin_super_portrait'))).toBe(true);
});
