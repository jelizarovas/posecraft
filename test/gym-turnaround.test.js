import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymPose} from '../examples/gym.js';
import {addGymTurnaround,applyGymFacing} from '../examples/gym-turnaround.js';
import {assertDocument} from '../src/schema.js';
import {forwardKinematics} from '../src/index.js';
import {spatialParts,turnaroundPath} from '../src/spatial.js';
import {renderSVG} from '../src/svg.js';
const numbers=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const coords=d=>(d.match(numbers)||[]).map(Number);
const document=createGym(),pack=document.packs.atlas;
const view=(angle,extra={})=>{const pose={...applyGymFacing({...gymPose(0)},angle),...extra};return spatialParts(pack,{pose,world:forwardKinematics(pack.joints,pose)});};

test('Atlas stores a closed editable directional set at every fifteen degrees',()=>{
 assertDocument(JSON.parse(JSON.stringify(document)));assert.equal(addGymTurnaround(pack),pack);
 for(const id of ['head-shape','hair','trunk','shorts','eyes','beard','abs','back-spine','breath-mouth']){
  const p=pack.parts.find(p=>p.id===id);assert.equal(p.spatial.turnaround.views.length,25);assert.deepEqual(p.spatial.turnaround.views.map(v=>v.angle),Array.from({length:25},(_,i)=>i*15));
  assert.equal(turnaroundPath(p,-360),turnaroundPath(p,0));assert.equal(turnaroundPath(p,360),turnaroundPath(p,0));assert.equal(turnaroundPath(p,-45),turnaroundPath(p,315));
 }
});

test('profile has a real silhouette and one eye; rear exposes back muscles without facial details',()=>{
 const front=view(0),profile=view(90),back=view(180),head=profile.parts.get('head-shape');
 assert.ok(Math.abs(head.matrix[0]*head.matrix[3]-head.matrix[1]*head.matrix[2])>.95,'profile artwork retains its authored width');
 const xs=coords(head.d).filter((_,i)=>i%2===0);assert.ok(Math.max(...xs)-Math.min(...xs)>45,'profile nose and cranium remain volumetric');
 const eyes=profile.parts.get('eyes').d.match(/M[^Z]+Z/g).map(coords);assert.equal(eyes.filter(values=>Math.max(...values.filter((_,i)=>i%2===0))-Math.min(...values.filter((_,i)=>i%2===0))>1).length,1);
 for(const id of ['eyes','eyebrows','nose','beard','abs','left-pec','right-pec','breath-mouth','breath-air'])assert.equal(back.parts.get(id).visible,false,id+' cannot show through the rear');
 assert.equal(front.parts.get('back-spine').visible,false);assert.equal(back.parts.get('back-spine').visible,true);assert.equal(back.parts.get('back-scapula-left').visible,true);assert.notEqual(front.parts.get('hair').d,back.parts.get('hair').d);
 const turnedFeet=view(0,{'root.yaw':90});for(const id of ['leftshoe','rightshoe']){const shoe=turnedFeet.parts.get(id),xs=coords(shoe.d).filter((_,i)=>i%2===0);assert.ok(Math.max(...xs)-Math.min(...xs)>28,'profile shoes retain a heel and toe');assert.ok(Math.abs(shoe.matrix[0]*shoe.matrix[3]-shoe.matrix[1]*shoe.matrix[2])>.5);}
});

test('directional interpolation is continuous around every seam and independent of torso roll',()=>{
 for(const part of pack.parts.filter(p=>p.spatial?.turnaround))for(let angle=0;angle<=360;angle+=15){
  const a=coords(turnaroundPath(part,angle-.001)),b=coords(turnaroundPath(part,angle+.001));assert.equal(a.length,b.length);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.02),part.id+' at '+angle);
 }
 assert.equal(view(60).parts.get('trunk').d,view(60,{'torso.rotation':-90}).parts.get('trunk').d,'reclining does not change the selected directional view');
 for(let angle=0;angle<360;angle+=3)for(const part of view(angle).parts.values()){assert.ok(part.matrix.every(Number.isFinite));assert.ok(!part.d||!part.d.includes('NaN'));}
});

test('scene export uses the same directional geometry while expression channels remain editable',()=>{
 const pose={...applyGymFacing({...gymPose(0)},180),'face-effort.opacity':1,'breath-mouth.opacity':1},actor={id:'atlas',pose,world:forwardKinematics(pack.joints,pose),inputs:{},state:'still'},frame={time:0,actors:document.actors.map(a=>a.id==='atlas'?actor:{id:a.id,pose:{},world:forwardKinematics(document.packs[a.pack].joints,{}),inputs:a.inputs||{},state:'still'})};
 const svg=renderSVG(document,frame);assert.match(svg,/data-part="back-spine"/);assert.match(svg,/data-part="breath-mouth"/);assert.equal(spatialParts(pack,actor).parts.get('effort').visible,false);
 assert.equal(pack.parts.find(p=>p.id==='effort').opacityChannel,'face-effort.opacity');assert.equal(pack.parts.find(p=>p.id==='breath-mouth').opacityChannel,'breath-mouth.opacity');
});

test('malformed directional data rejects scripts, incompatible contours, open seams and unbounded views',()=>{
 for(const corrupt of [v=>v[2].d='M0 0<script>',v=>v[2].d='M0 0Z',v=>v[2].angle=0,v=>v.at(-1).d='M0 0Z',v=>v[2].d=v[2].d.replace(/[-+]?\d+/, '10001')]){
  const d=structuredClone(document),views=d.packs.atlas.parts.find(p=>p.id==='head-shape').spatial.turnaround.views;corrupt(views);assert.throws(()=>assertDocument(d));
 }
});
