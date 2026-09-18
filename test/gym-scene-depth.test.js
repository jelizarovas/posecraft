import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymWalk} from '../examples/gym.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {gymSceneDepths} from '../examples/gym-room.js';
test('gym floor plane follows walking but remains fixed during jumping and pull-ups',()=>{
 const d=createGym(),p=d.packs.atlas,world=(clip,t)=>spatialKinematics(p,sampleClip(p.clips[clip],t));
 assert.equal(d.actors.find(a=>a.id==='atlas').depth.joint,'floor-depth');for(const clip of ['jump-grab-left','pull-lead-left','hang-switch'])for(const t of [0,.6,1.8,3.4])assert.equal(world(clip,t)['floor-depth'].y,383);
 assert.ok(Math.abs(world('jump-grab-left',.6).root.y-world('jump-grab-left',1.8).root.y)>10);
 for(const t of [29,30.5,32,34.5,36])assert.ok(Math.abs(world('full-set',t)['floor-depth'].y-gymWalk(t,29,36,180,710).floorY)<.85);
 assert.equal(world('bench-lead-left',1.6)['floor-depth'].y,gymSceneDepths.bench);assert.ok(d.packs.atlas.parts.filter(p=>p.joint==='barbell').every(p=>p.spatial.sceneDepth.value===gymSceneDepths.bench));
});
test('parked bottle depth persists separately while carried depth matches the character',()=>{
 const d=createGym(),g=d.behaviorGraph,p=d.packs.atlas;Object.assign(g.variables,{bottleLocation:1,bottleX:320,bottleY:205,bottleDepth:323});const c=new SceneController(d);try{const f=c.frame(),a=f.actors.find(a=>a.id==='atlas'),w=spatialKinematics(p,a.pose);assert.equal(w['depth-bottle'].y,323);assert.equal(w['water-bottle'].y,205);assert.equal(w['floor-depth'].y,383);}finally{c.dispose();}
 for(const source of [0,1,2]){const variant=g.activities['drink-bar'].variants.find(v=>v.when.value===source),clip=p.clips[variant.clip];let held=0;for(let t=0;t<clip.duration;t+=.13){const pose=sampleClip(clip,t);if(pose['water-bottle.rotation']<-50){assert.ok(Math.abs((pose['depth-bottle.y']||0)-(pose['floor-depth.y']||0))<1e-4,variant.clip+' carried object changes scene plane');held++;}}assert.ok(held>3);assert.ok(variant.onSuccess.some(a=>a.type==='set'&&a.variable==='bottleDepth'));}
});
test('gym equipment uses independent projected depth and decals name their physical host',()=>{
 const d=createGym(),parts=d.packs.atlas.parts;assert.equal(d.actors.find(a=>a.id==='gym').layer,'background');for(const id of ['gym-water-table','gym-bench','gym-rack-near','gym-rack-far','gym-pullup']){const actor=d.actors.find(a=>a.id===id);assert.equal(actor.layer,'characters');assert.ok(Number.isFinite(actor.depth.value));}assert.ok(d.actors.find(a=>a.id==='gym-rack-near').depth.value>d.actors.find(a=>a.id==='gym-rack-far').depth.value);
 for(const [id,host]of [['abs','trunk'],['back-spine','trunk'],['leftbiceps','leftarm'],['shorts-stripe','shorts'],['eyes','head-shape'],['leftshoe','leftleg'],['rightshoe','rightleg'],['leftgrip','leftarm'],['rightgrip','rightarm']])assert.equal(parts.find(p=>p.id===id).spatial.surfaceOf,host);
});
