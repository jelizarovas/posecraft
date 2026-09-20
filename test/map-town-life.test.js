import assert from 'node:assert/strict';
import test from 'node:test';
import {startTownLife,townLifeNpcIds} from '../examples/map-town-life.js';

const routes={
 'npc-farmer':[{x:2,y:2},{x:3,y:2}],
 'npc-trader':[{x:4,y:2},{x:5,y:2}],
 'npc-villager':[{x:6,y:2},{x:7,y:2}]
};

function fixture({failFarmerOnce=false}={}){
 let time=0,next=0;const timers=new Map(),listeners=new Map(),calls=[];
 const document={hidden:false,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){listeners.delete(name);}};
 let farmerFailed=false;
 const actors=Object.fromEntries(townLifeNpcIds.map(id=>[id,{moveTo(target,options){calls.push({kind:'move',id,target,options});if(id==='npc-farmer'&&failFarmerOnce&&!farmerFailed){farmerFailed=true;return Promise.reject(Error('Road closed.'));}return Promise.resolve();},faceTo(target,options){calls.push({kind:'face',id,target,options});return Promise.resolve();}}]));
 const view={controller:{actor:id=>actors[id]}};
 const scheduler={now:()=>time,setTimer(fn,delay){const id=++next;timers.set(id,{fn,due:time+delay});return id;},clearTimer:id=>timers.delete(id),pending:()=>timers.size,advance(ms){time+=ms;for(const[id,timer]of [...timers])if(timer.due<=time){timers.delete(id);timer.fn();}},listeners};
 return {view,document,calls,scheduler};
}

async function flush(){for(let i=0;i<6;i++)await Promise.resolve();}

test('town life shares one pause timer and uses named map actors',async()=>{
 const {view,document,calls,scheduler}=fixture();
 const life=startTownLife(view,{routes,pauseMs:50,initialDelay:0,random:()=>0,document,...scheduler});
 assert.equal(life.paused,false);assert.equal(scheduler.pending(),1);scheduler.advance(0);assert.equal(life.moving,true);await flush();
 assert.deepEqual(calls.filter(call=>call.kind==='move').map(call=>call.id),['npc-farmer']);
 assert.equal(calls[0].options.gait,'walk');assert.ok(calls[0].options.signal instanceof AbortSignal);
 scheduler.advance(120);await flush();
 assert.ok(calls.filter(call=>call.kind==='move').some(call=>call.id==='npc-trader'));
 assert.ok(calls.some(call=>call.kind==='face'&&call.id==='npc-farmer'));
 assert.equal(scheduler.pending(),1);
 life.dispose();
});

test('town life pauses its scheduler while the document is hidden and aborts only its commands',async()=>{
 const {view,document,calls,scheduler}=fixture();
 const life=startTownLife(view,{routes,pauseMs:100,initialDelay:10,document,...scheduler});
 document.hidden=true;scheduler.listeners.get('visibilitychange')();scheduler.advance(100);
 assert.equal(calls.length,0);assert.equal(life.paused,true);
 document.hidden=false;scheduler.listeners.get('visibilitychange')();scheduler.advance(9);assert.equal(calls.length,0);scheduler.advance(1);await flush();
 assert.equal(calls[0].kind,'move');const signal=calls[0].options.signal;life.dispose();assert.equal(signal.aborted,true);
});

test('town life rejects incomplete routes before scheduling work',()=>{
 const {view,document,scheduler}=fixture();
 assert.throws(()=>startTownLife(view,{routes:{...routes,'npc-trader':[{}]},document,...scheduler}),/npc-trader/);
});

test('town life retries the next waypoint after a failed move without a timer loop',async()=>{
 const {view,document,calls,scheduler}=fixture({failFarmerOnce:true}),errors=[];
 const life=startTownLife(view,{routes,pauseMs:50,initialDelay:0,document,onError:error=>errors.push(error.message),...scheduler});
 scheduler.advance(0);await flush();
 assert.deepEqual(errors,['Road closed.']);
 assert.equal(calls.filter(call=>call.kind==='move'&&call.id==='npc-farmer').length,1);
 scheduler.advance(2999);await flush();
 assert.equal(calls.filter(call=>call.kind==='move'&&call.id==='npc-farmer').length,1);
 scheduler.advance(1);await flush();
 const farmerMoves=calls.filter(call=>call.kind==='move'&&call.id==='npc-farmer');
 assert.equal(farmerMoves.length,2);assert.deepEqual(farmerMoves[1].target,routes['npc-farmer'][1]);
 assert.equal(scheduler.pending(),1);life.dispose();
});
