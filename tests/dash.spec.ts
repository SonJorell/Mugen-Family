import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/** Feeds [frames, input] steps to the player through the real scene update. */
async function run(page: Page, steps: [number, Record<string, boolean>][], frames = 40) {
  return page.evaluate(({ steps, frames }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 1200; p.updateFacing(o.x); o.updateFacing(p.x);
    const queue: Record<string, boolean>[] = [];
    for (const [n, input] of steps) for (let i = 0; i < n; i++) queue.push(input);
    p.input.getState = () => queue.shift() ?? {};
    const startX = p.x, states = new Set<string>();
    let dashBack: boolean | null = null, attack = '';
    for (let f = 0; f < frames; f++) {
      s.update(0, 1000 / 60);
      states.add(p.combatState.state);
      if (p.combatState.state === 'DASHING') dashBack = p.dashBack;
      if (p.combatState.state === 'ATTACKING') attack = p.combatState.attackName;
    }
    return { moved: Math.round(p.x - startX), dashed: states.has('DASHING'), dashBack, attack };
  }, { steps, frames });
}

test('a double tap forward dashes, and covers more ground than walking', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const dash = await run(page, [[3, { moveRight: true }], [3, {}], [3, { moveRight: true }]], 30);
  expect(dash.dashed).toBe(true);
  expect(dash.dashBack).toBe(false);
  const walk = await run(page, [[30, { moveRight: true }]], 30);
  expect(walk.dashed).toBe(false);
  expect(dash.moved).toBeGreaterThan(walk.moved + 20);
});

test('slow taps, holding forward, and the ↓ ↘ → + punch command never dash', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  expect((await run(page, [[3, { moveRight: true }], [20, {}], [3, { moveRight: true }]])).dashed).toBe(false);
  expect((await run(page, [[40, { moveRight: true }]])).dashed).toBe(false);
  const command = await run(page, [[4, { crouch: true }], [3, { crouch: true, moveRight: true }], [2, { moveRight: true }],
    [1, { moveRight: true, lightPunch: true }]]);
  expect(command.dashed).toBe(false);
  expect(command.attack).toBe('RUSH');
});

test('a back dash starts invulnerable and its recovery can be punished', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    const reset = () => { p.finishRound('IDLE'); o.finishRound('IDLE'); p.x = 800; o.x = 950; p.updateFacing(o.x); o.updateFacing(p.x); p.input.getState = () => ({}); };
    reset();
    p.dash(true);
    s.update(0, 1000 / 60);
    const early = p.receiveHit(10, 18, 100, false, true);
    reset();
    p.dash(true);
    // Run into the recovery (after the invulnerable start and the active slide).
    for (let f = 0; f < 15; f++) s.update(0, 1000 / 60);
    const stateInRecovery = p.combatState.state;
    const late = p.receiveHit(10, 18, 100, false, true);
    return { early, stateInRecovery, late };
  });
  expect(r.early).toBe('ignored');
  expect(r.stateInRecovery).toBe('DASHING');
  expect(r.late).toBe('hit');
});

test('the dash key dashes toward the held direction, for both players and the gamepad LB', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { id: 'Test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    (window as any).__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
  await startFight(page, 'tilin', 'cesar', { mode: 'versus' });
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 700; s.opponent.x = 1200;
    (window as any).__game.loop.start((window as any).__game.loop.callback);
  });
  const dashed = (who: 'player' | 'opponent') => page.evaluate(w => {
    const f = (window as any).__game.scene.getScene('FightScene')[w];
    return f.combatState.state === 'DASHING' ? (f.dashBack ? 'back' : 'forward') : null;
  }, who);
  await page.keyboard.press('Space', { delay: 60 });
  await expect.poll(() => dashed('player')).toBe('forward');
  await page.waitForTimeout(450);
  await page.keyboard.down('a');
  await page.keyboard.press('Space', { delay: 60 });
  await expect.poll(() => dashed('player')).toBe('back');
  await page.keyboard.up('a');
  await page.waitForTimeout(450);
  await page.keyboard.press('Backspace', { delay: 60 });
  await expect.poll(() => dashed('opponent')).toBe('forward');
  await page.waitForTimeout(450);
  await page.evaluate(() => { const pad = (window as any).__pad; pad.buttons[4] = { pressed: true, touched: true, value: 1 }; pad.timestamp = performance.now(); });
  await expect.poll(() => dashed('player')).toBe('forward');
});

test('the CPU dashes in from far away and back-dashes out of attacks depending on difficulty', async ({ page }) => {
  const counts: Record<string, { dash: number; back: number }> = {};
  for (const difficulty of ['easy', 'hard']) {
    await startFight(page, 'tilin', 'tilin', { difficulty, cpuSeed: 17 });
    counts[difficulty] = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      const p = s.player, o = s.opponent;
      p.input.getState = () => ({});
      let dash = 0, back = 0;
      for (let t = 0; t < 40; t++) {
        p.finishRound('IDLE'); o.finishRound('IDLE');
        p.x = 600; o.x = 1100; p.updateFacing(o.x); o.updateFacing(p.x);
        o.decisionTimer = 0; o.think(1000 / 60, p);
        if (o.combatState.state === 'DASHING' && !o.dashBack) dash++;
        o.finishRound('IDLE');
        p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
        p.executeAttack('HEAVY_KICK');
        o.decisionTimer = 0; o.think(1000 / 60, p);
        if (o.combatState.state === 'DASHING' && o.dashBack) back++;
        p.finishRound('IDLE');
      }
      return { dash, back };
    });
  }
  expect(counts.easy.back).toBe(0);
  expect(counts.hard.dash).toBeGreaterThan(counts.easy.dash);
  expect(counts.hard.back).toBeGreaterThan(0);
});

test('the dash key can be remapped in Controles and shows in the move list', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const labels = await page.evaluate(async () => {
    const { REMAPPABLE, ACTION_LABELS } = await import('/src/input/Bindings.ts');
    return REMAPPABLE.map((a: string) => ACTION_LABELS[a]);
  });
  expect(labels).toContain('Dash');
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').showMoveList(true));
  const text = await page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => { if (!c.visible) return; if (typeof c.text === 'string') texts.push(c.text); if (c.list) walk(c.list); });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts.join('\n');
  });
  expect(text).toContain('Dash');
  expect(text).toContain('Espacio');
  expect(text).toContain('doble toque');
});
