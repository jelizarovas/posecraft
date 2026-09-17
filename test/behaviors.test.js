import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorRuntime,BEHAVIOR_LIMITS} from '../src/behaviors.js';
import {createDrawing} from '../src/vector-authoring.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {createEmitter} from '../src/scene-graph.js';
import {sampleEmitters} from '../src/emitters.js';
import {lightingConfig,sampleLighting} from '../src/lighting.js';
import {renderSVG} from '../src/svg.js';
import {createCampfire} from '../examples/campfire.js';
const fixture=()=>{const d=createDrawing(),p=Object.values(d.packs)[0];p.inputs.flag={type:'boolean',default:false};p.inputs.emotion={type:'string',default:'neutral',options:['neutral','happy']};d.presentation='live';d.emitters=[createEmitter('flame','fire')];d.lighting={enabled:true,emitter:'fire',showSource:true};d.behaviorGraph={seed:73,variables:{enabled:true,count:0},initial:'on',states:{on:{actions:[{type:'emitter',emitter:'fire',enabled:true}]},off:{actions:[{type:'emitter',emitter:'fire',enabled:false}]},happy:{actions:[{type:'input',actor:'$actor',input:'emotion',value:'happy'}]}},edges:[{id:'stop',from:'*',to:'off',event:'stop',weight:1},{id:'restart',from:'off',to:'on',after:{min:.2,max:.4},when:{variable:'enabled',op:'eq',value:true},weight:1},{id:'smile',from:'on',to:'happy',event:'smile',weight:1}],handlers:[{event:'flag',actions:[{type:'input',actor:'$actor',input:'flag',value:true},{type:'set',variable:'count',value:7}]}]};return d;};

test('weighted branches and randomized delays are seeded, resettable and indefinite',()=>{
 const d=fixture();d.behaviorGraph.edges=[{id:'a',from:'*',to:'on',after:{min:.01,max:.03},weight:1},{id:'b',from:'*',to:'off',after:{min:.01,max:.03},weight:2}];const a=new BehaviorRuntime(d),b=new BehaviorRuntime(d);for(let i=0;i<2000;i++){a.tick(.01);b.tick(.01);}assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(a.snapshot().transitions>500);const expected=a.snapshot();a.reset();for(let i=0;i<2000;i++)a.tick(.01);assert.deepEqual(a.snapshot(),expected);a.tick(1000000);assert.ok(Number.isFinite(a.time));
});

test('handlers preserve current state, resolve the event actor and pass target coordinates',()=>{
 const d=fixture(),actions=[],r=new BehaviorRuntime(d,{apply:(a,p)=>actions.push([a,p])});r.dispatch('stop');r.tick(0);r.dispatch('flag',{actor:d.actors[0].id,x:25,y:50});r.tick(0);assert.equal(r.state,'off');assert.equal(r.variables.count,7);const input=actions.find(([a])=>a.type==='input');assert.equal(input[0].actor,d.actors[0].id);assert.deepEqual(input[1],{actor:d.actors[0].id,x:25,y:50});
 const before=actions.length;r.dispatch('flag');r.tick(0);assert.equal(actions.length,before);assert.equal(r.state,'off');
});

test('variable conditions block timers and set actions remain typed',()=>{
 const r=new BehaviorRuntime(fixture());r.dispatch('stop');r.tick(0);r.setVariable('enabled',false);r.tick(5);assert.equal(r.state,'off');r.setVariable('enabled',true);r.tick(0);assert.equal(r.state,'on');assert.throws(()=>r.setVariable('enabled',1));assert.throws(()=>r.setVariable('count',NaN));assert.throws(()=>r.setVariable('missing',1));
});

test('zero-time cycles and handler event storms are bounded per tick and queues stay capped',()=>{
 const d=fixture();d.behaviorGraph.edges=[{id:'loop',from:'on',to:'on',after:{min:0,max:0},weight:1}];let r=new BehaviorRuntime(d);r.tick(0);assert.equal(r.snapshot().transitions,BEHAVIOR_LIMITS.transitions);r.tick(0);assert.equal(r.snapshot().transitions,16);
 d.behaviorGraph.edges=[];d.behaviorGraph.handlers=[{event:'repeat',actions:[{type:'event',event:'repeat'}]}];r=new BehaviorRuntime(d);for(let i=0;i<1000;i++)r.dispatch('repeat');assert.equal(r.snapshot().pendingEvents,64);assert.equal(r.snapshot().droppedEvents,936);r.tick(0);assert.equal(r.snapshot().pendingEvents,64);
});

