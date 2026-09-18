import test from 'node:test';
import assert from 'node:assert/strict';
import {createBenchAction3D} from '../src/bench-action-3d.js';
import fs from 'node:fs/promises';
import {Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';

const I=[0,0,0,1],distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function humanoid(scale=1){
 const joint=(id,parent,p)=>({id,parent,position:p.map(v=>v*scale),rotation:[...I]}),joints=[joint('origin',null,[0,0,0]),joint('hips','origin',[0,.95,0]),joint('chest','hips',[0,.40,0]),joint('head','chest',[0,.24,0])],chains={};
 for(const [side,sign]of [['left',1],['right',-1]]){
  joints.push(joint(side+'-shoulder','chest',[sign*.2,0,0]),joint(side+'-elbow',side+'-shoulder',[0,-.3,0]),joint(side+'-hand',side+'-elbow',[0,-.28,0]));
  joints.push(joint(side+'-hip','hips',[sign*.1,-.08,0]),joint(side+'-knee',side+'-hip',[0,-.42,0]),joint(side+'-ankle',side+'-knee',[0,-.41,0]));
  chains[side+'Arm']={root:side+'-shoulder',middle:side+'-elbow',tip:side+'-hand',pole:[sign,0,1],bend:{min:0,max:2.8}};
  chains[side+'Leg']={root:side+'-hip',middle:side+'-knee',tip:side+'-ankle',pole:[sign*.1,0,1],bend:{min:0,max:2.8}};
 }
 return {rig:{joints,chains},roles:{pelvis:'hips'},bench:{position:[0,0,0],rotation:[...I],scale:1}};
}
test('native bench action is deterministic and preserves every segment through the complete sequence',()=>{
 const source=humanoid(),before=JSON.stringify(source),action=createBenchAction3D(source),seen=new Set();let worst={error:0};
 for(let i=0;i<=Math.ceil(action.duration*30);i++){
  const frame=action.sample(Math.min(action.duration,i/30));seen.add(frame.phase);
  for(const d of frame.diagnostics){
   const chain=source.rig.chains[d.chain],a=frame.world[chain.root].position,b=frame.world[chain.middle].position,c=frame.world[chain.tip].position;
   const expected=d.id.endsWith('Arm')?[.3,.28]:[.42,.41];
   assert.ok(Math.abs(distance(a,b)-expected[0])<1e-7);assert.ok(Math.abs(distance(b,c)-expected[1])<1e-7);assert.equal(d.maxStretch,1);
   assert.ok([...a,...b,...c,d.error].every(Number.isFinite));if(d.error>worst.error)worst={time:frame.time,phase:frame.phase,id:d.id,error:d.error};
  }
 }
 assert.deepEqual([...seen],['approach','plant','sit','recline','grip','unrack','press','rerack','release','rise','complete']);
 assert.deepEqual(action.sample(7.125),action.sample(7.125));assert.equal(JSON.stringify(source),before);
 assert.ok(worst.error<1e-7,JSON.stringify(worst));
});

test('bench translation and yaw transform the entire action without changing its geometry',()=>{
 const source=humanoid(),original=createBenchAction3D(source),yaw=Math.PI/2;
 const moved=createBenchAction3D({...source,bench:{position:[2,.2,-3],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],scale:1}});
 for(const t of [0,1.4,5,8,12,17,original.duration]){
  const a=original.sample(t),b=moved.sample(t);
  for(const id of Object.keys(a.world)){const [x,y,z]=a.world[id].position;assert.ok(distance(b.world[id].position,[2+z,.2+y,-3-x])<1e-7);}
  assert.ok(b.diagnostics.every(d=>d.status==='solved'));assert.equal(b.phase,a.phase);
 }
});

test('bar rests on declared equipment and repetition effort changes timing without contact slip',()=>{
 const action=createBenchAction3D({...humanoid(),settings:{reps:4,effort:1}}),presses=action.beats.filter(b=>b.rep);
 assert.equal(presses.length,4);assert.ok(presses[3].end-presses[3].start>presses[0].end-presses[0].start);
 assert.deepEqual(action.sample(0).bar.position,[0,1,-.5]);assert.deepEqual(action.sample(action.duration).bar.position,[0,1,-.5]);
 for(const beat of presses)for(let i=0;i<=20;i++){
  const frame=action.sample(beat.start+(beat.end-beat.start)*i/20);
  for(const c of frame.contacts.filter(d=>d.id.endsWith('Arm'))){assert.equal(c.status,'solved');assert.ok(c.error<1e-7);assert.equal(c.maxStretch,1);}
 }
});

