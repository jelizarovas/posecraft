import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {createEmitter,nodeVisible,removeGroup,removeSceneEntity} from '../src/scene-graph.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {lightingConfig,sampleLighting} from '../src/lighting.js';
import {emitterPulse} from '../src/emitters.js';
import {SceneController} from '../src/scene.js';
import {DocumentStore} from '../src/commands.js';
const fixture=()=>{const doc=createDrawing();doc.groups=[{id:'scene',name:'Scene',parent:null},{id:'fire',name:'Fire',parent:'scene'}];doc.actors[0].group='fire';doc.emitters=[{...createEmitter('flame','flame'),actor:'character',group:'fire'}];doc.lighting={enabled:true,emitter:'flame',intensity:1,celThickness:.5};return assertDocument(doc);};
test('folders validate references, cycles, depth and bounded emitters',()=>{
 const doc=fixture();
 for(const mutate of [d=>d.groups[0].parent='fire',d=>d.actors[0].group='missing',d=>d.emitters[0].actor='missing',d=>d.emitters[0].seed=1.5,d=>d.emitters[0].rate=61,d=>d.lighting.emitter='missing',d=>d.emitters[0].maxParticles=129,d=>d.emitters=Array.from({length:5},(_,i)=>({...createEmitter('smoke','e'+i),maxParticles:128}))]){const bad=structuredClone(doc);mutate(bad);assert.equal(validateDocument(bad).valid,false);}
});
test('folder removal preserves contents and actor deletion removes anchored light safely',()=>{
 const doc=fixture();doc.groups[0].hidden=true;assert.equal(nodeVisible(doc,doc.actors[0]),false);
 const next=removeGroup(doc,'fire');assert.equal(next.actors[0].group,'scene');assert.equal(next.emitters[0].group,'scene');assertDocument(next);assert.equal(doc.groups.length,2);
 const removed=removeSceneEntity(next,'actor','character');assert.equal(removed.emitters.length,0);assert.equal(removed.lighting.emitter,undefined);assert.equal(removed.lighting.enabled,false);assertDocument(removed);
});
test('emitter light follows evaluated placement and shares flame pulse and cel reach',()=>{
 const doc=fixture(),e=doc.emitters[0];e.x=10;e.y=100;e.size=80;e.randomness=.8;
 const l=lightingConfig(doc,{actors:[{id:'character',placement:{x:100,y:50,scale:2,rotation:90}}]});assert.ok(Math.abs(l.pointX+28)<1e-8);assert.ok(Math.abs(l.pointY-70)<1e-8);
 const lit=sampleLighting(l,.32),pulse=emitterPulse(e,.32);assert.equal(lit.intensity,pulse);assert.equal(lit.celThickness,.5*(1+.9*(1-pulse)));
 doc.groups[0].hidden=true;assert.equal(sampleLighting(lightingConfig(doc),.32).intensity,0);
 e.enabled=false;assert.equal(sampleLighting(lightingConfig(doc),.32).floorShadow,0);
});
test('reduced-motion frames freeze procedural effects while normal frames advance',()=>{
 const doc=fixture(),still=new SceneController(doc,{reducedMotion:true}),moving=new SceneController(doc);still.step(.1);moving.step(.1);assert.equal(still.frame().effectsTime,0);assert.ok(moving.frame().effectsTime>.09);
});
test('optional fields delete atomically and undo restores both grouping and light bindings',()=>{
 const store=new DocumentStore(fixture()),before=structuredClone(store.document);
 store.transact([{op:'delete',path:['lighting','emitter']},{op:'set',path:['emitters'],value:[]}]);assert.equal(store.document.lighting.emitter,undefined);
 store.undo();assert.deepEqual(store.document.emitters,before.emitters);assert.equal(store.document.lighting.emitter,'flame');
 const snapshot=structuredClone(store.document);
 assert.throws(()=>store.transact([{op:'delete',path:['lighting','emitter']},{op:'delete',path:['actors',0]}]),/object field/);assert.deepEqual(store.document,snapshot);
 assert.throws(()=>store.transact([{op:'delete',path:['schemaVersion']}]));assert.throws(()=>store.transact([{op:'delete',path:['bounds']}]));assert.deepEqual(store.document,snapshot);
});
