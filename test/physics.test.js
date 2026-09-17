import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SceneController,STEP} from '../src/scene.js';
import {validateDocument} from '../src/schema.js';
import {SoundEffects,soundPattern} from '../src/audio.js';
const library=Object.fromEntries(['ona','wwwzard','rusty'].map(id=>[id,JSON.parse(fs.readFileSync(new URL(`../examples/characters/${id}.json`,import.meta.url)))]));
const advance=(c,n)=>{for(let i=0;i<n;i++)c.step(STEP);};
test('physical rigs keep anchors and joint limits under forces and contacts',()=>{
 for(const [id,d] of Object.entries(library))for(const mode of ['floating','ragdoll','protective']){
  const c=new SceneController(d);c.setBehavior(id,{mode});c.interact(id,'toss');
  for(let i=0;i<720;i++){if(i===180)c.setAcceleration(4000,-2000);if(i===240)c.setAcceleration(0,0);c.step(STEP);const a=c.frame().actors[0];assert.ok(Object.values(a.pose).every(Number.isFinite));
   for(const [joint,link] of c.actors[0].physics.joints){const spec=d.packs[id].joints.find(j=>j.id===joint),angle=link.getJointAngle()*180/Math.PI+spec.rotation;assert.ok(angle>spec.min-4&&angle<spec.max+4,`${id}/${mode}/${joint}: ${angle}`);const p=link.getAnchorA(),q=link.getAnchorB();assert.ok(Math.hypot(p.x-q.x,p.y-q.y)*50<4,`${id}/${joint} disconnected`);}
  }
  const state=c.frame().actors[0].physics;assert.ok(state.center.x>-30&&state.center.x<d.bounds.width+30);assert.ok(state.center.y>-100&&state.center.y<d.bounds.height+100);
 }
});
test('protective response precedes actual impact, changes face, and recovers without repeated floor impacts',()=>{
 const c=new SceneController(library.ona),events=[];c.subscribe(e=>events.push(e));c.setBehavior('ona',{mode:'protective',strategy:'protect'});c.interact('ona','drop');
 let hurt=false;for(let i=0;i<720;i++){c.step(STEP);if(c.frame().actors[0].response==='hurt'){hurt=true;assert.equal(c.frame().actors[0].inputs.emotion,'hurt');}}
 const protect=events.find(e=>e.to==='protecting'),impact=events.find(e=>e.type==='impact');assert.ok(protect&&impact);assert.ok(protect.time<impact.time);assert.ok(impact.speed>90);assert.ok(hurt);assert.ok(events.some(e=>e.to==='recovering'));assert.equal(c.frame().actors[0].response,'calm');assert.ok(events.filter(e=>e.type==='impact').length<5,'standing support must not create repeated impacts');
});
test('physical mode changes retain body objects, positions and velocities; zero muscles disables motors',()=>{
 const c=new SceneController(library.ona);c.setBehavior('ona',{mode:'floating'});c.interact('ona','toss');advance(c,20);const rig=c.actors[0].physics,p={...rig.root.getPosition()},v={...rig.root.getLinearVelocity()};c.setBehavior('ona',{mode:'protective',resistance:0});assert.equal(c.actors[0].physics,rig);assert.deepEqual({...rig.root.getPosition()},p);assert.deepEqual({...rig.root.getLinearVelocity()},v);c.step(STEP);assert.ok([...rig.joints.values()].every(j=>!j.isMotorEnabled()));c.setBehavior('ona',{resistance:1});c.step(STEP);assert.ok([...rig.joints.values()].every(j=>j.isMotorEnabled()));
});
test('reduced motion holds physical transforms and explicit face override survives interactions',()=>{
 const c=new SceneController(library.ona);c.setBehavior('ona',{mode:'floating',autoFace:false});c.setInput('ona','emotion','happy');c.interact('ona','toss');advance(c,20);c.reducedMotion=true;const world=c.frame().actors[0].world;c.interact('ona','hurt');advance(c,30);assert.deepEqual(c.frame().actors[0].world,world);assert.equal(c.frame().actors[0].inputs.emotion,'happy');
});
test('physics scenarios replay the same frame without duplicate application events',()=>{
 const c=new SceneController(library.rusty);c.setBehavior('rusty',{mode:'protective'});c.interact('rusty','drop');advance(c,180);const before=c.frame();let events=0;c.subscribe(()=>events++);c.seek(1.5);assert.deepEqual(c.frame(),before);assert.equal(events,0);
});
test('physics schema rejects bad fixtures, unknown modes, and impossible target angles',()=>{
 for(const mutate of [d=>d.actors[0].behavior={mode:'unknown'},d=>d.actors[0].behavior={resistance:4},d=>d.packs.ona.physics.bodies.head.width=-1,d=>delete d.packs.ona.physics.bodies.root,d=>d.packs.ona.physics.responses.protect['head.rotation']=999]){const d=structuredClone(library.ona);mutate(d);assert.equal(validateDocument(d).valid,false);}
});
test('sound is opt-in, finite, bounded, and safe to import without browser globals',async()=>{
 const s=new SoundEffects();assert.equal(s.enabled,false);assert.equal(s.handle({type:'interaction',interaction:'pet'}),false);assert.equal(await s.unlock(),false);assert.throws(()=>s.setVolume(NaN));s.setVolume(10);assert.equal(s.volume,1);s.dispose();
 for(const to of ['hurt','bracing','protecting','recovering','relieved']){const [from,end,duration]=soundPattern({type:'response',to});assert.ok(from>0&&end>0&&duration>0&&duration<.5);}
 assert.equal(soundPattern({type:'response',to:'calm'}),null);
});

test('oversized collision rigs report a recoverable error without breaking frame evaluation',()=>{
 const d=structuredClone(library.ona);d.actors[0].transform.scale=10;const c=new SceneController(d);assert.throws(()=>c.setBehavior('ona',{mode:'protective'}),/do not fit/);assert.equal(c.frame().actors[0].physics,null);
 d.actors[0].behavior={mode:'protective'};const loaded=new SceneController(d),events=[];loaded.subscribe(e=>events.push(e));loaded.step(STEP);assert.equal(loaded.frame().actors[0].response,'unsupported');assert.ok(events.some(e=>e.type==='error'));assert.ok(Object.values(loaded.frame().actors[0].pose).every(Number.isFinite));
});
