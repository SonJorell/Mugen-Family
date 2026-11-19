import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Crop the generated RGBA atlases into runtime rows. No recolouring or matte removal here.
const sheets = {
  movement: ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'DASH'],
  air: ['CROUCH', 'JUMP', 'AIR_PUNCH', 'AIR_KICK'],
  attacks: ['LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK'],
  defense: ['BLOCK', 'HIT_REACTION', 'STUN', 'GET_UP'],
  recovery: ['KNOCKDOWN', 'DEFEAT', 'VICTORY', 'TAUNT'],
  super: ['SPECIAL_ATTACK', 'TELEPORT', 'TRANSFORM', 'CHARGE'],
  finish: ['BEAM', 'POWER_RETURN', 'DOUBLE_JUMP', 'LANDING'],
};
const loops = ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'STUN', 'VICTORY'];
const rates = { IDLE: 8, WALK_FORWARD: 12, WALK_BACKWARD: 11, DASH: 20, CROUCH: 30, JUMP: 10,
  BLOCK: 30, HIT_REACTION: 22, STUN: 10, GET_UP: 12, KNOCKDOWN: 14, DEFEAT: 12,
  VICTORY: 10, TAUNT: 10, SPECIAL_ATTACK: 15, TELEPORT: 12, TRANSFORM: 9, CHARGE: 10,
  BEAM: 18, POWER_RETURN: 10, DOUBLE_JUMP: 16, LANDING: 24 };
const root = 'public/assets/characters/jorell';
const manifest = { characterId: 'jorell', name: 'Jorell', assetPath: '/assets/characters/jorell/',
  spriteSheet: { columns: 6, rows: 1, frameCount: 6, sourceBodyHeight: 238, groundY: 248, animations: {} }, animations: {} };
const browser = await chromium.launch();
try {
  const page = await browser.newPage(), audit = {};
  await mkdir(root, { recursive: true }); await mkdir('artifacts/jorell-v2', { recursive: true });
  for (const [sheet, names] of Object.entries(sheets)) {
    const source = (await readFile(`art/jorell-v2/${sheet}.png`)).toString('base64');
    const result = await page.evaluate(async source => {
      const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
      if (img.width !== 1536 || img.height !== 1024) throw new Error(`Wrong atlas dimensions ${img.width}x${img.height}`);
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const corners = Array.from({ length: 24 }, (_, index) => {
        let maxAlpha = 0;
        for (const dx of [0, 250]) for (const dy of [0, 250]) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
          const px = index % 6 * 256 + dx + x, py = Math.floor(index / 6) * 256 + dy + y;
          maxAlpha = Math.max(maxAlpha, data[(py * c.width + px) * 4 + 3]);
        }
        return maxAlpha;
      });
      c.height = 256;
      const rows = Array.from({ length: 4 }, (_, row) => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, row * 256, 1536, 256, 0, 0, 1536, 256);
        return c.toDataURL('image/webp', 0.95).split(',')[1];
      });
      return { rows, corners };
    }, source);
    audit[sheet] = result.corners;
    if (result.corners.some(a => a > 2)) throw new Error(`${sheet}: nontransparent frame corners ${result.corners.join(',')}`);
    for (const [i, name] of names.entries()) {
      await writeFile(`${root}/${name}.webp`, Buffer.from(result.rows[i], 'base64'));
      manifest.animations[name] = [`/assets/characters/jorell/${name}.webp`];
      manifest.spriteSheet.animations[name] = { frameRate: rates[name] ?? 22, repeat: loops.includes(name) ? -1 : 0 };
      if (name.includes('PUNCH') || name.includes('KICK') || name === 'SPECIAL_ATTACK') {
        Object.assign(manifest.spriteSheet.animations[name], { impactStart: 3, impactEnd: 4 });
      }
    }
  }
  for (const [sourceName, animation] of [['transformation', 'TRANSFORM'], ['release', 'BEAM']]) {
    const result = await page.evaluate(async source => {
      const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
      if (img.width !== 1536 || img.height !== 1024) throw new Error('Wrong cinematic atlas dimensions');
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const corners = Array.from({ length: 12 }, (_, index) => {
        let maxAlpha = 0;
        for (const dx of [0, 378]) for (const dy of [0, 334]) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
          const px = index % 4 * 384 + dx + x, py = Math.floor(Math.floor(index / 4) * 1024 / 3) + dy + y;
          maxAlpha = Math.max(maxAlpha, data[(py * c.width + px) * 4 + 3]);
        }
        return maxAlpha;
      });
      return { image: c.toDataURL('image/webp', 0.95).split(',')[1], corners };
    }, (await readFile(`art/jorell-v2/${sourceName}.png`)).toString('base64'));
    audit[sourceName] = result.corners;
    if (result.corners.some(a => a > 2)) throw new Error(`${sourceName}: opaque corners ${result.corners}`);
    await writeFile(`${root}/${animation}.webp`, Buffer.from(result.image, 'base64'));
    manifest.spriteSheet.animations[animation] = { columns: 4, rows: 3, frameCount: 12,
      sourceBodyHeight: 306, groundY: 331, frameRate: animation === 'TRANSFORM' ? 9 : 24, repeat: 0 };
  }
  for (const [input, output] of [['art/jorell/portrait.png', 'portrait'], ['art/jorell-v2/cutin.png', 'super-cutin']]) {
  const portrait = await page.evaluate(async source => {
    const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.95).split(',')[1];
  }, (await readFile(input)).toString('base64'));
  await writeFile(`${root}/${output}.webp`, Buffer.from(portrait, 'base64'));
  }
  await writeFile(`${root}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile('artifacts/jorell-v2/alpha-audit.json', JSON.stringify(audit, null, 2));
  console.log('Jorell v2: 28 animations / 180 runtime poses, transparent corners verified, menu and cinematic portraits.');
} finally { await browser.close(); }
