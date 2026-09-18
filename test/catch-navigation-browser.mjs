import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createCatchNavigation} from '../examples/catch.js';
import {compileScene} from '../tools/compile-scene.mjs';

const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5190';
await fs.mkdir('test-results',{recursive:true});
const directory='test-results/catch-navigation-site-'+Date.now();
const manifest=await compileScene(createCatchNavigation(),directory);
assert.equal(manifest.runtime,'illustration');
assert.ok(manifest.features.includes('navigation'));
const modules=manifest.files.flatMap(f=>f.modules);
assert.ok(modules.some(id=>id.endsWith('/navigation.js')));
assert.ok(modules.every(id=>!/planck|\/physics\.js|\/scene\.js/.test(id)),'export excludes Planck and full controller');
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
const rounded=value=>JSON.parse(JSON.stringify(value,(_k,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v));
try{
 const page=await browser.newPage({viewport:{width:1050,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',s=>s.close());
 await page.route('**/catch-navigation-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="stage"></div>'}));
 await page.goto(base+'/catch-navigation-fixture');
 await page.evaluate(async()=>{
  const [{createCatchNavigation},{SceneController},{IllustrationController},{illustrationProviders},{WorkerSceneController},{PathJob},{captureIllustrationState,restoreIllustrationState}]=await Promise.all([import('/examples/catch.js'),import('/src/scene.js'),import('/src/illustration.js'),import('/src/illustration-entry.js'),import('/src/worker.js'),import('/src/navigation.js'),import('/src/illustration-checkpoint.js')]);
  const doc=createCatchNavigation();window.navDocument=doc;window.full=new SceneController(doc);window.lite=new IllustrationController(doc,await illustrationProviders(doc));window.worker=new WorkerSceneController(doc);await worker.ready;
  window.summary=c=>{const f=c.frame();return {objects:f.objects,objectGames:f.objectGames,actors:f.actors.map(a=>({id:a.id,pose:a.pose,placement:a.placement,groundY:a.groundY}))};};
  // Exercise the same checkpoint adapter used by seeking, while A* is unfinished.
  const request={start:{x:180,y:318},end:{x:600,y:318},area:doc.objectGames[0].navigation.bounds,cellSize:12,clearance:18};
  const job=new PathJob(doc,request);job.step(8);if(job.done)throw Error('Fixture must retain an active A* job');
  lite.propGames.routes.set('pip',{goal:request.end,job,path:null,index:0,retryAt:.35});
  const snapshot=captureIllustrationState(lite),expected=job.snapshot();job.step(24);restoreIllustrationState(lite,snapshot);
  if(JSON.stringify(lite.propGames.routes.get('pip').job.snapshot())!==JSON.stringify(expected))throw Error('Active route checkpoint lost search state');
  const restored=lite.propGames.routes.get('pip').job;while(!restored.done)restored.step(8);
  const remote=await worker.findPath(request);if(JSON.stringify(remote)!==JSON.stringify(restored.result))throw Error('Worker path differs from restored incremental route');
  window.routeResult={expanded:restored.expanded,points:remote.path.length,activeCheckpoint:true};lite.reset();
 });
 for(const time of [8,20,4.5,12,35]){
  await page.evaluate(t=>{for(const c of[full,lite,worker])c.seek(t);},time);
  await page.waitForFunction(t=>!worker.inFlight&&!worker.queue.length&&Math.abs(worker.frame().time-t)<.001,time);
  const frames=await page.evaluate(()=>({full:summary(full),lite:summary(lite),worker:summary(worker)}));
  assert.deepEqual(rounded(frames.lite),rounded(frames.full),'lite replay at '+time);
  assert.deepEqual(rounded(frames.worker),rounded(frames.full),'worker replay at '+time);
 }
 const expected=await page.evaluate(()=>summary(full)),checkpoint=await page.evaluate(()=>({full:full.checkpointStats(),lite:lite.checkpointStats(),route:routeResult}));
 assert.ok(checkpoint.full.hits>0&&checkpoint.lite.hits>0,'backward seek reuses checkpoints');
 await page.evaluate(()=>{full.dispose();lite.dispose();worker.dispose();});
 await page.goto(base+'/'+directory+'/index.html');await page.waitForFunction(()=>window.posecraft?.controller);
 const exported=await page.evaluate(()=>{posecraft.pause();posecraft.seek(35);const f=posecraft.controller.frame();return {objects:f.objects,objectGames:f.objectGames,actors:f.actors.map(a=>({id:a.id,pose:a.pose,placement:a.placement,groundY:a.groundY}))};});
 assert.deepEqual(rounded(exported),rounded(expected),'compiled website matches full source');
 await page.screenshot({path:'test-results/catch-navigation-export.png'});
 await page.goto(base+'/demos.html?obstacles=1#game-of-catch');await page.locator('#catch-obstacles').waitFor();
 const mode=async()=>{assert.equal(new URL(page.url()).searchParams.get('obstacles'),'1');assert.equal(await page.locator('#catch-obstacles').innerText(),'Open field');assert.match(await page.locator('#edit-demo').getAttribute('href'),/demo=game-of-catch&obstacles=1/);assert.equal(await page.locator('[data-prop="garden-box"]').count(),1);};
 await mode();await page.locator('#demo-reset').click();await mode();await page.locator('#catch-new').click();await mode();await page.locator('#catch-skill').selectOption({label:'Butterfingers'});await mode();assert.equal(await page.locator('#catch-skill option:checked').innerText(),'Butterfingers','selected skill remains visible after rebuilding controls');
 // Seed an unrelated, valid open-field draft; opening the obstacle route must preserve it.
 const original=await page.evaluate(async()=>{const {createCatch}=await import('/examples/catch.js');const d=createCatch();d.name='Open field draft preserved';const raw=JSON.stringify(d);localStorage.setItem('posecraft.studio.v2.demo.game-of-catch',raw);return raw;});
 await page.screenshot({path:'test-results/catch-navigation-demo.png'});await page.locator('#edit-demo').click();await page.locator('#save').waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('#save').click();const download=await downloadPromise,downloadPath=await download.path(),opened=JSON.parse(await fs.readFile(downloadPath,'utf8'));
 assert.ok(opened.objectGames[0].navigation,'Studio opened the navigation scene');assert.equal(await page.evaluate(()=>localStorage.getItem('posecraft.studio.v2.demo.game-of-catch')),original);
 // Rename the selected folder: normal undoable edit persists to the obstacle-only draft.
 await page.locator('#scene-name').fill('Obstacle cast draft');await page.locator('#scene-name').press('Tab');
 await page.waitForFunction(()=>localStorage.getItem('posecraft.studio.v2.demo.game-of-catch.obstacles'));
 const saved=await page.evaluate(()=>({obstacles:JSON.parse(localStorage.getItem('posecraft.studio.v2.demo.game-of-catch.obstacles')),open:localStorage.getItem('posecraft.studio.v2.demo.game-of-catch')}));assert.ok(saved.obstacles.objectGames[0].navigation);assert.equal(saved.open,original);
 await page.reload();await page.locator('#save').waitFor();assert.equal(await page.locator('#scene-name').inputValue(),'Obstacle cast draft');
 assert.deepEqual(errors,[]);
 const report={passed:true,checkpoint,features:manifest.features,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),game:exported.objectGames[0],draftIsolation:true};await fs.writeFile('test-results/catch-navigation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
