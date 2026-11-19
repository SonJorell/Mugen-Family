import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'artifacts/roster-unified/visual';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(60000);
const errors = [];
try {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(config)', '(window.__game = new Phaser.Game(config))') });
  });
  await page.goto('http://127.0.0.1:3018');
  await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.isActive('SelectionScene'));
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
  await page.waitForTimeout(100);
  await page.screenshot({path: out + '/selection.png'});
  const report = await page.evaluate(async () => {
    const g=window.__game, s=g.scene.getScene('SelectionScene');
    g.loop.stop(); s.sys.pause();
    const {Fighter}=await import('/src/characters/Fighter.ts');
    const {FIGHTER_ROSTER}=await import('/src/config/roster.ts');
    const {getManifest,createCharacterLoader}=await import('/src/config/characters.ts');
    const panel=s.add.container(0,0).setDepth(200).setScrollFactor(0);
    panel.add(s.add.rectangle(640,360,1280,720,0x101a2b));
    panel.add(s.add.text(640,65,'ARICA FIGHTERS · ESTILO UNIFICADO',{fontFamily:'Impact',fontSize:'35px',color:'#fff2ce'}).setOrigin(.5));
    panel.add(s.add.text(640,111,'Estatura real · proporciones propias · mismo suelo',{fontFamily:'Arial',fontSize:'20px',color:'#b2c5db'}).setOrigin(.5));
    const ids=['tata','tilin','joako','jorell','cesar'], rows=[];
    window.qaActors=[];
    for (const [i,id] of ids.entries()) {
      const r=FIGHTER_ROSTER.find(r=>r.id===id),m=getManifest(s,id);
      const {registry,loader}=createCharacterLoader(s,m);
      const f=new Fighter({scene:s,registry,loader,characterId:id,x:150+i*245,y:565,stats:r.stats});
      f.sprite.setVisible(false);
      const im=s.add.image(f.x,565,id+'_IDLE_0').setOrigin(.5,.975).setScale(f.sprite.scaleX);
      panel.add(im);
      panel.add(s.add.text(f.x,620,r.name+' · '+r.heightCm+' cm',{fontFamily:'Arial',fontSize:'22px',color:'#e5edf7'}).setOrigin(.5));
      window.qaActors.push(im);
      const animations=[];
      for (const name of Object.keys(m.animations)) {
        const a=registry.get(name);
        const frames=a.frames.map(key=>{
          const c=s.textures.get(key).getSourceImage(),ctx=c.getContext('2d'),p=ctx.getImageData(0,0,c.width,c.height).data;
          let count=0,top=c.height,bottom=0,left=c.width,right=0,edges=0,corners=0;
          for (let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
            const alpha=p[(y*c.width+x)*4+3];
            if (x<4 && y<4) corners=Math.max(corners,alpha);
            if(alpha>64){count++;top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
              if(x===0||y===0||x===c.width-1||y===c.height-1) edges++;
            }
          }
          return {key,count,top,bottom,left,right,edges,corners};
        });
        animations.push({name,frames});
      }
      rows.push({id,cm:r.heightCm,scale:f.sprite.scaleX,animations});
    }
    g.step(performance.now(),0);
    return rows;
  });
  await page.screenshot({path:out+'/body-comparison.png'});
  for(const id of ['tilin','cesar','joako','jorell','tata']) {
    const data=await page.evaluate(id=>{
      const s=window.__game.scene.getScene('SelectionScene'), c=document.createElement('canvas');
      const manifest=s.cache.json.get(id+'_manifest'), names=Object.keys(manifest.animations);
      c.width=1792;c.height=Math.ceil(names.length/7)*220;
      const ctx=c.getContext('2d');ctx.fillStyle='#18243a';ctx.fillRect(0,0,c.width,c.height);
      names.forEach((name,i)=>{
        const frames=s.anims.get(id+'_anim_'+name).frames;
        const image=s.textures.get(frames[Math.floor(frames.length*.5)].textureKey).getSourceImage();
        const x=(i%7)*256, y=Math.floor(i/7)*220;
        ctx.drawImage(image,x+10,y-1,image.width*.45,image.height*.45);
        ctx.fillStyle='#f3e6cc';ctx.font='12px Arial';ctx.fillText(name,x+5,y+207);
      });
      return c.toDataURL('image/png').split(',')[1];
    },id);
    await writeFile(out+'/'+id+'-poses.png',Buffer.from(data,'base64'));
  }
  const correctedWalk = await page.evaluate(() => {
    const s = window.__game.scene.getScene('SelectionScene');
    const c = document.createElement('canvas'); c.width = 1024; c.height = 450;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#18243a'; ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 2; i++) {
      const image = s.textures.get(`tilin_WALK_FORWARD_${i}`).getSourceImage();
      ctx.drawImage(image, i * 512, 15);
      ctx.fillStyle = '#f3e6cc'; ctx.font = '20px Arial';
      ctx.fillText(`Tilin · caminar · fotograma ${i + 1}`, i * 512 + 80, 430);
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  await writeFile(out+'/tilin-jeans-verified.png', Buffer.from(correctedWalk,'base64'));
  await writeFile(out+'/runtime-audit.json',JSON.stringify({errors,report},null,2));
  const frames=report.flatMap(r=>r.animations.flatMap(a=>a.frames));
  assert.deepEqual(errors,[]);
  assert.ok(frames.every(f=>f.count>100 && f.corners<=2),'Nonempty poses with transparent corners');
  console.log(JSON.stringify({characters:report.length,animations:report.reduce((n,r)=>n+r.animations.length,0),poses:frames.length,clipped:frames.filter(f=>f.edges>0).map(f=>f.key),errors}));
} finally { await browser.close(); }