test('scene event replay is deterministic across cadence and does not record generated actions',()=>{
 const d=fixture(),a=new SceneController(d),b=new SceneController(d);a.dispatch('stop');b.dispatch('stop');a.dispatch('flag',{actor:d.actors[0].id});b.dispatch('flag',{actor:d.actors[0].id});for(let i=0;i<120;i++)a.step(1/120);for(let i=0;i<30;i++)b.step(1/30);assert.deepEqual(a.frame(),b.frame());assert.equal(a.log.length,2);const expected=a.frame();a.seek(.2);assert.deepEqual(a.seek(1),expected);assert.equal(a.frame().actors[0].inputs.flag,true);
 a.setVariable('enabled',false);a.dispatch('stop');const current=a.frame();assert.deepEqual(a.seek(1),current);
});

test('emitter runtime overrides affect particles, bound light and SVG without source mutation',()=>{
 const d=fixture(),source=structuredClone(d),c=new SceneController(d);c.dispatch('stop');const f=c.frame();assert.equal(f.emitterOverrides.fire.enabled,false);assert.ok(sampleEmitters(d,1,f)[0].particles.every(p=>p.opacity===0));assert.equal(sampleLighting(lightingConfig(d,f),1).intensity,0);assert.match(renderSVG(d,f),/data-emitter="fire"[^>]*display="none"/);assert.match(renderSVG(d,f),/data-floor-strength=""/);assert.deepEqual(d,source);c.step(.1);c.step(.1);c.step(.1);c.step(.1);assert.equal(c.frame().emitterOverrides.fire.enabled,true);
});

test('sequence presentation suppresses graph execution while ordinary scene behavior stays compatible',()=>{
 const d=fixture();d.presentation='sequence';const c=new SceneController(d);assert.equal(c.dispatch('stop'),false);assert.equal(c.frame().behavior,undefined);assert.equal(c.frame().emitterOverrides,undefined);delete d.presentation;const live=new SceneController(d);assert.equal(live.dispatch('stop'),true);assert.equal(live.frame().behavior.state,'off');
});

test('behavior data rejects missing refs, malformed delays, unsafe types and resource excess',()=>{
 assertDocument(fixture());for(const corrupt of [d=>d.presentation='movie',d=>d.behaviorGraph.seed=-1,d=>d.behaviorGraph.initial='missing',d=>d.behaviorGraph.edges[0].to='missing',d=>d.behaviorGraph.edges[0].after={min:0,max:1},d=>d.behaviorGraph.edges[1].after={min:4,max:1},d=>d.behaviorGraph.edges[0].weight=0,d=>d.behaviorGraph.edges[1].when.value=1,d=>d.behaviorGraph.states.on.actions[0].emitter='missing',d=>d.behaviorGraph.states.on.actions=[{type:'eval',code:'alert(1)'}],d=>d.behaviorGraph.states.happy.actions[0].value='missing',d=>d.behaviorGraph.handlers.push(structuredClone(d.behaviorGraph.handlers[0])),d=>d.behaviorGraph.edges=Array.from({length:129},(_,i)=>({...d.behaviorGraph.edges[0],id:'edge-'+i})),d=>d.behaviorGraph.variables.bad=Infinity]){const d=fixture();corrupt(d);assert.equal(validateDocument(d).valid,false,corrupt.toString());}
 const r=new BehaviorRuntime(fixture());assert.throws(()=>r.dispatch('bad event'));assert.throws(()=>r.dispatch('valid',{actor:'missing'}));assert.throws(()=>r.dispatch('valid',{x:Infinity}));assert.throws(()=>r.dispatch('valid',{script:'bad'}));
});

test('pointer event commands replay once, with unchanged graph state on handler-only gestures',()=>{
 const d=fixture();d.interactions=[{id:'touch',actor:d.actors[0].id,gesture:'click',response:'event',event:'flag',resistance:0}];const c=new SceneController(d);c.pointer({binding:'touch',phase:'click',x:12,y:15});assert.equal(c.frame().actors[0].inputs.flag,true);assert.equal(c.log.length,1);assert.equal(c.log[0].type,'pointer');const expected=c.frame();assert.deepEqual(c.seek(0),expected);
});


test('cold campfire recovers through fire-lit event and seeks identically without generated log entries',()=>{
 const d=createCampfire(),c=new SceneController(d);c.dispatch('extinguish-fire');const cold=c.frame();assert.equal(cold.behavior.state,'cold');assert.equal(cold.ensemble.fire.lit,false);assert.ok(Object.values(cold.emitterOverrides).some(e=>!e.enabled));for(let i=0;i<600;i++)c.step(.1);const expected=c.frame();assert.equal(expected.behavior.state,'warm');assert.equal(expected.ensemble.fire.lit,true);assert.equal(c.log.length,1);assert.deepEqual(c.seek(60),expected);
});
