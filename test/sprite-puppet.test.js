import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSpritePuppet,sampleSpritePuppet,spriteDrawingTimes,validateSpritePuppet} from '../src/sprite-puppet.js';
import example from '../examples/characters/porch-zombie.puppet.json' with {type:'json'};

const rig=compileSpritePuppet(example);
const pose=(seconds,part)=>sampleSpritePuppet(rig,seconds).find(p=>p.id===part);
const image=(seconds,part)=>example.atlas.images[pose(seconds,part).tile];
test('direction, expression and hand drawings change independently of the waving arm',()=>{
  assert.equal(image(0,'head'),'profile');
  assert.equal(image(.585,'body'),'torsoQuarter');
  assert.equal(image(1.3,'head'),'front');
  assert.equal(image(2.6,'rightHand'),'fist');
  assert.equal(image(2.7,'rightHand'),'uncurl');
  assert.equal(image(3,'rightHand'),'four');
  const headAt=(seconds,overrides)=>sampleSpritePuppet(rig,seconds,overrides).find(p=>p.id==='head');
  const tiles=spriteDrawingTimes(example).map(t=>headAt(t).tile);
  assert.equal(new Set(tiles).size,49);
  const displayed=Array.from({length:47},(_,i)=>headAt(.2+i/60).tile);
  assert.ok(new Set(displayed).size>=44,'turn advances on nearly every 60 Hz refresh');
  for(let view=0;view<49;view++){
    const rest=headAt(0,{view});
    for(const channel of ['leftEyelid','rightEyelid','mouth']){
      const samples=Array.from({length:11},(_,level)=>headAt(0,{view,[channel]:level}));
      assert.equal(new Set(samples.map(p=>p.layers.find(l=>l.channel===channel).x)).size,11);
      assert.deepEqual(samples.map(p=>p.layers.find(l=>l.channel===channel).empty),[true,...Array(10).fill(false)]);
      for(const p of samples){
        assert.equal(p.tile,rest.tile);
        assert.deepEqual(p.layers.filter(l=>l.channel!==channel),rest.layers.filter(l=>l.channel!==channel));
      }
    }
  }
  assert.equal(image(4.35,'rightHand'),'four');
  assert.ok(Math.abs(pose(1.85,'leftHand').rotation-pose(2.17,'leftHand').rotation)>20);
  assert.deepEqual(sampleSpritePuppet(rig,0),sampleSpritePuppet(rig,example.clip.duration));
});
test('the trousers follow the pelvis and the supporting boot stays planted through the wave',()=>{
  for(const side of ['left','right']){
    assert.equal(example.parts.find(p=>p.id===side+'Hip').parent,'pelvis');
    const slots=['Hip','Knee','Foot','Shoulder','Elbow','Hand'].map(j=>image(0,side+j));
    assert.equal(new Set(slots).size,slots.length);
  }
  for(const t of [0,.55,5.9])assert.ok(pose(t,'leftHand').depth<pose(t,'leftHip').depth);
  assert.ok(pose(2.88,'leftHand').depth>pose(2.88,'leftHip').depth);
  for(const t of [0,.55,5.9])assert.ok(pose(t,'leftShoulder').depth<pose(t,'pelvis').depth);
  const foot=pose(0,'leftFoot');
  for(let i=0;i<408;i++){
    const sample=pose(i/60,'leftFoot');
    assert.ok(Math.hypot(sample.x-foot.x,sample.y-foot.y)<.03);
  }
  assert.ok(Math.abs(pose(3.18,'rightKnee').rotation-pose(0,'rightKnee').rotation)>8);
  assert.notEqual(image(0,'pelvis'),image(1.82,'pelvis'));
  assert.ok(Math.abs(pose(1,'pelvis').rotation-pose(2,'pelvis').rotation)>2);
  assert.ok(Math.abs(foot.y-18.7)<.05,'support boot retains the authored waistband-to-sole distance');
});
test('an independently held turn keeps the arm on the sleeve socket',()=>{
  const front=sampleSpritePuppet(rig,0,{view:48}),quarter=sampleSpritePuppet(rig,0,{view:24});
  const arm=pose=>pose.find(p=>p.id==='rightShoulder');
  assert.notEqual(arm(front).tile,arm(quarter).tile);
  assert.ok(arm(front).x-arm(quarter).x>.8);
  assert.equal(arm(front).rotation,arm(quarter).rotation);
});
test('a second bind pose with one arm segment keeps its authored wrist position and bend at rest',()=>{
  const doc=structuredClone(example);
  doc.clip.tracks={};doc.clip.loop=false;
  const bindings={body:{x:1,y:2,rotation:30,size:1},leftShoulder:{x:-4,y:6,rotation:12,size:.8},
    leftHand:{x:-7,y:11,rotation:50,size:.6}};
  const result=sampleSpritePuppet(compileSpritePuppet(doc,bindings),0);
  for(const p of result)for(const field of ['x','y','rotation','size'])assert.ok(Math.abs(p[field]-bindings[p.id][field])<1e-9);
});
test('a malformed drawing key fails before replacing an open puppet',()=>{
  const doc=structuredClone(example);doc.clip.tracks.grip[0][1]=99;
  assert.throws(()=>validateSpritePuppet(doc),/grip/);
});
test('shirt deformation follows independent shoulder edits, including partial assemblies and legacy puppets',()=>{
  const doc=structuredClone(example);
  doc.clip.tracks={'view':[[0,48,'step']],'leftShoulder.rotation':[[0,82]],'rightShoulder.rotation':[[0,-16]]};
  const body=rig=>sampleSpritePuppet(rig,0).find(p=>p.id==='body');
  assert.deepEqual(body(compileSpritePuppet(doc)).deformation.angles,[82,-16]);
  const parts=Object.fromEntries(doc.parts.filter(p=>['body','rightShoulder'].includes(p.id)).map(p=>[p.id,p]));
  assert.deepEqual(body(compileSpritePuppet(doc,parts)).deformation.angles,[0,-16]);
  const skin=doc.parts[0].skin;
  delete doc.parts[0].skin;
  assert.equal(body(compileSpritePuppet(doc)).deformation,undefined);
  doc.parts[0].skin=skin;skin.views[48].weights='AQ==';
  assert.throws(()=>validateSpritePuppet(doc),/skin weights/);
});
