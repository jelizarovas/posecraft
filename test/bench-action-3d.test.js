import test from 'node:test';
import assert from 'node:assert/strict';
import {createBenchAction3D} from '../src/bench-action-3d.js';
import {benchBodyGeometry3D} from '../src/bench-geometry-3d.js';
import fs from 'node:fs/promises';
import {Texture,Vector3,Triangle,Ray} from 'three';
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
 assert.deepEqual([...seen],['approach','plant','sit','scoot-back','recline','grip','unrack','press','rerack','release','sit-up','scoot-forward','stand','complete']);
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
 for(const id of ['grip','unrack','press-1','press-2','rerack','release','sit-up','scoot-forward','stand']){
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
 const invalidSupport=humanoid();invalidSupport.grips={left:{joint:'left-hand',position:[0,0,0],rotation:I,fingers:[],supportFingers:[{joint:'right-shoulder',axis:[1,0,0],angle:1}]}};
 assert.throws(()=>createBenchAction3D(invalidSupport),/finger joints must descend/);
});

// Texture decoding is irrelevant to skeleton geometry. Preserve the actual
// authored joints, mesh bounds and weights while supplying lightweight textures.
async function imported(file,height=1.8){
 const loader=new GLTFLoader();loader.register(()=>({name:'unit-test-textures',loadTexture:async()=>new Texture()}));
 const bytes=await fs.readFile(new URL('../public/assets/native-3d/'+file+'.glb',import.meta.url));
 return createCharacter3D(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{height});
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
    if(prior)for(const role of ['leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle'])assert.ok(distance(prior.world[character.roles[role]].position,f.world[character.roles[role]].position)<(role.endsWith('Wrist')?.06:.085),`${file} ${role} jumped at ${t}`);
    if(['press','unrack','rerack'].includes(f.phase))for(const side of ['left','right']){
     const grip=character.grips[side],w=f.world[grip.joint],offset=rotate(grip.position,w.rotation),palm=w.position.map((v,i)=>v+offset[i]),sign=side==='left'?1:-1;
     assert.ok(distance(palm,[f.bar.position[0]+sign*action.measurements.halfGrip,...f.bar.position.slice(1)])<1e-6,`${file} palm slipped`);
     const foot=f.world[character.roles[side+'Ankle']].position,knee=f.world[character.roles[side+'Knee']].position;
     const body=benchBodyGeometry3D(action.bench.size),base=body.find(p=>p.id==='front-foot'),pad=body.find(p=>p.id==='pad');
     assert.ok(Math.abs(foot[0])>base.size[0]/2+.04,'Foot ankle lacks clearance from the declared base');assert.ok(Math.abs(knee[0])>pad.size[0]/2+.04,'Knee lacks clearance from the declared pad');
    }
    prior=f;
   }
   for(const beat of action.beats.slice(1)){
    const delta=.00001,before=action.sample(beat.start-delta),after=action.sample(beat.start+delta);
    for(const id of Object.keys(before.world))assert.ok(distance(before.world[id].position,after.world[id].position)<.0001,`${file} ${id} position discontinuity at ${beat.id}`);
    // All phase boundaries deliberately ease to rest. Compare actual wrist
    // velocities across the join so two coincident endpoints cannot hide a snap.
    const h=.001,a=action.sample(beat.start-h),b=action.sample(beat.start),c=action.sample(beat.start+h);
    for(const role of ['leftWrist','rightWrist']){
     const id=character.roles[role],incoming=b.world[id].position.map((v,i)=>(v-a.world[id].position[i])/h),outgoing=c.world[id].position.map((v,i)=>(v-b.world[id].position[i])/h);
     assert.ok(distance(incoming,outgoing)<.025,`${file} ${role} velocity discontinuity at ${beat.id}: ${distance(incoming,outgoing)}m/s`);
    }
   }
  }finally{character.dispose();}
 }
});

