import { test, expect } from '@playwright/test';
import { startFight } from './fight-helper';

test('the i30 grab, throw, boarding and return show successive poses in both directions', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(fromRight => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      const layer = s.children.getByName('super-cinematic');
      const phases = [
        { name: 'grab', actor: 'drive-caster', start: 0, end: 540 },
        { name: 'throw', actor: 'drive-caster', start: 550, end: 1440 },
        { name: 'boarding', actor: 'drive-entry', start: 1500, end: 2440 },
        { name: 'return', actor: 'drive-caster', start: 4100, end: 5700 },
      ];
      return {
        fromRight,
        phases: phases.map(phase => {
          const poses = new Set<string>();
          for (let t = phase.start; t <= phase.end; t += 20) {
            s.superMove.update(Math.max(0, t - s.superMove.elapsed));
            const image = layer.getByName(phase.actor);
            if (image.visible && image.alpha > 0.1) poses.add(`${image.texture.key}:${image.frame.name}`);
          }
          return { name: phase.name, poses: [...poses] };
        }),
      };
    });
  });
  for (const side of samples) for (const phase of side.phases) {
    expect(phase.poses.length, `${phase.name}, from ${side.fromRight ? 'right' : 'left'}: a moving body must not hold a single cutout`)
      .toBeGreaterThanOrEqual(4);
  }
});

test('releasing the i30 throw keeps the victim rotation continuous in both directions', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const turns = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(fromRight => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      const victim = s.children.getByName('super-cinematic').getByName('drive-victim');
      s.superMove.update(549);
      const before = victim.angle;
      s.superMove.update(2);
      return { fromRight, degrees: Math.abs(((victim.angle - before + 540) % 360) - 180) };
    });
  });
  for (const turn of turns) expect(turn.degrees, `throw release from ${turn.fromRight ? 'right' : 'left'}`).toBeLessThan(3);
});

test('the i30 maintains its forward velocity through contact instead of suddenly speeding up', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const velocities = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].map(fromRight => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      const car = s.children.getByName('super-cinematic').getByName('drive-car');
      const xs: number[] = [];
      for (const t of [3290, 3300, 3310]) {
        s.superMove.update(t - s.superMove.elapsed);
        xs.push(car.x);
      }
      const sign = fromRight ? -1 : 1;
      return { fromRight, before: (xs[1] - xs[0]) / 10 * sign, after: (xs[2] - xs[1]) / 10 * sign };
    });
  });
  for (const v of velocities) {
    expect(v.before).toBeGreaterThan(0);
    expect(v.after).toBeGreaterThan(0);
    expect(Math.abs(v.after - v.before), `speed jump at impact from ${v.fromRight ? 'right' : 'left'}`).toBeLessThan(0.15);
  }
});

test('pausing or seeking the cinematic gives the same visible poses as advancing its clock', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const begin = (fromRight: boolean) => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.superMove.start(s.player, s.opponent);
      return s.superMove.drive;
    };
    const read = (drive: any) => ['drive-caster', 'drive-victim', 'drive-entry', 'drive-car'].map(name => {
      const image = drive.layer.getByName(name);
      return image.visible && image.alpha > 0 ? {
        name, texture: image.texture.key, frame: image.frame.name,
        x: image.x, y: image.y, angle: image.angle, alpha: image.alpha,
        scale: [image.scaleX, image.scaleY], origin: [image.originX, image.originY], flip: image.flipX,
      } : { name, visible: false };
    });
    return [false, true].flatMap(fromRight => [800, 1540, 4350].map(time => {
      let drive = begin(fromRight);
      for (let t = 0; t < time; t += 16) drive.render(t, 4, false);
      drive.render(time, 4, false);
      const advancing = read(drive);
      drive.render(time, 4, false);
      const paused = read(drive);
      drive = begin(fromRight);
      drive.render(time, 4, false);
      const direct = read(drive);
      drive.render(4800, 4, false);
      drive.render(time, 4, false);
      return { fromRight, time, advancing, paused, direct, backward: read(drive) };
    }));
  });
  for (const sample of samples) {
    const label = `${sample.time}ms, from ${sample.fromRight ? 'right' : 'left'}`;
    expect(sample.paused, `pause ${label}`).toEqual(sample.advancing);
    expect(sample.direct, `direct render ${label}`).toEqual(sample.advancing);
    expect(sample.backward, `backward seek ${label}`).toEqual(sample.advancing);
  }
});

test('mirroring the i30 poses preserves the visible body position across registered frames', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const surface = s.add.renderTexture(0, 0, 1280, 720).setVisible(false);
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const visibleCenter = async (actor: any) => {
      surface.clear().draw(actor, actor.x, actor.y);
      const image = await new Promise<HTMLImageElement>(resolve => surface.snapshot(resolve));
      context.clearRect(0, 0, 1280, 720);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 1280, 720).data;
      let totalX = 0, count = 0;
      for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
        if (pixels[(y * 1280 + x) * 4 + 3] > 64) { totalX += x; count++; }
      }
      return { x: totalX / count, pixels: count };
    };
    const result = [];
    try {
      // Includes the throw sheet and two return poses with corrected source registration.
      for (const time of [300, 4480, 4975]) {
        const sides = [];
        for (const fromRight of [false, true]) {
          s.superMove.cancel();
          s.player.resetForRound(fromRight ? 1320 : 600);
          s.opponent.resetForRound(fromRight ? 1205 : 715);
          s.superMove.start(s.player, s.opponent);
          s.superMove.drive.render(time, 4, false);
          sides.push(await visibleCenter(s.superMove.drive.layer.getByName('drive-caster')));
        }
        result.push({ time, left: sides[0], right: sides[1] });
      }
    } finally {
      surface.destroy();
      s.superMove.cancel();
    }
    return result;
  });
  for (const sample of samples) {
    expect(sample.left.pixels, `left pose ${sample.time}ms is visible`).toBeGreaterThan(10000);
    expect(sample.right.pixels, `right pose ${sample.time}ms is visible`).toBeGreaterThan(10000);
    // Mirrored pixel centres in a 1280-wide render sum to 1279, independent of the pose.
    expect(Math.abs(sample.left.x + sample.right.x - 1279), `visible body mirror at ${sample.time}ms`).toBeLessThan(2);
  }
});
