import { test, expect, Page } from '@playwright/test';

async function boot(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
}

test('the menu offers fighters, arcade, gallery, settings and stats', async ({ page }) => {
  await boot(page);
  const labels = await page.evaluate(() => (window as any).__game.scene.getScene('MenuScene').options.map((o: any) => o.label));
  expect(labels).toEqual(['Elegir luchadores', 'Modo arcade', 'Galería de movimientos', 'Configuración', 'Estadísticas']);
});

test('settings adjust music, overall volume and mute, persist them, and return to the menu', async ({ page }) => {
  await boot(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SettingsScene'));
  const state = () => page.evaluate(() => {
    const g = (window as any).__game;
    const music = g.sound.sounds.find((s: any) => s.key === 'music-menu' && !s.pendingRemove);
    return { master: g.sound.volume, musicVolume: music?.volume, mute: music?.mute, saved: JSON.parse(localStorage.getItem('tilin-audio') ?? '{}') };
  });
  const before = await state();
  // Música → apagar
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await state()).mute).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state()).mute).toBe(false);
  // Volumen de la música → subir
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state()).musicVolume).toBeGreaterThan(before.musicVolume);
  // Volumen general → bajar dos pasos
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await state()).master).toBeCloseTo(0.8, 2);
  expect((await state()).saved.master).toBeCloseTo(0.8, 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('MenuScene'));
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => (window as any).__game.sound.volume)).toBeCloseTo(0.8, 2);
});

test('fullscreen fills a large screen keeping 16:9', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width).toBeCloseTo(1920, 0);
  expect(box!.height).toBeCloseTo(1080, 0);
  await page.setViewportSize({ width: 2560, height: 1080 });
  await expect.poll(async () => (await page.locator('canvas').boundingBox())!.height).toBeCloseTo(1080, 0);
  const wide = await page.locator('canvas').boundingBox();
  expect(wide!.width / wide!.height).toBeCloseTo(16 / 9, 1);
  expect(wide!.x).toBeGreaterThan(0);
});
