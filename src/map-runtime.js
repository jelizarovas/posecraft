import {assertMap,MapIndex,MapPathJob,approachTiles,projectMap,unprojectMap} from './map.js';

const abortError=message=>Object.assign(new Error(message),{name:'AbortError'});
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const cell=p=>({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5});
function signature(map){let hash=2166136261;const text=JSON.stringify([map.width,map.height,map.tileSize,map.terrain,map.props,map.actors]);for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return `map1-${map.id}-${(hash>>>0).toString(16)}-${text.length}`;}

/** Logical map movement. Rendering and camera changes never affect navigation. */
export class MapController {
 constructor(document,{execution='worker',onEvent,onError}={}){
  this.map=structuredClone(assertMap(document));this.index=new MapIndex(this.map);this.signature=signature(this.map);
  this.actors=new Map(this.map.actors.map(a=>[a.id,{...a,facing:Math.PI/4,walking:false,phase:0}]));
  this.actorChunks=new Map();this.actorChunkKeys=new Map();for(const actor of this.actors.values())this.indexActor(actor);
  this.objects=Object.create(null);this.active=new Map();this.listeners=new Set();this.serial=0;this.disposed=false;this.timer=null;this.onError=onError;if(onEvent)this.listeners.add(onEvent);
  this.stats={execution:'main',expanded:0,pending:0};
  if(execution==='worker'&&typeof Worker!=='undefined'){
   this.stats.execution='worker';this.worker=new Worker(new URL('./map-worker.js',import.meta.url),{type:'module'});
   this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.ready.catch(()=>{});
   this.worker.onmessage=({data:m})=>{if(this.disposed)return;if(m.type==='ready'){this.resolveReady(this);return;}if(m.type==='error'){this.fail(new Error(m.message));return;}if(m.type==='path'){const job=[...this.active.values()].find(j=>j.request===m.request);if(job)this.accept(job,m.result);}};
   this.worker.onerror=e=>this.fail(new Error(e.message||'Map path worker failed.'));this.worker.postMessage({type:'init',map:this.map});
  }else if(execution==='main'||execution==='worker'){this.ready=Promise.resolve(this);}else throw Error('Map execution must be main or worker.');
 }
 check(){if(this.disposed)throw Error('Map has been disposed.');if(this.failed)throw this.failed;if(this.restoring)throw abortError('Map is being restored.');}
 subscribe(listener){this.check();this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 get isMoving(){return [...this.active.values()].some(job=>job.route);}
 actorPosition(id){const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');return {...actor};}
 indexActor(actor){const key=Math.floor(actor.x/16)+','+Math.floor(actor.y/16),old=this.actorChunkKeys.get(actor.id);if(old===key)return;if(old){const bucket=this.actorChunks.get(old);bucket.delete(actor.id);if(!bucket.size)this.actorChunks.delete(old);}if(!this.actorChunks.has(key))this.actorChunks.set(key,new Set());this.actorChunks.get(key).add(actor.id);this.actorChunkKeys.set(actor.id,key);}
 indexRoute(job){job.routeChunks=new Map();for(let i=1;i<job.route.length;i++){const a=job.route[i-1],b=job.route[i];for(let y=Math.floor(Math.min(a.y,b.y)/16);y<=Math.floor(Math.max(a.y,b.y)/16);y++)for(let x=Math.floor(Math.min(a.x,b.x)/16);x<=Math.floor(Math.max(a.x,b.x)/16);x++){const key=x+','+y;if(!job.routeChunks.has(key))job.routeChunks.set(key,[]);job.routeChunks.get(key).push(i);}}}
 emit(event){for(const listener of this.listeners)try{listener(event);}catch(error){try{this.onError?.(error);}catch{}}}
 fail(error){this.failed=error;this.rejectReady?.(error);for(const job of [...this.active.values()])this.finish(job,error);this.worker?.terminate();clearTimeout(this.timer);this.timer=null;try{this.onError?.(error);}catch{}this.emit({type:'map.error',message:error.message});}
 actor(id){this.check();if(!this.actors.has(id))throw Error('Unknown map actor.');return {moveTo:(target,options)=>this.moveTo(id,target,options),cancel:()=>this.cancel(id)};}
 moveTo(id,target,{signal}={}){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw Error('Expected AbortSignal.');
  const prop=typeof target==='string'?this.index.prop(target):null;
  if(typeof target==='string'&&!prop)throw Error('Unknown map object.');
  if(!prop&&(!point(target)||target.x<0||target.y<0||target.x>=this.map.width||target.y>=this.map.height))throw Error('Map destination must be inside the grid.');
  const goals=prop?approachTiles(this.map,this.index,prop):[cell(target)];
  if(!goals.length||goals.every(p=>this.index.isBlocked(Math.floor(p.x),Math.floor(p.y))))return Promise.reject(Error('Destination is blocked or has no accessible approach.'));
  if(signal?.aborted)return Promise.reject(abortError('Movement cancelled.'));
  if(this.active.size>=16&&!this.active.has(id))return Promise.reject(Error('At most 16 map movements may be active.'));
  // Reject invalid destinations before replacing a valid movement.
  const previous=this.active.get(id),request='map-'+(++this.serial);let job;
  const promise=new Promise((resolve,reject)=>{const abort=()=>this.cancelRequest(id,request);job={actor:id,request,target:typeof target==='string'?target:cell(target),prop,goals,start:{x:actor.x,y:actor.y},resolve,reject,signal,abort,route:null,index:1,velocity:0};signal?.addEventListener('abort',abort,{once:true});this.active.set(id,job);});
  promise.catch(()=>{});if(previous)this.finish(previous,abortError('Movement replaced.'));if(this.active.get(id)!==job)return promise;this.emit({type:'map.move.started',actor:id,request,target:job.target});
  this.ready.then(()=>{if(this.disposed||this.active.get(id)!==job)return;if(this.worker)this.worker.postMessage({type:'path',request,start:job.start,goals});else{job.planning=true;this.schedulePaths();}}).catch(error=>this.finish(job,error));
  return promise;
 }
 schedulePaths(){
  if(this.timer!==null||this.disposed)return;
  this.timer=setTimeout(()=>{
   this.timer=null;const deadline=performance.now()+2,pending=[...this.active.values()].filter(j=>j.planning);let allocated=pending.filter(j=>j.pathJob).length;
   for(const job of pending){if(allocated>=4)break;if(!job.pathJob){try{job.pathJob=new MapPathJob(this.map,this.index,job.start,job.goals);allocated++;}catch(error){job.planning=false;this.finish(job,error);}}}
   const ready=pending.filter(j=>j.pathJob);this.pathCursor=(this.pathCursor??0)%Math.max(1,ready.length);
   for(let i=0;i<ready.length;i++){const job=ready[(this.pathCursor+i)%ready.length],result=job.pathJob.step(64);if(result.status!=='pending'){job.pathJob=null;job.planning=false;this.accept(job,result);}if(performance.now()>=deadline){this.pathCursor=(this.pathCursor+i+1)%ready.length;break;}}
   if([...this.active.values()].some(j=>j.planning))this.schedulePaths();
  },0);
 }
 accept(job,result){if(this.active.get(job.actor)!==job)return;this.stats.expanded+=result.visited??0;if(result.status!=='complete'||!result.path?.length){this.finish(job,Error(result.reason||'No route to destination.'));return;}const actor=this.actors.get(job.actor);job.route=[{x:actor.x,y:actor.y},...result.path].filter((p,i,a)=>i===0||Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>1e-7);job.index=1;job.remaining=job.route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-job.route[i].x,p.y-job.route[i].y),0);this.indexRoute(job);actor.walking=job.route.length>1;this.emit({type:'map.route.ready',actor:job.actor,request:job.request,points:job.route.length});if(job.route.length===1&&this.active.get(job.actor)===job)this.arrive(job);}
 cancelRequest(id,request){const job=this.active.get(id);if(job?.request===request)this.finish(job,abortError('Movement cancelled.'));}
 cancel(id){const job=this.active.get(id);if(job)this.finish(job,abortError('Movement cancelled.'));}
 finish(job,error,event){if(job.done)return;job.done=true;if(this.active.get(job.actor)===job){this.active.delete(job.actor);this.actors.get(job.actor).walking=false;}job.signal?.removeEventListener('abort',job.abort);if(error){this.worker?.postMessage({type:'cancel',request:job.request});job.reject(error);this.emit({type:error.name==='AbortError'?'map.command.cancelled':'map.command.failed',actor:job.actor,request:job.request,message:error.message});}else{job.resolve(event);this.emit(event);}}
 arrive(job){const actor=this.actors.get(job.actor),event={type:'map.actor.arrived',actor:job.actor,request:job.request,target:job.target,x:actor.x,y:actor.y};if(job.prop?.kind==='chest')Object.defineProperty(this.objects,job.prop.id,{value:{opened:true},enumerable:true,configurable:true,writable:true});this.finish(job,null,event);if(job.prop&&!this.disposed)this.emit({type:'map.object.interacted',actor:job.actor,object:job.prop.id,kind:job.prop.kind,request:job.request});}
 advance(dt){
  this.check();if(!Number.isFinite(dt)||dt<0)throw Error('Map step must be finite and nonnegative.');dt=Math.min(dt,.1);
  for(const job of [...this.active.values()]){
   if(!job.route||this.active.get(job.actor)!==job)continue;
   const actor=this.actors.get(job.actor),speed=actor.speed??3.5,acceleration=speed*5;
   job.velocity=Math.min(speed,job.velocity+acceleration*dt,Math.sqrt(Math.max(0,2*acceleration*job.remaining)));
   let travel=Math.min(job.remaining,Math.max(.01,job.velocity)*dt);
   while(job.index<job.route.length&&travel>0){
    const p=job.route[job.index],dx=p.x-actor.x,dy=p.y-actor.y,d=Math.hypot(dx,dy),length=Math.min(travel,d);
    if(d>1e-9){actor.x+=dx/d*length;actor.y+=dy/d*length;actor.facing=Math.atan2(dy,dx);actor.phase=(actor.phase+length*Math.PI*2)%(Math.PI*2);}
    travel-=length;job.remaining=Math.max(0,job.remaining-length);
    if(d-length<1e-7){actor.x=p.x;actor.y=p.y;job.index++;}else break;
   }
   this.indexActor(actor);if(job.index>=job.route.length)this.arrive(job);
  }
 }
 step(dt){this.advance(dt);return this.frame();}
 visibleFrame(rect,props=[]){
  this.check();if(!point(rect)||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)throw Error('Invalid map viewport.');
  const pad=Math.max(64,this.map.tileSize.width),left=rect.x-pad,top=rect.y-pad,right=rect.x+rect.width+pad,bottom=rect.y+rect.height+pad;
  const corners=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].map(p=>unprojectMap(this.map,p));
  const x0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))/16)),x1=Math.min(Math.floor((this.map.width-1)/16),Math.floor(Math.max(...corners.map(p=>p.x))/16));
  const y0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))/16)),y1=Math.min(Math.floor((this.map.height-1)/16),Math.floor(Math.max(...corners.map(p=>p.y))/16));
  const actors=[],routeSegments=[],jobs=[...this.active.values()],job=jobs.find(j=>j.route),segments=new Set();let candidateActors=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const key=x+','+y;
   for(const id of this.actorChunks.get(key)||[]){candidateActors++;const a=this.actors.get(id),p=projectMap(this.map,a);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)actors.push({...a});}
   for(const i of job?.routeChunks?.get(key)||[])if(i>=job.index)segments.add(i);
  }
  for(const i of segments){const from=i===job.index?this.actors.get(job.actor):job.route[i-1],to=job.route[i],a=projectMap(this.map,from),b=projectMap(this.map,to);if(Math.max(a.x,b.x)>=left&&Math.min(a.x,b.x)<=right&&Math.max(a.y,b.y)>=top&&Math.min(a.y,b.y)<=bottom)routeSegments.push({from:{x:from.x,y:from.y},to:{...to}});}
  const objects=Object.create(null);for(const p of props)if(Object.hasOwn(this.objects,p.id))objects[p.id]={...this.objects[p.id]};
  return {actors,objects,route:null,routeSegments,pending:jobs.filter(j=>!j.route).length,candidateActors,candidateRouteSegments:segments.size};
 }
 frame(){const jobs=[...this.active.values()];this.stats.pending=jobs.filter(j=>!j.route).length;return {actors:[...this.actors.values()].map(a=>({...a})),objects:structuredClone(this.objects),route:jobs.find(j=>j.route)?.route?.map(p=>({...p}))??null,pending:this.stats.pending};}
 snapshot(){this.check();return {format:'posecraft-map-state',version:1,map:this.signature,actors:[...this.actors.values()].map(({id,x,y,facing})=>({id,x,y,facing})),objects:structuredClone(this.objects)};}
 restore(input){
  this.check();const state=structuredClone(input);
  if(state?.format!=='posecraft-map-state'||state.version!==1||state.map!==this.signature||!Array.isArray(state.actors)||state.actors.length!==this.actors.size||!state.objects||typeof state.objects!=='object'||Array.isArray(state.objects))throw Error('Incompatible map save.');
  const ids=new Set();
  for(const a of state.actors){if(!a||!this.actors.has(a.id)||ids.has(a.id)||!point(a)||!Number.isFinite(a.facing)||a.x<0||a.y<0||a.x>=this.map.width||a.y>=this.map.height||this.index.isBlocked(Math.floor(a.x),Math.floor(a.y)))throw Error('Invalid saved actor position.');ids.add(a.id);}
  for(const [id,value]of Object.entries(state.objects))if(this.index.prop(id)?.kind!=='chest'||!value||typeof value!=='object'||Array.isArray(value)||value.opened!==true||Object.keys(value).some(k=>k!=='opened'))throw Error('Invalid saved object state.');
  this.restoring=true;
  try{
   for(const job of [...this.active.values()])this.finish(job,abortError('Map restored.'));
   for(const a of state.actors){Object.assign(this.actors.get(a.id),{x:a.x,y:a.y,facing:a.facing,walking:false,phase:0});this.indexActor(this.actors.get(a.id));}
   this.objects=Object.assign(Object.create(null),state.objects);
  }finally{this.restoring=false;}
  this.emit({type:'map.restored'});return this.frame();
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const job of [...this.active.values()])this.finish(job,abortError('Map disposed.'));clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.rejectReady?.(abortError('Map disposed.'));this.listeners.clear();}
}
