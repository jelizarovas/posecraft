import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneController,STEP} from '../src/scene.js';
import {createDemo} from '../examples/showcase.js';
import {MotionSignal,PhoneMotion} from '../src/device-motion.js';
const advance=(c,seconds)=>{for(let i=0;i<seconds/STEP;i++)c.step(STEP);};
const root=(c,id)=>{const a=c.document.actors.find(a=>a.id===id),f=c.frame().actors.find(f=>f.id===id),p=c.document.packs[a.pack];return a.transform.x+f.world[p.physics.root].x*a.transform.scale;};
test('a tossed cast falls, gets up continuously and walks back to its marks',()=>{
 const c=new SceneController(createDemo('shake-and-settle')),phases=new Set();for(const a of c.actors)c.interact(a.actor.id,'toss');
 let previous=c.frame();for(let i=0;i<1800;i++){const frame=c.step(STEP);for(const a of frame.actors){if(a.recovery)phases.add(a.recovery.phase);const before=previous.actors.find(v=>v.id===a.id),actor=c.document.actors.find(v=>v.id===a.id),key=c.document.packs[actor.pack].physics.root;if(a.recovery)assert.ok(Math.hypot(a.world[key].x-before.world[key].x,a.world[key].y-before.world[key].y)*actor.transform.scale<12,'recovery must not teleport');assert.ok(Object.values(a.pose).every(Number.isFinite));}previous=frame;}
 assert.ok(phases.has('getting-up')&&phases.has('returning'));for(const a of c.document.actors){assert.equal(c.frame().actors.find(f=>f.id===a.id).recovery.phase,'home');assert.ok(Math.abs(root(c,a.id)-a.transform.x)<.01);}
});
test('walking travels with a changing gait, interruptions return to the original mark and replay is deterministic',()=>{
 const c=new SceneController(createDemo('shake-and-settle'));c.walkTo('dummy',460);advance(c,1);const walking=c.frame().actors.find(a=>a.id==='dummy');assert.equal(walking.recovery.phase,'walking');assert.ok(root(c,'dummy')<630&&root(c,'dummy')>460);assert.ok(Object.entries(walking.pose).some(([k,v])=>k.includes('Thigh.rotation')&&Math.abs(v)>1));
 c.setAcceleration(1500,-600);advance(c,.4);assert.ok(c.frame().actors.every(a=>a.physics));c.setAcceleration(0,0);advance(c,14);const final=c.frame();for(const a of c.document.actors){assert.equal(final.actors.find(f=>f.id===a.id).recovery.phase,'home');assert.ok(Math.abs(root(c,a.id)-a.transform.x)<.01);}assert.deepEqual(c.seek(c.time),final);
});
test('walk does not cross a wall and raw floating remains passive',()=>{
 const d=createDemo('shake-and-settle'),wall=structuredClone(d.props.find(p=>p.collider.enabled));wall.id='blocking-wall';wall.x=520;wall.y=330;wall.rotation=0;wall.collider={...wall.collider,enabled:true,x:0,y:0,width:30,height:160};d.props.push(wall);const c=new SceneController(d);c.walkTo('dummy',400);advance(c,1);assert.equal(c.frame().actors.find(a=>a.id==='dummy').recovery.phase,'blocked');assert.ok(root(c,'dummy')>520);
 c.setBehavior('dummy',{mode:'floating',gravity:0});c.interact('dummy','toss');advance(c,6);assert.equal(c.frame().actors.find(a=>a.id==='dummy').recovery,null);assert.throws(()=>c.setBehavior('dummy',{autoRecover:'yes'}));
});
test('motion filters gravity, handles null sensors, rotates axes and decays stale input',()=>{
 const m=new MotionSignal();assert.equal(m.update({acceleration:{x:null,y:null}},100),false);assert.equal(m.update({accelerationIncludingGravity:{x:0,y:9.8}},100),true);assert.deepEqual(m.sample(100),{ax:0,ay:0,turn:0});m.update({accelerationIncludingGravity:{x:4,y:9.8}},116);assert.ok(m.sample(116).ax>300);
 m.update({acceleration:{x:2,y:0},rotationRate:{alpha:100,beta:0,gamma:0}},200,90);assert.ok(Math.abs(m.sample(200).ax)<1e-9);assert.equal(m.sample(200).ay,190);assert.ok(m.sample(1200).ay<1);m.update({acceleration:{x:100,y:-100}},1300);assert.equal(m.sample(1300).ax,1800);assert.equal(m.sample(1300).ay,1800);
});
test('phone sensors require enable, handle denied and stale permissions, and detach on disable',async()=>{
 const listeners=new Map(),status=[];let calls=0,permission='denied';const env={DeviceMotionEvent:{requestPermission:async()=>{calls++;return permission;}},performance:{now:()=>100},screen:{orientation:{angle:0}},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};const phone=new PhoneMotion({environment:env,onStatus:s=>status.push(s)});assert.equal(calls,0);assert.equal(await phone.enable(),false);assert.equal(listeners.size,0);assert.match(status.at(-1),/denied/);permission='granted';assert.equal(await phone.enable(),true);listeners.get('devicemotion')({acceleration:{x:2,y:3}});assert.equal(phone.signal.sample(100).ax,190);phone.disable();assert.equal(listeners.size,0);assert.equal(phone.signal.sample(100).ax,0);
 let grant;env.DeviceMotionEvent.requestPermission=()=>new Promise(r=>grant=r);const pending=phone.enable();phone.disable();grant('granted');assert.equal(await pending,false);assert.equal(listeners.size,0);
});

test('standing characters keep authored actions and timed facial reactions',()=>{
 const c=new SceneController(createDemo('shake-and-settle'));c.setInput('ona','action','wave');advance(c,.35);const one=c.frame().actors.find(a=>a.id==='ona').pose;advance(c,.35);assert.notDeepEqual(c.frame().actors.find(a=>a.id==='ona').pose,one);c.interact('ona','pet');advance(c,.25);assert.equal(c.frame().actors.find(a=>a.id==='ona').response,'happy');advance(c,1);assert.equal(c.frame().actors.find(a=>a.id==='ona').response,'calm');
 const signal=new MotionSignal();assert.equal(signal.update({rotationRate:{alpha:0,beta:0,gamma:30}},100),true);assert.equal(signal.sample(100).ax,60);
});