test('scoots move lifted hips against stationary hand and foot supports on both authored rigs',async()=>{
 for(const [index,file]of ['athlete','regular'].entries()){
  const character=await imported(file),yaw=index?.6:0;
  try{
   const bench={position:index?[.4,.12,-.3]:[0,0,0],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],scale:1};
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench});
   for(const id of ['scoot-back','scoot-forward']){
    const beat=action.beats.find(b=>b.id===id);assert.ok(beat,`${file} is missing ${id}`);
    const anchors=new Map(),stages=new Set();let previous=null,horizontalTravel=0,footResets=0,pushFrames=0;
    // Include phase endpoints while avoiding the following phase's metadata.
    const count=Math.ceil((beat.end-beat.start)*60);
    for(let i=0;i<=count;i++){
     const t=beat.start+(beat.end-beat.start-.000001)*i/count,f=action.sample(t),s=f.scoot;
     assert.ok(s?.active,`${file} ${id} lacks scoot metadata at ${t}`);assert.equal(s.direction,id==='scoot-back'?'back':'forward');stages.add(s.stage);
     const pelvis=f.world[character.roles.pelvis].position,arms=f.diagnostics.filter(d=>d.id.endsWith('Arm')),feet=f.diagnostics.filter(d=>d.id.endsWith('Leg'));
     assert.equal(f.support.seat,s.seatLift<=1e-6,`${file} ${id} seat support disagrees with lift`);
     assert.ok(Math.abs(pelvis[1]-(bench.position[1]+action.measurements.seatY+s.seatLift))<1e-6,'Declared hip lift differs from the solved pelvis');
     assert.ok(f.valid,`${file} ${id} has unreachable support at ${t}: ${JSON.stringify(f.diagnostics.map(d=>[d.id,d.status,d.error]))}`);
     if(['lift','shift','settle'].includes(s.stage)){
      pushFrames++;assert.equal(arms.length,2);assert.ok(arms.every(d=>d.active&&d.error<1e-6),'Both hands must support the push');
      const key=s.cycle,targets={hands:s.handTargets,feet:s.footTargets};
      if(!anchors.has(key))anchors.set(key,structuredClone(targets));
      const fixed=anchors.get(key);
      for(let j=0;j<2;j++){
       assert.ok(distance(s.handTargets[j],fixed.hands[j])<1e-8,'A hand target slid during the push');
       assert.ok(distance(s.footTargets[j],fixed.feet[j])<1e-8,'A foot target slid during the push');
       assert.ok(distance(arms[j].actual.position,s.handTargets[j])<1e-6,'Rendered wrist lost its support target');
       assert.ok(distance(feet[j].actual.position,s.footTargets[j])<1e-6,'Rendered ankle lost its support target');
       assert.ok(Math.abs(feet[j].actual.position[1]-(bench.position[1]+action.measurements.soleHeight))<1e-6,'A support foot floated during the push');
      }
     }
     if(s.stage==='shift'){assert.ok(s.seatLift>=.015,'Hip transit needs visible seat clearance');assert.equal(f.support.seat,false);}
     if(previous){
      const travel=Math.hypot(pelvis[0]-previous.pelvis[0],pelvis[2]-previous.pelvis[2]);horizontalTravel+=travel;
      if(travel>1e-8){
       assert.ok(s.stage==='shift'||previous.s.stage==='shift','Pelvis slid along the seat outside the supported shift');
       const forward=(pelvis[0]-previous.pelvis[0])*Math.sin(yaw)+(pelvis[2]-previous.pelvis[2])*Math.cos(yaw);
       assert.ok(id==='scoot-back'?forward<=1e-8:forward>=-1e-8,'Scoot moved opposite its declared direction');
      }
      for(let j=0;j<2;j++)if(distance(s.footTargets[j],previous.s.footTargets[j])>1e-8){
       footResets++;
       assert.ok(['prepare','plant','recover','finish'].includes(s.stage)||['prepare','plant','recover','finish'].includes(previous.s.stage),'Foot moved outside a reset window');
      }
     }
     previous={pelvis,s};
    }
    assert.ok(horizontalTravel>.2,'Scoot metadata did not produce meaningful horizontal travel');assert.ok(anchors.size>=2,'The full move needs multiple supported pushes');assert.ok(footResets>0&&pushFrames>0);
    for(const stage of ['plant','lift','shift','settle','recover'])assert.ok(stages.has(stage),`${id} never entered ${stage}`);
   }
   for(const id of ['recline','sit-up']){
    const beat=action.beats.find(b=>b.id===id);assert.ok(beat);
    let previous=null,shiftDistance=0,shiftFrames=0,anchors=null;const resetOrder=[];
    const count=Math.ceil((beat.end-beat.start)*60);
    for(let i=0;i<=count;i++){
     const f=action.sample(beat.start+(beat.end-beat.start)*i/count),joint=f.world[character.roles.pelvis],p=joint.position,feet=f.diagnostics.filter(d=>d.id.endsWith('Leg')),hands=f.diagnostics.filter(d=>d.id.endsWith('Arm'));
     assert.ok(f.valid,`${file} ${id} support is unreachable`);
     if(f.clearance){
      assert.ok(feet.some(d=>d.active&&d.error<1e-6),'Both feet lost grounded support during clearance preparation');
      const moving=feet.filter(d=>!d.active);assert.ok(moving.length<=1,'Clearance reset moves both feet at once');
      if(moving.length){
       const reset=moving[0].id;if(resetOrder.at(-1)!==reset)resetOrder.push(reset);
       assert.equal(f.clearance.rise,0,'A foot resets while the torso rises');assert.ok(hands.every(d=>d.active&&d.error<1e-6),'Foot reset requires both planted hands');
       const mate=feet.find(d=>d.active),oldMate=previous?.feet.find(d=>d.id===mate.id);
       assert.ok(Math.abs(mate.actual.position[1]-bench.position[1]-action.measurements.soleHeight)<1e-7,'The planted mate floats during clearance reset');
       if(oldMate?.active)assert.ok(distance(mate.actual.position,oldMate.actual.position)<1e-7,'The planted mate slides during clearance reset');
      }
      if(f.clearance.rise>1e-6)assert.ok(f.clearance.seatLift<1e-6&&f.clearance.handBlend<1e-6,'Torso rises before clearance support has settled');
     }
     if(previous){
      const horizontal=Math.hypot(p[0]-previous.p[0],p[2]-previous.p[2]),rotationChange=1-Math.abs(joint.rotation.reduce((sum,n,k)=>sum+n*previous.rotation[k],0));shiftDistance+=horizontal;
      if(horizontal>1e-7){
       shiftFrames++;assert.equal(f.support.seat,false,'Pelvis slides while still claiming cushion contact');
       assert.ok(hands.every(d=>d.active&&d.error<1e-6)&&feet.every(d=>d.active&&d.error<1e-6),'Both hands and feet must support the reclined shift');
       assert.ok(rotationChange<1e-10,'Torso rises while still sliding beneath the bar');
       const points=[...hands,...feet].map(d=>d.actual.position);anchors??=points;
       for(let k=0;k<points.length;k++)assert.ok(distance(points[k],anchors[k])<1e-7,'A support slides during the clearance shift');
      }
      if(rotationChange>1e-9)assert.ok(horizontal<1e-7,'Actual torso rise must retain a stationary pelvis');
     }
     previous={p,rotation:joint.rotation,feet};
    }
    assert.ok(shiftFrames>10&&shiftDistance>.2&&shiftDistance<action.measurements.legReach*.45,'Missing bounded, supported bar-clearance shift');
    assert.deepEqual(resetOrder,id==='sit-up'?['leftLeg','rightLeg']:['rightLeg','leftLeg'],'Clearance footsteps do not reverse in the declared order');
   }
  }finally{character.dispose();}
 }
});

