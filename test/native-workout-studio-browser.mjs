import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5230').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);
await page.routeWebSocket('**',socket=>socket.close());
const ready=()=>page.waitForFunction(()=>window.posecraftNativeStudio?.snapshot().ready),snapshot=()=>page.evaluate(()=>posecraftNativeStudio.snapshot());
const edit=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');await ready();};
try{
 await page.goto(base+'/package.json');
 const parity=await page.evaluate(async()=>{
  const [{createNativeActionClient},{createWorkout3D},{createWorkoutProject3D},{loadCharacter3D}]=await Promise.all([import('/src/native-action-worker-client.js'),import('/src/workout-3d.js'),import('/src/workout-project-3d.js'),import('/src/gltf-character-3d.js')]);
  const character=await loadCharacter3D('/assets/native-3d/athlete.glb',{height:1.75}),project=createWorkoutProject3D(),config={rig:character.rig,roles:character.roles,grips:character.grips,project},action=createWorkout3D(config),client=createNativeActionClient(new Worker('/src/native-action-worker.js',{type:'module'}));
  const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Workout worker parity: '+label);};let count=0;
  const at=async time=>{same(await client.sample(time),action.sample(time),'time '+time);count++;};
  try{
   await client.configure(config);for(const time of [0,.4,3,9,20])await at(time);
   action.setVariable('fatigue',84);await client.setVariable('fatigue',84,20);
   const request=action.request('drink',{request:'browser-water',target:'bottle'});same(await client.request('drink',{request:'browser-water',target:'bottle'},20),request,'caller ID');await at(20.1);
   action.cancel(request);await client.cancel(request,20.1);await at(21);
   action.interrupt(21);await client.finishSafely(21);await at(29);
   action.reset();await client.reset();for(const time of [0,6,25,60,90,140,2,25])await at(time);
   return {samples:count,commands:true,replay:true,reset:true};
  }finally{client.dispose();character.dispose();}
 });
 await page.goto(base+'/native-studio.html?demo=gym-routine');await ready();await page.locator('#loading').waitFor({state:'hidden'});
 if((await snapshot()).playing)await page.locator('#play').click();
 assert.equal((await snapshot()).project.kind,'workout3d');assert.equal(await page.locator('#time').isVisible(),false);
 await edit('project-name','Portable workout');await page.locator('[data-section=action]').click();
 await edit('workout-reps-min',4);assert.equal((await snapshot()).project.workout.reps.min,4);await page.locator('#undo').click();await ready();assert.equal((await snapshot()).project.workout.reps.min,6);await page.locator('#redo').click();await ready();assert.equal((await snapshot()).project.workout.reps.min,4);
 await page.locator('#workout-sequence').selectOption('bench,pullup');await ready();assert.deepEqual((await snapshot()).project.workout.sequence,['bench','pullup']);
 await edit('workout-rest-threshold',58);await edit('workout-drink-threshold',40);
 await page.locator('[data-section=bottle]').click();await edit('bottle-position-1',1.12);assert.equal((await snapshot()).project.bottle.position[1],1.12);
 await page.locator('[data-section=bench]').click();await edit('bench-position-0',.2);await edit('bench-yaw',10);assert.ok((await snapshot()).project.bench.rotation[1]>0);
 await page.locator('[data-section=character]').click();await page.locator('#character-asset').selectOption('regular');await ready();assert.equal((await snapshot()).project.character.asset,'regular');
 await page.locator('[data-section=action]').click();await page.locator('[data-request=rest]').click();await page.waitForFunction(()=>posecraftNativeStudio.snapshot().frame?.workout?.queued?.action==='rest');if((await snapshot()).playing)await page.locator('#play').click();
 const saved=(await snapshot()).project,download=page.waitForEvent('download');await page.locator('#save').click();const file=await download;assert.deepEqual(JSON.parse(await fs.readFile(await file.path(),'utf8')),saved);
 await page.reload();await ready();assert.deepEqual((await snapshot()).project,saved);if((await snapshot()).playing)await page.locator('#play').click();
 await page.locator('[data-section=action]').click();await page.screenshot({path:'test-results/native-workout-studio-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok((await page.locator('#native-canvas').boundingBox()).height>80);await page.screenshot({path:'test-results/native-workout-studio-mobile.png'});
 const workoutJSON=Buffer.from(JSON.stringify(saved));const bench={kind:'bench-study3d',version:saved.version,name:'Bench compatibility',character:saved.character,bench:saved.bench,camera:saved.camera,settings:saved.settings};
 await page.locator('#project-file').setInputFiles({name:'bench.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bench))});await ready();assert.equal((await snapshot()).project.kind,'bench-study3d');assert.ok(await page.locator('#time').isVisible());
 await page.locator('#project-file').setInputFiles({name:'workout.json',mimeType:'application/json',buffer:workoutJSON});await ready();assert.deepEqual((await snapshot()).project,saved);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,parity,studioUndoReload:true,kindSwitch:true,mobile:true}));
}finally{await browser.close();}
