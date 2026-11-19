import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.OUTPUT_DIR ?? 'artifacts/joako';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [], reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 },
    reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference' });
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
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/selection.png` });
  await page.mouse.click(640, 565);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.loop.stop(); });
  await page.screenshot({ path: `${out}/fight.png` });
  for (const right of [true, false]) {
    await page.evaluate(right => {
      const s = window.__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
      s.superMove.cancel(); p.resetForRound(right ? 500 : 1100); o.resetForRound(right ? 900 : 700);
      p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      s.sys.pause();
    }, right);
    for (const [name, t] of [['ball', 150], ['blueprint', 900], ['wall', 1200], ['ramp-plan', 1430], ['stairs', 1900], ['climb', 2350], ['aim', 3150], ['shot', 3210], ['recoil', 3290], ['finish', 4750], ['returned', 5200]]) {
      const state = await page.evaluate(t => {
        const g = window.__game, s = g.scene.getScene('FightScene');
        while (s.superMove.active && s.superMove.elapsed + 0.01 < t) s.update(0, Math.min(1000 / 60, t - s.superMove.elapsed));
        g.step(performance.now(), 0);
        return { hp: s.opponent.currentHealth, active: s.superMove.active, energy: s.player.energy,
          visible: [s.player.sprite.visible, s.opponent.sprite.visible] };
      }, t);
      reports.push({ right, name, ...state });
      await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-${name}.png` });
      if (name === 'aim') await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-grip.png`,
        clip: { x: right ? 500 : 590, y: 140, width: 210, height: 120 } });
    }
  }
  assert.deepEqual(errors, []);
  for (const r of reports.filter(r => r.name === 'returned')) {
    assert.equal(r.hp, 40); assert.equal(r.active, false); assert.equal(r.energy, 0);
    assert.deepEqual(r.visible, [true, true]);
  }
  // The actual round-end presentation must show the entire dance, not just
  // the short celebration at the end of the construction cinematic.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FightScene');
    s.player.finishRound('VICTORY'); s.opponent.finishRound('DEFEAT');
  });
  let danceFrame = 0;
  for (const frame of [0, 3, 8, 15, 20, 23, 24]) {
    const victory = await page.evaluate(delta => {
      const g = window.__game, s = g.scene.getScene('FightScene');
      s.player.updatePresentation(delta); s.opponent.updatePresentation(delta);
      g.step(performance.now(), 0);
      return s.player.sprite.texture.key;
    }, (frame - danceFrame) * (1000 / 18 + 0.001));
    danceFrame = frame;
    assert.equal(victory, `joako_VICTORY_${frame % 24}`);
    await page.screenshot({ path: `${out}/victory-${frame}.png` });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/visual-validation.json`, JSON.stringify({ errors, reports }, null, 2));
  console.log('Verified selection, combat, ball, construction, climb, volley and return in both directions, plus the complete victory dance loop.');
} finally { await browser.close(); }
