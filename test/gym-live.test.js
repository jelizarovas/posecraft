import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymLiveStatus} from '../examples/gym.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {gymWaterReviews,gymBottleLocations} from '../examples/gym-idle-actions.js';
import {BehaviorRuntime} from '../src/behaviors.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const world=(pack,clip,time)=>spatialKinematics(pack,sampleClip({...pack.clips[clip],loop:false},time));

test('live gym is portable authored activities, bounded stats and complementary decisions',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createGym()))),g=d.behaviorGraph;
 assert.equal(d.presentation,'live');assert.ok(d.requiredFeatures.includes('action-variations'));
 for(const name of ['prepare','pull','recover','bench','rack-and-rise','drink-bar','drink-bench','idle-bar','idle-bench','hang-rest'])assert.ok(g.activities[name]);assert.ok(Object.keys(g.activities).length<=32);
 for(const activity of Object.values(g.activities))for(const v of [...activity.variants,...activity.failureVariants||[]]){
  assert.ok(d.packs.atlas.clips[v.clip]);assert.ok(v.start<v.end);
  assert.ok(Object.keys(v.offsets||{}).every(key=>key.startsWith('head.')),'variation cannot move a planted limb');
 }
 for(const name of ['pull-check','bench-check','bar-water-check','bench-water-check']){
  const edges=g.edges.filter(e=>e.from===name);assert.equal(edges.length,2);assert.deepEqual(edges.map(e=>e.when.op).sort(),['gte','lt']);assert.equal(edges[0].when.value,edges[1].when.value);
 }
});

test('water breaks carry one bottle while walking and sipping, then leave it supported',()=>{
 const p=createGym().packs.atlas;
 for(const spec of gymWaterReviews){
  const clip=spec.clip,base=spec.place==='bar'?29:52.5,rest=world(p,'full-set',base),duration=p.clips[clip].duration;let previous,sipRoot,sipTravel=0,sipSamples=0;
  for(let i=0;i<=Math.ceil(duration*30);i++){
   const t=Math.min(duration,i/30),pose=sampleClip(p.clips[clip],t),w=world(p,clip,t);
   if(previous)for(const name of ['rightLower','rightHand'])assert.ok(distance(w[name],previous[name])<12,clip+' arm moves continuously at '+t);previous=w;
   if(pose['water-bottle.rotation']<-64){const b=w['water-bottle'],cap={x:b.x-20*b.m[1],y:b.y-20*b.m[4]},grip={x:b.x+8*b.m[0],y:b.y+8*b.m[3]};assert.ok(distance(grip,w.rightHand)<.9,'hand stays wrapped around bottle');assert.ok(distance(cap,{x:w.head.x,y:w.head.y+13})<10,'cap reaches mouth');sipRoot??=w.root;sipTravel=Math.max(sipTravel,distance(sipRoot,w.root));assert.ok(Math.abs(pose['torso.yaw'])<.1,'upper body faces camera while sipping');sipSamples++;}
   if(i===0||t===duration){assert.ok(distance(w.rightHand,rest.rightHand)<.1);assert.ok(distance(w['water-bottle'],gymBottleLocations[i===0?spec.source:spec.destination].point)<.1,'bottle rests at its source/destination');assert.equal(pose['water-bottle.opacity'],1);}
  }
  assert.ok(sipSamples>30);assert.ok(sipTravel>60,'drinking includes real travel');
 }
});

test('rep variants and station actions join without root, hand or foot jumps',()=>{
 const d=createGym(),p=d.packs.atlas,a=d.behaviorGraph.activities;
 const pairs=[['prepare','pull'],['pull','pull'],['pull','recover'],['recover','drink-bar'],['recover','walk-bench'],['drink-bar','walk-bench'],['walk-bench','bench-setup'],['bench-setup','bench'],['bench','bench'],['bench','rack-and-rise'],['rack-and-rise','drink-bench'],['rack-and-rise','walk-home'],['drink-bench','walk-home'],['walk-home','prepare']];
 for(const [from,to]of pairs)for(const first of [...a[from].variants,...a[from].failureVariants||[]])for(const second of [...a[to].variants,...a[to].failureVariants||[]]){
  const x=world(p,first.clip,first.end),y=world(p,second.clip,second.start);
  for(const name of ['root','leftHand','rightHand','leftFoot','rightFoot'])assert.ok(distance(x[name],y[name])<5,`${from}/${first.id} -> ${to}/${second.id}: ${name} jumps ${distance(x[name],y[name])}`);
 }
});

test('default live workout reaches both stations, fails tired reps, drinks and preserves contacts',()=>{
 const c=new SceneController(createGym()),states=new Set(),firstFailedReps=[],speeds=new Set();let previousFailures=0,previousFatigue=0,recovered=false,maxContact=0,frame;
 try{
  for(let i=0;i<1500;i++){
   frame=c.step(.1);const status=gymLiveStatus(frame);states.add(status.state);if(status.fatigue<previousFatigue-3)recovered=true;previousFatigue=status.fatigue;
   assert.ok(status.reps>=0&&status.reps<=8);assert.ok(status.fatigue>=0&&status.fatigue<=100);assert.ok(status.dehydration>=0&&status.dehydration<=100);
   if(status.failures>previousFailures){firstFailedReps.push(status.reps);previousFailures=status.failures;}
   speeds.add(frame.behavior.actions.atlas.speed);
   for(const contact of frame.contacts||[])if(contact.active)maxContact=Math.max(maxContact,contact.error);
  }
  assert.ok(firstFailedReps.length>0);assert.ok(firstFailedReps.every(n=>n>=0&&n<8));assert.equal(recovered,true,'rest completion reduces fatigue');assert.ok(states.has('bench'));assert.ok(states.has('drink-bar')||states.has('drink-bench'));assert.ok(gymLiveStatus(frame).drinks>=1);assert.ok(speeds.size>5);assert.ok(maxContact<.25,`grip error ${maxContact}`);
 }finally{c.dispose();}
});

test('fresh versus exhausted outcomes come from stats and preserve deterministic replay',()=>{
 const document=createGym(),run=(fatigue,dehydration)=>{const b=new BehaviorRuntime(document);b.setVariable('fatigue',fatigue);b.setVariable('dehydration',dehydration);while(!['recover','recover-failed'].includes(b.state)&&b.time<60)b.tick(1/120);return {reps:b.variables.reps,state:b.state,time:b.time};};
 const fresh=run(0,0),tired=run(85,80);assert.ok(fresh.reps>tired.reps);assert.deepEqual(run(85,80),tired);
 const c=new SceneController(document);try{c.setVariable('dehydration',80);for(let i=0;i<150;i++)c.step(.1);const expected=c.frame();const replay=c.seek(15);assert.deepEqual(replay.behavior,expected.behavior);assert.deepEqual(replay.actors.find(a=>a.id==='atlas').pose,expected.actors.find(a=>a.id==='atlas').pose);}finally{c.dispose();}
});
