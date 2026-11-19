import { test, expect } from '@playwright/test';
import { startFight } from './fight-helper';

test.setTimeout(90000);

test('Jorell idle keeps both feet planted and advances through a complete seamless breathing cycle', async ({ page }) => {
  await startFight(page, 'jorell', 'tata', { mode: 'training' });
  const result = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player;
    const { createCharacterLoader, getManifest } = await import('/src/config/characters.ts');
    const { registry } = createCharacterLoader(s, getManifest(s, 'jorell'));
    const def = registry.get('IDLE');
    const feet = def.frames.map((key: string) => {
      const c = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let bottom = 0, left = c.width, right = 0, top = c.height;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (pixels[(y * c.width + x) * 4 + 3] > 64) {
        bottom = Math.max(bottom, y); top = Math.min(top, y);
      }
      for (let y = bottom - 13; y <= bottom; y++) for (let x = 0; x < c.width; x++) if (pixels[(y * c.width + x) * 4 + 3] > 64) {
        left = Math.min(left, x); right = Math.max(right, x);
      }
      return { key, left, right, center: (left + right) / 2, bottom, top };
    });
    p.resetForRound(600);
    const order = [p.animationFrame];
    for (let i = 0; i < 360; i++) {
      p.playAnimation('IDLE'); p.update(1000 / 60);
      if (p.animationFrame !== order.at(-1)) order.push(p.animationFrame);
    }
    return { feet, order, count: def.frames.length, x: p.x, state: p.combatState.state };
  });
  const centers = result.feet.map(f => f.center);
  expect(Math.max(...centers) - Math.min(...centers), JSON.stringify(result.feet)).toBeLessThanOrEqual(4);
  expect(Math.abs(centers.at(-1)! - centers[0])).toBeLessThanOrEqual(3);
  expect(new Set(result.feet.map(f => f.bottom)).size).toBeLessThanOrEqual(2);
  for (let i = 1; i < result.order.length; i++) expect(result.order[i]).toBe((result.order[i - 1] + 1) % result.count);
  expect(result.order.length).toBeGreaterThan(result.count * 2);
  expect(result.x).toBe(600); expect(result.state).toBe('IDLE');
});

test('the i30 cinematic uses the opponent combat poses and makes them fall and recover', async ({ page }) => {
  await startFight(page, 'cesar', 'jorell', { mode: 'training' });
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.superMove.start(s.player, s.opponent);
    const victim = s.children.getByName('super-cinematic').getByName('drive-victim');
    return [300, 1200, 2000, 3150, 3700, 4800, 5600].map(at => {
      s.superMove.update(at - s.superMove.elapsed);
      return { at, key: victim.texture.key, flip: victim.flipX, angle: victim.angle };
    });
  });
  expect(result.every(p => p.key.startsWith('jorell_'))).toBe(true);
  expect(result.some(p => p.key.includes('KNOCKDOWN'))).toBe(true);
  expect(result.some(p => p.key.includes('GET_UP'))).toBe(true);
  expect(result.every(p => p.flip && p.angle === 0)).toBe(true);
});

test('the vocal cinematic keeps the selected arena and the current painted singer', async ({ page }) => {
  await startFight(page, 'tilin', 'tata', { mode: 'training', stageIndex: 2 });
  const result = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.superMove.start(s.player, s.opponent); s.superMove.update(1500);
    const layer = s.children.getByName('super-cinematic');
    return { stage: layer.getByName('canto-stage')?.texture.key, expected: s.stageBgImage.texture.key,
      singer: layer.list.find((o: any) => o.texture?.key.startsWith('tilin_SPECIAL_ATTACK'))?.texture.key,
      palette: layer.list.find((o: any) => o.texture?.key.startsWith('tilin_SPECIAL_ATTACK'))?.tintTopLeft,
      original: s.player.sprite.tintTopLeft };
  });
  expect(result.stage).toBe(result.expected);
  expect(result.singer).toContain('tilin_SPECIAL_ATTACK');
  expect(result.palette).toBe(result.original);
});
