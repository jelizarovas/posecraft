import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMeshJoint,editMeshInfluence,removeMeshInfluence,setMeshVertexCorrection} from '../src/mesh-editing.js';
import {evaluateSkinnedMesh} from '../src/skinned-mesh.js';
import {spatialKinematics} from '../src/spatial.js';
const pack={spatial:true,joints:[{id:'root',parent:null,x:80,y:100,rotation:30,min:-180,max:180},{id:'elbow',parent:'root',x:30,y:0,rotation:-60,min:-180,max:180},{id:'wrist',parent:'elbow',x:25,y:0,rotation:45,min:-180,max:180}]};
const mesh=()=>({vertices:[{weights:[{joint:'root',x:0,y:0,weight:1}]},{weights:[{joint:'root',x:40,y:0,z:5,weight:1}]},{weights:[{joint:'root',x:0,y:20,weight:1}]}],triangles:[[0,1,2]]});
const positions=m=>evaluateSkinnedMesh(m,spatialKinematics(pack,{}),{}).vertices;
const same=(a,b)=>a.forEach((p,i)=>['x','y','z'].forEach(k=>assert.ok(Math.abs(p[k]-b[i][k])<1e-8)));

test('adding or changing an influence preserves rest shape through rotated parent joints',()=>{
 const original=mesh(),snapshot=structuredClone(original),bound=bindMeshJoint(pack,original,1,'elbow');same(positions(original),positions(bound));assert.equal(bound.vertices[1].weights[1].weight,.25);
 const replaced=bindMeshJoint(pack,bound,1,'wrist',1);same(positions(bound),positions(replaced));assert.equal(replaced.vertices[1].weights[1].joint,'wrist');assert.deepEqual(original,snapshot);
 assert.throws(()=>bindMeshJoint(pack,bound,1,'root'),/already/);assert.throws(()=>bindMeshJoint(pack,bound,1,'missing'),/existing/);
});
test('weight edits normalize other weights, remove keeps one and malformed edits cannot mutate source',()=>{
 let m=bindMeshJoint(pack,mesh(),1,'elbow');m=bindMeshJoint(pack,m,1,'wrist');const before=structuredClone(m),ratio=m.vertices[1].weights[0].weight/m.vertices[1].weights[1].weight,edited=editMeshInfluence(m,1,2,{weight:.6,x:12,z:8}),weights=edited.vertices[1].weights;
 assert.ok(Math.abs(weights.reduce((s,v)=>s+v.weight,0)-1)<1e-12);assert.ok(Math.abs(weights[0].weight/weights[1].weight-ratio)<1e-12);assert.equal(weights[2].x,12);assert.equal(weights[2].z,8);assert.deepEqual(m,before);
 const removed=removeMeshInfluence(edited,1,2);assert.equal(removed.vertices[1].weights.length,2);assert.ok(Math.abs(removed.vertices[1].weights.reduce((s,v)=>s+v.weight,0)-1)<1e-12);
 assert.throws(()=>editMeshInfluence(m,1,2,{weight:1}),/Remove/);assert.throws(()=>editMeshInfluence(m,1,2,{weight:0}),/within/);assert.throws(()=>editMeshInfluence(m,1,2,{x:Infinity}),/within/);assert.throws(()=>removeMeshInfluence(mesh(),0,0),/at least/);
});
test('selected vertex corrections replace one offset without touching other vertices and can be cleared',()=>{
 const m=mesh();m.correctives=[{joint:'elbow',channel:'rotation',min:0,max:90,offsets:[{vertex:0,x:2}]}];const changed=setMeshVertexCorrection(m,0,1,{y:5,z:2});assert.deepEqual(changed.correctives[0].offsets,[{vertex:0,x:2},{vertex:1,x:0,y:5,z:2}]);const replaced=setMeshVertexCorrection(changed,0,1,{x:4});assert.equal(replaced.correctives[0].offsets.length,2);assert.deepEqual(setMeshVertexCorrection(replaced,0,1,{}).correctives,m.correctives);assert.equal(m.correctives[0].offsets.length,1);assert.throws(()=>setMeshVertexCorrection(m,0,99,{x:1}),/existing vertex/);
});
