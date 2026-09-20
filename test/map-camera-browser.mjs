import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo?.view.stats().art.loaded===15&&!mapDemo.view.stats().terrainCache.pending);
  await page.locator('#demo-fullscreen').click();
  await page.waitForFunction(()=>!mapDemo.view.stats().terrainCache.pending);
  const original=await page.evaluate(()=>mapDemo.view.snapshot().camera);
  await page.evaluate(()=>{window.done=false;mapDemo.view.moveTo('hero',{x:64.5,y:90.5}).then(()=>window.done=true).catch(()=>{});});
  await page.waitForFunction(()=>mapDemo.view.controller.actorPosition('hero').walking);
  await page.waitForTimeout(600);
  const followed=await page.evaluate(()=>{
    const a=mapDemo.view.controller.actorPosition('hero'),p=mapDemo.view.mapToScreen(a),r=document.querySelector('#demo-art canvas').getBoundingClientRect();
    return{camera:mapDemo.view.snapshot().camera,error:Math.hypot(p.x-r.width/2,p.y-r.height/2-18*mapDemo.map.tileSize.width/64)};
  });
  assert.ok(Math.hypot(followed.camera.x-original.x,followed.camera.y-original.y)>5);
  assert.ok(followed.error<15,JSON.stringify(followed));
  assert.equal(await page.locator('#map-recenter').isHidden(),true);
  const session=await page.context().newCDPSession(page),canvas=page.locator('#demo-art canvas'),box=await canvas.boundingBox();
  async function swipe(){
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+80,y:box.y+150}]});
    for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+80+i*20,y:box.y+150+i*8}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await swipe();assert.equal(await page.locator('#map-recenter').isVisible(),false);await page.locator('#demo-fullscreen').click();await page.locator('#map-recenter').waitFor({state:'visible'});
  const detached=await page.evaluate(()=>({camera:mapDemo.view.snapshot().camera,actor:mapDemo.view.controller.actorPosition('hero'),commands:mapDemo.events.filter(e=>e.type==='map.move.started').length}));
  await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>mapDemo.view.snapshot().camera),detached.camera,'Camera must not pull back after a swipe');
  assert.notEqual(await page.evaluate(()=>mapDemo.view.controller.actorPosition('hero').y),detached.actor.y,'Task continues while inspecting elsewhere');
  const button=await page.locator('#map-recenter').boundingBox();assert.ok(button.height>=44&&button.x>=0&&button.x+button.width<=390);
  await page.screenshot({path:'test-results/map-camera-recenter-mobile.png'});
  await page.locator('#map-recenter').click();
  await page.waitForFunction(()=>mapDemo.view.cameraTracking().following);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>mapDemo.events.filter(e=>e.type==='map.move.started').length),detached.commands,'Recenter must not restart the task');
  assert.equal(await page.locator('#map-recenter').isHidden(),true);
  // A new task resumes tracking, including commands sent directly to the controller.
  await page.evaluate(()=>{mapDemo.view.panTo(20,20);mapDemo.view.controller.moveTo('hero','village-chest').catch(()=>{});});
  assert.equal(await page.evaluate(()=>mapDemo.view.cameraTracking().following),true);
  await page.waitForTimeout(700);
  await page.evaluate(()=>{mapDemo.view.controller.cancel('hero');mapDemo.view.stopFollowing();});
  const saved=await page.evaluate(()=>mapDemo.view.snapshot());
  await page.evaluate(async saved=>{mapDemo.view.followActor('hero');await mapDemo.view.restore(saved);},saved);
  assert.deepEqual(await page.evaluate(()=>mapDemo.view.cameraTracking()),saved.camera.tracking);
  assert.equal(await page.locator('#map-recenter').isVisible(),true);
  // Old saves remain valid; malformed tracking must not mutate the view.
  await page.evaluate(async saved=>{delete saved.camera.tracking;await mapDemo.view.restore(saved);},saved);
  const invalid=await page.evaluate(async()=>{const before=mapDemo.view.snapshot(),bad=structuredClone(before);bad.camera.tracking={actor:'missing',following:true};let rejected=false;try{await mapDemo.view.restore(bad);}catch{rejected=true;}return{rejected,unchanged:JSON.stringify(before)===JSON.stringify(mapDemo.view.snapshot())};});
  assert.deepEqual(invalid,{rejected:true,unchanged:true});
  await page.locator('#map-recenter').click();
  await page.waitForTimeout(1000);await page.waitForFunction(()=>!mapDemo.view.stats().terrainCache.pending);
  const frames=await page.evaluate(()=>mapDemo.view.stats().drawnFrames);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>mapDemo.view.stats().drawnFrames),frames,'Settled follow camera must become idle');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,taskFollow:true,touchPanRelease:true,recenter:true,taskPreserved:true,savedTracking:true,oldSaves:true,idle:true}));
}finally{await browser.close();}