test('skinned palms and fingers clear the cushion during scoots and supported recline transitions',async()=>{
 const reports=[];
 for(const [modelIndex,file]of ['athlete','regular'].entries()){
  const character=await imported(file),yaw=modelIndex?.6:0,bench={position:modelIndex?[.4,.12,-.3]:[0,0,0],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],scale:1};
  try{
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench}),joints=new Map(character.rig.joints.map(j=>[j.id,j])),hands=new Set();
   for(const joint of character.rig.joints){
    for(let ancestor=joint;ancestor;ancestor=joints.get(ancestor.parent))if(ancestor.id===character.roles.leftWrist||ancestor.id===character.roles.rightWrist){hands.add(joint.id);break;}
   }
   const selections=[];
   character.root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const weights=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.getAttribute('skinIndex'),vertices=[];
    for(let i=0;i<weights.count;i++){
     let handWeight=0;
     for(let k=0;k<weights.itemSize;k++)if(hands.has(mesh.skeleton.bones[indices.getComponent(i,k)]?.name))handWeight+=weights.getComponent(i,k);
     if(handWeight>.6)vertices.push(i);
    }
    if(vertices.length)selections.push({mesh,vertices});
   });
   const selected=selections.reduce((n,s)=>n+s.vertices.length,0);assert.ok(selected>100,'The regression did not find the authored hand surface');
   const report={file,selected,frames:0,stages:new Set(),insideVertices:0,worst:null},pad=benchBodyGeometry3D(action.bench.size).find(p=>p.id==='pad');
   const inverse=[-bench.rotation[0],-bench.rotation[1],-bench.rotation[2],bench.rotation[3]],vertex=new Vector3();
   for(const beat of action.beats.filter(b=>['scoot-back','scoot-forward','recline','sit-up'].includes(b.id))){
    const count=Math.ceil((beat.end-beat.start)*60);
    for(let i=0;i<=count;i++){
     const time=beat.start+(beat.end-beat.start-.000001)*i/count,frame=action.sample(time),stage=frame.scoot?.stage??frame.phase;
     if(!['prepare','finish','recover','recline','sit-up'].includes(stage))continue;
     character.apply(frame.pose,frame.placement);report.frames++;report.stages.add(stage);
     for(const {mesh,vertices}of selections)for(const index of vertices){
      // Three's actual skin/morph evaluation uses the same imported mesh data
      // as the renderer. Then remove bench placement for the declared pad box.
      mesh.getVertexPosition(index,vertex).applyMatrix4(mesh.matrixWorld);
      const p=rotate([vertex.x-bench.position[0],vertex.y-bench.position[1],vertex.z-bench.position[2]],inverse).map(v=>v/bench.scale);
      const penetration=Math.min(...p.map((v,axis)=>pad.size[axis]/2-Math.abs(v-pad.position[axis])));
      if(penetration>1e-5){
       report.insideVertices++;
       if(!report.worst||penetration>report.worst.penetration)report.worst={time,phase:frame.phase,stage,cycle:frame.scoot?.cycle,vertex:index,point:p,penetration};
      }
     }
    }
   }
   assert.ok(report.frames>100);assert.deepEqual([...report.stages].sort(),['finish','prepare','recline','recover','sit-up']);report.stages=[...report.stages];reports.push(report);
  }finally{character.dispose();}
 }
 assert.ok(reports.every(r=>r.insideVertices===0),'Actual hand geometry intersects the cushion: '+JSON.stringify(reports));
});


