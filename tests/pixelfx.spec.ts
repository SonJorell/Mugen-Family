import { test, expect, Page } from '@playwright/test';
import { startFight } from './fight-helper';

/**
 * Lands `attack` from the player on a passive dummy, lets the burst play `ms` past contact and
 * renders one frame. Returns the live bursts and how many of their pixels are drawn.
 */
async function landAndRender(page: Page, attack: string, block: boolean, ms: number) {
  return page.evaluate(({ attack, block, ms }) => {
    const g = (window as any).__game, s = g.scene.getScene('FightScene'), p = s.player, o = s.opponent;
    s.impacts.destroy(); s.hitstopMs = 0;
    p.input.getState = () => ({});
    p.finishRound('IDLE'); o.finishRound('IDLE');
    p.x = 800; o.x = 910; p.updateFacing(o.x); o.updateFacing(p.x);
    if (block) o.combatState.setState('BLOCKING');
    p.executeAttack(attack);
    let frames = 0;
    while (!s.inHitstop && frames++ < 60) s.update(0, 1000 / 60);
    for (let t = 0; t < ms; t += 1000 / 60) s.update(0, 1000 / 60);
    s.cameras.main.resetFX();
    g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender();
    const names: string[] = [];
    let drawn = 0;
    for (const burst of s.impacts.live ?? []) {
      names.push(burst.color.image.name);
      const data: Uint8ClampedArray = burst.color.pixels.data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
    }
    return { count: s.impacts.count, names, drawn };
  }, { attack, block, ms });
}

const CASES: [string, string, boolean, string][] = [
  ['golpe-ligero', 'LIGHT_PUNCH', false, 'impact-light'],
  ['golpe-pesado', 'HEAVY_KICK', false, 'impact-heavy'],
  ['bloqueo', 'HEAVY_PUNCH', true, 'impact-block'],
];

for (const [player, opponent] of [['tilin', 'cesar'], ['cesar', 'tilin']]) {
  test(`pixelfx bursts draw at the contact point for hits and blocks (${player} vs ${opponent})`, async ({ page }) => {
    await startFight(page, player, opponent, { mode: 'training' });
    for (const [label, attack, block, name] of CASES) {
      const r = await landAndRender(page, attack, block, 50);
      expect(r.count).toBe(1);
      expect(r.names).toEqual([name]);
      expect(r.drawn).toBeGreaterThan(20);
      await page.screenshot({ path: `artifacts/pixelfx/${label}-${player}.png` });
    }
    // Bursts end on their own and free their textures.
    const left = await page.evaluate(() => {
      const s = (window as any).__game.scene.getScene('FightScene');
      for (let i = 0; i < 120; i++) s.update(0, 1000 / 60);
      return { count: s.impacts.count, textures: s.textures.getTextureKeys().filter((k: string) => k.startsWith('pixelfx-')).length };
    });
    expect(left).toEqual({ count: 0, textures: 0 });
  });
}
