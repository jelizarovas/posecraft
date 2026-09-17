import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';
import {actionFixture} from './action-fixture.mjs';
import {compileScene} from '../tools/compile-scene.mjs';
await fs.mkdir('test-results',{recursive:true});
const root=await fs.mkdtemp(path.resolve('test-results/actions-website-')),manifest=await compileScene(actionFixture(),path.join(root,'site'));
assert.ok(manifest.files.some(file=>file.modules.some(id=>id.endsWith('action-variations.js'))));
assert.ok(!manifest.files.some(file=>file.modules.some(id=>/planck|\/physics\.js|\/scene\.js/.test(id))));
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),filename=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!filename.startsWith(root+path.sep))throw Error('Outside fixture');res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(filename));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:5178/');
 const parity=await page.evaluate(async()=>{
  const [{actionFixture},{SceneController},{IllustrationController},{BehaviorRuntime},{WorkerSceneController}]=await Promise.all([import('/test/action-fixture.mjs'),import('/src/scene.js'),import('/src/illustration.js'),import('/src/behaviors.js'),import('/src/worker.js')]);
  const d=actionFixture(),main=new SceneController(d),lite=new IllustrationController(d,{behaviorFactory:BehaviorRuntime}),worker=new WorkerSceneController(d);await worker.ready;
  const settle=()=>new Promise((resolve,reject)=>{const deadline=performance.now()+3000;const check=()=>{if(worker.disposed)return reject(Error('Worker failed'));if(!worker.inFlight&&!worker.queue.length)return resolve();if(performance.now()>deadline)return reject(Error('Worker timeout'));setTimeout(check,3);};check();});
  const signature=c=>JSON.stringify({behavior:c.frame().behavior,actors:c.frame().actors});let same=true;
  const compare=()=>{same&&=signature(main)===signature(lite)&&signature(main)===signature(worker);};compare();
  for(let i=0;i<120;i++){
   if(i===10)for(const c of [main,lite,worker])c.dispatch('start',{actor:'character'});
   if(i===30)for(const c of [main,lite,worker])c.setVariable('fatigue',90);
   await settle();main.step(1/30);lite.step(1/30);worker.step(1/30);await settle();compare();
  }
  const expected=signature(main),time=main.time,variables=main.frame().behavior.variables;
  for(const c of [main,lite,worker])c.seek(.2);await settle();for(const c of [main,lite,worker])c.seek(time);await settle();compare();const replay=[main,lite,worker].every(c=>signature(c)===expected);
  for(const c of [main,lite,worker])c.pause();await settle();const paused=signature(worker);for(const c of [main,lite,worker])c.step(.1);await settle();const frozen=signature(worker)===paused;main.dispose();lite.dispose();worker.dispose();return {same,replay,frozen,variables};
 });
 assert.ok(parity.same,'all sampled main/lite/worker poses and stats match');assert.ok(parity.replay);assert.ok(parity.frozen);assert.ok(parity.variables.failures>0);assert.ok(parity.variables.reps>0);
 const requests=[];page.on('request',request=>requests.push(request.url()));await page.goto(`http://127.0.0.1:${server.address().port}/site/`);await page.waitForFunction(()=>window.posecraft?.controller?.frame().behavior?.actions.character.active);assert.equal(await page.locator('#error').isVisible(),false);
 const first=await page.locator('[data-actor="character"]').innerHTML();await page.waitForFunction(previous=>document.querySelector('[data-actor="character"]').innerHTML!==previous,first);await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.variables.reps>0);
 await page.evaluate(()=>window.posecraft.setVariable('fatigue',100));await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.variables.failures>0,{},{timeout:10000});const exported=await page.evaluate(()=>({time:window.posecraft.controller.time,variables:window.posecraft.controller.frame().behavior.variables,action:window.posecraft.controller.frame().behavior.actions.character}));assert.ok(exported.action.active);assert.ok(exported.variables.failures>0);
 const base=`http://127.0.0.1:${server.address().port}`;assert.ok(requests.filter(url=>url.endsWith('.js')).every(url=>url.startsWith(base+'/site/runtime/')),'compiled page loads only its own runtime files');await page.setViewportSize({width:390,height:600});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,parity,exported,bytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0)}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
