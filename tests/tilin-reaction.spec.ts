import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/** Measure the pixels Phaser actually draws, including frame, origin, flip and angle. */
async function victimSilhouette(page: Page) {
  return page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const actor = s.children.getByName('super-cinematic').getByName('drive-victim');
    const surface = s.add.renderTexture(0, 0, 1280, 720).setVisible(false);
    try {
      surface.draw(actor, actor.x, actor.y);
      const image = await new Promise<HTMLImageElement>(resolve => surface.snapshot(resolve));
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 1280, 720).data;
      let left = 1280, right = -1, top = 720, bottom = -1, count = 0, totalX = 0, edge = 0;
      for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
        if (pixels[(y * 1280 + x) * 4 + 3] <= 64) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        count++; totalX += x;
        if (x === 0 || x === 1279 || y === 0 || y === 719) edge++;
      }
      return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1,
        count, centerX: totalX / count, edge };
    } finally { surface.destroy(); }
  });
}

test('Tilin changes her reaction pose through the grab, flight, landing, impact and recovery', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(fromRight => {
      s.superMove.cancel(); s.player.resetForRound(fromRight ? 1320 : 600); s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      const actor = s.children.getByName('super-cinematic').getByName('drive-victim');
      return { fromRight, phases: [
        { name: 'grab', start: 0, end: 540 },
        { name: 'flight', start: 550, end: 1430 },
        { name: 'landing', start: 1450, end: 3250 },
        { name: 'car impact', start: 3300, end: 4150 },
        { name: 'recovery', start: 4250, end: 5750 },
      ].map(phase => {
        const poses = new Set<string>();
        for (let time = phase.start; time <= phase.end; time += 20) {
          s.superMove.update(Math.max(0, time - s.superMove.elapsed));
          if (actor.visible && actor.alpha > 0.1) poses.add(`${actor.texture.key}:${actor.frame.name}`);
        }
        return { name: phase.name, poses: [...poses] };
      }) };
    });
  });
  for (const side of samples) for (const phase of side.phases) {
    expect.soft(phase.poses.length, `${phase.name}, César on the ${side.fromRight ? 'right' : 'left'}: Tilin must move her body, not just rotate a held portrait`)
      .toBeGreaterThanOrEqual(3);
  }
});

test('Tilin settles on the road after the car hit without floating or clipping in either direction', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const sides = [];
  for (const fromRight of [false, true]) {
    await page.evaluate(fromRight => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.superMove.cancel(); s.player.resetForRound(fromRight ? 1320 : 600); s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent); s.superMove.update(4350);
    }, fromRight);
    sides.push(await victimSilhouette(page));
  }
  for (const [i, body] of sides.entries()) {
    expect(body.count, `visible reaction on side ${i}`).toBeGreaterThan(2000);
    expect.soft(Math.abs(body.bottom - 622), `ground contact on side ${i}, bounds ${JSON.stringify(body)}`).toBeLessThanOrEqual(8);
    expect(body.edge, `the whole reaction remains inside the frame on side ${i}`).toBe(0);
  }
  expect(Math.abs(sides[0].centerX + sides[1].centerX - 1279), 'the visible reaction is mirrored about the arena centre').toBeLessThan(2);
});

test('a surviving Tilin recovers while a knocked-out Tilin stays down until the cinematic ends', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = [];
  for (const health of [100, 10]) {
    const state = await page.evaluate(health => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.superMove.cancel(); s.player.resetForRound(600); s.opponent.resetForRound(715); s.opponent.currentHealth = health;
      s.superMove.start(s.player, s.opponent);
      while (s.superMove.active && s.superMove.elapsed + 0.01 < 5700) s.update(0, Math.min(1000 / 60, 5700 - s.superMove.elapsed));
      return { active: s.superMove.active, phase: s.roundSystem.phase, health: s.opponent.currentHealth };
    }, health);
    samples.push({ state, body: await victimSilhouette(page) });
  }
  expect(samples[0].state).toEqual({ active: true, phase: 'FIGHT', health: 40 });
  expect(samples[1].state).toEqual({ active: true, phase: 'FIGHT', health: 0 });
  expect.soft(samples[0].body.top, `a survivor visibly rises: ${JSON.stringify(samples[0].body)}`).toBeLessThan(400);
  expect.soft(samples[1].body.top, `a defeated fighter remains low: ${JSON.stringify(samples[1].body)}`).toBeGreaterThan(450);
  expect(samples[1].body.width, 'the defeated body rests across the ground').toBeGreaterThan(samples[1].body.height);
  const end = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    while (s.superMove.active) s.update(0, 1000 / 60);
    return { active: s.superMove.active, phase: s.roundSystem.phase };
  });
  expect(end).toEqual({ active: false, phase: 'END' });
});

