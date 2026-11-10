import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts/super-canto', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  const source = await response.text();
  // Instrument the browser response only, including Vite's minified production entry.
  const body = source.replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`);
  if (body === source) throw new Error('Could not locate the Phaser bootstrap for inspection');
  await route.fulfill({ response, body });
});
await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000');
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
await page.mouse.click(640, 565);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
await page.evaluate(() => {
  const g = window.__game, s = g.scene.getScene('FightScene');
  g.loop.stop(); s.player.x = 700; s.opponent.x = 1100;
  s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
  s.player.sprite.setPosition(s.player.x, s.player.y); s.opponent.sprite.setPosition(s.opponent.x, s.opponent.y);
  s.player.gainEnergy(100); s.hud.update(s.player, s.opponent, 99);
  s.sys.pause(); g.step(performance.now(), 0);
});
await page.screenshot({ path: 'artifacts/super-canto/energy.png' });
await page.evaluate(() => {
  const g = window.__game, s = g.scene.getScene('FightScene');
  s.player.executeAttack('SPECIAL_ATTACK');
  for (let i = 0; i < 28; i++) { s.player.update(1000 / 60); s.fighterController.checkCollisions(s.player, s.opponent); }
  s.hud.update(s.player, s.opponent, 99); g.step(performance.now(), 0);
});
await page.screenshot({ path: 'artifacts/super-canto/opener.png' });
await page.evaluate(() => {
  const s = window.__game.scene.getScene('FightScene');
  for (let i = 0; i < 80 && !s.superMove.active; i++) { s.player.update(1000 / 60); s.fighterController.checkCollisions(s.player, s.opponent); }
  if (!s.superMove.active) throw new Error('The opener did not confirm the super');
});
for (const [name, time] of [['portrait', 350], ['resonance', 1550], ['finale', 2640], ['recovery', 3150]]) {
  await page.evaluate(target => {
    const g = window.__game, s = g.scene.getScene('FightScene');
    while (s.superMove.active && s.superMove.elapsed < target) s.update(0, Math.min(16, target - s.superMove.elapsed));
    s.hud.update(s.player, s.opponent, 99); g.step(performance.now(), 0);
  }, time);
  await page.screenshot({ path: `artifacts/super-canto/${name}.png` });
  if (name === 'resonance') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const g = window.__game;
      // The loop is stopped for stills, so process resize explicitly.
      g.scale.getParentBounds(); g.scale.refresh(); g.step(performance.now(), 0);
    });
    await page.screenshot({ path: 'artifacts/super-canto/narrow.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      const g = window.__game, s = g.scene.getScene('FightScene');
      g.scale.getParentBounds(); g.scale.refresh();
      s.superMove.update(16);
      if (s.superMove.victim.x !== s.superMove.victimX) throw new Error('Reduced motion did not stop impact shake');
      g.step(performance.now(), 0);
      const bounds = g.canvas.getBoundingClientRect();
      if (bounds.bottom > innerHeight + 1 || bounds.top < -1) throw new Error('Cinematic is cropped after resizing');
    });
    await page.screenshot({ path: 'artifacts/super-canto/reduced-motion.png' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
}
const state = await page.evaluate(() => {
  const s = window.__game.scene.getScene('FightScene');
  return { energy: s.player.energy, health: s.opponent.currentHealth, active: s.superMove.active, state: s.opponent.combatState.state };
});
await writeFile('artifacts/super-canto/inspection.json', JSON.stringify({ errors, state }, null, 2));
await browser.close();
if (errors.length || state.health !== 40 || state.active) throw new Error(JSON.stringify({ errors, state }));
console.log('Captured full meter, opener, portrait, vocal barrage, final impact and recovery. Exactly 60 damage; no runtime/resource errors.');
