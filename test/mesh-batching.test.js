import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialParts,spatialKinematics} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';
const vertices=[],triangles=[];for(let y=0;y<9;y++)for(let x=0;x<17;x++)vertices.push({weights:[{joint:'root',x:x*3,y:y*3,z:0,weight:1}]});for(let y=0;y<8;y++)for(let x=0;x<16;x++){const i=y*17+x;triangles.push([i,i+1,i+17],[i+1,i+18,i+17]);}
const pack={spatial:true,joints:[{id:'root',parent:null,x:40,y:50,rotation:0,length:0,min:-180,max:180}],parts:[{id:'surface',joint:'root',d:'M0 0Z',fill:'#c98159',spatial:{mesh:{vertices,triangles}}}]};
test('large connected surfaces retain all triangles and stable bounded draw slots across turns',()=>{
 let ids;for(const yaw of [0,35,89,90,91,170,180,-170,-35]){const pose={'root.rotation':10,'root.yaw':yaw},s=spatialParts(pack,{pose,world:forwardKinematics(pack.joints,pose)}),view=s.parts.get('surface'),faces=[...s.fragments.values()].filter(f=>f.kind==='mesh-face'),edges=[...s.fragments.values()].filter(f=>f.kind==='mesh-edge');assert.equal(s.fragments.size,128);assert.equal(faces.filter(f=>f.primary).length,1);const keys=[...s.fragments.keys()];if(ids)assert.deepEqual(keys,ids);ids=keys;assert.equal(faces.reduce((n,f)=>n+(f.d.match(/M/g)||[]).length,0),view.mesh.faces.filter(f=>f.visible).length);assert.equal(edges.reduce((n,f)=>n+(f.d.match(/M/g)||[]).length,0),view.mesh.edges.filter(e=>e.visible).length);for(const f of s.fragments.values())assert.ok(Number.isFinite(f.depth)&&!f.d.includes('NaN'));assert.equal(view.transform,'matrix(1 0 0 1 0 0)');const w=spatialKinematics(pack,pose).root;assert.equal(view.mesh.vertices[0].x,w.x);assert.equal(view.mesh.vertices[0].y,w.y);}
});

test('mesh material patches share host depth bands without pulling rear details forward',()=>{
 const p=structuredClone(pack),skin=p.parts[0];skin.spatial.order=1;
 for(const [id,z]of [['front',.02],['rear',-.02]])p.parts.push({id,joint:'root',d:'M0 0Z',fill:'#fff',spatial:{order:2,surfaceOf:'surface',mesh:{vertices:[0,1,17].map(i=>({weights:vertices[i].weights.map(w=>({...w,z}))})),triangles:[[0,1,2]]}}});
 const pose={},s=spatialParts(p,{pose,world:forwardKinematics(p.joints,pose)}),body=s.fragments.get('surface');assert.ok(s.fragments.get('front').depth>body.depth);assert.ok(s.fragments.get('rear').depth<body.depth);assert.equal(s.fragments.size,136);
});
