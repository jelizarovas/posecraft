import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {createEmitter,nodeVisible,removeGroup,removeSceneEntity} from '../src/scene-graph.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {lightingConfig,sampleLighting} from '../src/lighting.js';
import {emitterPulse} from '../src/emitters.js';
import {SceneController} from '../src/scene.js';
import {DocumentStore} from '../src/commands.js';
import {createCampfire} from '../examples/campfire.js';
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


test('actor removal cleans pointer bindings and behavior references while preserving independent actions',()=>{
 const doc=fixture();doc.packs.drawing.inputs.flag={type:'boolean',default:false};doc.actors.push({...structuredClone(doc.actors[0]),id:'guest'});doc.interactions=[{id:'touch',actor:'character',gesture:'click',response:'event',event:'touch',resistance:0},{id:'guest-touch',actor:'guest',gesture:'click',response:'event',event:'touch',resistance:0}];
 const actions=[{type:'input',actor:'character',input:'flag',value:true},{type:'input',actor:'$actor',input:'flag',value:true},{type:'emitter',emitter:'flame',enabled:false},{type:'event',actor:'character',event:'done'},{type:'event',event:'remaining'},{type:'set',variable:'active',value:true}];doc.behaviorGraph={seed:1,variables:{active:false},initial:'idle',states:{idle:{actions:structuredClone(actions)}},edges:[],handlers:[{event:'touch',actions:structuredClone(actions)}]};assertDocument(doc);const before=structuredClone(doc),next=removeSceneEntity(doc,'actor','character');assertDocument(next);assert.deepEqual(next.interactions.map(b=>b.actor),['guest']);assert.deepEqual(next.behaviorGraph.states.idle.actions,actions.filter(a=>a.actor!=='character'&&a.type!=='emitter'));assert.deepEqual(next.behaviorGraph.handlers[0].actions,next.behaviorGraph.states.idle.actions);assert.deepEqual(doc,before);
 const empty=removeSceneEntity(next,'actor','guest');assertDocument(empty);assert.ok(empty.behaviorGraph.states.idle.actions.every(a=>a.type!=='input'));assert.deepEqual(empty.interactions,[]);
});

test('emitter removal cleans state and handler actions and preserves unused feature declarations',()=>{
 const doc=fixture();doc.requiredFeatures=['procedural-emitters','behavior-graphs'];doc.behaviorGraph={seed:1,variables:{},initial:'idle',states:{idle:{actions:[{type:'emitter',emitter:'flame',enabled:true}]}},edges:[],handlers:[{event:'stop',actions:[{type:'emitter',emitter:'flame',enabled:false}]}]};const next=removeSceneEntity(doc,'emitter','flame');assertDocument(next);assert.deepEqual(next.behaviorGraph.states.idle.actions,[]);assert.deepEqual(next.behaviorGraph.handlers[0].actions,[]);assert.deepEqual(next.requiredFeatures,doc.requiredFeatures);assert.equal(next.lighting.enabled,false);
});

test('removing a campfire member retires ensemble actions without deleting graph states or variables',()=>{
 const doc=createCampfire(),member=doc.ensemble.members[0],next=removeSceneEntity(doc,'actor',member);assertDocument(next);assert.equal(next.ensemble,undefined);for(const state of Object.values(next.behaviorGraph.states))assert.ok(state.actions.every(a=>a.type!=='ensemble'));for(const handler of next.behaviorGraph.handlers)assert.ok(handler.actions.every(a=>a.type!=='ensemble'));assert.deepEqual(Object.keys(next.behaviorGraph.states),Object.keys(doc.behaviorGraph.states));assert.deepEqual(next.behaviorGraph.variables,doc.behaviorGraph.variables);assert.ok(doc.ensemble);
});
