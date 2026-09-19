import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {assertWorkoutProject3D} from '../src/workout-project-3d.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5230').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await fs.mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
 await page.goto(base+'/demos.html#gym-routine');await page.waitForFunction(()=>window.posecraftWorkout?.view?.frame);
 assert.equal(await page.locator('#demo-scrub').isHidden(),true);assert.match(await page.locator('#edit-demo').getAttribute('href'),/native-studio.html\?demo=gym-routine/);
 const start=await page.evaluate(()=>({frame:posecraftWorkout.view.frame,manifest:posecraftWorkout.game.describe(),worker:posecraftWorkout.view.stats().motionWorker}));
 assert.equal(start.worker,true);assert.equal(start.frame.valid,true);assert.ok(start.manifest.actors[0].actions.includes('bench'));
 await page.screenshot({path:'test-results/workout-gallery-start.png'});
 const trace=await page.evaluate(async()=>{posecraftWorkout.pause();const out=[];for(let t=0;t<=240;t+=.5){const f=await posecraftWorkout.advance(.5);out.push({time:f.time,activity:f.workout.activity,phase:f.phase,valid:f.valid,stats:f.workout.stats});}return out;});
 assert.ok(trace.some(f=>f.activity==='pullup'));assert.ok(trace.some(f=>f.activity==='bench'));assert.ok(trace.some(f=>f.activity==='walk'));assert.ok(trace.every(f=>f.valid),JSON.stringify(trace.find(f=>!f.valid)));
 assert.ok(trace.every(f=>f.stats.mechanicalFailures===0));await page.screenshot({path:'test-results/workout-gallery-later.png'});
 const downloadEvent=page.waitForEvent('download');await page.locator('#download-demo').click();const download=await downloadEvent,data=assertWorkoutProject3D(JSON.parse(await fs.readFile(await download.path(),'utf8')));assert.deepEqual(data.workout.sequence,['pullup','bench']);
 await page.locator('#demo-reset').click();await page.waitForFunction(()=>posecraftWorkout.time===0);await page.locator('#gym-thirsty').click();await page.waitForFunction(()=>posecraftWorkout.view.frame.workout.stats.dehydration>=80);await page.locator('#demo-play').click();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-results/workout-gallery-mobile.png'});
 await page.goto(base+'/demos.html?legacy=1#gym-routine');await page.locator('#gym-grip-review').waitFor();assert.equal(await page.locator('#demo-art svg').count(),1);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,nativeGallery:true,worker:true,wholeWorkout:true,portableProject:true,legacyComparison:true,mobile:true}));
}finally{await browser.close();}
