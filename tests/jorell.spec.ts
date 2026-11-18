import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function fight(page: Page, live = false, mirror = false, cpu = false) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice.characterId)).toBe('jorell');
  if (mirror) {
    await page.keyboard.press('Tab');
    for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
  }
  if (!cpu) await page.mouse.click(524, 528);
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  if (!live) await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('Jorell is selectable with balanced movement and complete transparent animations', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.jump(); o.jump(); const jumps = [p.velocityY, o.velocityY];
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.executeAttack('HEAVY_PUNCH'); o.executeAttack('HEAVY_PUNCH');
    const names = ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'DASH', 'CROUCH', 'JUMP', 'DOUBLE_JUMP', 'AIR_PUNCH', 'AIR_KICK',
      'LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK', 'BLOCK', 'HIT_REACTION', 'STUN', 'GET_UP',
      'KNOCKDOWN', 'DEFEAT', 'VICTORY', 'TAUNT', 'SPECIAL_ATTACK', 'TELEPORT', 'TRANSFORM', 'CHARGE', 'BEAM', 'POWER_RETURN', 'LANDING'];
    return { speed: [p.walkSpeed, o.walkSpeed], jumps, health: p.currentHealth,
      recovery: [p.getActiveAttackDef().recovery, o.getActiveAttackDef().recovery],
      valid: names.every(name => {
        const a = p.registry.get(name);
        return a?.available && a.frames.length >= 6 && a.frames.every((key: string) => {
          if (!key.startsWith('jorell_') || !s.textures.exists(key)) return false;
          const c = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
          const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          return pixels[3] <= 2 && pixels[(c.width - 1) * 4 + 3] <= 2;
        });
      }) };
  });
  expect(r.health).toBe(100); expect(r.speed[0]).toBe(r.speed[1]); expect(r.jumps[0]).toBe(r.jumps[1]);
  expect(r.recovery[0]).toBe(r.recovery[1]); expect(r.valid).toBe(true);
});

test('Jorell needs full energy and a stomach hit: guard, jump, range and interruption stop the super', async ({ page }) => {
  await fight(page);
  const results = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    return ['empty', 'partial', 'distant', 'block', 'jump', 'invulnerable', 'interrupted', 'hit'].map(mode => {
      s.superMove.cancel(); p.resetForRound(600); o.resetForRound(mode === 'distant' ? 1100 : 700);
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
      return { mode, active: s.superMove.active, hp: o.currentHealth, energy: p.energy, waves };
    });
  });
  for (const r of results) {
    expect(r.waves, r.mode).toBe(0); expect(r.active, r.mode).toBe(r.mode === 'hit');
    expect(r.hp, r.mode).toBe(r.mode === 'hit' ? 90 : 100);
    expect(r.energy, r.mode).toBe(r.mode === 'partial' ? 99 : r.mode === 'interrupted' ? 7 : 0);
  }
});

for (const right of [true, false]) test(`Jorell teleports, transforms and beams from the ${right ? 'left' : 'right'} without duplicate damage`, async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(right => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.resetForRound(right ? 600 : 1320); o.resetForRound(right ? 700 : 1220);
    p.updateFacing(o.x); o.updateFacing(p.x); p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 100 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    const start = s.superMove.active, timer = s.roundSystem.timeLeft;
    const layer = s.children.getByName('super-cinematic');
    const world = layer?.getByName('jorell-world');
    const actor = world?.getByName('jorell-caster'), victim = world?.getByName('jorell-victim');
    const near = Math.abs(actor?.x - victim?.x);
    s.superMove.update(1500);
    const away = Math.abs(actor?.x - victim?.x), transform = actor?.texture.key;
    s.superMove.update(2000); const charge = actor?.texture.key, before = o.currentHealth;
    s.superMove.update(1200); const beam = actor?.texture.key, during = o.currentHealth;
    while (s.superMove.active) s.update(0, 1000 / 60);
    const hp = o.currentHealth; s.superMove.update(10000);
    return { start, near, away, transform, charge, beam, before, during, hp, after: o.currentHealth,
      distance: Math.abs(p.x - o.x), facing: p.facingRight === right && o.facingRight !== right,
      visible: p.sprite.visible && o.sprite.visible, normal: p.sprite.texture.key.includes('jorell_IDLE'),
      timer: s.roundSystem.timeLeft === timer, energy: [p.energy, o.energy], layer: !!s.children.getByName('super-cinematic') };
  }, right);
  expect(r.start).toBe(true); expect(r.away - r.near).toBeGreaterThan(400);
  expect(r.transform).toContain('TRANSFORM'); expect(r.charge).toContain('CHARGE'); expect(r.beam).toContain('BEAM');
  expect(r.before).toBe(90); expect(r.during).toBeLessThan(90); expect(r.hp).toBe(40); expect(r.after).toBe(40);
  expect(r.distance).toBeGreaterThan(500); expect(r.facing).toBe(true); expect(r.visible).toBe(true);
  expect(r.normal).toBe(true); expect(r.timer).toBe(true); expect(r.energy).toEqual([0, 0]); expect(r.layer).toBe(false);
});

