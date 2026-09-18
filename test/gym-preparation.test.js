import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {SceneController} from '../src/scene.js';

test('tired preparation has three visible breath-outs, planted feet and quiet endpoints',()=>{
 const doc=assertDocument(createGym()),pack=doc.packs.atlas,clip=pack.clips['tired-breaths'],start=spatialKinematics(pack,sampleClip(clip,0));let active=false,pulses=0;
 const c=new SceneController(doc);
 try{for(let i=0;i<=144;i++){
  const time=i/30,frame=c.previewClip('atlas','tired-breaths',time),pose=frame.actors.find(a=>a.id==='atlas').pose,world=spatialKinematics(pack,pose),open=pose['breath-mouth.opacity']>.3;
  if(open&&!active)pulses++;active=open;
  for(const side of ['left','right'])assert.ok(Math.hypot(world[side+'Foot'].x-start[side+'Foot'].x,world[side+'Foot'].y-start[side+'Foot'].y)<.01,'breathing does not slide feet');
  assert.ok(!frame.contacts.some(c=>c.active),'floor preparation cannot engage the bar');
  if(i===0||i===144){assert.equal(pose['breath-mouth.opacity'],0);assert.equal(pose['breath-air.opacity'],0);assert.ok(Math.hypot(world.head.x-start.head.x,world.head.y-start.head.y)<.01);}
 }assert.equal(pulses,3);}finally{c.dispose();}
});

test('only tired athletes sometimes prepare with breaths, recover a little after all three breaths without awarding reps',()=>{
 const doc=createGym(),selected=new Set();
 for(let seed=1;seed<=32;seed++)for(const fatigue of [8,80]){
  const d=structuredClone(doc);d.behaviorGraph.seed=seed*100003;d.behaviorGraph.variables.fatigue=fatigue;const b=new BehaviorRuntime(d);b.tick(.01);
  if(fatigue===8)assert.equal(b.state,'prepare');else selected.add(b.state);
  if(b.state==='catch-breath-before'){const original={...b.variables};while(b.state==='catch-breath-before'&&b.time<7)b.tick(.01);assert.equal(b.state,'prepare');assert.equal(b.variables.fatigue,original.fatigue-4);assert.equal(b.variables.reps,0);assert.equal(b.variables.sets,0);}
 }
 assert.deepEqual([...selected].sort(),['catch-breath-before','prepare']);
});
