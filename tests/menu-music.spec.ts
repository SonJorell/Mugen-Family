import { test, expect, Page } from '@playwright/test';
import { bootGame, startFight } from './fight-helper';

const music = (page: Page) => page.evaluate(() => {
  const g = (window as any).__game;
  const playing = g.sound.sounds.filter((s: any) => s.key.startsWith('music-') && !s.pendingRemove && (s.isPlaying || s.isPaused));
  const s = playing[playing.length - 1];
  return s ? { key: s.key, playing: s.isPlaying, paused: s.isPaused, mute: s.currentConfig.mute, volume: s.currentConfig.volume,
    marker: s.currentMarker ? { start: s.currentMarker.start, duration: s.currentMarker.duration, loop: s.currentMarker.config.loop } : null,
    count: playing.length } : null;
});

test('«Cinturão de Elite» loads after the menu appears and loops without its silent ends', async ({ page }) => {
  const loaded: number[] = [];
  page.on('requestfinished', r => { if (r.url().includes('cinturao-de-elite.mp3')) loaded.push(Date.now()); });
  await bootGame(page);
  // Browsers keep audio locked until the first key or click, like a real player's first input.
  await page.keyboard.press('Shift');
  // The menu is already up before the song has to finish downloading (it is not part of the preload).
  const preload = await page.evaluate(() => (window as any).__game.cache.audio.exists('music-cinturao'));
  await expect.poll(async () => (await music(page))?.key, { timeout: 30000 }).toBe('music-cinturao');
  expect(loaded.length).toBe(1);
  const m = (await music(page))!;
  expect(m.marker).toEqual({ start: 0.09, duration: expect.closeTo(174.81, 2), loop: true });
  expect(m.count).toBe(1);
  expect(typeof preload).toBe('boolean');
});

test('the menu plays its song and the fight keeps its own music', async ({ page }) => {
  await bootGame(page);
  await page.keyboard.press('Shift');
  await expect.poll(async () => (await music(page))?.key, { timeout: 30000 }).toBe('music-cinturao');
  // Volume and mute are only changed in Configuración (see settings.spec.ts).
  // Into a fight: «Hardline Beatdown», alone and without its silent ends; pausing the fight pauses it.
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.stop('MenuScene');
    g.scene.start('FightScene', { mode: 'training' });
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 20000 });
  await expect.poll(async () => (await music(page))?.key, { timeout: 30000 }).toBe('music-hardline');
  expect((await music(page))!.count).toBe(1);
  expect((await music(page))!.marker).toEqual({ start: 0.08, duration: expect.closeTo(170.62, 2), loop: true });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await music(page))?.paused).toBe(true);
  // Back to the menu: the song again.
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.scene.key));
    g.scene.start('MenuScene');
  });
  await expect.poll(async () => (await music(page))?.key).toBe('music-cinturao');
});

test('Configuración switches the menu music to the original track and remembers it', async ({ page }) => {
  await bootGame(page);
  await page.evaluate(() => { const g = (window as any).__game; g.scene.stop('MenuScene'); g.scene.start('SettingsScene'); });
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('SettingsScene'); return s.rows[s.selectedIndex].label;
  })).toBe('Música del menú');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await music(page))?.key).toBe('music-menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tilin-audio') ?? '{}').menuTrack)).toBe('original');
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.waitForTimeout(1500);
  expect((await music(page))?.key).toBe('music-menu');
});

test('the credits name the song and its pending licence', async ({ page }) => {
  await startFight(page, 'tilin', 'tilin', { mode: 'training' });
  const credits = await page.evaluate(async () => (await import('/src/config/arcade.ts')).CREDITS.flatMap((c: any) => c.lines).join('\n'));
  expect(credits).toContain('Cinturão de Elite');
  expect(credits).toContain('licencia por confirmar');
});

test('if «Hardline Beatdown» cannot load, the fight plays the original track', async ({ page }) => {
  await page.route('**/hardline-beatdown.mp3', route => route.abort());
  await bootGame(page);
  await page.keyboard.press('Shift');
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.scene.key));
    g.scene.start('FightScene', { mode: 'training' });
  });
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT', null, { timeout: 20000 });
  await expect.poll(async () => (await music(page))?.key, { timeout: 30000 }).toBe('music-fight');
  expect((await music(page))!.count).toBe(1);
});
