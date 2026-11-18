import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

// Instrument the entry at the network boundary; production needs no testing API.
async function boot(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
}

async function fight(page: Page, stop = true) {
  await boot(page);
  await page.keyboard.press('Enter');
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game?.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT');
  if (stop) await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('left and right remain screen directions after changing sides', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.updateFacing(f.x - 200);
    f.input.getState = () => ({ moveRight: true });
    const before = f.x;
    f.update(16);
    return f.x - before;
  });
  expect(result).toBeGreaterThan(0);
});

test('an interrupted attack cannot leave a damaging hitbox', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.executeAttack('HEAVY_PUNCH');
    f.receiveHit(5, 18, 80, false, true);
    for (let i = 0; i < 8; i++) f.update(16);
    return { attack: f.getActiveAttackDef(), active: !!f.hitbox?.active };
  });
  expect(result).toEqual({ attack: null, active: false });
});

test('hitstun is refreshed by a later hit and expires using combat time', async ({ page }) => {
  await fight(page);
  const states = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').opponent;
    f.receiveHit(5, 12, 80, false, false);
    for (let i = 0; i < 10; i++) f.update(16);
    f.receiveHit(5, 24, 80, false, false);
    for (let i = 0; i < 15; i++) f.update(16);
    const during = f.combatState.state;
    for (let i = 0; i < 12; i++) f.update(16);
    return [during, f.combatState.state];
  });
  expect(states).toEqual(['HIT', 'IDLE']);
});

test('knockdown recovers even without GET_UP artwork', async ({ page }) => {
  await fight(page);
  const state = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.opponentRegistry.get('GET_UP').available = false;
    const f = s.opponent;
    f.receiveHit(15, 24, 250, true, false);
    for (let i = 0; i < 240; i++) f.update(1000 / 60);
    return f.combatState.state;
  });
  expect(state).toBe('IDLE');
});

test('knockdown plays the new getting-up sequence before returning to guard', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').opponent;
    f.receiveHit(15, 24, 250, true, false);
    const frames = new Set<string>();
    for (let i = 0; i < 150; i++) {
      f.update(1000 / 60);
      if (f.combatState.state === 'GETTING_UP') frames.add(f.sprite.texture.key);
    }
    return { frames: [...frames], state: f.combatState.state };
  });
  expect(result.frames).toHaveLength(12);
  expect(result.frames[0]).toBe('tilin_GET_UP_0');
  expect(result.frames[11]).toBe('tilin_GET_UP_11');
  expect(result.state).toBe('IDLE');
});

test('attack recovery uses declared combat frames instead of animation duration', async ({ page }) => {
  await fight(page);
  const state = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.executeAttack('LIGHT_PUNCH');
    for (let i = 0; i < 17; i++) f.update(1000 / 60);
    return f.combatState.state;
  });
  expect(state).toBe('IDLE');
});

test('standing after a crouching attack restores the full hurtbox', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.input.getState = () => ({ crouch: true });
    f.update(16);
    f.executeAttack('LIGHT_KICK');
    f.input.getState = () => ({});
    for (let i = 0; i < 60; i++) f.update(16);
    return { state: f.combatState.state, height: f.hurtbox.rect.height };
  });
  expect(result).toEqual({ state: 'IDLE', height: 250 });
});

test('equal health at timeout is a draw with no false winner', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    let result: unknown;
    s.roundSystem.onRoundEnd = (winner: unknown) => { result = winner; };
    s.roundSystem.update(99000, 100, 100);
    return result;
  });
  expect(result).toBe('draw');
});

test('pause freezes the entire scene and can resume repeatedly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await fight(page, false);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isPaused('FightScene'))).toBe(true);
    const before = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      return [s.roundSystem.timeLeft, s.player.x, s.opponent.x, s.time.now];
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      return [s.roundSystem.timeLeft, s.player.x, s.opponent.x, s.time.now];
    })).toEqual(before);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('FightScene'))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('returning to menu preserves assets and allows another fight', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await fight(page, false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT' && (window as any).__game.scene.isActive('FightScene'));
  expect(errors).toEqual([]);
});

test('CPU closes distance and can damage a passive player', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const startDistance = Math.abs(s.player.x - s.opponent.x);
    for (let i = 0; i < 600; i++) s.update(i * 1000 / 60, 1000 / 60);
    return { health: s.player.currentHealth, distance: Math.abs(s.player.x - s.opponent.x), startDistance };
  });
  expect(result.distance).toBeLessThan(result.startDistance);
  expect(result.health).toBeLessThan(100);
});

