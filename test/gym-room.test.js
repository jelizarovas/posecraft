import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {assertDocument} from '../src/schema.js';
import {configureGymRoom,gymBenchTargets,gymRoomPerspective,projectGymPoint,gymFloorPoint,gymRoomStations} from '../examples/gym-room.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
test('gym bench and floor share two vanishing points and invert floor coordinates',()=>{
 for(const v of [-100,0,100])assert.ok(Math.abs(cross(projectGymPoint(-80,v,58),projectGymPoint(150,v,58),gymRoomPerspective.left))<1e-7);
 for(const u of [-80,0,150])assert.ok(Math.abs(cross(projectGymPoint(u,-100,58),projectGymPoint(u,100,58),gymRoomPerspective.right))<1e-7);
 for(const p of [{x:400,y:383},{x:600,y:385},{x:330,y:330}]){const {u,v}=gymFloorPoint(p.x,p.y);assert.ok(distance(projectGymPoint(u,v),p)<1e-8);}
});
test('projected bench landmarks fit the athlete rig and bar grips follow its perspective axis',()=>{
 for(const press of [0,16,32]){const target=gymBenchTargets(press);assert.ok(distance(target.head,target.back)<65);assert.ok(distance(target.back,target.hips)<65);assert.ok(Math.abs(target.bar.rotation)>8&&Math.abs(target.bar.rotation)<30);for(const side of ['left','right']){assert.ok(distance(target.shoulders[side],target.bar[side])<80);assert.ok(distance({...target.hips,y:target.hips.y+12},target.feet[side])<73);assert.ok(Math.abs(cross(target.bar.left,target.bar.right,gymRoomPerspective.right))<1e-7);const offset=target.bar.gripOffsets[side],a=target.bar.rotation*Math.PI/180;assert.ok(distance({x:target.bar.x+offset.x*Math.cos(a),y:target.bar.y+offset.x*Math.sin(a)},target.bar[side])<1e-8);}}
});
test('room configuration preserves one bottle rig, disables shadows and remains portable',()=>{
 const scene=createDrawing(),pack=scene.packs.drawing;pack.spatial=true;pack.joints.push({id:'barbell',parent:'root',x:0,y:0,length:0,rotation:0,min:-180,max:180});pack.parts=[{id:'water-bottle-body',joint:'root',d:'M0 0H5V5Z',fill:'#ffffff'}];scene.packs.atlas=pack;scene.packs.gym=structuredClone(pack);delete scene.packs.drawing;scene.actors[0].id='atlas';scene.actors[0].pack='atlas';scene.actors.push({...structuredClone(scene.actors[0]),id:'gym',pack:'gym'});configureGymRoom(scene);assertDocument(scene);assert.equal(scene.lighting.enabled,false);assert.equal(scene.lighting.floorShadow,0);assert.equal(scene.lighting.wallShadow,0);assert.equal(scene.lighting.reflection,0);assert.ok(scene.packs['gym-water-table'].parts.some(p=>p.id==='water-table'));assert.equal(scene.actors.find(a=>a.id==='gym-water-table').depth.value,383);assert.ok(scene.packs.gym.parts.some(p=>p.id==='mirror'));assert.ok(scene.packs.gym.parts.some(p=>p.id==='window'));assert.equal(scene.actors.filter(a=>/bottle/.test(a.id)).length,0);assert.equal(scene.packs.atlas.parts.filter(p=>p.id==='water-bottle-body').length,1);assert.equal(scene.packs.atlas.parts.filter(p=>p.id==='barbell-shaft').length,1);configureGymRoom(scene);assert.equal(scene.packs.atlas.parts.filter(p=>p.id==='barbell-shaft').length,1);assertDocument(JSON.parse(JSON.stringify(scene)));assert.deepEqual(gymRoomStations.bottle.point,{x:400,y:270});
});
