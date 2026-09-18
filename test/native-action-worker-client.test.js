import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeActionClient} from '../src/native-action-worker-client.js';

class WorkerStub extends EventTarget{
 messages=[];terminated=0;
 postMessage(message){this.messages.push(message);}
 terminate(){this.terminated++;}
 reply(message,result,ok=true){this.dispatchEvent(new MessageEvent('message',{data:{id:message.id,generation:message.generation,ok,...(ok?{result}:{error:{name:'RangeError',message:result}})}}));}
}
async function configured(){const worker=new WorkerStub(),client=createNativeActionClient(worker),ready=client.configure({});worker.reply(worker.messages[0]);await ready;return {worker,client};}
test('native action client keeps one running sample and only the latest waiting sample',async()=>{
 const {worker,client}=await configured();
 const first=client.sample(1),superseded=client.sample(2).catch(e=>e),latest=client.sample(3);
 assert.equal(worker.messages.length,2);assert.equal((await superseded).name,'AbortError');
 worker.reply(worker.messages[1],{time:1});assert.deepEqual(await first,{time:1});assert.equal(worker.messages.length,3);assert.equal(worker.messages[2].time,3);
 worker.reply(worker.messages[2],{time:3});assert.deepEqual(await latest,{time:3});client.dispose();
});
test('project generations reject old requests and ignore their later responses',async()=>{
 const {worker,client}=await configured(),old=client.sample(1).catch(e=>e),oldMessage=worker.messages.at(-1);
 const changed=client.configure({different:true}),message=worker.messages.at(-1),queued=client.sample(4);
 assert.equal((await old).name,'AbortError');worker.reply(oldMessage,{time:1});assert.equal(worker.messages.at(-1),message);
 worker.reply(message);await changed;worker.reply(worker.messages.at(-1),{time:4});assert.deepEqual(await queued,{time:4});client.dispose();
});
test('control commands invalidate pending samples and gate subsequent sampling',async()=>{
 const {worker,client}=await configured(),old=client.sample(2).catch(e=>e),finish=client.finishSafely(2),command=worker.messages.at(-1),after=client.sample(0);
 assert.equal((await old).name,'AbortError');assert.equal(command.type,'finishSafely');assert.equal(worker.messages.at(-1),command);
 worker.reply(command,{supported:true,duration:8});assert.deepEqual(await finish,{supported:true,duration:8});assert.equal(worker.messages.at(-1).type,'sample');worker.reply(worker.messages.at(-1),{time:0,phase:'recovery'});assert.equal((await after).phase,'recovery');
 const reset=client.reset();worker.reply(worker.messages.at(-1));await reset;client.dispose();
});
test('configuration and worker failures reject promises, and disposal terminates once',async()=>{
 const worker=new WorkerStub(),client=createNativeActionClient(worker);await assert.rejects(client.sample(0),/Configure/);
 const config=client.configure({}),queued=client.sample(0);worker.reply(worker.messages[0],'Bad rig',false);
 await assert.rejects(config,{name:'RangeError',message:'Bad rig'});await assert.rejects(queued,/Bad rig/);await assert.rejects(client.sample(0),/Bad rig/);
 const again=client.configure({});worker.reply(worker.messages.at(-1));await again;
 const running=client.sample(0),waiting=client.sample(1);worker.dispatchEvent(Object.assign(new Event('error'),{message:'worker crashed'}));await assert.rejects(running,/worker crashed/);await assert.rejects(waiting,/worker crashed/);
 await assert.rejects(client.configure({}),/worker crashed/);
 client.dispose();client.dispose();assert.equal(worker.terminated,1);await assert.rejects(client.sample(0),/disposed/);
});
