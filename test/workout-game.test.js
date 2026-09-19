import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutGame} from '../src/workout-game.js';
function fixture(){let listener;const requests=[],cancelled=[];return {requests,cancelled,subscribe(fn){listener=fn;return ()=>listener=null;},emit(event){listener?.(event);},request(action,options){requests.push({action,...options});return options.request;},cancel(id){cancelled.push(id);},describe(){return {actors:[{id:'atlas',actions:['pullup','bench','rest','drink']}],anchors:['bench','pullup','bottle']};}};}
test('native commands await actual completion events and sequences dispatch one mechanic at a time',async()=>{
 const view=fixture(),game=createWorkoutGame(view),sequence=game.actor('atlas').sequence([{do:'bench'},{do:'drink'}]);let finished=false;sequence.finished.then(()=>finished=true);
 await Promise.resolve();assert.equal(view.requests.length,1);assert.equal(finished,false);
 view.emit({type:'actor.action.completed',request:'unrelated'});await Promise.resolve();assert.equal(view.requests.length,1);
 view.emit({type:'actor.action.completed',request:view.requests[0].request});await Promise.resolve();assert.equal(view.requests.length,2);assert.equal(view.requests[1].action,'drink');
 view.emit({type:'actor.action.completed',request:view.requests[1].request});await sequence.finished;assert.equal(finished,true);game.dispose();
});
test('aborting waits for safe cancellation acknowledgement before rejecting',async()=>{
 const view=fixture(),game=createWorkoutGame(view),signal=new AbortController(),promise=game.actor('atlas').do('bench',{signal:signal.signal});let done=false;promise.catch(()=>done=true);
 signal.abort();await Promise.resolve();assert.equal(done,false);assert.deepEqual(view.cancelled,[view.requests[0].request]);
 view.emit({type:'actor.command.cancelled',request:view.requests[0].request});await assert.rejects(promise,{name:'AbortError'});game.dispose();
});
test('invalid sequence is rejected before the first action; disposal and reset reject pending commands',async()=>{
 const view=fixture(),game=createWorkoutGame(view);assert.throws(()=>game.actor('atlas').sequence([{do:'bench'},{do:'fly'}]),/Unsupported/);assert.equal(view.requests.length,0);
 const pending=game.actor('atlas').do('rest');view.emit({type:'workout.reset'});await assert.rejects(pending,{name:'AbortError'});
 const next=game.actor('atlas').do('bench');game.dispose();await assert.rejects(next,{name:'AbortError'});assert.throws(()=>game.actor('atlas'),/disposed/);
});
test('a rejected worker command or mechanical failure settles its promise',async()=>{
 const view=fixture(),game=createWorkoutGame(view),pending=game.actor('atlas').do('pullup');view.emit({type:'actor.action.failed',request:view.requests[0].request,error:'Unreachable bar'});await assert.rejects(pending,/Unreachable/);
 view.request=()=>Promise.reject(new Error('Worker closed'));await assert.rejects(game.actor('atlas').do('rest'),/Worker closed/);game.dispose();
});
