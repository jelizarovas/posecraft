let serial=0;
const aborted=message=>Object.assign(new Error(message||'Workout command cancelled.'),{name:'AbortError'});

/** Semantic commands for the native workout. The director owns safe transitions;
 * promises settle from its events, never from estimated animation durations. */
export function createWorkoutGame(view,{onCommand=()=>{}}={}){
 const jobs=new Map(),sequences=new Set();let disposed=false;
 const check=()=>{if(disposed)throw new Error('Workout game has been disposed.');};
 const validate=(action,target)=>{const manifest=view.describe(),actor=manifest.actors?.find(a=>a.id==='atlas');if(!actor?.actions?.includes(action))throw new Error('Unsupported workout action: '+action);if(target!==undefined&&(typeof target!=='string'||!manifest.anchors?.some(a=>(typeof a==='string'?a:a.id)===target)||target!=={bench:'bench',pullup:'pullup',drink:'bottle'}[action]))throw new Error('Unsupported workout target: '+target);};
 const finish=(job,error,event)=>{if(!jobs.delete(job.id))return;job.signal?.removeEventListener('abort',job.abort);error?job.reject(error):job.resolve(event);};
 const unsubscribe=view.subscribe(event=>{
  if(event.type==='error'){for(const job of [...jobs.values()])finish(job,new Error(event.error||event.message||'Workout worker failed.'));return;}
  if(['workout.reset','workout.disposed','workout.changed'].includes(event.type)){for(const job of [...jobs.values()])finish(job,aborted('Workout changed.'));return;}
  const job=jobs.get(event.request);if(!job)return;
  if(event.type==='actor.action.completed')finish(job,null,event);
  if(event.type==='actor.action.failed')finish(job,new Error(event.error||'Action could not complete.'),event);
  if(event.type==='actor.command.cancelled')finish(job,aborted(),event);
 });
 function perform(action,{signal,target}={}){
  check();validate(action,target);if(signal?.aborted)return Promise.reject(aborted());
  if(signal!==undefined&&(!signal||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw new TypeError('Expected an AbortSignal.');
  const id='workout-game-'+(++serial);let job;
  const promise=new Promise((resolve,reject)=>{job={id,resolve,reject,signal,abort:()=>{try{Promise.resolve(view.cancel(id)).catch(error=>finish(job,error));}catch(error){finish(job,error);}}};jobs.set(id,job);signal?.addEventListener('abort',job.abort,{once:true});});
  try{onCommand();Promise.resolve(view.request(action,{request:id,...(target?{target}:{})})).catch(error=>finish(job,error));}catch(error){finish(job,error);}
  return promise;
 }
 const handle={
  capabilities(){check();return view.describe();},
  do:perform,
  cancel(){check();for(const job of jobs.values())job.abort();},
  sequence(steps,{signal}={}){
   check();if(!Array.isArray(steps)||!steps.length||steps.length>256||steps.some(s=>!s||typeof s.do!=='string'||Object.keys(s).some(k=>!['do','target'].includes(k))))throw new Error('A workout sequence needs 1..256 named action steps.');
   const recipe=structuredClone(steps);for(const step of recipe)validate(step.do,step.target);
   if(signal!==undefined&&(!signal||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw new TypeError('Expected an AbortSignal.');
   const abort=new AbortController(),stop=()=>abort.abort();sequences.add(abort);signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
   const finished=(async()=>{try{for(const step of recipe){if(abort.signal.aborted)throw aborted();await perform(step.do,{signal:abort.signal,target:step.target});}}finally{sequences.delete(abort);signal?.removeEventListener('abort',stop);}})();
   finished.catch(()=>{});return {finished,cancel:stop};
  }
 };
 return {actor(id){check();if(id!=='atlas')throw new Error('Unknown workout actor: '+id);return handle;},describe(){check();return view.describe();},dispose(){if(disposed)return;disposed=true;for(const sequence of sequences)sequence.abort();for(const job of [...jobs.values()]){job.abort();finish(job,aborted('Workout game disposed.'));}unsubscribe();}};
}
