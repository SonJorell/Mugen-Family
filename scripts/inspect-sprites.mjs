import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts/tilin-v2', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
});
await page.goto('http://127.0.0.1:3000');
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT');
await page.screenshot({ path: 'artifacts/tilin-v2/fight.png' });
const report = await page.evaluate(() => {
  const game = window.__game, scene = game.scene.getScene('FightScene');
  game.loop.stop();
  const animations = scene.registry2.getAll();
  const contacts = [];
  for (let group = 0; group < Math.ceil(animations.length / 6); group++) {
    const canvas = document.createElement('canvas'); canvas.width = 1120; canvas.height = 960;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#17212e'; ctx.fillRect(0, 0, 1120, 960);
    ctx.imageSmoothingEnabled = false;
    animations.slice(group * 6, group * 6 + 6).forEach((anim, row) => {
      ctx.fillStyle = '#f2d58a'; ctx.font = '14px monospace'; ctx.fillText(anim.name, 8, row * 160 + 32);
      [0, 2, 4, 6, 8, 11].forEach((frame, col) => {
        const src = scene.textures.get(anim.frames[frame]).getSourceImage();
        ctx.drawImage(src, 160 + col * 160, row * 160 + 18, 160, 120);
        ctx.fillStyle = '#7f8da0'; ctx.fillText(String(frame + 1), 230 + col * 160, row * 160 + 155);
      });
    });
    contacts.push(canvas.toDataURL('image/png'));
  }
  const stats = animations.map(anim => {
    let opaque = 0, transparent = 0, redFringe = 0, edgePixels = 0;
    const bounds = [];
    for (const key of anim.frames) {
      const src = scene.textures.get(key).getSourceImage();
      const ctx = src.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, src.width, src.height).data;
      let top = src.height, bottom = 0, left = src.width, right = 0;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        if (data[i + 3] === 0) transparent++;
        if (data[i + 3] > 32) {
          opaque++; top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
          if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) redFringe++;
          if (x === 0 || y === 0 || x === src.width - 1 || y === src.height - 1) edgePixels++;
        }
      }
      bounds.push({ left, right, top, bottom });
    }
    return { name: anim.name, frames: anim.frames.length, opaque, transparent, redFringe, edgePixels, bounds };
  });
  return { contacts, stats };
});
for (let i = 0; i < report.contacts.length; i++) await writeFile(`artifacts/tilin-v2/contact-${i + 1}.png`, Buffer.from(report.contacts[i].split(',')[1], 'base64'));
await writeFile('artifacts/tilin-v2/validation.json', JSON.stringify(report.stats, null, 2));
console.log(JSON.stringify(report.stats.map(({ bounds: _bounds, ...summary }) => summary), null, 2));
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
assert.equal(report.stats.length, 23, 'Expected all twenty-three animations');
for (const animation of report.stats) {
  assert.equal(animation.frames, 12, `${animation.name}: missing frames`);
  assert.equal(animation.edgePixels, 0, `${animation.name}: silhouette touches canvas edge`);
  assert.ok(animation.transparent > animation.opaque, `${animation.name}: missing transparency`);
  for (const frame of animation.bounds) {
    assert.ok(frame.right > frame.left && frame.bottom > frame.top, `${animation.name}: empty frame`);
  }
}
