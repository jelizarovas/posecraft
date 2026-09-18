import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {assertDocument,validateDocument,capabilities} from '../src/schema.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';

function fixture(){const d=createDrawing(),p=d.packs.drawing;d.requiredFeatures=['spatial-rig','skinned-mesh'];p.spatial=true;p.joints.push({id:'elbow',parent:'root',x:20,y:0,length:20,rotation:0,min:-180,max:180});p.parts=[{id:'skin',joint:'root',d:'M0 0L20 0L20 20L0 20Z',fill:'#c98159',spatial:{mesh:{vertices:[{weights:[{joint:'root',x:0,y:0,weight:1}]},{weights:[{joint:'root',x:20,y:0,weight:.5},{joint:'elbow',x:0,y:0,z:0,weight:.5}]},{weights:[{joint:'elbow',x:0,y:20,weight:1}]},{weights:[{joint:'root',x:0,y:20,weight:1}]}],triangles:[[0,1,2],[0,2,3]],correctives:[{joint:'elbow',channel:'rotation',min:0,max:90,offsets:[{vertex:2,y:3,z:2}]}],creaseAngle:40}}}];return d;}
const mesh=d=>d.packs.drawing.parts[0].spatial.mesh;

test('weighted surfaces and correctives round-trip with an explicit portable capability',()=>{
 const d=fixture();assertDocument(JSON.parse(JSON.stringify(d)));assert.ok(capabilities.features.includes('skinned-mesh'));assert.ok(!capabilities.unavailable.includes('mesh-deformation'));const inspection=inspectSceneFeatures(d);assert.equal(inspection.runtime,'illustration');assert.ok(inspection.features.includes('skinned-mesh'));
 const exported=createSceneExport(d,{local:true});assert.ok(exported.manifest.features.includes('skinned-mesh'));assert.ok(exported.html.includes('"triangles":[[0,1,2],[0,2,3]]'));mesh(d).correctives[0].offsets=[];assertDocument(d);
 const legacy=createDrawing();assertDocument(legacy);assert.ok(!inspectSceneFeatures(legacy).features.includes('skinned-mesh'));
});

test('mesh imports reject invalid influence, topology and corrective data without mutation',()=>{
 const changes=[
  d=>d.requiredFeatures.splice(1),d=>mesh(d).vertices[0].weights[0].joint='missing',d=>mesh(d).vertices[0].weights[0].weight=.8,d=>mesh(d).vertices[0].weights[0].weight=0,d=>mesh(d).vertices[0].weights[0].x=Infinity,d=>mesh(d).vertices[0].weights.push({...mesh(d).vertices[0].weights[0]}),d=>mesh(d).vertices[0].x=3,
  d=>mesh(d).triangles.push([2,1,0]),d=>mesh(d).triangles[0]=[0,1,1],d=>mesh(d).triangles[0]=[0,1,4],d=>mesh(d).triangles[0]=[0,1,2.5],d=>mesh(d).triangles[0]=[0,1],d=>mesh(d).creaseAngle=181,
  d=>mesh(d).correctives[0].joint='missing',d=>mesh(d).correctives[0].channel='opacity',d=>mesh(d).correctives[0].min=90,d=>mesh(d).correctives[0].max=181,d=>mesh(d).correctives[0].offsets[0].vertex=4,d=>mesh(d).correctives[0].offsets[0].z=4097,d=>mesh(d).correctives[0].offsets.push({...mesh(d).correctives[0].offsets[0]}),d=>mesh(d).correctives[0].offsets[0]={vertex:2},d=>mesh(d).correctives[0].offsets='bad',d=>mesh(d).correctives[0].material='url(evil)',d=>mesh(d).vertices=null,d=>mesh(d).vertices[0]=null,
  d=>d.packs.drawing.parts[0].spatial.softLimb={elbow:'elbow',hand:'root',radius:10},d=>d.packs.drawing.parts[0].spatial.surface={x:0,width:20,depth:5}
 ];for(const mutate of changes){const d=fixture();mutate(d);const before=structuredClone(d),result=validateDocument(d);assert.equal(result.valid,false,mutate.toString());assert.ok(result.errors.length);assert.deepEqual(d,before,'validation mutated rejected input');}
});

test('mesh validation bounds authored and instantiated work',()=>{
 const vertex=i=>({weights:[{joint:'root',x:i%32,y:Math.floor(i/32),weight:1}]}),d=fixture();mesh(d).vertices=Array.from({length:512},(_,i)=>vertex(i));mesh(d).triangles=Array.from({length:510},(_,i)=>[0,i+1,i+2]);assertDocument(d);mesh(d).vertices.push(vertex(512));assert.equal(validateDocument(d).valid,false);mesh(d).vertices.pop();
 mesh(d).correctives=Array.from({length:5},()=>({joint:'elbow',channel:'rotation',min:0,max:90,offsets:Array.from({length:512},(_,vertex)=>({vertex,x:0}))}));assert.equal(validateDocument(d).valid,false);delete mesh(d).correctives;
 d.actors=Array.from({length:17},(_,i)=>({...structuredClone(d.actors[0]),id:'actor-'+i}));assert.ok(validateDocument(d).errors.some(e=>e.message.includes('Instantiated meshes')));
 const faces=[];for(let a=0;a<20;a++)for(let b=a+1;b<20;b++)for(let c=b+1;c<20;c++)faces.push([a,b,c]);mesh(d).vertices=Array.from({length:20},(_,i)=>vertex(i));mesh(d).triangles=faces.slice(0,1024);assert.ok(validateDocument(d).errors.some(e=>e.message.includes('Instantiated meshes')));d.actors=d.actors.slice(0,1);assertDocument(d);mesh(d).triangles.push(faces[1024]);assert.equal(validateDocument(d).valid,false);
});
