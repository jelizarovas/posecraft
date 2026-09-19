import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5197').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:600}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/map-art-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}.map{width:480px;height:500px;display:inline-block}</style><div id="a" class="map"></div><div id="b" class="map"></div>'}));await page.goto(base+'/map-art-fixture');
 const pngs=await page.evaluate(()=>{const sprite=document.createElement('canvas');sprite.width=64;sprite.height=96;const s=sprite.getContext('2d');s.fillStyle='#245892';s.fillRect(0,0,64,96);s.clearRect(0,48,64,16);const grass=document.createElement('canvas');grass.width=grass.height=4;const g=grass.getContext('2d');g.fillStyle='#508832';g.fillRect(0,0,4,4);g.fillStyle='#619943';g.fillRect(0,0,2,2);return{sprite:sprite.toDataURL(),grass:grass.toDataURL()};});
 await page.route('**/fixture-sprite.png',route=>{requests.push('sprite');return route.fulfill({contentType:'image/png',body:Buffer.from(pngs.sprite.split(',')[1],'base64')});});
 await page.route('**/fixture-grass.png',route=>{requests.push('grass');return route.fulfill({contentType:'image/png',body:Buffer.from(pngs.grass.split(',')[1],'base64')});});
 await page.route('**/fixture-missing.png',route=>{requests.push('missing');return route.fulfill({status:404,body:'missing'});});
 await page.evaluate(async()=>{
   window.mountMap=(await import('/src/map-browser.js')).mountMap;window.drawMapActor=(await import('/src/map-character.js')).drawMapActor;
   window.fixture={format:'posecraft-map',version:1,id:'art',name:'Art',width:64,height:64,seed:1,tileSize:{width:72,height:36},terrain:Array(4096).fill(0),props:[{id:'tree',kind:'tree',x:5,y:5,width:1,height:1}],actors:[{id:'hero',x:5.5,y:4.5,speed:3,color:'#e65bb1'}],art:{images:{tree:{src:'fixture-sprite.png',width:128,height:128,anchorX:.5,anchorY:1},treeAlias:{src:'fixture-sprite.png',width:128,height:128,anchorX:.5,anchorY:1},grass:{src:'fixture-grass.png',width:64,height:64,anchorX:0,anchorY:0},unused:{src:'fixture-missing.png',width:64,height:64,anchorX:0,anchorY:0}},props:{tree:['tree','treeAlias']},terrain:{grass:'grass'}}};
   window.a=mountMap(document.querySelector('#a'),fixture,{execution:'main'});window.b=mountMap(document.querySelector('#b'),fixture,{execution:'main'});await Promise.all([a.ready,b.ready]);a.panTo(5,4.5);b.panTo(5,4.5);
 });
 await page.waitForFunction(()=>a.stats().art.loaded===3&&b.stats().art.loaded===3&&!a.stats().terrainCache.pending&&!b.stats().terrainCache.pending);assert.deepEqual(requests.sort(),['grass','sprite'],'Images shared between aliases and mounts; unreferenced image must not load');
 const stats=await page.evaluate(()=>a.stats());assert.ok(stats.visibleTiles<1000);assert.equal(stats.backingWidth,480);assert.equal(stats.maskedActors,1);
 const terrain=await page.evaluate(async()=>{const sample=()=>{const point=a.mapToScreen({x:8.5,y:8.5});return Array.from(document.querySelector('#a canvas').getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data);};const before=sample();a.panTo(6,4.5);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));while(a.stats().terrainCache?.pending)await new Promise(requestAnimationFrame);const after=sample();a.panTo(5,4.5);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));while(a.stats().terrainCache?.pending)await new Promise(requestAnimationFrame);return{before,after};});
 assert.ok(terrain.before[2]<80&&terrain.before[1]>120,'Terrain must use the supplied texture rather than fallback color');assert.deepEqual(terrain.after,terrain.before,'Texture coordinates must remain attached to world ground while camera pans');
 const alpha=await page.evaluate(()=>{const actual=document.querySelector('#a canvas'),reference=document.createElement('canvas');reference.width=actual.width;reference.height=actual.height;const ctx=reference.getContext('2d'),origin=a.mapToScreen({x:0,y:0});ctx.translate(origin.x,origin.y);drawMapActor(ctx,fixture,a.controller.actorPosition('hero'),fixture.actors[0],false,{shadow:false});const original=ctx.getImageData(0,0,reference.width,reference.height).data,rendered=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;let unchanged=0,changed=0;for(let i=0;i<original.length;i+=4)if(original[i+3]===255){const difference=Math.abs(original[i]-rendered[i])+Math.abs(original[i+1]-rendered[i+1])+Math.abs(original[i+2]-rendered[i+2]);if(difference<8)unchanged++;else changed++;}return{unchanged,changed};});
 assert.ok(alpha.unchanged>40&&alpha.changed>40,`Transparent sprite hole must preserve normal actor colors while solid pixels mask them: ${JSON.stringify(alpha)}`);
 await page.screenshot({path:'test-results/map-art-alpha.png'});
 await page.waitForTimeout(100);const frames=await page.evaluate(()=>a.stats().drawnFrames);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>a.stats().drawnFrames),frames,'Loaded static art must stop rendering');
 const clickPoints=await page.evaluate(()=>{window.clickEvents=[];a.controller.subscribe(e=>{if(e.type==='map.move.started')clickEvents.push(e);});return{hole:a.mapToScreen({x:138/36,y:138/36}),solid:a.mapToScreen({x:90/36,y:90/36})};});
 await page.locator('#a canvas').click({position:clickPoints.hole});
 assert.equal(await page.evaluate(()=>typeof clickEvents.at(-1).target),'object','Transparent sprite pixels must let ground clicks through');
 await page.evaluate(()=>a.controller.cancel('hero'));
 await page.locator('#a canvas').click({position:clickPoints.solid});
 assert.equal(await page.evaluate(()=>clickEvents.at(-1).target),'tree','Opaque sprite pixels select the prop');
 await page.evaluate(()=>a.controller.cancel('hero'));
 await page.evaluate(()=>a.dispose());assert.equal(await page.evaluate(()=>b.stats().art.loaded),3,'Disposing one mount must not unload another mount images');await page.evaluate(()=>b.dispose());
 await page.evaluate(async()=>{window.failures=[];const failed=structuredClone(fixture);failed.art.images.tree.src='fixture-missing.png';failed.art.props.tree=['tree'];window.failed=mountMap(document.querySelector('#a'),failed,{execution:'main',onError:e=>failures.push(e.message)});await window.failed.ready;});
 await page.waitForFunction(()=>failed.stats().art?.failed===1);assert.equal(await page.evaluate(()=>failures.length),1);await page.evaluate(()=>failed.dispose());
 let release;const held=new Promise(resolve=>release=resolve);await page.route('**/fixture-held.png',async route=>{await held;await route.fulfill({contentType:'image/png',body:Buffer.from(pngs.sprite.split(',')[1],'base64')});});
 await page.evaluate(()=>{const delayed=structuredClone(fixture);delayed.art.images.tree.src='fixture-held.png';delayed.art.props.tree=['tree'];window.afterDispose=[];window.delayed=mountMap(document.querySelector('#a'),delayed,{execution:'main',onError:e=>afterDispose.push(e.message)});window.readyResult=window.delayed.ready.then(()=>null,e=>e.name);window.delayed.dispose();});release();assert.equal(await page.evaluate(()=>readyResult),'AbortError');await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>afterDispose),[]);
 const before=requests.length;await page.evaluate(async()=>{const plain=structuredClone(fixture);delete plain.art;window.plain=mountMap(document.querySelector('#a'),plain,{execution:'main'});await window.plain.ready;window.plain.dispose();});assert.equal(requests.length,before,'Unthemed maps must not load map art');assert.deepEqual(errors,[]);
 const shore=await page.evaluate(async()=>{
   const {drawMapTerrainTexture}=await import('/src/map-art.js'),canvas=document.createElement('canvas');canvas.width=512;canvas.height=300;const ctx=canvas.getContext('2d'),patterns={};
   for(const[id,color]of Object.entries({grass:'#308020',sand:'#d8be70',water:'#2050b0'})){const image=document.createElement('canvas');image.width=image.height=1;const brush=image.getContext('2d');brush.fillStyle=color;brush.fillRect(0,0,1,1);patterns[id]=ctx.createPattern(image,'repeat');}
   const map={width:6,height:6,tileSize:{width:64,height:32},terrain:Array(36).fill(0),art:{images:{},terrain:{grass:'grass',sand:'sand',water:'water'}}};
   for(let y=1;y<5;y++)for(let x=1;x<5;x++)map.terrain[y*6+x]=3;for(let y=2;y<4;y++)for(let x=2;x<4;x++)map.terrain[y*6+x]=2;const logical=JSON.stringify(map.terrain);
   ctx.fillStyle='#308020';ctx.fillRect(0,0,512,300);ctx.translate(256,30);for(let y=0;y<6;y++)for(let x=0;x<6;x++)drawMapTerrainTexture(ctx,map,{x,y,terrain:map.terrain[y*6+x]},{pattern:(_,id)=>patterns[id]});
   const pixel=(x,y)=>Array.from(ctx.getImageData(Math.floor(256+(x-y)*32),Math.floor(30+(x+y)*16),1,1).data);
   return{waterCenter:pixel(2.5,2.5),waterCorner:pixel(2.03,2.03),sandCenter:pixel(1.5,1.5),sandCorner:pixel(1.03,1.03),unchanged:logical===JSON.stringify(map.terrain)};
 });
 assert.deepEqual(shore.waterCenter,[32,80,176,255]);assert.deepEqual(shore.waterCorner,[216,190,112,255],'Water outer corner must reveal rounded sand shoreline');assert.deepEqual(shore.sandCenter,[216,190,112,255]);assert.ok(shore.sandCorner.every((value,i)=>Math.abs(value-[48,128,32,255][i])<=2),'Sand outer corner must round into grass');assert.equal(shore.unchanged,true,'Visual shore rounding must not change navigation terrain');
 console.log('Map art passed: shared loading, referenced-only requests, sprite alpha occlusion, visible-tile rendering, idle suspension, failure fallback, disposal and unthemed isolation.');
}finally{await browser.close();}
