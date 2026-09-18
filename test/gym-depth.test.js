import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {gymBenchTargets} from '../examples/gym-room.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics,spatialParts} from '../src/spatial.js';
const pose=(p,clip,t)=>sampleClip({...p.clips[clip],loop:false},t);
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('free arms bend toward camera with elbows outside the torso instead of inward hinges',()=>{
 const p=createGym().packs.atlas;
 for(const [clip,t,name,side]of [['jump-grab-left',1.8,'right',1],['jump-grab-right',1.8,'left',-1],['release-one-hand',1.5,'right',1]]){
  const q=pose(p,clip,t),w=spatialKinematics(p,q),shoulder=w[name+'Upper'],elbow=w[name+'Lower'],hand=w[name+'Hand'];
  assert.ok((elbow.x-shoulder.x)*side>1,'elbow remains outside its shoulder');assert.ok(elbow.z>10,'real depth foreshortens the bent arm');
  assert.ok(Math.abs(length(shoulder,elbow)-40)<.01);assert.ok(Math.abs(length(elbow,hand)-40)<.01);
  assert.ok(Math.abs(q[name+'Upper.yaw'])>10&&Math.abs(q[name+'Lower.yaw'])>10);
 }
});

test('hanging knees fold in depth and walking ankles turn and flex without moving support anchors',()=>{
 const p=createGym().packs.atlas,w=spatialKinematics(p,pose(p,'jump-grab-left',1.8));
 for(const name of ['left','right']){
  const hip=w[name+'Thigh'],knee=w[name+'Calf'],foot=w[name+'Foot'];assert.ok(knee.z>18);
  const sideways=Math.abs((foot.x-hip.x)*(knee.y-hip.y)-(foot.y-hip.y)*(knee.x-hip.x))/Math.hypot(foot.x-hip.x,foot.y-hip.y);assert.ok(sideways<knee.z*.55,'depth carries most of the knee bend even when the body leans');
  assert.ok(Math.abs(length(hip,knee)-36)<.01);assert.ok(Math.abs(length(knee,foot)-36)<.01);
 }
 let flex=0,depth=0;
 for(let t=29.5;t<35;t+=.05){const q=pose(p,'full-set',t),f=spatialKinematics(p,q);flex=Math.max(flex,Math.abs(q['leftFoot.pitch']),Math.abs(q['rightFoot.pitch']));depth=Math.max(depth,f.leftCalf.z,f.rightCalf.z);assert.ok(Math.abs(q['leftFoot.yaw']-q['torso.yaw'])<1,'ankle follows authored travel heading');}
 assert.ok(flex>10&&depth>8);
 const back=pose(p,'full-set',54),outbound=pose(p,'full-set',31);assert.ok(Math.abs(back['leftFoot.yaw']-outbound['leftFoot.yaw'])>120,'returning feet face the opposite direction');
});

test('reclining turns chest and pelvis together, with grouped hips and planted bench feet',()=>{
 const p=createGym().packs.atlas;assert.equal(p.parts.find(v=>v.id==='shorts').joint,'pelvis');assert.equal(p.parts.find(v=>v.id==='shorts-stripe').joint,'pelvis');
 const q=pose(p,'full-set',42),w=spatialKinematics(p,q);
 const targets=gymBenchTargets(),roll=Math.atan2(targets.back.x-targets.hips.x,targets.hips.y-targets.back.y)*180/Math.PI;assert.equal(q['torso.yaw'],60);assert.equal(q['pelvis.yaw'],60);assert.ok(Math.abs(q['torso.rotation']-roll)<.01);assert.ok(Math.abs(q['pelvis.rotation']-roll)<.01);
 assert.ok(Math.hypot(w.torso.m[0],w.torso.m[3])<.51,'chest is visibly foreshortened');
 assert.ok(Math.abs(w.leftThigh.x-w.rightThigh.x)<1,'hips turn out of the frontal stance');
 for(const name of ['left','right'])assert.ok(Math.hypot(w[name+'Foot'].x-targets.feet[name].x,w[name+'Foot'].y-targets.feet[name].y)<2.5,'foot stays at perspective floor contact');
 // Waist and waistband share the same transverse direction as the trunk reclines.
 assert.ok(Math.abs(w.torso.m[0]-w.pelvis.m[0])<.001&&Math.abs(w.torso.m[3]-w.pelvis.m[3])<.001);
 for(const t of [36,38,39,40,49,50,52.5]){
  const a=pose(p,'full-set',t),spatial=spatialParts(p,{pose:a});for(const part of spatial.parts.values()){assert.ok(part.matrix.every(Number.isFinite));assert.ok(!part.d||!part.d.includes('NaN'));}
 }
});
