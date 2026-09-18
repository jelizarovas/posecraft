import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';
import {createBenchAction3D} from '../src/bench-action-3d.js';
const bytes=await fs.readFile('public/assets/native-3d/athlete.glb'),loader=new GLTFLoader();
loader.register(()=>({name:'headless-textures',loadTexture:async()=>new Texture()}));
const character=createCharacter3D(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{height:1.75});
const results=[];
try{
 for(const count of [1,4,16]){
  const actions=Array.from({length:count},(_,i)=>createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench:{position:[i*3,0,0],rotation:[0,0,0,1],scale:1,rackHeight:1},settings:{reps:3,effort:.6}})),samples=[];
  let maxError=0;
  for(let step=-30;step<120;step++){
   const at=((step+30)%120)/120*actions[0].duration,start=performance.now();
   for(const action of actions){const frame=action.sample(at);for(const d of frame.diagnostics){maxError=Math.max(maxError,d.error);if(d.maxStretch!==1)throw Error('A sampled chain stretched.');}}
   if(step>=0)samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);results.push({actors:count,jointsPerActor:character.rig.joints.length,samples:samples.length,medianMs:samples[60],p95Ms:samples[114],maxContactErrorMeters:maxError});
 }
 const report={scope:'Headless authored-rig motion only. No rendering, image decode, worker transfer, collision physics or phone measurement.',node:process.version,platform:process.platform,results};
 await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/native-bench-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{character.dispose();}
