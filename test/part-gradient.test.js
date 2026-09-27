import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDocument,validateDocument} from '../src/schema.js';
import {DocumentStore} from '../src/commands.js';
import {renderSVG} from '../src/svg.js';
import {evaluateDrawing} from '../src/render-evaluation.js';
import {inspectActorDepthCapabilities} from '../src/canvas-depth.js';
import {createSceneExport} from '../src/scene-export.js';
import {rendererFixture,rendererFrame,crossingMeshFixture} from './fixtures/renderer-scenes.js';

const gradient=()=>({type:'linear',x1:0,y1:0,x2:1,y2:1,stops:[[0,'#48236f'],[.45,'#8653bc'],[1,'#e9c9ff']]});
const fixture=(lit=false)=>{const scene=rendererFixture(lit);scene.requiredFeatures.push('part-gradients');scene.packs.shape.parts.find(part=>part.id==='panel').gradient=gradient();return scene;};

test('part gradients validate finite normalized coordinates, ordered opaque stops and exact fields',()=>{
 assertDocument(fixture());
 const invalid=[
  g=>g.x1=-.01,
  g=>g.y2=1.01,
  g=>{g.x2=0;g.y2=0;},
  g=>g.stops=[[.7,'#ffffff'],[.2,'#000000']],
  g=>g.stops=[[0,'#fff8'],[1,'#000000']],
  g=>g.stops=[[0,'red'],[1,'#000000']],
  g=>g.stops=[[0,'#ffffff']],
  g=>g.stops=Array.from({length:9},(_,i)=>[i/8,'#ffffff']),
  g=>g.href='https://example.com/paint.svg',
 ];
 for(const mutate of invalid){const scene=fixture(),g=scene.packs.shape.parts.find(part=>part.id==='panel').gradient;mutate(g);assert.equal(validateDocument(scene).valid,false,JSON.stringify(g));}
 const undeclared=fixture();undeclared.requiredFeatures=[];assert.equal(validateDocument(undeclared).valid,false);
});

test('SVG keeps unique authored gradients ahead of scene lighting for each actor',()=>{
 const scene=fixture(true);scene.actors.push({...structuredClone(scene.actors[0]),id:'two',name:'Two',transform:{x:230,y:90,scale:1,rotation:0}});
 const svg=renderSVG(scene,rendererFrame(scene));
 const ids=[...svg.matchAll(/<linearGradient data-part-gradient="panel" id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
 for(const id of ids)assert.ok(svg.includes(`fill="url(#${id})"`));
 assert.doesNotMatch(svg,/data-surface="panel"/);
 assert.match(svg,/x1="0" y1="0" x2="1" y2="1"/);
 assert.match(svg,/<stop offset="0\.45" stop-color="#8653bc"\/>/);
});

test('Canvas evaluates object-bounds linear paint and actor appearance can override it without deleting source',()=>{
 const scene=fixture(true),panel=scene.packs.shape.parts.find(part=>part.id==='panel');
 let command=evaluateDrawing(scene,rendererFrame(scene)).units.flatMap(unit=>unit.commands).find(command=>command.pick?.part==='panel');
 assert.deepEqual(command.fill,{type:'linear',x1:-60,y1:-50,x2:60,y2:50,stops:gradient().stops});
 panel.channel='robe';scene.actors[0].appearance={robe:'#345678'};
 command=evaluateDrawing(scene,rendererFrame(scene)).units.flatMap(unit=>unit.commands).find(command=>command.pick?.part==='panel');
 assert.notEqual(command.fill.type,'linear');
 assert.deepEqual(panel.gradient,gradient());
});

test('actor-depth Canvas reports gradient meshes as unsupported',()=>{
 const scene=crossingMeshFixture();scene.renderer='canvas';scene.canvasDepth='actor';scene.requiredFeatures.push('part-gradients');scene.packs.shape.parts[0].gradient=gradient();
 const drawing=evaluateDrawing(scene,rendererFrame(scene));
 assert.ok(inspectActorDepthCapabilities(drawing).unsupported.some(reason=>reason.code==='depth-mesh-material'));
});

test('transactions, JSON reopen and website export retain authored paint',()=>{
 const store=new DocumentStore(fixture());store.transact([{op:'set',path:['packs','shape','parts',1,'fill'],value:'#123456'}]);
 const scene=assertDocument(JSON.parse(JSON.stringify(store.document)));
 assert.deepEqual(scene.packs.shape.parts[1].gradient,gradient());
 const {html,manifest}=createSceneExport(scene,{runtimeBase:'https://example.com/runtime/'});
 const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(embedded);assert.deepEqual(JSON.parse(embedded).packs.shape.parts[1].gradient,gradient());
 assert.ok(manifest.features.includes('part-gradients'));
});
