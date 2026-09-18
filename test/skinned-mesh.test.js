import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSkinnedMesh} from '../src/skinned-mesh.js';
const I=[1,0,0,0,1,0,0,0,1],joint=(x=0,y=0,z=0,m=I)=>({x,y,z,m}),weight=(joint,x,y,z=0,w=1)=>({joint,x,y,z,weight:w}),vertex=(...weights)=>({weights});
const quad=()=>({vertices:[vertex(weight('root',0,0)),vertex(weight('root',10,0)),vertex(weight('root',10,10)),vertex(weight('root',0,10))],triangles:[[0,1,2],[0,2,3]]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('connected weighted vertices preserve their bind pose and blend actual joint transforms',()=>{
 const mesh=quad();mesh.vertices[2]=vertex(weight('root',10,10,2,.25),weight('elbow',0,10,2,.75));
 const rest=evaluateSkinnedMesh(mesh,{root:joint(),elbow:joint(10)});assert.deepEqual(rest.vertices[2],{x:10,y:10,z:2,depth:2});
 const moved=evaluateSkinnedMesh(mesh,{root:joint(),elbow:joint(10,0,0,[0,-1,0,1,0,0,0,0,1])});near(moved.vertices[2].x,2.5);near(moved.vertices[2].y,2.5);near(moved.vertices[2].z,2);
 assert.equal(moved.faces.length,2);assert.equal(moved.edges.length,5);
});

test('two-sided flat skin outlines only its boundary, with stable hidden internal and edge-on slots',()=>{
 const mesh=quad(),front=evaluateSkinnedMesh(mesh,{root:joint()}),back=evaluateSkinnedMesh(mesh,{root:joint(0,0,0,[-1,0,0,0,1,0,0,0,-1])}),edge=evaluateSkinnedMesh(mesh,{root:joint(0,0,0,[0,0,1,0,1,0,-1,0,0])});
 assert.equal(front.edges.filter(e=>e.visible).length,4);assert.equal(front.edges.find(e=>e.id==='0-2').kind,'internal');assert.equal(front.silhouettePath.match(/M/g).length,4);assert.equal(front.creasePath,'');
 assert.ok(front.faces.every(f=>f.frontFacing&&f.visible));assert.ok(back.faces.every(f=>!f.frontFacing&&f.visible));assert.ok(edge.faces.every(f=>!f.visible));assert.deepEqual(front.edges.map(e=>e.id),edge.edges.map(e=>e.id));assert.deepEqual(front.faces.map(f=>f.index),edge.faces.map(f=>f.index));
});

test('folded skin finds its silhouette and optional physical creases without triangulation strokes',()=>{
 const mesh=quad();mesh.vertices[3]=vertex(weight('root',8,0,5));let result=evaluateSkinnedMesh(mesh,{root:joint()});assert.equal(result.edges.find(e=>e.id==='0-2').kind,'silhouette');
 mesh.vertices[3]=vertex(weight('root',0,10,5));result=evaluateSkinnedMesh(mesh,{root:joint()});assert.equal(result.edges.find(e=>e.id==='0-2').visible,false);
 mesh.creaseAngle=10;result=evaluateSkinnedMesh(mesh,{root:joint()});assert.equal(result.edges.find(e=>e.id==='0-2').kind,'crease');assert.ok(result.creasePath);assert.ok(result.edges.every(e=>Number.isFinite(e.depth)));
});

test('joint-local corrective displacements retain volume at bends and layer depth stays out of shape',()=>{
 const mesh=quad();mesh.correctives=[{joint:'elbow',channel:'rotation',min:0,max:90,offsets:[{vertex:2,x:4,z:2}]}];const world={root:{...joint(),layerDepth:20},elbow:joint(100,100,0,[0,-1,0,1,0,0,0,0,1])};
 const start=evaluateSkinnedMesh(mesh,world,{'elbow.rotation':0}),half=evaluateSkinnedMesh(mesh,world,{'elbow.rotation':45}),end=evaluateSkinnedMesh(mesh,world,{'elbow.rotation':180});near(start.vertices[2].y,10);near(half.vertices[2].y,12);near(end.vertices[2].y,14);near(end.vertices[2].z,2);near(end.vertices[2].depth,22);near(end.faces[0].normal.z,14/Math.sqrt(200));
});

test('topology and weights respond to in-place editor changes and reject over-budget or broken data',()=>{
 const mesh=quad(),world={root:joint()};evaluateSkinnedMesh(mesh,world);mesh.triangles[1]=[1,2,3];const changed=evaluateSkinnedMesh(mesh,world);assert.ok(changed.edges.some(e=>e.id==='1-3'));assert.equal(changed.edges.find(e=>e.id==='1-2').faces.length,2);mesh.vertices[0].weights[0].x=3;assert.equal(evaluateSkinnedMesh(mesh,world).vertices[0].x,3);
 assert.throws(()=>evaluateSkinnedMesh({...mesh,vertices:Array(513).fill(mesh.vertices[0])},world),/budget/);assert.throws(()=>evaluateSkinnedMesh({...mesh,triangles:[[0,0,1]]},world),/distinct/);assert.throws(()=>evaluateSkinnedMesh(mesh,{}),/Missing/);mesh.vertices[0].weights[0].weight=0;assert.throws(()=>evaluateSkinnedMesh(mesh,world),/positive/);
});

test('maximum-size skin remains finite with fixed topology through a full rotation',()=>{
 const vertices=Array.from({length:512},(_,i)=>vertex(weight('root',i%32,Math.floor(i/32),Math.sin(i*.2)))),triangles=[];for(let y=0;y<15;y++)for(let x=0;x<31;x++){const i=y*32+x;triangles.push([i,i+1,i+32],[i+1,i+33,i+32]);}const mesh={vertices,triangles};let ids;
 for(let angle=0;angle<=360;angle+=15){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),result=evaluateSkinnedMesh(mesh,{root:joint(20,30,0,[c,0,s,0,1,0,-s,0,c])});assert.equal(result.vertices.length,512);assert.equal(result.faces.length,930);assert.ok(result.vertices.every(v=>Object.values(v).every(Number.isFinite)));assert.ok(result.faces.every(f=>Number.isFinite(f.depth)&&!f.d.includes('NaN')));if(ids)assert.deepEqual(result.edges.map(e=>e.id),ids);else ids=result.edges.map(e=>e.id);}
});
