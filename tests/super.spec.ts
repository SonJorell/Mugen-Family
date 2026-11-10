import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function fight(page: Page, stop = true) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.mouse.click(640, 565); // Rival: CPU → Práctica
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  if (stop) await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('empty and incomplete energy bars reject the super and time alone never charges it', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player;
    p.executeAttack('SPECIAL_ATTACK');
    const attack = p.getActiveAttackDef()?.name ?? null;
    for (let i = 0; i < 360; i++) p.update(1000 / 60);
    const idleEnergy = p.energy;
    p.gainEnergy(99); p.executeAttack('SPECIAL_ATTACK');
    return { attack, idleEnergy, energy: p.energy, partialAttack: p.getActiveAttackDef()?.name ?? null, waves: p.sonicWaves.length };
  });
  expect(result).toEqual({ attack: null, idleEnergy: 0, energy: 99, partialAttack: null, waves: 0 });
});

test('real normal hits charge both bars once and a full bar pays exactly one super', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = 600; o.x = 700; p.updateFacing(o.x); o.updateFacing(p.x);
    for (let hit = 0; hit < 7; hit++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.executeAttack('LIGHT_PUNCH');
      for (let i = 0; i < 25; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    }
    s.hud.update(p, o, 99);
    const before = { player: p.energy, opponent: o.energy, health: o.currentHealth,
      label: s.hud.chantLabels[0].text, width: s.hud.chantBars[0].displayWidth };
    p.executeAttack('SPECIAL_ATTACK');
    const spent = p.energy;
    for (let i = 0; i < 120; i++) p.update(1000 / 60);
    p.executeAttack('SPECIAL_ATTACK');
    return { before, spent, second: p.getActiveAttackDef()?.name ?? null };
  });
  expect(result.before).toMatchObject({ player: 100, opponent: 49, health: 65, width: 260 });
  expect(result.before.label).toContain('SÚPER LISTO');
  expect(result.spent).toBe(0); expect(result.second).toBeNull();
});

test('a confirmed opener runs the entire cinematic once, freezes combat time and deals sixty damage in both directions', async ({ page }) => {
  await fight(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return [true, false].map(right => {
      p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = right ? 600 : 1100; o.x = right ? 900 : 800; p.updateFacing(o.x); o.updateFacing(p.x);
      p.gainEnergy?.(100); p.executeAttack('SPECIAL_ATTACK');
      for (let i = 0; i < 70 && !s.superMove?.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      const started = s.superMove?.active ?? false, timer = s.roundSystem.timeLeft;
      const position = [p.x, p.y, o.x, o.y];
      p.executeAttack('LIGHT_PUNCH'); o.jump(); o.executeAttack('LIGHT_KICK');
      for (let i = 0; i < 150; i++) s.update(0, 1000 / 60);
      const during = { timer: s.roundSystem.timeLeft, position: [p.x, p.y, o.x, o.y], health: o.currentHealth };
      for (let i = 0; i < 40; i++) s.update(0, 1000 / 60);
      return { started, timer, position, during, health: o.currentHealth, state: o.combatState.state,
        active: s.superMove?.active, energy: p.energy, visible: [p.sprite.visible, o.sprite.visible] };
    });
  });
  for (const r of results) {
    expect(r.started).toBe(true); expect(r.during.timer).toBe(r.timer); expect(r.during.position).toEqual(r.position);
    expect(r.during.health).toBeGreaterThan(40); expect(r.health).toBe(40); expect(r.state).toBe('STUNNED');
    expect(r.active).toBe(false); expect(r.energy).toBe(0); expect(r.visible).toEqual([true, true]);
  }
});

