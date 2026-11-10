import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function boot(page: Page, fight = true) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  if (fight) {
    await page.keyboard.press('Enter');
    await confirmSelection(page);
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
    await page.evaluate(() => { (window as any).__game.loop.stop(); });
  }
}

test('only frontal guard stops the confirmed super in either direction', async ({ page }) => {
  await boot(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return [true, false].flatMap(right => [true, false].map(front => {
      s.superMove.cancel(); p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = right ? 600 : 1100; o.x = right ? 1000 : 700;
      p.updateFacing(o.x); o.facingRight = front ? !right : right;
      o.combatState.setState('BLOCKING'); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      const result = { front, confirmed: s.superMove.active, health: o.currentHealth };
      s.superMove.cancel(); return result;
    }));
  });
  for (const r of results) {
    expect(r.confirmed).toBe(!r.front);
    expect(r.health).toBe(r.front ? 100 : 96);
  }
});

test('interrupting a released opener prevents a delayed super confirmation', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = 600; o.x = 1100; p.updateFacing(o.x); o.updateFacing(p.x);
    p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 24; i++) p.update(1000 / 60);
    const released = p.sonicWaves.length;
    p.receiveHit(5, 12, 0, false, true);
    for (let i = 0; i < 100; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    return { released, waves: p.sonicWaves.length, active: s.superMove.active, health: o.currentHealth };
  });
  expect(result).toEqual({ released: 1, waves: 0, active: false, health: 100 });
});

test('round end clears a released super opener', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player;
    p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 24; i++) p.update(1000 / 60);
    const released = p.sonicWaves.length;
    p.finishRound('VICTORY');
    return { released, cleared: p.sonicWaves.length, active: s.superMove.active };
  });
  expect(result).toEqual({ released: 1, cleared: 0, active: false });
});

test('new aerial, second-jump and landing drawings are used in gameplay', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.jump(); f.update(100); f.jump();
    const second = f.sprite.texture.key;
    f.executeAttack('LIGHT_PUNCH'); const punch = f.sprite.texture.key;
    f.finishRound('IDLE'); f.jump(); f.update(100); f.executeAttack('HEAVY_KICK');
    const kick = f.sprite.texture.key;
    for (let i = 0; i < 120 && !f.isGrounded; i++) f.update(1000 / 60);
    const landing = f.sprite.texture.key;
    for (let i = 0; i < 45; i++) f.update(1000 / 60);
    return { second, punch, kick, landing, end: f.combatState.state };
  });
  expect(result.second).toContain('DOUBLE_JUMP'); expect(result.punch).toContain('AIR_PUNCH');
  expect(result.kick).toContain('AIR_KICK'); expect(result.landing).toContain('LANDING');
  expect(result.end).toBe('IDLE');
});

test('music switches with scenes, pauses with combat, and mute survives restart', async ({ page }) => {
  await boot(page, false);
  await page.keyboard.press('ArrowDown');
  const currentMusic = () => page.evaluate(() => (window as any).__game.sound.sounds
    .filter((s: any) => s.key.startsWith('music-') && !s.pendingRemove).map((s: any) => ({ key: s.key, playing: s.isPlaying, paused: s.isPaused, mute: s.mute })));
  await expect.poll(currentMusic).toEqual([{ key: 'music-menu', playing: true, paused: false, mute: false }]);
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await currentMusic())[0]?.mute).toBe(true);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  await expect.poll(currentMusic).toEqual([{ key: 'music-fight', playing: true, paused: false, mute: true }]);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await currentMusic())[0]?.paused).toBe(true);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  await expect.poll(currentMusic).toEqual([{ key: 'music-fight', playing: true, paused: false, mute: true }]);
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await currentMusic())[0]?.mute).toBe(false);
});

test('menu arena shortcut opens stage selection and uses the chosen arena', async ({ page }) => {
  await boot(page, false);
  await page.mouse.click(450, 426);
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.mouse.click(640, 370);
  const selection = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SelectionScene');
    return { index: s.stageIndex, phase: s.phase };
  });
  expect(selection).toEqual({ index: 1, phase: 'stage' });
  await page.mouse.click(1080, 630);
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').getMatchData().stageIndex)).toBe(1);
});
