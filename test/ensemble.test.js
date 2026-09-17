import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire} from '../examples/campfire.js';
import {SceneController} from '../src/scene.js';
import {CampfireEnsemble} from '../src/ensemble.js';
import {spatialKinematics} from '../src/spatial.js';
import {validateDocument} from '../src/schema.js';
const actor=(f,id='camper-0')=>f.actors.find(a=>a.id===id);
test('seeded ensemble is repeatable across seek and frame cadence, without a 24-second story loop',()=>{
 const doc=createCampfire(),a=new SceneController(doc),b=new SceneController(doc);for(let i=0;i<300;i++)a.step(.05);const af=a.frame(),bf=b.seek(15);assert.deepEqual(af.ensemble.events,bf.ensemble.events);assert.deepEqual(af.actors.map(a=>a.activity),bf.actors.map(a=>a.activity));for(const [i,v]of af.actors.entries())for(const key of Object.keys(v.pose))assert.ok(Math.abs(v.pose[key]-bf.actors[i].pose[key])<1e-6,key);
 const first=bf.ensemble.events,beyond=b.seek(60).ensemble.events;assert.ok(beyond.some(e=>e.time>24));assert.notDeepEqual(first,beyond);b.pause();const frozen=JSON.stringify(b.frame());b.step(1);assert.equal(JSON.stringify(b.frame()),frozen);a.dispose();b.dispose();
});
test('attention changes the cooking outcome and rare sharing reserves two actors',()=>{
 const d=createCampfire(),attentive=new CampfireEnsemble(d),distracted=new CampfireEnsemble(d);for(const e of [attentive,distracted]){e.nextSocial=e.nextMeteor=1e9;e.advance(4,new Set());}distracted.trigger('doze');for(const e of [attentive,distracted])e.advance(14,new Set());assert.ok(attentive.recent.some(e=>e.type==='ready'&&e.actors[0]==='camper-0'));assert.ok(distracted.recent.some(e=>e.type==='burn'&&e.detail==='dozing'));
 const natural=new CampfireEnsemble(d),shares=[],event=natural.event.bind(natural);natural.event=(type,actors,detail)=>{if(type==='share')shares.push(natural.time);event(type,actors,detail);};natural.advance(180,new Set());assert.ok(shares.length>=1&&shares.length<=2);assert.ok(natural.recent.length<=32);
});
test('meteor moves along its fading streak and prompts pointing before followers',()=>{
 const d=createCampfire(),c=new SceneController(d);c.triggerEnsemble('meteor');const a=c.seek(.8),b=c.seek(1.6),ap=actor(a,'night').pose,bp=actor(b,'night').pose,theta=bp['meteor-0.rotation']*Math.PI/180,dx=bp['meteor-0.x']-ap['meteor-0.x'],dy=bp['meteor-0.y']-ap['meteor-0.y'];assert.ok(Math.abs(dx*Math.sin(theta)-dy*Math.cos(theta))<1e-7);assert.ok(dx*Math.cos(theta)+dy*Math.sin(theta)>0);assert.ok(bp['meteor-0-tail-0.opacity']>bp['meteor-0-tail-15.opacity']*20);assert.ok(actor(c.seek(3.5),'night').pose['meteor-0.opacity']<bp['meteor-0.opacity']);const events=b.ensemble.events;assert.ok(events.find(e=>e.type==='point').time<events.find(e=>e.type==='follow-gaze').time);assert.ok(b.actors.some(a=>a.activity==='pointing at meteor'));assert.ok(b.actors.filter(a=>a.activity==='watching meteor').length>=2);c.dispose();
});
test('shared food changes ownership once and follows the receiving hand',()=>{
 const d=createCampfire(),c=new SceneController(d);c.triggerEnsemble('share');const before=c.seek(6.9),after=c.seek(7.3);assert.equal(actor(before).pose['food.opacity'],1);assert.equal(actor(before,'camper-1').pose['food.opacity'],0);assert.equal(actor(after).pose['food.opacity'],0);const f=actor(after,'camper-1'),p=d.packs['camper-1'],w=spatialKinematics(p,f.pose);assert.equal(f.pose['food.opacity'],1);assert.ok(Math.hypot(w.food.x-w['hold-hand'].x,w.food.y-w['hold-hand'].y)<.01);assert.equal(after.ensemble.sharing,true);const eating=actor(c.seek(9.6),'camper-1').pose;assert.equal(eating['camp-smile.opacity'],0);assert.equal(eating['camp-chew-open.opacity']+eating['camp-chew-closed.opacity'],1);assert.equal(c.seek(12).ensemble.sharing,false);c.dispose();
});
test('ensemble configuration and scene events reject invalid inputs',()=>{
 const doc=createCampfire();for(const patch of [{seed:-1},{members:['camper-0']},{sky:'missing'},{type:'script'}]){const d=structuredClone(doc);Object.assign(d.ensemble,patch);assert.equal(validateDocument(d).valid,false);}const c=new SceneController(doc);assert.throws(()=>c.triggerEnsemble('execute'));c.dispose();
});

test('unobserved meteors do not invent a pointing participant',()=>{
 const e=new CampfireEnsemble(createCampfire());e.nextSocial=1e9;for(const a of e.members)a.stage=16;e.trigger('meteor');e.advance(2,new Set());assert.ok(e.recent.some(v=>v.type==='meteor'));assert.ok(!e.recent.some(v=>v.type==='point'||v.type==='follow-gaze'));assert.ok(e.recent.every(v=>v.actors.every(id=>typeof id==='string')));
});

test('one brief meteor indication lowers the hand while the head keeps following',()=>{
 const d=createCampfire(),c=new SceneController(d);c.triggerEnsemble('meteor');const raised=c.seek(1),id=raised.ensemble.events.find(e=>e.type==='meteor').actors[0],up=actor(raised,id),down=actor(c.seek(2.3),id),later=actor(c.seek(3),id),member=c.ensemble.members.find(a=>a.id===id);assert.equal(up.activity,'pointing at meteor');const hold1=actor(c.seek(.96),id),hold2=actor(c.seek(1.08),id);for(const joint of ['take-upper','take-elbow'])assert.ok(Math.abs(hold1.pose[joint+'.rotation']-hold2.pose[joint+'.rotation'])<1e-6,'Arm indicates one fixed sighting');assert.equal(down.activity,'watching meteor');assert.equal(later.activity,'watching meteor');assert.ok(Math.hypot(up.world['take-hand'].x-down.world['take-hand'].x,up.world['take-hand'].y-down.world['take-hand'].y)>20);assert.notEqual(down.pose['head.yaw'],later.pose['head.yaw']);assert.ok(!d.packs[id].parts.some(p=>p.id==='camp-point'));c.dispose();
});
test('gaze eases through social and meteor changes without frame jumps',()=>{
 const c=new SceneController(createCampfire());let before=c.frame();for(let i=0;i<720;i++){const f=c.step(1/60);for(const id of c.document.ensemble.members)for(const key of ['head.yaw','head.pitch','head.rotation'])assert.ok(Math.abs(actor(f,id).pose[key]-actor(before,id).pose[key])<6.5,`${id} ${key} at ${f.time}`);before=f;}c.dispose();
});
