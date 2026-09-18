const aborted=message=>Object.assign(new Error(message),{name:'AbortError'});

/** Owns a dedicated Worker supplied by the caller. One sample may execute while
 * one latest sample waits. Superseded queued samples reject with AbortError;
 * project changes and control commands invalidate earlier sample promises. */
export function createNativeActionClient(worker){
 if(!worker||typeof worker.postMessage!=='function'||typeof worker.addEventListener!=='function')throw new TypeError('A dedicated Worker instance is required.');
 let disposed=false,generation=0,nextId=1,configured=false,ready=false,configurationError=null,fatalError=null,activeControl=null,activeSample=null,latestSample=null;
 const tasks=new Map(),controls=[];
 const task=(type,values={})=>{
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;}),entry={id:nextId++,generation,type,...values,resolve,reject,promise};tasks.set(entry.id,entry);return entry;
 };
 function cancel(entry,error){if(entry&&tasks.delete(entry.id))entry.reject(error);}
 function cancelSamples(message){
  const error=aborted(message);cancel(tasks.get(activeSample),error);cancel(tasks.get(latestSample),error);activeSample=null;latestSample=null;
 }
 function cancelAll(error){for(const entry of tasks.values())entry.reject(error);tasks.clear();controls.length=0;activeControl=null;activeSample=null;latestSample=null;}
 function post(entry){
  const {id,generation,type,config,time}=entry;
  try{worker.postMessage({id,generation,type,...(type==='configure'?{config}:{}),...(time===undefined?{}:{time})});}
  catch(error){complete(entry,false,error);}
 }
 function pump(){
  if(disposed||activeControl!==null||!ready)return;
  while(controls.length&&!tasks.has(controls[0]))controls.shift();
  if(controls.length){const id=controls.shift();activeControl=id;post(tasks.get(id));return;}
  if(activeSample===null&&latestSample!==null){const id=latestSample;latestSample=null;const entry=tasks.get(id);if(entry){activeSample=id;post(entry);}}
 }
 function complete(entry,ok,value){
  if(!tasks.delete(entry.id)||entry.generation!==generation)return;
  if(activeControl===entry.id)activeControl=null;
  if(activeSample===entry.id)activeSample=null;
  if(entry.type==='configure'){
   ready=ok;configurationError=ok?null:value;
   if(!ok){cancelAll(value);entry.reject(value);return;}
  }
  if(ok)entry.resolve(value);else entry.reject(value);
  pump();
 }
 function onMessage(event){
  const response=event.data,entry=tasks.get(response?.id);
  if(!entry||response.generation!==generation||entry.generation!==generation)return;
  const error=response.ok?null:Object.assign(new Error(response.error?.message||'Native action worker failed.'),{name:response.error?.name||'Error'});
  complete(entry,!!response.ok,response.ok?response.result:error);
 }
 function onError(event){
  if(disposed)return;const error=new Error(event.message||'Native action worker failed to communicate.');ready=false;configurationError=error;fatalError=error;cancelAll(error);
 }
 worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);worker.addEventListener('messageerror',onError);
 const available=()=>disposed?new Error('Native action client is disposed.'):!configured?new Error('Configure the native action before using it.'):configurationError;
 function control(type,time){
  const error=available();if(error)return Promise.reject(error);
  cancelSamples('Native action playback mode changed.');const entry=task(type,{time});controls.push(entry.id);pump();return entry.promise;
 }
 return {
  configure(config){
   if(disposed)return Promise.reject(new Error('Native action client is disposed.'));
   if(fatalError)return Promise.reject(fatalError);
   cancelAll(aborted('Native action project changed.'));generation++;configured=true;ready=false;configurationError=null;
   const entry=task('configure',{config});activeControl=entry.id;post(entry);return entry.promise;
  },
  sample(time){
   const error=available();if(error)return Promise.reject(error);
   if(!Number.isFinite(time))return Promise.reject(new TypeError('Native action sample time must be finite.'));
   cancel(tasks.get(latestSample),aborted('A newer native action sample replaced this queued request.'));
   const entry=task('sample',{time});latestSample=entry.id;pump();return entry.promise;
  },
  finishSafely(time){if(!Number.isFinite(time))return Promise.reject(new TypeError('Native action interruption time must be finite.'));return control('finishSafely',time);},
  reset(){return control('reset');},
  dispose(){
   if(disposed)return;disposed=true;cancelAll(aborted('Native action client disposed.'));
   worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);worker.removeEventListener('messageerror',onError);worker.terminate();
  }
 };
}
