import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

const pauseLabels = (page: Page) => page.evaluate(() =>
  (window as any).__game.scene.getScene('PauseScene').items.map((i: any) => i.label));

async function pause(page: Page) {
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
}

/** Turns on the practice tools in rows 5, 6 and 7 of the pause menu with the keyboard. */
async function enableAll(page: Page) {
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  for (let row = 5; row <= 7; row++) {
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').selectedIndex)).toBe(row);
    await page.keyboard.press('Enter');
    if (row < 7) await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__game.scene.isActive('PauseScene'));
  await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('practice tools appear only in the practice mode pause and toggle with the keyboard', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'cpu' });
  await pause(page);
  expect(await pauseLabels(page)).toHaveLength(5);
  await page.evaluate(() => { const g = (window as any).__game; g.scene.stop('PauseScene'); g.scene.stop('FightScene'); });

  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  await pause(page);
  expect((await pauseLabels(page)).slice(5)).toEqual(['VISOR DE ENTRADAS: NO', 'DATOS DE FRAMES: NO', 'VIDA QUE SE RECUPERA: NO']);
  await enableAll(page);
  const options = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').trainingOptions);
  expect(options).toEqual({ inputs: true, frames: true, refill: true });
});

test('frame data shows startup, active, recovery and the advantage of a blocked heavy kick', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const text = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.setTrainingOptions({ inputs: true, frames: true, refill: false });
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
    o.combatState.setState('BLOCKING');
    let pressed = false;
    p.input.getState = () => { const first = !pressed; pressed = true; return { heavyKick: first, moveRight: false }; };
    for (let f = 0; f < 40; f++) { if (o.combatState.state === 'IDLE') o.combatState.setState('BLOCKING'); s.update(0, 1000 / 60); }
    return { frames: s.children.getByName('training-frames').text, inputs: s.children.getByName('training-inputs').text };
  });
  expect(text.frames).toContain('Patada fuerte');
  expect(text.frames).toContain('Inicio 6 · Activo 8 · Recup. 16');
  // Contact on the first active frame: 24 frames left for the attacker, 12 of blockstun → −12.
  expect(text.frames).toMatch(/Al bloquear: −1[0-2]/);
  expect(text.inputs).toContain('KF');
});

test('frame data on hit: an uncancelled light punch is slightly minus, which is why it cancels into heavies', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const frames = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.setTrainingOptions({ inputs: false, frames: true, refill: false });
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 905; p.updateFacing(o.x); o.updateFacing(p.x);
    let pressed = false;
    p.input.getState = () => { const first = !pressed; pressed = true; return { lightPunch: first }; };
    for (let f = 0; f < 30; f++) s.update(0, 1000 / 60);
    return s.trainingOverlay.lastAttack;
  });
  expect(frames).toMatchObject({ name: 'LIGHT_PUNCH', startup: 2, active: 6, recovery: 8 });
  expect(frames.onHit).toBeLessThan(0);
  expect(frames.onBlock).toBeLessThan(0);
});

test('with health refill on, both fighters recover once the combo is over', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training', training: { inputs: false, frames: false, refill: true } });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 915; p.updateFacing(o.x); o.updateFacing(p.x);
    let pressed = false;
    p.input.getState = () => { const first = !pressed; pressed = true; return { lightPunch: first }; };
    let lowest = o.currentHealth;
    for (let f = 0; f < 40; f++) { s.update(0, 1000 / 60); lowest = Math.min(lowest, o.currentHealth); }
    const midway = o.currentHealth;
    for (let f = 0; f < 70; f++) s.update(0, 1000 / 60);
    return { lowest, midway, end: o.currentHealth, max: o.maxHealth };
  });
  expect(r.lowest).toBeLessThan(r.max);
  expect(r.midway).toBeLessThan(r.max);
  expect(r.end).toBe(r.max);
});

test('without refill, damage stays', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 905; p.updateFacing(o.x); o.updateFacing(p.x);
    let pressed = false;
    p.input.getState = () => { const first = !pressed; pressed = true; return { lightPunch: first }; };
    for (let f = 0; f < 150; f++) s.update(0, 1000 / 60);
    return o.currentHealth;
  });
  expect(r).toBe(95);
});

test('practice mode resets in place after a KO instead of returning to the main menu', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    g.loop.start(g.loop.callback);
    // Simulate even a deciding-round KO: practice must stay inside FightScene and reset.
    s.roundSystem._wins = { player: 1, opponent: 0 };
    s.opponent.currentHealth = 0;
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'END');
  await page.waitForFunction(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    return g.scene.isActive('FightScene') && s.roundSystem?.phase === 'FIGHT' && s.opponent.currentHealth === s.opponent.maxHealth;
  }, null, { timeout: 20000 });
  const state = await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    return { active: g.scene.isActive('FightScene'), menu: g.scene.isActive('MenuScene'), wins: s.roundSystem.wins };
  });
  expect(state).toEqual({ active: true, menu: false, wins: { player: 0, opponent: 0 } });
});
