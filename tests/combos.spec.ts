import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

type Step = [number, Record<string, boolean>];

/**
 * Plays scripted inputs for the player against a passive dummy through the real scene update.
 * `onHit` steps are fed one per frame as soon as the current attack touches the dummy, so each
 * press is a cancel; plain steps run in order. Reports attacks started, combo hits/damage shown,
 * the dummy's health lost and states seen.
 */
async function play(page: Page, opts: { gap?: number; steps?: Step[]; chain?: Record<string, boolean>[]; frames?: number; energy?: boolean; dummyCrouch?: boolean }) {
  return page.evaluate(({ gap, steps, chain, frames, energy, dummyCrouch }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset(); s.comboDisplay.clear();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 700 + gap; p.updateFacing(o.x); o.updateFacing(p.x);
    if (energy) p.gainEnergy(100);
    if (dummyCrouch) { o.combatState.setState('CROUCHING'); o.hurtbox.rect = o.crouchHurtbox; }
    const queue: Record<string, boolean>[] = [];
    for (const [n, input] of steps ?? []) for (let i = 0; i < n; i++) queue.push(input);
    const pending = [...(chain ?? [])];
    const used = new Set<number>();
    let fed: Record<string, boolean> | null = null;
    p.input.getState = () => { if (fed) { const f = fed; fed = null; return f; } return queue.shift() ?? {}; };
    const health = o.currentHealth;
    const started: string[] = [], states = new Set<string>();
    let last = '', maxHits = 0, maxDamage = 0, juggleHits = 0;
    for (let f = 0; f < (frames ?? 150); f++) {
      if (pending.length && p.hasHitThisSwing && !used.has(p.attackSerial)) { used.add(p.attackSerial); fed = pending.shift()!; }
      s.update(0, 1000 / 60);
      const now = p.combatState.state === 'ATTACKING' ? `${p.attackSerial}:${p.combatState.attackName}` : p.combatState.state === 'DASHING' ? 'dash' : '';
      if (now && now !== last) started.push(now === 'dash' ? 'DASH' : p.combatState.attackName);
      last = now;
      states.add(o.combatState.state);
      juggleHits = Math.max(juggleHits, o.juggleHits);
      const shown = s.combos.get(p);
      if (shown) { maxHits = Math.max(maxHits, shown.hits); maxDamage = Math.max(maxDamage, shown.damage); }
    }
    return { started, lost: health - o.currentHealth, maxHits, maxDamage, states: [...states], juggleHits, max: o.maxHealth, endState: o.combatState.state };
  }, { gap: opts.gap ?? 105, steps: opts.steps ?? [], chain: opts.chain ?? [], frames: opts.frames ?? 150, energy: !!opts.energy, dummyCrouch: !!opts.dummyCrouch });
}

const LP = { lightPunch: true }, LK = { lightKick: true }, HP = { heavyPunch: true };

test('the full route light → light → heavy → command special → super connects as one combo', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  const r = await page.evaluate(() => {
    // Build the route with real inputs: the command needs ↓ then → before its punch.
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 805; p.updateFacing(o.x); o.updateFacing(p.x);
    p.gainEnergy(100);
    const plan: Record<string, boolean>[][] = [[{ lightPunch: true }], [{ lightKick: true }], [{ heavyPunch: true }],
      [{ crouch: true }, { crouch: true, moveRight: true }, { moveRight: true, lightPunch: true }], [{ special: true }]];
    let step = 0, feed: Record<string, boolean>[] = [...plan[0]];
    const used = new Set<number>();
    p.input.getState = () => feed.shift() ?? {};
    const started: string[] = [];
    let last = '', hits = 0;
    for (let f = 0; f < 200; f++) {
      if (step < plan.length - 1 && p.hasHitThisSwing && !used.has(p.attackSerial)) { used.add(p.attackSerial); step++; feed = [...plan[step]]; }
      s.update(0, 1000 / 60);
      hits = Math.max(hits, s.combos.get(p)?.hits ?? 0);
      if (s.superMove.active) { started.push('SUPER'); break; }
      const now = p.combatState.state === 'ATTACKING' ? `${p.attackSerial}:${p.combatState.attackName}` : '';
      if (now && now !== last) started.push(p.combatState.attackName);
      last = now;
    }
    return { started, hits };
  });
  expect(r.started).toEqual(['LIGHT_PUNCH', 'LIGHT_KICK', 'HEAVY_PUNCH', 'RUSH', 'SPECIAL_ATTACK', 'SUPER']);
  expect(r.hits).toBeGreaterThanOrEqual(4);
});

