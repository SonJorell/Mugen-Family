import { test, expect } from '@playwright/test';
import { startFight } from './fight-helper';

// These reaction drawings face right in their source atlas. Flipping them must make
// Tilin look at César on her left, just as the normal fighter does after the super.
test('Tilin lands and recovers facing César on either side, including the return to combat', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const sequences = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    return [false, true].flatMap(fromRight => [100, 10].map(health => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
      // The grab can catch someone facing away; completion must turn her toward César.
      s.opponent.facingRight = !fromRight; s.opponent.sprite.setFlipX(fromRight);
      s.opponent.currentHealth = health;
      s.superMove.start(s.player, s.opponent);
      const layer = s.children.getByName('super-cinematic');
      const victim = layer.getByName('drive-victim'), caster = layer.getByName('drive-caster');
      const samples = [1600, 2200, 3200, 4350, 5700].map(time => {
        s.superMove.update(time - s.superMove.elapsed);
        return { time, flip: victim.flipX, victimX: victim.x, casterX: caster.x };
      });
      s.superMove.update(5800 - s.superMove.elapsed);
      return { fromRight, health, samples, resumed: {
        active: s.superMove.active, flip: s.opponent.sprite.flipX, facingRight: s.opponent.facingRight,
        victimX: s.opponent.x, casterX: s.player.x, visible: s.opponent.sprite.visible,
      } };
    }));
  });
  for (const sequence of sequences) {
    const label = `César on the ${sequence.fromRight ? 'right' : 'left'}, starting health ${sequence.health}`;
    for (const sample of sequence.samples) {
      expect.soft(sample.flip, `${label}, ${sample.time}ms: Tilin must face the enemy, not the arena edge`)
        .toBe(sample.victimX > sample.casterX);
    }
    expect(sequence.resumed.active, label).toBe(false);
    expect(sequence.resumed.visible, label).toBe(true);
    expect.soft(sequence.resumed.flip, `${label}: the fighter still faces César immediately after the cinematic`)
      .toBe(sequence.resumed.victimX > sequence.resumed.casterX);
    expect.soft(sequence.resumed.facingRight, label).toBe(sequence.resumed.casterX > sequence.resumed.victimX);
    expect.soft(sequence.samples.at(-1)!.flip, `${label}: no sudden turn when normal combat returns`)
      .toBe(sequence.resumed.flip);
  }
});

test('Tilin keeps looking toward César when the landing is paused or reached by a direct or backward seek', async ({ page }) => {
  await startFight(page, 'cesar', 'tilin', { mode: 'training' });
  const samples = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const begin = (fromRight: boolean) => {
      s.superMove.cancel();
      s.player.resetForRound(fromRight ? 1320 : 600);
      s.opponent.resetForRound(fromRight ? 1205 : 715);
      s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
      s.superMove.start(s.player, s.opponent);
      return s.superMove.drive;
    };
    const read = (drive: any) => {
      const actor = drive.layer.getByName('drive-victim');
      return { flip: actor.flipX, x: actor.x, y: actor.y, angle: actor.angle,
        frame: actor.frame.name, texture: actor.texture.key };
    };
    return [false, true].flatMap(fromRight => [false, true].flatMap(reduced => [1600, 2200, 4350, 5700].map(time => {
      let drive = begin(fromRight);
      for (let tick = 0; tick < time; tick += 16) drive.render(tick, 4, reduced);
      drive.render(time, 4, reduced); const advancing = read(drive);
      drive.render(time, 4, reduced); const paused = read(drive);
      drive = begin(fromRight); drive.render(time, 4, reduced); const direct = read(drive);
      drive.render(5750, 4, reduced); drive.render(time, 4, reduced);
      return { fromRight, reduced, time, advancing, paused, direct, backward: read(drive) };
    })));
  });
  for (const sample of samples) {
    const label = `${sample.time}ms, César on the ${sample.fromRight ? 'right' : 'left'}, reduced motion ${sample.reduced}`;
    expect.soft(sample.advancing.flip, `${label}: look back toward the enemy`).toBe(!sample.fromRight);
    expect(sample.paused, `pause ${label}`).toEqual(sample.advancing);
    expect(sample.direct, `direct seek ${label}`).toEqual(sample.advancing);
    expect(sample.backward, `backward seek ${label}`).toEqual(sample.advancing);
  }
});
