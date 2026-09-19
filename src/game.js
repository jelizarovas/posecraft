import {describeGameScene,gameActorBindings,resolveGameTarget} from './game-bindings.js';

let nextScene=0;
const abortError=message=>Object.assign(new Error(message||'Command cancelled.'),{name:'AbortError'});
const own=(object,key)=>Object.hasOwn(object,key);
const text=(value,name,max=200)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new TypeError(`${name} must be nonempty text, at most ${max} characters.`);return value;};
const commandSignal=options=>{if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Command options must be an object.');const signal=options.signal;if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw new TypeError('Expected an AbortSignal.');return signal;};

/** Game-facing commands use the controller's simulation clock, never timers.
 * The host owns stepping, visibility, persistence, dialogue and game rules. */
export function createGameScene(controller,options={}){
 if(!controller?.document||typeof controller.gameCommand!=='function')throw new TypeError('Expected a scene controller with game-command support.');
 const document=controller.document,manifest=describeGameScene(document),prefix=`game-${++nextScene}`,pending=new Map(),active=new Map(),actors=new Map(),sequences=new Set();
 let serial=0,disposed=false,cancellingAll=false;
 const check=()=>{if(disposed)throw new Error('Game scene has been disposed.');if(cancellingAll)throw abortError('Scene commands are being cancelled.');};
 const reportError=error=>{try{options.onError?.(error);}catch{}};
 const emit=event=>{try{options.onEvent?.({...event,time:controller.time});}catch(error){reportError(error);}};
 function finish(job,error,event){
  if(!pending.has(job.request))return;
  pending.delete(job.request);if(active.get(job.actor)===job)active.delete(job.actor);try{job.cleanup();}catch(error){reportError(error);}
  if(error){job.speech?.abort();job.reject(error);emit({type:error.name==='AbortError'?'actor.command.cancelled':'actor.command.failed',actor:job.actor,request:job.request,command:job.command,error:error.message});}
  else{const result={type:job.event,actor:job.actor,request:job.request,command:job.command,...job.detail};job.resolve(result);emit(result);}
 }
 function cancel(job,reason){
  if(!job||!pending.has(job.request))return;
  finish(job,abortError(reason));job.speech?.abort();
  try{controller.gameCommand({type:'cancel',actor:job.actor,request:job.request});}catch{}
 }
 const unsubscribe=controller.subscribe(event=>{
  if(event.type==='error'){for(const job of [...pending.values()])finish(job,new Error(String(event.message||'Scene failed.')));return;}
  const job=pending.get(event.request);if(!job||event.actor!==job.actor)return;
  if(event.type==='actor.command.completed')finish(job,null,event);
  if(event.type==='actor.command.failed')finish(job,event.cancelled?abortError(event.error):new Error(String(event.error||'Command failed.')),event);
 });
 function run(actor,command,detail,commandOptions={},speech,prepare){
  check();const signal=commandSignal(commandOptions);
  if(signal?.aborted)return Promise.reject(abortError());
  const previous=active.get(actor);
  const request=`${prefix}-${++serial}`,event={action:'actor.action.completed',move:'actor.arrived',look:'actor.look.completed',speech:'actor.speech.completed'}[command];
  let job;
  const promise=new Promise((resolve,reject)=>{
   const abort=()=>cancel(job,'Command cancelled.');
   job={actor,command,detail,request,event,resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)};
   pending.set(request,job);active.set(actor,job);try{signal?.addEventListener('abort',abort,{once:true});}catch(error){finish(job,error);}
  });
  // Register the replacement first. A callback which starts a newer command
  // then cancels this exact request instead of leaving two active promises.
  cancel(previous,'Replaced by another command.');if(!pending.has(request))return promise;
  try{options.onCommand?.();}catch(error){finish(job,error);return promise;}
  let ready;try{ready=controller.ready;}catch(error){finish(job,error);return promise;}
  Promise.resolve(ready).then(()=>{
   if(!pending.has(request))return;
   prepare?.();
   if(!pending.has(request))return;
   if(speech){
    job.speech=new AbortController();emit({type:'actor.speech.requested',actor,request,text:speech.text,emotion:speech.emotion});
    if(!pending.has(request))return;
    return Promise.resolve(options.onSpeechRequest({actor,...speech,signal:job.speech.signal})).then(()=>finish(job));
   }
   if(controller.gameCommand({type:command,actor,request,...detail})===false&&pending.has(request))finish(job,new Error('Scene rejected the actor command.'));
  }).catch(error=>finish(job,error));
  return promise;
 }
 function target(value){const resolved=resolveGameTarget(document,controller.frame(),value);if(!resolved)throw new Error('Target is missing, hidden or disabled.');return resolved;}
 function actor(id){
  check();text(id,'Actor ID');if(actors.has(id))return actors.get(id);
  const bindings=gameActorBindings(document,id);if(!bindings)throw new Error(`Unknown actor: ${id}`);
  const source=document.actors.find(a=>a.id===id),pack=document.packs[source.pack];
  const action=name=>{text(name,'Action');if(!own(bindings.actions,name))throw new Error(`Actor ${id} does not support action ${name}.`);return bindings.actions[name];};
  const handle={
   capabilities(){check();return structuredClone(manifest.actors.find(a=>a.id===id));},
   do(name,opts){return run(id,'action',{clip:action(name)},opts);},
   moveTo(value,opts){check();if(!pack.physics)throw new Error(`Actor ${id} has no ground locomotion rig.`);return run(id,'move',{x:target(value).x},opts);},
   lookAt(value,opts={}){check();if(!bindings.gaze)throw new Error(`Actor ${id} has no authored gaze binding.`);const duration=opts.duration??.35;if(!Number.isFinite(duration)||duration<0||duration>10)throw new Error('Look duration must be 0..10 seconds.');return run(id,'look',{target:target(value),joint:bindings.gaze.joint,maxAngle:bindings.gaze.maxAngle??30,duration},opts);},
   async react(name,opts={}){
    check();text(name,'Reaction');if(!own(bindings.reactions,name))throw new Error(`Actor ${id} does not support reaction ${name}.`);
    if(opts.signal?.aborted)throw abortError();
    const reaction=bindings.reactions[name];
    // An expression-only reaction performs one idle cycle so completion is
    // acknowledged by the same simulation/worker path as an action.
    const clip=reaction.action?action(reaction.action):pack.states[pack.initial].clip;
    const result=await run(id,'action',{clip},opts,undefined,()=>{if(reaction.emotion)controller.setInput(id,'emotion',reaction.emotion);});if(disposed||opts.signal?.aborted)throw abortError('Reaction cancelled.');emit({type:'actor.reaction.completed',actor:id,reaction:name,request:result.request});return result;
   },
   say(message,opts={}){check();text(message,'Speech',2000);if(!bindings.speech||typeof options.onSpeechRequest!=='function')throw new Error(`Actor ${id} needs a speech binding and host onSpeechRequest handler.`);if(opts.emotion!==undefined){const spec=pack.inputs.emotion;if(!spec?.options?.includes(opts.emotion))throw new Error('Unsupported speech emotion.');}return run(id,'speech',{},opts,{text:message,...(opts.emotion?{emotion:opts.emotion}:{})},()=>{if(opts.emotion)controller.setInput(id,'emotion',opts.emotion);});},
   send(event,payload={}){check();text(event,'Event');return controller.dispatchActor(id,event,payload);},
   cancel(){check();cancel(active.get(id),'Actor command cancelled.');},
   sequence(steps,opts){if(!Array.isArray(steps)||steps.some(step=>!step||typeof step!=='object'||Array.isArray(step)))throw new Error('A sequence needs an array of command objects.');return sequence(steps.map(step=>({...step,actor:id})),opts);}
  };
  actors.set(id,handle);return handle;
 }
 function object(id){
  check();text(id,'Object ID');if(!document.objects?.some(o=>o.id===id))throw new Error(`Unknown runtime object: ${id}`);
  return {set(property,value){check();if(property!=='enabled'||typeof value!=='boolean')throw new Error('Runtime objects currently expose only boolean enabled.');options.onCommand?.();check();controller.objectCommand({type:'enable',object:id,enabled:value});emit({type:'object.changed',object:id,property,value});}};
 }
 function sequence(steps,opts={}){
  check();if(!Array.isArray(steps)||!steps.length||steps.length>256)throw new Error('A sequence needs 1..256 steps.');
  const signal=commandSignal(opts),commands=['do','react','moveTo','lookAt','say'],recipe=structuredClone(steps);
  // Validate the complete recipe before the first command changes the scene.
  for(const step of recipe){
   if(!step||typeof step!=='object'||Array.isArray(step)||Object.keys(step).some(key=>!['actor',...commands].includes(key))||commands.filter(key=>own(step,key)).length!==1)throw new Error('Each sequence step needs one actor command and no extra fields.');
   const handle=actor(step.actor),caps=handle.capabilities();
   if(own(step,'do')&&!caps.actions.includes(step.do))throw new Error('Sequence contains an unsupported action.');
   if(own(step,'react')&&!caps.reactions.includes(step.react))throw new Error('Sequence contains an unsupported reaction.');
   if(own(step,'moveTo')){if(caps.locomotion!=='ground-x')throw new Error('Sequence actor cannot move.');target(step.moveTo);}
   if(own(step,'lookAt')){if(!caps.canLook)throw new Error('Sequence actor cannot look at targets.');target(step.lookAt);}
   if(own(step,'say')){text(step.say,'Speech',2000);if(!caps.canSpeak||typeof options.onSpeechRequest!=='function')throw new Error('Sequence requires a host speech handler.');}
  }
  const abort=new AbortController(),stop=()=>abort.abort();
  sequences.add(abort);try{signal?.addEventListener('abort',stop,{once:true});}catch(error){sequences.delete(abort);throw error;}if(signal?.aborted)abort.abort();
  const finished=(async()=>{for(const step of recipe){if(abort.signal.aborted)throw abortError('Sequence cancelled.');const command=commands.find(key=>own(step,key));await actor(step.actor)[command](step[command],{signal:abort.signal});if(abort.signal.aborted)throw abortError('Sequence cancelled.');}})().finally(()=>{sequences.delete(abort);signal?.removeEventListener('abort',stop);});
  // Cancellation is normal for scene teardown; consumers can still await the
  // original promise and receive its AbortError without an unhandled rejection.
  finished.catch(()=>{});return {finished,cancel:stop};
 }
 function cancelAll(reason='Scene command cancelled.'){if(cancellingAll)return;cancellingAll=true;try{for(const abort of [...sequences])abort.abort();for(const job of [...pending.values()])cancel(job,reason);}finally{cancellingAll=false;}}
 return {actor,object,prop:object,sequence,describe(){check();return structuredClone(manifest);},cancelAll,dispose(){if(disposed)return;disposed=true;try{cancelAll('Game scene disposed.');}finally{unsubscribe();}}};
}
