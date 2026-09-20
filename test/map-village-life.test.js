import assert from 'node:assert/strict';
import test from 'node:test';
import {startVillageLife} from '../examples/map-village-life.js';
import {createTownMap} from '../examples/town-map.js';
import {MapController} from '../src/map-runtime.js';

function fixture(actors,{hold=false}={}){
 let time=0,next=0;const timers=new Map(),calls=[],presentations=[],events=[],listeners=new Map(),pending=[];
 const map={actors,props:[{id:'sheep-hay',x:2,y:2},{id:'sheep-water',x:3,y:2},{id:'cow-hay',x:8,y:2},{id:'cow-water',x:9,y:2},{id:'chicken-grain',x:12,y:2},{id:'chicken-bucket',x:13,y:2},{id:'town-granary',x:20,y:20,width:2,height:2},{id:'west-pasture-gate',kind:'farm-fence-broken',x:5,y:5}]};
 const commands=Object.fromEntries(actors.map(spec=>[spec.id,{moveTo(target,options){calls.push({kind:'move',id:spec.id,target,options});if(!hold)return Promise.resolve();return new Promise((resolve,reject)=>{pending.push({resolve,reject,signal:options.signal});options.signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'})),{once:true});});},faceTo(target,options){calls.push({kind:'face',id:spec.id,target,options});return Promise.resolve();}}]));
 const document={hidden:false,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
 const view={controller:{map,actor:id=>commands[id]},setActorPresentation(id,state){presentations.push({id,...state});}};
 const clock={now:()=>time,setTimer(fn,delay){const id=++next;timers.set(id,{fn,due:time+delay});return id;},clearTimer:id=>timers.delete(id),advance(ms){time+=ms;for(const[id,timer]of [...timers].sort((a,b)=>a[1].due-b[1].due))if(timer.due<=time){timers.delete(id);timer.fn();}},pending:()=>timers.size};
 return{view,document,clock,calls,presentations,events,listeners,pending};
}
const home=(x,y,width=4,height=4)=>({x,y,width,height});
const actor=(id,species,role,x,y,extra={})=>({id,npc:{species,role,home:home(x,y),...extra}});
async function flush(turns=12){while(turns--)await Promise.resolve();}

test('village life discovers metadata actors and caps concurrent pathfinding',async()=>{
 const actors=[actor('sheep-1','sheep',null,0,0),actor('cow-1','cow',null,6,0),actor('hen-1','chicken',null,11,0)];
 const f=fixture(actors,{hold:true}),life=startVillageLife(f.view,{seed:4,initialDelay:0,maxConcurrent:2,document:f.document,...f.clock,onEvent:event=>f.events.push(event)});
 f.clock.advance(100);await flush();assert.equal(f.calls.filter(call=>call.kind==='move').length,2);assert.equal(life.state().active,2);assert.equal(f.clock.pending(),0);
 f.pending[0].resolve();await flush();assert.equal(f.calls.filter(call=>call.kind==='move').length,3);assert.ok(f.presentations.every(item=>typeof item.action==='string'));life.dispose();
 assert.ok(f.pending.slice(1).every(item=>item.signal.aborted));assert.equal(life.state().active,0);
});

test('farmers till and carriers expose a wheelbarrow trip to the granary',async()=>{
 const f=fixture([actor('carrier','human','carrier',30,30,{work:{x:15,y:15}})]),life=startVillageLife(f.view,{seed:1,initialDelay:0,intervalMs:1000,dwellMs:100,document:f.document,...f.clock});
 f.clock.advance(0);await flush(30);assert.equal(life.state().actors.carrier.action,'till');f.clock.advance(2000);await flush(20);assert.equal(life.state().actors.carrier.action,'harvest');f.clock.advance(1000);await flush(30);assert.deepEqual(f.calls.filter(call=>call.kind==='move').map(call=>call.target),[{x:15,y:15},'town-granary']);
 assert.ok(f.presentations.some(item=>item.action==='carry'&&item.carrying==='wheelbarrow'));assert.equal(life.state().actors.carrier.action,'harvest');life.dispose();
});

test('children play ball and visibility pauses the one shared schedule',async()=>{
 const f=fixture([actor('child-a','child',null,0,10),actor('child-b','child',null,6,10)]),life=startVillageLife(f.view,{seed:9,initialDelay:50,dwellMs:100,document:f.document,...f.clock});
 assert.equal(f.clock.pending(),1);f.document.hidden=true;f.listeners.get('visibilitychange')();f.clock.advance(500);await flush();assert.equal(f.calls.length,0);
 f.document.hidden=false;f.listeners.get('visibilitychange')();f.clock.advance(75);await flush(20);assert.ok(f.presentations.some(item=>item.action==='play-ball'&&item.ball?.ownerId==='child-a'));assert.ok(f.presentations.some(item=>item.targetActor==='child-b'));const balls=Object.values(life.state().actors).filter(item=>item.ball);assert.equal(balls.length,1);assert.equal(balls[0].ball.ownerId,'child-a');f.clock.advance(100);await flush();assert.equal(life.state().actors['child-b'].carrying,'ball');assert.equal(life.state().actors['child-a'].ball,null);life.dispose();assert.equal(f.listeners.has('visibilitychange'),false);
});

test('escapes use a broken gate, then a herder catches and leads the animal home',async()=>{
 const f=fixture([actor('sheep-1','sheep',null,0,0),actor('herder','human','herder',15,15)]),life=startVillageLife(f.view,{random:()=>0,escapeChance:1,initialDelay:0,maxConcurrent:1,document:f.document,...f.clock,onEvent:event=>f.events.push(event)});
 f.clock.advance(0);await flush(120);const sheepMoves=f.calls.filter(call=>call.kind==='move'&&call.id==='sheep-1').map(call=>call.target);
 assert.deepEqual(sheepMoves[0],{x:5,y:5});assert.ok(sheepMoves.length>=3);assert.ok(sheepMoves.every(target=>Number.isFinite(target.x)&&Number.isFinite(target.y)));assert.ok(f.calls.some(call=>call.kind==='move'&&call.id==='herder'));assert.ok(f.events.some(event=>event.type==='village.escape'));assert.ok(f.events.some(event=>event.type==='village.caught'));assert.equal(life.state().actors['sheep-1'].escaped,false);life.dispose();
});

test('same-species peers reserve each other, meet without overlap, and dwell together',async()=>{
 const f=fixture([actor('sheep-a','sheep',null,0,0),actor('sheep-b','sheep',null,1,0)]),life=startVillageLife(f.view,{random:()=>.4,escapeChance:0,initialDelay:0,dwellMs:100,document:f.document,...f.clock});
 f.clock.advance(50);await flush(30);const moves=f.calls.filter(call=>call.kind==='move');assert.deepEqual(moves.map(call=>call.id),['sheep-a','sheep-b']);assert.notDeepEqual(moves[0].target,moves[1].target);assert.equal(life.state().actors['sheep-a'].action,'social');assert.equal(life.state().actors['sheep-b'].action,'social');
 f.clock.advance(99);await flush();assert.equal(life.state().actors['sheep-b'].action,'social');assert.equal(f.calls.filter(call=>call.kind==='move').length,2);f.clock.advance(1);await flush();assert.equal(life.state().actors['sheep-b'].action,'idle');life.dispose();
});

test('adjacent cross-species homes produce a two-sided fence interaction',async()=>{
 const f=fixture([actor('cow-a','cow',null,0,0),actor('hen-a','chicken',null,5,0)]),life=startVillageLife(f.view,{random:()=>.4,escapeChance:0,initialDelay:0,dwellMs:100,document:f.document,...f.clock});
 f.clock.advance(50);await flush(30);const state=life.state().actors,moves=f.calls.filter(call=>call.kind==='move');assert.equal(state['cow-a'].action,'intimidate');assert.equal(state['hen-a'].action,'react');assert.ok(moves.find(call=>call.id==='cow-a').target.x<moves.find(call=>call.id==='hen-a').target.x);assert.ok(f.calls.some(call=>call.kind==='face'&&call.id==='cow-a'));assert.ok(f.calls.some(call=>call.kind==='face'&&call.id==='hen-a'));life.dispose();
});

test('village life validates homes before scheduling any actor',()=>{
 const f=fixture([{id:'bad',npc:{species:'sheep',home:{x:0,y:0}}}]);assert.throws(()=>startVillageLife(f.view,{document:f.document,...f.clock}),/bad/);assert.equal(f.clock.pending(),0);
});

test('free-range chickens do not travel to an unrelated pasture gate to escape',async()=>{
 const f=fixture([actor('hen','chicken',null,40,40),actor('herder','human','herder',15,15)]),life=startVillageLife(f.view,{random:()=>0,escapeChance:1,initialDelay:0,document:f.document,...f.clock,onEvent:event=>f.events.push(event)});
 f.clock.advance(0);await flush(40);assert.ok(!f.events.some(e=>e.type==='village.escape'));assert.ok(!f.calls.some(c=>c.id==='herder'));life.dispose();
});

function realFixture(ids){
 const map=createTownMap(),keep=new Set(ids);for(const spec of map.actors)if(spec.npc&&!keep.has(spec.id))delete spec.npc;
 const controller=new MapController(map,{execution:'main'}),presentations=new Map(),events=[];let time=0,next=0;const timers=new Map();
 const clock={now:()=>time,setTimer(fn,delay){const id=++next;timers.set(id,{fn,due:time+delay});return id;},clearTimer:id=>timers.delete(id),advance(ms){time+=ms;for(const[id,timer]of [...timers].sort((a,b)=>a[1].due-b[1].due))if(timer.due<=time){timers.delete(id);timer.fn();}}};
 const document={hidden:false,addEventListener(){},removeEventListener(){}},view={controller,setActorPresentation(id,state){presentations.set(id,state);}};
 return{controller,presentations,events,clock,document,view};
}
async function driveReal(f,predicate,limit=12000){
 for(let step=0;step<limit;step++){f.clock.advance(50);f.controller.advance(.1);if(step%20===0)await new Promise(resolve=>setTimeout(resolve,0));else await Promise.resolve();if(predicate())return;}
 assert.fail('real map routine did not reach its expected state');
}

test('real MapController approaches care props, granary, and the broken pasture gate',async t=>{
 await t.test('same-species partners meet, face, and hold their shared dwell',async()=>{
  const f=realFixture(['sheep-1','sheep-2']),life=startVillageLife(f.view,{random:()=>.4,escapeChance:0,initialDelay:0,intervalMs:100000,dwellMs:100000,document:f.document,...f.clock});
  try{await driveReal(f,()=>life.state().actors['sheep-1'].action==='social'&&life.state().actors['sheep-2'].action==='social'&&!f.controller.isMoving);const a=f.controller.actorPosition('sheep-1'),b=f.controller.actorPosition('sheep-2');assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=1.4);assert.equal(life.state().actors['sheep-2'].targetActor,'sheep-1');}finally{life.dispose();f.controller.dispose();}
 });
 await t.test('adjacent sheep and cattle approach both sides of their shared fence',async()=>{
  const f=realFixture(['sheep-1','cow-1']),life=startVillageLife(f.view,{random:()=>.4,escapeChance:0,initialDelay:0,intervalMs:100000,dwellMs:100000,document:f.document,...f.clock});
  try{await driveReal(f,()=>life.state().actors['sheep-1'].action==='social'&&life.state().actors['cow-1'].action==='social'&&!f.controller.isMoving);const sheep=f.controller.actorPosition('sheep-1'),cow=f.controller.actorPosition('cow-1');assert.ok(sheep.x<cow.x);assert.equal(life.state().actors['sheep-1'].targetActor,'cow-1');assert.equal(life.state().actors['cow-1'].targetActor,'sheep-1');}finally{life.dispose();f.controller.dispose();}
 });
 await t.test('feeding ends beside the solid hay rack and dwells',async()=>{
  const f=realFixture(['sheep-1']),life=startVillageLife(f.view,{random:()=>0,escapeChance:0,initialDelay:0,intervalMs:100000,dwellMs:100000,document:f.document,...f.clock,onEvent:event=>f.events.push(event)});
  try{await driveReal(f,()=>life.state().actors['sheep-1'].action==='hay'&&!f.controller.isMoving);const station=f.controller.map.props.find(prop=>prop.id==='sheep-hay'),animal=f.controller.actorPosition('sheep-1');assert.equal(f.controller.index.isPointBlocked(animal.x,animal.y),false);assert.ok(Math.hypot(animal.x-(station.x+station.width/2),animal.y-(station.y+station.height/2))>0);assert.equal(life.state().actors['sheep-1'].action,'hay');}finally{life.dispose();f.controller.dispose();}
 });
 await t.test('carrier harvests before approaching the solid granary',async()=>{
  const f=realFixture(['npc-trader']),life=startVillageLife(f.view,{random:()=>0,initialDelay:0,intervalMs:100000,dwellMs:100000,document:f.document,...f.clock});
  try{await driveReal(f,()=>life.state().actors['npc-trader'].action==='harvest'&&life.state().actors['npc-trader'].target?.x===50);const granary=f.controller.map.props.find(prop=>prop.id==='town-granary'),actor=f.controller.actorPosition('npc-trader');assert.ok(f.presentations.get('npc-trader'));assert.equal(f.controller.index.isPointBlocked(actor.x,actor.y),false);assert.ok(Math.hypot(actor.x-(granary.x+granary.width/2),actor.y-(granary.y+granary.height/2))>=1);}finally{life.dispose();f.controller.dispose();}
 });
 await t.test('escape and catch walk through the real broken gate',async()=>{
  const f=realFixture(['sheep-1','npc-herder']),life=startVillageLife(f.view,{random:()=>0,escapeChance:1,initialDelay:0,intervalMs:100000,dwellMs:100000,document:f.document,...f.clock,onEvent:event=>f.events.push(event)});
  try{await driveReal(f,()=>f.events.some(event=>event.type==='village.caught'),20000);const gate=f.controller.map.props.find(prop=>prop.id==='west-pasture-gate'),escape=f.events.find(event=>event.type==='village.escape'),home=f.controller.map.actors.find(actor=>actor.id==='sheep-1').npc.home,animal=f.controller.actorPosition('sheep-1');assert.equal(escape.gate,gate.id);assert.ok(animal.x>=home.x&&animal.x<=home.x+home.width&&animal.y>=home.y&&animal.y<=home.y+home.height);assert.equal(f.controller.index.isPointBlocked(animal.x,animal.y),false);}finally{life.dispose();f.controller.dispose();}
 });
});
