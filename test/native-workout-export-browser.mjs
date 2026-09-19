import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5231').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await fs.mkdir('test-results',{recursive:true});
const reports=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/native-studio.html?demo=gym-routine');const ready=()=>page.waitForFunction(()=>window.posecraftNativeStudio?.snapshot().ready);await ready();
 for(const asset of ['athlete','regular']){
  await page.locator('[data-section=character]').click();await page.locator('#character-asset').selectOption(asset);await ready();
  await page.locator('#play').click();await page.waitForFunction(()=>posecraftNativeStudio.snapshot().frame.time>.25);await page.locator('#play').click();
  const source=await page.evaluate(()=>posecraftNativeStudio.snapshot());assert.equal(source.project.kind,'workout3d');assert.equal(source.stats.motionWorker,true);
  const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading,html=await fs.readFile(await download.path(),'utf8');await fs.writeFile(`test-results/native-workout-${asset}.html`,html);
  assert.ok(html.includes('data:model/gltf-binary;base64,'));
  const exported=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'reduce'}),requests=[];exported.on('pageerror',e=>errors.push(e.message));exported.setDefaultTimeout(60000);
  await exported.route('http://workout-export.test/**',route=>route.fulfill({body:html,contentType:'text/html'}));exported.on('request',r=>{if(!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await exported.goto('http://workout-export.test/');await exported.waitForFunction(()=>window.posecraft?.view?.frame);assert.equal(await exported.evaluate(()=>posecraft.view.stats().motionWorker),true);assert.equal(await exported.evaluate(()=>posecraft.playing),false);
  assert.deepEqual(await exported.evaluate(()=>posecraft.project),source.project);
  const frame=await exported.evaluate(t=>posecraft.seek(t),source.frame.time);assert.deepEqual(frame.world,source.frame.world);assert.deepEqual(frame.bar,source.frame.bar);assert.deepEqual(frame.workout,source.frame.workout);
  const proof=await exported.evaluate(async()=>{
   const view=posecraft.view,events=[];const unsubscribe=view.subscribe(e=>events.push(e));
   // A different prior time ensures the worker response is observed, rather than the sync frame.
   for(const time of [3,12,28,65,95,130]){const expected=view.render(time);view.render(0);view.renderAsync(time);for(let i=0;i<1200&&view.frame.time!==time;i++)await new Promise(r=>setTimeout(r,5));if(JSON.stringify(view.frame)!==JSON.stringify(expected))throw Error('Export worker mismatch at '+time);}
   await view.setVariable('dehydration',80);const id=await view.request('rest',{request:'export-rest'});if(id!=='export-rest')throw Error('Caller request was not acknowledged');await view.cancel(id);view.render(130.1);const cancelled=events.filter(e=>e.request===id&&e.type==='actor.command.cancelled').length;view.render(130.1);if(cancelled!==1||events.filter(e=>e.request===id&&e.type==='actor.command.cancelled').length!==1)throw Error('Cancellation events repeated or missing');
   await view.resetMovement();if(!events.some(e=>e.type==='workout.reset'))throw Error('Reset lifecycle missing');unsubscribe();return {workerSamples:6,requestCancel:true,eventDedup:true};
  });
  assert.ok(requests.every(url=>url==='http://workout-export.test/'||url.endsWith('/favicon.ico')),'Export fetched an external dependency');
  await exported.evaluate(()=>posecraft.seek(12));await exported.screenshot({path:`test-results/native-workout-export-${asset}.png`});reports.push({asset,bytes:Buffer.byteLength(html),...proof});await exported.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile('test-results/native-workout-export-report.json',JSON.stringify({passed:true,reports},null,2));console.log(JSON.stringify({passed:true,reports}));
}finally{await browser.close();}
