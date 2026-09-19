import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SceneController} from '../src/scene.js';
import {createGameScene} from '../src/game.js';

const source=JSON.parse(fs.readFileSync(new URL('../examples/characters/ona.json',import.meta.url),'utf8'));
function fixture(){
 const doc=structuredClone(source);doc.requiredFeatures.push('game-bindings');
 doc.game={anchors:{sign:{type:'point',x:430,y:110}},actors:{ona:{actions:{inspect:'think'},reactions:{success:{action:'celebrate',emotion:'happy'},notice:{emotion:'surprised'}},gaze:{joint:'head',maxAngle:25},speech:true}}};return doc;
}
async function advance(controller,promise,seconds=20){
 let done=false,value,error;promise.then(v=>{done=true;value=v;},e=>{done=true;error=e;});
 for(let i=0;i<seconds*120&&!done;i++){await Promise.resolve();controller.step(1/120);}
 await Promise.resolve();assert.ok(done,'Game command did not settle on the simulation clock');if(error)throw error;return value;
}
test('semantic actions, aliases and reactions complete on actual scene simulation time',async()=>{
 const c=new SceneController(fixture()),events=[],game=createGameScene(c,{onEvent:e=>events.push(e)});
 try{
  assert.ok(game.actor('ona').capabilities().actions.includes('inspect'));
  const first=await advance(c,game.actor('ona').do('inspect'));assert.equal(first.type,'actor.action.completed');assert.equal(first.clip,'think');
  const second=await advance(c,game.actor('ona').do('inspect'));assert.notEqual(first.request,second.request);
  await advance(c,game.actor('ona').react('success'));assert.equal(c.frame().actors[0].inputs.emotion,'happy');
  assert.equal(events.filter(e=>e.type==='actor.reaction.completed').length,1);
  assert.throws(()=>game.actor('ona').do('invented'),/does not support/);
 }finally{game.dispose();c.dispose();}
});
test('pausing holds an awaitable action; abort and replacement reject only the owned request',async()=>{
 const c=new SceneController(fixture()),game=createGameScene(c);
 try{
  const abort=new AbortController(),first=game.actor('ona').do('wave',{signal:abort.signal});const rejected=assert.rejects(first,{name:'AbortError'});
  await Promise.resolve();c.pause();for(let i=0;i<120;i++)c.step(.1);assert.equal(c.time,0);abort.abort();await rejected;
  c.play();const old=game.actor('ona').do('wave'),oldRejected=assert.rejects(old,{name:'AbortError'});const next=game.actor('ona').do('nod');await oldRejected;await advance(c,next);
  const active=game.actor('ona').do('wave'),disposed=assert.rejects(active,{name:'AbortError'});game.dispose();await disposed;assert.throws(()=>game.actor('ona'),/disposed/);
 }finally{game.dispose();c.dispose();}
});
test('named movement completes after reaching its target and later actions retain that location',async()=>{
 const c=new SceneController(fixture()),game=createGameScene(c);
 try{
  const result=await advance(c,game.actor('ona').moveTo('sign'));assert.equal(result.type,'actor.arrived');
  const root=c.frame().actors[0].pose['root.x'];assert.ok(root>30);
  await advance(c,game.actor('ona').do('wave'));assert.ok(Math.abs(c.frame().actors[0].pose['root.x']-root)<1e-6);
  await advance(c,game.actor('ona').lookAt('sign'));assert.throws(()=>game.actor('ona').moveTo('unknown'),/Target/);
 }finally{game.dispose();c.dispose();}
});
test('sequences validate first, stop on cancellation and never continue into speech',async()=>{
 const c=new SceneController(fixture()),spoken=[],game=createGameScene(c,{onSpeechRequest:e=>spoken.push(e.text)});
 try{
  assert.throws(()=>game.actor('ona').sequence([{do:'wave'},{do:'missing'}]),/unsupported/);assert.equal(c.time,0);
  const sequence=game.actor('ona').sequence([{do:'wave'},{say:'Done'}]);await Promise.resolve();sequence.cancel();await assert.rejects(sequence.finished,{name:'AbortError'});assert.deepEqual(spoken,[]);
  const good=game.sequence([{actor:'ona',do:'nod'},{actor:'ona',say:'You fixed it!'}]);await advance(c,good.finished);assert.deepEqual(spoken,['You fixed it!']);
 }finally{game.dispose();c.dispose();}
});
test('speech waits for the host and receives cancellation instead of owning audio or subtitles',async()=>{
 const c=new SceneController(fixture());let speech,resolve;const game=createGameScene(c,{onSpeechRequest:request=>{speech=request;return new Promise(r=>resolve=r);}});
 try{
  const abort=new AbortController(),p=game.actor('ona').say('Hello',{signal:abort.signal,emotion:'happy'}),rejected=assert.rejects(p,{name:'AbortError'});await Promise.resolve();assert.equal(speech.text,'Hello');assert.equal(speech.signal.aborted,false);
  abort.abort();await rejected;assert.equal(speech.signal.aborted,true);resolve();await Promise.resolve();
  let complete=false;const next=game.actor('ona').say('Again').then(()=>complete=true);await Promise.resolve();assert.equal(complete,false);resolve();await next;assert.equal(complete,true);
 }finally{game.dispose();c.dispose();}
});
test('reset and seek reject pending host commands; reduced motion does not strand promises',async()=>{
 for(const operation of ['reset','seek']){
  const c=new SceneController(fixture()),game=createGameScene(c);
  try{const p=game.actor('ona').do('wave'),rejected=assert.rejects(p,{name:'AbortError'});await Promise.resolve();c[operation](0);await rejected;}finally{game.dispose();c.dispose();}
 }
 const c=new SceneController(fixture(),{reducedMotion:true}),game=createGameScene(c);
 try{await game.actor('ona').do('wave');await game.actor('ona').moveTo('sign');}finally{game.dispose();c.dispose();}
});
test('a cancelled request waiting for worker readiness never dispatches after readiness',async()=>{
 let ready;const commands=[],listeners=new Set(),controller={document:fixture(),time:0,ready:new Promise(r=>ready=r),frame:()=>({actors:[]}),subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),gameCommand:c=>commands.push(c)};
 const game=createGameScene(controller),abort=new AbortController(),p=game.actor('ona').do('wave',{signal:abort.signal}),rejected=assert.rejects(p,{name:'AbortError'});abort.abort();ready();await rejected;await Promise.resolve();assert.equal(commands.some(c=>c.type==='action'),false);game.dispose();assert.equal(listeners.size,0);
});
function fakeController(){
 const listeners=new Set(),commands=[],objects=[];
 const controller={document:fixture(),time:0,ready:Promise.resolve(),frame:()=>({actors:[]}),subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),gameCommand:command=>{commands.push(command);return true;},setInput(){},objectCommand:command=>objects.push(command)};
 return {controller,commands,objects,listeners,emit:event=>{for(const listener of [...listeners])listener(event);},complete(command=commands.filter(c=>c.type!=='cancel').at(-1)){this.emit({type:'actor.command.completed',actor:command.actor,request:command.request});}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('dispose and cancelAll block commands started reentrantly by cancellation callbacks',async()=>{
 for(const operation of ['dispose','cancelAll']){
  const fake=fakeController();let ready;fake.controller.ready=new Promise(resolve=>ready=resolve);const attempts=[],errors=[];let game;
  game=createGameScene(fake.controller,{onEvent:e=>{if(e.type==='actor.command.cancelled'){try{attempts.push(game.actor('ona').do('nod'));}catch(error){errors.push(error);}}}});
  const pending=game.actor('ona').do('wave'),rejected=assert.rejects(pending,{name:'AbortError'});game[operation]();ready();await rejected;await flush();
  assert.equal(attempts.length,0);assert.equal(errors.length,1);assert.equal(fake.commands.some(c=>c.type==='action'),false);
  if(operation==='cancelAll'){const next=game.actor('ona').do('nod');await flush();fake.complete();await next;}
  game.dispose();assert.equal(fake.listeners.size,0);
 }
});

test('replacement callback reentrancy leaves only the newest actor command alive',async()=>{
 const fake=fakeController();let game,newest,reentered=false;
 game=createGameScene(fake.controller,{onEvent:e=>{if(e.type==='actor.command.cancelled'&&!reentered){reentered=true;newest=game.actor('ona').do('shake');}}});
 try{
  const first=game.actor('ona').do('wave'),firstRejected=assert.rejects(first,{name:'AbortError'});
  const replaced=game.actor('ona').do('nod'),replacedRejected=assert.rejects(replaced,{name:'AbortError'});await firstRejected;await replacedRejected;await flush();
  assert.deepEqual(fake.commands.filter(c=>c.type==='action').map(c=>c.clip),['shake']);fake.complete();assert.equal((await newest).clip,'shake');
 }finally{game.dispose();}
});

test('speech-request callbacks can cancel without starting the host speech side effect',async()=>{
 const fake=fakeController();let game,calls=0;
 game=createGameScene(fake.controller,{onEvent:e=>{if(e.type==='actor.speech.requested')game.dispose();},onSpeechRequest:()=>{calls++;}});
 const pending=game.actor('ona').say('Do not start'),rejected=assert.rejects(pending,{name:'AbortError'});await rejected;await flush();assert.equal(calls,0);assert.equal(fake.listeners.size,0);
});

test('throwing event and error callbacks cannot strand other pending requests',async()=>{
 const fake=fakeController();fake.controller.document.actors.push({...structuredClone(fake.controller.document.actors[0]),id:'other'});let errors=0;
 const game=createGameScene(fake.controller,{onEvent:()=>{throw Error('host event');},onError:()=>{errors++;throw Error('host reporter');}});
 try{
  const a=game.actor('ona').do('wave'),b=game.actor('other').do('wave'),ar=assert.rejects(a,/failed worker/),br=assert.rejects(b,/failed worker/);
  assert.doesNotThrow(()=>fake.emit({type:'error',message:'failed worker'}));await Promise.all([ar,br]);assert.equal(errors,2);await flush();assert.equal(fake.commands.some(c=>c.type==='action'),false);
 }finally{game.dispose();}
});

test('sequence preflight rejects malformed later steps before running its first command',()=>{
 const fake=fakeController();let calls=0;const game=createGameScene(fake.controller,{onCommand:()=>calls++});
 try{
  for(const invalid of [[{actor:'ona',do:'wave'},{actor:'ona',do:'nod',unexpected:true}],[{actor:'ona',do:'wave'},[]],[{actor:'ona',do:'wave'},null]])assert.throws(()=>game.sequence(invalid),/one actor command/);
  assert.throws(()=>game.actor('ona').sequence(null),/array/);assert.throws(()=>game.actor('ona').sequence([[]]),/array/);
  assert.throws(()=>game.actor('ona').do('wave',{signal:{}}),/AbortSignal/);assert.equal(calls,0);assert.deepEqual(fake.commands,[]);
 }finally{game.dispose();}
});

test('cancelling during the final action completion still rejects the unfinished sequence',async()=>{
 const fake=fakeController();let sequence;const game=createGameScene(fake.controller,{onEvent:e=>{if(e.type==='actor.action.completed')sequence.cancel();}});
 try{
  sequence=game.actor('ona').sequence([{do:'wave'}]);const rejected=assert.rejects(sequence.finished,{name:'AbortError'});await flush();fake.complete();await rejected;
 }finally{game.dispose();}
});

test('a cancelled preparation hook never dispatches its action or delayed speech',async()=>{
 for(const mode of ['react','say']){
  const fake=fakeController();let game,spoken=0;fake.controller.setInput=()=>game.cancelAll();game=createGameScene(fake.controller,{onSpeechRequest:()=>spoken++});
  try{const p=mode==='react'?game.actor('ona').react('success'):game.actor('ona').say('No',{emotion:'happy'});await assert.rejects(p,{name:'AbortError'});await flush();assert.equal(spoken,0);assert.equal(fake.commands.some(c=>c.type==='action'),false);}finally{game.dispose();}
 }
});

test('readiness failure and immediate command rejection settle owned promises',async()=>{
 for(const mode of ['getter','promise','rejection']){
  const fake=fakeController();if(mode==='getter')Object.defineProperty(fake.controller,'ready',{get(){throw Error('ready getter failed');}});else if(mode==='promise')fake.controller.ready=Promise.reject(Error('ready promise failed'));else fake.controller.gameCommand=()=>false;
  const game=createGameScene(fake.controller);try{let p;assert.doesNotThrow(()=>{p=game.actor('ona').do('wave');});await assert.rejects(p,mode==='rejection'?/rejected/:/ready .* failed/);}finally{game.dispose();}
 }
});

test('disposing inside object onCommand prevents the queued object mutation',()=>{
 const fake=fakeController();fake.controller.document.objects=[{id:'gift',mass:1}];let game;game=createGameScene(fake.controller,{onCommand:()=>game.dispose()});
 assert.throws(()=>game.object('gift').set('enabled',false),/disposed/);assert.deepEqual(fake.objects,[]);
});

test('disposing while host speech is pending aborts it and ignores late completion',async()=>{
 const fake=fakeController(),events=[];let resolve,speech;const game=createGameScene(fake.controller,{onEvent:e=>events.push(e.type),onSpeechRequest:request=>{speech=request;return new Promise(r=>resolve=r);}});
 const p=game.actor('ona').say('Still waiting'),rejected=assert.rejects(p,{name:'AbortError'});await flush();game.dispose();await rejected;assert.equal(speech.signal.aborted,true);resolve();await flush();assert.equal(events.includes('actor.speech.completed'),false);assert.equal(fake.listeners.size,0);
});
