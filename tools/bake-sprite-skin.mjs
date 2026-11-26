// node tools/bake-sprite-skin.mjs input.puppet.json output-prefix
// Bake the authored 60 Hz clip. A changed drawing or edited joint angle can
// still use the player's ordinary weighted renderer.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Expected a puppet file and an output prefix');
const source=JSON.parse(await readFile(input,'utf8'));
const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),
  publicDir:false,logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0,open:false}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const page=await browser.newPage();
  await page.route('**/bake.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Sprite bake</title>'}));
  await page.goto(new URL('bake.html',server.resolvedUrls.local[0]).href);
  const {frames,webp}=await page.evaluate(async doc=>{
    const {compileSpritePuppet,sampleSpritePuppet}=await import('/src/sprite-puppet.js');
    const {skinnedTile}=await import('/src/sprite-skin.js');
    const rig=compileSpritePuppet(doc),atlas=new Image(),frames={},tiles=[];
    atlas.src=doc.atlas.src;await atlas.decode();
    for(let i=0;i<=Math.ceil(doc.clip.duration*60);i++){
      for(const p of sampleSpritePuppet(rig,i/60)){
        if(!p.deformation)continue;
        const key=[p.id,p.tile,p.deformation.view,...p.deformation.angles].join('/');
        if(Object.hasOwn(frames,key))continue;
        const {canvas,left,top}=skinnedTile(atlas,doc,p);
        // Own the copy because the runtime may evict and close its bitmap.
        const image=await createImageBitmap(canvas);
        frames[key]=[0,0,image.width,image.height,left,top];tiles.push({key,image});
      }
    }
    const width=2048,gutter=2;
    tiles.sort((a,b)=>b.image.height-a.image.height);
    let x=gutter,y=gutter,rowHeight=0;
    for(const {key,image} of tiles){
      if(x+image.width+gutter>width){x=gutter;y+=rowHeight+2*gutter;rowHeight=0;}
      frames[key][0]=x;frames[key][1]=y;x+=image.width+2*gutter;rowHeight=Math.max(rowHeight,image.height);
    }
    const sheet=document.createElement('canvas');sheet.width=width;sheet.height=y+rowHeight+gutter;
    const ctx=sheet.getContext('2d');
    for(const {key,image} of tiles){ctx.drawImage(image,frames[key][0],frames[key][1]);image.close();}
    return {frames,webp:sheet.toDataURL('image/webp',.94).split(',')[1]};
  },source);
  const sourceHash=createHash('sha256').update(JSON.stringify(source)).digest('hex');
  await writeFile(output+'.webp',Buffer.from(webp,'base64'));
  await writeFile(output+'.json',JSON.stringify({sourceHash,frames})+'\n');
  console.log(Object.keys(frames).length+' packed skin poses');
}finally{await browser?.close();await server.close();}
