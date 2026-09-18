import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5200').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 // A same-origin JSON document avoids booting an unrelated Studio application.
 await page.goto(base+'/package.json');
 const report=await page.evaluate(async()=>{
  const [{createNativeActionClient},{createBenchAction3D},{loadCharacter3D}]=await Promise.all([import('/src/native-action-worker-client.js'),import('/src/bench-action-3d.js'),import('/src/gltf-character-3d.js')]);
  const character=await loadCharacter3D('/assets/native-3d/athlete.glb',{height:1.8}),config={rig:character.rig,roles:character.roles,grips:character.grips,bench:{position:[0,0,0],rotation:[0,0,0,1],scale:1},settings:{reps:3,effort:.8}},action=createBenchAction3D(config),client=createNativeActionClient(new Worker('/src/native-action-worker.js',{type:'module'}));
  const same=(a,b,message)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(message);},check=(yes,message)=>{if(!yes)throw Error(message);};
  try{
   await client.configure(config);
   const times=[0,1.2,...action.beats.map(b=>(b.start+b.end)/2),action.duration];
   for(const t of times)same(await client.sample(t),action.sample(t),'Worker frame differs at '+t);
   const coalesced=await Promise.allSettled(Array.from({length:25},(_,i)=>client.sample(i/20)));
   check(coalesced[0].status==='fulfilled'&&coalesced.at(-1).status==='fulfilled','First/latest samples did not complete');
   check(coalesced.slice(1,-1).every(r=>r.status==='rejected'&&r.reason.name==='AbortError'),'Queued samples were not coalesced');
   const stale=client.sample(8).then(()=>({ok:true}),e=>({name:e.name})),next=structuredClone(config);next.bench.position=[1,.1,-2];next.bench.rotation=[0,Math.SQRT1_2,0,Math.SQRT1_2];
   await client.configure(next);check((await stale).name==='AbortError','Previous project sample was accepted');
   same(await client.sample(15),createBenchAction3D(next).sample(15),'New project uses stale configuration');
   await client.configure(config);
   const beat=action.beats.find(b=>b.id==='press-2'),at=(beat.start+beat.end)/2,recovery=action.interrupt(at),result=await client.finishSafely(at);
   check(result.supported&&result.duration===recovery.duration,'Recovery duration differs');
   for(const t of [0,.5,result.duration/2,result.duration])same(await client.sample(t),recovery.sample(t),'Recovery frame differs');
   await client.reset();same(await client.sample(at),action.sample(at),'Reset did not restore source timeline');
   const bad=structuredClone(config);bad.bench.rackHeight=1.9;
   let reason='';try{await client.configure(bad);}catch(e){reason=e.message;}check(/outside.*reach/i.test(reason),'Configuration error was not preserved');
   await client.configure(config);same(await client.sample(0),action.sample(0),'Could not recover from configuration failure');
   const pending=client.sample(1).catch(e=>({name:e.name}));client.dispose();check((await pending).name==='AbortError','Dispose did not cancel sample');
   return {passed:true,paritySamples:times.length,coalescedRequests:25,generationCancellation:true,safeRecovery:true,reset:true,errorRecovery:true,dispose:true};
  }finally{client.dispose();character.dispose();}
 });
 assert.deepEqual(errors,[]);await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/native-action-worker.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
