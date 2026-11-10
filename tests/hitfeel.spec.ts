import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/** Lands `attack` from the player on a passive dummy through the real scene update. */
async function landThroughScene(page: Page, attack: string, block = false) {
  return page.evaluate(({ attack, block }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
    if (block) o.combatState.setState('BLOCKING');
    s.cameras.main.resetFX();
    p.executeAttack(attack);
    const health = o.currentHealth;
    let frames = 0;
    while (!s.inHitstop && frames++ < 40) s.update(0, 1000 / 60);
    const contact = { pTimer: p.combatState.stateTimer, oTimer: o.combatState.stateTimer, oX: o.x, clock: s.roundSystem._timeLeft };
    const sparks = s.impacts.count, shaking = s.cameras.main.shakeEffect.isRunning;
    let frozenMs = 0;
    while (s.inHitstop && frozenMs < 400) { s.update(0, 10); frozenMs += 10; }
    const frozen = { pTimer: p.combatState.stateTimer, oTimer: o.combatState.stateTimer, oX: o.x };
    s.update(0, 1000 / 60);
    return { connected: block || o.currentHealth < health, contact, frozen, frozenMs, sparks, shaking,
      clockRan: contact.clock - s.roundSystem._timeLeft, movedAfter: p.combatState.stateTimer > frozen.pTimer };
  }, { attack, block });
}

test('a landed hit freezes both fighters briefly, longer for heavy hits, while the round clock keeps running', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const light = await landThroughScene(page, 'LIGHT_PUNCH');
  const heavy = await landThroughScene(page, 'HEAVY_KICK');
  const blocked = await landThroughScene(page, 'HEAVY_PUNCH', true);
  for (const r of [light, heavy, blocked]) {
    expect(r.connected).toBe(true);
    expect(r.frozen).toEqual({ pTimer: r.contact.pTimer, oTimer: r.contact.oTimer, oX: r.contact.oX });
    expect(r.frozenMs).toBeGreaterThanOrEqual(50);
    expect(r.frozenMs).toBeLessThanOrEqual(120);
    expect(r.clockRan).toBeGreaterThanOrEqual(r.frozenMs / 1000 - 0.001);
    expect(r.movedAfter).toBe(true);
    expect(r.sparks).toBeGreaterThan(0);
  }
  expect(heavy.frozenMs).toBeGreaterThan(light.frozenMs);
  expect(light.shaking).toBe(false);
  expect(heavy.shaking).toBe(true);
  expect(blocked.shaking).toBe(false);
});

test('reduced motion keeps hitstop and sparks but never shakes the camera', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const heavy = await landThroughScene(page, 'HEAVY_KICK');
  expect(heavy.connected).toBe(true);
  expect(heavy.frozenMs).toBeGreaterThanOrEqual(50);
  expect(heavy.sparks).toBeGreaterThan(0);
  expect(heavy.shaking).toBe(false);
});

test('a super that connects clears any pending hitstop', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.hitstopMs = 100;
    s.fighterController.onSuperHit(s.player, s.opponent);
    return { hitstop: s.inHitstop, superActive: s.superMove.active };
  });
  expect(r).toEqual({ hitstop: false, superActive: true });
});