test('grounded fighters cannot walk through each other or leave the stage', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.x = 1770;
    s.opponent.x = 1850;
    s.player.input.getState = () => ({ moveRight: true });
    for (let i = 0; i < 30; i++) s.update(i * 1000 / 60, 1000 / 60);
    return [s.opponent.x - s.player.x, s.opponent.x];
  });
  expect(result[0]).toBeGreaterThanOrEqual(89.9);
  expect(result[1]).toBeLessThanOrEqual(1880);
});

test('blocking while holding a direction stops movement', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').player;
    f.input.getState = () => ({ moveRight: true, block: true });
    const start = f.x;
    for (let i = 0; i < 20; i++) f.update(16);
    return { distance: f.x - start, state: f.combatState.state };
  });
  expect(result).toEqual({ distance: 0, state: 'BLOCKING' });
});

test('restart keeps the chosen stage and clears pause state', async ({ page }) => {
  await fight(page, false);
  await page.keyboard.press('F2');
  const stage = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').stageIndex);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('PauseScene'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT' && (window as any).__game.scene.isActive('FightScene'));
  expect(await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').stageIndex)).toBe(stage);
});

test('menu and fight fit a narrow viewport without stretching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(390);
});

test('practice mode can be selected and stays passive', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.mouse.click(524, 528); // Rival: CPU → Práctica
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').mode)).toBe('training');
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem?.phase === 'FIGHT');
  const result = await page.evaluate(() => {
    const game = (window as any).__game;
    game.loop.stop();
    const s = game.scene.getScene('FightScene');
    const before = s.opponent.x;
    for (let i = 0; i < 300; i++) s.update(i * 16, 16);
    return { mode: s.getMatchData().mode, health: s.player.currentHealth, movement: s.opponent.x - before };
  });
  expect(result).toEqual({ mode: 'training', health: 100, movement: 0 });
});

test('movement gallery can be opened twice and change backgrounds each time', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  for (let visit = 0; visit < 2; visit++) {
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('MenuScene').selectedIndex)).toBe(2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).__game.scene.isActive('CharacterTestScene'));
    await page.keyboard.press('F2');
    await page.waitForFunction(() => (window as any).__game.scene.getScene('CharacterTestScene').currentStageIdx >= 0);
    expect(errors).toEqual([]);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  }
  expect(errors).toEqual([]);
});

test('failed essential assets show a retry message instead of a broken menu', async ({ page }) => {
  await page.route('**/assets/characters/tilin/manifest.json', route => route.fulfill({ status: 404, body: '' }));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as any).__game?.scene.getScene('PreloadScene');
    return scene?.children.list.some((child: any) => /Reintentar/.test(child.text ?? '')) ?? false;
  })).toBe(true);
});

test('one swing damages once, blocking defends only the front, and knockout ends the round', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 910;
    p.updateFacing(o.x); o.updateFacing(p.x);
    p.executeAttack('LIGHT_PUNCH');
    for (let i = 0; i < 12; i++) {
      p.update(1000 / 60);
      s.fighterController.checkCollisions(p, o);
    }
    const afterSwing = o.currentHealth;
    o.finishRound('IDLE');
    o.combatState.setState('BLOCKING');
    o.receiveHit(20, 30, 300, true, false);
    const front = o.currentHealth;
    o.receiveHit(20, 30, 300, true, true);
    const back = o.currentHealth;
    p.currentHealth = 0;
    s.roundSystem.update(16, 0, back);
    return { afterSwing, front, back, phase: s.roundSystem.phase, p: p.combatState.state, o: o.combatState.state };
  });
  expect(result).toEqual({ afterSwing: 95, front: 93, back: 73, phase: 'END', p: 'DEFEAT', o: 'VICTORY' });
});

test('losing window focus pauses a live match', async ({ page }) => {
  await fight(page, false);
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); });
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isPaused('FightScene'))).toBe(true);
});

