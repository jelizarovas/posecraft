import test from 'node:test';
import assert from 'node:assert/strict';
import {compileScene3D,evaluateScene3D} from '../src/scene-3d.js';
import {createBenchContact3D} from '../examples/bench-contact-3d.js';

// The expected transforms below are analytic axis rotations and Euclidean
// distances. Do not replace them with the production rig/Three transform code.
const identity=[0,0,0,1],quarter=Math.SQRT1_2;
const transform=(position=[0,0,0],rotation=identity,scale=1)=>({position:[...position],rotation:[...rotation],scale});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const vector=(actual,expected,tolerance=1e-7)=>{assert.equal(actual.length,expected.length);actual.forEach((v,i)=>close(v,expected[i],tolerance));};
const rotation=(actual,expected)=>close(Math.abs(actual.reduce((s,v,i)=>s+v*expected[i],0)),1);
function fixture({lengths=[1,1],target=[1,0,1]}={}){
 return {kind:'scene3d',schemaVersion:1,units:'meters',up:'Y',id:'contact-proof',name:'Independent contact proof',revision:0,
  rigs:{arm:{joints:[
   {id:'shoulder',parent:null,position:[0,0,0],rotation:[...identity]},
   {id:'elbow',parent:'shoulder',position:[lengths[0],0,0],rotation:[...identity]},
   {id:'hand',parent:'elbow',position:[lengths[1],0,0],rotation:[...identity]}
  ],chains:{reach:{root:'shoulder',middle:'elbow',tip:'hand',pole:[0,1,0],bend:{min:0,max:Math.PI}}}}},
  actors:[{id:'person',rig:'arm',transform:transform(),pose:{}}],
  objects:[{id:'bench',geometry:{type:'box',size:[1,.2,2]},transform:transform(),anchors:{grip:{position:[...target],rotation:[...identity]}}}],
  contacts:[{id:'grasp',actor:'person',chain:'reach',target:{object:'bench',anchor:'grip'},enabled:true}],
  camera:{projection:'orthographic',position:[3,2,5],target:[0,0,0],height:4}};
}
function lengths(frame,expected){
 const {world}=frame.actors[0];
 close(distance(world.shoulder.position,world.elbow.position),expected[0]);
 close(distance(world.elbow.position,world.hand.position),expected[1]);
 for(const c of frame.contacts){vector(c.boneLengths,expected);assert.equal(c.maxStretch,1);}
}

test('native contact reaches real positive and negative Z without changing bone lengths',()=>{
 for(const z of [-1,1]){
  const frame=evaluateScene3D(fixture({target:[1,0,z]})),contact=frame.contacts[0];
  assert.equal(contact.status,'solved');close(contact.error,0);
  vector(contact.actual.position,[1,0,z]);
  vector(frame.actors[0].world.elbow.position,[.5,Math.SQRT1_2,z*.5]);
  rotation(contact.actual.rotation,identity);lengths(frame,[1,1]);
 }
});

test('one object transform moves geometry, grip position and orientation together',()=>{
 const doc=fixture();doc.objects[0].anchors.grip={position:[.4,.2,-.1],rotation:[quarter,0,0,quarter]};
 const move=transform([.2,-.1,.3],[0,quarter,0,quarter],2),frame=compileScene3D(doc).evaluate({objectTransforms:{bench:move}});
 const object=frame.objects[0],contact=frame.contacts[0];
 // Y+90 sends X to -Z and Z to X; uniform scale applies before rotation.
 vector(object.anchors.grip.position,[0,.3,-.5]);
 rotation(object.anchors.grip.rotation,[.5,.5,-.5,.5]);
 vector(object.matrix,[0,0,-2,0,0,2,0,0,2,0,0,0,.2,-.1,.3,1]);
 assert.deepEqual(object.geometry,doc.objects[0].geometry);
 assert.equal(contact.status,'solved');vector(contact.actual.position,[0,.3,-.5]);rotation(contact.actual.rotation,[.5,.5,-.5,.5]);
 lengths(frame,[1,1]);assert.deepEqual(doc.objects[0].transform,transform());
});

