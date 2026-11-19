import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

/** Records every announcer line played from now on, with its final volume. */
async function spy(page: Page) {
  await page.evaluate(() => {
    const w = window as any, manager = w.__game.sound;
    w.__lines = [];
    const play = manager.play.bind(manager);
    manager.play = (key: string, extra?: any) => {
      const result = play(key, extra);
      if (key.startsWith('announcer-')) {
        const sound = manager.getAllPlaying().filter((s: any) => s.key === key).pop();
        // The configured volume: the gain node itself updates a moment later on the audio thread.
        w.__lines.push({ key, volume: sound ? Math.round(sound.currentConfig.volume * 100) / 100 : null });
      }
      return result;
    };
  });
}
const lines = (page: Page) => page.evaluate(() => (window as any).__lines.map((l: any) => l.key));

test('every announcer line is loaded and is a short, audible clip', async ({ page }) => {
  await bootGame(page);
  const clips = await page.evaluate(() => {
    const game = (window as any).__game;
    const keys = ['round-1', 'round-2', 'round-3', 'round-4', 'round-5', 'fight', 'ko', 'time', 'victory', 'defeat', 'draw', 'p1-wins', 'p2-wins', 'select'];
    return keys.map(k => {
      const buffer = game.cache.audio.get(`announcer-${k}`);
      const data: Float32Array = buffer.getChannelData(0);
      let energy = 0; for (const v of data) energy += v * v;
      return { k, duration: buffer.duration, rms: Math.sqrt(energy / data.length) };
    });
  });
  for (const c of clips) {
    expect(c.duration, c.k).toBeGreaterThan(0.8);
    expect(c.duration, c.k).toBeLessThan(3.5);
    expect(c.rms, c.k).toBeGreaterThan(0.03);
  }
});

test('the announcer calls the round, the fight, the K.O. and the verdict, and the winner says their line', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'training' });
  await spy(page);
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  for (let round = 0; round < 2; round++) {
    await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase !== 'END', null, { timeout: 20000 });
    await page.waitForFunction(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      if (s.roundSystem.phase === 'FIGHT') s.opponent.currentHealth = 0;
      return s.roundSystem.phase === 'END';
    }, null, { timeout: 20000 });
  }
  await expect.poll(() => lines(page), { timeout: 8000 }).toContain('announcer-victory');
  expect(await lines(page)).toEqual(['announcer-ko', 'announcer-round-2', 'announcer-fight', 'announcer-ko', 'announcer-victory']);
  const captions = await page.evaluate(() => (window as any).__game.scene.getScene('FightScene').children.list
    .flatMap((c: any) => [c, ...(c.list ?? [])]).map((c: any) => c.text).filter(Boolean).join('\n'));
  expect(captions).toContain('Tilin: «¿Me escuchaste? Porque toda Arica sí.»');
});

test('a timeout is called as "Tiempo" and two players get "Gana jugador"', async ({ page }) => {
  await startFight(page, 'tilin', 'cesar', { mode: 'versus' });
  await spy(page);
  await page.evaluate(() => { (window as any).__game.loop.start((window as any).__game.loop.callback); });
  // Round 1 by time with J2 ahead, round 2 by K.O. for J2.
  await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    s.player.currentHealth = 50; s.roundSystem._timeLeft = 0.05;
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'END');
  await page.waitForFunction(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    if (s.roundSystem.phase === 'FIGHT') s.player.currentHealth = 0;
    return s.roundSystem.phase === 'END' && s.roundSystem.matchOver;
  }, null, { timeout: 20000 });
  await expect.poll(() => lines(page), { timeout: 8000 }).toContain('announcer-p2-wins');
  expect((await lines(page))[0]).toBe('announcer-time');
});

test('the announcer volume in Configuración scales the voice and is saved', async ({ page }) => {
  await bootGame(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SettingsScene'); return s.rows[s.selectedIndex].label;
  })).toBe('Volumen del locutor');
  await spy(page);
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tilin-audio') ?? '{}').announcer)).toBeCloseTo(0.3, 2);
  const last = await page.evaluate(() => (window as any).__lines.pop());
  expect(last.key).toBe('announcer-fight');
  expect(last.volume).toBeCloseTo(0.3, 2);
});

test('the selection screen says «Selecciona a tu luchador» once, not on the stage step', async ({ page }) => {
  await bootGame(page);
  await spy(page);
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.scene.key));
    g.scene.start('SelectionScene', { mode: 'cpu' });
  });
  await expect.poll(() => lines(page)).toEqual(['announcer-select']);
  await page.evaluate(() => (window as any).__game.scene.getScene('SelectionScene').scene.restart({ mode: 'cpu', selectionPhase: 'stage' }));
  await page.waitForTimeout(500);
  expect(await lines(page)).toEqual(['announcer-select']);
});
