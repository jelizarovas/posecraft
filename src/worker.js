import {SceneController} from './scene.js';
import {behaviorConfig,behaviorModes} from './physics.js';

// A single in-flight simulation batch. Latest host/preview samples replace old
// ones; ordered interactions stay bounded. No timer runs while the page sleeps.
export class WorkerSceneController {
 constructor(document,{reducedMotion=false,onError}={}){
  this.document=document;this.reducedMotion=reducedMotion;this.playing=true;this.animationPlaying=true;this.motion={ax:0,ay:0};this.listeners=new Set();this.queue=[];this.pendingDt=0;this.sequence=0;this.inFlight=false;this.started=false;this.disposed=false;this.paths=new Map();this.pathId=0;this.onError=onError;this.previewKeys=new Map();
  this.stats={execution:'worker',computeMs:0,roundTripMs:0,droppedSeconds:0,pendingBatches:0};
  const initial=new SceneController(document,{reducedMotion});this.latest=initial.frame();initial.dispose();this.mirror();
  this.worker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
  this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.ready.catch(()=>{});
  this.worker.onmessage=({data:m})=>this.receive(m);this.worker.onerror=e=>this.fail(new Error(e.message||'Simulation worker failed.'));
  this.worker.postMessage({type:'init',document,reducedMotion});
 }
 mirror(layers=[]){this.actors=this.latest.actors.map(a=>({actor:this.document.actors.find(v=>v.id===a.id),spring:a.spring,response:{state:a.response},physics:a.physics?{diagnostics:a.physics}:null,runtime:{layers:[layers.find(v=>v.id===a.id)||{state:a.state,time:this.latest.time}]}}));}
 receive(m){
  if(this.disposed)return;
  if(m.type==='path'){const p=this.paths.get(m.id);if(p){p.cleanup();p.resolve(m.result);this.paths.delete(m.id);}return;}
  if(m.type==='error'){const p=this.paths.get(m.id);if(p){p.cleanup();p.reject(new Error(m.message));this.paths.delete(m.id);}else this.fail(new Error(m.message));return;}
  if(m.type==='ready'){this.started=true;this.latest=m.frame;this.mirror();this.resolveReady(this);this.flush();return;}
  if(m.type==='frame'){
   this.inFlight=false;this.latest=m.frame;this.motion=m.motion;this.mirror(m.layers);Object.assign(this.stats,{computeMs:m.computeMs,roundTripMs:performance.now()-this.sentAt,pendingBatches:0});
   for(const event of m.events){if(event.type==='error')this.onError?.(new Error(event.message));for(const fn of this.listeners)fn(event);}
   this.onFrame?.(this.latest);
   if(this.queue.length||this.pendingDt||this.host)this.flush();
  }
 }
 fail(error){if(this.disposed)return;this.playing=false;this.rejectReady(error);for(const p of this.paths.values()){p.cleanup();p.reject(error);}this.paths.clear();this.worker.terminate();this.disposed=true;this.stats.execution='failed';this.onError?.(error);for(const fn of this.listeners)fn({type:'error',message:error.message});}
 command(method,args=[],coalesce){
  if(this.disposed)throw new Error('Simulation worker is unavailable.');
  if(coalesce){const index=this.queue.findIndex(c=>c.key===coalesce);if(index>=0)this.queue.splice(index,1);}
  if(this.queue.length>=128)throw new Error('Simulation command queue is full.');
  this.queue.push({key:coalesce,value:[method,...args]});queueMicrotask(()=>this.flush());
 }
 flush(){
  if(!this.started||this.inFlight||this.disposed)return;
  if(!this.queue.length&&!this.pendingDt&&!this.host)return;
  this.inFlight=true;this.sentAt=performance.now();this.stats.pendingBatches=1;
  this.worker.postMessage({type:'advance',sequence:++this.sequence,commands:this.queue.map(c=>c.value),dt:this.pendingDt,host:this.host,reducedMotion:this.reducedMotion,animationPlaying:this.animationPlaying});this.queue=[];this.pendingDt=0;this.host=null;
 }
 step(dt){if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid elapsed time.');const sum=this.pendingDt+dt;this.pendingDt=Math.min(sum,1/30);this.stats.droppedSeconds+=Math.max(0,sum-1/30);this.flush();return this.latest;}
 frame(){return this.latest;}
 get time(){return this.latest.time;}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 setInput(actor,name,value){const a=this.document.actors.find(a=>a.id===actor),spec=this.document.packs[a?.pack]?.inputs[name];if(!spec||typeof value!==spec.type||(spec.options&&!spec.options.includes(value))||(spec.type==='number'&&(!Number.isFinite(value)||value<spec.min||value>spec.max)))throw new Error('Invalid actor input.');this.command('setInput',[actor,name,value],`input:${actor}:${name}`);}
 setBehavior(actor,patch){const a=this.document.actors.find(a=>a.id===actor),b=behaviorConfig(patch);if(!a||!behaviorModes.includes(b.mode)||!['auto','brace','protect','curl'].includes(b.strategy)||typeof b.autoFace!=='boolean'||typeof b.autoRecover!=='boolean'||!Number.isFinite(b.resistance)||b.resistance<0||b.resistance>1||!Number.isFinite(b.gravity)||b.gravity<0||b.gravity>2||!Number.isFinite(b.bounce)||b.bounce<0||b.bounce>1)throw new Error('Invalid behavior settings.');this.command('setBehavior',[actor,patch]);}
 triggerEnsemble(type){if(!this.document.ensemble||!['conversation','doze','meteor','share','share-missed','share-help','burn'].includes(type))throw new Error('Unknown ensemble event.');this.command('triggerEnsemble',[type]);}
 walkTo(actor,x){if(!this.document.actors.some(a=>a.id===actor)||!Number.isFinite(x)||x<0||x>this.document.bounds.width)throw new Error('Walk target must be inside the scene.');this.command('walkTo',[actor,x],`walk:${actor}`);}
 interact(actor,type,strength=1){if(!this.document.actors.some(a=>a.id===actor)||!['tap','pet','startle','drop','toss','hurt','catch'].includes(type)||!Number.isFinite(strength)||strength<0||strength>2)throw new Error('Invalid interaction.');this.command('interact',[actor,type,strength]);}
 previewClip(actor,clip,time,overrides={}){const key=JSON.stringify([clip,time,overrides]);if(this.previewKeys.get(actor)!==key){this.command('previewClip',[actor,clip,time,overrides],`preview:${actor}`);this.previewKeys.set(actor,key);}return this.latest;}
 clearPreview(actor){this.previewKeys.delete(actor);this.command('clearPreview',[actor],`preview:${actor}`);}
 sampleHost(sample){this.host=sample;}
 setAcceleration(x,y){this.command('setAcceleration',[x,y],'acceleration');}
 rebaseline(){this.pendingDt=0;this.host=null;this.command('rebaseline',[],'baseline');}
 play(){this.playing=true;this.command('play');}
 pause(){this.playing=false;this.pendingDt=0;this.command('pause');}
 reset(){this.previewKeys.clear();this.pendingDt=0;this.host=null;this.command('reset');return this.latest;}
 seek(time){if(!Number.isFinite(time)||time<0||time>180)throw new Error('Seek range is 0..180 seconds.');this.previewKeys.clear();this.command('seek',[time],'seek');return this.latest;}
 async findPath(request,{signal}={}){
  await this.ready;if(this.disposed)throw new Error('Simulation worker is unavailable.');if(signal?.aborted)throw new DOMException('Path cancelled','AbortError');
  if(this.paths.size>=24)throw new Error('At most 24 path requests may be pending.');const id=++this.pathId;
  return new Promise((resolve,reject)=>{const cancel=()=>{this.worker.postMessage({type:'cancelPath',id});this.paths.delete(id);cleanup();reject(new DOMException('Path cancelled','AbortError'));},cleanup=()=>signal?.removeEventListener('abort',cancel);this.paths.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',cancel,{once:true});this.worker.postMessage({type:'path',id,request});});
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.worker.terminate();this.rejectReady(new Error('Simulation disposed.'));for(const p of this.paths.values()){p.cleanup();p.reject(new Error('Simulation disposed.'));}this.paths.clear();this.listeners.clear();this.queue=[];}
}
