import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:900,height:650}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
 await page.route('**/map-terrain-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:900px;height:650px}</style><div id="map"></div>'}));
 await page.goto(base+'/map-terrain-fixture');
 const pngs=await page.evaluate(()=>Object.fromEntries(Object.entries({grass:'#14a01e',road:'#d2461e',water:'#143cd2',sand:'#e6c846'}).map(([id,color])=>{const c=document.createElement('canvas');c.width=c.height=4;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,4,4);return[id,c.toDataURL().split(',')[1]];})));
 for(const[id,png]of Object.entries(pngs))await page.route(`**/terrain-${id}.png`,route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
 await page.evaluate(async()=>{
  window.core=await import('/src/map.js');window.createPainter=(await import('/src/map-terrain.js')).createMapTerrainPainter;
  window.loadArt=(await import('/src/map-art.js')).loadMapArt;window.mountMap=(await import('/src/map-browser.js')).mountMap;
  window.fixture={format:'posecraft-map',version:1,id:'terrain',name:'Terrain',width:8,height:8,seed:1,tileSize:{width:72,height:36},terrain:Array.from({length:64},(_,i)=>i%8===3||i%8===4?1:0),props:[],actors:[{id:'hero',x:.5,y:.5,speed:3}],art:{images:Object.fromEntries(['grass','road','water','sand'].map(id=>[id,{src:`terrain-${id}.png`,width:64,height:64,anchorX:0,anchorY:0}])),terrain:{grass:'grass',road:'road',water:'water',sand:'sand'}}};
  window.art=loadArt(fixture,{document});await art.ready;
  window.renderPainter=async(map,scale=1,viewportPixels=0)=>{
   const painter=createPainter(map,document,art),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d');
   for(let pass=0;pass<200;pass++){
    painter.beginFrame(scale,viewportPixels);ctx.setTransform(1,0,0,1,512,100);ctx.clearRect(-512,-100,1024,768);
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)painter.draw(ctx,{x,y,terrain:map.terrain[y*map.width+x]});
    if(!painter.stats().pending)return{painter,canvas,ctx};await new Promise(requestAnimationFrame);
   }
   throw Error('Terrain cache never settled');
  };
  window.flat=await renderPainter(fixture);
 });
 const blend=await page.evaluate(()=>{
  const sample=(x,y)=>{const p=core.projectMap(fixture,{x,y});return Array.from(flat.ctx.getImageData(Math.round(512+p.x),Math.round(100+p.y),1,1).data);};
  return{grass:sample(1.5,3.5),road:sample(3.5,3.5),edge:sample(3,3.5),left:sample(2.9,3.5),right:sample(3.1,3.5)};
 });
 assert.ok(blend.grass[1]>145&&blend.grass[0]<35,JSON.stringify(blend));
 assert.ok(blend.road[0]>195&&blend.road[1]<85,JSON.stringify(blend));
 assert.ok(blend.edge[0]>45&&blend.edge[0]<185&&blend.edge[1]>80&&blend.edge[1]<150,'Boundary must mix neighboring materials');
 assert.ok(blend.left[0]<blend.right[0],'Road contribution must increase continuously across its edge');
 const elevated=await page.evaluate(async()=>{
  window.hills=structuredClone(fixture);hills.elevations=Array.from({length:81},(_,i)=>{const x=i%9,y=Math.floor(i/9);return .12*x+.08*y+.05*Math.sin(x+y);});
  core.assertMap(hills);window.raised=await renderPainter(hills);
  let holes=0,samples=0,maxInverseError=0,minAlpha=255;const histogram={};
  for(let y=1;y<7;y++)for(let x=1;x<7;x++)for(const fx of [.01,.25,.5,.75,.99])for(const fy of [.01,.25,.5,.75,.99]){
   const p={x:x+fx,y:y+fy},pixel=core.projectMap(hills,p),back=core.unprojectMap(hills,pixel),rgba=raised.ctx.getImageData(Math.round(512+pixel.x),Math.round(100+pixel.y),1,1).data;
   samples++;if(rgba[3]<250)holes++;minAlpha=Math.min(minAlpha,rgba[3]);histogram[rgba[3]]=(histogram[rgba[3]]||0)+1;maxInverseError=Math.max(maxInverseError,Math.abs(p.x-back.x),Math.abs(p.y-back.y));
  }
  window.view=mountMap(document.querySelector('#map'),hills,{execution:'main'});await view.ready;view.panTo(4,4);window.moves=[];view.controller.subscribe(e=>{if(e.type==='map.move.started')moves.push(e);});
  return{holes,samples,maxInverseError,minAlpha,histogram};
 });
 assert.ok(elevated.maxInverseError<1e-8);
 await page.waitForFunction(()=>view.stats().terrainCache&&!view.stats().terrainCache.pending);
 const click=await page.evaluate(()=>view.mapToScreen({x:3.45,y:5.25}));await page.locator('#map canvas').click({position:click});
 assert.deepEqual(await page.evaluate(()=>moves.at(-1).target),{x:3.5,y:5.5},'Picking must target elevated ground coordinates');
 await page.evaluate(()=>view.controller.cancel('hero'));
 await page.screenshot({path:'test-results/map-terrain-elevation.png'});
 const cache=await page.evaluate(async()=>{
  const large=structuredClone(hills);large.tileSize={width:512,height:256};
  // Distinct local slopes create distinct projected tiles; repeat phase remains stable.
  const surfaces=[],trackedDocument={createElement(tag){const node=document.createElement(tag);surfaces.push(node);return node;}},painter=createPainter(large,trackedDocument,art),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  for(let pass=0;pass<4;pass++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){painter.beginFrame(2,4*1024*1024);painter.draw(ctx,{x,y,terrain:large.terrain[y*8+x]});}
  const populated=painter.stats();painter.beginFrame(1,0);const shrunk=painter.stats();painter.dispose();const disposed=painter.stats();
  flat.painter.dispose();raised.painter.dispose();view.dispose();art.dispose();return{populated,shrunk,disposed,releasedSurfaces:surfaces.every(c=>c.width===1&&c.height===1),mountedCanvases:document.querySelectorAll('#map canvas').length};
 });
 assert.ok(cache.populated.builds>20,'Stress fixture must exercise cache eviction');
 assert.ok(cache.populated.pixels<=8*1024*1024,JSON.stringify(cache));
 assert.ok(cache.populated.materials<=256);
 assert.equal(cache.disposed.pixels,0);assert.equal(cache.disposed.tiles,0);assert.equal(cache.disposed.materials,0);assert.equal(cache.releasedSurfaces,true);assert.equal(cache.mountedCanvases,0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({blend,elevated,cache},null,2));
 assert.equal(elevated.holes,0,JSON.stringify(elevated));
 assert.ok(cache.shrunk.pixels<=cache.shrunk.maxPixels,'Reducing the viewport budget must evict old projected tiles');
 console.log('Terrain painter passed: blended edges, opaque elevated seams, ground picking, bounded caches and disposal.');
}finally{await browser.close();}
