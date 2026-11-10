import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/cesar-v2';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  const source = await response.text();
  const body = source.replace(/\bnew [\w$]+\.Game\([\w$]+\)/, match => `(window.__game = ${match})`);
  assert.notEqual(body, source, 'Phaser bootstrap must be instrumented only in the inspection response');
  await route.fulfill({ response, body });
});
await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000');
await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
await page.keyboard.press('KeyE');
await page.mouse.click(640, 565);
await page.screenshot({ path: `${output}/selection.png` });
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('SelectionScene').phase === 'stage');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.getScene('FightScene')?.roundSystem?.phase === 'FIGHT');
await page.evaluate(() => { window.__game.loop.stop(); });
const report = await page.evaluate(() => {
  const s = window.__game.scene.getScene('FightScene');
  const animations = s.registry2.getAll(), contacts = [], preview = [];
  for (let group = 0; group < Math.ceil(animations.length / 6); group++) {
    const canvas = document.createElement('canvas'); canvas.width = 1120; canvas.height = 960;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#17212e'; ctx.fillRect(0, 0, 1120, 960);
    ctx.imageSmoothingEnabled = false;
    animations.slice(group * 6, group * 6 + 6).forEach((anim, row) => {
      ctx.fillStyle = '#f2d58a'; ctx.font = '14px monospace'; ctx.fillText(anim.name, 8, row * 160 + 32);
      [0, 2, 4, 6, 8, 11].forEach((frame, col) => {
        const src = s.textures.get(anim.frames[frame]).getSourceImage();
        ctx.drawImage(src, 160 + col * 160, row * 160 + 18, 160, 120);
        ctx.fillStyle = '#7f8da0'; ctx.fillText(String(frame + 1), 230 + col * 160, row * 160 + 155);
      });
    });
    contacts.push(canvas.toDataURL());
  }
  const stats = animations.map(anim => {
    const frames = anim.frames.map(key => {
      const canvas = s.textures.get(key).getSourceImage();
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, right = 0, top = canvas.height, bottom = 0, opaque = 0, transparent = 0, edge = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha === 0) transparent++;
        if (alpha > 32) {
          opaque++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edge++;
        }
      }
      return { left, right, top, bottom, opaque, transparent, edge };
    });
    preview.push({ name: anim.name, fps: anim.frameRate, frames: anim.frames.map(key => s.textures.get(key).getSourceImage().toDataURL()) });
    return { name: anim.name, frames };
  });
  return { contacts, stats, preview, character: s.playerChoice.characterId, health: s.player.maxHealth };
});
for (const [i, data] of report.contacts.entries()) await writeFile(`${output}/contact-${i + 1}.png`, Buffer.from(data.split(',')[1], 'base64'));
await writeFile(`${output}/validation.json`, JSON.stringify({ errors, character: report.character, health: report.health, stats: report.stats }, null, 2));
await writeFile(`${output}/preview.html`, `<!doctype html><meta charset="utf-8"><title>César · Animaciones</title>
<style>body{background:#101a27;color:#f8eedc;font:18px system-ui;margin:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px}figure{background:#172536;margin:0;border:1px solid #36506d;padding:12px}img{width:100%;image-rendering:pixelated}figcaption{font-size:14px}button{font:inherit;padding:8px;margin-bottom:20px}</style>
<h1>César · 23 animaciones</h1><button id="toggle">Pausar</button><main></main><script>
const animations=${JSON.stringify(report.preview)}, root=document.querySelector('main');let paused=false,start=performance.now(),pauseAt=0;
const images=animations.map(a=>{const f=document.createElement('figure');const img=new Image();img.src=a.frames[0];f.append(img);const c=document.createElement('figcaption');c.textContent=a.name;f.append(c);root.append(f);return img});
document.querySelector('button').onclick=()=>{paused=!paused;if(paused)pauseAt=performance.now();else start+=performance.now()-pauseAt;document.querySelector('button').textContent=paused?'Reanudar':'Pausar'};
function render(t){if(!paused)animations.forEach((a,i)=>{const frame=Math.floor((t-start)*a.fps/1000)%a.frames.length;if(images[i].dataset.frame!==String(frame)){images[i].src=a.frames[frame];images[i].dataset.frame=String(frame)}});requestAnimationFrame(render)}requestAnimationFrame(render);
</script>`);
await page.evaluate(() => {
  const g = window.__game, s = g.scene.getScene('FightScene');
  s.player.x = 700; s.opponent.x = 1100; s.player.updateFacing(s.opponent.x); s.opponent.updateFacing(s.player.x);
  s.player.sprite.setPosition(700, 580); s.opponent.sprite.setPosition(1100, 580);
  s.sys.pause(); g.step(performance.now(), 0);
});
await page.screenshot({ path: `${output}/fight.png` });
for (const [name, frame] of [['HEAVY_PUNCH', 6], ['HEAVY_KICK', 6], ['CROUCH', 11], ['GET_UP', 6], ['SPECIAL_ATTACK', 6]]) {
  await page.evaluate(({ name, frame }) => {
    const g = window.__game, s = g.scene.getScene('FightScene');
    s.player.sprite.setTexture(s.registry2.get(name).frames[frame]); g.step(performance.now(), 0);
  }, { name, frame });
  await page.screenshot({ path: `${output}/${name.toLowerCase()}.png` });
}
await browser.close();
assert.deepEqual(errors, []);
assert.equal(report.character, 'cesar'); assert.equal(report.health, 125);
assert.equal(report.stats.length, 23);
for (const a of report.stats) {
  assert.equal(a.frames.length, 12, a.name);
  for (const [i, f] of a.frames.entries()) {
    assert.equal(f.edge, 0, `${a.name}[${i}]: cropped silhouette`);
    assert.ok(f.opaque > 1000 && f.transparent > f.opaque, `${a.name}[${i}]: empty or nontransparent frame`);
  }
}
console.log('César: all 276 frames load, remain transparent and uncropped; captured attacks, movement and a playable animation gallery.');
