import { test, expect, Page } from '@playwright/test';

// This suite processes all five fighters in a fresh browser context.
test.setTimeout(90000);

async function select(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game.scene.isActive('SelectionScene'));
}

test('all five fighters use the supplied heights for uniform body scale and collision reach', async ({ page }) => {
  await select(page);
  const rows = await page.evaluate(async () => {
    const { FIGHTER_ROSTER } = await import('/src/config/roster.ts');
    const { Fighter } = await import('/src/characters/Fighter.ts');
    const { createCharacterLoader, getManifest } = await import('/src/config/characters.ts');
    const s = (window as any).__game.scene.getScene('SelectionScene');
    return FIGHTER_ROSTER.map((r: any) => {
      const { registry, loader } = createCharacterLoader(s, getManifest(s, r.id));
      const f = new Fighter({ scene: s, registry, loader, characterId: r.id, x: 400, y: 600, stats: r.stats });
      f.executeAttack('LIGHT_PUNCH');
      return { id: r.id, cm: r.heightCm, height: f.standingHurtbox.height,
        sx: f.sprite.scaleX, sy: f.sprite.scaleY, reach: f.getActiveAttackDef().hitbox.width };
    });
  });
  const expected: Record<string, number> = { tilin: 167, cesar: 183, joako: 181, jorell: 182, tata: 165 };
  const baseline = rows.find((r: any) => r.id === 'tilin')!;
  for (const r of rows) {
    expect(r.cm).toBe(expected[r.id]);
    expect(r.sx).toBe(r.sy);
    expect(r.height / baseline.height).toBeCloseTo(expected[r.id] / 167, 5);
    expect(r.reach / baseline.reach).toBeCloseTo(expected[r.id] / 167, 5);
  }
});

test('selection shows centimetres for every fighter and scales portraits by their height', async ({ page }) => {
  await select(page);
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push(await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('SelectionScene');
      const p = s.content.getByName('selection-portrait-player');
      return { id: s.playerChoice.characterId, height: p.displayHeight,
        label: s.content.getByName('selection-height-player')?.text };
    }));
    await page.keyboard.press('KeyE');
  }
  const expected: Record<string, number> = { tilin: 167, cesar: 183, joako: 181, jorell: 182, tata: 165 };
  for (const r of rows) {
    expect(r.label).toBe(`${expected[r.id]} cm`);
    expect(r.height / rows[0].height).toBeCloseTo(expected[r.id] / 167, 5);
  }
});
