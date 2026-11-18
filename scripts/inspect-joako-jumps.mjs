import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.OUTPUT_DIR ?? 'artifacts/joako-jump-alpha';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`) });
  });
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3018');
  await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
  await page.mouse.click(640, 565); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.loop.stop(); window.__game.scene.getScene('FightScene').sys.pause(); });
  const alpha = await page.evaluate(() => {
    const s = window.__game.scene.getScene('FightScene');
    return ['JUMP', 'DOUBLE_JUMP'].map(name => {
      const img = s.textures.get(`joako_RAW_${name}_0`).getSourceImage();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      const cols = name === 'JUMP' ? 6 : 4, rows = name === 'JUMP' ? 1 : 3;
      const w = c.width / cols, h = c.height / rows;
      const frames = Array.from({ length: cols * rows }, (_, i) => {
        const sx = i % cols * w, sy = Math.floor(i / cols) * h;
        let maxBackgroundAlpha = 0, whiteClothingPixels = 0;
        for (const [ox, oy] of [[2, 2], [w - 8, 2], [2, h - 8], [w - 8, h - 8]]) {
          for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
            const n = (Math.floor(sy + oy + y) * c.width + Math.floor(sx + ox + x)) * 4;
            maxBackgroundAlpha = Math.max(maxBackgroundAlpha, pixels[n + 3]);
          }
        }
        for (let y = 0; y < Math.floor(h); y++) for (let x = 0; x < w; x++) {
          const n = (Math.floor(sy + y) * c.width + sx + x) * 4;
          if (pixels[n] > 235 && pixels[n + 1] > 235 && pixels[n + 2] > 235 && pixels[n + 3] > 240) whiteClothingPixels++;
        }
        return { frame: i, maxBackgroundAlpha, whiteClothingPixels };
      });
      return { name, frames };
    });
  });
  const motion = [];
  for (const right of [true, false]) for (const double of [false, true]) {
    await page.evaluate(({ right, double }) => {
      const s = window.__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
      p.resetForRound(right ? 600 : 1000); o.resetForRound(right ? 1000 : 600);
      p.updateFacing(o.x); o.updateFacing(p.x); p.jump();
      if (double) { p.update(80); p.jump(); }
    }, { right, double });
    const count = double ? 12 : 6, rate = double ? 22 : 10;
    for (let frame = 0; frame < count; frame++) {
      const state = await page.evaluate(delta => {
        const g = window.__game, s = g.scene.getScene('FightScene');
        if (delta) s.player.update(delta);
        g.step(performance.now(), 0);
        return { texture: s.player.sprite.texture.key, grounded: s.player.isGrounded };
      }, frame ? 1000 / rate + 0.001 : 0);
      motion.push({ right, double, frame, ...state });
      if ((double ? [0, 3, 6, 9, 11] : [0, 2, 4, 5]).includes(frame)) {
        await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-${double ? 'double' : 'jump'}-${frame}.png` });
      }
    }
    await page.evaluate(() => {
      const g = window.__game, s = g.scene.getScene('FightScene');
      for (let i = 0; i < 150 && !s.player.isGrounded; i++) s.player.update(1000 / 60);
      g.step(performance.now(), 0);
    });
    await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-${double ? 'double' : 'jump'}-landing.png` });
  }
  await writeFile(`${out}/validation.json`, JSON.stringify({ alpha, motion, errors }, null, 2));
  assert.deepEqual(errors, []);
  for (const animation of alpha) for (const frame of animation.frames) {
    assert.ok(frame.maxBackgroundAlpha <= 2, `${animation.name} frame ${frame.frame}: background alpha ${frame.maxBackgroundAlpha}`);
    assert.ok(frame.whiteClothingPixels > 30, `${animation.name} frame ${frame.frame}: opaque white clothing missing`);
  }
  for (const frame of motion) assert.equal(frame.texture, `joako_${frame.double ? 'DOUBLE_JUMP' : 'JUMP'}_${frame.frame}`);
  console.log('Verified all 18 jump frames have clear background probes and opaque white clothing; single/double jumps and landing render in both directions without runtime errors.');
} finally { await browser.close(); }
