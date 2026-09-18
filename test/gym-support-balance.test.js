import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics} from '../src/spatial.js';
const rad=Math.PI/180,distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const doc=createGym();
const cases=[['jump-grab-left',1.8,'left'],['jump-grab-right',1.8,'right'],['hang-switch',1.3,'left'],['hang-switch',3.5,'right'],['release-one-hand',1.5,'left'],['release-cheer',1.5,'left']];
function sample(controller,clip,time){const frame=controller.previewClip('atlas',clip,time),pose=frame.actors.find(a=>a.id==='atlas').pose;return {frame,pose,world:spatialKinematics(doc.packs.atlas,pose)};}

test('one-hand gym actions move the estimated center of mass under the held hand with mirrored body roll',()=>{
 const c=new SceneController(doc);try{
  const poses=[];
  for(const [clip,time,held]of cases){
   const {world:w,pose:p,frame}=sample(c,clip,time),sign=held==='left'?1:-1,anchor={x:held==='left'?137:223,y:150},roll=p['pelvis.rotation']*rad;
   // The authored support helper uses the same explicit mass estimate. Artwork
   // is not a mass solver: this checks the supplied (0,-30) reference point.
   const mass={x:w.root.x+30*Math.sin(roll),y:w.root.y-30*Math.cos(roll)};
   assert.ok(sign*p['pelvis.rotation']>10,clip+' must lean toward the support, not away');
   assert.ok(sign*(180-w.root.x)>30,clip+' root must follow the supporting hand');
   assert.ok(Math.abs(mass.x-anchor.x)<8,clip+' estimated mass stays near the gravity line');
   assert.ok(mass.y>anchor.y+75,clip+' mass remains suspended below the hand');
   assert.ok(distance(w[held+'Hand'],anchor)<.06,clip+' exact hand contact survives body balance');
   assert.ok(frame.contacts.filter(v=>v.active).every(v=>v.error<.06));
   assert.ok(distance(w[held+'Upper'],anchor)<80,clip+' held arm target remains reachable');
   const free=held==='left'?'right':'left',outward=free==='right'?1:-1;
   // Compare in the body's transverse direction; a leaning body can place an
   // elbow inward in screen X without folding it through the chest.
   const localX=(w[free+'Lower'].x-w.torso.x)*Math.cos(roll)+(w[free+'Lower'].y-w.torso.y)*Math.sin(roll);
   assert.ok(localX*outward>22,clip+' free elbow remains outside the torso center');
   for(const side of ['left','right'])assert.ok(w[side+'Foot'].y<383,clip+' feet remain airborne');
   poses.push({root:w.root,roll:p['pelvis.rotation']});
  }
  assert.ok(Math.abs(poses[0].root.x+poses[1].root.x-360)<.02);
  assert.ok(Math.abs(poses[0].roll+poses[1].roll)<.02);
  assert.ok(Math.abs(poses[2].root.x+poses[3].root.x-360)<.02);
 }finally{c.dispose();}
});

test('switching the supporting hand is continuous, reachable and independent of preview seek order',()=>{
 const c=new SceneController(doc);try{
  let previous;
  for(let i=0;i<=348;i++){
   const {world:w,frame}=sample(c,'hang-switch',i/60);
   for(const contact of frame.contacts.filter(v=>v.active))assert.ok(contact.error<.06,'hand-switch contact remains pinned');
   for(const side of ['left','right']){
    assert.ok(distance(w[side+'Upper'],w[side+'Hand'])<=80.01,'arms cannot extend beyond two 40px links');
    assert.ok(w[side+'Foot'].y<=383.2,'switching support never pushes a foot through the floor');
   }
   if(previous)for(const joint of ['root','leftHand','rightHand','leftLower','rightLower'])assert.ok(distance(w[joint],previous[joint])<16,`${joint} jumps during hand transfer at ${i/60}`);
   previous=w;
  }
  const expected=sample(c,'hang-switch',1.3);sample(c,'release-cheer',4.5);sample(c,'hang-switch',5.8);assert.deepEqual(sample(c,'hang-switch',1.3),expected);
 }finally{c.dispose();}
});
