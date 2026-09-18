import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymWalk} from '../examples/gym.js';
import {gymBenchTargets} from '../examples/gym-room.js';
import {sampleClip,wrapAngle} from '../src/index.js';
import {spatialKinematics,spatialParts} from '../src/spatial.js';
const pose=(p,clip,t)=>sampleClip({...p.clips[clip],loop:false},t);
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('free arms bend toward camera with elbows outside the torso instead of inward hinges',()=>{
 const p=createGym().packs.atlas;
 for(const [clip,t,name,side]of [['jump-grab-left',1.8,'right',1],['jump-grab-right',1.8,'left',-1],['release-one-hand',1.5,'right',1]]){
  const q=pose(p,clip,t),w=spatialKinematics(p,q),shoulder=w[name+'Upper'],elbow=w[name+'Lower'],hand=w[name+'Hand'];
  const roll=q['pelvis.rotation']*Math.PI/180,transverse=(elbow.x-w.torso.x)*Math.cos(roll)+(elbow.y-w.torso.y)*Math.sin(roll);
  assert.ok(transverse*side>22,'free elbow remains outside the torso in body coordinates');assert.ok(elbow.z-shoulder.z>2,'real depth foreshortens the relaxed arm');
  assert.ok(Math.abs(length(shoulder,elbow)-40)<.01);assert.ok(Math.abs(length(elbow,hand)-40)<.01);
  assert.ok(Math.abs(q[name+'Upper.yaw'])>1&&Math.abs(q[name+'Lower.yaw'])>1);
 }
});

test('hanging knees fold in depth and walking ankles turn and flex without moving support anchors',()=>{
 const p=createGym().packs.atlas,w=spatialKinematics(p,pose(p,'jump-grab-left',1.8));
 for(const name of ['left','right']){
  const hip=w[name+'Thigh'],knee=w[name+'Calf'],foot=w[name+'Foot'];assert.ok(knee.z>18);
  const sideways=Math.abs((foot.x-hip.x)*(knee.y-hip.y)-(foot.y-hip.y)*(knee.x-hip.x))/Math.hypot(foot.x-hip.x,foot.y-hip.y);assert.ok(sideways<knee.z*.55,'depth carries most of the knee bend even when the body leans');
  assert.ok(Math.abs(length(hip,knee)-36)<.01);assert.ok(Math.abs(length(knee,foot)-36)<.01);
 }
 let flex=0,depth=0,planted=0;const heading=m=>Math.atan2(m[2],m[8])*180/Math.PI;
 for(let t=29.5;t<35;t+=.05){const q=pose(p,'full-set',t),f=spatialKinematics(p,q),walk=gymWalk(t-29,0,7,{x:180,y:383},{x:710,y:383});depth=Math.max(depth,f.leftCalf.z,f.rightCalf.z);for(const name of ['left','right']){const m=f[name+'Foot'].m;flex=Math.max(flex,Math.abs(Math.asin(Math.max(-1,Math.min(1,-m[5])))*180/Math.PI));if(walk.feet[name].planted){planted++;assert.ok(Math.abs(wrapAngle(heading(m)-q['torso.yaw']))<5,'world sole follows travel heading after inherited leg rotation');assert.ok(Math.abs(m[3])<.08,'planted sole remains level');}}}
 assert.ok(flex>10&&depth>8&&planted>10);
 const back=spatialKinematics(p,pose(p,'full-set',54)).leftFoot.m,outbound=spatialKinematics(p,pose(p,'full-set',31)).leftFoot.m;assert.ok(Math.abs(wrapAngle(heading(back)-heading(outbound)))>120,'returning soles face the opposite world direction');
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
