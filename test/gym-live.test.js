import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymLiveStatus} from '../examples/gym.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {BehaviorRuntime} from '../src/behaviors.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const world=(pack,clip,time)=>spatialKinematics(pack,sampleClip({...pack.clips[clip],loop:false},time));

test('live gym is portable authored activities, bounded stats and complementary decisions',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createGym()))),g=d.behaviorGraph;
 assert.equal(d.presentation,'live');assert.ok(d.requiredFeatures.includes('action-variations'));
 assert.equal(Object.keys(g.activities).length,10);
 for(const activity of Object.values(g.activities))for(const v of [...activity.variants,...activity.failureVariants||[]]){
  assert.ok(d.packs.atlas.clips[v.clip]);assert.ok(v.start<v.end);
  assert.ok(Object.keys(v.offsets||{}).every(key=>key.startsWith('head.')),'variation cannot move a planted limb');
 }
 for(const name of ['pull-check','bench-check','bar-water-check','bench-water-check']){
  const edges=g.edges.filter(e=>e.from===name);assert.equal(edges.length,2);assert.deepEqual(edges.map(e=>e.when.op).sort(),['gte','lt']);assert.equal(edges[0].when.value,edges[1].when.value);
 }
});

test('water breaks grip the bottle, meet the mouth and keep feet planted at both stations',()=>{
 const p=createGym().packs.atlas;
 for(const [clip,base]of [['drink-at-bar',29],['drink-at-bench',52.5]]){
  const rest=world(p,'full-set',base);let previous;
  for(let i=0;i<=150;i++){
   const t=i/30,w=world(p,clip,t);assert.ok(distance(w.rightHand,w['water-bottle'])<.5);
   assert.ok(w.rightLower.y>w.rightUpper.y,'drinking elbow stays below the shoulder');
   if(previous)for(const name of ['rightLower','rightHand'])assert.ok(distance(w[name],previous[name])<9,'arm bends continuously without an IK branch flip');
   previous=w;
   for(const side of ['left','right'])assert.ok(distance(w[side+'Foot'],rest[side+'Foot'])<.02);
   if(i===0||i===150){assert.ok(distance(w.rightHand,rest.rightHand)<.1);assert.equal(sampleClip(p.clips[clip],t)['water-bottle.opacity'],0);}
  }
  const w=world(p,clip,2),angle=-65*Math.PI/180,cap={x:w['water-bottle'].x+20*Math.sin(angle),y:w['water-bottle'].y-20*Math.cos(angle)};
  assert.ok(distance(cap,{x:w.head.x,y:w.head.y+13})<7,'bottle cap reaches mouth');
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
 const c=new SceneController(createGym()),states=new Set(),firstFailedReps=[],speeds=new Set();let previousFailures=0,maxContact=0,frame;
 try{
  for(let i=0;i<900;i++){
   frame=c.step(.1);const status=gymLiveStatus(frame);states.add(status.state);
   assert.ok(status.reps>=0&&status.reps<=8);assert.ok(status.fatigue>=0&&status.fatigue<=100);assert.ok(status.dehydration>=0&&status.dehydration<=100);
   if(status.failures>previousFailures){firstFailedReps.push(status.reps);previousFailures=status.failures;}
   speeds.add(frame.behavior.actions.atlas.speed);
   for(const contact of frame.contacts||[])if(contact.active)maxContact=Math.max(maxContact,contact.error);
  }
  assert.equal(firstFailedReps[0],7);assert.ok(states.has('bench'));assert.ok(states.has('drink-bar')||states.has('drink-bench'));assert.ok(gymLiveStatus(frame).drinks>=1);assert.ok(speeds.size>5);assert.ok(maxContact<.25,`grip error ${maxContact}`);
 }finally{c.dispose();}
});

test('fresh versus exhausted outcomes come from stats and preserve deterministic replay',()=>{
 const document=createGym(),run=(fatigue,dehydration)=>{const b=new BehaviorRuntime(document);b.setVariable('fatigue',fatigue);b.setVariable('dehydration',dehydration);while(b.state!=='recover'&&b.time<60)b.tick(1/120);return {reps:b.variables.reps,state:b.state,time:b.time};};
 const fresh=run(0,0),tired=run(85,80);assert.ok(fresh.reps>tired.reps);assert.deepEqual(run(85,80),tired);
 const c=new SceneController(document);try{c.setVariable('dehydration',80);for(let i=0;i<150;i++)c.step(.1);const expected=c.frame();const replay=c.seek(15);assert.deepEqual(replay.behavior,expected.behavior);assert.deepEqual(replay.actors.find(a=>a.id==='atlas').pose,expected.actors.find(a=>a.id==='atlas').pose);}finally{c.dispose();}
});