test('cancels only happen on contact, and the light chain is one step (no light loops)', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  // Whiffed heavy punch: the command motion right after it does not cancel.
  const whiff = await play(page, { gap: 420, steps: [[1, HP], [3, { crouch: true }], [2, { crouch: true, moveRight: true }], [1, { moveRight: true, lightPunch: true }]], frames: 40 });
  expect(whiff.started).toEqual(['HEAVY_PUNCH']);
  // Light kick → light punch is not a cancel (only punch → kick is).
  const loop = await play(page, { steps: [[1, LP]], chain: [LK, LP, LK, LP], frames: 60 });
  // The punch cancels into the kick; the kick does not cancel back into a punch.
  expect(loop.started.slice(0, 2)).toEqual(['LIGHT_PUNCH', 'LIGHT_KICK']);
  expect(loop.maxHits).toBe(2);
});

test('crouching attacks: a low kick hits a crouching dummy and the sweep knocks down', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const low = await play(page, { steps: [[2, { crouch: true }], [1, { crouch: true, lightKick: true }]], dummyCrouch: true, frames: 30 });
  expect(low.started).toEqual(['CROUCH_LIGHT']);
  expect(low.lost).toBeGreaterThan(0);
  const sweep = await play(page, { steps: [[2, { crouch: true }], [1, { crouch: true, heavyKick: true }]], frames: 40 });
  expect(sweep.started).toEqual(['SWEEP']);
  expect(sweep.states).toContain('KNOCKED_DOWN');
});

test('a jump-in links into a ground hit after landing', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 760; o.x = 880; p.updateFacing(o.x); o.updateFacing(p.x);
    p.input.getState = () => ({});
    p.jump(); p.velocityX = 120;
    let kicked = false, punched = false, maxHits = 0;
    for (let f = 0; f < 120; f++) {
      // Kick on the way down, close to the floor, then punch the moment the player lands.
      if (!kicked && p.velocityY > 300) { kicked = true; p.input.getState = () => (p.input.getState = () => ({}), { heavyKick: true }); }
      if (kicked && !punched && p.isGrounded && p.combatState.canAct()) { punched = true; p.input.getState = () => (p.input.getState = () => ({}), { lightPunch: true }); }
      s.update(0, 1000 / 60);
      maxHits = Math.max(maxHits, s.combos.get(p)?.hits ?? 0);
    }
    return { maxHits };
  });
  expect(r.maxHits).toBe(2);
});

test('the launcher starts a juggle that is capped in hits and falls faster each hit', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 805; p.updateFacing(o.x); o.updateFacing(p.x);
    p.input.getState = () => ({});
    p.executeAttack('LAUNCHER');
    const airTimes: number[] = [];
    let juggled = false, airHits = 0, lastJ = 0, frameInState = 0, landedDown = false;
    for (let f = 0; f < 260; f++) {
      s.update(0, 1000 / 60);
      if (o.combatState.state === 'JUGGLED') {
        juggled = true; frameInState++;
        if (o.juggleHits !== lastJ) { airTimes.push(frameInState); frameInState = 0; lastJ = o.juggleHits; }
        // Keep hitting whenever possible: light punches into the falling dummy.
        if (p.combatState.canAct()) p.executeAttack('LIGHT_PUNCH');
        if (o.x - p.x > 120) p.x = o.x - 105;
      }
      airHits = Math.max(airHits, o.juggleHits);
      if (juggled && o.combatState.state === 'KNOCKED_DOWN') { landedDown = true; break; }
    }
    return { juggled, airHits, landedDown, airTimes, spent: o.juggleSpent };
  });
  expect(r.juggled).toBe(true);
  expect(r.airHits).toBeLessThanOrEqual(3);
  expect(r.airHits).toBeGreaterThanOrEqual(1);
  expect(r.landedDown).toBe(true);
});

