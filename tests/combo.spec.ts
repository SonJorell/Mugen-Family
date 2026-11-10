import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/**
 * Player presses `first`, then presses `second` on the first frame after `first` touches the
 * dummy (or after `pressAfterMs` when it misses). Steps the real scene update. Reports hits,
 * the combo shown and the started attacks.
 */
async function chain(page: Page, first: string, second: string, opts: { far?: boolean } = {}) {
  return page.evaluate(({ first, second, far }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset(); s.comboDisplay.clear();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = far ? 1300 : 905; p.updateFacing(o.x); o.updateFacing(p.x);
    const healthBefore = o.currentHealth;
    let press: string | null = first, contactSeen = false, frames = 0;
    const map: Record<string, string> = { LIGHT_PUNCH: 'lightPunch', HEAVY_PUNCH: 'heavyPunch', LIGHT_KICK: 'lightKick', HEAVY_KICK: 'heavyKick' };
    p.input.getState = () => { const key = press; press = null; return key ? { [map[key]]: true } : {}; };
    const started: string[] = [];
    let last = '', shown = '', maxHits = 0;
    for (; frames < 120; frames++) {
      s.update(0, 1000 / 60);
      if (!contactSeen && (p.hasHitThisSwing || (far && p.combatState.stateTimer > 120))) { contactSeen = true; press = second; }
      const now = p.combatState.state === 'ATTACKING' ? `${p.attackSerial}:${p.combatState.attackName}` : '';
      if (now && now !== last) started.push(p.combatState.attackName);
      last = now;
      shown = s.comboDisplay.shown(0) || shown;
      maxHits = Math.max(maxHits, s.combos.get(p)?.hits ?? 0);
    }
    return { started, damage: healthBefore - o.currentHealth, shown, maxHits, after: s.comboDisplay.shown(0) };
  }, { first, second, far: !!opts.far });
}

test('a light punch that connects cancels into a heavy punch, and the counter shows 2 HITS with the damage', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await chain(page, 'LIGHT_PUNCH', 'HEAVY_PUNCH');
  expect(r.started).toEqual(['LIGHT_PUNCH', 'HEAVY_PUNCH']);
  expect(r.damage).toBe(17);
  expect(r.maxHits).toBe(2);
  expect(r.shown).toBe('2 HITS');
  const damageLabel = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene')
    .children.getByName('combo-damage-0').text);
  expect(damageLabel).toBe('17 de daño');
});

test('light punch, light kick and heavy kick chain into a 3-hit combo with César too', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 915; p.updateFacing(o.x); o.updateFacing(p.x);
    const queue = ['lightPunch', 'lightKick', 'heavyKick'];
    const consumed = new Set<number>();
    let pending: string | null = queue.shift()!;
    p.input.getState = () => { const key = pending; pending = null; return key ? { [key]: true } : {}; };
    let maxHits = 0;
    const log: string[] = [];
    for (let f = 0; f < 150; f++) {
      s.update(0, 1000 / 60);
      // Press the next button on the first frame after each attack touches the dummy.
      if (p.hasHitThisSwing && !consumed.has(p.attackSerial) && queue.length) { consumed.add(p.attackSerial); pending = queue.shift()!; }
      maxHits = Math.max(maxHits, parseInt(s.comboDisplay.shown(0)) || 0);
      log.push(`${f} ${p.combatState.state}:${p.combatState.attackName} o=${o.combatState.state} dx=${Math.round(o.x - p.x)}`);
    }
    if (maxHits !== 3) return { maxHits, log: log.slice(0, 50).join('\n') };
    return { maxHits, state: o.combatState.state };
  });
  expect(r.maxHits, (r as any).log).toBe(3);
});

test('a missed light punch cannot be cancelled, and a heavy punch never cancels into a light one', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const whiff = await chain(page, 'LIGHT_PUNCH', 'HEAVY_PUNCH', { far: true });
  expect(whiff.started).toEqual(['LIGHT_PUNCH']);
  const heavy = await chain(page, 'HEAVY_PUNCH', 'LIGHT_PUNCH');
  expect(heavy.started).toEqual(['HEAVY_PUNCH']);
  expect(heavy.maxHits).toBe(1);
  expect(heavy.shown).toBe('');
});

test('the counter ends when the defender recovers and fades after a moment', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await chain(page, 'LIGHT_PUNCH', 'HEAVY_PUNCH');
  expect(r.shown).toBe('2 HITS');
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('FightScene').comboDisplay.shown(0)),
    { timeout: 5000 }).toBe('');
});

test('a hard CPU cancels its connected light punch into a heavy punch', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { difficulty: 'hard', cpuSeed: 5 });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    let combos = 0;
    for (let t = 0; t < 10; t++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 905; p.updateFacing(o.x); o.updateFacing(p.x);
      o.executeAttack('LIGHT_PUNCH');
      let heavy = false;
      for (let f = 0; f < 30; f++) {
        o.think(1000 / 60, p);
        p.update(1000 / 60); o.update(1000 / 60);
        s.fighterController.checkCollisions(o, p);
        if (o.combatState.attackName === 'HEAVY_PUNCH') heavy = true;
      }
      if (heavy) combos++;
    }
    return combos;
  });
  expect(r).toBeGreaterThan(5);
});
