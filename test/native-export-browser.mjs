import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5210').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await fs.mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(base+'/native-studio.html');
 await page.waitForFunction(()=>window.posecraftNativeStudio?.snapshot().ready);
 const snapshot=()=>page.evaluate(()=>posecraftNativeStudio.snapshot());
 const idle=()=>page.waitForFunction(()=>posecraftNativeStudio.snapshot().ready);
 const edit=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');await idle();};
 assert.equal((await snapshot()).playing,false);
 assert.equal((await snapshot()).stats.motionWorker,true,'Studio did not start its motion worker');
 await page.locator('[data-section=bench]').click();
 await edit('bench-position-0',.3);await edit('bench-position-2',-.25);await edit('bench-yaw',35);
 await page.locator('[data-view=three]').click();await idle();
 const initial=await snapshot(),samples=[];
 for(const beat of initial.beats){
  const time=Number(((beat.start+beat.end)/2).toFixed(2));
  await page.locator('#time').fill(String(time));await page.locator('#time').dispatchEvent('input');
  await page.waitForFunction(t=>Math.abs(posecraftNativeStudio.snapshot().time-t)<.015&&Math.abs(posecraftNativeStudio.snapshot().frame.time-t)<.015,time);
  const state=await snapshot();assert.ok(state.frame);assert.equal(state.frame.valid,true,beat.id+' has unreachable constraints');
  for(const diagnostic of state.frame.diagnostics){assert.ok(diagnostic.error<.003,`${beat.id} ${diagnostic.id} misses contact`);assert.equal(diagnostic.maxStretch,1);}
  samples.push({time,phase:state.frame.phase,world:state.frame.world,bar:state.frame.bar});
  await page.screenshot({path:`test-results/native-motion-${beat.id}.png`});
 }
 const cameraBefore=(await snapshot()).frame;
 await page.locator('[data-view=side]').click();await idle();
 const cameraAfter=(await snapshot()).frame;assert.deepEqual(cameraAfter.world,cameraBefore.world,'camera changed skeleton');assert.deepEqual(cameraAfter.bar,cameraBefore.bar,'camera changed bar');
 const press=initial.beats.find(b=>b.id==='press-1'),reviewTime=Number(((press.start+press.end)/2).toFixed(2));
 await page.locator('#time').fill(String(reviewTime));await page.locator('#time').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(posecraftNativeStudio.snapshot().time-t)<.015&&Math.abs(posecraftNativeStudio.snapshot().frame.time-t)<.015,reviewTime);
 const beforeExport=await snapshot();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
 const html=await fs.readFile(await download.path(),'utf8');await fs.writeFile('test-results/native-export.html',html);
 assert.ok(html.includes('data:model/gltf-binary;base64,'));assert.ok(!/https?:\/\/[^<\s"']+\.glb/.test(html));
 const exported=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'}),network=[];
 exported.on('pageerror',e=>errors.push(e.message));
 await exported.route('http://native-export.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
 exported.on('request',request=>{if(!request.url().startsWith('data:'))network.push(request.url());});
 await exported.goto('http://native-export.test/');await exported.waitForFunction(()=>window.posecraft?.view?.frame);
 assert.equal(await exported.evaluate(()=>posecraft.view.stats().motionWorker),true,'Embedded motion worker did not start');
 await exported.evaluate(()=>posecraft.play());await exported.waitForFunction(()=>posecraft.view.frame.time>.15);await exported.evaluate(()=>posecraft.pause());
 assert.deepEqual(await exported.evaluate(()=>posecraft.project),beforeExport.project);
 for(const sample of samples){
  const frame=await exported.evaluate(time=>posecraft.seek(time),sample.time);
  assert.deepEqual(frame.world,sample.world,'export skeleton differs in '+sample.phase);
  assert.deepEqual(frame.bar,sample.bar,'export bar differs in '+sample.phase);
 }
 assert.ok(network.every(url=>url==='http://native-export.test/'||url.endsWith('/favicon.ico')),'export made external runtime/asset requests');
 await exported.evaluate(time=>posecraft.seek(time),reviewTime);
 await exported.screenshot({path:'test-results/native-export-press.png'});
 // Browser restart and document reload must reproduce the same pose, too.
 await page.reload();await idle();assert.deepEqual((await snapshot()).project,beforeExport.project);
 await page.locator('#time').fill(String(reviewTime));await page.locator('#time').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(posecraftNativeStudio.snapshot().time-t)<.015&&Math.abs(posecraftNativeStudio.snapshot().frame.time-t)<.015,reviewTime);
 assert.deepEqual((await snapshot()).frame.world,beforeExport.frame.world);
 const geometries=(await snapshot()).stats.geometries;
 for(let i=0;i<20;i++){await page.locator('#time').fill(String(Number((i*.4).toFixed(2))));await page.locator('#time').dispatchEvent('input');}
 await page.waitForFunction(()=>Math.abs(posecraftNativeStudio.snapshot().frame.time-7.6)<.015);
 assert.equal((await snapshot()).stats.geometries,geometries,'playback allocated extra geometry');
 assert.deepEqual(errors,[]);
 await fs.writeFile('test-results/native-export-report.json',JSON.stringify({passed:true,phases:samples.length,bytes:Buffer.byteLength(html),externalDependencies:0,stats:beforeExport.stats,browser:await browser.version()},null,2));
 console.log(JSON.stringify({passed:true,phases:samples.length,exportBytes:Buffer.byteLength(html)}));
}finally{await browser.close();}
