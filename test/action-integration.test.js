import {ActorBehaviorRuntime} from '../src/actor-behaviors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {actionFixture} from './action-fixture.mjs';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {assertDocument} from '../src/schema.js';
import {removeSceneEntity} from '../src/scene-graph.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';
import {compileScene} from '../tools/compile-scene.mjs';
import {createCampfire} from '../examples/campfire.js';
import {CampfireEnsemble} from '../src/ensemble.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
const constructors=[d=>new SceneController(d),d=>new IllustrationController(d,{behaviorFactory:BehaviorRuntime})];
test('action poses, stats and seeded outcomes match full/lite controllers and replay',()=>{
 const d=assertDocument(actionFixture()),a=constructors[0](d),b=constructors[1](d);
 for(let i=0;i<120;i++){if(i===30)for(const c of [a,b])c.setVariable('fatigue',90);a.step(1/30);b.step(1/30);assert.deepEqual(a.frame().behavior,b.frame().behavior);assert.deepEqual(a.frame().actors,b.frame().actors);}
 for(const c of [a,b]){assert.ok(c.frame().behavior.variables.failures>0);assert.equal(c.frame().actors[0].activity,'lift');const expected=c.frame();c.seek(.5);assert.deepEqual(c.seek(4),expected);assert.equal(c.log.length,1);c.dispose();}
});
test('pause/reduced motion freeze action progress and preview wins over live actions',()=>{
 for(const make of constructors){const c=make(actionFixture());c.step(.1);const first=c.frame();c.pause();c.step(.1);assert.deepEqual(c.frame(),first);c.play();c.reducedMotion=true;for(let i=0;i<20;i++)c.step(.1);assert.deepEqual(c.frame().behavior,first.behavior);assert.deepEqual(c.frame().actors[0].pose,first.actors[0].pose);c.previewClip('character','idle',0,{'root.x':42});assert.equal(c.frame().actors[0].pose['root.x'],42);assert.equal(c.frame().actors[0].activity,undefined);c.clearPreview('character');assert.equal(c.frame().actors[0].activity,'lift');c.dispose();}
});
test('actor removal cleans recipes and all perform references without mutating source',()=>{
 const d=actionFixture();d.actors.push({...structuredClone(d.actors[0]),id:'observer'});const next=removeSceneEntity(d,'actor','character');assertDocument(next);assert.deepEqual(next.behaviorGraph.activities,{});assert.deepEqual(next.behaviorGraph.states.work.actions,[]);assert.deepEqual(next.behaviorGraph.handlers[0].actions,[]);assert.ok(d.behaviorGraph.activities.lift);
});
test('explicit activities take priority over ensemble poses in both runtimes',()=>{
 const d=createCampfire();d.behaviorGraph.activities={greet:{actor:'camper-0',variants:[{id:'wave',clip:'wave',weight:1,speed:{min:1,max:1}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[],onFailure:[]}};d.behaviorGraph.states[d.behaviorGraph.initial].actions.push({type:'perform',activity:'greet'});
 for(const c of [new SceneController(d),new IllustrationController(d,{behaviorFactory:BehaviorRuntime,actorBehaviorFactory:ActorBehaviorRuntime,ensembleFactory:CampfireEnsemble,pointerFactory:ScenePointerInteraction})]){for(let i=0;i<6;i++)c.step(.1);const frame=c.frame().actors.find(a=>a.id==='camper-0');assert.equal(frame.activity,'greet');assert.equal(frame.clip,'wave');const graph=c.graph||c.behaviors;assert.equal(frame.pose['rightArm.rotation'],graph.actionPose('camper-0').pose['rightArm.rotation']);c.dispose();}
});
test('action website persists definitions and compiles without physical simulation',async()=>{
 const d=actionFixture();assert.ok(inspectSceneFeatures(d).features.includes('action-variations'));assert.match(createSceneExport(d,{local:true}).html,/"failureVariants"/);await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/actions-compile-')),manifest=await compileScene(d,path.join(root,'site')),modules=manifest.files.flatMap(f=>f.modules);assert.ok(modules.some(id=>id.endsWith('action-variations.js')));assert.ok(!modules.some(id=>/planck|\/physics\.js|\/scene\.js/.test(id)));d.presentation='sequence';assert.ok(!inspectSceneFeatures(d).features.includes('action-variations'));
});
