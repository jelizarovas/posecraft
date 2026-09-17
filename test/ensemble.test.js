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
const projected=(d,f,id,joint)=>{const a=actor(f,id),p=d.actors.find(v=>v.id===id),w=spatialKinematics(d.packs[p.pack],a.pose)[joint],t=a.placement||p.transform,r=t.rotation*Math.PI/180;return {x:t.x+t.scale*(w.x*Math.cos(r)-w.y*Math.sin(r)),y:t.y+t.scale*(w.x*Math.sin(r)+w.y*Math.cos(r))};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('offer is visible before notice, receiver then walks and ownership waits for projected contact',()=>{
 const d=createCampfire(),live=new SceneController(d);live.triggerEnsemble('share');const waiting=live.seek(3.8);assert.equal(waiting.ensemble.share.phase,'offer');assert.equal(waiting.ensemble.share.noticed,false);assert.equal(waiting.ensemble.share.owner,'camper-1');
 const notice=live.seek(4.7),walking=live.seek(6.5);assert.equal(notice.ensemble.share.phase,'notice');assert.equal(walking.ensemble.share.phase,'approach');assert.ok(Math.abs(actor(walking,'camper-3').placement.x-d.actors.find(a=>a.id==='camper-3').transform.x)>5);assert.ok(actor(walking,'camper-3').groundY!==undefined);
 const before=live.seek(8.65),after=live.seek(9);assert.equal(before.ensemble.share.owner,'camper-1');assert.equal(after.ensemble.share.owner,'camper-3');assert.ok(after.ensemble.share.contact<=3);assert.equal(actor(before,'camper-1').pose['food.opacity'],1);assert.equal(actor(before,'camper-3').pose['food.opacity'],0);assert.equal(actor(before,'camper-3').pose['toast.opacity'],0);assert.equal(actor(after,'camper-1').pose['food.opacity'],0);assert.equal(actor(after,'camper-1').pose['toast.opacity'],0);assert.equal(actor(after,'camper-3').pose['food.opacity'],1);
 const handoff=live.seek(8.8);assert.ok(distance(projected(d,handoff,'camper-1','take-hand'),projected(d,handoff,'camper-3','take-hand'))<=3);assert.ok(distance(projected(d,after,'camper-3','food'),projected(d,after,'camper-3','take-hand'))<.001);
 const eating=actor(live.seek(10.4),'camper-3').pose;assert.equal(eating['camp-smile.opacity'],0);assert.equal(eating['camp-chew-open.opacity']+eating['camp-chew-closed.opacity'],1);const returned=live.seek(20);assert.equal(returned.ensemble.sharing,false);assert.deepEqual(actor(returned,'camper-3').placement,d.actors.find(a=>a.id==='camper-3').transform);live.dispose();
});
test('unnoticed receiver keeps cooking arm pose and missed offer ends in a continuous ballistic toss',()=>{
 const d=createCampfire(),c=new SceneController(d),control=new SceneController(d);c.triggerEnsemble('share-missed');const waiting=c.seek(3.8),normal=control.seek(3.8);
 for(const key of ['hold-upper.rotation','hold-elbow.rotation','hold-hand.rotation','take-upper.rotation','take-elbow.rotation'])assert.equal(actor(waiting,'camper-3').pose[key],actor(normal,'camper-3').pose[key],'no reaching before notice');
 const failed=c.seek(8.9);assert.equal(failed.ensemble.share.phase,'disappointed');assert.equal(failed.ensemble.share.noticed,false);assert.ok(actor(failed,'camper-1').pose['camp-disappointed.opacity']>0);assert.ok(!failed.ensemble.events.some(e=>e.type==='handoff'));
 const flying=c.seek(10.4),later=c.seek(10.7),landed=c.seek(11.45);assert.equal(flying.ensemble.share.owner,null);assert.equal(actor(flying,'camper-1').pose['food.opacity'],1);const p=projected(d,flying,'camper-1','food'),q=projected(d,later,'camper-1','food');assert.ok(distance(p,q)>10);assert.ok(p.y<260,'toss arcs upward before falling into the fire');assert.equal(actor(landed,'camper-1').pose['food.opacity'],0);assert.equal(actor(landed,'camper-1').pose['toast.opacity'],0);assert.ok(!c.frame().ensemble.events.some(e=>e.type==='notice'));c.dispose();control.dispose();
});
test('observer can call before deadline, leading to notice and a successful handoff',()=>{
 const c=new SceneController(createCampfire());c.triggerEnsemble('share-help');const help=c.seek(6.2);assert.ok(help.ensemble.events.some(e=>e.type==='help'));assert.equal(help.ensemble.share.noticed,false);assert.ok(actor(help,'camper-0').pose['camp-shout.opacity']>0);const done=c.seek(11.2),events=done.ensemble.events;assert.ok(events.find(e=>e.type==='help').time<events.find(e=>e.type==='notice').time);assert.ok(events.find(e=>e.type==='notice').time<events.find(e=>e.type==='handoff').time);assert.equal(done.ensemble.share.owner,'camper-3');c.dispose();
});
test('burn has a brief startle and explicit events; sharing replay is cadence independent',()=>{
 const d=createCampfire(),c=new SceneController(d);c.triggerEnsemble('burn');const peak=c.seek(.4);assert.ok(actor(peak).pose['camp-startle.opacity']>.8);assert.ok(actor(peak).pose['root.y']<0);assert.ok(peak.ensemble.events.some(e=>e.type==='burn-startle'));assert.ok(actor(c.seek(1.1)).pose['camp-startle.opacity']<1e-8);c.dispose();
 const a=new SceneController(d),b=new SceneController(d);a.triggerEnsemble('share-help');b.triggerEnsemble('share-help');for(let i=0;i<720;i++)a.step(1/60);const af=a.frame(),bf=b.seek(12);assert.deepEqual(af.ensemble,bf.ensemble);for(const id of d.ensemble.members){assert.ok(distance(actor(af,id).placement,actor(bf,id).placement)<1e-6);for(const key of Object.keys(actor(af,id).pose))assert.ok(Math.abs(actor(af,id).pose[key]-actor(bf,id).pose[key])<1e-6,key);}a.dispose();b.dispose();
});
test('close handoff skips walking and interruption cancels without leaving displaced actors',()=>{
 const d=createCampfire();Object.assign(d.actors.find(a=>a.id==='camper-3').transform,{x:565,y:d.actors.find(a=>a.id==='camper-1').transform.y});const c=new SceneController(d);c.triggerEnsemble('share');const close=c.seek(7);assert.ok(!close.ensemble.events.some(e=>e.type==='approach'));assert.ok(close.ensemble.events.some(e=>e.type==='handoff'));c.dispose();
 const e=new CampfireEnsemble(createCampfire());e.trigger('share');e.advance(6,new Set());e.advance(6.1,new Set(['camper-3']));assert.equal(e.share,null);assert.ok(e.recent.some(v=>v.type==='share-cancelled'));
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


test('natural offers vary pairs, remain rare and do not rewind the prepared snack',()=>{
 const pairs=new Set();let failure=false;
 for(const seed of [1,2,3]){const d=createCampfire();d.ensemble.seed=seed;const e=new CampfireEnsemble(d),offers=[],log=e.event.bind(e);e.event=(type,actors,detail)=>{if(type==='share'){offers.push({time:e.time,giver:actors[0]});pairs.add(actors.join('/'));}if(type==='share-failed')failure=true;log(type,actors,detail);};e.advance(300,new Set());assert.ok(offers.length>=1&&offers.length<=3);const c=new SceneController(d),base=c.frame(),director=new CampfireEnsemble(d);for(const offer of offers){const before=director.apply({...structuredClone(base),time:offer.time-.001}),after=director.apply({...structuredClone(base),time:offer.time+.001});assert.ok(distance(projected(d,before,offer.giver,'food'),projected(d,after,offer.giver,'food'))<3,'offer must not restart the cooking clip');}c.dispose();}
 assert.ok(pairs.size>=3);assert.equal(failure,true);
});
