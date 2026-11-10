import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/cesar-drive';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
try {
  await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
    const response = await route.fetch(), source = await response.text();
    await route.fulfill({ response, body: source.replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`) });
  });
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000');
  await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE'); await page.mouse.click(640, 565);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  // Let the ROUND/FIGHT announcement finish before freezing the renderer for stills.
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__game.loop.stop(); });
  const reports = [];
  for (const right of [true, false]) {
    await page.evaluate(right => {
      const s = window.__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
      s.superMove.cancel(); p.resetForRound(right ? 600 : 1320); o.resetForRound(right ? 715 : 1205);
      p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      s.sys.pause();
    }, right);
    for (const [name, time] of [['grab', 300], ['throw', 1000], ['enter', 2050], ['accelerate', 3080], ['impact', 3350], ['monster', 4800], ['returned', 5800]]) {
      const state = await page.evaluate(time => {
        const g = window.__game, s = g.scene.getScene('FightScene');
        while (s.superMove.active && s.superMove.elapsed + 0.01 < time) s.update(0, Math.min(1000 / 60, time - s.superMove.elapsed));
        g.step(performance.now(), 0);
        return { active: s.superMove.active, health: s.opponent.currentHealth, elapsed: s.superMove.elapsed,
          playerX: s.player.x, opponentX: s.opponent.x, energy: s.player.energy };
      }, time);
      reports.push({ side: right ? 'left' : 'right', name, ...state });
      await page.screenshot({ path: `${output}/${right ? 'left' : 'right'}-${name}.png` });
    }
  }
  assert.deepEqual(errors, []);
  for (const state of reports.filter(s => s.name === 'returned')) {
    assert.equal(state.active, false); assert.equal(state.health, 40); assert.equal(state.energy, 0);
    assert.equal(state.opponentX, state.side === 'left' ? 1740 : 180);
  }
  await writeFile(`${output}/validation.json`, JSON.stringify({ errors, reports }, null, 2));
  console.log('i30 cinematic: both directions, grab, throw, entry, acceleration, impact, Monster and final positions verified.');
} finally { await browser.close(); }
