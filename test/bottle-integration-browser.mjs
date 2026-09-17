import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createBottle} from '../examples/bottle.js';
import {compileScene} from '../tools/compile-scene.mjs';
import {chromium} from '@playwright/test';
await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/bottle-website-'));await compileScene(createBottle(),path.join(root,'site'));
const server=http.createServer(async(req,res)=>{try{const filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname+(req.url.endsWith('/')?'index.html':''));if(!filename.startsWith(root+path.sep))throw Error('Outside fixture');res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(filename));}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5178/');
 const result=await page.evaluate(async()=>{
  const [{createBottle},{SceneController},{IllustrationController},{BottleFluid},{WorkerSceneController}]=await Promise.all([import('/examples/bottle.js'),import('/src/scene.js'),import('/src/illustration.js'),import('/src/bottle-fluid.js'),import('/src/worker.js')]);
  const d=createBottle(),main=new SceneController(d),lite=new IllustrationController(d,{fluidFactory:BottleFluid}),worker=new WorkerSceneController(d);await worker.ready;
  const settle=()=>new Promise((resolve,reject)=>{const deadline=performance.now()+3000;const check=()=>{if(worker.disposed)return reject(Error('Worker failed'));if(!worker.inFlight&&!worker.queue.length)return resolve();if(performance.now()>deadline)return reject(Error('Worker timeout'));setTimeout(check,5);};check();});
  const send=command=>{main.fluidInput(command);lite.fluidInput(command);worker.fluidInput(command);};
  send({type:'grab',points:[{id:1,x:400,y:220}]});send({type:'move',points:[{id:1,x:460,y:180}]});send({type:'move',points:[{id:1,x:480,y:170}]});send({type:'release',points:[]});send({type:'grab',points:[{id:1,x:400,y:220},{id:2,x:450,y:220}]});send({type:'move',points:[{id:1,x:400,y:220},{id:2,x:440,y:260}]});
  const queued=worker.queue.map(c=>c.value[1].type);await settle();
  for(let i=0;i<25;i++){main.step(1/60);lite.step(1/60);worker.step(1/60);await settle();}
  send({type:'release',points:[]});send({type:'wind',value:-1});send({type:'nudge',ax:700,ay:-100});await settle();
  for(let i=0;i<30;i++){main.step(1/60);lite.step(1/60);worker.step(1/60);await settle();}
  const a=JSON.stringify(main.frame().fluid),b=JSON.stringify(lite.frame().fluid),c=JSON.stringify(worker.frame().fluid);const time=main.time;worker.seek(.1);await settle();worker.seek(time);await settle();const replay=JSON.stringify(worker.frame().fluid)===a;
  let rejected=false;try{worker.fluidInput({type:'move',points:[]});}catch{rejected=true;}main.dispose();lite.dispose();worker.dispose();return {same:a===b&&a===c,replay,queued,rejected};
 });
 assert.deepEqual(result.queued,['grab','move','release','grab','move']);assert.ok(result.same);assert.ok(result.replay);assert.ok(result.rejected);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{window.motionRequests=0;class MotionEvent extends Event{static requestPermission(){window.motionRequests++;return Promise.resolve('granted');}}window.DeviceMotionEvent=MotionEvent;});
 await page.goto(`http://127.0.0.1:${server.address().port}/site/`);await page.waitForFunction(()=>window.posecraft?.controller?.frame().fluid);assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.evaluate(()=>window.motionRequests),0);assert.equal(await page.evaluate(()=>window.posecraft.controller.time),0);
 const before=await page.evaluate(()=>window.posecraft.controller.frame().fluid.bottle.x);await page.evaluate(()=>window.posecraft.fluidInput({type:'nudge',ax:1000,ay:0}));assert.notEqual(await page.evaluate(()=>window.posecraft.controller.frame().fluid.bottle.x),before);await page.locator('#phone-motion').click();assert.equal(await page.evaluate(()=>window.motionRequests),1);await page.locator('#phone-motion').click();await page.evaluate(()=>document.getElementById('posecraft').dispatchEvent(new CustomEvent('posecraft-motion',{detail:{enabled:false,message:'No motion readings received.'}})));assert.equal(await page.locator('#phone-motion').getAttribute('data-enabled'),'false');assert.equal(await page.locator('#motion-status').textContent(),'No motion readings received.');await page.setViewportSize({width:390,height:600});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/bottle-export-mobile.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,...result}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