test('Jorell cancellation removes the beam and sound without committing the teleport or delayed damage', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.resetForRound(600); o.resetForRound(700); s.superMove.start(p, o); s.superMove.update(4700); s.superMove.cancel();
    const hp = o.currentHealth; s.superMove.update(10000);
    return { x: p.x, otherX: o.x, hp, after: o.currentHealth, visible: p.sprite.visible && o.sprite.visible,
      locked: p.inSuper || o.inSuper, layer: !!s.children.getByName('super-cinematic'), sound: !!s.superMove.sound };
  });
  expect(r).toMatchObject({ x: 600, otherX: 700, visible: true, locked: false, layer: false, sound: false });
  expect(r.after).toBe(r.hp);
});

test('Jorell pauses the entire sequence and audio, resumes and ends a KO after the cinematic', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fight(page, true);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.resetForRound(600); s.opponent.resetForRound(700); s.opponent.currentHealth = 5; s.player.gainEnergy(100);
  });
  await page.keyboard.press('KeyO', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').superMove.active);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  const snapshot = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { elapsed: s.superMove.elapsed, hp: s.opponent.currentHealth, paused: s.superMove.sound?.isPaused, phase: s.roundSystem.phase };
  });
  const paused = await snapshot(); expect(paused.paused).toBe(true); expect(paused.phase).toBe('FIGHT');
  await page.waitForTimeout(300); expect(await snapshot()).toEqual(paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'END');
  expect(await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { active: s.superMove.active, hp: s.opponent.currentHealth, visible: s.player.sprite.visible && s.opponent.sprite.visible };
  })).toEqual({ active: false, hp: 0, visible: true });
  expect(errors).toEqual([]);
});

test('Jorell mirror matches preserve separate colours and use the rival reaction animations', async ({ page }) => {
  await fight(page, false, true);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.superMove.start(s.player, s.opponent); s.superMove.update(4700);
    const world = s.children.getByName('super-cinematic').getByName('jorell-world');
    const p = world.getByName('jorell-caster'), o = world.getByName('jorell-victim');
    const during = { caster: p.texture.key, victim: o.texture.key, colours: [p.tintTopLeft, o.tintTopLeft] };
    s.superMove.cancel();
    return during;
  });
  expect(r.caster).toContain('jorell_BEAM'); expect(r.victim).toContain('jorell_HIT_REACTION');
  expect(r.colours[0]).not.toBe(r.colours[1]);
});

test('a CPU Jorell can confirm his charged stomach punch', async ({ page }) => {
  await fight(page, false, true, true);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, cpu = s.opponent;
    p.resetForRound(700); cpu.resetForRound(600); p.updateFacing(cpu.x); cpu.updateFacing(p.x);
    // Isolate the charged-attack branch; random throws/sweeps are covered by CPU tests.
    cpu.random = () => 0.99;
    cpu.gainEnergy(100); cpu.think(600, p);
    for (let i = 0; i < 100 && !s.superMove.active; i++) { cpu.update(1000 / 60); s.fighterController.checkCollisions(cpu, p); }
    return { id: s.opponentChoice.characterId, active: s.superMove.active, energy: cpu.energy, hp: p.currentHealth };
  });
  expect(r).toEqual({ id: 'jorell', active: true, energy: 0, hp: 90 });
});

