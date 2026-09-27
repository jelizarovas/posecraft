import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';
import {createDrawing} from '../src/vector-authoring.js';
import {compileScene} from '../tools/compile-scene.mjs';

const scene=createDrawing(),pack=scene.packs.drawing;
pack.parts=[{id:'body',joint:'root',d:'M0 0L30 0L30 60L0 60Z',fill:'#8844bb'}];
pack.clips.left={duration:1,loop:false,tracks:{'root.rotation':[[0,-30],[1,-30]]}};
pack.clips.right={duration:1,loop:false,tracks:{'root.rotation':[[0,30],[1,30]]}};
scene.hostTransition={actors:[{actor:'character',depart:{left:'left',right:'right'},arrive:{left:'left',right:'right'}}]};
await fs.mkdir('test-results',{recursive:true});
const directory=await fs.mkdtemp(path.resolve('test-results/host-transition-export-'));
const manifest=await compileScene(scene,directory);
assert.equal(manifest.runtime,'illustration');assert(manifest.features.includes('host-transition'));
assert(manifest.files.some(file=>file.modules.some(module=>module.endsWith('/src/host-transition.js')||module==='src/host-transition.js')));
assert(!manifest.files.some(file=>file.modules.some(module=>/planck|\/src\/physics\.js/.test(module))));
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,filename=path.resolve(directory,'.'+(name==='/'?'/index.html':name));if(!filename.startsWith(directory+path.sep))throw Error('Invalid path');const data=await fs.readFile(filename);res.writeHead(200,{'content-type':filename.endsWith('.js')?'text/javascript':filename.endsWith('.json')?'application/json':'text/html'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
try{
 for(const reducedMotion of ['no-preference','reduce']){
  const page=await browser.newPage({reducedMotion});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!!window.posecraft);
  const result=await page.evaluate(async()=>{
   window.posecraft.dispose();const {mountExport}=await import('/runtime/illustration.js');
   const scene=JSON.parse(document.getElementById('posecraft-scene').textContent),player=mountExport(document.getElementById('posecraft'),scene,{autoplay:false});
   player.previewClip('character','idle',0);
   const read=()=>document.querySelector('[data-joint="root"]').getAttribute('transform');
   const before=read();player.setHostTransition({phase:'depart',direction:1,progress:.5});const during=read(),time=player.controller.time;
   player.clearHostTransition();const after=read();player.dispose();return {before,during,after,time};
  });
  assert.equal(result.time,0);assert.equal(result.after,result.before);
  if(reducedMotion==='reduce')assert.equal(result.during,result.before);else assert.notEqual(result.during,result.before);
  await page.close();
 }
 assert.deepEqual(errors,[]);
 const active=await browser.newPage();await active.goto(`http://127.0.0.1:${server.address().port}`);await active.waitForFunction(()=>!!window.posecraft);
 const scheduling=await active.evaluate(async()=>{
  window.posecraft.dispose();const {mountExport}=await import('/runtime/illustration.js');
  const scene=JSON.parse(document.getElementById('posecraft-scene').textContent),host=document.getElementById('posecraft');
  let reads=0;const measure=host.getBoundingClientRect.bind(host);host.getBoundingClientRect=()=>{reads++;return measure();};
  const player=mountExport(host,scene,{hostMotion:false});
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  let frames=0;const original=player.controller.frame.bind(player.controller);player.controller.frame=()=>{frames++;return original();};reads=0;
  for(let i=0;i<20;i++)player.setHostTransition({phase:'depart',direction:1,progress:.2+i*.01});
  const synchronousFrames=frames;await new Promise(requestAnimationFrame);
  const afterFrame=frames,hostReads=reads,angle=player.controller.frame().actors[0].pose['root.rotation'];
  player.dispose();
  const automatic=mountExport(host,scene);reads=0;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const automaticReads=reads;automatic.dispose();
  return {synchronousFrames,afterFrame,hostReads,angle,automaticReads};
 });
 assert.equal(scheduling.synchronousFrames,0);assert.equal(scheduling.afterFrame,1);assert.equal(scheduling.hostReads,0);assert.equal(scheduling.angle,30);assert(scheduling.automaticReads>0);await active.close();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({compiledExport:true,physicsExcluded:true,pausedRepaint:true,previewOverlay:true,reducedMotion:true,activeUpdatesCoalesced:true,hostMotionOptOut:true,directory}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
