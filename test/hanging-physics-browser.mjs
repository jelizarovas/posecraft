import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5231').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/demos.html#gym-routine');await page.waitForFunction(()=>window.posecraftWorkout?.view?.frame);
 const report=await page.evaluate(async()=>{
  const w=posecraftWorkout;w.pause();let beats;
  for(let i=0;i<4;i++){beats=w.view.action.beats;if(beats.some(b=>b.id==='one-hand-entry'))break;w.view.render(beats.at(-1).end+.001);}
  const beat=beats.find(b=>b.id==='one-hand-entry');if(!beat)throw Error('No one-hand entry');
  const frames=[.05,.5,.95].map(u=>w.view.render(beat.start+(beat.end-beat.start)*u));
  const at=beat.start+(beat.end-beat.start)*.5,expected=w.view.render(at);w.view.render(0);w.view.renderAsync(at);
  for(let i=0;i<1200&&w.view.frame.time!==at;i++)await new Promise(r=>setTimeout(r,5));
  if(JSON.stringify(w.view.frame)!==JSON.stringify(expected))throw Error('Worker and local hanging dynamics diverged');
  return frames.map(f=>({valid:f.valid,physics:f.physics,grips:f.contacts.filter(c=>c.id.endsWith('Arm')).map(c=>c.error)}));
 });
 assert.ok(report.every(f=>f.valid&&f.physics.active&&f.grips.length===1&&f.grips[0]<1e-6));
 assert.ok(Math.abs(report[0].physics.velocity[0])>.1,'Catch retains angular momentum');
 assert.ok(report[0].physics.velocity[0]*report[2].physics.velocity[0]<0,'Hips overshoot and return');
 assert.ok(report.some(f=>Math.abs(f.physics.legAngle[0]-f.physics.angle[0])>.05),'Legs lag independently');
 assert.ok(report.some(f=>Math.abs(f.physics.armVelocity[0])>.05),'Free arm has independent momentum');
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/hanging-physics-live.png'});
 assert.deepEqual(errors,[]);console.log('Hanging physics: fixed grip, catch momentum, overshoot, passive limbs and worker replay passed.');
}finally{await browser.close();}