test('transparent grid sheets load all twelve cells and preserve green clothing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const { SpriteSheetLoader } = await import('/src/animation/SpriteSheetLoader.ts');
    const { AnimationRegistry } = await import('/src/animation/AnimationRegistry.ts');
    const s = (window as any).__game.scene.getScene('MenuScene');
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect((i % 4) * 100 + 35, Math.floor(i / 4) * 100 + 15, 30, 70);
    }
    s.textures.addCanvas('gridtest_RAW_IDLE_0', canvas);
    const registry = new AnimationRegistry();
    const loader = new SpriteSheetLoader(s, registry, 'gridtest', '', null, { columns: 4, rows: 3, frameCount: 12 });
    loader.loadAnimationFromUrls('IDLE', ['sheet.png']);
    const frames = registry.get('IDLE')?.frames ?? [];
    const counts = frames.map((key: string) => {
      const src = s.textures.get(key).getSourceImage();
      const frame = document.createElement('canvas'); frame.width = src.width; frame.height = src.height;
      const context = frame.getContext('2d')!; context.drawImage(src, 0, 0);
      const data = context.getImageData(0, 0, frame.width, frame.height).data;
      let opaque = 0, transparent = 0;
      for (let p = 3; p < data.length; p += 4) { if (data[p] > 200) opaque++; if (data[p] === 0) transparent++; }
      return { opaque, transparent };
    });
    return { count: frames.length, counts };
  });
  expect(result.count).toBe(12);
  expect(result.counts.every((f: any) => f.opaque > 1000 && f.transparent > f.opaque)).toBe(true);
});

test('grid extraction finds gutters when a pose crosses the nominal row boundary', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const { SpriteSheetLoader } = await import('/src/animation/SpriteSheetLoader.ts');
    const { AnimationRegistry } = await import('/src/animation/AnimationRegistry.ts');
    const s = (window as any).__game.scene.getScene('MenuScene');
    const sheet = document.createElement('canvas'); sheet.width = 400; sheet.height = 300;
    const ctx = sheet.getContext('2d')!;
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = '#ff0000'; ctx.fillRect(c * 100 + 35, 15, 30, 95);
      ctx.fillStyle = '#00ff00'; ctx.fillRect(c * 100 + 35, 130, 30, 75);
      ctx.fillRect(c * 100 + 35, 230, 30, 60);
    }
    s.textures.addCanvas('gutters_RAW_IDLE_0', sheet);
    const registry = new AnimationRegistry();
    new SpriteSheetLoader(s, registry, 'gutters', '', null, { columns: 4, rows: 3, frameCount: 12 }).loadAnimationFromUrls('IDLE', ['sheet.png']);
    const image = s.textures.get(registry.get('IDLE').frames[4]).getSourceImage();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0, green = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) { if (data[i] > 200) red++; if (data[i + 1] > 200) green++; }
    return { red, green };
  });
  expect(result.red).toBe(0);
  expect(result.green).toBeGreaterThan(1000);
});

test('all twenty-three animations have twelve frames including singing and aerial moves', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return s.registry2.getAll().map((a: any) => ({ name: a.name, count: a.frames.length, available: a.available,
      shared: s.opponentRegistry.get(a.name)?.frames.join(',') === a.frames.join(',') }));
  });
  expect(result).toHaveLength(23);
  expect(result.every((a: any) => a.available && a.count === 12 && a.shared)).toBe(true);
});

test('the first active jab tick already displays an extended punch pose', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const f = s.player;
    f.executeAttack('LIGHT_PUNCH');
    f.update(1000 / 60); f.update(1000 / 60);
    return { active: !!f.hitbox?.active, frame: f.sprite.texture.key };
  });
  expect(result.active).toBe(true);
  expect(result.frame).toBe('tilin_LIGHT_PUNCH_3');
});

test('a second jump boosts upward once and landing restores both jumps', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const f = (window as any).__game.scene.getScene('FightScene').opponent;
    const cycle = () => {
      f.jump();
      for (let i = 0; i < 24; i++) f.update(1000 / 60);
      const before = f.velocityY;
      f.jump();
      const boosted = f.velocityY < before - 300;
      for (let i = 0; i < 6; i++) f.update(1000 / 60);
      const thirdBefore = f.velocityY;
      f.jump();
      const thirdIgnored = f.velocityY === thirdBefore;
      for (let i = 0; i < 120; i++) f.update(1000 / 60);
      return { boosted, thirdIgnored, landed: f.isGrounded && f.y === 580 };
    };
    return [cycle(), cycle()];
  });
  expect(result).toEqual(Array(2).fill({ boosted: true, thirdIgnored: true, landed: true }));
});

