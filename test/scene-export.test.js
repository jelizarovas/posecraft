import {ActorBehaviorRuntime} from '../src/actor-behaviors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ona from '../examples/characters/ona.json' with {type:'json'};
import {createCampfire} from '../examples/campfire.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';
import {IllustrationController} from '../src/illustration.js';
import {SceneController} from '../src/scene.js';
import {CampfireEnsemble} from '../src/ensemble.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {applyContacts} from '../src/contacts.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {createEmitter} from '../src/scene-graph.js';
import {compileScene} from '../tools/compile-scene.mjs';

const options={actorBehaviorFactory:ActorBehaviorRuntime,ensembleFactory:CampfireEnsemble,behaviorFactory:BehaviorRuntime,contactSolver:applyContacts};
const equivalent=(a,b)=>{assert.equal(a.actors.length,b.actors.length);for(let i=0;i<a.actors.length;i++){assert.equal(a.actors[i].state,b.actors[i].state);for(const key of Object.keys(a.actors[i].pose))assert.ok(Math.abs(a.actors[i].pose[key]-b.actors[i].pose[key])<1e-8,`${a.actors[i].id}.${key} differs`);}};

test('feature inspection uses active motion, not unused physics profiles or pointer resistance',()=>{
 const d=structuredClone(ona);assert.equal(inspectSceneFeatures(d).runtime,'illustration');d.actors[0].behavior={mode:'ragdoll'};assert.equal(inspectSceneFeatures(d).runtime,'physics');assert.throws(()=>new IllustrationController(d),/physics runtime/);
 const camp=createCampfire();assert.equal(inspectSceneFeatures(camp).runtime,'illustration');assert.ok(inspectSceneFeatures(camp).features.includes('ensemble'));
});
test('HTML escapes document and label content, validates runtime URL and preserves source',()=>{
 const d=structuredClone(ona);d.name='</script><img src=x onerror=alert(1)>';const before=JSON.stringify(d),result=createSceneExport(d,{runtimeBase:'https://example.org/posecraft/runtime',label:d.name});assert.equal(JSON.stringify(d),before);assert.ok(result.html.includes('\\u003c/script>'));assert.ok(!result.html.includes('<img src=x'));assert.equal(result.manifest.runtimeURL,'https://example.org/posecraft/runtime/illustration.js');
 for(const runtimeBase of ['javascript:alert(1)','data:text/javascript,evil()','file:///tmp/','https://user:secret@example.org/runtime/','https://example.org/?x=1','./runtime/'])assert.throws(()=>createSceneExport(d,{runtimeBase}),/Runtime URL/);
 assert.equal(createSceneExport(d,{local:true}).manifest.runtimeURL,'./runtime/illustration.js');
});
test('lightweight clips and inertial reactions match the full animated controller',()=>{
 const a=new IllustrationController(ona),b=new SceneController(ona);for(let i=0;i<100;i++){a.setAcceleration(i<45?1900:0,100);b.setAcceleration(i<45?1900:0,100);equivalent(a.step(1/60),b.step(1/60));}a.dispose();b.dispose();
});
test('campfire ensemble and authored previews match without loading physics',()=>{
 const d=createCampfire();delete d.interactions;const a=new IllustrationController(d,options),b=new SceneController(d);for(let i=0;i<60;i++){if(i===10){a.triggerEnsemble('meteor');b.triggerEnsemble('meteor');}if(i===30){a.triggerEnsemble('burn');b.triggerEnsemble('burn');}equivalent(a.step(1/30),b.step(1/30));}for(const actor of d.actors){const clip=d.packs[actor.pack].states[d.packs[actor.pack].initial].clip;a.previewClip(actor.id,clip,.25);b.previewClip(actor.id,clip,.25);}equivalent(a.frame(),b.frame());a.dispose();b.dispose();
});
test('live graph actions, emitter overrides and pointer settling match full-runtime semantics',()=>{
 const d=structuredClone(ona);d.emitters=[createEmitter('flame','fire')];d.interactions=[{id:'head-tug',actor:'ona',joint:'head',gesture:'drag',response:'resist',event:'stop',resistance:.6}];d.behaviorGraph={seed:7,variables:{ready:true},initial:'on',states:{on:{actions:[{type:'emitter',emitter:'fire',enabled:true}]},off:{actions:[{type:'emitter',emitter:'fire',enabled:false},{type:'input',actor:'ona',input:'emotion',value:'happy'}]}},edges:[{id:'stop',from:'on',to:'off',event:'stop',weight:1},{id:'again',from:'off',to:'on',after:{min:.15,max:.2},weight:1}]};
 for(const reducedMotion of [false,true]){const a=new IllustrationController(d,{...options,pointerFactory:ScenePointerInteraction,reducedMotion}),b=new SceneController(d,{reducedMotion});a.dispatch('stop');b.dispatch('stop');for(const phase of ['start','move','end']){const command={binding:'head-tug',phase,x:phase==='start'?100:160,y:120};a.pointer(command);b.pointer(command);}for(let i=0;i<30;i++){const af=a.step(1/120),bf=b.step(1/120);equivalent(af,bf);assert.deepEqual(af.behavior,bf.behavior);assert.deepEqual(af.emitterOverrides,bf.emitterOverrides);}a.seek(.1);b.seek(.1);const replayA=a.seek(.25),replayB=b.seek(.25);equivalent(replayA,replayB);assert.deepEqual(replayA.behavior,replayB.behavior);assert.deepEqual(replayA.emitterOverrides,replayB.emitterOverrides);assert.equal(a.log.filter(e=>e.type==='pointer').length,3,'generated graph actions are not duplicated in replay');a.dispose();b.dispose();}
 const sequence={...d,presentation:'sequence'},c=new IllustrationController(sequence,{pointerFactory:ScenePointerInteraction});assert.equal(c.dispatch('stop'),false);assert.equal(c.frame().behavior,undefined);c.dispose();
});
test('compiler emits only required feature modules, no Planck in authored or campfire websites',async()=>{
 await fs.mkdir(path.resolve('test-results'),{recursive:true});
const root=await fs.mkdtemp(path.resolve('test-results/scene-compile-'));
 for(const [name,document] of [['clip',ona],['campfire',createCampfire()]]){const manifest=await compileScene(document,path.join(root,name));assert.equal(manifest.runtime,'illustration');assert.ok(manifest.files.length);const modules=manifest.files.flatMap(file=>file.modules);assert.ok(!modules.some(id=>/planck|\/physics\.js|\/recovery\.js|\/scene\.js/.test(id)),`${name} has no physical simulation dependency`);if(name==='clip')assert.ok(!modules.some(id=>id.endsWith('/ensemble.js')||id==='src/ensemble.js'),'plain clips omit ensemble code');assert.ok((await fs.readFile(path.join(root,name,'index.html'),'utf8')).includes('./runtime/illustration.js'));await assert.rejects(()=>compileScene(document,path.join(root,name)),/empty output directory/);}
 const physical=structuredClone(ona);physical.actors[0].behavior={mode:'ragdoll'};const full=await compileScene(physical,path.join(root,'physical'));assert.equal(full.runtime,'physics');assert.ok(full.files.some(file=>file.modules.some(id=>id.includes('planck'))),'physical scenes retain Planck');
});
