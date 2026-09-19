import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5251').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:'export {};'}));
  await page.route('**/chunk-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto(base+'/chunk-fixture');
  const result=await page.evaluate(async()=>{
    const {generateMap,projectMap}=await import('/src/map.js'),{createMapTerrainChunks}=await import('/src/map-terrain-chunks.js'),{loadMapArt}=await import('/src/map-art.js');
    const map=generateMap({width:24,height:24,seed:55,elevation:true});map.tileSize={width:36,height:18};map.art={images:{},terrain:{}};
    for(const [name,color] of Object.entries({grass:'#408744',road:'#d19557',water:'#3679b0',sand:'#dbc785'})){const c=document.createElement('canvas');c.width=c.height=4;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,4,4);map.art.images[name]={src:c.toDataURL(),width:64,height:64,anchorX:0,anchorY:0};map.art.terrain[name]=name;}
    const art=loadMapArt(map,{document});await art.ready;const allocated=[],tracked={createElement(tag){const c=document.createElement(tag);allocated.push(c);return c;}},chunks=createMapTerrainChunks(map,tracked,art);
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,600,150);
    const tiles=map.terrain.map((terrain,i)=>({x:i%24,y:Math.floor(i/24),terrain}));
    let passes=0;for(;passes<1000;passes++){ctx.clearRect(-600,-150,1200,900);chunks.draw(ctx,tiles,{scale:2,viewportPixels:1200*900});if(!chunks.stats().pending)break;await new Promise(requestAnimationFrame);}
    const settled=chunks.stats();let calls=0;const draw=ctx.drawImage;ctx.drawImage=function(...args){calls++;return draw.apply(this,args);};chunks.draw(ctx,tiles,{scale:2,viewportPixels:1200*900});ctx.drawImage=draw;
    const unchanged=chunks.stats();let holes=0,minAlpha=255;
    for(const seam of [8,16])for(let i=2;i<22;i++)for(const offset of [-.01,0,.01])for(const axis of [0,1]){const p=projectMap(map,axis?{x:i+.5,y:seam+offset}:{x:seam+offset,y:i+.5});const alpha=ctx.getImageData(Math.round(600+p.x),Math.round(150+p.y),1,1).data[3];minAlpha=Math.min(minAlpha,alpha);if(alpha<250)holes++;}
    chunks.draw(ctx,tiles,{scale:1,viewportPixels:1});const shrunk=chunks.stats();chunks.dispose();art.dispose();
    const unthemed=structuredClone(map);delete unthemed.art;let fallbacks=0;const plain=createMapTerrainChunks(unthemed,document,{image:()=>null},(c,t)=>{fallbacks++;c.fillRect(t.x,t.y,1,1);});
    for(let i=0;i<200;i++){plain.draw(ctx,tiles,{scale:1,viewportPixels:1200*900});if(!plain.stats().pending)break;await new Promise(requestAnimationFrame);}const fallbackStats=plain.stats();plain.dispose();
    return{passes,settled,unchanged,calls,holes,minAlpha,shrunk,released:allocated.every(c=>c.width===1&&c.height===1),fallbacks,fallbackStats};
  });
  assert.equal(result.settled.pending,false);assert.equal(result.unchanged.builds,result.settled.builds);assert.equal(result.unchanged.tileBuilds,result.settled.tileBuilds);assert.equal(result.calls,9,'One composite per 8x8 chunk');assert.equal(result.holes,0);assert.ok(result.shrunk.pixels<=result.shrunk.maxPixels);assert.equal(result.released,true);assert.equal(result.fallbacks,24*24);assert.equal(result.fallbackStats.pending,false);
  console.log(JSON.stringify(result));console.log('Chunk terrain passed: retained world chunks, opaque chunk joins, bounded shrink, disposal and unthemed fallback.');
}finally{await browser.close();}