test('unequal arm proportions use their declared lengths rather than Atlas dimensions',()=>{
 for(const boneLengths of [[1.5,.5],[.75,1.25],[.8,.9]]){
  const frame=evaluateScene3D(fixture({lengths:boneLengths,target:[1.2,0,.9]}));
  assert.equal(frame.contacts[0].status,'solved');vector(frame.contacts[0].actual.position,[1.2,0,.9]);lengths(frame,boneLengths);
 }
});

test('actor placement rotation and uniform scale preserve world-space reach lengths',()=>{
 const doc=fixture({target:[2.4,3.1,3.8]});doc.actors[0].transform=transform([2,3,4],[0,quarter,0,quarter],.5);
 const frame=evaluateScene3D(doc);assert.equal(frame.contacts[0].status,'solved');
 vector(frame.actors[0].world.shoulder.position,[2,3,4]);vector(frame.contacts[0].actual.position,[2.4,3.1,3.8]);lengths(frame,[.5,.5]);
});

test('out-of-reach targets report residual error instead of elongating the chain',()=>{
 const far=evaluateScene3D(fixture({target:[4,0,3]}));
 assert.equal(far.contacts[0].status,'unreachable');vector(far.contacts[0].actual.position,[1.6,0,1.2]);close(far.contacts[0].error,3);lengths(far,[1,1]);
 const near=evaluateScene3D(fixture({lengths:[1.5,.5],target:[.2,0,0]}));
 assert.equal(near.contacts[0].status,'unreachable');vector(near.contacts[0].actual.position,[1,0,0]);close(near.contacts[0].error,.8);lengths(near,[1.5,.5]);
});

test('bend limits report a limited contact at an independently calculated reach',()=>{
 const doc=fixture({target:[1.8,0,0]});doc.rigs.arm.chains.reach.bend={min:Math.PI/2,max:Math.PI/2};
 const frame=evaluateScene3D(doc),c=frame.contacts[0];
 assert.equal(c.status,'limited');vector(c.actual.position,[Math.SQRT2,0,0]);close(c.error,1.8-Math.SQRT2);lengths(frame,[1,1]);
});

test('disabled contacts leave the authored pose intact and retain a measurable error',()=>{
 const doc=fixture();doc.contacts[0].enabled=false;const frame=evaluateScene3D(doc),c=frame.contacts[0];
 assert.equal(c.status,'disabled');vector(c.actual.position,[2,0,0]);close(c.error,Math.SQRT2);assert.deepEqual(frame.actors[0].pose,{});lengths(frame,[1,1]);
});

test('overlapping named chains report final conflict instead of a stale solved grip',()=>{
 const doc=fixture();doc.rigs.arm.chains.otherReach=structuredClone(doc.rigs.arm.chains.reach);
 doc.objects[0].anchors.other={position:[1,0,-1],rotation:[...identity]};
 doc.contacts.push({id:'other-grasp',actor:'person',chain:'otherReach',target:{object:'bench',anchor:'other'},enabled:true});
 const frame=evaluateScene3D(doc);
 assert.equal(frame.contacts[0].status,'conflict');close(frame.contacts[0].error,2);
 assert.equal(frame.contacts[1].status,'solved');close(frame.contacts[1].error,0);
 for(const c of frame.contacts)vector(c.actual.position,[1,0,-1]);lengths(frame,[1,1]);
});

test('overlapping orientation goals report conflict even when both positions coincide',()=>{
 const doc=fixture();doc.rigs.arm.chains.otherReach=structuredClone(doc.rigs.arm.chains.reach);
 doc.objects[0].anchors.other={position:[1,0,1],rotation:[0,quarter,0,quarter]};
 doc.contacts.push({id:'other-grasp',actor:'person',chain:'otherReach',target:{object:'bench',anchor:'other'},enabled:true});
 const frame=evaluateScene3D(doc);
 assert.equal(frame.contacts[0].status,'conflict');close(frame.contacts[0].error,0);close(frame.contacts[0].orientationError,Math.PI/2);
 assert.equal(frame.contacts[1].status,'solved');close(frame.contacts[1].orientationError,0);lengths(frame,[1,1]);
});

