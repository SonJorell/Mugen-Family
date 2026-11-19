import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// Encoding only. Generated alpha is retained, never chroma-keyed or repainted.
const names = process.argv.slice(2);
const browser = await chromium.launch();
try {
 const page = await browser.newPage(); await mkdir('public/assets/effects/super-unified',{recursive:true});
 for (const name of names) {
  const input = (await readFile(`art/super-unified/${name}.png`)).toString('base64');
  const output = await page.evaluate(async input => {
   const im = new Image(); im.src=`data:image/png;base64,${input}`; await im.decode();
   const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;
   c.getContext('2d').drawImage(im,0,0);
   return c.toDataURL('image/webp',0.96).split(',')[1];
  },input);
  await writeFile(`public/assets/effects/super-unified/${name}.webp`,Buffer.from(output,'base64'));
  console.log(name);
 }
} finally { await browser.close(); }
