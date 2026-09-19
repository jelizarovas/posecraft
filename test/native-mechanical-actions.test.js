import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Texture,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';
import {createBenchAction3D} from '../src/bench-action-3d.js';
import {createPullupAction3D} from '../src/pullup-action-3d.js';
import {createLocomotionAction3D} from '../src/locomotion-action-3d.js';
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
async function character(asset){const bytes=await fs.readFile(new URL('../public/assets/native-3d/'+asset+'.glb',import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'textureless-test',loadTexture:async()=>new Texture()}));return createCharacter3D(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{height:1.75});}
function checkFrame(frame,rig){assert.equal(frame.valid,true,JSON.stringify({time:frame.time,phase:frame.phase,errors:frame.diagnostics.filter(d=>d.status!=='solved')}));for(const d of frame.diagnostics){const chain=rig.chains[d.chain],a=frame.world[chain.root].position,b=frame.world[chain.middle].position,c=frame.world[chain.tip].position;assert.ok(Math.abs(distance(a,b)-d.boneLengths[0])<1e-7);assert.ok(Math.abs(distance(b,c)-d.boneLengths[1])<1e-7);assert.equal(d.maxStretch,1);assert.ok(d.error<1e-6);}}
for(const asset of ['athlete','regular']){
 test(asset+' pull-up has fixed grips, bent elbows, lifted feet and deterministic controlled failure',async()=>{const c=await character(asset);try{const action=createPullupAction3D({...c,bar:{position:[-2.2,2.25,0]},settings:{reps:3,failedRep:3,effort:.8}}),before=JSON.stringify(c.rig);let maximum=0,minimumBend=Infinity,contacts=0;
  for(let i=0;i<=Math.ceil(action.duration*60);i++){const f=action.sample(Math.min(action.duration,i/60));checkFrame(f,c.rig);assert.equal('bar' in f,false);maximum=Math.max(maximum,f.placement.position[1]);for(const d of f.contacts.filter(d=>d.id.endsWith('Arm'))){contacts++;assert.ok(distance(d.target.position,action.measurements.gripTargets[d.id.startsWith('left')?'left':'right'].position)<1e-9);minimumBend=Math.min(minimumBend,distance(f.world[c.rig.chains[d.chain].root].position,d.actual.position)/(d.boneLengths[0]+d.boneLengths[1]));}if(f.phase==='hang')for(const side of ['left','right'])assert.ok(f.world[c.rig.chains[side+'Leg'].tip].position[1]>.3);}
  assert.ok(contacts>100);assert.ok(minimumBend<.65);assert.ok(maximum>.65);assert.deepEqual(action.sample(2),action.sample(2));assert.equal(JSON.stringify(c.rig),before);assert.deepEqual(action.sample(0).pose,action.sample(action.duration).pose);assert.equal(action.sample(action.beats.find(b=>b.failed).start+.5).outcome.success,false);assert.throws(()=>createPullupAction3D({...c,bar:{position:[0,4,0]}}),/jump/);
 }finally{c.dispose();}});
 test(asset+' routed walking preserves exact bench joins, fixed stance contacts and segment continuity',async()=>{const c=await character(asset);try{const bench=createBenchAction3D({...c,bench:{position:[0,0,0],rotation:[0,0,0,1],scale:1},settings:{reps:1}}),from=bench.sample(bench.duration),pull=createPullupAction3D({...c,bar:{position:[-2.2,2.25,0]},settings:{reps:1}}),action=createLocomotionAction3D({...c,from:from.placement,to:pull.standingPlacement,settings:{fromPose:from.pose,toPose:pull.standingPose,waypoints:[{x:0,z:1.4},{x:-.7,z:1.4},{x:-.7,z:-.23}]}});assert.deepEqual(action.sample(0).pose,structuredClone(from.pose));assert.deepEqual(action.sample(0).placement,from.placement);assert.deepEqual(action.sample(action.duration).pose,structuredClone(pull.standingPose));assert.deepEqual(action.sample(action.duration).placement,pull.standingPlacement);
 let previous=null,planted=0;for(let i=0;i<=Math.ceil(action.duration*60);i++){const f=action.sample(Math.min(action.duration,i/60));checkFrame(f,c.rig);if(previous){for(const d of f.contacts){const last=previous.contacts.find(x=>x.id===d.id);if(last&&distance(last.target.position,d.target.position)<1e-8){assert.ok(distance(last.actual.position,d.actual.position)<1e-6);planted++;}}}previous=f;}
 assert.ok(planted>100);for(const beat of action.beats.filter(b=>b.id.endsWith('arrive'))){const a=action.sample(Math.max(0,beat.end-1e-5)),b=action.sample(Math.min(action.duration,beat.end+1e-5));for(const id of Object.keys(a.world))assert.ok(distance(a.world[id].position,b.world[id].position)<.001,id+' boundary jump');}
 assert.throws(()=>createLocomotionAction3D({...c,from:from.placement,to:{...pull.standingPlacement,scale:2}}),/scale/);
 }finally{c.dispose();}});
}

for(const asset of ['athlete','regular'])test(asset+' one-hand transfers retain contacts, lean below the loaded arm, and rejoin smoothly',async()=>{
 const c=await character(asset);try{
  const turn=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.63),bar={position:[1.2,2.25,-.8],rotation:turn.toArray()};
  for(const variation of ['left-lead','right-lead']){
   const action=createPullupAction3D({...c,bar,settings:{reps:3,failedRep:3,effort:.9,variation,restBetweenReps:true}});let oneHand=0,asymmetric=0;
   for(let t=0;t<=action.duration;t+=1/30){
    const frame=action.sample(t);checkFrame(frame,c.rig);
    const armContacts=frame.contacts.filter(d=>d.id.endsWith('Arm'));
    for(const d of armContacts)assert.ok(distance(d.actual.position,action.measurements.gripTargets[d.id.startsWith('left')?'left':'right'].position)<1e-6);
    if(['one-hand-entry','one-hand-rest','one-hand-exit'].includes(frame.phase)){
     oneHand++;assert.equal(armContacts.length,1);assert.equal(armContacts[0].id,frame.hang.side+'Arm');
     const hip=new Vector3(...frame.world[c.roles.pelvis].position),shoulder=new Vector3(...frame.world[c.rig.chains[frame.hang.side+'Arm'].root].position),offset=hip.sub(shoulder).applyQuaternion(turn.clone().invert());
     // Torso descends toward the supporting hand rather than leaning away from it.
     assert.ok(Math.sign(frame.hang.lean)===(frame.hang.side==='left'?1:-1));assert.ok(Math.abs(offset.x)<.2);
    }
    if(frame.exertion.intensity>.4&&Math.abs(frame.exertion.left-frame.exertion.right)>.03)asymmetric++;
   }
   assert.ok(oneHand>30);assert.ok(asymmetric>10);
   for(const beat of action.beats){const before=action.sample(Math.max(0,beat.end-1e-6)),after=action.sample(Math.min(action.duration,beat.end+1e-6));for(const id of Object.keys(before.world))assert.ok(distance(before.world[id].position,after.world[id].position)<.001,beat.id+' '+id+' jumps');}
   const pulls=action.beats.filter(b=>b.rep);assert.ok(new Set(pulls.map(b=>(b.end-b.start).toFixed(3))).size>1);
  }
  assert.throws(()=>createPullupAction3D({...c,bar,settings:{variation:'unknown'}}),/variation/);
 }finally{c.dispose();}
});
