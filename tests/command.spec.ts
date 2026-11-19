import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/**
 * Feeds the player a list of [frames, input] steps through the real scene update and reports the
 * attacks started, how far the player travelled and the dummy's health and state.
 */
async function run(page: Page, steps: [number, Record<string, boolean>][], setup: { gap?: number; block?: boolean } = {}) {
  return page.evaluate(({ steps, gap, block }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 700 + gap; p.updateFacing(o.x); o.updateFacing(p.x);
    const startX = p.x, health = o.currentHealth;
    const queue: Record<string, boolean>[] = [];
    for (const [frames, input] of steps) for (let i = 0; i < frames; i++) queue.push(input);
    p.input.getState = () => queue.shift() ?? {};
    const started: string[] = [];
    let last = '', knockedDown = false, blockstun = false;
    for (let f = 0; f < 140; f++) {
      if (block && o.combatState.state === 'IDLE') o.combatState.setState('BLOCKING');
      s.update(0, 1000 / 60);
      const now = p.combatState.state === 'ATTACKING' ? `${p.attackSerial}:${p.combatState.attackName}` : '';
      if (now && now !== last) started.push(p.combatState.attackName);
      last = now;
      knockedDown ||= o.combatState.state === 'KNOCKED_DOWN';
      blockstun ||= o.combatState.state === 'BLOCKSTUN';
    }
    return { started, travelled: Math.round(p.x - startX), damage: health - o.currentHealth, knockedDown, blockstun };
  }, { steps, gap: setup.gap ?? 260, block: !!setup.block });
}

const MOTION: [number, Record<string, boolean>][] = [
  [4, { crouch: true }], [3, { crouch: true, moveRight: true }], [2, { moveRight: true }], [1, { moveRight: true, lightPunch: true }],
];

test('↓ ↘ → + punch makes Tilin dash forward with «Paso veloz» and hit from mid range', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await run(page, MOTION);
  expect(r.started).toEqual(['RUSH']);
  expect(r.travelled).toBeGreaterThan(60);
  expect(r.damage).toBe(9);
});

test('a slow motion or a punch long after the forward step gives a normal punch', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const slow = await run(page, [[4, { crouch: true }], [40, {}], [2, { moveRight: true }], [1, { lightPunch: true }]]);
  expect(slow.started).toEqual(['LIGHT_PUNCH']);
  const late = await run(page, [[4, { crouch: true }], [2, { moveRight: true }], [25, {}], [1, { lightPunch: true }]]);
  expect(late.started).toEqual(['LIGHT_PUNCH']);
  const backwards = await run(page, [[4, { crouch: true }], [2, { moveLeft: true }], [1, { lightPunch: true }]]);
  expect(backwards.started).toEqual(['LIGHT_PUNCH']);
});

test('César\'s «Pisotón sísmico» knocks down up close and leaves him wide open when blocked', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const hit = await run(page, MOTION, { gap: 120 });
  expect(hit.started).toEqual(['STOMP']);
  expect(hit.knockedDown).toBe(true);
  expect(hit.damage).toBe(14);
  const blocked = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 820; p.updateFacing(o.x); o.updateFacing(p.x);
    o.combatState.setState('BLOCKING');
    p.input.getState = () => ({});
    p.executeAttack('COMMAND_SPECIAL');
    let counter = false;
    for (let f = 0; f < 90; f++) {
      s.update(0, 1000 / 60);
      if (o.combatState.canAct() && !counter && o.combatState.state !== 'BLOCKING') { counter = true; o.executeAttack('LIGHT_PUNCH'); }
    }
    return { punished: p.currentHealth < p.maxHealth };
  });
  expect(blocked.punished).toBe(true);
});

test('a light punch that connects cancels into the command special', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await run(page, [[1, { lightPunch: true }], [3, { crouch: true }], [2, { crouch: true, moveRight: true }], [1, { moveRight: true, heavyPunch: true }]], { gap: 105 });
  expect(r.started).toEqual(['LIGHT_PUNCH', 'RUSH']);
  expect(r.damage).toBe(5 + 9);
});

test('the CPU uses its command special when the rival is in range', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { difficulty: 'hard', cpuSeed: 21 });
  const used = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    for (let t = 0; t < 40; t++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 900; p.updateFacing(o.x); o.updateFacing(p.x);
      o.decisionTimer = 0; o.attackCooldown = 0;
      o.think(1000 / 60, p);
      if (o.combatState.attackName === 'STOMP') return t;
    }
    return -1;
  });
  expect(used).toBeGreaterThanOrEqual(0);
});

test('the real keyboard performs the motion, and the move list explains it', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 700; s.opponent.x = 960;
    (window as any).__game.loop.start((window as any).__game.loop.callback);
  });
  await page.keyboard.down('s'); await page.waitForTimeout(90);
  await page.keyboard.down('d'); await page.waitForTimeout(60);
  await page.keyboard.up('s'); await page.waitForTimeout(60);
  await page.keyboard.press('j', { delay: 60 });
  await page.keyboard.up('d');
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.combatState.attackName)).toBe('RUSH');
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.evaluate(() => (window as any).__game.scene.getScene('PauseScene').showMoveList(true));
  const text = await page.evaluate(() => {
    const texts: string[] = [];
    const walk = (items: any[]) => items.forEach(c => { if (!c.visible) return; if (typeof c.text === 'string') texts.push(c.text); if (c.list) walk(c.list); });
    walk((window as any).__game.scene.getScene('PauseScene').children.list);
    return texts.join('\n');
  });
  expect(text).toContain('Paso veloz  ·  ↓ ↘ → + Puño');
  expect(text).toContain('Pisotón sísmico  ·  ↓ ↘ → + Puño');
});

test('a punch in the air after ↓ → performs an air punch instead of swallowing it, and ↓ + K stays launcher', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const air = await run(page, [
    [2, { crouch: true }], [2, { moveRight: true }], [1, { jump: true }], [3, {}], [1, { lightPunch: true }],
  ]);
  expect(air.started).toEqual(['LIGHT_PUNCH']);
  const launcher = await run(page, [
    [2, { crouch: true }], [2, { moveRight: true }], [1, { crouch: true, heavyPunch: true }],
  ], { gap: 110 });
  expect(launcher.started).toEqual(['LAUNCHER']);
});
