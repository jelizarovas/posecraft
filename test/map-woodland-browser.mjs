import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[],images=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));page.on('request',r=>{if(r.url().includes('/assets/map/')&&r.url().endsWith('.webp'))images.push(r.url());});
 await page.goto(base+'/demos.html#littlelands-map');await page.waitForFunction(()=>window.mapDemo?.view);await page.evaluate(()=>mapDemo.view.ready);
 await page.waitForFunction(()=>mapDemo.view.stats().art.loaded===15&&!mapDemo.view.stats().terrainCache?.pending);
 const before=await page.evaluate(()=>mapDemo.view.stats());assert.deepEqual(before.art,{requested:13,loaded:13,failed:0});assert.ok(before.visibleProps<before.totalProps/3);assert.ok(before.visibleTiles<before.totalTiles/4);
 assert.equal(new Set(images.filter(u=>!u.endsWith('/thumbnail.webp'))).size,13);
 await page.locator('#demo-art canvas').screenshot({path:'test-results/map-woodland-canvas.png'});await page.screenshot({path:'test-results/map-woodland-desktop.png'});
 await page.locator('#map-inn').click();await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.arrived'&&e.target==='village-house'),{},{timeout:20000});
 const front=await page.evaluate(()=>mapDemo.view.stats());assert.equal(front.maskedActors,0,'Inn entrance remains in front of the sprite');
 await page.screenshot({path:'test-results/map-woodland-inn.png'});
 await page.evaluate(()=>{const m=mapDemo.map,i=m.terrain.findIndex((t,i)=>t===2&&i%m.width>8&&i%m.width<m.width-8&&Math.floor(i/m.width)>8);mapDemo.view.panTo(i%m.width,Math.floor(i/m.width));});
 await page.waitForTimeout(100);await page.waitForFunction(()=>!mapDemo.view.stats().terrainCache.pending);await page.screenshot({path:'test-results/map-woodland-lake.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#map-home').click();await page.waitForTimeout(100);await page.screenshot({path:'test-results/map-woodland-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,art:before.art,visibleTiles:before.visibleTiles,visibleProps:before.visibleProps,mobile:true,inn:true}));
}finally{await browser.close();}
