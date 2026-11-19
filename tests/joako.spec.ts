import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function selectJoako(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').playerChoice.characterId)).toBe('joako');
}

async function fight(page: Page, mirror = false, stop = true) {
  await selectJoako(page);
  if (mirror) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
  }
  await page.mouse.click(524, 528);
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  if (stop) await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('Joako can be selected and moves, jumps and attacks faster than Tilin with his own animations', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.jump(); o.jump();
    const jumps = [p.velocityY, o.velocityY];
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.executeAttack('HEAVY_PUNCH'); o.executeAttack('HEAVY_PUNCH');
    return { id: p.characterId, speed: [p.walkSpeed, o.walkSpeed], jumps,
      recovery: [p.getActiveAttackDef().recovery, o.getActiveAttackDef().recovery],
      animations: ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'DASH', 'CROUCH', 'JUMP', 'AIR_PUNCH', 'AIR_KICK',
        'LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK', 'BLOCK', 'HIT_REACTION', 'STUN', 'GET_UP',
        'KNOCKDOWN', 'DEFEAT', 'VICTORY', 'TAUNT', 'SPECIAL_ATTACK', 'BUILD', 'FIRE', 'LANDING', 'DOUBLE_JUMP'].map(name => {
          const a = p.registry.get(name); return !!a?.available && a.frames.length >= 6 && a.frames.every((key: string) => key.startsWith('joako_') && s.textures.exists(key));
        }) };
  });
  expect(r.id).toBe('joako'); expect(r.speed[0]).toBeGreaterThan(r.speed[1]);
  expect(r.jumps[0]).toBeLessThan(r.jumps[1]); expect(r.recovery[0]).toBeLessThan(r.recovery[1]);
  expect(r.animations.every(Boolean)).toBe(true);
});

test('pausing Joako freezes the volley and restarting removes its sound and construction', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await fight(page, false, false);
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 500; s.opponent.x = 850; s.player.gainEnergy(100);
  });
  await page.keyboard.press('KeyO', { delay: 60 });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').superMove.active);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  const snapshot = () => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return { elapsed: s.superMove.elapsed, hp: s.opponent.currentHealth, paused: s.superMove.sound?.isPaused };
  });
  const paused = await snapshot(); expect(paused.paused).toBe(true);
  await page.waitForTimeout(300); expect(await snapshot()).toEqual(paused);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).elapsed).toBeGreaterThan(paused.elapsed);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('FightScene'));
  expect(await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    return { id: s.player.characterId, hp: s.player.currentHealth, active: s.superMove.active,
      layer: !!s.children.getByName('super-cinematic'), sounds: g.sound.sounds.filter((a: any) => a.key === 'super-build' && !a.pendingRemove).length };
  })).toEqual({ id: 'joako', hp: 90, active: false, layer: false, sounds: 0 });
  expect(errors).toEqual([]);
});

test('Joako needs a full bar and his ball can be guarded, jumped, ducked or interrupted before release', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.gainEnergy(99); p.executeAttack('SPECIAL_ATTACK');
    const rejected = !p.getActiveAttackDef() && p.energy === 99;
    const defenses = ['guard', 'jump', 'duck', 'range', 'interrupt', 'invulnerable'].map(mode => {
      p.finishRound('IDLE'); o.finishRound('IDLE'); o.currentHealth = 100;
      p.x = 400; o.x = mode === 'range' ? 1500 : 800; p.updateFacing(o.x); o.updateFacing(p.x);
      if (mode === 'guard') o.combatState.setState('BLOCKING');
      if (mode === 'duck') { o.combatState.setState('CROUCHING'); o.hurtbox.rect = o.crouchHurtbox; }
      if (mode === 'jump') { o.y = 120; o.isGrounded = false; }
      if (mode === 'invulnerable') o.combatState.setState('GETTING_UP');
      p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
      const spent = p.energy;
      if (mode === 'interrupt') p.receiveHit(5, 12, 0, false, true);
      for (let i = 0; i < 130; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      return { mode, spent, health: o.currentHealth, active: s.superMove.active, projectiles: p.sonicWaves.length };
    });
    return { rejected, defenses };
  });
  expect(r.rejected).toBe(true);
  for (const d of r.defenses) expect(d).toMatchObject({ spent: 0, health: 100, active: false, projectiles: 0 });
});

for (const right of [true, false]) test(`Joako confirms a ball hit, builds and fires once from the ${right ? 'left' : 'right'}`, async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(right => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    p.x = right ? 500 : 1100; o.x = right ? 900 : 700; p.updateFacing(o.x); o.updateFacing(p.x);
    p.gainEnergy(100); p.executeAttack('SPECIAL_ATTACK');
    for (let i = 0; i < 120 && !s.superMove.active; i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
    const started = s.superMove.active, timer = s.roundSystem.timeLeft, positions = [p.x, o.x];
    s.superMove.update(1750);
    const layer = s.children.getByName('super-cinematic');
    const construction = ['joako-wall', 'joako-stairs'].map(n => !!layer?.getByName(n)?.visible);
    const beforeShots = o.currentHealth;
    for (let i = 0; i < 500 && s.superMove.active; i++) s.update(0, 1000 / 60);
    const finished = { health: o.currentHealth, active: s.superMove.active, state: o.combatState.state,
      energy: [p.energy, o.energy], visible: [p.sprite.visible, o.sprite.visible], timer: s.roundSystem.timeLeft,
      positions: [p.x, o.x], layer: !!s.children.getByName('super-cinematic') };
    s.superMove.update(10000);
    return { started, construction, beforeShots, timer, positions, finished, healthAfter: o.currentHealth };
  }, right);
  expect(r.started).toBe(true); expect(r.construction).toEqual([true, true]); expect(r.beforeShots).toBe(90);
  expect(r.finished).toMatchObject({ health: 40, active: false, state: 'STUNNED', energy: [0, 0], visible: [true, true], layer: false });
  expect(r.finished.timer).toBe(r.timer); expect(r.finished.positions).toEqual(r.positions); expect(r.healthAfter).toBe(40);
});

