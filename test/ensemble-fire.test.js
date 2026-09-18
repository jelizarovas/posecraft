import {ActorBehaviorRuntime} from '../src/actor-behaviors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire} from '../examples/campfire.js';
import {IllustrationController} from '../src/illustration.js';
import {CampfireEnsemble} from '../src/ensemble.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics} from '../src/spatial.js';
import {sampleEmitters} from '../src/emitters.js';
import {lightingConfig,sampleLighting} from '../src/lighting.js';
const actor=(frame,id='camper-0')=>frame.actors.find(a=>a.id===id);
const world=(document,frame,id,joint)=>{const a=actor(frame,id),source=document.actors.find(v=>v.id===id),w=spatialKinematics(document.packs[source.pack],a.pose)[joint],p=a.placement;return {x:p.x+w.x*p.scale,y:p.y+w.y*p.scale};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('editable fire graph disables heat, all fire effects and linked lighting without changing authored emitters',()=>{
 const d=createCampfire(),c=new SceneController(d);assert.equal(d.presentation,'live');assert.deepEqual(d.behaviorGraph.edges.find(e=>e.id==='recover').after,{min:8,max:14});c.dispatch('extinguish-fire');const initial=c.frame(),cold=c.seek(5);assert.equal(cold.behavior.state,'cold');assert.equal(cold.behavior.variables.fireEnabled,false);assert.equal(cold.ensemble.fire.lit,false);
 for(const id of d.ensemble.members){assert.equal(actor(cold,id).heat,actor(initial,id).heat);assert.ok(actor(cold,id).pose['camp-cold.opacity']>.3);assert.match(actor(cold,id).activity,/cold/);assert.equal(actor(cold,id).pose['snack-flame.opacity'],0);}
 assert.ok(sampleEmitters(d,5,cold).every(e=>e.particles.every(p=>p.opacity===0)));assert.equal(sampleLighting(lightingConfig(d,cold),5).intensity,0);assert.ok(c.document.emitters.every(e=>e.enabled));c.triggerEnsemble('burn');assert.equal(actor(c.frame()).heat,actor(cold).heat);c.dispose();
});

test('editing recovery delay changes the live sequence and helper walks, relights, and returns before cooking resumes',()=>{
 const d=createCampfire();d.behaviorGraph.edges.find(e=>e.id==='recover').after={min:1,max:1};const c=new SceneController(d);c.dispatch('extinguish-fire');const walking=c.seek(2),id=walking.ensemble.fire.actor;assert.equal(walking.ensemble.fire.phase,'approach');assert.ok(distance(actor(walking,id).placement,d.actors.find(a=>a.id===id).transform)>4);assert.ok(actor(walking,id).groundY!==undefined);const restored=c.seek(6);assert.equal(restored.ensemble.fire.lit,true);assert.equal(restored.behavior.state,'warm');assert.equal(restored.behavior.variables.fireEnabled,true);assert.ok(restored.ensemble.events.some(e=>e.type==='fire-lit'));assert.ok(sampleEmitters(d,6,restored).some(e=>e.particles.some(p=>p.opacity>0)));const returned=c.seek(10);assert.equal(returned.ensemble.fire.actor,null);assert.deepEqual(actor(returned,id).placement,d.actors.find(a=>a.id===id).transform);assert.ok(actor(returned,'camper-0').heat>actor(walking,'camper-0').heat);c.dispose();
});

test('food release produces one ballistic snack, anger, disappearance and replacement without interrupting fire state',()=>{
 const d=createCampfire(),c=new SceneController(d);c.dispatch('food-throw',{actor:'camper-0',x:390,y:160});const first=c.frame(),a=c.seek(.4),b=c.seek(.6),gone=c.seek(2.6);assert.ok(distance(world(d,first,'camper-0','food'),{x:390,y:160})<.01);assert.ok(distance(world(d,a,'camper-0','food'),world(d,b,'camper-0','food'))>8);assert.ok(actor(a).pose['camp-angry.opacity']>.9);assert.equal(actor(gone).pose['food.opacity'],0);assert.equal(actor(gone).pose['toast.opacity'],0);assert.equal(a.behavior.state,'warm');assert.ok(a.ensemble.events.some(e=>e.type==='angry'));assert.equal(actor(c.seek(5)).pose['food.opacity'],1);c.dispose();
});

test('shoo gesture is actor targeted and does not reset the cold recovery deadline',()=>{
 const d=createCampfire(),c=new SceneController(d);c.dispatch('extinguish-fire');c.seek(2);const deadline=c.graph.deadlines.get('recover');c.dispatch('face-shoo',{actor:'camper-1',x:480,y:200});const f=c.seek(2.5);assert.equal(c.graph.deadlines.get('recover'),deadline);assert.match(actor(f,'camper-1').activity,/shooing/);assert.ok(actor(f,'camper-1').pose['camp-angry.opacity']>.9);assert.equal(actor(f,'camper-0').pose['camp-angry.opacity'],0);c.dispose();
});

test('fire recovery and pointer reactions replay identically across frame cadence',()=>{
 const d=createCampfire(),a=new SceneController(d),b=new SceneController(d);for(const c of [a,b]){c.dispatch('extinguish-fire');c.dispatch('face-shoo',{actor:'camper-1',x:480,y:200});}for(let i=0;i<1200;i++)a.step(1/60);const af=a.frame(),bf=b.seek(20);assert.deepEqual(af.ensemble,bf.ensemble);assert.equal(af.behavior.state,bf.behavior.state);for(const id of d.ensemble.members){assert.ok(distance(actor(af,id).placement,actor(bf,id).placement)<1e-6);for(const key of Object.keys(actor(af,id).pose))assert.ok(Math.abs(actor(af,id).pose[key]-actor(bf,id).pose[key])<1e-6,key);}a.dispose();b.dispose();
});

test('retiring a relighter releases their reservation and another camper can recover the fire',()=>{
 const d=createCampfire();d.behaviorGraph.edges.find(e=>e.id==='recover').after={min:1,max:1};const c=new SceneController(d);c.dispatch('extinguish-fire');const f=c.seek(2),id=f.ensemble.fire.actor;c.setInput(id,'action','wave');for(let i=0;i<200;i++)c.step(.05);const done=c.frame();assert.equal(done.ensemble.fire.lit,true);assert.ok(done.ensemble.events.some(e=>e.type==='fire-recovery-cancelled'));assert.deepEqual(actor(done,id).placement||d.actors.find(a=>a.id===id).transform,d.actors.find(a=>a.id===id).transform);c.dispose();
});

test('a second extinguishing cycle restarts autonomously while the social scene continues',()=>{
 const c=new SceneController(createCampfire());c.dispatch('extinguish-fire');c.seek(25);c.dispatch('extinguish-fire');const end=c.seek(52);assert.equal(end.ensemble.fire.lit,true);assert.equal(end.behavior.state,'warm');assert.ok(end.ensemble.events.some(e=>e.type==='fire-lit'&&e.time>25));assert.ok(end.ensemble.events.some(e=>['conversation','meteor','fire','stars','dozing'].includes(e.type)&&e.time>25));c.dispose();
});


test('unavailable authored flames cannot heat food or signal restoration in full and lightweight runtimes',()=>{
 for(const patch of [{enabled:false},{rate:0},{opacity:0}]){const d=createCampfire();Object.assign(d.emitters.find(e=>e.id==='fire-flame'),patch);const full=new SceneController(d),lite=new IllustrationController(d,{actorBehaviorFactory:ActorBehaviorRuntime,ensembleFactory:CampfireEnsemble,behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});for(const c of [full,lite]){const initial=c.frame(),cold=c.seek(25);assert.equal(cold.ensemble.fire.lit,false);assert.equal(cold.ensemble.fire.available,false);assert.equal(cold.ensemble.fire.blocked,true);assert.equal(cold.ensemble.fire.heat,0);assert.ok(!cold.ensemble.events.some(e=>e.type==='fire-lit'));assert.ok(cold.ensemble.events.some(e=>e.type==='fire-restart-blocked'));for(const id of d.ensemble.members)assert.equal(actor(cold,id).heat,actor(initial,id).heat);c.dispatch('ignite-fire');assert.equal(c.frame().ensemble.fire.lit,false);assert.ok(sampleEmitters(d,25,c.frame()).every(e=>e.particles.every(p=>p.opacity===0)));assert.equal(sampleLighting(lightingConfig(d,c.frame()),25).intensity,0);}assert.deepEqual(full.frame().ensemble,lite.frame().ensemble);assert.deepEqual(full.frame().emitterOverrides,lite.frame().emitterOverrides);full.dispose();lite.dispose();}
});

test('graph flame disable controls heat and visuals; an explicit enable restores both runtimes',()=>{
 const d=createCampfire();d.behaviorGraph.handlers.push({event:'disable-source',actions:[{type:'emitter',emitter:'fire-flame',enabled:false}]},{event:'enable-source',actions:[{type:'emitter',emitter:'fire-flame',enabled:true}]});const full=new SceneController(d),lite=new IllustrationController(d,{actorBehaviorFactory:ActorBehaviorRuntime,ensembleFactory:CampfireEnsemble,behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});for(const c of [full,lite]){c.dispatch('disable-source');const cold=c.seek(25);assert.equal(cold.ensemble.fire.available,false);assert.equal(cold.ensemble.fire.blocked,true);assert.equal(cold.emitterOverrides['fire-flame'].enabled,false);assert.ok(!cold.ensemble.events.some(e=>e.type==='fire-lit'));c.dispatch('enable-source');c.step(.05);const warm=c.frame();assert.equal(warm.ensemble.fire.lit,true);assert.equal(warm.ensemble.fire.available,true);assert.equal(warm.ensemble.fire.blocked,false);assert.equal(warm.emitterOverrides['fire-flame'].enabled,true);assert.equal(warm.behavior.state,'warm');assert.ok(warm.ensemble.events.some(e=>e.type==='fire-lit'));}assert.deepEqual(full.frame().ensemble,lite.frame().ensemble);full.dispose();lite.dispose();
});
