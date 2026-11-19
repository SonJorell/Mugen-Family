import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.env.OUTPUT_DIR??'artifacts/super-unified/production';
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
 const errors=[],report=[];
 page.on('crash',()=>errors.push('Browser page crashed during visual inspection'));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.route(/\/(?:src\/main\.ts|assets\/index-[\w-]+\.js)(?:\?.*)?$/,async route=>{
  const response=await route.fetch(), source=await response.text();
  await route.fulfill({response,body:source.replace(/\bnew [\w$]+\.Game\([\w$]+\)/,m=>`(window.__game = ${m})`)});
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:4173');
 await page.waitForFunction(()=>window.__game?.scene.isActive('MenuScene'));
 console.log('Production menu loaded');
 const fight=async(player,opponent)=>{
  await page.evaluate(({player,opponent})=>{
   const g=window.__game;g.scene.stop('MenuScene');g.scene.stop('FightScene');
   g.scene.start('FightScene',{mode:'training',stageIndex:2,playerChoice:{characterId:player,paletteId:'original'},opponentChoice:{characterId:opponent,paletteId:'original'}});
   if(!g.loop.running)g.loop.start(g.step.bind(g));
  },{player,opponent});
  await page.waitForFunction(()=>window.__game.scene.getScene('FightScene')?.roundSystem?.phase==='FIGHT');
  await page.waitForTimeout(1000);
  await page.evaluate(()=>window.__game.loop.stop());
  console.log(`Fight ready: ${player} vs ${opponent}`);
 };
 for(const id of ['cesar','tilin']){
  await fight(id,id==='cesar'?'tilin':'jorell');
  for(const fromRight of [false,true]){
   await page.evaluate(fromRight=>{
    const s=window.__game.scene.getScene('FightScene');s.superMove.cancel();
    s.player.resetForRound(fromRight?1320:600);s.opponent.resetForRound(fromRight?1205:715);
    s.player.updateFacing(s.opponent.x);s.opponent.updateFacing(s.player.x);
    s.superMove.start(s.player,s.opponent);s.sys.pause();
   },fromRight);
   const times=id==='cesar'?[300,1000,1600,2050,3080,3350,4350,5100,5700,5800]:[350,1550,2640,3000];
   for(const at of times){
    const state=await page.evaluate(at=>{
     const g=window.__game,s=g.scene.getScene('FightScene');
     for(let step=0;step<420&&s.superMove.active&&s.superMove.elapsed+0.001<at;step++)s.superMove.update(Math.min(1000/60,at-s.superMove.elapsed));
     s.hud.update(s.player,s.opponent,99);g.step(performance.now(),0);
     const l=s.children.getByName('super-cinematic');
     return {health:s.opponent.currentHealth,active:s.superMove.active,visible:s.player.sprite.visible&&s.opponent.sprite.visible,
      actors:l?.list.filter(o=>o.type==='Image').map(o=>({name:o.name,key:o.texture.key,frame:o.frame.name,scale:o.scaleX}))??[]};
    },at);
    report.push({id,fromRight,at,...state});
    await page.screenshot({path:`${output}/${id}-${fromRight?'right':'left'}-${at}.png`});
   }
   const last=report.at(-1);assert.equal(last.health,40);assert.equal(last.active,false);assert.equal(last.visible,true);
  }
 }
 await fight('jorell','joako');
 const idle=await page.evaluate(()=>{
  const s=window.__game.scene.getScene('FightScene'),p=s.player;
  p.resetForRound(600);p.playAnimation('IDLE',true);
  const frames=s.anims.get('jorell_anim_IDLE').frames;
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1536;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#183042';ctx.fillRect(0,0,canvas.width,canvas.height);
  const metrics=frames.map((f,i)=>{
   const im=s.textures.get(f.textureKey).getSourceImage(),data=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
   let bottom=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(data[(y*im.width+x)*4+3]>64)bottom=Math.max(bottom,y);
   let left=im.width,right=0;for(let y=bottom-13;y<=bottom;y++)for(let x=0;x<im.width;x++)if(data[(y*im.width+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);}
   const x=i%3*512,y=Math.floor(i/3)*384;ctx.drawImage(im,x,y);ctx.fillStyle='#f5bd75';ctx.fillRect(x+100,y+375,312,1);ctx.font='18px sans-serif';ctx.fillText(`${i+1} · pies ${(left+right)/2}`,x+12,y+26);
   return {key:f.textureKey,bottom,center:(left+right)/2};
  });
  return {metrics,png:canvas.toDataURL().split(',')[1]};
 });
 await writeFile(`${output}/jorell-idle.png`,Buffer.from(idle.png,'base64'));
 const centers=idle.metrics.map(f=>f.center);assert.ok(Math.max(...centers)-Math.min(...centers)<=4);
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/inspection.json`,JSON.stringify({errors,idle:idle.metrics,report},null,2));
 console.log('Both directions: painted supers, 60 damage and cleanup; Jorell feet registered; no browser/resource errors.');
} finally {await browser.close();}
