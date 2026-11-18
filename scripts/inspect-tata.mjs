import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.OUTPUT_DIR ?? 'artifacts/tata/visual';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), errors = [], reports = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
  reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference',
  ...(process.env.RECORD ? { recordVideo: { dir: out, size: { width: 1280, height: 720 } } } : {}) });
const page = await context.newPage();
page.setDefaultTimeout(60000);
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
  for (let i = 0; i < 4; i++) await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('SelectionScene').playerChoice.characterId), 'tata');
  await page.screenshot({ path: `${out}/selection.png` });
  await page.mouse.click(524, 528); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__game.loop.stop(); });
  for (const right of [true, false]) {
    await page.evaluate(right => {
      const s = window.__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
      s.superMove.cancel(); p.resetForRound(right ? 600 : 1320); o.resetForRound(right ? 700 : 1220);
      p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      s.sys.pause();
    }, right);
    for (const [name, t] of [['intro', 300], ['drink', 980], ['mount', 1650], ['launch', 2300], ['ride', 2800], ['impact', 3210],
      ['flight', 3500], ['landing', 3780], ['return', 4200], ['brake', 4850], ['dismount', 5200], ['toast', 5650], ['returned', 6000]]) {
      const r = await page.evaluate(t => {
        const g = window.__game, s = g.scene.getScene('FightScene');
        while (s.superMove.active && s.superMove.elapsed + 0.01 < t) s.update(0, Math.min(1000 / 60, t - s.superMove.elapsed));
        g.step(performance.now(), 0);
        return { hp: s.opponent.currentHealth, active: s.superMove.active, energy: s.player.energy,
          visible: [s.player.sprite.visible, s.opponent.sprite.visible] };
      }, t);
      reports.push({ right, name, ...r });
      await page.screenshot({ path: `${out}/${right ? 'left' : 'right'}-${name}.png` });
    }
  }
  for (const r of reports.filter(r => r.name === 'returned')) {
    assert.equal(r.hp, 40); assert.equal(r.active, false); assert.equal(r.energy, 0);
    assert.deepEqual(r.visible, [true, true]);
  }
  const names = ['drink', 'mount', 'ride', 'impact', 'return', 'toast'];
  const sources = await Promise.all(names.map(async name => ({ name, data: (await readFile(`${out}/left-${name}.png`)).toString('base64') })));
  const gallery = await page.evaluate(async sources => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 1140;
    const ctx = c.getContext('2d');ctx.fillStyle = '#0c1922';ctx.fillRect(0,0,c.width,c.height);
    for (const [i,src] of sources.entries()) {
      const img = new Image(); img.src='data:image/png;base64,'+src.data; await img.decode();
      const x=i%2*640,y=Math.floor(i/2)*380;ctx.drawImage(img,x,y,640,360);
      ctx.fillStyle='#fff';ctx.font='14px Arial';ctx.fillText(src.name,x+12,y+376);
    }
    return c.toDataURL().split(',')[1];
  }, sources);
  await writeFile(`${out}/sequence.png`, Buffer.from(gallery,'base64'));
  assert.deepEqual(errors, []);
  await writeFile(`${out}/validation.json`, JSON.stringify({ errors, reports }, null, 2));
  console.log('Tata verified: fifth selection, beer, mounting, cycling, impact, return, 60 damage, both directions, no browser errors.');
} finally { await context.close(); await browser.close(); }
