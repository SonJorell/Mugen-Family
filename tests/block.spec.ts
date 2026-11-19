import { test, expect } from '@playwright/test';
import { startFight } from './fight-helper';

/**
 * Attacker swings `attack` into a guarding defender, stepping both fighters frame by frame.
 * The defender throws a light punch the first frame it can act. Reports what happened.
 */
async function blockThenPunish(page: import('@playwright/test').Page, attack: string, swap = false) {
  return page.evaluate(({ attack, swap }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const a = swap ? s.opponent : s.player, d = swap ? s.player : s.opponent;
    // The human side holds L until its guard has taken the hit, then lets go to counter.
    let holdBlock = true;
    s.player.input.getState = () => ({ block: d === s.player && holdBlock });
    a.finishRound('IDLE'); d.finishRound('IDLE');
    a.x = 800; d.x = 800 + (a.stats.size > 1 || d.stats.size > 1 ? 130 : 110);
    a.updateFacing(d.x); d.updateFacing(a.x);
    d.combatState.setState('BLOCKING');
    const startX = d.x;
    a.executeAttack(attack);
    let sawBlockstun = false, punished = false, punishedWhileAttacking = false, pushed = 0, defenderFreeAt = -1;
    const healthBefore = a.currentHealth, defenderHealth = d.currentHealth;
    for (let frame = 0; frame < 90; frame++) {
      const attackerWasAttacking = a.combatState.state === 'ATTACKING';
      a.update(1000 / 60); d.update(1000 / 60);
      s.fighterController.checkCollisions(a, d);
      s.fighterController.checkCollisions(d, a);
      if (d.combatState.state === 'BLOCKSTUN') { sawBlockstun = true; holdBlock = false; pushed = Math.max(pushed, Math.abs(d.x - startX)); }
      if (sawBlockstun && defenderFreeAt < 0 && d.combatState.canAct()) {
        defenderFreeAt = frame;
        d.executeAttack('LIGHT_PUNCH');
      }
      if (!punished && a.currentHealth < healthBefore) {
        punished = true;
        punishedWhileAttacking = attackerWasAttacking;
      }
    }
    return { sawBlockstun, pushed, punished, punishedWhileAttacking, chip: defenderHealth - d.currentHealth };
  }, { attack, swap });
}

for (const [player, opponent] of [['tilin', 'tilin'], ['cesar', 'tilin'], ['tilin', 'cesar']]) {
  test(`${player} vs ${opponent}: a blocked heavy kick pushes the defender back and leaves the attacker open`, async ({ page }) => {
    await startFight(page, player, opponent);
    for (const swap of [false, true]) {
      const r = await blockThenPunish(page, 'HEAVY_KICK', swap);
      expect(r.sawBlockstun).toBe(true);
      expect(r.pushed).toBeGreaterThan(8);
      expect(r.punished).toBe(true);
      expect(r.punishedWhileAttacking).toBe(true);
      expect(r.chip).toBeGreaterThan(0);
    }
  });
}

test('blockstun locks the guard, keeps blocking, and then frees the defender', async ({ page }) => {
  await startFight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
    o.combatState.setState('BLOCKING');
    const res = o.receiveHit(12, 18, 180, false, false, false, 12, 330);
    const state = o.combatState.state, locked = !o.combatState.canAct();
    const second = o.receiveHit(12, 18, 180, false, false, false, 12, 330);
    for (let i = 0; i < 14; i++) o.update(1000 / 60);
    return { res, state, locked, second, after: o.combatState.state, health: o.currentHealth };
  });
  // Chip damage is 10 % of 12, rounded down, per blocked hit.
  expect(r).toEqual({ res: 'blocked', state: 'BLOCKSTUN', locked: true, second: 'blocked', after: 'IDLE', health: 98 });
});

test('high/low guard: lows beat standing guard, crouch-guard blocks lows, and aerial overheads beat crouch-guard', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    const probe = (attack: string, crouchGuard: boolean, airborne = false) => {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 900; p.updateFacing(o.x); o.updateFacing(p.x);
      o.crouchGuarding = crouchGuard;
      o.hurtbox.rect = crouchGuard ? o.crouchHurtbox : o.standingHurtbox;
      o.combatState.setState('BLOCKING');
      if (airborne) { p.y = 540; p.isGrounded = false; p.velocityY = 0; }
      const before = o.currentHealth;
      p.executeAttack(attack);
      let blocked = false;
      for (let f = 0; f < 22; f++) {
        p.update(1000 / 60); o.update(1000 / 60);
        s.fighterController.checkCollisions(p, o);
        if (o.combatState.state === 'BLOCKSTUN') blocked = true;
      }
      return { blocked, lost: before - o.currentHealth, state: o.combatState.state };
    };
    return {
      sweepVsStand: probe('SWEEP', false),
      sweepVsCrouch: probe('SWEEP', true),
      airVsCrouch: probe('AIR_PUNCH', true, true),
      airVsStand: probe('AIR_PUNCH', false, true),
    };
  });
  expect(r.sweepVsStand.blocked).toBe(false);
  expect(r.sweepVsStand.lost).toBe(11);
  expect(r.sweepVsCrouch.blocked).toBe(true);
  expect(r.sweepVsCrouch.lost).toBe(1);
  expect(r.airVsCrouch.blocked).toBe(false);
  expect(r.airVsCrouch.lost).toBe(7);
  expect(r.airVsStand.blocked).toBe(true);
  expect(r.airVsStand.lost).toBe(0);
});
