import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';
import ona from '../examples/characters/ona.json' with {type:'json'};
import {createCampfire} from '../examples/campfire.js';
import {createSceneExport} from '../src/scene-export.js';
import {compileScene} from '../tools/compile-scene.mjs';
import {buildExportRuntimes} from '../tools/build-export-runtimes.mjs';

await fs.mkdir(path.resolve('test-results'),{recursive:true});
const root=await fs.mkdtemp(path.resolve('test-results/website-export-'));
const pointerScene=structuredClone(ona);pointerScene.interactions=[{id:'head-tug',actor:'ona',joint:'head',gesture:'drag',response:'resist',event:'tug',resistance:.5}];
const campfire=createCampfire(),physical=structuredClone(ona);physical.actors[0].behavior={mode:'ragdoll'};
const manifests={};for(const [name,scene] of [['clip',pointerScene],['campfire',campfire],['physical',physical]])manifests[name]=await compileScene(scene,path.join(root,name));
const hosted=await buildExportRuntimes(path.join(root,'runtime'));
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),filename=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!filename.startsWith(root+path.sep))throw Error('Outside fixture');const contents=await fs.readFile(filename);res.writeHead(200,{'access-control-allow-origin':'*','content-type':filename.endsWith('.js')?'text/javascript':filename.endsWith('.json')?'application/json':'text/html'});res.end(contents);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
await fs.mkdir(path.join(root,'hosted'));await fs.writeFile(path.join(root,'hosted/index.html'),createSceneExport(campfire,{runtimeBase:base+'/runtime/'}).html);
const remote=http.createServer(server.listeners('request')[0]);await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));const remoteBase=`http://127.0.0.1:${remote.address().port}`;await fs.mkdir(path.join(root,'hosted-physical'));await fs.writeFile(path.join(root,'hosted-physical/index.html'),createSceneExport(physical,{runtimeBase:remoteBase+'/runtime/'}).html);
const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:900,height:620}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 for(const name of ['clip','campfire','physical','hosted','hosted-physical']){
  const scripts=[];const track=request=>{if(request.url().endsWith('.js'))scripts.push(request.url());};page.on('request',track);
  await page.goto(`${base}/${name}/`);await page.waitForFunction(()=>window.posecraft?.controller?.time>.02);assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('svg').count(),1);
  if(name==='clip'){
   const x=await page.evaluate(()=>{const c=window.posecraft.controller;c.pointer({binding:'head-tug',phase:'start',x:100,y:100});c.pointer({binding:'head-tug',phase:'move',x:170,y:100});return c.step(.1).actors[0].pose['head.x'];});assert.ok(x>10&&x<33,'kinematic resistance works in a compiled physics-free illustration');
   await page.evaluate(()=>window.posecraft.controller.pointer({binding:'head-tug',phase:'end',x:170,y:100}));
  }
  if(name==='campfire'||name==='hosted'){
   assert.equal(await page.locator('[data-emitter="fire-flame"]').count(),1);await page.evaluate(()=>window.posecraft.controller.triggerEnsemble('fire-off'));
   await page.waitForFunction(()=>window.posecraft.controller.frame().emitterOverrides?.['fire-flame']?.enabled===false);
   await page.waitForFunction(()=>document.querySelector('[data-emitter="fire-flame"]').getAttribute('display')==='none');
  }
  if(name==='physical'||name==='hosted-physical'){await page.waitForFunction(()=>window.posecraft.controller.frame().actors.some(a=>a.physics));assert.equal(await page.evaluate(()=>!!window.posecraft.controller.worker),name==='physical','self-contained physical exports use a worker; cross-origin hosted runtimes use the full main-thread player');}
  if(name==='hosted'){
   const loaded=new Set(scripts.map(url=>new URL(url).pathname.replace('/runtime/',''))),modules=hosted.files.filter(file=>loaded.has(file.file)).flatMap(file=>file.modules);
   assert.ok(!modules.some(id=>/planck|\/physics\.js|\/scene\.js/.test(id)),'the hosted illustration never requests a physics module');
  }
  page.off('request',track);
 }
 await page.setViewportSize({width:390,height:600});await page.goto(base+'/campfire/');await page.waitForFunction(()=>window.posecraft?.controller?.time>.02);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/website-export-mobile.png'});
 const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:600}}),still=await reduced.newPage();await still.goto(base+'/clip/');await still.waitForFunction(()=>window.posecraft?.controller);await still.waitForTimeout(250);assert.equal(await still.evaluate(()=>window.posecraft.controller.time),0);await still.evaluate(()=>window.posecraft.setInput('ona','emotion','happy'));assert.equal(await still.locator('[data-actor="ona"]').getAttribute('data-emotion'),'happy');await still.goto(base+'/campfire/');await still.waitForFunction(()=>window.posecraft?.controller);await still.locator('[data-actor="fire"] [data-part]').first().click({force:true});assert.equal(await still.evaluate(()=>window.posecraft.controller.frame().behavior.state),'cold');assert.equal(await still.locator('[data-emitter="fire-flame"]').getAttribute('display'),'none','a pointer event refreshes the reduced-motion illustration immediately');await reduced.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,output:root,bundles:Object.fromEntries(Object.entries(manifests).map(([name,m])=>[name,{runtime:m.runtime,bytes:m.files.reduce((sum,f)=>sum+f.bytes,0)}]))}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>remote.close(resolve));}