test('safe interruption preserves its initial pose and completes the held segment before reracking',()=>{
 const action=createBenchAction3D(humanoid());
 assert.equal(action.interrupt(1).supported,false);
 for(const id of ['grip','unrack','press-1','press-2','rerack','release','rise']){
  const beat=action.beats.find(b=>b.id===id),at=beat.start+(beat.end-beat.start)*.57,stop=action.interrupt(at);
  assert.equal(stop.supported,true);assert.deepEqual(stop.sample(0),action.sample(at));assert.equal(stop.sample(stop.duration).phase,'complete');
  let prior=stop.sample(0);
  for(let t=1/60;t<=stop.duration;t+=1/60){const next=stop.sample(t);for(const id of Object.keys(prior.world))assert.ok(distance(prior.world[id].position,next.world[id].position)<.055,`Interruption jump ${id} at ${t}`);assert.ok(next.contacts.every(c=>c.status==='solved'));prior=next;}
 }
});

test('bad equipment fit is explicit and authored bend limits produce residuals without stretching',()=>{
 const source=humanoid();assert.throws(()=>createBenchAction3D({...source,bench:{...source.bench,rackHeight:1.7}}),/outside.*reach/i);
 assert.throws(()=>createBenchAction3D({...source,bench:{...source.bench,scale:2}}),/too high/i);
 assert.throws(()=>createBenchAction3D({...source,bench:{...source.bench,rotation:[Math.SQRT1_2,0,0,Math.SQRT1_2]}}),/level/i);
 const constrained=createBenchAction3D({...source,settings:{elbowMax:30,kneeMax:30}}),frame=constrained.sample(constrained.beats.find(b=>b.id==='press-1').start+1.3);
 assert.equal(frame.valid,false);assert.ok(frame.diagnostics.some(d=>d.status==='limited'&&d.error>.01));assert.ok(frame.diagnostics.every(d=>d.maxStretch===1));
});

test('bench action rejects overlapping chains and mutable ancestors before sparse solving',()=>{
 const overlap=humanoid();overlap.rig.chains.rightArm=structuredClone(overlap.rig.chains.leftArm);
 assert.throws(()=>createBenchAction3D(overlap),/independent, disjoint limb chains/);
 const descendant=humanoid();descendant.rig.joints.find(j=>j.id==='right-shoulder').parent='left-hand';
 assert.throws(()=>createBenchAction3D(descendant),/independent, disjoint limb chains/);
 const invalidGrip=humanoid();invalidGrip.grips={left:{joint:'left-hand',position:[0,0,0],rotation:I,fingers:[{joint:'right-shoulder',axis:[1,0,0],angle:1}]}};
 assert.throws(()=>createBenchAction3D(invalidGrip),/finger joints must descend/);
});

// Texture decoding is irrelevant to skeleton geometry. Preserve the actual
// authored joints, mesh bounds and weights while supplying lightweight textures.
async function imported(file){
 const loader=new GLTFLoader();loader.register(()=>({name:'unit-test-textures',loadTexture:async()=>new Texture()}));
 const bytes=await fs.readFile(new URL('../public/assets/native-3d/'+file+'.glb',import.meta.url));
 return createCharacter3D(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{height:1.8});
}
function rotate(v,q){const [x,y,z,w]=q,t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];}
test('both authored characters keep physical palm grips and clear the bench base with their feet',async()=>{
 for(const file of ['athlete','regular']){
  const character=await imported(file);
  try{
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench:{position:[0,0,0],rotation:I,scale:1}});
   let prior=null;
   for(let t=0;t<=action.duration;t+=1/30){
    const f=action.sample(t);assert.ok(f.valid,`${file} ${f.phase} ${t}: ${JSON.stringify(f.diagnostics.map(d=>[d.id,d.status,d.error]))}`);
    for(const d of f.diagnostics){assert.equal(d.maxStretch,1);assert.ok(d.error<1e-6);}
    if(prior)for(const role of ['leftShoulder','rightShoulder','leftElbow','rightElbow','leftHip','rightHip','leftKnee','rightKnee'])assert.ok(distance(prior.world[character.roles[role]].position,f.world[character.roles[role]].position)<.085,`${file} ${role} jumped at ${t}`);
    if(['press','unrack','rerack'].includes(f.phase))for(const side of ['left','right']){
     const grip=character.grips[side],w=f.world[grip.joint],offset=rotate(grip.position,w.rotation),palm=w.position.map((v,i)=>v+offset[i]),sign=side==='left'?1:-1;
     assert.ok(distance(palm,[f.bar.position[0]+sign*action.measurements.halfGrip,...f.bar.position.slice(1)])<1e-6,`${file} palm slipped`);
     const foot=f.world[character.roles[side+'Ankle']].position,knee=f.world[character.roles[side+'Knee']].position;
     assert.ok(Math.abs(foot[0])>.52,'Foot overlaps the declared base');assert.ok(Math.abs(knee[0])>.37,'Knee remains inside the bench pad');
    }
    prior=f;
   }
  }finally{character.dispose();}
 }
});
