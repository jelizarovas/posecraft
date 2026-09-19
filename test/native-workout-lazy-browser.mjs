import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5230').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',socket=>socket.close());
try{
 await page.goto(base+'/package.json');
 const report=await page.evaluate(async()=>{
  const [{createNativeThreeView},{createWorkoutProject3D}]=await Promise.all([import('/src/native-three-view.js'),import('/src/workout-project-3d.js')]);
  document.body.replaceChildren();const canvas=document.createElement('canvas');canvas.style.cssText='width:500px;height:420px';document.body.append(canvas);
  const project=createWorkoutProject3D();project.workout.sequence=['rest'];project.workout.restDuration=3;
  const view=await createNativeThreeView(canvas,{...project,assetUrl:'/assets/native-3d/athlete.glb'}),mirror=view.action,original={},calls=[];
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),check=(v,m)=>{if(!v)throw Error(m);};
  const workerAt=async time=>{for(let n=0;n<3000;n++){view.renderAsync(time);if(view.frame.time===time&&view.stats().motionWorker)return structuredClone(view.frame);await delay(3);}throw Error('Worker did not display '+time);};
  try{
   check(view.stats().motionWorker,'Worker unavailable');
   for(const name of ['sample','setVariable','request','cancel','interrupt']){original[name]=mirror[name];mirror[name]=()=>{calls.push(name);throw Error('Main-thread mirror executed '+name);};}
   for(let time=20;time<=1200;time+=20)await workerAt(time);
   check(mirror.snapshot().time===0,'Live playback advanced the main mirror');
   const changed=view.setVariable('fatigue',37),requested=view.request('rest',{request:'lazy-rest'}),cancelled=view.cancel('lazy-rest');
   // RAFs continue while the control queue is awaiting acknowledgments.
   for(let n=0;n<5;n++)view.renderAsync(1200);
   let pendingError='';try{view.sample(1200);}catch(error){pendingError=error.message;}
   check(/pending workout command/.test(pendingError),'Sync authoring accepted an unacknowledged control');
   await Promise.all([changed,requested,cancelled]);await workerAt(1200.1);
   check(view.finishSafely(1200.1),'Safe stop was not accepted');for(let n=0;n<5;n++)view.renderAsync(1200.1);
   const expected=await workerAt(1204);check(expected.workout.stopped,'Safe stop did not complete');
   canvas.style.width='510px';await delay(100);check(calls.length===0,'Commands or resize touched main mirror: '+calls.join(','));check(mirror.snapshot().time===0,'Main mirror state changed');
   for(const [name,fn] of Object.entries(original))mirror[name]=fn;
   const actual=view.sample(1204);check(JSON.stringify(actual)===JSON.stringify(expected),'Lazy explicit replay differs from worker');
   view.sample(40);check(JSON.stringify(view.sample(1204))===JSON.stringify(expected),'Backward replay lost controls');
   const events=[];view.subscribe(e=>events.push(e.type));await view.resetMovement();check(events.includes('workout.reset'),'Reset lifecycle missing');
   const reset=structuredClone(view.frame);await workerAt(.1);check(JSON.stringify(view.sample(.1))===JSON.stringify(view.frame),'Reset fresh mirrors differ');check(reset.workout.events.length===0,'View reset retained old event history');
   return {passed:true,workerSamples:60,elapsedSeconds:1200,automaticDecisions:400,mainMirrorCalls:calls.length,pendingAckGuard:true,explicitReplayParity:true,resetParity:true};
  }finally{view.dispose();}
 });
 assert.deepEqual(errors,[]);await fs.writeFile('test-results/native-workout-lazy-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