test('both authored rigs rise over planted feet before alternating stance resets and reverse the transfer to sit',async()=>{
 for(const [index,file]of ['athlete','regular'].entries()){
  const character=await imported(file),yaw=index?.6:0,bench={position:index?[.4,.12,-.3]:[0,0,0],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],scale:1};
  try{
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench}),inverse=[0,-Math.sin(yaw/2),0,Math.cos(yaw/2)];
   const local=p=>rotate(p.map((v,i)=>v-bench.position[i]),inverse);
   const beat=action.beats.find(b=>b.id==='stand'),sit=action.beats.find(b=>b.id==='sit');
   const at=u=>action.sample(beat.start+(beat.end-beat.start)*Math.min(u,1-1e-8));
   const first=at(0),feet=['leftAnkle','rightAnkle'].map(role=>first.world[character.roles[role]].position),footZ=feet.reduce((sum,p)=>sum+local(p)[2]/2,0),stages=new Set();
   let lastRise=0,maxPitch=0,firstLift=null,previous=null,resets=new Set();
   for(let i=0;i<=120;i++){
    const u=i/120,f=at(u),transfer=f.transfer,pelvis=local(f.world[character.roles.pelvis].position);
    assert.ok(transfer,`${file} missing transfer metadata`);stages.add(transfer.stage);maxPitch=Math.max(maxPitch,transfer.pitch);
    assert.ok(f.valid,`${file} transfer ${u}: ${JSON.stringify(f.diagnostics.map(d=>[d.id,d.status,d.error]))}`);
    const ankles=['leftAnkle','rightAnkle'].map(role=>f.world[character.roles[role]].position);
    for(let n=0;n<2;n++){
     if(transfer.stage!=='settle')assert.ok(distance(ankles[n],feet[n])<1e-7,`${file} foot slid during load transfer`);
     if(previous&&distance(ankles[n],previous[n])>1e-7){assert.equal(transfer.stage,'settle','Stance changed before standing');assert.ok(transfer.rise>1-1e-6,'Foot reset before pelvis fully rose');resets.add(n);}
    }
    assert.ok(f.diagnostics.filter(d=>d.id.endsWith('Leg')&&d.active).length>=1,'Both feet lost support during stance reset');
    assert.ok(ankles.filter(p=>Math.abs(local(p)[1]-action.measurements.soleHeight)<1e-7).length>=1,'Both shoes lifted during stance reset');previous=ankles;
    assert.ok(transfer.rise>=lastRise-1e-8,'Standing pelvis reversed its rise');lastRise=transfer.rise;
    if(transfer.stage==='prepare'||transfer.stage==='lean'){
     assert.ok(Math.abs(pelvis[1]-action.measurements.seatY)<1e-7,'Pelvis lifted before the forward lean completed');assert.equal(f.support.seat,true);
    }
    if(transfer.rise>.01&&!firstLift){
     firstLift=f;assert.ok(transfer.pitch>25*Math.PI/180,'Leg extension began without a visible forward lean');
     // This is a geometric trunk-support proxy, not an inferred physical COM.
     const shoulders=['leftShoulder','rightShoulder'].map(role=>local(f.world[character.roles[role]].position));
     const trunkZ=.4*pelvis[2]+.3*(shoulders[0][2]+shoulders[1][2]);
     assert.ok(Math.abs(trunkZ-footZ)<.13,`${file} trunk is still behind the planted support when the seat unloads: ${trunkZ-footZ}m`);
    }
    if(transfer.rise>.02)assert.equal(f.support.seat,false,'Lifted hips still claim seat support');
    if(i>0&&i<120){
     const reverse=action.sample(sit.start+(sit.end-sit.start)*(1-u));
     assert.ok(distance(reverse.world[character.roles.pelvis].position,f.world[character.roles.pelvis].position)<1e-7,'Sitting does not reverse the supported pelvis trajectory');
     assert.ok(Math.abs(reverse.transfer.pitch-transfer.pitch)<1e-8);
    }
   }
   assert.deepEqual([...stages],['prepare','lean','push','settle']);assert.deepEqual([...resets],[0,1],'Stance reset must step left then right');assert.ok(firstLift);assert.ok(maxPitch>30*Math.PI/180);
   const end=action.sample(action.duration),pelvis=local(end.world[character.roles.pelvis].position);
   assert.ok(Math.abs(pelvis[2]-footZ)<1e-7,'Standing pelvis did not settle above the ankle line');assert.ok(Math.abs(pelvis[1]-action.measurements.standY)<1e-7);
  }finally{character.dispose();}
 }
});


