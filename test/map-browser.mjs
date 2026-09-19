import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {assertMap} from '../src/map.js';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5240').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await fs.mkdir('test-results',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.mapWorkers=0;const WorkerOriginal=window.Worker;window.Worker=class extends WorkerOriginal{constructor(...args){super(...args);this.alive=true;window.mapWorkers++;}terminate(){if(this.alive){this.alive=false;window.mapWorkers--;}super.terminate();}};});
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo?.view.stats().visibleTiles>0);
  await page.evaluate(()=>mapDemo.view.ready);
  await page.waitForFunction(()=>mapDemo.view.stats().art.loaded===10&&!mapDemo.view.stats().terrainCache?.pending);
  const initial=await page.evaluate(()=>mapDemo.view.stats());
  assert.equal(initial.totalTiles,16384);assert.ok(initial.visibleTiles<initial.totalTiles/4);assert.ok(initial.visibleProps<initial.totalProps/2);assert.equal(await page.locator('#edit-demo').isHidden(),true);
  assert.equal(await page.evaluate(()=>mapWorkers),1);
  // This destination is across the inn's blocked footprint from the starting cell.
  const destination=await page.evaluate(()=>{window.blockedSamples=[];window.walkSamples=0;window.routeSample=setInterval(()=>{const actor=mapDemo.view.controller.frame().actors[0];if(actor.walking){walkSamples++;if(mapDemo.view.controller.index.isBlocked(actor.x,actor.y))blockedSamples.push({x:actor.x,y:actor.y});}},16);return mapDemo.view.mapToScreen({x:69.5,y:60.5});});
  await page.locator('#demo-art canvas').click({position:destination});
  await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.arrived'&&e.x===69.5&&e.y===60.5),{},{timeout:20000});
  const collisionSamples=await page.evaluate(()=>{clearInterval(routeSample);return{blocked:blockedSamples,samples:walkSamples};});
  assert.deepEqual(collisionSamples.blocked,[]);assert.ok(collisionSamples.samples>5);
  await page.locator('#map-chest').click();
  await page.waitForFunction(()=>mapDemo.view.controller.frame().objects['village-chest']?.opened,{},{timeout:20000});
  assert.equal(await page.evaluate(()=>mapDemo.events.some(e=>e.type==='map.object.interacted'&&e.object==='village-chest')),true);
  await page.locator('#map-save').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.littlelands.map.v1')));
  await page.locator('#map-inn').click();await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.arrived'&&e.target==='village-house'),{},{timeout:20000});
  await page.locator('#map-seed').click();assert.equal(await page.evaluate(()=>mapDemo.map.seed),2027);
  await page.locator('#map-restore').click();await page.waitForFunction(()=>document.querySelector('#demo-status').textContent==='Map restored.');
  assert.equal(await page.evaluate(()=>mapDemo.map.seed),2026);
  const restored=await page.evaluate(()=>mapDemo.view.snapshot());assert.deepEqual(restored.scene.actors,saved.state.scene.actors);assert.deepEqual(restored.scene.objects,saved.state.scene.objects);
  const canvas=page.locator('#demo-art canvas'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,box.y+box.height/2+70,{steps:5});await page.mouse.up();
  await page.waitForFunction(x=>mapDemo.view.stats().camera.x!==x,saved.state.camera.x);
  const beforeZoom=await page.evaluate(()=>mapDemo.view.stats().camera.zoom);await page.mouse.wheel(0,-300);await page.waitForFunction(z=>mapDemo.view.stats().camera.zoom>z,beforeZoom);
  await page.locator('#map-home').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-demo').click();const download=await downloadPromise;
  const downloaded=assertMap(JSON.parse(await fs.readFile(await download.path(),'utf8')));assert.equal(downloaded.width,128);assert.equal(downloaded.seed,2026);
  await page.screenshot({path:'test-results/map-gallery.png'});
  // Render one measured viewport: the backing canvas does not grow with the map.
  for(const size of [{width:390,height:844},{width:1024,height:700}]){
    await page.setViewportSize(size);await page.waitForTimeout(200);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
    const bounds=await canvas.boundingBox();assert.ok(bounds.width>200&&bounds.height>=100);
    const stats=await page.evaluate(()=>mapDemo.view.stats());assert.ok(stats.backingWidth<=bounds.width*2+2);assert.ok(stats.visibleTiles<2000);
    const footer=await page.locator('.demo-footer').boundingBox();assert.ok(footer.y+footer.height<=size.height+1);
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/map-mobile.png'});
  await page.evaluate(()=>{window.previousMap=mapDemo.view;window.oldCanvas=document.querySelector('#demo-art canvas');});
  await page.locator('[data-demo="light-and-shade"]').click();await page.locator('#demo-art svg').waitFor();
  assert.equal(await page.evaluate(()=>!!window.mapDemo),false);assert.equal(await page.evaluate(()=>oldCanvas.isConnected),false);assert.equal(await page.evaluate(()=>mapWorkers),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,initial,interactions:true,saveRestore:true,camera:true,mobile:true,disposal:true}));
} finally {await browser.close();}
