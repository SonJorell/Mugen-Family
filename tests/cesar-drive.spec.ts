import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function fight(page: Page, live = false) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE');
  await page.mouse.click(524, 528);
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  if (!live) await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('César needs full energy and a close grounded unguarded target to confirm his grab', async ({ page }) => {
  await fight(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return ['empty', 'partial', 'distant', 'block', 'jump', 'invulnerable', 'interrupted', 'hit'].map(mode => {
      s.superMove.cancel(); p.finishRound('IDLE'); o.finishRound('IDLE');
      p.resetForRound(600); o.resetForRound(715);
      p.x = 600; o.x = mode === 'distant' ? 1100 : 715;
      p.updateFacing(o.x); o.updateFacing(p.x);
      if (mode !== 'empty') p.gainEnergy(mode === 'partial' ? 99 : 100);
      if (mode === 'block') o.combatState.setState('BLOCKING');
      if (mode === 'jump') { o.isGrounded = false; o.y = 100; }
      if (mode === 'invulnerable') o.combatState.setState('GETTING_UP');
      p.executeAttack('SPECIAL_ATTACK');
      if (mode === 'interrupted') p.receiveHit(5, 12, 0, false, true);
      let waves = 0;
      for (let i = 0; i < 130 && !s.superMove.active; i++) {
        p.update(1000 / 60); waves += p.sonicWaves.length; s.fighterController.checkCollisions(p, o);
      }
      return { mode, active: s.superMove.active, health: o.currentHealth, energy: p.energy, waves };
    });
  });
  for (const r of results) {
    expect(r.waves, r.mode).toBe(0);
    expect(r.active, r.mode).toBe(r.mode === 'hit');
    expect(r.health, r.mode).toBe(r.mode === 'hit' ? 96 : 100);
    expect(r.energy, r.mode).toBe(r.mode === 'partial' ? 99 : r.mode === 'interrupted' ? 7 : 0);
  }
});

for (const right of [true, false]) test(`César throws, enters the i30, hits once and returns with his can from the ${right ? 'left' : 'right'}`, async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(right => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = right ? 600 : 1320; o.x = right ? 715 : 1205;
    p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    const start = { active: s.superMove.active, energy: p.energy, health: o.currentHealth, timer: s.roundSystem.timeLeft };
    const layer = s.children.getByName('super-cinematic');
    const stepTo = (time: number) => { while (s.superMove.active && s.superMove.elapsed + 0.01 < time) s.update(0, Math.min(1000 / 60, time - s.superMove.elapsed)); };
    stepTo(1100);
    const airborne = { y: layer?.getByName('drive-victim')?.y, x: layer?.getByName('drive-victim')?.x };
    stepTo(1800);
    const entering = layer?.getByName('drive-entry')?.visible;
    stepTo(2700);
    const car = layer?.getByName('drive-car'), earlyCar = car?.x;
    stepTo(3200);
    const lateCar = car?.x, beforeHit = o.currentHealth;
    stepTo(3400);
    const impact = { health: o.currentHealth, active: s.superMove.active, timer: s.roundSystem.timeLeft };
    stepTo(4750);
    const caster = layer?.getByName('drive-caster');
    const victimBounds = layer?.getByName('drive-victim')?.getBounds();
    const returning = { visible: caster?.visible, texture: caster?.texture?.key, carVisible: car?.visible,
      targetInside: victimBounds?.left >= 0 && victimBounds?.right <= 1280 };
    stepTo(5800);
    const afterEnd = [p.x, o.x];
    // Step one live combat frame to verify PhysicsSystem does not snap either fighter.
    s.update(0, 1000 / 60);
    const snap = [Math.abs(p.x - afterEnd[0]), Math.abs(o.x - afterEnd[1])];
    return { start, airborne, entering, earlyCar, lateCar, beforeHit, impact, returning, snap,
      end: { active: s.superMove.active, health: o.currentHealth, x: afterEnd[0], targetX: afterEnd[1], grounded: o.isGrounded,
        energy: [p.energy, o.energy], visible: [p.sprite.visible, o.sprite.visible],
        onScreen: afterEnd.every(x => x - s.cameras.main.scrollX >= 40 && x - s.cameras.main.scrollX <= 1240),
        layers: s.children.getAll().filter((c: any) => c.name === 'super-cinematic').length } };
  }, right);
  expect(result.start).toMatchObject({ active: true, energy: 0, health: 96 });
  expect(result.airborne.y).toBeLessThan(520);
  expect(result.entering).toBe(true);
  expect(right ? result.lateCar - result.earlyCar : result.earlyCar - result.lateCar).toBeGreaterThan(180);
  expect(result.beforeHit).toBe(84);
  expect(result.impact).toEqual({ health: 40, active: true, timer: result.start.timer });
  expect(result.returning).toEqual({ visible: true, texture: 'cesar-drive-celebrate', carVisible: false, targetInside: true });
  expect(result.end).toEqual({ active: false, health: 40, x: right ? 600 : 1320, targetX: right ? 1680 : 240,
    grounded: true, energy: [0, 0], visible: [true, true], onScreen: true, layers: 0 });
  expect(result.snap[0]).toBeLessThan(1);
  expect(result.snap[1]).toBeLessThan(8);
});

