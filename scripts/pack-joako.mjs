import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Package the generated atlas rows without repainting or replacing their alpha.
const sheets = {
  movement: ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'DASH'],
  air: ['CROUCH', 'JUMP', 'AIR_PUNCH', 'AIR_KICK'],
  attacks: ['LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK'],
  defense: ['BLOCK', 'HIT_REACTION', 'STUN', 'GET_UP'],
  recovery: ['KNOCKDOWN', 'DEFEAT', 'VICTORY', 'TAUNT'],
  super: ['SPECIAL_ATTACK', 'BUILD', 'FIRE', 'LANDING'],
};
const loops = ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'STUN', 'VICTORY'];
const rates = { IDLE: 8, WALK_FORWARD: 14, WALK_BACKWARD: 12, DASH: 20, CROUCH: 32, JUMP: 10,
  BLOCK: 30, HIT_REACTION: 22, STUN: 10, GET_UP: 12, KNOCKDOWN: 14, DEFEAT: 12,
  VICTORY: 9, TAUNT: 10, SPECIAL_ATTACK: 15, BUILD: 12, FIRE: 16, LANDING: 24 };
const manifest = { characterId: 'joako', name: 'Joako', assetPath: '/assets/characters/joako/',
  spriteSheet: { columns: 6, rows: 1, frameCount: 6, sourceBodyHeight: 238, groundY: 248, animations: {} }, animations: {} };
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await mkdir('public/assets/characters/joako', { recursive: true });
  for (const [sheet, names] of Object.entries(sheets)) {
    // The original air atlas has a translucent matte; use the corrected RGBA source.
    const sourceName = sheet === 'air' ? 'air-clean' : sheet;
    const source = (await readFile(`art/joako/${sourceName}.png`)).toString('base64');
    const rows = await page.evaluate(async source => {
      const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height / 4;
      const ctx = c.getContext('2d');
      return Array.from({ length: 4 }, (_, row) => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, row * c.height, c.width, c.height, 0, 0, c.width, c.height);
        return c.toDataURL('image/webp', 0.94).split(',')[1];
      });
    }, source);
    for (const [i, name] of names.entries()) {
      await writeFile(`public/assets/characters/joako/${name}.webp`, Buffer.from(rows[i], 'base64'));
      manifest.animations[name] = [`/assets/characters/joako/${name}.webp`];
      manifest.spriteSheet.animations[name] = { frameRate: rates[name] ?? 22, repeat: loops.includes(name) ? -1 : 0 };
      if (name.includes('PUNCH') || name.includes('KICK') || name === 'SPECIAL_ATTACK') {
        Object.assign(manifest.spriteSheet.animations[name], { impactStart: 3, impactEnd: 4 });
      }
    }
  }
  const webp = async name => page.evaluate(async source => {
    const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.93).split(',')[1];
  }, (await readFile(`art/joako/${name}.png`)).toString('base64'));
  const portrait = await webp('portrait');
  await writeFile('public/assets/characters/joako/portrait.webp', Buffer.from(portrait, 'base64'));
  await writeFile('public/assets/characters/joako/rifle.webp', Buffer.from(await webp('rifle-reference'), 'base64'));
  await writeFile('public/assets/characters/joako/DOUBLE_JUMP.webp', Buffer.from(await webp('doublejump'), 'base64'));
  manifest.animations.DOUBLE_JUMP = ['/assets/characters/joako/DOUBLE_JUMP.webp'];
  manifest.spriteSheet.animations.DOUBLE_JUMP = { columns: 4, rows: 3, frameCount: 12, sourceBodyHeight: 318, groundY: 330, frameRate: 22, repeat: 0 };
  await writeFile('public/assets/characters/joako/VICTORY.webp', Buffer.from(await webp('victory-dance'), 'base64'));
  manifest.spriteSheet.animations.VICTORY = { columns: 6, rows: 4, frameCount: 24, sourceBodyHeight: 202,
    groundY: 250, canvasHeight: 448, frameRate: 18, repeat: -1 };
  await writeFile('public/assets/characters/joako/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log('Packaged 25 animations / 174 generated poses, including the 24-frame victory dance, and the menu/super portrait.');
} finally { await browser.close(); }