test('rendered legs and shoes clear the declared bench through recline and the complete exit at 60Hz',async()=>{
 const reports=[];
 for(const file of ['athlete','regular']){
  const character=await imported(file);
  try{
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench:{position:[0,0,0],rotation:I,scale:1}}),joints=new Map(character.rig.joints.map(j=>[j.id,j])),legs=new Set();
   for(const joint of character.rig.joints)for(let ancestor=joint;ancestor;ancestor=joints.get(ancestor.parent))if([character.roles.leftHip,character.roles.rightHip].includes(ancestor.id)){legs.add(joint.id);break;}
   const selections=[];
   character.root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const weights=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.getAttribute('skinIndex'),vertices=[];
    for(let i=0;i<weights.count;i++){
     let legWeight=0;
     for(let k=0;k<weights.itemSize;k++)if(legs.has(mesh.skeleton.bones[indices.getComponent(i,k)]?.name))legWeight+=weights.getComponent(i,k);
     if(legWeight>.6)vertices.push(i);
    }
    if(vertices.length)selections.push({mesh,vertices});
   });
   const geometry=benchBodyGeometry3D(action.bench.size),vertex=new Vector3(),report={file,frames:0,selected:selections.reduce((n,s)=>n+s.vertices.length,0),insideVertices:0,byPhase:{},worst:null};
   assert.ok(report.selected>100,'No actual leg/shoe surface found');
   const recline=action.beats.find(b=>b.id==='recline'),intervals=[[recline.start,recline.end],[action.beats.find(b=>b.id==='release').start,action.duration]];
   for(const [begin,end]of intervals)for(let i=0,count=Math.ceil((end-begin)*60);i<=count;i++){
    const time=begin+(end-begin)*i/count;
    const frame=action.sample(time);character.apply(frame.pose,frame.placement);report.frames++;
    for(const {mesh,vertices}of selections)for(const index of vertices){
     mesh.getVertexPosition(index,vertex).applyMatrix4(mesh.matrixWorld);const p=vertex.toArray();
     for(const box of geometry){
      const penetration=Math.min(...p.map((v,axis)=>box.size[axis]/2-Math.abs(v-box.position[axis])));
      if(penetration>1e-5){report.insideVertices++;const key=frame.phase+':'+(frame.scoot?.stage??frame.transfer?.stage??'');report.byPhase[key]=(report.byPhase[key]??0)+1;if(!report.worst||penetration>report.worst.penetration){const wi=mesh.geometry.getAttribute('skinWeight'),si=mesh.geometry.getAttribute('skinIndex');report.worst={time,phase:frame.phase,stage:frame.scoot?.stage??frame.transfer?.stage,progress:frame.scoot?.progress,box:box.id,vertex:index,point:p,penetration,weights:Array.from({length:4},(_,k)=>[mesh.skeleton.bones[si.getComponent(index,k)]?.name,wi.getComponent(index,k)])};}}
     }
    }
   }
   reports.push(report);
  }finally{character.dispose();}
 }
 assert.ok(reports.every(r=>r.insideVertices===0),'Actual leg/shoe geometry intersects the equipment: '+JSON.stringify(reports));
});


