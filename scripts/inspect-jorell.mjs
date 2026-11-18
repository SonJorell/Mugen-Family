import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.OUTPUT_DIR ?? 'artifacts/jorell/visual';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), errors = [], reports = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
  reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference',
  ...(process.env.RECORD ? { recordVideo: { dir: out, size: { width: 1280, height: 720 } } } : {}) });
const page = await context.newPage();
try {
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
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('SelectionScene').playerChoice.characterId), 'jorell');
  await page.screenshot({ path: `${out}/selection.png` });
  await page.mouse.click(640, 565); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.waitForTimeout(800);
  if (process.env.RECORD) {
    // Exercise the live input and render clocks, not just the cinematic in isolation.
    await page.keyboard.press('KeyW'); await page.waitForTimeout(180); await page.keyboard.press('KeyW'); await page.waitForTimeout(1000);
    for (const right of [true, false]) {
      await page.evaluate(right => {
        const s = window.__game.scene.getScene('FightScene');
        s.player.resetForRound(right ? 600 : 1320); s.opponent.resetForRound(right ? 700 : 1220);
        s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x); s.player.gainEnergy(100);
      }, right);
      await page.keyboard.press('KeyO', { delay: 60 });
      await page.waitForFunction(() => window.__game.scene.getScene('FightScene').superMove.active);
      await page.waitForFunction(() => !window.__game.scene.getScene('FightScene').superMove.active);
      assert.equal(await page.evaluate(() => window.__game.scene.getScene('FightScene').opponent.currentHealth), 40);
      await page.waitForTimeout(800);
    }
  }
  await page.evaluate(() => { window.__game.loop.stop(); });
  for (const right of [true, false]) {
    await page.evaluate(right => {
      const s = window.__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
      s.superMove.cancel(); p.resetForRound(right ? 600 : 1320); o.resetForRound(right ? 700 : 1220);
      p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      s.sys.pause();
    }, right);
    for (const [name, t] of [['stomach', 100], ['teleport', 920], ['cutin', 1600], ['transform', 2350], ['golden', 2800], ['charge', 3600],
      ['release', 4280], ['beam', 4700], ['impact', 5580], ['recovery', 6300], ['returned', 6800]]) {
      const r = await page.evaluate(t => {
        const g = window.__game, s = g.scene.getScene('FightScene');
        while (s.superMove.active && s.superMove.elapsed + 0.01 < t) s.update(0, Math.min(1000 / 60, t - s.superMove.elapsed));
        g.step(performance.now(), 0);
        return { hp: s.opponent.currentHealth, active: s.superMove.active, energy: s.player.energy,
          visible: [s.player.sprite.visible, s.opponent.sprite.visible], distance: Math.abs(s.player.x - s.opponent.x) };
      }, t);
      reports.push({ right, name, ...r });
      await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-${name}.png` });
    }
  }
  for (const r of reports.filter(r => r.name === 'returned')) {
    assert.equal(r.hp, 40); assert.equal(r.active, false); assert.equal(r.energy, 0);
    assert.deepEqual(r.visible, [true, true]); assert.ok(r.distance > 500);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/validation.json`, JSON.stringify({ errors, reports }, null, 2));
  await context.close();
  if (process.env.RECORD) await copyFile(await page.video().path(), `${out}/gameplay.webm`);
  console.log('Jorell verified: selection, stomach hit, teleport, golden transformation, charge, beam, recovery, 60 damage, both directions, no browser errors.');
} finally { await browser.close(); }
