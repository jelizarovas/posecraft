import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymGripReviews} from '../examples/gym.js';
import {SceneController} from '../src/scene.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {spatialKinematics} from '../src/spatial.js';
import {wrapAngle} from '../src/index.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('gym grip contacts preserve authored elbow branches and airborne/landing support',()=>{
 const doc=createGym(),controller=new SceneController(doc);
 try{for(const review of gymGripReviews){let previous;
  for(let i=0;i<=336;i++){
   const t=i/60,frame=controller.previewClip('atlas',review.clip,t),actor=frame.actors.find(a=>a.id==='atlas'),world=spatialKinematics(doc.packs.atlas,actor.pose);
   for(const contact of frame.contacts.filter(c=>c.active))assert.ok(contact.error<.06,review.clip+' '+contact.id+' grip slips');
   for(const side of ['left','right'])assert.ok(world[side+'Foot'].y<=384,review.clip+' foot penetrates floor');
   if(Math.abs(t-review.hold)<.001)for(const side of ['left','right'])assert.ok(world[side+'Foot'].y<374,review.clip+' holding foot should clear ground');
   if(previous)for(const joint of ['leftUpper','leftLower','leftHand','rightUpper','rightLower','rightHand']){assert.ok(distance(world[joint],previous.world[joint])<16,`${review.clip} ${joint} jumps at ${t}`);assert.ok(Math.abs(wrapAngle(actor.pose[joint+'.rotation']-previous.pose[joint+'.rotation']))<30,`${review.clip} ${joint} spins at ${t}`);}
   previous={world,pose:actor.pose};
  }
  if(review.clip.startsWith('release'))for(const side of ['left','right'])assert.ok(Math.abs(previous.world[side+'Foot'].y-383)<.1,'landed foot supports body');
  const baseline=controller.previewClip('atlas','full-set',review.clip.startsWith('release')?29:6).actors.find(a=>a.id==='atlas'),end=spatialKinematics(doc.packs.atlas,baseline.pose);for(const joint of ['root','leftLower','rightLower','leftHand','rightHand','leftFoot','rightFoot'])assert.ok(distance(previous.world[joint],end[joint])<1.5,review.clip+' endpoint mismatch '+joint);
 }}finally{controller.dispose();}
});

test('failure cheer follows failed pull only and recovery does not inflate successful reps',()=>{
 for(const succeeds of [true,false]){const doc=createGym();doc.behaviorGraph.initial='pull';doc.behaviorGraph.activities.pull.success={base:succeeds?1:0,modifiers:[]};const graph=new BehaviorRuntime(doc),visited=new Set();let recoveryStats;
  while(graph.time<35&&graph.state!=='bar-water-check'){graph.tick(1/120);visited.add(graph.state);if(['recover','recover-failed'].includes(graph.state)&&!recoveryStats)recoveryStats={...graph.variables};}
  assert.equal(graph.state,'bar-water-check');assert.equal(visited.has('recover-failed'),!succeeds);assert.equal(visited.has('recover'),succeeds);assert.equal(graph.variables.reps,succeeds?8:0);assert.equal(graph.variables.successes,succeeds?8:0);assert.equal(graph.variables.failures,succeeds?0:1);assert.equal(graph.variables.sets,1);assert.equal(graph.variables.reps,recoveryStats.reps);assert.equal(graph.variables.successes,recoveryStats.successes);assert.equal(graph.variables.failures,recoveryStats.failures);
  if(succeeds)assert.ok(!doc.behaviorGraph.activities.recover.variants.some(v=>v.clip==='release-cheer'));else assert.ok(doc.behaviorGraph.activities['recover-failed'].variants.some(v=>v.clip==='release-cheer'));
 }
});

test('the failure-only release action replays deterministically through contacts',()=>{
 const doc=createGym();doc.behaviorGraph.initial='pull';doc.behaviorGraph.activities.pull.success={base:0,modifiers:[]};doc.behaviorGraph.activities['recover-failed'].variants=doc.behaviorGraph.activities['recover-failed'].variants.filter(v=>v.clip==='release-cheer');const controller=new SceneController(doc);
 try{for(let i=0;i<70;i++)controller.step(.1);assert.equal(controller.frame().behavior.state,'recover-failed');const expected=controller.frame();controller.seek(.2);assert.deepEqual(controller.seek(7),expected);}finally{controller.dispose();}
});
