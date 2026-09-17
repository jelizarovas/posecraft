import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),local=!process.env.POSECRAFT_URL;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'no-preference'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.workerProbe={created:0,live:0,maxPending:0,replies:0};const Native=Worker;
 window.Worker=class extends Native{constructor(...args){super(...args);this.pending=0;window.workerProbe.created++;window.workerProbe.live++;this.addEventListener('message',({data:m})=>{if(m.type==='frame'){this.pending--;window.workerProbe.replies++;}});}postMessage(m,...args){if(m.type==='advance'){this.pending++;window.workerProbe.maxPending=Math.max(window.workerProbe.maxPending,this.pending);}return super.postMessage(m,...args);}terminate(){if(!this.stopped){window.workerProbe.live--;this.stopped=true;}super.terminate();}};
});
try{
 await page.goto(base+'/react-demo.html');await page.getByLabel('Demo character').selectOption('dummy');await page.getByLabel('Avatar count').selectOption('16');await page.getByLabel('Demo props').check();await page.getByLabel('Demo body mode').selectOption('protective');
 await page.locator('[data-actor="dummy"][data-motion-mode="protective"]').waitFor();assert.equal(await page.locator('[data-actor]').count(),16);
 await page.waitForTimeout(1500);assert.match(await page.getByLabel('Simulation performance').textContent(),/Worker/);
 const probe=await page.evaluate(()=>window.workerProbe);assert.equal(probe.live,1);assert.equal(probe.maxPending,1);assert.ok(probe.replies>10);
 await page.getByRole('button',{name:'Unmount',exact:true}).click();assert.equal((await page.evaluate(()=>window.workerProbe)).live,0);
 await page.getByRole('button',{name:'Mount',exact:true}).click();await page.locator('[data-actor="dummy"][data-motion-mode="protective"]').waitFor();assert.equal((await page.evaluate(()=>window.workerProbe)).live,1);
 if(local){
  fs.writeFileSync('test-results/benchmark.html','<!doctype html><div id="scene" style="width:800px;height:500px"></div>');await page.goto(base+'/test-results/benchmark.html');
  const result=await page.evaluate(async()=>{
   const {mountScene}=await import('/src/browser.js'),{WorkerSceneController}=await import('/src/worker.js');
   const d=await fetch('/examples/characters/dummy.json').then(r=>r.json()),source=d.actors[0];
   d.actors=Array.from({length:24},(_,i)=>({...structuredClone(source),id:'actor-'+i,transform:{x:40+i%6*105,y:65+Math.floor(i/6)*85,scale:.35,rotation:0},behavior:{mode:'protective'}}));
   d.props=Array.from({length:32},(_,i)=>({id:'box-'+i,name:'Box',x:20+i%8*80,y:35+Math.floor(i/8)*100,width:18,height:12,rotation:i%2?15:0,fill:'#aabbcc',collider:{enabled:true,width:18,height:12,x:0,y:0,friction:.7,bounce:.1}}));
   const measures={};const wait=ms=>new Promise(r=>setTimeout(r,ms));
   for(const execution of ['main','worker']){
    const element=document.querySelector('#scene'),player=mountScene(element,d,{execution});if(player.controller.ready)await player.controller.ready;await wait(500);
    let done=false,last=performance.now(),gaps=[];const sample=t=>{gaps.push(t-last);last=t;if(!done)requestAnimationFrame(sample);};requestAnimationFrame(sample);
    await wait(2500);done=true;gaps.sort((a,b)=>a-b);measures[execution]={frames:gaps.length,p95FrameMs:gaps[Math.floor(gaps.length*.95)],maxFrameMs:Math.max(...gaps),stats:player.controller.stats?{...player.controller.stats}:null};
    element.style.display='none';await wait(150);const hiddenTime=player.controller.time;await wait(120);if(player.controller.time!==hiddenTime)throw new Error('Offscreen scene continued simulating.');element.style.display='block';
    player.dispose();await wait(100);
   }
   const nav=structuredClone(d);nav.bounds={width:1024,height:1024};const c=new WorkerSceneController(nav);await c.ready;let receivedFrames=0;c.onFrame=()=>receivedFrames++;
   const endpoint={start:{x:55,y:55},end:{x:1000,y:1000},cellSize:8,clearance:0};const abort=new AbortController();const cancelled=c.findPath(endpoint,{signal:abort.signal}).catch(e=>e.name);abort.abort();
   const jobs=Array.from({length:12},()=>c.findPath(endpoint));let frames=0;for(let i=0;i<30;i++){c.step(1/60);await wait(5);frames++;}
   const paths=await Promise.all(jobs);if(receivedFrames<1||c.time<=0)throw new Error('Routing blocked simulation responses.');if(!paths.every(p=>Array.isArray(p.path)))throw new Error('Expected routes around obstacles.');if(await cancelled!=='AbortError')throw new Error('Cancellation failed.');
   // Overload producers, retain only one in-flight simulation and one latest preview.
   for(let i=0;i<1000;i++){c.previewClip('actor-0','idle',0,{});c.step(.1);}await wait(200);if(c.queue.length>2||c.stats.pendingBatches>1)throw new Error('Unbounded simulation backlog.');
   c.pause();await wait(250);const frozen=c.time;await wait(100);if(c.time!==frozen)throw new Error('Paused worker kept simulating.');
   c.dispose();
   const Native=window.Worker;let reported=false;
   window.Worker=class{postMessage(){queueMicrotask(()=>this.onerror({message:'Test worker loading failure'}));}terminate(){}};
   const broken=new WorkerSceneController(d,{onError:()=>reported=true});await broken.ready.catch(()=>{});if(!reported||broken.stats.execution!=='failed'||broken.playing)throw new Error('Worker failure was not contained.');window.Worker=Native;
   return {measures,pathJobs:paths.length,cancelled:true,framesDuringPathJobs:receivedFrames};
  });
  fs.writeFileSync('test-results/performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  assert.ok(result.measures.worker.frames>30,'main UI continues producing frames during worker load');
 }
 assert.deepEqual(errors,[]);console.log('Performance browser checks passed: worker isolation, one pending batch, 16-avatar UI, termination/remount, route budgets and cancellation.');
}finally{await browser.close();}
