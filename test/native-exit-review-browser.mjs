import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createBenchProject3D} from '../src/bench-project-3d.js';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5220').replace(/\/$/,''),directory='test-results/native-exit-review';
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),reports=[];
try{
 for(const asset of ['athlete','regular'])for(const camera of ['front','side']){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),project=createBenchProject3D();project.character.asset=asset;project.camera={position:camera==='front'?[0,1.2,5]:[5,1.2,0],target:[0,.8,0],height:2.6};
  await context.addInitScript(project=>localStorage.setItem('posecraft.native3d.v1',JSON.stringify(project)),project);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
  await page.goto(base+'/native-studio.html');await page.waitForFunction(()=>window.posecraftNativeStudio?.snapshot().ready);
  const initial=await page.evaluate(()=>posecraftNativeStudio.snapshot()),start=initial.beats.find(beat=>beat.id==='release').start,end=initial.duration;
  assert.ok(end>start);for(const id of ['sit-up','scoot-forward','stand'])assert.ok(initial.beats.some(beat=>beat.id===id));
  const seek=async time=>{const at=Math.floor(time*100)/100;await page.locator('#time').fill(String(at));await page.locator('#time').dispatchEvent('input');await page.waitForFunction(at=>Math.abs(posecraftNativeStudio.snapshot().frame.time-at)<.015,at);return page.evaluate(()=>posecraftNativeStudio.snapshot());};
  await seek(start);
  await page.evaluate(()=>{
   const stream=document.querySelector('#native-canvas').captureStream(30),chunks=[],mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
   const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2500000});
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   window.finishExitRecording=()=>new Promise(resolve=>{recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(binary));};recorder.stop();});recorder.start(1000);
  });
  await page.locator('#play').click();await page.waitForFunction(()=>posecraftNativeStudio.snapshot().frame.phase==='complete',null,{timeout:Math.max(60000,(end-start)*4000)});
  await fs.writeFile(`${directory}/${asset}-${camera}.webm`,Buffer.from(await page.evaluate(()=>finishExitRecording()),'base64'));
  const samples=[];
  for(let i=0;i<24;i++){
   const state=await seek(start+(end-start-.02)*i/23);assert.ok(state.frame.valid,`${asset}/${camera}/${state.frame.phase} is invalid`);
   for(const contact of state.frame.contacts)assert.ok(contact.error<.003,`${contact.id} contact residual ${contact.error}`);
   await page.locator('#native-canvas').screenshot({path:`${directory}/${asset}-${camera}-${String(i).padStart(2,'0')}.png`});
   samples.push({index:i,time:state.frame.time,phase:state.frame.phase,scoot:state.frame.scoot,placement:state.frame.placement,contacts:state.frame.contacts.map(({id,error,active})=>({id,error,active}))});
  }
  assert.deepEqual(errors,[]);reports.push({asset,camera,start,end,samples});await context.close();
 }
 await fs.writeFile(`${directory}/report.json`,JSON.stringify({base,reviews:reports},null,2));console.log(JSON.stringify({passed:true,reviews:reports.map(({asset,camera,start,end})=>({asset,camera,start,end}))}));
}finally{await browser.close();}