// Distance between finite line segments; independent of the IK/action code.
function segmentDistanceSq(a,b,c,d){
 const sub=(p,q)=>p.map((v,i)=>v-q[i]),dot=(p,q)=>p.reduce((n,v,i)=>n+v*q[i],0),u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),den=aa*cc-bb*bb;
 if(cc<1e-14){const t=Math.max(0,Math.min(1,-dd/aa));return dot(w.map((n,i)=>n+t*u[i]),w.map((n,i)=>n+t*u[i]));}
 let sn=den,sd=den,tn=den,td=den;
 if(den<1e-14){sn=0;sd=1;tn=ee;td=cc;}else{sn=bb*ee-cc*dd;tn=aa*ee-bb*dd;if(sn<0){sn=0;tn=ee;td=cc;}else if(sn>sd){sn=sd;tn=ee+bb;td=cc;}}
 if(tn<0){tn=0;if(-dd<0)sn=0;else if(-dd>aa)sn=sd;else{sn=-dd;sd=aa;}}
 else if(tn>td){tn=td;if(-dd+bb<0)sn=0;else if(-dd+bb>aa)sn=sd;else{sn=-dd+bb;sd=aa;}}
 const sc=Math.abs(sn)<1e-14?0:sn/sd,tc=Math.abs(tn)<1e-14?0:tn/td;return dot(w.map((n,i)=>n+sc*u[i]-tc*v[i]),w.map((n,i)=>n+sc*u[i]-tc*v[i]));
}

