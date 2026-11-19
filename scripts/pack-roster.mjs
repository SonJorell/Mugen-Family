import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

// Generated artwork is only sliced/encoded here; its original alpha is preserved.
const root = 'art/roster-unified', out = 'artifacts/roster-unified';
const pairs = JSON.parse(await readFile(`${root}/jobs.json`, 'utf8'));
const standard = {
  movement: ['IDLE', 'WALK_FORWARD', 'WALK_BACKWARD', 'DASH'],
  air: ['CROUCH', 'JUMP', 'AIR_PUNCH', 'AIR_KICK'],
  attacks: ['LIGHT_PUNCH', 'HEAVY_PUNCH', 'LIGHT_KICK', 'HEAVY_KICK'],
  defense: ['BLOCK', 'HIT_REACTION', 'STUN', 'GET_UP'],
  recovery: ['KNOCKDOWN', 'DEFEAT', 'VICTORY', 'TAUNT'],
};
const ids = process.argv.find(a => a.startsWith('--characters='))?.split('=')[1].split(',') ?? ['tilin', 'cesar', 'joako', 'jorell', 'tata'];
const auditOnly = process.argv.includes('--audit');
const browser = await chromium.launch();
const reports = {}, pending = [], problems = [];
try {
  const page = await browser.newPage();
  await mkdir(out, { recursive: true });
  for (const id of ids) {
    const backup = `${root}/${id}/original-manifest.json`;
    try { await access(backup); } catch { await writeFile(backup, await readFile(`public/assets/characters/${id}/manifest.json`)); }
    const manifest = JSON.parse(await readFile(backup, 'utf8'));
    const sheets = id === 'tilin' || id === 'cesar' ? pairs.filter(j => j.id === id) :
      Object.entries({ ...standard, ...(id === 'joako'
        ? { super: ['SPECIAL_ATTACK', 'BUILD', 'FIRE', 'LANDING'], doublejump: ['DOUBLE_JUMP'], 'victory-dance': ['VICTORY'] }
        : id === 'tata' ? { special: ['SPECIAL_ATTACK', 'DRINK', 'CELEBRATE', 'LANDING'],
          doublejump: ['DOUBLE_JUMP'], cycling: ['CYCLE'], 'mount-bike': ['MOUNT_BIKE'] }
        : { super: ['SPECIAL_ATTACK', 'TELEPORT', 'TRANSFORM', 'CHARGE'], finish: ['BEAM', 'POWER_RETURN', 'DOUBLE_JUMP', 'LANDING'],
          transformation: ['TRANSFORM'], release: ['BEAM'], idle: ['IDLE'] }) }).map(([sheet, names]) => {
          const twelve = ['doublejump', 'transformation', 'release', 'idle'].includes(sheet), dance = sheet === 'victory-dance';
          const bike = ['cycling', 'mount-bike'].includes(sheet);
          return { sheet, names, columns: bike ? 3 : twelve ? 4 : 6, rows: bike ? 2 : twelve ? 3 : 4,
            sourceBodyHeight: bike ? 470 : dance ? 202 : sheet === 'doublejump' ? 318 : twelve ? 306 : 238,
            groundY: bike ? 502 : dance ? 250 : sheet === 'doublejump' ? 330 : twelve ? 331 : 248 };
        });
    const newLayout = { columns: 6, rows: 1, frameCount: 6, sourceBodyHeight: 238, groundY: 248, animations: {} };
    const urls = {};
    reports[id] = {};
    let calibration = 1;
    for (const sheet of sheets) {
      const sourcePath = `${root}/${id}/${sheet.sheet}.png`;
      let source;
      try { source = (await readFile(sourcePath)).toString('base64'); }
      catch { problems.push(`Missing ${sourcePath}`); continue; }
      const result = await page.evaluate(async ({ source, sheet }) => {
        const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
        if (img.width !== 1536 || img.height !== 1024) throw new Error(`Unexpected dimensions: ${img.width}x${img.height}`);
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        const cw = img.width / sheet.columns, ch = img.height / sheet.rows;
        const cells = Array.from({ length: sheet.columns * sheet.rows }, (_, i) => {
          const sx = Math.round(i % sheet.columns * cw), sy = Math.round(Math.floor(i / sheet.columns) * ch);
          const w = Math.floor(cw), h = Math.floor(ch);
          const cornerAlpha = [0, 0, 0, 0]; let minY = h, maxY = 0, left = w, right = 0, count = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const a = pixels[((sy + y) * img.width + sx + x) * 4 + 3];
                        if ((x < 4 || x >= w - 4) && (y < 4 || y >= h - 4)) {
              const quadrant = (y >= h - 4 ? 2 : 0) + (x >= w - 4 ? 1 : 0);
              cornerAlpha[quadrant] = Math.max(cornerAlpha[quadrant], a);
            }
            if (a > 64) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); left = Math.min(left, x); right = Math.max(right, x); count++; }
          }
                    // A foot/extended hand can cross a nominal corner: the runtime uses
          // adaptive transparent gutters. A matte occupies most corners.
          const corner = [...cornerAlpha].sort((a, b) => a - b)[1];
          return { corner, cornerAlpha, height: maxY - minY + 1, top: minY, bottom: maxY, left, right, count };
        });
        const rowsPerAnimation = sheet.rows / sheet.names.length;
        const images = sheet.names.map((_, n) => {
          const output = document.createElement('canvas'); output.width = img.width; output.height = img.height / sheet.names.length;
          output.getContext('2d').drawImage(img, 0, n * output.height, img.width, output.height, 0, 0, img.width, output.height);
          return output.toDataURL('image/webp', 0.95).split(',')[1];
        });
        return { cells, images, rowsPerAnimation };
      }, { source, sheet });
      reports[id][sheet.sheet] = result.cells;
      if (result.cells.some(c => c.corner > 2 || c.count < 100)) problems.push(`${id}/${sheet.sheet}: nontransparent or empty cells`);
      if (sheet.sheet === 'movement') calibration = result.cells[0].height / sheet.sourceBodyHeight;
      for (const [i, name] of sheet.names.entries()) {
        const asset = `/assets/characters/${id}-unified/${name}.webp`;
        urls[name] = [asset];
        pending.push({ path: `public${asset}`, bytes: Buffer.from(result.images[i], 'base64') });
        const old = { ...manifest.spriteSheet.animations[name] };
                const referenceFrame = old.referenceFrame ?? 0;
        delete old.alignFeet; delete old.referenceFrame;
        const frameCount = sheet.columns * result.rowsPerAnimation;
        const cells = result.cells.slice(i * frameCount, (i + 1) * frameCount);
        const reference = cells[referenceFrame];
        const grounded = !['JUMP', 'AIR_PUNCH', 'AIR_KICK', 'DOUBLE_JUMP', 'TAUNT', 'VICTORY',
          'SPECIAL_ATTACK', 'BUILD', 'FIRE', 'TELEPORT', 'TRANSFORM', 'CHARGE', 'BEAM', 'POWER_RETURN', 'CYCLE', 'MOUNT_BIKE'].includes(name);
        if (id === 'cesar' && ['HEAVY_PUNCH', 'HEAVY_KICK'].includes(name)) { old.impactStart = 7; old.impactEnd = 7; }
        newLayout.animations[name] = { ...old, columns: sheet.columns, rows: result.rowsPerAnimation,
          frameCount: sheet.columns * result.rowsPerAnimation,
          // The registered breathing sheet has its own standing reference; all other
          // poses retain their existing body calibration and combat timing.
          sourceBodyHeight: sheet.sheet === 'idle' ? cells[0].height : sheet.sourceBodyHeight * calibration,
          groundY: Math.max(sheet.groundY, ...cells.map(c => c.bottom + 1)), alignFeet: grounded,
          ...(['tilin', 'cesar'].includes(id) ? { sourceAnchorX: (reference.left + reference.right) / 2 } : {}) };
      }
    }
    manifest.assetPath = `/assets/characters/${id}-unified/`;
    manifest.visualStyle = 'painted-arcade-2026'; manifest.version = 4;
    manifest.animations = urls; manifest.spriteSheet = newLayout;
    pending.push({ path: `public/assets/characters/${id}/manifest.json`, bytes: JSON.stringify(manifest, null, 2) + '\n' });
    if (id === 'jorell' || id === 'tata') for (const [file, name] of [['portrait', 'portrait'], ['cutin', 'super-cutin']]) {
      try {
        const data = await page.evaluate(async source => {
          const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/webp', 0.95).split(',')[1];
        }, (await readFile(`${root}/${id}/${file}.png`)).toString('base64'));
        pending.push({ path: `public/assets/characters/${id}-unified/${name}.webp`, bytes: Buffer.from(data, 'base64') });
      } catch { problems.push(`Missing ${id}/${file}`); }
    }
  }
  await writeFile(`${out}/alpha-audit-${ids.join('-')}.json`, JSON.stringify({ reports, problems }, null, 2));
  console.log(JSON.stringify({ characters: ids, problems, files: pending.length, auditOnly }));
  if (problems.length) process.exitCode = 1;
  else if (!auditOnly) {
    for (const f of pending) { await mkdir(f.path.slice(0, f.path.lastIndexOf('/')), { recursive: true }); await writeFile(f.path, f.bytes); }
    console.log('Validated transparent atlases packed; all poses and original combat timing preserved.');
  }
} finally { await browser.close(); }


