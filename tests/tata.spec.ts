import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

// Cold loads decode the complete roster and create hundreds of canvas textures.
test.setTimeout(90000);

async function fight(page: Page, mirror = false) {
  await startFight(page, 'tata', mirror ? 'tata' : 'tilin', { mode: 'training' });
}

function noBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}

test('Tata is selectable as the fifth fighter with complete transparent animations', async ({ page }) => {
  const errors = noBrowserErrors(page);
  await bootGame(page);
  const ids = await page.evaluate(async () => (await import('/src/config/roster.ts')).FIGHTER_ROSTER.map((f: any) => f.id));
  expect(ids).toContain('tata');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  for (let i = 0; i < 4; i++) await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice.characterId)).toBe('tata');
  const animations = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('SelectionScene');
    const { createCharacterLoader, getManifest } = await import('/src/config/characters.ts');
    const m = getManifest(s, 'tata'), { registry } = createCharacterLoader(s, m);
    return Object.keys(m.animations).map(name => {
      const frames = registry.get(name).frames;
      return { name, count: frames.length, valid: frames.every((key: string) => {
        const c = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
        const p = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        return key.startsWith('tata_') && p[3] <= 2 && p[(c.width - 1) * 4 + 3] <= 2;
      }) };
    });
  });
  expect(animations).toHaveLength(27);
  expect(animations.reduce((n: number, a: any) => n + a.count, 0)).toBe(168);
  expect(animations.every((a: any) => a.valid)).toBe(true);
  expect(errors).toEqual([]);
});

test('Tata requires full energy and his opening shove can be blocked, jumped, evaded or interrupted', async ({ page }) => {
  await fight(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return ['partial', 'guard', 'jump', 'range', 'invulnerable', 'interrupt', 'hit'].map(mode => {
      s.superMove.cancel(); p.resetForRound(500); o.resetForRound(mode === 'range' ? 1100 : 600);
      p.updateFacing(o.x); o.updateFacing(p.x); p.energyValue = mode === 'partial' ? 99 : 100;
      if (mode === 'guard') o.combatState.setState('BLOCKING');
      if (mode === 'jump') { o.y = 150; o.isGrounded = false; }
      if (mode === 'invulnerable') o.combatState.setState('GETTING_UP');
      p.executeAttack('SPECIAL_ATTACK');
      const spent = p.energy;
      if (mode === 'interrupt') p.receiveHit(5, 12, 0, false, true);
      for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      return { mode, energy: spent, hp: o.currentHealth, active: s.superMove.active, waves: p.sonicWaves.length };
    });
  });
  for (const r of results) expect(r).toMatchObject({ energy: r.mode === 'partial' ? 99 : 0, hp: r.mode === 'hit' ? 94 : 100, active: r.mode === 'hit', waves: 0 });
});

for (const right of [true, false]) test(`Tata drinks, mounts, cycles and deals sixty damage from the ${right ? 'left' : 'right'}`, async ({ page }) => {
  await fight(page);
  const report = await page.evaluate(right => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.resetForRound(right ? 500 : 1100); o.resetForRound(right ? 600 : 1000);
    p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    const timer = s.roundSystem.timeLeft, positions = [p.x, o.x], poses: string[] = [], reactions: string[] = [];
    for (const at of [850, 1800, 2800, 3400, 4200]) {
      s.superMove.update(at - s.superMove.elapsed);
      const world = s.children.getByName('super-cinematic').getByName('tata-world');
      poses.push(world.getByName('tata-caster').texture.key);
      reactions.push(world.getByName('tata-victim').texture.key);
    }
    while (s.superMove.active) s.update(0, 1000 / 60);
    s.superMove.update(10000);
    return { poses, reactions, hp: o.currentHealth, energy: p.energy, timer: [timer, s.roundSystem.timeLeft], positions: [positions, [p.x, o.x]],
      visible: [p.sprite.visible, o.sprite.visible], active: s.superMove.active, layer: !!s.children.getByName('super-cinematic') };
  }, right);
  expect(report.poses[0]).toContain('tata_DRINK'); expect(report.poses[1]).toContain('tata_MOUNT_BIKE');
  expect(report.poses.slice(2).every(key => key.startsWith('tata_CYCLE'))).toBe(true);
  expect(report.reactions.slice(0, 3).every(key => key.startsWith('tilin_STUN'))).toBe(true);
  expect(report.reactions.slice(3).every(key => key.startsWith('tilin_KNOCKDOWN'))).toBe(true);
  expect(report).toMatchObject({ hp: 40, energy: 0, visible: [true, true], active: false, layer: false });
  expect(report.timer[0]).toBe(report.timer[1]); expect(report.positions[0]).toEqual(report.positions[1]);
});