test('keyboard double jump clears a rival in either direction without auto repeating', async ({ page }) => {
  await fight(page);
  for (const direction of ['KeyD', 'KeyA']) {
    await page.evaluate((right) => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.player.finishRound('IDLE'); s.opponent.finishRound('IDLE');
      s.player.x = right ? 700 : 1100; s.opponent.x = 900;
    }, direction === 'KeyD');
    await page.keyboard.down(direction);
    await page.keyboard.down('KeyW');
    await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      for (let i = 0; i < 24; i++) { s.player.update(1000 / 60); s.bodyPhysics.resolve(s.player, s.opponent); }
    });
    const before = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').player.velocityY);
    expect(before).toBeGreaterThan(-150);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyW');
    const outcome = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.player.update(1000 / 60);
      const boost = s.player.velocityY;
      let clearance = 0;
      for (let i = 0; i < 65; i++) {
        s.player.update(1000 / 60); s.bodyPhysics.resolve(s.player, s.opponent);
        if (Math.abs(s.player.x - s.opponent.x) < 8) clearance = s.opponent.y - s.player.y;
      }
      return { boost, clearance, x: s.player.x, opponentX: s.opponent.x, grounded: s.player.isGrounded };
    });
    expect(outcome.boost).toBeLessThan(-500);
    expect(outcome.clearance).toBeGreaterThan(250);
    expect(direction === 'KeyD' ? outcome.x > outcome.opponentX : outcome.x < outcome.opponentX).toBe(true);
    expect(outcome.grounded).toBe(true);
    await page.keyboard.up('KeyW'); await page.keyboard.up(direction);
  }
});

test('the CPU can use both jumps while a stunned fighter cannot jump', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const f = s.opponent;
    s.player.x = 800; f.x = 980;
    let doubleJump = false;
    for (let i = 0; i < 480; i++) {
      const airborne = !f.isGrounded, before = f.velocityY;
      f.think(1000 / 60, s.player); f.update(1000 / 60);
      if (airborne && f.velocityY < before - 300) doubleJump = true;
      s.bodyPhysics.resolve(s.player, f);
    }
    f.finishRound('IDLE'); f.jump(); f.update(1000 / 60);
    f.receiveHit(5, 24, 80, false, true);
    const before = f.velocityY; f.jump();
    return { doubleJump, locked: f.velocityY === before && f.combatState.state === 'HIT' };
  });
  expect(result).toEqual({ doubleJump: true, locked: true });
});

test('real impacts play distinct decoded sounds once, while misses and invulnerability stay silent', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    const strike = (attack: string, mode: string) => {
      s.sound.stopAll();
      s.superMove.cancel();
      p.finishRound('IDLE'); o.finishRound('IDLE');
      p.x = 800; o.x = mode === 'miss' ? 1300 : 910;
      p.updateFacing(o.x); o.updateFacing(p.x);
      if (mode === 'block') o.combatState.setState('BLOCKING');
      if (mode === 'immune') o.combatState.setState('GETTING_UP');
      if (attack === 'SPECIAL_ATTACK') p.gainEnergy(100);
      p.executeAttack(attack);
      for (let i = 0; i < (attack === 'SPECIAL_ATTACK' ? 35 : 12); i++) { p.update(1000 / 60); s.fighterController.checkCollisions(p, o); }
      const sounds = s.sound.sounds.filter((sound: any) => sound.isPlaying && sound.key.startsWith('hit-'));
      return sounds.map((sound: any) => {
        const buffer = s.cache.audio.get(sound.key);
        const samples = buffer.getChannelData(0);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        return { key: sound.key, audible: energy / samples.length > 0.0001, duration: buffer.duration };
      });
    };
    return [strike('LIGHT_PUNCH', 'hit'), strike('HEAVY_KICK', 'hit'), strike('SPECIAL_ATTACK', 'hit'),
      strike('LIGHT_PUNCH', 'block'), strike('LIGHT_PUNCH', 'miss'), strike('LIGHT_PUNCH', 'immune')];
  });
  expect(result.map(sounds => sounds.map((sound: any) => sound.key))).toEqual([
    ['hit-light'], ['hit-heavy'], ['hit-special'], ['hit-block'], [], [],
  ]);
  expect(result.flat().every((s: any) => s.audible && s.duration > 0.08 && s.duration < 0.6)).toBe(true);
});

test('camera keeps a double-jumping fighter below the HUD and returns after landing', async ({ page }) => {
  await fight(page);
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.y = 290;
    for (let i = 0; i < 30; i++) s.updateCamera();
    const headOnScreen = s.player.y - 250 - s.cameras.main.scrollY;
    const floorOnScreen = 580 - s.cameras.main.scrollY;
    s.player.y = 580;
    for (let i = 0; i < 90; i++) s.updateCamera();
    return { headOnScreen, floorOnScreen, returned: s.cameras.main.scrollY };
  });
  expect(result.headOnScreen).toBeGreaterThan(86);
  expect(result.floorOnScreen).toBeLessThan(664);
  expect(Math.abs(result.returned)).toBeLessThan(1);
});
