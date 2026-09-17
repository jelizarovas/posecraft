import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationController, forwardKinematics, interpolate, mixAngle, sampleClip, solveTwoBoneIK } from '../examples/wwwzard/engine.js';
import { wwwzardDefinition } from '../examples/wwwzard/definition.js';
import { hemTargets } from '../examples/wwwzard/cloth.js';
import {keyTarget, heldHandTargets} from '../examples/wwwzard/keyboard.js';

test('keyboard maps keys spatially and releases each hand independently',()=>{
  assert.ok(keyTarget('KeyA').x<keyTarget('KeyL').x);
  assert.equal(keyTarget('KeyA').side,'left');assert.equal(keyTarget('KeyL').side,'right');
  assert.equal(keyTarget('Tab'),null);
  const held=new Set(['KeyA','KeyL']);
  assert.equal(heldHandTargets(held).left.down,true);assert.equal(heldHandTargets(held).right.down,true);
  held.delete('KeyA');assert.equal(heldHandTargets(held).left.down,false);assert.equal(heldHandTargets(held).right.down,true);
});

test('keyboard layer holds its target through time without repeating the typing loop',()=>{
  const c=new AnimationController(wwwzardDefinition);
  c.send('WORK');c.setInput('keyboardDriven',true);c.setLayerWeight('Keyboard',1);
  const key=keyTarget('KeyA');c.setInput('keyLeftX',key.x);c.setInput('keyLeftY',key.y);
  c.step(1.5);c.step(.2);
  const a=c.frame.pose['ik.left.y'];c.step(.4);assert.equal(c.frame.pose['ik.left.y'],a);
  c.setInput('typing',false);c.setInput('keyLeftY',394);c.step(.1);
  assert.equal(c.frame.layers[0].state,'working');assert.equal(c.frame.pose['ik.left.y'],394);
});

const fresh = () => new AnimationController(wwwzardDefinition);
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a-b) < tolerance, a + ' != ' + b);
const arm = [
  { id: 'shoulder', parent: null, x: 0, y: 0, length: 50, rotation: 0, min: -180, max: 180 },
  { id: 'elbow', parent: 'shoulder', x: 50, y: 0, length: 50, rotation: 0, min: -180, max: 180 }
];
const chain = { upper: 'shoulder', lower: 'elbow', bend: 1 };

test('idle has no workstation and typing introduces furniture before hands',()=>{
  const c=fresh();
  close(c.frame.pose['desk.visible'],0);close(c.frame.pose['laptop.visible'],0);close(c.frame.pose.stance,1);
  c.send('WORK');c.step(.3);
  assert.equal(c.frame.layers[0].state,'preparing');
  assert.ok(c.frame.pose['desk.visible']>0);close(c.frame.pose['laptop.visible'],0);close(c.frame.pose['ik.left.weight'],0);
  c.step(.55);close(c.frame.pose['laptop.visible'],1);
  c.step(.5);c.step(.2);assert.equal(c.frame.layers[0].state,'working');close(c.frame.pose['desk.visible'],1);
  c.send('READ');c.step(.4);close(c.frame.pose['desk.visible'],0);close(c.frame.pose['laptop.visible'],0);
});

test('arm depth transitions independently and reverses without a pose jump',()=>{
  const c=fresh();c.setInput('leftArmBehind',true);c.step(.1);
  const depth=c.frame.pose['left.depth'];assert.ok(depth>0 && depth<1);close(c.frame.pose['right.depth'],0);
  c.setInput('leftArmBehind',false);c.step(0);close(c.frame.pose['left.depth'],depth);
  c.step(.4);close(c.frame.pose['left.depth'],0);
  c.setInput('rightArmBehind',true);c.step(.4);close(c.frame.pose['right.depth'],1);close(c.frame.pose['left.depth'],0);
});

test('cancelling the workstation introduction clears its props',()=>{
  const c=fresh();c.send('WORK');c.step(.65);c.send('REST');c.step(.4);
  assert.equal(c.frame.layers[0].state,'idle');close(c.frame.pose['desk.visible'],0);close(c.frame.pose['laptop.visible'],0);
});