test('Tata mirror matches keep their palettes and cancellation removes the bicycle and sound', async ({ page }) => {
  await fight(page, true);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    s.superMove.start(p, o); s.superMove.update(2800);
    const world = s.children.getByName('super-cinematic').getByName('tata-world');
    const colors = [world.getByName('tata-caster').tintTopLeft, world.getByName('tata-victim').tintTopLeft];
    s.superMove.cancel(); const hp = o.currentHealth; s.superMove.update(10000);
    return { colors, hp, after: o.currentHealth, visible: [p.sprite.visible, o.sprite.visible], locked: [p.inSuper, o.inSuper],
      layer: !!s.children.getByName('super-cinematic'), sounds: s.sound.sounds.filter((x: any) => x.key === 'super-bike' && !x.pendingRemove).length };
  });
  expect(result.colors[0]).not.toBe(result.colors[1]); expect(result.after).toBe(result.hp);
  expect(result).toMatchObject({ visible: [true, true], locked: [false, false], layer: false, sounds: 0 });
});

test('Tata pauses his complete cinematic and the knockout waits for its ending', async ({ page }) => {
  await fight(page);
  await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    s.opponent.currentHealth = 20; s.superMove.start(s.player, s.opponent); g.loop.start();
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  const snap = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { elapsed: s.superMove.elapsed, hp: s.opponent.currentHealth, paused: s.superMove.sound.isPaused };
  });
  const paused = await snap(); expect(paused.paused).toBe(true);
  await page.waitForTimeout(250); expect(await snap()).toEqual(paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__game.scene.isActive('PauseScene'));
  const result = await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene'); g.loop.stop();
    s.update(0, 3500 - s.superMove.elapsed); const during = s.roundSystem.phase;
    while (s.superMove.active) s.update(0, 1000 / 60);
    s.update(0, 16);
    return { during, phase: s.roundSystem.phase, hp: s.opponent.currentHealth, visible: s.opponent.sprite.visible };
  });
  expect(result).toEqual({ during: 'FIGHT', phase: 'END', hp: 0, visible: true });
});

test('Tata can be a CPU opponent and joins arcade routes', async ({ page }) => {
  await startFight(page, 'tilin', 'tata', { cpuSeed: 42 });
  const result = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('FightScene'), cpu = s.opponent, p = s.player;
    p.resetForRound(700); cpu.resetForRound(600); p.updateFacing(cpu.x); cpu.updateFacing(p.x);
    cpu.random = () => 0.99; cpu.attackCooldown = 0; cpu.jumpCooldown = 1800; cpu.gainEnergy(100); cpu.think(600, p);
    for (let i = 0; i < 100 && !s.superMove.active; i++) { cpu.update(1000 / 60); s.fighterController.checkCollisions(cpu, p); }
    const { buildLadder } = await import('/src/config/arcade.ts');
    const routes = ['tilin', 'cesar', 'joako', 'jorell', 'tata'].map(characterId =>
      buildLadder({ characterId, paletteId: 'original' }).map((step: any) => step.opponent.characterId));
    return { id: s.opponentChoice.characterId, active: s.superMove.active, hp: p.currentHealth, routes };
  });
  expect(result).toMatchObject({ id: 'tata', active: true, hp: 94 });
  for (const route of result.routes) expect(route).toContain('tata');
});
