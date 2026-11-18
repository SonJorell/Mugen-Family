import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/loading-redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const reports = [];
try {
  for (const mode of ['desktop', 'mobile', 'reduced', 'motion-change', 'error']) {
    const page = await browser.newPage({ viewport: mode === 'mobile' ? { width: 844, height: 390 } : { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    let releaseManifests, releaseAudio;
    const manifests = new Promise(resolve => { releaseManifests = resolve; });
    const audio = new Promise(resolve => { releaseAudio = resolve; });
    await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`) });
    });
    await page.route('**/assets/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('.js')) { await route.fallback(); return; }
      if (path.endsWith('/manifest.json')) {
        await manifests;
        if (mode === 'error' && path.includes('/tilin/')) {
          await route.fulfill({ status: 404, body: '' }); return;
        }
      }
      if (path.endsWith('.wav')) await audio;
      await route.continue();
    });
    await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:4173');
    await page.waitForFunction(() => window.__game?.scene.getScene('PreloadScene')?.children.getByName('loading-title'));
    if (mode === 'desktop') await page.screenshot({ path: `${output}/before-images.png` });
    releaseManifests();
    if (mode === 'motion-change') {
      await page.waitForFunction(() => {
        const art = window.__game.scene.getScene('PreloadScene').children.getByName('loading-coast');
        return art && art.alpha < 0.99;
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    if (mode === 'error') {
      await page.waitForFunction(() => window.__game.scene.getScene('PreloadScene').children.list.some(c => /Reintentar/.test(c.text ?? '')));
    } else {
      await page.waitForFunction(() => {
        const scene = window.__game.scene.getScene('PreloadScene');
        return ['loading-coast', 'loading-tilin', 'loading-cesar'].every(key => scene.children.getByName(key)?.alpha > 0.99);
      });
    }
    await page.screenshot({ path: `${output}/${mode}.png` });
    const state = await page.evaluate(() => {
      const s = window.__game.scene.getScene('PreloadScene');
      return { progress: s.loading.progress, percent: s.children.getByName('loading-percent').text,
        status: s.children.getByName('loading-status').text,
        art: ['loading-coast', 'loading-tilin', 'loading-cesar'].map(key => ({ key, visible: !!s.children.getByName(key), alpha: s.children.getByName(key)?.alpha })) };
    });
    releaseAudio();
    if (mode !== 'error') {
      await page.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 });
      assert(state.progress > 0 && state.progress < 1, 'The captured loader is backed by actual pending files.');
      assert(state.art.every(a => a.visible && a.alpha > 0.99));
    }
    assert.deepEqual(errors, []);
    reports.push({ mode, errors, ...state });
    await page.close();
  }
  await writeFile(`${output}/visual-validation.json`, JSON.stringify(reports, null, 2));
  console.log('Verified initial backdrop, loaded artwork, landscape mobile, reduced motion, retry screen and successful menu handoff.');
} finally { await browser.close(); }
