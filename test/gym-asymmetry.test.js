import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {gymAsymmetryReviews} from '../examples/gym-asymmetry.js';
import {gymBenchTargets} from '../examples/gym-room.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics} from '../src/spatial.js';
import {assertDocument} from '../src/schema.js';
import {wrapAngle} from '../src/index.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),bench=gymBenchTargets();
const fixture=()=>{const document=createGym(),controller=new SceneController(document);return {document,controller,at(clip,time){const frame=controller.previewClip('atlas',clip,time),actor=frame.actors.find(a=>a.id==='atlas');return {frame,pose:actor.pose,world:spatialKinematics(document.packs.atlas,actor.pose)};}};};
const grip=(world,side)=>{const x=bench.bar.gripOffsets[side].x;return {x:world.barbell.x+world.barbell.m[0]*x,y:world.barbell.y+world.barbell.m[3]*x};};

test('asymmetric gym actions remain editable and inside document resource limits',()=>{
 const doc=createGym();assertDocument(doc);assert.equal(gymAsymmetryReviews.length,8);let nodes=0;const count=v=>{nodes++;if(v&&typeof v==='object')for(const child of Object.values(v))count(child);};count(doc);assert.ok(nodes<=500000,`${nodes} document nodes`);assert.ok(JSON.stringify(doc).length<=5000000);
 for(const review of gymAsymmetryReviews){const clip=doc.packs.atlas.clips[review.clip];assert.ok(clip,review.clip);assert.equal(clip.loop,false);assert.equal(clip.duration,review.duration);for(const keys of Object.values(clip.tracks))assert.ok(keys.length<=1000);}
});

test('both asymmetric grips stay on their bar while feet and bench support remain stable',()=>{
 const q=fixture();try{for(const review of gymAsymmetryReviews){let previous;
  for(let i=0;i<=Math.round(review.duration*30);i++){const time=Math.min(review.duration,i/30),sample=q.at(review.clip,time),w=sample.world,contacts=sample.frame.contacts.filter(c=>c.active);assert.equal(contacts.length,2,review.clip+' needs both grip constraints');for(const contact of contacts)assert.ok(contact.error<.2,`${review.clip} ${time} ${contact.id} gap ${contact.error}`);
   for(const side of ['left','right']){const target=review.kind==='pull'?{x:side==='left'?137:223,y:150}:grip(w,side);assert.ok(distance(w[side+'Hand'],target)<.2,`${review.clip} ${time} ${side} physical hand drift`);if(review.kind==='bench')assert.ok(distance(w[side+'Foot'],bench.feet[side])<.8,`${review.clip} foot leaves its support`);else assert.ok(w[side+'Foot'].y<383,review.clip+' hanging foot intersects floor');}
   assert.ok(distance(w.pullbar,{x:180,y:150})<.15,review.clip+' drawn pull-up rail moves with the athlete');
   assert.ok(distance(w['water-bottle'],{x:400,y:270})<.15,review.clip+' bottle leaves its saved station during preview');
   if(review.kind==='pull')assert.ok(distance(w.barbell,bench.bar)<.15,review.clip+' resting barbell leaves its rack');
   if(review.kind==='bench'){assert.ok(distance(w.root,bench.hips)<.1,'pelvis leaves bench support');assert.ok(Math.abs(distance(grip(w,'left'),grip(w,'right'))-(bench.bar.gripOffsets.right.x-bench.bar.gripOffsets.left.x))<1e-6,'bar stretches');}
   if(previous)for(const joint of ['root','leftUpper','rightUpper','leftLower','rightLower','leftHand','rightHand']){assert.ok(distance(w[joint],previous.world[joint])<12,`${review.clip} ${joint} jumps`);assert.ok(Math.abs(wrapAngle(sample.pose[joint+'.rotation']-previous.pose[joint+'.rotation']))<15,`${review.clip} ${joint} spins`);}previous=sample;
  }
 }}finally{q.controller.dispose();}
});

test('leading sides are visible, weak sides hesitate then catch up, and failed attempts yield',()=>{
 const q=fixture();try{
  for(const kind of ['pull','bench']){
   const left=q.at(kind+'-lead-left',1.65),right=q.at(kind+'-lead-right',1.65),baseline=q.at('full-set',kind==='pull'?6:41),channel=kind==='pull'?'torso.rotation':'barbell.rotation';assert.ok(Math.abs(left.pose[channel]-baseline.pose[channel])>8,kind+' left lead is invisible');assert.ok(Math.abs(right.pose[channel]-baseline.pose[channel])>8,kind+' right lead is invisible');assert.ok((left.pose[channel]-baseline.pose[channel])*(right.pose[channel]-baseline.pose[channel])<0,kind+' side swap does not reverse its lean');
   for(const lead of ['left','right']){const clip=kind+'-lead-'+lead,a=q.at(clip,1.65),b=q.at(clip,1.8),c=q.at(clip,2.4),joint=kind==='pull'?'root':'barbell';assert.ok(distance(a.world[joint],b.world[joint])<.5,clip+' has no weak-side hesitation');assert.ok(distance(b.world[joint],c.world[joint])>5,clip+' never catches up');
    if(kind==='pull'){const stall=q.at(kind+'-stall-'+lead,1.65);assert.ok(stall.world.root.y-left.world.root.y>5,'failed pull reaches the same height as success');}
    else{const stall=q.at(kind+'-stall-'+lead,2.55),success=q.at(clip,2.55);assert.ok(stall.world.barbell.y-success.world.barbell.y>15,'failed bench does not yield back toward chest');}
   }
  }
 }finally{q.controller.dispose();}
});

test('all asymmetric attempts join the shared neutral pose without endpoint pops',()=>{
 const q=fixture();try{for(const review of gymAsymmetryReviews){const baseline=q.at('full-set',review.kind==='pull'?6:41);for(const time of [0,review.duration]){const sample=q.at(review.clip,time);for(const joint of ['root','torso','pelvis','head','leftLower','rightLower','leftHand','rightHand','leftFoot','rightFoot','barbell'])assert.ok(distance(sample.world[joint],baseline.world[joint])<.2,`${review.clip} ${joint} does not join at ${time}`);}}}finally{q.controller.dispose();}
});
