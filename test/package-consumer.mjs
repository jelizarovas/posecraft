import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';

// Exercise the installed tarball, with its own dependencies and no source aliases.
// Keep failed fixtures under .tmp so a failed release can be inspected.
const exec=promisify(execFile),repo=fileURLToPath(new URL('..',import.meta.url));
const npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const manifest=JSON.parse(await fs.readFile(path.join(repo,'package.json'),'utf8'));
await fs.mkdir(path.join(repo,'.tmp'),{recursive:true});
const root=await fs.mkdtemp(path.join(repo,'.tmp/package-consumer-'));
async function run(args,cwd=root){return (await exec(process.execPath,args,{cwd,env:{...process.env,npm_config_cache:path.join(repo,'.tmp/npm-cache')},maxBuffer:8*1024*1024,timeout:180000})).stdout;}
const [packed]=JSON.parse(await run([npm,'pack','--json','--pack-destination',root],repo));
const dependencies={posecraft:`file:./${packed.filename}`};
for(const name of ['vite','typescript','react','react-dom','@types/react'])dependencies[name]=manifest.devDependencies[name];
await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'littlelands-consumer',private:true,type:'module',dependencies},null,2));
console.log('Installing the packed SDK into '+root);
await run([npm,'install','--ignore-scripts','--no-audit','--no-fund',...(process.env.POSECRAFT_CONSUMER_ONLINE==='1'?[]:['--offline'])]);
const installed=path.join(root,'node_modules/posecraft');
assert.equal((await fs.lstat(installed)).isSymbolicLink(),false,'The consumer must install a tarball, not link to the source checkout');
for(const exported of Object.values(manifest.exports))for(const target of Object.values(exported))await fs.access(path.join(installed,target));
await fs.writeFile(path.join(root,'node-smoke.mjs'),`
import assert from 'node:assert/strict';
import {SceneController} from 'posecraft/scene';
import {createGameScene} from 'posecraft/game';
import {createDrawing} from 'posecraft/vector-authoring';
import {mountScene} from 'posecraft/browser';
import {PosecraftScene} from 'posecraft/react';
const c=new SceneController(createDrawing()),game=createGameScene(c);
assert.equal(game.describe().actors[0].id,'character');
assert.equal(typeof mountScene,'function');assert.ok(PosecraftScene);
assert.ok(import.meta.resolve('posecraft/game').includes('/node_modules/posecraft/src/'));
game.dispose();c.dispose();
`);
await run(['node-smoke.mjs']);
console.log('Checking the installed public TypeScript declarations');
await fs.writeFile(path.join(root,'types.ts'),`
import {createRef,createElement} from 'react';
import {mountScene,type Player} from 'posecraft/browser';
import {createGameScene,type GameActor} from 'posecraft/game';
import {SceneController} from 'posecraft/scene';
import {createDrawing} from 'posecraft/vector-authoring';
import {PosecraftScene,type PosecraftHandle} from 'posecraft/react';
const document=createDrawing(),controller=new SceneController(document);
const actor:GameActor=createGameScene(controller).actor('character');
const player:Player=mountScene(globalThis.document.createElement('div'),document);
actor.do('idle',{signal:new AbortController().signal});player.describe();
async function persistence(){const state=await player.snapshot();await player.restore(state);}
async function scheduling(){await actor.sleep();await actor.wake();}
createElement(PosecraftScene,{scene:document,ref:createRef<PosecraftHandle>()});
`);
await run(['node_modules/typescript/bin/tsc','--noEmit','--strict','--module','nodenext','--target','es2022','types.ts']);
await fs.writeFile(path.join(root,'fixture.mjs'),`
import {createDrawing} from 'posecraft/vector-authoring';
import fs from 'node:fs';
const scene=createDrawing(),pack=scene.packs.drawing;
pack.joints[0].x=160;pack.joints[0].y=160;
pack.joints.push({id:'head',parent:'root',x:0,y:-30,rotation:0,min:-90,max:90,length:12});
pack.parts=[{id:'body',joint:'root',d:'M-20 -20H20V20H-20Z',fill:'#6275bb'}];
pack.clips.wave={duration:.12,loop:false,tracks:{'root.rotation':[[0,0],[.06,12],[.12,0]]}};
scene.requiredFeatures=['game-bindings','scene-objects'];
scene.game={anchors:{sign:{type:'point',x:240,y:120}},actors:{character:{actions:{greet:'wave'},speech:true,gaze:{joint:'head',maxAngle:40},locomotion:{mode:'float',speed:300}}}};
scene.objects=[{id:'lamp',name:'Lamp',shape:'circle',x:400,y:300,radius:10,mass:0,fill:'#db9279'}];
fs.writeFileSync('scene.json',JSON.stringify(scene));
`);
await run(['fixture.mjs']);
await fs.writeFile(path.join(root,'index.html'),'<!doctype html><html><head><meta charset="UTF-8"><title>Littlelands package consumer</title><style>.stage{width:400px;height:300px}body{margin:0}</style></head><body><div id="stage" class="stage"></div><div id="react" class="stage"></div><script type="module" src="/main.js"></script></body></html>');
await fs.writeFile(path.join(root,'main.js'),`
import {mountScene} from 'posecraft/browser';
import {PosecraftScene} from 'posecraft/react';
import React from 'react';
import {createRoot} from 'react-dom/client';
import scene from './scene.json';
window.api={mountScene,PosecraftScene,React,createRoot,scene};
`);
await fs.writeFile(path.join(root,'vite.config.js'),`
import fs from 'node:fs';
export default {base:'./',plugins:[{name:'record-consumer-modules',generateBundle(_,bundle){
fs.writeFileSync('bundled-modules.json',JSON.stringify(Object.values(bundle).filter(v=>v.type==='chunk').flatMap(v=>Object.keys(v.modules))));
}}]};
`);
await run(['node_modules/vite/bin/vite.js','build']);
console.log('Checking the consumer production bundle and browser lifecycle');
const modules=JSON.parse(await fs.readFile(path.join(root,'bundled-modules.json'),'utf8')).map(p=>p.replaceAll('\\','/'));
assert.ok(modules.some(p=>p.includes('/node_modules/posecraft/src/browser.js')));
assert.ok(!modules.some(p=>p.startsWith(repo.replaceAll('\\','/').replace(/\/$/,'')+'/src/')),'Build may not resolve the checkout source');
assert.ok(!modules.some(p=>p.includes('/node_modules/three/')),'The illustrated consumer should not include the native Three renderer');
const dist=path.join(root,'dist'),files=await fs.readdir(path.join(dist,'assets'));
assert.ok(files.some(file=>/^simulation-worker-.*\.js$/.test(file)),'A deployable worker must be emitted');
const sizes=[];
for(const file of files){const buffer=await fs.readFile(path.join(dist,'assets',file));sizes.push({file,bytes:buffer.length,gzipBytes:gzipSync(buffer).length});}
const server=http.createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),filename=path.resolve(dist,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!filename.startsWith(dist+path.sep))throw Error('Outside fixture');
  const buffer=await fs.readFile(filename);res.writeHead(200,{'content-type':filename.endsWith('.js')?'text/javascript':filename.endsWith('.json')?'application/json':'text/html'});res.end(buffer);
 }catch{res.writeHead(404);res.end('Not found');}
});
let browser,devServer;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'no-preference'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.api);
 for(const execution of ['main','worker'])for(let cycle=0;cycle<2;cycle++){
  const result=await page.evaluate(async execution=>{
   const events=[],player=api.mountScene(document.querySelector('#stage'),api.scene,{execution,reducedMotion:false,onEvent:e=>events.push(e),onSpeechRequest:()=>new Promise(()=>{})});
   await player.controller.ready;
   const completed=await player.actor('character').do('greet');
   const abort=new AbortController(),action=player.actor('character').do('greet',{signal:abort.signal}).then(()=> 'resolved',e=>e.name);abort.abort();
   const cancelled=await action,pending=player.actor('character').say('Hold').then(()=> 'resolved',e=>e.name);
   await Promise.resolve();player.dispose();player.dispose();
   return {completed:completed.type,cancelled,disposed:await pending,children:document.querySelector('#stage').childElementCount,completions:events.filter(e=>e.type==='actor.action.completed'&&e.request===completed.request).length};
  },execution);
  assert.deepEqual(result,{completed:'actor.action.completed',cancelled:'AbortError',disposed:'AbortError',children:0,completions:1});
 }
 const integration=[];
 for(const execution of ['main','worker']){
  const result=await page.evaluate(async execution=>{
   const player=api.mountScene(document.querySelector('#stage'),api.scene,{execution,reducedMotion:false,onSpeechRequest:r=>r.text==='hold for sleep'?new Promise(()=>{}):Promise.resolve()});
   await player.controller.ready;
   const actor=player.actor('character');
   const completed=await Promise.all([actor.moveTo('sign'),actor.lookAt('sign',{duration:.1}),actor.say('Here is the sign')]);
   await player.object('lamp').set('enabled',false);
   const disabled=player.controller.frame().objects.find(o=>o.id==='lamp').enabled===false;
   const saved=JSON.parse(JSON.stringify(await player.snapshot()));
   await player.object('lamp').set('enabled',true);
   await actor.moveTo({type:'point',x:280,y:180});
   await player.restore(saved);
   const restored=await player.snapshot();
   const pendingSleep=actor.say('hold for sleep').then(()=> 'resolved',e=>e.name);await Promise.resolve();
   await actor.sleep();const sleeping=player.controller.frame().actors[0].sleeping,sleepCancelled=await pendingSleep;
   await actor.wake();const awake=player.controller.frame().actors[0].sleeping!==true;
   player.dispose();
   return {types:completed.map(e=>e.type),disabled,position:saved.actors[0].position,restoredPosition:restored.actors[0].position,restoredEnabled:restored.objects[0].enabled,sleeping,awake,sleepCancelled};
  },execution);
  assert.deepEqual(result.types,['actor.arrived','actor.look.completed','actor.speech.completed']);
  assert.equal(result.disabled,true);assert.deepEqual(result.restoredPosition,result.position);assert.equal(result.restoredEnabled,false);assert.equal(result.sleeping,true);assert.equal(result.awake,true);assert.equal(result.sleepCancelled,'AbortError');integration.push(execution);
 }
 await page.evaluate(()=>{
  window.failures=[];window.speechSignals=[];window.ref=api.React.createRef();window.root=api.createRoot(document.querySelector('#react'));
  root.render(api.React.createElement(api.React.StrictMode,null,api.React.createElement(api.PosecraftScene,{ref,scene:api.scene,execution:'worker',reducedMotion:false,onError:e=>failures.push(e.message),onSpeechRequest:r=>{speechSignals.push(r.signal);return new Promise(()=>{});}})));
 });
 await page.waitForFunction(()=>ref.current?.controller);await page.evaluate(()=>ref.current.controller.ready);
 assert.equal(await page.evaluate(async()=>(await ref.current.actor('character').do('greet')).type),'actor.action.completed');
 await page.evaluate(()=>{window.pending=ref.current.actor('character').say('Hold').then(()=> 'resolved',e=>e.name);});
 await page.waitForFunction(()=>speechSignals.length>0);
 const unmounted=await page.evaluate(async()=>{root.unmount();return {cancelled:await pending,aborted:speechSignals.every(s=>s.aborted),children:document.querySelector('#react').childElementCount,failures};});
 assert.deepEqual(unmounted,{cancelled:'AbortError',aborted:true,children:0,failures:[]});
 // Production React omits StrictMode's setup/cleanup probe. Exercise it using
 // the installed consumer's development server as a separate lifecycle check.
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 devServer=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0}});await devServer.listen();
 await page.goto('http://127.0.0.1:'+devServer.httpServer.address().port+'/');await page.waitForFunction(()=>window.api);
 await page.evaluate(()=>{
  const OriginalWorker=window.Worker;window.createdWorkers=0;window.activeWorkers=0;
  window.Worker=class extends OriginalWorker{constructor(...args){super(...args);createdWorkers++;activeWorkers++;this.counted=true;}terminate(){if(this.counted){this.counted=false;activeWorkers--;}return super.terminate();}};
  window.ref=api.React.createRef();window.root=api.createRoot(document.querySelector('#react'));
  root.render(api.React.createElement(api.React.StrictMode,null,api.React.createElement(api.PosecraftScene,{ref,scene:api.scene,execution:'worker',reducedMotion:false})));
 });
 await page.waitForFunction(()=>createdWorkers>=2&&ref.current?.controller);await page.evaluate(()=>ref.current.controller.ready);
 const strict=await page.evaluate(async()=>{await ref.current.actor('character').do('greet');const active=activeWorkers;root.unmount();return {created:createdWorkers,active,remaining:activeWorkers};});
 assert.ok(strict.created>=2);assert.equal(strict.active,1);assert.equal(strict.remaining,0);
 assert.deepEqual(errors,[]);assert.ok(requests.some(url=>/simulation-worker-.*\.js$/.test(url)),'Browser must actually request the installed worker bundle');
 const report={passed:true,fixture:root,tarball:{bytes:packed.size,unpackedBytes:packed.unpackedSize,files:packed.entryCount,integrity:packed.integrity},assets:sizes,mainBundle:{modules:modules.length,includesPlanck:modules.some(p=>p.includes('/node_modules/planck/')),includesThree:modules.some(p=>p.includes('/node_modules/three/'))},checks:['installed public exports','strict TypeScript','production bundle','worker asset served','main/worker completion and cancellation','concurrent move/look/speech','object acknowledgment','JSON snapshot/restore','actor sleep/wake','repeated mount/dispose','React StrictMode development remount and unmount cancellation']};
 await fs.mkdir(path.join(repo,'test-results'),{recursive:true});await fs.writeFile(path.join(repo,'test-results/package-consumer.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await devServer?.close();await new Promise(resolve=>server.close(resolve));}
