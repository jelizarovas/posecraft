import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';
import {createBenchAction3D} from '../src/bench-action-3d.js';

// Compare the same choreography with full FK versus sparse chain FK. The
// temporary control module is generated from current source, not maintained as
// a second implementation. This measures Node CPU sampling, not drawing/GPU.
await fs.mkdir('test-results',{recursive:true});
const source=await fs.readFile(new URL('../src/bench-action-3d.js',import.meta.url),'utf8');
if(!source.includes("world:'chain'"))throw new Error('Sparse solver call sites are missing.');
const control=source.replaceAll("from './","from '../src/").replaceAll("world:'chain'","world:'full'"),controlPath=path.resolve('test-results/bench-action-full-fk-control.mjs');
await fs.writeFile(controlPath,control);
const {createBenchAction3D:createFull}=await import(pathToFileURL(controlPath).href+'?run='+Date.now());
const summary=times=>{const sorted=times.toSorted((a,b)=>a-b);return {medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],samples:times.length};};
const report={runtime:process.version,platform:process.platform,scope:'CPU action sampling only; no rendering, worker transfer, GPU or phone measurement',warmupSamples:80,timedSamplesPerMode:600,models:{}};
for(const name of ['athlete','regular']){
 const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-textures',loadTexture:async()=>new Texture()}));
 const bytes=await fs.readFile(new URL('../public/assets/native-3d/'+name+'.glb',import.meta.url));
 const character=createCharacter3D(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{height:1.8});
 try{
  const config={rig:character.rig,roles:character.roles,grips:character.grips,bench:{position:[0,0,0],rotation:[0,0,0,1],scale:1}},full=createFull(config),sparse=createBenchAction3D(config),timings={full:[],sparse:[]};
  for(let i=0;i<80;i++){const t=sparse.duration*i/80;full.sample(t);sparse.sample(t);}
  let parity=0;
  for(let round=0;round<3;round++)for(let i=0;i<200;i++){
   const t=sparse.duration*i/199,order=(round+i)%2?['sparse','full']:['full','sparse'],frames={};
   for(const mode of order){const start=performance.now();frames[mode]=(mode==='full'?full:sparse).sample(t);timings[mode].push(performance.now()-start);}
   if(JSON.stringify(frames.full)!==JSON.stringify(frames.sparse))throw new Error(`${name}: full/sparse frame mismatch at ${t}`);parity++;
  }
  const a=summary(timings.full),b=summary(timings.sparse);report.models[name]={bones:character.metadata.bones,full:a,sparse:b,medianSpeedRatio:a.medianMs/b.medianMs,exactFrameComparisons:parity};
 }finally{character.dispose();}
}
await fs.writeFile('test-results/bench-action-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
