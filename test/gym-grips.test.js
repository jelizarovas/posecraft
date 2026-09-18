import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymGripReviews} from '../examples/gym.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {BehaviorRuntime} from '../src/behaviors.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const world=(pack,clip,t)=>spatialKinematics(pack,sampleClip({...pack.clips[clip],loop:false},t));

test('one-hand clips have bounded continuous geometry and exact original routine endpoints',()=>{
 const d=createGym(),p=d.packs.atlas;assert.equal(d.contacts.length,14);
 for(const r of gymGripReviews){
  assert.equal(p.clips[r.clip].duration,5.6);let previous;
  for(let i=0;i<=336;i++){
   const w=world(p,r.clip,i/60);
   for(const name of ['root','head','leftLower','rightLower','leftHand','rightHand','leftFoot','rightFoot']){
    assert.ok(Number.isFinite(w[name].x)&&Number.isFinite(w[name].y));
    if(previous)assert.ok(distance(w[name],previous[name])<10,`${r.clip} ${name} discontinuity at ${i/60}`);
   }
   assert.ok(w.leftFoot.y<384&&w.rightFoot.y<384,'soft landing stays on the floor');previous=w;
  }
  for(const [t,original]of [[0,r.id.startsWith('jump')?0:24],[5.6,r.id.startsWith('jump')?6:29]]){
   const a=world(p,r.clip,t),b=world(p,'full-set',original);
   for(const name of ['root','leftHand','rightHand','leftFoot','rightFoot'])assert.ok(distance(a[name],b[name])<.01,`${r.clip} ${name} joins original pose`);
  }
 }
});

test('jumps crouch, clear the floor, hold one hand for a second and then join the second grip',()=>{
 const d=createGym(),c=new SceneController(d);
 try{for(const clip of ['jump-grab-left','jump-grab-right']){
  const p=d.packs.atlas,rest=world(p,clip,0),crouch=world(p,clip,.5),apex=world(p,clip,1.15);
  assert.ok(crouch.root.y>rest.root.y+12);assert.ok(apex.leftFoot.y<355&&apex.rightFoot.y<355);
  const held=clip.endsWith('left')?'left':'right',free=held==='left'?'right':'left';
  for(const t of [1.2,1.6,2.2]){
   c.previewClip('atlas',clip,t,{});const f=c.frame(),active=f.contacts.filter(contact=>contact.active),a=f.actors.find(a=>a.id==='atlas');
   assert.deepEqual(active.map(v=>v.id),[clip+'-'+held]);assert.ok(active[0].error<.25);
   const w=spatialKinematics(p,a.pose);assert.ok(distance(w[free+'Hand'],{x:free==='left'?137:223,y:150})>40);assert.ok(w.leftFoot.y<377&&w.rightFoot.y<377);
  }
  c.previewClip('atlas',clip,3.5,{});const active=c.frame().contacts.filter(contact=>contact.active);assert.equal(active.length,2);assert.ok(active.every(contact=>contact.error<.25));
 }}finally{c.dispose();}
});

test('release cheer keeps one real grip, raises the free fist and lands softly after releasing',()=>{
 const d=createGym(),p=d.packs.atlas,c=new SceneController(d);
 try{for(const clip of ['release-one-hand','release-cheer']){
  c.previewClip('atlas',clip,1.5,{});const f=c.frame(),active=f.contacts.filter(contact=>contact.active);assert.deepEqual(active.map(v=>v.id),[clip+'-left']);assert.ok(active[0].error<.25);
  const w=spatialKinematics(p,f.actors.find(a=>a.id==='atlas').pose);assert.ok(w.leftFoot.y<377&&w.rightFoot.y<377);assert.ok(distance(w.rightHand,{x:223,y:150})>35);
  if(clip==='release-cheer')assert.ok(w.rightHand.y<w.root.y-55,'free hand makes a brief fist celebration');
  c.previewClip('atlas',clip,3.1,{});assert.equal(c.frame().contacts.filter(contact=>contact.active).length,0);
  const landed=world(p,clip,3.1);assert.ok(landed.root.y>305);assert.ok(Math.abs(landed.leftFoot.y-383)<1);
 }}finally{c.dispose();}
});

test('weighted entries are seeded and failure alone routes to the cheer recovery recipe',()=>{
 const d=createGym(),g=d.behaviorGraph;assert.equal(g.edges.find(e=>e.event==='pull-failed').to,'recover-failed');assert.ok(g.activities['recover-failed'].variants.some(v=>v.clip==='release-cheer'));assert.ok(g.activities.recover.variants.every(v=>v.clip!=='release-cheer'));
 const selected=new Set();for(let seed=1;seed<=20;seed++){const copy={...d,behaviorGraph:{...g,seed}},a=new BehaviorRuntime(copy),b=new BehaviorRuntime(copy);a.tick(0);b.tick(0);assert.deepEqual(a.snapshot(),b.snapshot());selected.add(a.snapshot().actions.atlas.variant);}
 assert.deepEqual([...selected].sort(),['jump-left','jump-right','reach-bar']);
});