test('cancelling the i30 cinematic removes the car and prevents delayed damage or relocation', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = 600; o.x = 715; p.updateFacing(o.x); o.updateFacing(p.x);
    p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    s.superMove.update(2000); const health = o.currentHealth;
    s.superMove.cancel(); s.superMove.update(10000);
    return { health, after: o.currentHealth, x: [p.x, o.x], active: s.superMove.active,
      visible: [p.sprite.visible, o.sprite.visible], layer: !!s.children.getByName('super-cinematic'),
      sounds: s.sound.sounds.filter((a: any) => a.key === 'super-drive' && !a.pendingRemove).length };
  });
  expect(result).toEqual({ health: 84, after: 84, x: [600, 715], active: false, visible: [true, true], layer: false, sounds: 0 });
});

test('the fatal i30 hit waits for the return, respects reduced motion and uses the current arena', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    s.cycleStage(); p.x = 600; o.x = 715; o.currentHealth = 10;
    p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    const layer = s.children.getByName('super-cinematic'), stage = layer.list[0].texture.key;
    while (s.superMove.active && s.superMove.elapsed < 3400) s.update(0, 1000 / 60);
    const impact = { health: o.currentHealth, phase: s.roundSystem.phase, active: s.superMove.active, offset: [layer.x, layer.y] };
    while (s.superMove.active) s.update(0, 1000 / 60);
    return { stage, impact, after: { health: o.currentHealth, phase: s.roundSystem.phase, active: s.superMove.active } };
  });
  expect(result.stage).toBe('stage_arica_chinchorro');
  expect(result.impact).toEqual({ health: 0, phase: 'FIGHT', active: true, offset: [0, 0] });
  expect(result.after).toEqual({ health: 0, phase: 'END', active: false });
});

test('pausing the i30 cinematic freezes its soundtrack and damage and restarting clears it', async ({ page }) => {
  await fight(page, true);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 600; s.opponent.x = 715; s.player.gainEnergy(100);
  });
  await page.keyboard.press('KeyO', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').superMove.active);
  await page.keyboard.press('Escape', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  const read = () => page.evaluate(() => { const s = (window as any).__game.scene.getScene('FightScene');
    return { elapsed: s.superMove.elapsed, health: s.opponent.currentHealth, key: s.superMove.sound?.key, paused: s.superMove.sound?.isPaused }; });
  const paused = await read();
  expect(paused.key).toBe('super-drive'); expect(paused.paused).toBe(true);
  await page.waitForTimeout(350); expect(await read()).toEqual(paused);
  await page.keyboard.press('Escape', { delay: 60 });
  await expect.poll(async () => (await read()).elapsed).toBeGreaterThan(paused.elapsed);
  await page.keyboard.press('Escape', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  expect(await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { active: s.superMove.active, health: s.opponent.currentHealth, energy: s.player.energy, layer: !!s.children.getByName('super-cinematic') };
  })).toEqual({ active: false, health: 100, energy: 0, layer: false });
});

test('non-Tilin opponents play animated combat reaction poses during César\'s i30 cinematic', async ({ page }) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.stop('MenuScene');
    g.scene.start('FightScene', { mode: 'training', stageIndex: 0,
      playerChoice: { characterId: 'cesar', paletteId: 'original' },
      opponentChoice: { characterId: 'joako', paletteId: 'original' } });
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 15000 });
  const keys = await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    g.loop.stop();
    s.player.resetForRound(600); s.opponent.resetForRound(715);
    s.superMove.start(s.player, s.opponent);
    const victim = s.children.getByName('super-cinematic').getByName('drive-victim');
    const seen: string[] = [];
    for (const at of [300, 1000, 2600, 3600, 4800]) {
      s.superMove.update(at - s.superMove.elapsed);
      seen.push(victim.texture.key);
    }
    s.superMove.cancel();
    return seen;
  });
  expect(keys[0]).toContain('joako_HIT_REACTION');
  expect(keys[1]).toContain('joako_KNOCKDOWN');
  expect(keys[2]).toContain('joako_STUN');
  expect(keys[3]).toContain('joako_KNOCKDOWN');
  expect(keys[4]).toContain('joako_GET_UP');
});
