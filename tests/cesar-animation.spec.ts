import { test, expect, Page } from '@playwright/test';
import { confirmSelection } from './selection-helper';

async function cesarFight(page: Page) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
  await page.keyboard.press('KeyE');
  await page.mouse.click(640, 565);
  await confirmSelection(page);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('FightScene').roundSystem.phase === 'FIGHT');
  await page.evaluate(() => { (window as any).__game.loop.stop(); });
}

test('César displays an extended fist or foot on the first damaging tick of each heavy attack', async ({ page }) => {
  await cesarFight(page);
  const reaches = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene'), p = s.player;
    const rightEdge = () => {
      const canvas = p.sprite.texture.getSourceImage(), ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let right = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 128) right = Math.max(right, x);
      }
      return right;
    };
    return ['HEAVY_PUNCH', 'HEAVY_KICK'].map(attack => {
      p.finishRound('IDLE');
      const guard = rightEdge();
      p.executeAttack(attack);
      for (let i = 0; i < 90 && !p.hitbox?.active; i++) p.update(1000 / 60);
      return { attack, reach: rightEdge() - guard, active: p.hitbox?.active };
    });
  });
  for (const r of reaches) {
    expect(r.active, r.attack).toBe(true);
    expect(r.reach, `${r.attack}: the visible strike must extend beyond guard`).toBeGreaterThan(40);
  }
});

test('César stays grounded and keeps his body scale when rising from a knockdown', async ({ page }) => {
  await cesarFight(page);
  const bounds = await page.evaluate(() => {
    const s = (window as any).__game.scene.getScene('FightScene');
    const box = (name: string, frame: number) => {
      const canvas = s.textures.get(s.registry2.get(name).frames[frame]).getSourceImage();
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let top = 384, bottom = 0, edge = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 128) {
          top = Math.min(top, y); bottom = Math.max(bottom, y);
          if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edge++;
        }
      }
      return { top, bottom, height: bottom - top + 1, edge };
    };
    return { idle: box('IDLE', 0), down: box('KNOCKDOWN', 11), rise: Array.from({ length: 12 }, (_, i) => box('GET_UP', i)) };
  });
  expect(bounds.down.height).toBeLessThan(bounds.idle.height * 0.6);
  expect(Math.abs(bounds.rise[11].height - bounds.idle.height)).toBeLessThan(12);
  for (const frame of bounds.rise) {
    expect(frame.edge).toBe(0);
    expect(Math.abs(frame.bottom - bounds.idle.bottom)).toBeLessThan(4);
  }
});
