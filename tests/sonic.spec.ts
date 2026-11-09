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

test('singing launches a travelling wave that damages once and stuns at range in both directions', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return [true, false].map(right => {
      p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = right ? 600 : 1100; o.x = right ? 1000 : 700;
      p.updateFacing(o.x); o.updateFacing(p.x);
      p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 15; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      const beforeArrival = o.currentHealth;
      for (let i = 0; i < 60; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      const hit = { health: o.currentHealth, state: o.combatState.state, frame: o.sprite.texture.key };
      o.jump(); o.executeAttack('LIGHT_PUNCH');
      const cannotAct = o.combatState.state === 'STUNNED' && o.isGrounded;
      for (let i = 0; i < 120; i++) o.update(1000 / 60);
      return { beforeArrival, hit, cannotAct, recovered: o.combatState.state };
    });
  });
  for (const r of result) {
    expect(r.beforeArrival).toBe(100);
    expect(r.hit.health).toBe(80);
    expect(r.hit.state).toBe('STUNNED');
    expect(r.hit.frame).toContain('STUN');
    expect(r.cannotAct).toBe(true);
    expect(r.recovered).toBe('IDLE');
  }
});

test('sonic wave can be blocked or jumped over, expires, and cannot be spammed', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    const run = (mode: string) => {
      p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = 600; o.x = 1000; p.updateFacing(o.x); o.updateFacing(p.x);
      if (mode === 'block') o.combatState.setState('BLOCKING');
      if (mode === 'jump') { o.y = 280; o.isGrounded = false; }
      p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 90; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      p.executeAttack('SPECIAL_ATTACK');
      const rejected = p.getActiveAttackDef() === null;
      for (let i = 0; i < 90; i++) p.update(1000 / 60);
      p.executeAttack('SPECIAL_ATTACK');
      return { health: o.currentHealth, stunned: o.combatState.state === 'STUNNED', rejected,
        recharged: p.getActiveAttackDef()?.name === 'SPECIAL_ATTACK', remaining: p.sonicWaves?.length ?? -1 };
    };
    return [run('block'), run('jump')];
  });
  expect(result[0]).toEqual({ health: 98, stunned: false, rejected: true, recharged: true, remaining: 0 });
  expect(result[1]).toEqual({ health: 100, stunned: false, rejected: true, recharged: true, remaining: 0 });
});

test('interrupting the chant cancels release and round end clears released waves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player;
    p.executeAttack('SPECIAL_ATTACK'); p.update(16); p.receiveHit(5, 12, 80, false, false);
    for (let i = 0; i < 40; i++) p.update(16);
    const cancelled = p.sonicWaves?.length ?? -1;
    p.finishRound('IDLE'); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 20; i++) p.update(16);
    const released = p.sonicWaves?.length ?? -1;
    p.finishRound('VICTORY');
    return { cancelled, released, cleared: p.sonicWaves?.length ?? -1 };
  });
  expect(result).toEqual({ cancelled: 0, released: 1, cleared: 0 });
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