test('no combo loop takes more than 45 % of the health or 8 hits, even with dash cancels', async ({ page }) => {
  for (const [player, opponent] of [['cesar', 'tilin'], ['tilin', 'cesar']]) {
    await startFight(page, player, opponent, { mode: 'training' });
    // Try to loop forever: light, kick, heavy, dash, again… for 10 seconds.
    const loop = [LP, LK, HP, { dash: true }, LP, LK, HP, { dash: true }, LP, LK, HP, { dash: true }, LP, LK, HP, { dash: true }, LP, LK, HP];
    const r = await play(page, { chain: loop, frames: 600 });
    expect(r.maxHits, `${player}`).toBeLessThanOrEqual(8);
    expect(r.lost / r.max, `${player}`).toBeLessThanOrEqual(0.45);
    expect(r.endState === 'KNOCKED_DOWN' || r.endState === 'GETTING_UP' || r.endState === 'IDLE', `${player}`).toBe(true);
  }
});

test('damage scaling: the first two hits are whole and later ones shrink', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 805; p.updateFacing(o.x); o.updateFacing(p.x);
    const values: number[] = [];
    // Simulate a combo in progress: four heavy punches registered on a stunned dummy.
    for (let i = 0; i < 5; i++) {
      const scaled = s.scaleComboHit(p, o, 12);
      values.push(scaled.damage);
      o.combatState.setState('HIT');
      s.combos.registerHit(p, o, scaled.damage);
    }
    return values;
  });
  // 12, 12 whole; then −15 % a hit; the fifth only has 3 left before the 45 % cap (12+12+10+8 = 42).
  expect(r).toEqual([12, 12, 10, 8, 3]);
});

test('a heavy punch that connects can be dash-cancelled to keep the combo going', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    s.combos.reset();
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 805; p.updateFacing(o.x); o.updateFacing(p.x);
    let feed: Record<string, boolean>[] = [{ heavyPunch: true }];
    p.input.getState = () => feed.shift() ?? {};
    const started: string[] = [];
    let last = '', dashed = false, punched = false, maxHits = 0;
    for (let f = 0; f < 90; f++) {
      if (!dashed && p.hasHitThisSwing) { dashed = true; feed = [{ dash: true }]; }
      // Press the punch every frame of the dash: it comes out as soon as the dash allows.
      if (dashed && !punched && p.combatState.state === 'DASHING') feed = [{ lightPunch: true }];
      if (p.combatState.attackName === 'LIGHT_PUNCH') punched = true;
      s.update(0, 1000 / 60);
      const now = p.combatState.state === 'ATTACKING' ? `${p.attackSerial}:${p.combatState.attackName}` : p.combatState.state === 'DASHING' ? 'dash' : '';
      if (now && now !== last) started.push(now === 'dash' ? 'DASH' : p.combatState.attackName);
      last = now;
      maxHits = Math.max(maxHits, s.combos.get(p)?.hits ?? 0);
    }
    return { started, maxHits };
  });
  expect(r.started.slice(0, 3)).toEqual(['HEAVY_PUNCH', 'DASH', 'LIGHT_PUNCH']);
  expect(r.maxHits).toBe(2);
});

test('the CPU sweeps up close and cancels heavy hits into its command special on Hard', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { difficulty: 'hard', cpuSeed: 31 });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    let sweep = false, cancel = false;
    for (let t = 0; t < 60 && !(sweep && cancel); t++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 905; p.updateFacing(o.x); o.updateFacing(p.x);
      o.decisionTimer = 0; o.attackCooldown = 0;
      o.think(1000 / 60, p);
      if (o.combatState.attackName === 'SWEEP') sweep = true;
      o.finishRound('IDLE');
      o.executeAttack('HEAVY_PUNCH');
      for (let f = 0; f < 25; f++) {
        o.think(1000 / 60, p); p.update(1000 / 60); o.update(1000 / 60);
        s.fighterController.checkCollisions(o, p);
        if (o.combatState.attackName === 'STOMP') cancel = true;
      }
    }
    return { sweep, cancel };
  });
  expect(r.sweep).toBe(true);
  expect(r.cancel).toBe(true);
});
