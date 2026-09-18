import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {assertDocument,validateDocument,capabilities} from '../src/schema.js';
import {DocumentStore} from '../src/commands.js';
import {inspectSceneFeatures} from '../src/scene-export.js';
const fixture=()=>{const d=createDrawing(),p=d.packs.drawing;p.spatial=true;p.joints.push({id:'detail',parent:'root',x:0,y:0,length:1,rotation:0,min:-180,max:180});p.parts=[{id:'host',joint:'root',d:'M0 0L20 0L20 20Z',fill:'#abcdef',spatial:{}},{id:'mark',joint:'detail',d:'M2 2L4 2L4 4Z',fill:'#123456',spatial:{surfaceOf:'host'}}];d.props=[{id:'table',name:'Table',x:100,y:120,width:60,height:20,rotation:0,fill:'#abcdef',collider:{enabled:false,width:60,height:20,x:0,y:0,friction:.5,bounce:0}}];return d;};
test('scene depth and surface host metadata round-trip, transact atomically and report export features',()=>{
 const d=fixture();d.actors[0].depth={joint:'root',offset:83};d.props[0].depth={value:350};d.packs.drawing.parts[0].spatial.sceneDepth={value:300};assertDocument(JSON.parse(JSON.stringify(d)));assert.ok(capabilities.features.includes('scene-depth'));assert.ok(capabilities.features.includes('surface-decals'));assert.ok(inspectSceneFeatures(d).features.includes('scene-depth'));assert.ok(inspectSceneFeatures(d).features.includes('surface-decals'));
 const store=new DocumentStore(d);store.transact([{op:'set',path:['actors',0,'depth'],value:{value:200}}]);assert.deepEqual(store.document.actors[0].depth,{value:200});store.undo();assert.deepEqual(store.document.actors[0].depth,{joint:'root',offset:83});store.redo();assert.deepEqual(store.document.actors[0].depth,{value:200});const previous=structuredClone(store.document);assert.throws(()=>store.transact([{op:'set',path:['actors',0,'depth'],value:{joint:'missing'}}]));assert.deepEqual(store.document,previous);
});
test('depth schema rejects conflicting modes, missing joints, nonfinite values and prop joint references',()=>{
 for(const bad of [null,{},[],{value:NaN},{value:Infinity},{value:10001},{value:-10001},{joint:'missing'},{joint:'root',offset:4097},{joint:'root',offset:-4097},{joint:'root',offset:null},{value:0,joint:'root'},{value:0,offset:0},{joint:'root',extra:0}]){const d=fixture();d.actors[0].depth=bad;assert.equal(validateDocument(d).valid,false,JSON.stringify(bad));}
 const prop=fixture();prop.props[0].depth={joint:'root'};assert.equal(validateDocument(prop).valid,false);
 const part=fixture();part.packs.drawing.parts[0].spatial.sceneDepth={joint:'missing'};assert.equal(validateDocument(part).valid,false);
 const valid=fixture();valid.actors[0].depth={joint:'root'};valid.props[0].depth={value:-10000};valid.packs.drawing.parts[0].spatial.sceneDepth={joint:'detail',offset:-4096};assertDocument(valid);
});
test('surface decorations reject missing hosts, self-links, chains, cycles and independent scene-depth overrides',()=>{
 for(const corrupt of [p=>p.parts[1].spatial.surfaceOf='missing',p=>p.parts[1].spatial.surfaceOf='mark',p=>p.parts[0].spatial.surfaceOf='mark',p=>{p.parts.push({...p.parts[1],id:'third'});p.parts[1].spatial.surfaceOf='third';},p=>p.parts[1].spatial.sceneDepth={value:123}]){const d=fixture();corrupt(d.packs.drawing);assert.equal(validateDocument(d).valid,false);}
 const legacy=createDrawing();assertDocument(legacy);assert.ok(!inspectSceneFeatures(legacy).features.includes('scene-depth'));
 const partsOnly=fixture();partsOnly.packs.drawing.parts[0].spatial.sceneDepth={value:100};assert.ok(inspectSceneFeatures(partsOnly).features.includes('scene-depth'));
});