test('forward kinematics rotates child offsets with their parent', () => {
  const world = forwardKinematics(arm, { 'shoulder.rotation': 90 });
  close(world.elbow.x, 0); close(world.elbow.y, 50); close(world.elbow.endY, 100);
});
test('linear, smooth and stepped interpolation differ at interior times', () => {
  const keys = [[0,0],[1,10]];
  close(interpolate(keys,.25,'linear'),2.5);
  close(interpolate(keys,.25,'smooth'),1.5625);
  close(interpolate(keys,.25,'step'),0);
  close(interpolate(keys,1,'step'),10);
});
test('loop sampling wraps while one-shot clips hold their endpoint', () => {
  const clip = { duration: 1, tracks: { x: [[0,0],[1,10]] } };
  close(sampleClip({...clip,loop:true},1.5,'linear').x,5);
  close(sampleClip(clip,1.5,'linear').x,10);
  close(mixAngle(170,-170,.5),180);
});
test('two-bone IK reaches a target and preserves bone lengths', () => {
  const result = solveTwoBoneIK(arm, {}, chain, {x:50,y:50});
  const world = forwardKinematics(arm,result);
  close(world.elbow.endX,50);close(world.elbow.endY,50);
  close(Math.hypot(world.elbow.endX-world.elbow.x,world.elbow.endY-world.elbow.y),50);
});
test('IK clamps unreachable targets and zero-distance targets remain finite', () => {
  for (const target of [{x:400,y:0},{x:0,y:0}]) {
    const pose=solveTwoBoneIK(arm,{},chain,target);
    assert.ok(Object.values(pose).every(Number.isFinite));
    const world=forwardKinematics(arm,pose);
    assert.ok(Math.hypot(world.elbow.endX,world.elbow.endY)<=100.0001);
  }
});
test('joint constraints still apply to unreachable IK targets', () => {
  const limited=arm.map(j=>({...j,min:0,max:20}));
  const pose=solveTwoBoneIK(limited,{},chain,{x:-80,y:-30});
  assert.ok(Object.values(pose).every(value=>value>=0 && value<=20));
});
test('zero IK weight preserves the incoming constrained pose', () => {
  const source={'shoulder.rotation':25,'elbow.rotation':40};
  assert.deepEqual(solveTwoBoneIK(arm,source,chain,{x:20,y:75},0),source);
});
test('rotated parent transforms are respected by IK', () => {
  const joints=[{id:'root',parent:null,x:30,y:20,length:0,rotation:35,min:-180,max:180}, {...arm[0],parent:'root'},arm[1]];
  const pose=solveTwoBoneIK(joints,{},chain,{x:50,y:65});
  const world=forwardKinematics(joints,pose);
  close(world.elbow.endX,50);close(world.elbow.endY,65);
});
test('invalid inputs, bad limits and malformed skeletons fail at the boundary', () => {
  const c=fresh();
  assert.throws(()=>c.setInput('tempo',NaN));assert.throws(()=>c.setInput('typing',1));
  assert.throws(()=>c.setInput('unknown',1));assert.throws(()=>c.step(-1));
  assert.throws(()=>c.send('INVALID'));assert.throws(()=>c.setJointLimit('head',20,-20));
  assert.throws(()=>new AnimationController({...wwwzardDefinition,joints:[...wwwzardDefinition.joints].reverse()}));
  c.setInput('activity',50);close(c.inputs.activity,1);
});
test('boolean input transitions to working and back to idle', () => {
  const c=fresh();c.setInput('typing',true);c.step(.01);c.step(1.3);
  assert.equal(c.frame.layers[0].state,'working');
  c.setInput('typing',false);c.step(.3);assert.equal(c.frame.layers[0].state,'idle');
});
test('WORK event activates typing without extra input setup', () => {
  const c=fresh();c.send('WORK');c.step(1.3);assert.equal(c.frame.layers[0].state,'working');
});
test('crossfade interruption starts at the current mixed pose', () => {
  const c=fresh();c.send('READ');c.step(.1);
  const before=c.frame.pose['book.visible'];
  assert.ok(before>0 && before<1);
  c.send('REST');c.step(0);close(c.frame.pose['book.visible'],before);
  c.step(.3);close(c.frame.pose['book.visible'],0);
});
test('blend input interpolates between thinking and typing clips', () => {
  const poses=[0,.5,1].map(value=>{const c=fresh();c.setInput('activity',value);c.send('WORK');c.step(1.3);return c.step(.5).pose;});
  close(poses[1]['ik.left.y'],(poses[0]['ik.left.y']+poses[2]['ik.left.y'])/2);
  assert.notEqual(poses[0]['ik.left.y'],poses[2]['ik.left.y']);
});
test('breathing can be muted while action and face keep playing', () => {
  const c=fresh();c.setLayerWeight('Breathing',0);c.send('WORK');c.step(2.77);
  close(c.frame.pose['torso.y'],0);close(c.frame.pose['eyes.open'],0);
  assert.equal(c.frame.layers[0].state,'working');
});
test('send fires release and delivery once, then returns to idle', () => {
  const c=fresh(), events=[];c.subscribe(e=>events.push(e));c.send('SEND');
  for(let i=0;i<120;i++)c.step(1/30);
  assert.equal(events.filter(e=>e.name==='envelope:release').length,1);
  assert.equal(events.filter(e=>e.name==='envelope:delivered').length,1);
  assert.equal(c.frame.layers[0].state,'idle');close(c.frame.pose['envelope.visible'],0);
});
test('a long frame crosses all clip markers without dropping them', () => {
  const c=fresh(),events=[];c.subscribe(e=>events.push(e));c.send('SEND');c.step(3);
  assert.deepEqual(events.filter(e=>e.type==='marker' && e.layer==='Action').map(e=>e.name),['envelope:release','envelope:delivered']);
});
test('loop markers repeat across cycles and unsubscribe removes listeners', () => {
  const c=fresh(), events=[];const stop=c.subscribe(e=>events.push(e));c.send('READ');c.step(8);
  assert.equal(events.filter(e=>e.name==='page:turn').length,3);
  stop();const count=events.length;c.step(10);assert.equal(events.length,count);
});
test('manual target and adjusted constraints remain valid during mixing', () => {
  const c=fresh();c.setInput('manualIK',true);c.setInput('rightX',600);c.setInput('rightY',180);
  c.setJointLimit('rightUpper',-20,20);c.send('WORK');
  for(let i=0;i<100;i++){
    const frame=c.step(.02);
    assert.ok(frame.pose['rightUpper.rotation']>=-20 && frame.pose['rightUpper.rotation']<=20);
    assert.ok(Object.values(frame.pose).every(Number.isFinite));
  }
});
test('rotation tracks interpolate over the short angular arc',()=>{
  close(sampleClip({duration:1,tracks:{'head.rotation':[[0,170],[1,-170]]}},.5,'linear')['head.rotation'],180);
});
test('walking and running activate leg animation and standing posture',()=>{
  const c=fresh();c.send('WALK');const a=c.step(.4);
  const angle=a.pose['leftThigh.rotation'];const b=c.step(.3);
  assert.notEqual(angle,b.pose['leftThigh.rotation']);close(b.pose.stance,1);
  c.send('RUN');c.step(.3);close(c.inputs.stride,1);
  assert.equal(c.frame.layers.find(l=>l.name==='Locomotion').state,'moving');
  c.send('REST');c.step(.4);close(c.frame.pose.stance,1);
  assert.equal(c.frame.layers.find(l=>l.name==='Locomotion').state,'still');
});
test('cloth responds to gait and settles within bounded displacement',()=>{
  const c=fresh();c.send('RUN');let moved=false;
  for(let i=0;i<400;i++){
    const frame=c.step(1/60), targets=hemTargets(frame.world,frame.pose.stance);
    frame.cloth.forEach((point,index)=>{
      assert.ok([point.x,point.y,point.vx,point.vy].every(Number.isFinite));
      assert.ok(Math.abs(point.y-targets[index].y)<=24.001);
      if(Math.abs(point.y-targets[index].y)>.5)moved=true;
    });
  }
  assert.ok(moved);
  c.setInput('clothEnabled',false);const frame=c.step(.1), targets=hemTargets(frame.world,frame.pose.stance);
  frame.cloth.forEach((point,index)=>{close(point.x,targets[index].x);close(point.y,targets[index].y);});
});
test('takes scrub, mix, override IK and round-trip through JSON',()=>{
  const c=fresh();c.setKeyframe('head',0,-10);c.setKeyframe('head',2,10);
  c.seek(1);close(c.frame.pose['head.rotation'],0);
  c.setKeyframe('rightUpper',0,10);c.seek(1);close(c.frame.pose['rightUpper.rotation'],10);
  const data=JSON.parse(JSON.stringify(c.exportTake()));const loaded=fresh();loaded.importTake(data);loaded.seek(1);
  close(loaded.frame.pose['head.rotation'],0);close(loaded.frame.pose['rightUpper.rotation'],10);
  loaded.take.weight=0;loaded.step(0);assert.notEqual(loaded.frame.pose['rightUpper.rotation'],10);
});
test('bad imports do not replace the working take',()=>{
  const c=fresh();c.setKeyframe('head',0,5);const before=c.exportTake();
  for(const data of [
    {version:1,duration:0,tracks:{}},
    {version:1,duration:4,tracks:{'unknown.rotation':[[0,1]]}},
    {version:1,duration:4,tracks:{'head.rotation':[[0,100]]}},
    {version:1,duration:4,tracks:{'head.rotation':[[2,0],[1,1]]}},
    {version:1,duration:4,tracks:{'head.rotation':[[0,NaN]]}}
  ]){assert.throws(()=>c.importTake(data));assert.deepEqual(c.exportTake(),before);}
});
test('keyframe replacement and deletion do not leave duplicate keys',()=>{
  const c=fresh();c.setKeyframe('head',0,1);c.setKeyframe('head',0,2);
  assert.deepEqual(c.take.tracks['head.rotation'],[[0,2]]);
  c.removeKeyframe('head',0);assert.equal(c.take.tracks['head.rotation'],undefined);
});
test('prop states emit interaction markers and emotions coexist with blinking',()=>{
  const c=fresh(), events=[];c.subscribe(e=>events.push(e));c.send('POUR');c.step(3.1);
  assert.deepEqual(events.filter(e=>e.type==='marker'&&e.layer==='Action').map(e=>e.name),['flask:pour-start','flask:pour-stop']);
  c.setInput('emotion','pouting');c.step(.3);close(c.frame.pose['face.smile'],-1);
  c.send('BLINK');c.step(.08);close(c.frame.pose['eyes.open'],0);close(c.frame.pose['face.smile'],-1);
  assert.throws(()=>c.setInput('emotion','invalid'));
});
