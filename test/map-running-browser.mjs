import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo?.view.stats().art.loaded===10&&!mapDemo.view.stats().terrainCache.pending);
  await page.locator('#demo-fullscreen').click();
  await page.waitForFunction(()=>!mapDemo.view.stats().terrainCache.pending);
  const point=await page.evaluate(()=>{
    const a=mapDemo.view.controller.actorPosition('hero'),p=mapDemo.view.mapToScreen({x:a.x-7,y:a.y}),r=document.querySelector('#demo-art canvas').getBoundingClientRect();
    window.initialMapState=mapDemo.view.snapshot();return{x:p.x+r.x,y:p.y+r.y};
  });
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.move.started'&&e.gait==='walk'));
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(()=>mapDemo.view.controller.actorPosition('hero').running);
  const before=await page.evaluate(()=>mapDemo.view.stats());
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>mapDemo.view.stats());
  assert.ok(after.drawnFrames>before.drawnFrames,'Actor continues animating');
  assert.equal(after.terrainBuilds,before.terrainBuilds,'Walking reuses the terrain layer');
  assert.equal(after.sceneryBuilds,before.sceneryBuilds,'Walking reuses the prop layer');
  assert.ok(after.terrainCache.pixels<=after.terrainCache.maxPixels);
  await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.arrived'&&e.gait==='run'),{},{timeout:15000});
  assert.equal(await page.evaluate(()=>mapDemo.view.controller.actorPosition('hero').running),false);
  // Drag/pinch gestures must not be interpreted as a second tap.
  await page.evaluate(async()=>{await mapDemo.view.restore(initialMapState);});
  const canvas=page.locator('#demo-art canvas'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+80,box.y+100);await page.mouse.down();await page.mouse.move(box.x+130,box.y+110,{steps:4});await page.mouse.up();
  await page.waitForFunction(()=>!mapDemo.view.stats().terrainCache.pending);
  assert.equal(await page.evaluate(()=>mapDemo.view.controller.isMoving),false);
  // A settled map must return to idle after terrain preparation completes.
  await page.waitForTimeout(100);const settled=await page.evaluate(()=>mapDemo.view.stats().drawnFrames);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>mapDemo.view.stats().drawnFrames),settled);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,touchRun:true,walkDefault:true,staticCache:true,idle:true,terrainPixels:after.terrainCache.pixels}));
}finally{await browser.close();}
