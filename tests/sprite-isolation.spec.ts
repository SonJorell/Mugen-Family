import { test, expect } from '@playwright/test';

test('Jorell double jump contains one complete body per frame, without parts of neighboring poses', async ({ page }) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  const frames = await page.evaluate(async () => {
    const s = (window as any).__game.scene.getScene('MenuScene');
    const { createCharacterLoader, getManifest } = await import('/src/config/characters.ts');
    const { registry } = createCharacterLoader(s, getManifest(s, 'jorell'));
    return registry.get('DOUBLE_JUMP').frames.map((key: string) => {
      const c = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const p = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const w = Math.ceil(c.width / 2), h = Math.ceil(c.height / 2), grid = new Uint8Array(w * h);
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (p[(y * c.width + x) * 4 + 3] > 64) grid[Math.floor(y / 2) * w + Math.floor(x / 2)] = 1;
      }
      const sizes: number[] = [];
      for (let start = 0; start < grid.length; start++) {
        if (!grid[start]) continue;
        const stack = [start]; grid[start] = 0; let size = 0;
        while (stack.length) {
          const i = stack.pop()!; size++;
          const x = i % w, y = Math.floor(i / w);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy, n = ny * w + nx;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[n]) { grid[n] = 0; stack.push(n); }
          }
        }
        if (size * 4 > 400) sizes.push(size * 4);
      }
      return { key, bodies: sizes.sort((a, b) => b - a) };
    });
  });
  for (const frame of frames) {
    expect(frame.bodies.length, JSON.stringify(frame)).toBe(1);
    expect(frame.bodies[0]).toBeGreaterThan(10000);
  }
});
