import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {compileScene3D} from '../src/scene-3d.js';
import {createBenchContact3D} from '../examples/bench-contact-3d.js';

// This measures independent headless rig/contact evaluation only. There are no
// meshes, renderer, physics, interactions, worker transfers or collision checks.
const results=[];
for(const count of [1,4,16]){
 const document=createBenchContact3D(),actor=document.actors[0],contacts=document.contacts;
 document.actors=Array.from({length:count},(_,i)=>({...structuredClone(actor),id:'person-'+i}));
 document.contacts=document.actors.flatMap(a=>contacts.map(c=>({...structuredClone(c),id:c.id+'-'+a.id,actor:a.id})));
 const start=performance.now(),scene=compileScene3D(document),compileMs=performance.now()-start;
 for(let i=0;i<100;i++)scene.evaluate();
 const timings=[];let maximumContactError=0;
 for(let i=0;i<300;i++){
  const start=performance.now(),frame=scene.evaluate();timings.push(performance.now()-start);
  maximumContactError=Math.max(maximumContactError,...frame.contacts.map(c=>c.error));
 }
 timings.sort((a,b)=>a-b);
 results.push({actors:count,contacts:count*2,compileMs,medianMs:timings[150],p95Ms:timings[284],maximumContactError});
}
const report={node:process.version,platform:process.platform,architecture:process.arch,warmup:100,samples:300,scope:'Independent headless skeleton and contact evaluation. This is not a renderer, complete scene, phone or battery benchmark.',results};
await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/native-3d-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
