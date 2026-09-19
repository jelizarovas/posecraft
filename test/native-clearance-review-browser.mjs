import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createBenchProject3D} from '../src/bench-project-3d.js';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5220').replace(/\/$/,''),directory='test-results/native-clearance-review';
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),reports=[];
try{
 for(const asset of ['athlete','regular'])for(const camera of ['oblique','side'])for(const sequence of ['entry','exit']){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),project=createBenchProject3D();project.character.asset=asset;project.camera={position:camera==='oblique'?[3,2.2,3.4]:[5,1.2,0],target:[0,.8,0],height:2.6};
  await context.addInitScript(project=>localStorage.setItem('posecraft.native3d.v1',JSON.stringify(project)),project);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
  await page.goto(base+'/native-studio.html');await page.waitForFunction(()=>window.posecraftNativeStudio?.snapshot().ready);
  const initial=await page.evaluate(()=>posecraftNativeStudio.snapshot()),start=initial.beats.find(beat=>beat.id===(sequence==='entry'?'recline':'release')).start,end=initial.beats.find(beat=>beat.id===(sequence==='entry'?'grip':'sit-up')).end;
  assert.ok(end>start);for(const id of ['sit-up','scoot-forward','stand'])assert.ok(initial.beats.some(beat=>beat.id===id));
  const seek=async time=>{const at=Math.floor(time*100)/100;await page.locator('#time').fill(String(at));await page.locator('#time').dispatchEvent('input');await page.waitForFunction(at=>Math.abs(posecraftNativeStudio.snapshot().frame?.time-at)<.015,at);return page.evaluate(()=>posecraftNativeStudio.snapshot());};
  await seek(start);
  await page.evaluate(()=>{
   const stream=document.querySelector('#native-canvas').captureStream(30),chunks=[],mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
   const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2500000});
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   window.finishExitRecording=()=>new Promise(resolve=>{recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(binary));};recorder.stop();});recorder.start(1000);
  });
  await page.locator('#play').click();await page.waitForFunction(end=>posecraftNativeStudio.snapshot().frame?.time>=end,end,{timeout:Math.max(60000,(end-start)*4000)});await page.locator('#play').click();
  await fs.writeFile(`${directory}/${asset}-${camera}-${sequence}.webm`,Buffer.from(await page.evaluate(()=>finishExitRecording()),'base64'));
  const samples=[];
  for(let i=0;i<24;i++){
   const state=await seek(start+(end-start-.02)*i/23);
   
   await page.locator('#native-canvas').screenshot({path:`${directory}/${asset}-${camera}-${sequence}-${String(i).padStart(2,'0')}.png`});
   samples.push({index:i,time:state.frame.time,phase:state.frame.phase,valid:state.frame.valid,clearance:state.frame.clearance,support:state.frame.support,scoot:state.frame.scoot,placement:state.frame.placement,contacts:state.frame.contacts.map(({id,error,active})=>({id,error,active}))});
  }
  assert.deepEqual(errors,[]);reports.push({asset,camera,sequence,start,end,samples});await context.close();
 }
 await fs.writeFile(`${directory}/report.json`,JSON.stringify({base,reviews:reports},null,2));for(const review of reports)for(const sample of review.samples){assert.equal(sample.valid,true,`${review.asset}/${review.camera}/${review.sequence}@${sample.time} invalid pose`);for(const contact of sample.contacts)assert.ok(contact.error<.003,`${review.asset}/${review.sequence}@${sample.time} ${contact.id}: ${contact.error}`);}console.log(JSON.stringify({passed:true,reviews:reports.map(({asset,camera,sequence,start,end,samples})=>({asset,camera,sequence,start,end,invalid:samples.filter(s=>!s.valid).length}))}));
}finally{await browser.close();}