test('Joako mirror matches have independent palettes, and cancelling the super clears its actors and sound', async ({ page }) => {
  await fight(page, true);
  const r = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    s.superMove.start(p, o); s.superMove.update(1800); s.superMove.cancel();
    const hp = o.currentHealth; s.superMove.update(10000);
    return { own: p.sprite.texture.key, other: o.sprite.texture.key, hp, after: o.currentHealth,
      visible: [p.sprite.visible, o.sprite.visible], locked: [p.inSuper, o.inSuper],
      layer: !!s.children.getByName('super-cinematic'), sound: !!s.superMove.sound,
      tints: [p.sprite.tintTopLeft, o.sprite.tintTopLeft] };
  });
  expect(r.own).toContain('joako'); expect(r.other).toContain('joako'); expect(r.tints[0]).not.toBe(r.tints[1]);
  expect(r.after).toBe(r.hp); expect(r.visible).toEqual([true, true]); expect(r.locked).toEqual([false, false]);
  expect(r.layer).toBe(false); expect(r.sound).toBe(false);
});

test('Joako super finishes a KO only after its final beat', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene');
    s.opponent.currentHealth = 5; s.superMove.start(s.player, s.opponent);
    s.update(0, 1700); const during = s.roundSystem.phase;
    for (let i = 0; i < 400 && s.roundSystem.phase === 'FIGHT'; i++) s.update(0, 1000 / 60);
    return { during, phase: s.roundSystem.phase, hp: s.opponent.currentHealth, visible: s.opponent.sprite.visible };
  });
  expect(r).toEqual({ during: 'FIGHT', phase: 'END', hp: 0, visible: true });
});

test('Joako victory loops the complete dance for both players without cropping the raised hand or moving the floor anchor', async ({ page }) => {
  await fight(page, true);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [s.player, s.opponent].map(p => {
      p.finishRound('VICTORY');
      const a = p.registry.get('VICTORY'), origin = [p.x, p.y, p.sprite.y];
      const frames: string[] = [];
      const padding = a.frames.map((key: string) => {
        const c = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
        const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let touchingEdge = false;
        for (let x = 0; x < c.width; x++) if (pixels[x * 4 + 3] > 32 || pixels[((c.height - 1) * c.width + x) * 4 + 3] > 32) touchingEdge = true;
        for (let y = 0; y < c.height; y++) if (pixels[y * c.width * 4 + 3] > 32 || pixels[(y * c.width + c.width - 1) * 4 + 3] > 32) touchingEdge = true;
        return !touchingEdge;
      });
      for (let i = 0; i < 24; i++) {
        frames.push(p.sprite.texture.key);
        p.updatePresentation(1000 / 18 + 0.001);
      }
      return { count: a.frames.length, unique: new Set(frames).size, looped: p.sprite.texture.key === frames[0],
        origin, after: [p.x, p.y, p.sprite.y], padding, idleHeight: s.textures.get(p.registry.get('IDLE').frames[0]).getSourceImage().height };
    });
  });
  for (const r of result) {
    expect(r.count).toBe(24); expect(r.unique).toBe(24); expect(r.looped).toBe(true);
    expect(r.after).toEqual(r.origin); expect(r.padding.every(Boolean)).toBe(true);
    expect(r.idleHeight).toBe(384);
  }
});

test('Joako uses a distinct double jump and absorbs the landing before returning to guard', async ({ page }) => {
  await fight(page);
  const r = await page.evaluate(() => {
    const p = (window as any).__game.scene.getScene('FightScene').player;
    p.jump(); p.update(80); p.jump(); p.update(20);
    const second = p.sprite.texture.key, vy = p.velocityY;
    p.jump(); const thirdVy = p.velocityY;
    p.y = 599; p.velocityY = 300;
    for (let i = 0; i < 60 && !p.isGrounded; i++) p.update(1000 / 60);
    const landed = p.sprite.texture.key;
    for (let i = 0; i < 40; i++) p.update(1000 / 60);
    return { second, vy, thirdVy, landed, final: p.combatState.state, facing: p.facingRight };
  });
  expect(r.second).toContain('DOUBLE_JUMP'); expect(r.thirdVy).toBe(r.vy);
  expect(r.landed).toContain('LANDING'); expect(r.final).toBe('IDLE');
});

test('the CPU can select Joako and confirm his charged ball against the player', async ({ page }) => {
  await selectJoako(page);
  await page.keyboard.press('Tab'); await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
  const r = await page.evaluate(() => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene'), cpu = s.opponent, p = s.player;
    g.loop.stop(); p.resetForRound(700); cpu.resetForRound(600);
    p.updateFacing(cpu.x); cpu.updateFacing(p.x); cpu.gainEnergy(100); cpu.think(600, p);
    for (let i = 0; i < 100 && !s.superMove.active; i++) { cpu.update(1000 / 60); s.fighterController.checkCollisions(cpu, p); }
    return { id: s.opponentChoice.characterId, active: s.superMove.active, energy: cpu.energy, hp: p.currentHealth };
  });
  expect(r).toEqual({ id: 'joako', active: true, energy: 0, hp: 80 });
});
