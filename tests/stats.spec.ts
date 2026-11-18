import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

const stats = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('fighter-stats') ?? 'null'));

test('the effects volume scales hits and interface sounds, not the music, and is saved', async ({ page }) => {
  await bootGame(page);
  await page.evaluate(() => { const g = (window as any).__game; g.scene.stop('MenuScene'); g.scene.start('SettingsScene'); });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SettingsScene'); return s.rows[s.selectedIndex].label;
  })).toBe('Volumen de efectos');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tilin-audio') ?? '{}').sfx)).toBeCloseTo(0.5, 2);
  await page.waitForFunction(() => (window as any).__game.sound.getAllPlaying().some((s: any) => s.key.startsWith('music-')), null, { timeout: 15000 });
  const volumes = await page.evaluate(() => {
    const g = (window as any).__game, sound = g.sound;
    sound.play('hit-light', { volume: 0.8 });
    sound.play('menu-move', { volume: 0.4 });
    const playing = sound.getAllPlaying();
    const of = (key: string) => playing.filter((s: any) => s.key === key).pop()?.currentConfig.volume;
    const music = playing.find((s: any) => s.key === 'music-menu' || s.key === 'music-cinturao');
    return { hit: of('hit-light'), ui: of('menu-move'), music: music?.currentConfig.volume };
  });
  expect(volumes.hit).toBeCloseTo(0.4, 2);
  expect(volumes.ui).toBeCloseTo(0.2, 2);
  expect(volumes.music).toBeCloseTo(0.35, 2);
});

test('matches, the best combo and arcade clears are saved and shown in the stats screen', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'cpu' });
  await page.evaluate(() => localStorage.removeItem('fighter-stats'));
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const p = s.player, o = s.opponent;
    // A real 2-hit combo on the CPU, held still.
    o.think = () => {};
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 915; p.updateFacing(o.x); o.updateFacing(p.x);
    const queue = ['lightPunch', 'heavyPunch'];
    let pending: string | null = queue.shift()!;
    const used = new Set<number>();
    p.input.getState = () => { const k = pending; pending = null; return k ? { [k]: true } : {}; };
    for (let f = 0; f < 90; f++) {
      s.update(0, 1000 / 60);
      if (p.hasHitThisSwing && !used.has(p.attackSerial) && queue.length) { used.add(p.attackSerial); pending = queue.shift()!; }
    }
  });
  // Two K.O. rounds end the match.
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  for (let round = 0; round < 2; round++) {
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase !== 'END', null, { timeout: 20000 });
    await page.waitForFunction(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      if (s.roundSystem.phase === 'FIGHT') { s.opponent.currentHealth = 0; s.player.currentHealth = s.player.maxHealth; }
      return s.roundSystem.phase === 'END';
    }, null, { timeout: 20000 });
  }
  await expect.poll(async () => (await stats(page))?.vsCpu?.wins).toBe(1);
  const saved = await stats(page);
  expect(saved.byFighter.tilin).toEqual({ wins: 1, losses: 0, draws: 0 });
  expect(saved.bestCombo).toEqual({ hits: 2, damage: 17, fighter: 'tilin' });

  // Win the fourth and final fight of the expanded roster with one continue.
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.scene.key));
    g.scene.start('ArcadeScene', { run: { player: { characterId: 'cesar', paletteId: 'original' }, step: 4, continues: 1 }, result: 'player' });
  });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('ArcadeScene'));
  expect((await stats(page)).arcade).toEqual({ cesar: { clears: 1, fewestContinues: 1 } });

  // The stats screen from the main menu (fifth option).
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.scene.key));
    g.scene.start('MenuScene');
  });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('MenuScene').introDone), { timeout: 15000 }).toBe(true);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('StatsScene'));
  const text = await page.evaluate(() => (window as any).__game.scene.getScene('StatsScene').content.list.map((c: any) => c.text).join('\n'));
  expect(text).toContain('1 combate · 1 victoria · 0 derrotas · 0 empates');
  expect(text).toContain('2 golpes · 17 de daño · con Tilin');
  expect(text).toContain('César: completado 1 vez · mejor: 1 continuación');
  expect(text).toContain('Tilin: sin completar');

  // Delete asks for confirmation.
  await page.keyboard.press('Delete');
  expect(await stats(page)).not.toBeNull();
  await page.keyboard.press('Delete');
  await expect.poll(() => stats(page)).toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
});

test('practice matches are not counted and two-player results go to their own line', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  await page.evaluate(async () => {
    localStorage.removeItem('fighter-stats');
    const { recordMatch } = await import('/src/systems/Stats.ts');
    recordMatch('training', 'tilin', 'player');
    recordMatch('versus', 'tilin', 'opponent');
    recordMatch('versus', 'tilin', 'player');
  });
  const saved = await stats(page);
  expect(saved.vsCpu).toEqual({ wins: 0, losses: 0, draws: 0 });
  expect(saved.versus).toEqual({ played: 2, p1: 1, p2: 1 });
});