test('Tilin reaction poses stay identical when paused or reached by a direct or backward seek', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const begin = (fromRight: boolean) => {
      s.superMove.cancel(); s.player.resetForRound(fromRight ? 1320 : 600); s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent); return s.superMove.drive;
    };
    const read = (drive: any) => {
      const actor = drive.layer.getByName('drive-victim');
      return { texture: actor.texture.key, frame: actor.frame.name, x: actor.x, y: actor.y, angle: actor.angle,
        scale: [actor.scaleX, actor.scaleY], origin: [actor.originX, actor.originY], flip: actor.flipX,
        visible: actor.visible, alpha: actor.alpha };
    };
    return [false, true].flatMap(fromRight => [900, 2100, 4350].map(time => {
      let drive = begin(fromRight);
      for (let t = 0; t < time; t += 16) drive.render(t, 4, false);
      drive.render(time, 4, false); const advancing = read(drive);
      drive.render(time, 4, false); const paused = read(drive);
      drive = begin(fromRight); drive.render(time, 4, false); const direct = read(drive);
      drive.render(5700, 4, false); drive.render(time, 4, false);
      return { time, fromRight, advancing, paused, direct, backward: read(drive) };
    }));
  });
  for (const sample of samples) {
    const label = `${sample.time}ms, César on the ${sample.fromRight ? 'right' : 'left'}`;
    expect(sample.paused, `pause ${label}`).toEqual(sample.advancing);
    expect(sample.direct, `direct seek ${label}`).toEqual(sample.advancing);
    expect(sample.backward, `backward seek ${label}`).toEqual(sample.advancing);
  }
});

test('the car launches an already knocked-out Tilin from the ground instead of making her stand', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const reactions = [];
  for (const health of [10, 30]) {
    const beforeHealth = await page.evaluate(health => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.superMove.cancel(); s.player.resetForRound(600); s.opponent.resetForRound(715);
      s.opponent.currentHealth = health;
      s.superMove.start(s.player, s.opponent); s.superMove.update(3299);
      return s.opponent.currentHealth;
    }, health);
    const before = await victimSilhouette(page);
    const afterHealth = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      s.superMove.update(1);
      return s.opponent.currentHealth;
    });
    reactions.push({ beforeHealth, afterHealth, before, after: await victimSilhouette(page) });
  }
  const [earlyKO, carKO] = reactions;
  expect(earlyKO.beforeHealth).toBe(0);
  expect(earlyKO.afterHealth).toBe(0);
  expect(earlyKO.before.top).toBeGreaterThan(450);
  expect.soft(earlyKO.after.top, `a defeated body must stay low at first contact: ${JSON.stringify(earlyKO)}`).toBeGreaterThan(450);
  expect(earlyKO.after.width, 'the early KO launches from a horizontal pose').toBeGreaterThan(earlyKO.after.height);
  expect(carKO.beforeHealth).toBe(14);
  expect(carKO.afterHealth).toBe(0);
  expect(carKO.before.top).toBeLessThan(400);
  expect(carKO.after.top, 'a fighter defeated by this impact still starts from her preceding upright pose').toBeLessThan(400);
});

test('Tilin starts getting up without an abrupt jump from her final fallen pose', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.resetForRound(600); s.opponent.resetForRound(715);
    s.superMove.start(s.player, s.opponent); s.superMove.update(4599);
  });
  const fallen = await victimSilhouette(page);
  await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').superMove.update(1));
  const recovering = await victimSilhouette(page);
  expect(Math.abs(fallen.top - recovering.top), `a one-millisecond transition must not teleport her head: ${JSON.stringify({ fallen, recovering })}`)
    .toBeLessThan(30);
  expect(Math.abs(fallen.bottom - recovering.bottom), 'ground contact stays fixed during recovery').toBeLessThan(3);
});

test('Tilin stays inside the cinematic picture while the car launches her in either direction', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const launches = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(fromRight => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600); s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      const actor = s.children.getByName('super-cinematic').getByName('drive-victim');
      const samples = [];
      for (let time = 3300; time <= 4050; time += 10) {
        s.superMove.update(time - s.superMove.elapsed);
        samples.push({ time, top: actor.getBounds().top });
      }
      return { fromRight, highest: samples.reduce((a, b) => a.top < b.top ? a : b) };
    });
  });
  for (const launch of launches) {
    expect.soft(launch.highest.top, `Tilin must stay below the upper cinematic bar, side ${launch.fromRight ? 'right' : 'left'}: ${JSON.stringify(launch.highest)}`)
      .toBeGreaterThanOrEqual(142);
  }
});
