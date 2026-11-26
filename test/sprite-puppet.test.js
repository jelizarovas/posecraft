import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSpriteDrawList,compileSpritePuppet,sampleSpritePuppet,spriteDrawingTimes,validateSpritePuppet} from '../src/sprite-puppet.js';
import example from '../examples/characters/porch-zombie.puppet.json' with {type:'json'};

const rig=compileSpritePuppet(example);
const pose=(seconds,part)=>sampleSpritePuppet(rig,seconds).find(p=>p.id===part);
const image=(seconds,part)=>example.atlas.images[pose(seconds,part).tile];
test('a turning parent projects a child in depth and selects art independently of the gesture track',()=>{
  const doc=structuredClone(example);
  doc.parts=['body','leftHand'].map((id,i)=>({
    id,parent:i?'body':null,x:i?4:0,y:0,size:1,pivot:0,depth:0,rotation:0,image:'palm',variants:[],
    space:i?{z:2,bearings:{range:[0,90],images:{palm:['palm','four']}}}:{},
  }));
  doc.clip.tracks={'body.yaw':[[0,0,'linear'],[1,90,'linear']]};
  const rig=compileSpritePuppet(doc),hand=t=>sampleSpritePuppet(rig,t)[1];
  assert.equal(hand(0).x,4);assert.equal(hand(0).z,2);
  assert.ok(Math.abs(hand(1).x-2)<1e-8&&Math.abs(hand(1).z+4)<1e-8);
  assert.equal(doc.atlas.images[hand(1).tile],'four');
  assert.ok(Math.abs(hand(.5).bearing-45)<1e-8);
  delete doc.parts[0].space;delete doc.parts[1].space;doc.clip.tracks={};
  assert.equal(sampleSpritePuppet(compileSpritePuppet(doc),0)[1].x,4);
});
test('the far wrist turns from its dorsal drawing to palm while the other hand counts',()=>{
  assert.ok(Math.abs(pose(0,'leftHand').bearing)>120);
  assert.equal(image(3.2,'leftHand'),'palm');
  assert.ok(pose(0,'leftShoulder').z<pose(0,'rightShoulder').z);
  const head=sampleSpritePuppet(rig,0,{view:48}).find(p=>p.id==='head');
  assert.equal(head.bearing,0);
});
test('signed stops follow the permitted long arc and clamp both keyed and preview angles',()=>{
  const doc=structuredClone(example),body=doc.parts[0];
  body.space={limits:{yaw:[-120,120]}};delete body.skin;doc.parts=[body];
  doc.clip.tracks={'body.yaw':[[0,-200,'linear'],[1,200,'linear']]};
  const rig=compileSpritePuppet(doc);
  for(const [t,expected] of [[0,-120],[.25,-60],[.5,0],[.75,60],[1,120]])
    assert.ok(Math.abs(sampleSpritePuppet(rig,t)[0].bearing-expected)<1e-8);
  assert.ok(Math.abs(sampleSpritePuppet(rig,0,{'body.yaw':900})[0].bearing-120)<1e-8);
  body.space.limits.yaw=[80,-80];assert.throws(()=>validateSpritePuppet(doc),/limits/);
});
test('reassembling a joint cannot move its anatomical stops',()=>{
  const doc=structuredClone(example),body=doc.parts[0],arm=doc.parts.find(p=>p.id==='leftShoulder');
  delete body.skin;body.rotation=0;body.space={};
  delete arm.registration;arm.rotation=10;arm.space={limits:{rotation:[-30,40]}};
  doc.parts=[body,arm];doc.clip.tracks={};
  const bound=compileSpritePuppet(doc,{[body.id]:{},[arm.id]:{rotation:110}});
  const angle=offset=>sampleSpritePuppet(bound,0,{[arm.id+'.rotation']:offset})[1].rotation;
  assert.ok(Math.abs(angle(0)-50)<1e-8);
  assert.ok(Math.abs(angle(-200)+20)<1e-8);
});
test('pronation and supination rotate around the actual elbow-to-wrist line, with mirrored stops',()=>{
  for(const side of ['left','right']){
    const part=example.parts.find(p=>p.id===side+'Elbow');
    const [min,max]=part.space.limits.twist;
    assert.deepEqual([min,max],side==='left'?[0,180]:[-180,0]);
    const hand=v=>sampleSpritePuppet(rig,3.2,{[part.id+'.twist']:v}).find(p=>p.id===side+'Hand');
    const wrist=p=>{const r=p.rotation*Math.PI/180,d=example.parts.find(s=>s.id===p.id).pivot*p.size*p.stretch;return [p.x-Math.sin(r)*d,p.y+Math.cos(r)*d,p.z];};
    assert.deepEqual(hand(-300),hand(min));assert.deepEqual(hand(300),hand(max));
    assert.notEqual(hand(min).tile,hand(max).tile);
    const a=wrist(hand(min)),b=wrist(hand(max));assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-7);
  }
});
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
    assert.ok(Math.abs(sample.z-foot.z)<1e-8);
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

test('compiled crowd frames retain socket transforms and fall back for unbaked cloth',()=>{
  const parent={id:'body',x:10,y:20,rotation:90,size:1,tile:0};
  const child={...parent,id:'hand',x:13,y:24,rotation:90,size:2,stretch:.5,tile:1};
  const packed=compileSpriteDrawList(example,[[parent,child]],'body');
  assert.deepEqual([...packed.offsets],[0,22]);
  const [sheet,sx,sy,w,h,a,b,c,d,x,y]=packed.commands.slice(11);
  assert.deepEqual([sheet,sx,sy,w,h],[0,example.atlas.tile,0,example.atlas.tile,example.atlas.tile]);
  assert.ok(Math.abs(a-18)<1e-6&&Math.abs(b)<1e-6&&Math.abs(c)<1e-6&&Math.abs(d-9)<1e-6);
  assert.ok(Math.abs(x+5)<1e-6&&Math.abs(y+7.5)<1e-6);
  const shirt={...parent,deformation:{view:0,angles:[30]}};
  assert.equal(compileSpriteDrawList(example,[[shirt]],'body'),null);
  assert.equal(compileSpriteDrawList(example,[[shirt]],'body',{'body/0/0/30':[1,2,3,4,5,6]}).commands[0],1);
});
