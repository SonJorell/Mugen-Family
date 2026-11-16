import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/** Player 1 tries a throw with the given input frames; reports what happened to the rival. */
async function tryThrow(page: Page, opts: { gap: number; frames: Record<string, boolean>[]; rivalState?: string; tech?: number | null }) {
  return page.evaluate(({ gap, frames, rivalState, tech }) => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 700; o.x = 700 + gap; p.updateFacing(o.x); o.updateFacing(p.x);
    if (rivalState) { o.combatState.setState(rivalState); if (rivalState === 'HIT') o.stunDuration = 2000; }
    const queue = [...frames];
    p.input.getState = () => queue.shift() ?? {};
    // A human rival (two-player mode) may press J + U to break the throw.
    if (o.input) o.input.getState = () => ({});
    const health = o.currentHealth, states = new Set<string>();
    let grabbedAt = -1, techDone = false;
    for (let f = 0; f < 90; f++) {
      s.update(0, 1000 / 60);
      states.add(o.combatState.state);
      if (o.combatState.state === 'GRABBED' && grabbedAt < 0) grabbedAt = f;
      if (tech !== null && tech !== undefined && grabbedAt >= 0 && !techDone && f - grabbedAt >= tech && o.input) {
        techDone = true;
        let once = true;
        o.input.getState = () => (once ? (once = false, { lightPunch: true, lightKick: true }) : {});
      }
    }
    return { states: [...states], lost: health - o.currentHealth, attack: p.combatState.attackName, apart: Math.abs(o.x - p.x) };
  }, { gap: opts.gap, frames: opts.frames, rivalState: opts.rivalState ?? null, tech: opts.tech ?? null });
}

const BOTH = { lightPunch: true, lightKick: true };

test('J + U up close throws a guarding rival, who lands knocked down', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  const r = await tryThrow(page, { gap: 100, frames: [BOTH], rivalState: 'BLOCKING' });
  expect(r.states).toContain('GRABBED');
  expect(r.states).toContain('KNOCKED_DOWN');
  expect(r.lost).toBe(13);
});

test('the second button may come a moment later, and a far throw whiffs', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  // One frame apart: the jab has not landed yet, so it turns into the throw.
  const late = await tryThrow(page, { gap: 100, frames: [{ lightPunch: true }, { lightKick: true }] });
  expect(late.states).toContain('GRABBED');
  const far = await tryThrow(page, { gap: 260, frames: [BOTH] });
  expect(far.states).not.toContain('GRABBED');
  expect(far.lost).toBe(0);
});

test('a stunned rival cannot be thrown (no unblockable loops)', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const r = await tryThrow(page, { gap: 100, frames: [BOTH], rivalState: 'HIT' });
  expect(r.states).not.toContain('GRABBED');
});

test('a held player breaks the throw with J + U in time, and not when too late', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'versus' });
  const early = await tryThrow(page, { gap: 100, frames: [BOTH], tech: 5 });
  expect(early.states).toContain('GRABBED');
  expect(early.states).not.toContain('KNOCKED_DOWN');
  expect(early.lost).toBe(0);
  // Pushed apart from the hold distance (70 × 1.14 ≈ 80 px).
  expect(early.apart).toBeGreaterThan(85);
  const late = await tryThrow(page, { gap: 100, frames: [BOTH], tech: 20 });
  expect(late.states).toContain('KNOCKED_DOWN');
  expect(late.lost).toBe(13);
});

test('the CPU throws a guarding player up close and breaks throws on Hard', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { difficulty: 'hard', cpuSeed: 41 });
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.input.getState = () => ({});
    let threw = false, broke = 0;
    for (let t = 0; t < 60; t++) {
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = 895; p.updateFacing(o.x); o.updateFacing(p.x);
      p.combatState.setState('BLOCKING');
      o.decisionTimer = 0; o.attackCooldown = 0;
      o.think(1000 / 60, p);
      if (o.combatState.attackName === 'THROW') threw = true;
      // The player throws the CPU: does it break free?
      p.finishRound('IDLE'); o.finishRound('IDLE');
      o.grabbedFrom(p);
      o.think(1000 / 60, p);
      if (o.combatState.state === 'IDLE') broke++;
      o.grabbedBy = null; o.finishRound('IDLE');
    }
    return { threw, broke };
  });
  expect(r.threw).toBe(true);
  expect(r.broke).toBeGreaterThan(10);
});
