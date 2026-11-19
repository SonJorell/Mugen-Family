import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const names = process.argv.slice(2);
const browser = await chromium.launch();
try {
 const page = await browser.newPage(); const report = {};
 for (const name of names) {
  const source = (await readFile(`art/super-unified/${name}.png`)).toString('base64');
  report[name] = await page.evaluate(async ({ source, name }) => {
   const im = new Image(); im.src = `data:image/png;base64,${source}`; await im.decode();
   const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
   const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
   const cols = name.startsWith('cesar-boarding') ? 2 : name === 'tilin-canto' ? 1 : 4;
   const rows = name.startsWith('cesar-boarding') || ['tilin-airborne','tilin-landing'].includes(name) ? 4 : name === 'tilin-canto' ? 1 : 3;
   const adaptive = name.startsWith('tilin-') && name !== 'tilin-canto';
   const cut = (nominal, radius, score) => {
    let best=Math.round(nominal), cost=Infinity;
    for(let p=Math.ceil(nominal-radius);p<=Math.floor(nominal+radius);p++){
     const value=score(p)*10000+Math.abs(p-nominal);
     if(value<cost){cost=value;best=p;}
    }
    return best;
   };
   const rowCuts=Array.from({length:rows+1},(_,i)=>i===0?0:i===rows?c.height:adaptive?cut(i*c.height/rows,c.height/rows*.4,y=>{let sum=0;for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>16)sum++;return sum;}):Math.round(i*c.height/rows));
   const columnCuts=Array.from({length:rows},(_,r)=>Array.from({length:cols+1},(_,i)=>i===0?0:i===cols?c.width:adaptive?cut(i*c.width/cols,c.width/cols*.3,x=>{let sum=0;for(let y=rowCuts[r];y<rowCuts[r+1];y++)if(d[(y*c.width+x)*4+3]>16)sum++;return sum;}):Math.round(i*c.width/cols)));
   const cells = Array.from({length:cols*rows},(_,i)=>{
    const r=Math.floor(i/cols), col=i%cols, sx=columnCuts[r][col], sy=rowCuts[r], w=columnCuts[r][col+1]-sx, h=rowCuts[r+1]-sy;
    let left=w,right=0,top=h,bottom=0,count=0,corners=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=d[((sy+y)*c.width+sx+x)*4+3]; if((x<3||x>=w-3)&&(y<3||y>=h-3))corners=Math.max(corners,a);if(a>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}
    let fl=w,fr=0;for(let y=bottom-12;y<=bottom;y++)for(let x=0;x<w;x++)if(d[((sy+y)*c.width+sx+x)*4+3]>64){fl=Math.min(fl,x);fr=Math.max(fr,x);}
    return {i,left,right,top,bottom,height:bottom-top+1,count,corners,footCenter:(fl+fr)/2};
   });
   return {width:c.width,height:c.height,cols,rows,rowCuts,columnCuts,cells};
  }, {source,name});
 }
 await mkdir('artifacts/super-unified',{recursive:true});
 await writeFile('artifacts/super-unified/alpha-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally { await browser.close(); }
