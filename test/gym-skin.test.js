import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {addGymSkin} from '../examples/gym-skin.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {evaluateSkinnedMesh} from '../src/skinned-mesh.js';
const document=createGym(),pack=document.packs.atlas,body=pack.parts.find(p=>p.id==='trunk').spatial.mesh;

test('Atlas skin is one closed connected manifold with genuine shoulder and hip branches',()=>{
 assertDocument(document);assert.equal(addGymSkin(pack),pack);assert.ok(document.requiredFeatures.includes('skinned-mesh'));assert.ok(body.vertices.length<=400);const edges=new Map(),neighbors=new Map();for(const t of body.triangles)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');(edges.get(key)||edges.set(key,[]).get(key)).push([a,b]);(neighbors.get(a)||neighbors.set(a,new Set()).get(a)).add(b);(neighbors.get(b)||neighbors.set(b,new Set()).get(b)).add(a);}for(const incident of edges.values()){assert.equal(incident.length,2,'no disconnected cap or open shoulder edge');assert.equal(incident[0][0],incident[1][1],'adjacent triangles have consistent winding');}
 const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const next of neighbors.get(queue[i]))if(!seen.has(next)){seen.add(next);queue.push(next);}assert.equal(seen.size,body.vertices.length);assert.equal(body.vertices.length-edges.size+body.triangles.length,2,'closed body has sphere topology');
 for(const pair of [['torso','leftUpper'],['leftUpper','leftLower'],['pelvis','leftThigh'],['leftThigh','leftCalf']])assert.ok(body.vertices.some(v=>pair.every(id=>v.weights.some(w=>w.joint===id))),'blended seam '+pair.join('/'));
});

test('garment follows identical skin triangles and weights without depth-fighting extrusion',()=>{
 const part=pack.parts.find(p=>p.id==='shorts'),garment=part.spatial.mesh,pose={'leftUpper.rotation':180,'rightUpper.rotation':0,'leftThigh.rotation':90,'rightThigh.rotation':90},world=spatialKinematics(pack,pose),skin=evaluateSkinnedMesh(body,world,pose),cloth=evaluateSkinnedMesh(garment,world,pose);assert.equal(part.spatial.surfaceOf,'trunk');
 const map=cloth.vertices.map((v,index)=>{let nearest=0,distance=Infinity;skin.vertices.forEach((p,i)=>{const d=Math.hypot(v.x-p.x,v.y-p.y,v.z-p.z);if(d<distance){distance=d;nearest=i;}});assert.ok(distance<.0001,'garment and body share coincident surface vertices');assert.deepEqual(garment.vertices[index].weights.map(w=>[w.joint,w.weight]),body.vertices[nearest].weights.map(w=>[w.joint,w.weight]));return nearest;});
 const faces=new Set(body.triangles.map(t=>[...t].sort((a,b)=>a-b).join(':')));for(const t of garment.triangles)assert.ok(faces.has(t.map(i=>map[i]).sort((a,b)=>a-b).join(':')),'cloth uses identical skin triangulation');
});

test('weighted skin remains finite through raised arms, folded knees, reclining and full turns',()=>{
 for(const [clip,times]of [['jump-grab-left',[0,1.8,2.7,5.6]],['full-set',[6.8,31.2,38.7,40,42]],['turnaround',[0,1.5,3,4.5,6,7.5,9,10.5,12]]])for(const t of times){const pose=sampleClip(pack.clips[clip],t),world=spatialKinematics(pack,pose);for(const part of pack.parts.filter(p=>p.spatial?.mesh)){const mesh=evaluateSkinnedMesh(part.spatial.mesh,world,pose);assert.ok(mesh.vertices.every(v=>Object.values(v).every(Number.isFinite)));assert.ok(mesh.bounds.maxX-mesh.bounds.minX<300);assert.ok(mesh.bounds.maxY-mesh.bounds.minY<300);assert.ok(mesh.faces.every(f=>Number.isFinite(f.depth)));}}
 assert.ok(body.correctives[0].offsets.length>0);assert.ok(!pack.parts.some(p=>['leftarm','rightarm','leftleg','rightleg'].includes(p.id)));for(const id of ['left-pec','right-pec','back-scapula-left','leftbiceps'])assert.ok(pack.parts.find(p=>p.id===id).spatial.mesh);
});

test('leveling shoes cannot flatten the calf ends and wrist turns retain rounded palm volume',()=>{
 const pose=sampleClip(pack.clips['full-set'],6),original=evaluateSkinnedMesh(body,spatialKinematics(pack,pose),pose),turned={...pose,'leftFoot.yaw':135,'leftFoot.pitch':65,'rightFoot.yaw':-150,'rightFoot.pitch':-50};assert.deepEqual(evaluateSkinnedMesh(body,spatialKinematics(pack,turned),turned).vertices,original.vertices,'shoe orientation does not deform ankle skin');
 for(const side of ['left','right'])for(let yaw=-180;yaw<=180;yaw+=30){const changed={...pose,[side+'Hand.yaw']:yaw,[side+'Hand.pitch']:35},mesh=evaluateSkinnedMesh(body,spatialKinematics(pack,changed),changed),points=body.vertices.flatMap((v,i)=>v.weights.length===1&&v.weights[0].joint===side+'Hand'?[mesh.vertices[i]]:[]),width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));assert.ok(width>8&&height>8,side+' palm retains a rounded projected volume at '+yaw);}
});