test('Jorell is one centimetre taller than Joako and one shorter than Cesar', async ({ page }) => {
  await fight(page);
  const sizes = await page.evaluate(async () => {
    const { Fighter } = await import('/src/characters/Fighter.ts');
    const { rosterEntry } = await import('/src/config/roster.ts');
    const { getManifest, createCharacterLoader } = await import('/src/config/characters.ts');
    const s = (window as any).__game.scene.getScene('FightScene');
    return ['joako', 'jorell', 'cesar'].map(id => {
      const { registry, loader } = createCharacterLoader(s, getManifest(s, id));
      const p = new Fighter({ scene: s, registry, loader, characterId: id, x: 600, y: 600, stats: rosterEntry(id).stats });
      p.executeAttack('HEAVY_PUNCH');
      return { id, height: p.standingHurtbox.height, reach: p.getActiveAttackDef().hitbox.width, scaleX: p.sprite.scaleX, scaleY: p.sprite.scaleY };
    });
  });
  expect(sizes[1].height / sizes[0].height).toBeCloseTo(182 / 181, 5);
  expect(sizes[2].height / sizes[1].height).toBeCloseTo(183 / 182, 5);
  expect(sizes[1].height).toBeLessThan(sizes[2].height);
  expect(sizes[1].reach).toBeGreaterThan(sizes[0].reach);
  expect(sizes[1].reach).toBeLessThan(sizes[2].reach);
  for (const s of sizes) expect(s.scaleX).toBe(s.scaleY);
});

test('Jorell cinematic uses closeups and a portrait, then restores its world after the beam', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const camera = { x: s.cameras.main.scrollX, y: s.cameras.main.scrollY, zoom: s.cameras.main.zoom };
    s.superMove.start(s.player, s.opponent);
    const layer = s.children.getByName('super-cinematic'), world = layer?.getByName('jorell-world');
    const close = world?.scaleX;
    s.superMove.update(1600);
    const portrait = layer?.getByName('jorell-cutin');
    const portraitVisible = !!portrait?.visible && portrait.alpha > 0.5;
    s.superMove.update(3100);
    const wide = world?.scaleX, effects = world?.getByName('jorell-energy');
    const damage = s.opponent.currentHealth;
    s.superMove.cancel();
    return { close, wide, portraitVisible, effects: !!effects, damage,
      layer: !!s.children.getByName('super-cinematic'),
      cameraUnchanged: camera.x === s.cameras.main.scrollX && camera.y === s.cameras.main.scrollY && camera.zoom === s.cameras.main.zoom };
  });
  expect(r.close).toBeGreaterThan(1.1); expect(r.wide).toBeLessThan(r.close);
  expect(r.portraitVisible).toBe(true); expect(r.effects).toBe(true); expect(r.damage).toBeLessThan(90);
  expect(r.layer).toBe(false); expect(r.cameraUnchanged).toBe(true);
});

test('the Kamehameha starts at the visible hands in both directions', async ({ page }) => {
  await fight(page);
  const distances = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(right => {
      s.superMove.cancel();
      s.player.resetForRound(right ? 1100 : 600); s.opponent.resetForRound(right ? 1000 : 700);
      s.superMove.start(s.player, s.opponent); s.superMove.update(4700);
      const sequence = s.superMove.kame, actor = sequence.caster, orb = sequence.orb;
      const local = actor.getLocalTransformMatrix().applyInverse(orb.x, orb.y);
      const c = actor.texture.getSourceImage() as HTMLCanvasElement;
      const x = (actor.flipX ? -local.x : local.x) + c.width * actor.originX;
      const y = local.y + c.height * actor.originY;
      const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let distance = Infinity;
      for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
        if (pixels[(py * c.width + px) * 4 + 3] > 128) distance = Math.min(distance, Math.hypot(px - x, py - y));
      }
      return { right, distance };
    });
  });
  for (const result of distances) expect(result.distance, JSON.stringify(result)).toBeLessThan(16);
});