test('camera overrides change no world transform, solved pose or contact diagnostic',()=>{
 const compiled=compileScene3D(fixture()),a=compiled.evaluate(),camera={projection:'orthographic',position:[-6,4,-5],target:[.1,.2,.3],height:12};
 const b=compiled.evaluate({camera});assert.deepEqual(b.actors,a.actors);assert.deepEqual(b.objects,a.objects);assert.deepEqual(b.contacts,a.contacts);assert.deepEqual(b.camera,camera);
 b.camera.position[0]=999;assert.deepEqual(compiled.evaluate().camera,a.camera);assert.equal(camera.position[0],-6);
});

test('compiled input, outputs and serialized reload are independent immutable snapshots',()=>{
 const doc=fixture(),source=JSON.stringify(doc),compiled=compileScene3D(doc),expected=compiled.evaluate();
 const reload=compileScene3D(JSON.parse(JSON.stringify(compiled.serialize())));assert.deepEqual(reload.evaluate(),expected);assert.equal(JSON.stringify(doc),source);
 doc.objects[0].anchors.grip.position[2]=8;
 const exported=compiled.serialize();exported.rigs.arm.joints[1].position[0]=7;
 const output=compiled.evaluate();output.actors[0].world.hand.position[0]=888;output.actors[0].pose.shoulder.rotation[0]=888;output.objects[0].anchors.grip.position[0]=888;
 assert.deepEqual(compiled.evaluate(),expected);
 assert.throws(()=>compiled.evaluate({objectTransforms:{missing:transform()}}),/unknown scene node/i);
 assert.throws(()=>compiled.evaluate({actorPoses:{person:{missing:{rotation:identity}}}}),/Missing pose joint/i);
});

test('a continuous depth sweep keeps the intended bend side and both rigid segments',()=>{
 const compiled=compileScene3D(fixture({target:[1,0,0]}));let previous;
 for(let i=0;i<=120;i++){
  const z=-1.2+i*.02,frame=compiled.evaluate({objectTransforms:{bench:transform([0,0,z])}}),world=frame.actors[0].world;
  assert.equal(frame.contacts[0].status,'solved');vector(world.hand.position,[1,0,z]);assert.ok(world.elbow.position[1]>0);lengths(frame,[1,1]);
  if(previous)assert.ok(distance(previous,world.elbow.position)<.03,'Elbow jumped during a nonsingular depth sweep');previous=world.elbow.position;
 }
});

test('the bench fixture keeps both grips for different heights and bench transforms',()=>{
 for(const height of [1.5,1.75,2.05])for(const yaw of [0,Math.PI/2,-Math.PI/3]){
  const position=[1,.7,-2],doc=createBenchContact3D({height,benchPosition:position,benchYaw:yaw}),frame=evaluateScene3D(doc),scale=height/1.75;
  for(const [i,side]of ['left','right'].entries()){
   const sign=i===0?-1:1,x=sign*.28,z=-.20;
   const expected=[position[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,position[1]+.60,position[2]-Math.sin(yaw)*x+Math.cos(yaw)*z];
   const c=frame.contacts[i],w=frame.actors[0].world;
   assert.equal(c.status,'solved',`height ${height}, yaw ${yaw}, ${side}: ${c.status}, error ${c.error}`);
   vector(c.target.position,expected);vector(c.actual.position,expected);
   close(distance(w[side+'-shoulder'].position,w[side+'-elbow'].position),Math.hypot(.27,.14)*scale);
   close(distance(w[side+'-elbow'].position,w[side+'-wrist'].position),Math.hypot(.07,.265,.045)*scale);
   assert.equal(c.maxStretch,1);
  }
 }
});

test('moving bench depth changes both hands while the authored torso stays fixed',()=>{
 const doc=createBenchContact3D(),compiled=compileScene3D(doc),before=compiled.evaluate();
 const changed=structuredClone(doc.objects[0].transform);changed.position[2]+=.06;
 const after=compiled.evaluate({objectTransforms:{bench:changed}});
 assert.deepEqual(after.actors[0].world.torso,before.actors[0].world.torso);
 for(let i=0;i<2;i++){
  const a=after.contacts[i],b=before.contacts[i];assert.equal(a.status,'solved');
  vector(a.actual.position,[b.actual.position[0],b.actual.position[1],b.actual.position[2]+.06]);
  vector(a.boneLengths,b.boneLengths);assert.equal(a.maxStretch,1);
 }
});