test('actual head, face and hair surfaces clear the racked bar throughout recline and sit-up',async()=>{
 // Match the physical shaft in native-three-view.js: local-X length1.85m,
 // radius18mm. Test a capsule (including end caps), not joint-center clearance.
 const half=.925,radius=.018,axisA=[-half,0,0],axisB=[half,0,0],aVec=new Vector3(...axisA),bVec=new Vector3(...axisB),ray=new Ray(aVec,new Vector3(1,0,0)),triangle=new Triangle(),nearest=new Vector3(),hit=new Vector3();
 const reports=[];
 for(const file of ['athlete','regular'])for(const [height,yaw]of [[1.7,0],[1.8,0],[1.9,.65]]){
  const character=await imported(file,height),bench={position:yaw?[.4,.12,-.3]:[0,0,0],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],scale:1};
  try{
   const action=createBenchAction3D({rig:character.rig,roles:character.roles,grips:character.grips,bench}),joints=new Map(character.rig.joints.map(j=>[j.id,j])),head=new Set();
   for(const joint of character.rig.joints)for(let ancestor=joint;ancestor;ancestor=joints.get(ancestor.parent))if(ancestor.id===character.roles.head){head.add(joint.id);break;}
   const selections=[];
   character.root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const weights=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.getAttribute('skinIndex'),selected=new Set();
    for(let i=0;i<weights.count;i++){let amount=0;for(let k=0;k<weights.itemSize;k++)if(head.has(mesh.skeleton.bones[indices.getComponent(i,k)]?.name))amount+=weights.getComponent(i,k);if(amount>.5)selected.add(i);}
    const index=mesh.geometry.index,faces=[];
    for(let i=0;i<(index?.count??weights.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.every(id=>selected.has(id)))faces.push(ids);}
    if(faces.length)selections.push({mesh,vertices:[...selected],faces,points:new Map()});
   });
   const report={file,height,yaw,frames:0,triangles:selections.reduce((n,s)=>n+s.faces.length,0),collisions:0,byPhase:{},phaseWindows:{},worst:null};assert.ok(report.triangles>100,'Actual head surface was not selected');
   for(const beat of action.beats.filter(b=>['recline','sit-up'].includes(b.id))){
    const count=Math.ceil((beat.end-beat.start)*60);
    for(let i=0;i<=count;i++){
     const time=beat.start+(beat.end-beat.start)*i/count,frame=action.sample(time),q=frame.bar.rotation,inverse=[-q[0],-q[1],-q[2],q[3]],scale=frame.bar.scale??1;character.apply(frame.pose,frame.placement);report.frames++;
     for(const selection of selections){
      for(const id of selection.vertices){selection.mesh.getVertexPosition(id,nearest).applyMatrix4(selection.mesh.matrixWorld);selection.points.set(id,rotate(nearest.toArray().map((n,k)=>n-frame.bar.position[k]),inverse).map(n=>n/scale));}
      for(const ids of selection.faces){
       const p=ids.map(id=>selection.points.get(id));
       if([1,2].some(axis=>Math.min(...p.map(v=>v[axis]))>radius||Math.max(...p.map(v=>v[axis]))< -radius)||Math.min(...p.map(v=>v[0]))>half+radius||Math.max(...p.map(v=>v[0]))< -half-radius)continue;
       triangle.set(new Vector3(...p[0]),new Vector3(...p[1]),new Vector3(...p[2]));
       const crossing=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit);let distanceSq;
       if(crossing&&hit.x<=half)distanceSq=0;
       else{distanceSq=Math.min(triangle.closestPointToPoint(aVec,nearest).distanceToSquared(aVec),triangle.closestPointToPoint(bVec,nearest).distanceToSquared(bVec));for(let k=0;k<3;k++)distanceSq=Math.min(distanceSq,segmentDistanceSq(axisA,axisB,p[k],p[(k+1)%3]));}
       const penetration=(radius-Math.sqrt(Math.max(0,distanceSq)))*scale;
       if(penetration>1e-5){report.collisions++;report.byPhase[beat.id]=(report.byPhase[beat.id]??0)+1;const window=report.phaseWindows[beat.id]??={first:time,last:time,firstProgress:i/count,lastProgress:i/count};window.last=time;window.lastProgress=i/count;if(!report.worst||penetration>report.worst.penetration)report.worst={phase:beat.id,time,progress:i/count,penetration,vertices:ids,points:p};}
      }
     }
    }
   }
   reports.push(report);
  }finally{character.dispose();}
 }
 await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../test-results/native-head-bar-clearance.json',import.meta.url),JSON.stringify(reports,null,2));
 assert.ok(reports.every(r=>r.collisions===0),'Actual head/hair surface intersects the racked bar: '+JSON.stringify(reports));
});
