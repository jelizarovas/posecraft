import {createBenchAction3D} from './bench-action-3d.js';

// Dedicated worker entry. Rendering and imported asset resources stay on the
// host; only cloneable rig data and solved frames cross this boundary.
let generation=0,action=null,recovery=null;
self.addEventListener('message',event=>{
 const message=event.data,{id,type}=message??{};
 try{
  if(!Number.isSafeInteger(id)||!Number.isSafeInteger(message.generation))throw new Error('Invalid native action request.');
  let result;
  if(type==='configure'){
   if(message.generation<generation)throw Object.assign(new Error('Stale native action configuration.'),{name:'AbortError'});
   generation=message.generation;action=null;recovery=null;
   action=createBenchAction3D(message.config);
  }else{
   if(message.generation!==generation)throw Object.assign(new Error('Native action project has changed.'),{name:'AbortError'});
   if(!action)throw new Error('Configure a native action before sampling it.');
   if(type==='sample')result=(recovery??action).sample(message.time);
   else if(type==='finishSafely'){
    if(recovery)result={supported:false,reason:'The action is already completing a safe recovery.'};
    else {const next=action.interrupt(message.time);if(next.supported){recovery=next;result={supported:true,duration:next.duration};}else result={supported:false,reason:next.reason};}
   }else if(type==='reset')recovery=null;
   else throw new Error(`Unknown native action command: ${String(type)}.`);
  }
  self.postMessage({id,generation:message.generation,ok:true,result});
 }catch(error){
  self.postMessage({id,generation:message?.generation,ok:false,error:{name:error?.name||'Error',message:error?.message||String(error)}});
 }
});
