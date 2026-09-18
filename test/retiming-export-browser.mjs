import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createDrawing} from '../src/vector-authoring.js';
import {retimeSceneClip} from '../src/timeline-editing.js';
import {compileScene} from '../tools/compile-scene.mjs';

const source=createDrawing(),pack=source.packs.drawing;
for(const [id,parent,x]of [['upper','root',0],['lower','upper',50],['hand','lower',50]])pack.joints.push({id,parent,x,y:0,length:50,rotation:0,min:-180,max:180});
pack.parts=[{id:'upper-arm',joint:'upper',d:'M0 0L50 0',fill:'none',stroke:'#7354ba',strokeWidth:12},{id:'forearm',joint:'lower',d:'M0 0L50 0',fill:'none',stroke:'#b49cd8',strokeWidth:10},{id:'hand',joint:'hand',d:'M-5 -5H5V5H-5Z',fill:'#422667'}];
pack.clips.idle={duration:2,loop:false,tracks:{'root.rotation':[[0,-15,'linear'],[1,15,'linear'],[2,-15]],'upper.rotation':[[0,-20],[1,40],[2,-20]],'lower.rotation':[[0,30],[2,30]]},events:[{time:.5,name:'grip:ready'},{time:1,name:'hold'},{time:1,name:'sound'},{time:1.75,name:'released'}]};
source.actors[0].transform={x:250,y:200,scale:1.5,rotation:0};source.actors[0].behavior={mode:'animated',autoFace:false};source.requiredFeatures=['contacts','contact-targets'];source.contacts=[{id:'hold',name:'Hold',actor:'character',enabled:true,chain:{upper:'upper',lower:'lower',end:'hand'},target:{type:'point',x:332.5,y:267.5},bend:1,weight:1,clip:'idle',start:.5,end:1.5,fadeIn:.25,fadeOut:.25}];
const retimed=retimeSceneClip(source,{packId:'drawing',clipId:'idle',duration:4}).document;
await fs.mkdir('test-results',{recursive:true});const directory='test-results/retiming-site-'+Date.now(),manifest=await compileScene(retimed,directory),modules=manifest.files.flatMap(f=>f.modules);
assert.equal(manifest.runtime,'illustration');assert.ok(!modules.some(id=>/planck|\/studio\/|\/timeline-editing\.js|\/scene-baking\.js|\/agent-authoring\.js|\/scene\.js/.test(id)),'website contains playback, not editor/full physical runtime');
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5197',rounded=value=>JSON.parse(JSON.stringify(value,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v));
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
try{
 const page=await browser.newPage({viewport:{width:850,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',s=>s.close());await page.route('**/retime-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="stage"></div>'}));await page.goto(base+'/retime-fixture');
 await page.evaluate(async({source,retimed})=>{
  const [{SceneController},{IllustrationController},{illustrationProviders},{WorkerSceneController}]=await Promise.all([import('/src/scene.js'),import('/src/illustration.js'),import('/src/illustration-entry.js'),import('/src/worker.js')]);window.original=new SceneController(source);window.full=new SceneController(retimed);window.lite=new IllustrationController(retimed,await illustrationProviders(retimed));window.worker=new WorkerSceneController(retimed);await worker.ready;
  window.sample=c=>{const f=c.frame();return {pose:f.actors[0].pose,world:f.actors[0].world,contacts:f.contacts};};
 },{source,retimed});
 const samples={};
 for(const time of [0,.5,1,1.5,2,2.5,3,3.5,4]){
  await page.evaluate(t=>{original.seek(t/2);for(const c of [full,lite,worker])c.seek(t);},time);await page.waitForFunction(t=>!worker.inFlight&&!worker.queue.length&&Math.abs(worker.frame().time-t)<.001,time);
  const frames=await page.evaluate(()=>({original:sample(original),full:sample(full),lite:sample(lite),worker:sample(worker)}));for(const kind of ['lite','worker'])assert.deepEqual(rounded(frames[kind]),rounded(frames.full),kind+' proportional pose at '+time);
  // Different tick counts can put mathematically zero fades a few ulps above
  // zero; compare pose and numeric constraint results across the time scaling.
  const geometry=f=>({...f,contacts:f.contacts.map(({active,reason,...c})=>c)});assert.deepEqual(rounded(geometry(frames.original)),rounded(geometry(frames.full)),'original proportional pose at '+time);samples[time]=frames.full;
 }
 const markerResult=await page.evaluate(async()=>{
  const events={full:[],lite:[],worker:[]};for(const [name,c]of Object.entries({full,lite,worker})){c.subscribe(e=>{if(e.type==='marker')events[name].push({name:e.name,time:e.time,actor:e.actor});});c.reset();c.play();}
  await new Promise(resolve=>{const check=()=>{if(!worker.inFlight&&!worker.queue.length&&worker.time===0)resolve();else setTimeout(check,0);};check();});
  for(let i=0;i<121;i++){full.step(1/30);lite.step(1/30);await new Promise(resolve=>{worker.onFrame=()=>resolve();worker.step(1/30);});}
  return events;
 });
 assert.deepEqual(markerResult.lite,markerResult.full);assert.deepEqual(markerResult.worker,markerResult.full);assert.deepEqual(markerResult.full.map(e=>e.name),['grip:ready','hold','sound','released']);
 for(const [i,time]of [1,2,2,3.5].entries())assert.ok(Math.abs(markerResult.full[i].time-time)<=1/120+1e-7,'marker observed on its expected fixed tick');
 await page.evaluate(()=>{original.dispose();full.dispose();lite.dispose();worker.dispose();});
 await page.goto(base+'/'+directory+'/index.html');await page.waitForFunction(()=>window.posecraft?.controller);await page.evaluate(()=>posecraft.pause());
 for(const [time,expected]of Object.entries(samples)){const actual=await page.evaluate(t=>{posecraft.seek(t);const f=posecraft.controller.frame();return {pose:f.actors[0].pose,world:f.actors[0].world,contacts:f.contacts};},+time);assert.deepEqual(rounded(actual),rounded(expected),'exported proportional pose at '+time);}
 const exportEvents=await page.evaluate(()=>{const c=posecraft.controller,events=[];c.reset();const off=c.subscribe(e=>{if(e.type==='marker')events.push({name:e.name,time:e.time,actor:e.actor});});c.play();for(let i=0;i<121;i++)c.step(1/30);off();c.pause();return events;});assert.deepEqual(exportEvents,markerResult.full);
 await page.evaluate(()=>posecraft.seek(2));await page.screenshot({path:'test-results/retiming-export.png'});assert.deepEqual(errors,[]);
 const report={passed:true,proportionalSamples:Object.keys(samples).length,markers:exportEvents,runtime:manifest.runtime,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),directory};await fs.writeFile('test-results/retiming-export-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
