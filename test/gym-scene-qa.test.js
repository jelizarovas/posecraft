import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {gymBenchTargets,gymRoomStations} from '../examples/gym-room.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics,spatialParts} from '../src/spatial.js';
const fixture=()=>{const doc=createGym(),controller=new SceneController(doc);return {doc,controller,at(clip,time){const frame=controller.previewClip('atlas',clip,time),actor=frame.actors.find(a=>a.id==='atlas');return {frame,actor,world:spatialKinematics(doc.packs.atlas,actor.pose)};}};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('integrated gym keeps bench and one-handed grips attached to the drawn targets',()=>{
 const q=fixture();try{for(const [clip,time,expected]of [['full-set',41,2],['full-set',42,2],['jump-grab-left',1.8,1],['hang-switch',1.4,1],['hang-switch',3.5,1]]){const {frame,world:w}=q.at(clip,time),contacts=frame.contacts.filter(c=>c.active);assert.equal(contacts.length,expected,clip+' active grips');for(const c of contacts)assert.ok(c.error<.2,`${clip} ${c.id} hand gap ${c.error}`);if(clip==='full-set'){const b=gymBenchTargets().bar;assert.ok(distance({x:w.barbell.x,y:w.barbell.y},time===41?b:{x:b.x,y:w.barbell.y})<.15);assert.ok(Math.abs(Math.atan2(w.barbell.m[3],w.barbell.m[0])*180/Math.PI-b.rotation)<.01);}}assert.equal(q.doc.lighting.enabled,false);}finally{q.controller.dispose();}
});
test('one persistent bottle stays at its room station through walking, facing, breathing and bench work',()=>{
 const q=fixture();try{assert.equal(q.doc.packs.atlas.parts.filter(p=>p.id==='water-bottle-body').length,1);for(const [clip,time]of [['full-set',31],['full-set',54],['full-set',42],['jump-grab-left',1.8],['hang-switch',3.5],['turnaround',0],['turnaround',3],['turnaround',6],['turnaround',9],['tired-breaths',1.12]]){const {world:w,actor}=q.at(clip,time);assert.ok(distance(w['water-bottle'],gymRoomStations.bottle.point)<.02,clip+' bottle drifts');assert.equal(actor.pose['water-bottle.opacity'],1);}}finally{q.controller.dispose();}
});
test('the full back view hides facial artwork and exposes the authored back',()=>{
 const q=fixture();try{const {actor}=q.at('turnaround',6),p=spatialParts(q.doc.packs.atlas,actor);for(const id of ['eyes','nose','eyebrows'])assert.equal(p.parts.get(id).visible,false,id+' visible from back');for(const id of ['back-scapula-left','back-scapula-right','skin-spine'])assert.equal(p.parts.get(id).visible,true,id+' missing');for(const side of ['left','right'])assert.ok(p.parts.get('back-scapula-'+side).depth>p.parts.get(side+'-pec').depth,'back surface is physically in front of chest markings');}finally{q.controller.dispose();}
});