test('blocking, jumping out of the wave and leaving its range prevent the cinematic and massive damage', async ({ page }) => {
  await fight(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return ['block', 'jump', 'range', 'invulnerable', 'interrupt'].map(mode => {
      p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = 600; o.x = mode === 'range' ? 1450 : 900; p.updateFacing(o.x); o.updateFacing(p.x);
      if (mode === 'block') o.combatState.setState('BLOCKING');
      if (mode === 'jump') { o.y = 100; o.isGrounded = false; }
      if (mode === 'invulnerable') o.combatState.setState('GETTING_UP');
      p.gainEnergy?.(100); p.executeAttack('SPECIAL_ATTACK');
      if (mode === 'interrupt') p.receiveHit(5, 12, 0, false, true);
      for (let i = 0; i < 120; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      return { mode, active: s.superMove?.active ?? false, health: o.currentHealth, waves: p.sonicWaves.length, energy: p.energy };
    });
  });
  for (const r of results) {
    expect(r.active).toBe(false); expect(r.health).toBe(100); expect(r.waves).toBe(0);
    expect(r.energy).toBe(r.mode === 'interrupt' ? 7 : 0);
  }
});

test('super damage cannot recharge energy or end the round before the final note', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = 600; o.x = 800; o.currentHealth = 10; p.updateFacing(o.x); o.updateFacing(p.x);
    p.gainEnergy?.(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 80 && !s.superMove?.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    for (let i = 0; i < 100; i++) s.update(0, 1000 / 60);
    const during = s.roundSystem.phase;
    for (let i = 0; i < 100; i++) s.update(0, 1000 / 60);
    return { during, phase: s.roundSystem.phase, health: o.currentHealth, energy: [p.energy, o.energy], active: s.superMove?.active };
  });
  expect(result).toEqual({ during: 'FIGHT', phase: 'END', health: 0, energy: [0, 0], active: false });
});

test('pausing a cinematic freezes its damage and restart clears the scene, sound and energy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  await fight(page, false);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 600; s.opponent.x = 850; s.player.gainEnergy?.(100);
  });
  await page.keyboard.press('KeyO');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').superMove?.active)).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  const snapshot = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { time: s.superMove.elapsed, health: s.opponent.currentHealth, soundPaused: s.superMove.sound?.isPaused };
  });
  const paused = await snapshot(); expect(paused.soundPaused).toBe(true);
  await page.waitForTimeout(450); expect(await snapshot()).toEqual(paused);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).time).toBeGreaterThan(paused.time);
  expect((await snapshot()).soundPaused).toBe(false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect.poll(async () => ({ errors, active: await page.evaluate(() => (window as any).__game.scene.isActive('FightScene')) }))
    .toEqual({ errors: [], active: true });
  expect(await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    return { active: s.superMove.active, energy: s.player.energy, health: s.opponent.currentHealth,
      sounds: g.sound.sounds.filter((a: any) => a.key === 'super-canto' && !a.pendingRemove).length };
  })).toEqual({ active: false, energy: 0, health: 100, sounds: 0 });
});

for (const defense of ['guard', 'double jump'] as const) for (const fromRight of [true, false]) {
  test(`real keyboard ${defense} avoids a charged opponent super from the ${fromRight ? 'right' : 'left'}`, async ({ page }) => {
    await fight(page, false);
    if (defense === 'guard') await page.keyboard.down('KeyL');
    await page.evaluate(right => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.player.x = right ? 700 : 1100; s.opponent.x = right ? 1100 : 700;
      s.opponent.updateFacing(s.player.x); s.player.updateFacing(s.opponent.x);
      s.opponent.gainEnergy(100); s.opponent.executeAttack('SPECIAL_ATTACK');
    }, fromRight);
    if (defense === 'double jump') {
      // Keep each press across a rendered frame: Phaser clears JustDown on keyup.
      await page.keyboard.press('KeyW', { delay: 60 });
      await page.waitForTimeout(370);
      await page.keyboard.press('KeyW', { delay: 60 });
      expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.jumpsUsed)).toBe(2);
    }
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      return { health: s.player.currentHealth, energy: s.opponent.energy, active: s.superMove.active };
    });
    expect(result).toEqual({ health: 100, energy: 0, active: false });
  });
}
