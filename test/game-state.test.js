import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneController,STEP} from '../src/scene.js';
import {gameSceneSignature} from '../src/game-state.js';
import {createDemo} from '../examples/showcase.js';
const advance=(c,seconds)=>{for(let i=0;i<Math.round(seconds/STEP);i++)c.step(STEP);};
function fixture(){
 const d=createDemo('corner-shop');d.requiredFeatures.push('behavior-graphs','actor-behaviors');
 d.behaviorGraph={seed:17,initial:'closed',variables:{repaired:false,visits:0},states:{closed:{actions:[]},open:{actions:[{type:'add',variable:'visits',value:1}]}},edges:[{id:'repair',from:'closed',to:'open',event:'repaired',weight:1},{id:'close',from:'open',to:'closed',after:{min:8,max:12},weight:1}]};
 d.actorBehaviors=[{id:'mood',actor:'shopkeeper',graph:{seed:44,initial:'waiting',variables:{patience:0},states:{waiting:{actions:[]},ready:{actions:[]}},edges:[{id:'ready',from:'waiting',to:'ready',after:{min:5,max:8},weight:1}]},rates:[{variable:'patience',perSecond:1}]}];
 d.objects.push({id:'parcel',name:'Parcel',shape:'circle',x:50,y:50,radius:8,fill:'#aa6633',mass:1});return d;
}
test('JSON semantic save restores positions, state, input, graph decisions and objects without replaying entry effects',()=>{
 const c=new SceneController(fixture()),events=[];c.subscribe(e=>events.push(e));
 c.setInput('shopkeeper','emotion','happy');c.setVariable('repaired',true);c.dispatch('repaired');advance(c,.4);
 c.gamePerformance.ground.set('shopkeeper',{'root.x':64,'root.y':-12});c.objectCommand({type:'enable',object:'shop-light',enabled:true});
 const original=c.snapshot(),save=JSON.parse(JSON.stringify(original));c.setVariable('visits',90);c.setInput('shopkeeper','emotion','sad');advance(c,1);
 c.gameCommand({type:'action',actor:'shopkeeper',request:'interrupted',clip:'wave'});events.length=0;c.restore(save);
 assert.deepEqual(c.snapshot(),save);assert.equal(c.graph.variables.visits,1);assert.equal(c.gamePerformance.active.size,0);assert.equal(events.length,1);assert.equal(events[0].request,'interrupted');assert.equal(events[0].cancelled,true);assert.equal(c.log.length,0);
 const fresh=new SceneController(fixture());fresh.restore(save);advance(c,3);advance(fresh,3);assert.deepEqual(c.snapshot(),fresh.snapshot());assert.equal(c.graph.variables.visits,1);c.dispose();fresh.dispose();
});
test('malformed or incompatible saves do not mutate state or cancel commands',()=>{
 const c=new SceneController(fixture());c.gameCommand({type:'action',actor:'shopkeeper',request:'pending',clip:'wave'});const save=c.snapshot(),events=[];c.subscribe(e=>events.push(e));
 const cases=[s=>s.version=2,s=>s.scene+='bad',s=>s.actors.push(s.actors[0]),s=>s.actors[0].position={x:NaN,y:0},s=>s.actors[0].inputs.emotion='unknown',s=>s.behavior.variables.visits='bad',s=>s.behavior.state='constructor',s=>s.behavior.deadlines.fake=2,s=>s.objects[1].owner={actor:'missing',joint:'head'},s=>s.actorBehaviors[0].state.rng=-1];
 for(const mutate of cases){const broken=structuredClone(save);mutate(broken);assert.throws(()=>c.restore(broken));assert.deepEqual(c.snapshot(),save);assert.equal(c.gamePerformance.active.size,1);assert.deepEqual(events,[]);}
 const other=fixture();other.packs.ona.name+=' changed';assert.throws(()=>new SceneController(other).restore(save),/differs/);c.dispose();
});
test('owner identity survives, velocity does not, and invalid grips reject before mutation',()=>{
 const c=new SceneController(fixture()),parcel=c.objects.bodies.find(b=>b.id==='parcel');parcel.owner={actor:'shopkeeper',joint:'rightArm',offsetX:2,offsetY:1};parcel.vx=90;parcel.vy=-40;
 const save=c.snapshot();c.objectCommand({type:'release',object:'parcel'});c.restore(save);const restored=c.objects.bodies.find(b=>b.id==='parcel');assert.deepEqual(restored.owner,save.objects[1].owner);assert.equal(restored.vx,0);assert.equal(restored.vy,0);assert.equal(c.objects.contacts.size,0);assert.throws(()=>c.setActorSleeping('shopkeeper',true),/carried/);c.dispose();
});
test('semantic loading never replays pending events or an interrupted graph activity',()=>{
 const c=new SceneController(fixture());c.graph.dispatch('repaired');const save=c.snapshot();c.restore(save);advance(c,.1);assert.equal(c.graph.state,'closed');assert.equal(c.graph.variables.visits,0);assert.equal(c.graph.queue.length,0);c.dispose();
});
test('specialized simulations and active physics/preview cannot silently produce lossy saves',()=>{
 const campfire=new SceneController(createDemo('campfire-night'));assert.throws(()=>campfire.snapshot(),/specialized/);campfire.dispose();
 const c=new SceneController(fixture());c.previewClip('shopkeeper','wave',0);assert.throws(()=>c.snapshot(),/preview/);c.clearPreview('shopkeeper');c.setBehavior('shopkeeper',{mode:'ragdoll',autoRecover:false});assert.throws(()=>c.snapshot(),/animated/);c.dispose();
});
test('signature survives JSON reordering but changes when scene content changes',()=>{
 const d=fixture(),ordered=JSON.parse(JSON.stringify(d,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value));assert.equal(gameSceneSignature(d),gameSceneSignature(ordered));ordered.bounds.width++;assert.notEqual(gameSceneSignature(d),gameSceneSignature(ordered));
});
test('saving authored root animation does not turn its current offset into a permanent navigation anchor',()=>{
 const d=fixture(),pack=d.packs.ona;pack.clips[pack.states[pack.initial].clip].tracks['root.x']=[[0,0],[1,20],[2,0]];
 const a=new SceneController(d),b=new SceneController(d);advance(a,.4);const save=a.snapshot();assert.equal(save.actors[0].position,null);b.restore(save);assert.equal(b.gamePerformance.ground.has('shopkeeper'),false);advance(a,.3);advance(b,.3);assert.deepEqual(b.frame().actors[0].pose,a.frame().actors[0].pose);a.dispose();b.dispose();
});
test('sleep freezes actor simulation and scoped decisions; wake advances without catching up',()=>{
 const c=new SceneController(fixture()),a=c.actors[0];c.gamePerformance.ground.set(a.actor.id,{'root.x':38,'root.y':0});advance(c,.2);c.setActorSleeping(a.actor.id,true);const pose=c.frame().actors[0].pose,time=a.runtime.time,patience=c.actorBehaviors.scopes[0].runtime.variables.patience;
 advance(c,2);assert.equal(a.runtime.time,time);assert.equal(c.actorBehaviors.scopes[0].runtime.variables.patience,patience);assert.deepEqual(c.frame().actors[0].pose,pose);assert.equal(c.frame().actors[0].sleeping,true);
 const save=JSON.parse(JSON.stringify(c.snapshot()));c.restore(save);assert.equal(c.frame().actors[0].sleeping,true);c.setActorSleeping(a.actor.id,false);advance(c,STEP);assert.equal(c.frame().actors[0].sleeping===true,false);assert.equal(a.runtime.layers[0].time,save.actors[0].clipTime+STEP);assert.equal(c.frame().actors[0].pose['root.x'],38);assert.ok(Math.abs(c.actorBehaviors.scopes[0].runtime.variables.patience-patience-STEP)<1e-8);c.dispose();
});
