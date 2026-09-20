import {MapNavigationJob} from './map-navigation.js';
import {continuousSegmentClear} from './map-collision.js';
import {planMapVault} from './map-vault.js';
import {manualTraversalPlan,traversalActivation} from './map-traversal.js';
import {groundHeight} from './map-art-layout.js';
import {MapRoutePreparation,routeHeading,angleDelta,brakeMapMotion} from './map-motion.js';
import {assertMap,MapIndex,MapPathJob,approachTiles,projectMap,unprojectMap} from './map.js';

const abortError=message=>Object.assign(new Error(message),{name:'AbortError'});
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const cell=p=>({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5});
const movementDestination=job=>job?(job.manualTraversal?.landing??job.route?.at(-1)??job.goals?.[0]??null):null;
function signature(map){let hash=2166136261;const fields=[map.width,map.height,map.tileSize,map.terrain,map.props,map.actors];if(map.navigation)fields.push(map.navigation);if(map.elevations!==undefined)fields.push(map.elevations);if(map.terraces!==undefined)fields.push(map.terraces);const text=JSON.stringify(fields);for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return `map1-${map.id}-${(hash>>>0).toString(16)}-${text.length}`;}

/** Logical map movement. Rendering and camera changes never affect navigation. */
export class MapController {
 constructor(document,{execution='worker',onEvent,onError}={}){
  this.map=structuredClone(assertMap(document));this.index=new MapIndex(this.map);this.signature=signature(this.map);
  this.actorPadding=this.map.actors.reduce((pad,actor)=>{const look=actor.appearance,spec=look?.image&&this.map.art?.images?.[look.image];return Math.max(pad,(Math.max(spec?.width??64,spec?.height??94)+36)*(look?.scale??1)*this.map.tileSize.width/64);},64);
  this.actors=new Map(this.map.actors.map(a=>[a.id,{...a,facing:Math.PI/4,travelFacing:Math.PI/4,gaitWeight:0,gait:'walk',running:false,walking:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,phase:0,turning:false,lift:0,traversalAction:null,traversalProgress:0,supportContact:null,lastGround:{x:a.x,y:a.y}}]));
  this.actorChunks=new Map();this.actorChunkKeys=new Map();for(const actor of this.actors.values())this.indexActor(actor);
  this.objects=Object.create(null);this.active=new Map();this.listeners=new Set();this.serial=0;this.disposed=false;this.timer=null;this.onError=onError;if(onEvent)this.listeners.add(onEvent);
  this.afterVault=new Map();
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
 get isMoving(){return [...this.active.values()].some(job=>job.route||job.skid||job.jump||job.roll);}
 actorPosition(id){const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');return {...actor};}
 indexActor(actor){const key=Math.floor(actor.x/16)+','+Math.floor(actor.y/16),old=this.actorChunkKeys.get(actor.id);if(old===key)return;if(old){const bucket=this.actorChunks.get(old);bucket.delete(actor.id);if(!bucket.size)this.actorChunks.delete(old);}if(!this.actorChunks.has(key))this.actorChunks.set(key,new Set());this.actorChunks.get(key).add(actor.id);this.actorChunkKeys.set(actor.id,key);}

 emit(event){for(const listener of this.listeners)try{listener(event);}catch(error){try{this.onError?.(error);}catch{}}}
 fail(error){this.failed=error;this.rejectReady?.(error);for(const job of [...this.active.values()])this.finish(job,error);this.worker?.terminate();clearTimeout(this.timer);this.timer=null;try{this.onError?.(error);}catch{}this.emit({type:'map.error',message:error.message});}
 actor(id){this.check();if(!this.actors.has(id))throw Error('Unknown map actor.');return {moveTo:(target,options)=>this.moveTo(id,target,options),faceTo:(target,options)=>this.faceTo(id,target,options),cancel:()=>this.cancel(id)};}
 deferVault(id,run,signal){
  this.clearDeferred(id);
  return new Promise((resolve,reject)=>{const abort=()=>{this.afterVault.delete(id);reject(abortError('Queued movement cancelled.'));};this.afterVault.set(id,{run:()=>{signal?.removeEventListener('abort',abort);try{Promise.resolve(run()).then(resolve,reject);}catch(e){reject(e);}},reject,signal,abort});signal?.addEventListener('abort',abort,{once:true});});
 }
 clearDeferred(id){const pending=this.afterVault.get(id);if(pending){this.afterVault.delete(id);pending.signal?.removeEventListener('abort',pending.abort);pending.reject(abortError('Queued movement replaced.'));}}
 faceTo(id,target,{signal}={}){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(!point(target))throw TypeError('Facing target must be a finite ground point.');
  if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('Expected AbortSignal.');
  if(signal?.aborted)return Promise.reject(abortError('Turning cancelled.'));
  if(actor.jumping||actor.rolling)return this.deferVault(id,()=>this.faceTo(id,target,{signal}),signal);
  if(this.active.size>=16&&!this.active.has(id))return Promise.reject(Error('At most 16 map movements may be active.'));
  const previous=this.active.get(id),request='map-'+(++this.serial);let job;
  const promise=new Promise((resolve,reject)=>{const abort=()=>this.cancelRequest(id,request);job={kind:'face',actor:id,request,target:{...target},heading:Math.hypot(target.x-actor.x,target.y-actor.y)<1e-7?actor.facing:Math.atan2(target.y-actor.y,target.x-actor.x),route:[],resolve,reject,signal,abort};signal?.addEventListener('abort',abort,{once:true});this.active.set(id,job);});
  promise.catch(()=>{});if(previous)this.finish(previous,abortError('Movement replaced.'));
  Object.assign(actor,{walking:false,running:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,turning:true,gaitWeight:0,lift:0});
  this.emit({type:'map.turn.started',actor:id,request,target:job.target});return promise;
 }
 moveTo(id,target,{signal,gait='walk'}={}){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(gait!=='walk'&&gait!=='run')throw TypeError('Map gait must be walk or run.');
  if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw Error('Expected AbortSignal.');
  const prop=typeof target==='string'?this.index.prop(target):null;
  if(typeof target==='string'&&!prop)throw Error('Unknown map object.');
  if(!prop&&(!point(target)||target.x<0||target.y<0||target.x>=this.map.width||target.y>=this.map.height))throw Error('Map destination must be inside the grid.');
  const continuous=this.map.navigation?.mode==='continuous',manual=prop&&traversalActivation(prop)==='click'?manualTraversalPlan(this.index,prop,actor):null;
  if(prop&&traversalActivation(prop)==='click'&&!manual)return Promise.reject(Error('Traversal exit is blocked.'));
  const destination=prop?null:continuous?{x:target.x,y:target.y}:cell(target);
  const goals=manual?[manual.entry]:prop?approachTiles(this.map,this.index,prop):[destination];
  if(!goals.length||goals.every(p=>continuous?this.index.isPointBlocked(p.x,p.y):this.index.isBlocked(p.x,p.y)))return Promise.reject(Error('Destination is blocked or has no accessible approach.'));
  if(signal?.aborted)return Promise.reject(abortError('Movement cancelled.'));
  if(actor.jumping||actor.rolling){
   const active=this.active.get(id),heading=Math.atan2(goals[0].y-actor.y,goals[0].x-actor.x);
   if(active?.jump&&active.gait==='run'&&Math.abs(angleDelta(active.jump.heading,heading))>.35)active.rollOnLand=true;
   return this.deferVault(id,()=>this.moveTo(id,target,{signal,gait}),signal);
  }
  if(this.active.size>=16&&!this.active.has(id))return Promise.reject(Error('At most 16 map movements may be active.'));
  // Reject invalid destinations before replacing a valid movement.
  const previous=this.active.get(id),request='map-'+(++this.serial);let job;
  const momentum=previous?.skid?.velocity??previous?.motion,velocity=momentum?Math.hypot(momentum.x,momentum.y):0;
  const desired=Math.atan2(goals[0].y-actor.y,goals[0].x-actor.x);
  const skid=this.map.navigation?.mode==='continuous'&&previous?.gait==='run'&&velocity>.15&&(previous.skid||Math.abs(angleDelta(Math.atan2(momentum.y,momentum.x),desired))>.45)
   ?{velocity:{...momentum},deceleration:actor.speed*1.8*3.5}:null;
  const promise=new Promise((resolve,reject)=>{const abort=()=>this.cancelRequest(id,request);job={actor:id,request,gait,skid,target:typeof target==='string'?target:destination,prop,goals,manualTraversal:manual,start:{x:actor.x,y:actor.y},resolve,reject,signal,abort,route:null,index:1,velocity:0,allowVault:!manual};signal?.addEventListener('abort',abort,{once:true});this.active.set(id,job);});
  promise.catch(()=>{});if(previous)this.finish(previous,abortError('Movement replaced.'));if(this.active.get(id)!==job)return promise;actor.walking=!!skid;actor.running=!!skid;actor.skidding=!!skid;actor.turning=false;if(!skid)actor.gaitWeight=0;actor.gait=gait;this.emit({type:'map.move.started',actor:id,request,target:job.target,gait});
  if(!skid)this.requestPath(job);
  return promise;
 }
 requestPath(job){
  this.ready.then(()=>{if(this.disposed||this.active.get(job.actor)!==job)return;if(this.worker)this.worker.postMessage({type:'path',request:job.request,start:job.start,goals:job.goals,allowVault:job.allowVault!==false});else{job.planning=true;this.schedulePaths();}}).catch(error=>this.finish(job,error));
 }
 advanceSkid(job,dt){
  const actor=this.actors.get(job.actor),result=brakeMapMotion(this.index,actor,job.skid.velocity,dt,job.skid.deceleration,this.map.navigation.radius);
  actor.x=result.x;actor.y=result.y;job.skid.velocity=result.velocity;
  const target=job.goals[0],heading=Math.atan2(target.y-actor.y,target.x-actor.x),turn=angleDelta(actor.facing,heading);
  actor.facing+=Math.max(-5*dt,Math.min(5*dt,turn));
  actor.gaitWeight=dt?Math.min(1,result.travelled/(dt*actor.speed*1.8)):actor.gaitWeight;
  actor.lastGround={x:actor.x,y:actor.y};this.indexActor(actor);
  // Plan from the actual stopping point, never a stale pre-slide position.
  if(Math.hypot(result.velocity.x,result.velocity.y)<.01){
   job.skid=null;job.motion=null;job.start={x:actor.x,y:actor.y};actor.skidding=false;actor.walking=false;actor.running=false;actor.gaitWeight=0;this.requestPath(job);
  }
 }
 advanceJump(job,dt){
  const actor=this.actors.get(job.actor),jump=job.jump;
  jump.elapsed=Math.min(jump.duration,jump.elapsed+dt);const p=jump.elapsed/jump.duration;
  const travel=jump.style==='branch'?(p<.2?p*.3:p<.6?.06+(p-.2)*1.5:.66+(p-.6)*.85):p;
  actor.x=jump.start.x+(jump.landing.x-jump.start.x)*travel;actor.y=jump.start.y+(jump.landing.y-jump.start.y)*travel;
  const arc=jump.action?.startsWith('climb-')?Math.sin(Math.PI*p)*Math.min(.12,jump.height*.08):4*jump.height*p*(1-p);
  actor.lift=Math.max(0,jump.startZ+(jump.endZ-jump.startZ)*travel+arc-groundHeight(this.map,actor));
  actor.jumpProgress=p;actor.traversalProgress=p;actor.facing=actor.travelFacing=jump.heading;actor.gaitWeight=0;
  actor.supportContact=jump.style==='branch'&&p>=.2&&p<=.62&&jump.supportPoint?{...jump.supportPoint}:null;
  this.indexActor(actor);
  if(p<1)return;
  actor.lift=0;actor.jumping=false;actor.vaultId=null;actor.traversalAction=null;actor.traversalProgress=0;actor.supportContact=null;actor.lastGround={x:actor.x,y:actor.y};
  job.jump=null;job.motion=null;job.velocity=0;
  // Establish recovery before delivering the landing event: callbacks may redirect.
  if(job.rollOnLand){
   const speed=Math.hypot(jump.landing.x-jump.start.x,jump.landing.y-jump.start.y)/jump.duration;
   job.roll={elapsed:0,duration:.85,velocity:{x:Math.cos(jump.heading)*speed*.65,y:Math.sin(jump.heading)*speed*.65},deceleration:speed*1.3};
   actor.rolling=true;actor.rollProgress=0;actor.walking=false;actor.running=false;
  }
  this.emit({type:'map.vault.landed',actor:actor.id,object:jump.object,x:actor.x,y:actor.y});
  if(this.active.get(actor.id)!==job)return;
  if(jump.manual){
   if(job.stopAfterVault)this.finish(job,abortError('Movement cancelled after landing.'));else this.arrive(job);
   const pending=this.afterVault.get(actor.id);if(pending){this.afterVault.delete(actor.id);pending.run();}return;
  }
  if(job.roll)this.emit({type:'map.roll.started',actor:actor.id,facing:jump.heading});
  else this.resumeAfterTraversal(job);
 }
 advanceRoll(job,dt){
  const actor=this.actors.get(job.actor),roll=job.roll;
  const result=brakeMapMotion(this.index,actor,roll.velocity,dt,roll.deceleration,this.map.navigation.radius);
  actor.x=result.x;actor.y=result.y;roll.velocity=result.velocity;roll.elapsed=Math.min(roll.duration,roll.elapsed+dt);
  actor.rollProgress=roll.elapsed/roll.duration;actor.lastGround={x:actor.x,y:actor.y};this.indexActor(actor);
  if(roll.elapsed<roll.duration)return;
  job.roll=null;actor.rolling=false;actor.rollProgress=0;
  this.emit({type:'map.roll.finished',actor:actor.id,x:actor.x,y:actor.y});
  if(this.active.get(actor.id)===job)this.resumeAfterTraversal(job);
 }
 resumeAfterTraversal(job){
  const actor=this.actors.get(job.actor),pending=this.afterVault.get(actor.id);
  if(pending){this.afterVault.delete(actor.id);pending.run();return;}
  if(job.stopAfterVault){this.finish(job,abortError('Movement cancelled after landing.'));return;}
  job.route=null;job.start={x:actor.x,y:actor.y};actor.walking=false;actor.running=false;actor.gaitWeight=0;this.requestPath(job);
 }
 schedulePaths(){
  if(this.timer!==null||this.disposed)return;
  this.timer=setTimeout(()=>{
   this.timer=null;const deadline=performance.now()+2,pending=[...this.active.values()].filter(j=>j.planning||j.preparation);let allocated=pending.filter(j=>j.pathJob).length;
   for(const job of pending){if(allocated>=4)break;if(job.planning&&!job.pathJob){try{job.pathJob=new (this.map.navigation?.mode==='continuous'?MapNavigationJob:MapPathJob)(this.map,this.index,job.start,job.goals,{allowVault:job.allowVault!==false});allocated++;}catch(error){job.planning=false;this.finish(job,error);}}}
   const ready=pending.filter(j=>j.pathJob||j.preparation);this.pathCursor=(this.pathCursor??0)%Math.max(1,ready.length);
   for(let i=0;i<ready.length;i++){
    const job=ready[(this.pathCursor+i)%ready.length];
    if(this.active.get(job.actor)!==job)continue;
    if(job.preparation){if(job.preparation.step(64))this.completePreparation(job);}
    else if(job.pathJob){const result=job.pathJob.step(64);if(result.status!=='pending'){job.pathJob=null;job.planning=false;this.accept(job,result);}}
    if(performance.now()>=deadline){this.pathCursor=(this.pathCursor+i+1)%ready.length;break;}
   }
   if([...this.active.values()].some(j=>j.planning||j.preparation))this.schedulePaths();
  },0);
 }
 accept(job,result){
  if(this.active.get(job.actor)!==job)return;
  this.stats.expanded+=result.visited??0;
  if(result.status!=='complete'||!result.path?.length){this.finish(job,Error(result.reason||'No route to destination.'));return;}
  const actor=this.actors.get(job.actor);
  job.preparation=new MapRoutePreparation(this.index,actor,result.path,{allowVault:job.allowVault!==false});this.schedulePaths();
 }
 completePreparation(job){
  if(this.active.get(job.actor)!==job)return;
  const prepared=job.preparation,actor=this.actors.get(job.actor);
  job.route=prepared.route;job.routeChunks=prepared.routeChunks;job.remaining=prepared.remaining;job.index=1;job.preparation=null;
  job.routeOffsets=new Array(job.route.length).fill(0);for(let i=1;i<job.route.length;i++)job.routeOffsets[i]=job.routeOffsets[i-1]+Math.hypot(job.route[i].x-job.route[i-1].x,job.route[i].y-job.route[i-1].y);
  actor.walking=job.route.length>1;actor.gait=job.gait;actor.running=actor.walking&&job.gait==='run';
  this.emit({type:'map.route.ready',actor:job.actor,request:job.request,points:job.route.length,gait:job.gait});
  if(job.route.length===1&&this.active.get(job.actor)===job)this.reachDestination(job);
 }

 beginManualTraversal(job){
  const actor=this.actors.get(job.actor),jump=manualTraversalPlan(this.index,job.prop,actor);
  if(!jump||Math.hypot(actor.x-jump.entry.x,actor.y-jump.entry.y)>.08){this.finish(job,Error('Traversal exit became blocked.'));return;}
  jump.start={x:actor.x,y:actor.y};jump.startZ=groundHeight(this.map,actor);job.jump=jump;job.route=null;job.motion=null;job.velocity=0;
  Object.assign(actor,{jumping:true,jumpProgress:0,vaultId:jump.object,traversalAction:jump.action,traversalProgress:0,facing:jump.heading,travelFacing:jump.heading,walking:false,running:false});
  this.emit({type:'map.traversal.started',actor:actor.id,object:jump.object,action:jump.action,x:actor.x,y:actor.y});
 }
 reachDestination(job){if(job.manualTraversal)this.beginManualTraversal(job);else this.arrive(job);}

 cancelRequest(id,request){const job=this.active.get(id);if(job?.request===request){if(this.actors.get(id).jumping||this.actors.get(id).rolling)job.stopAfterVault=true;else this.finish(job,abortError('Movement cancelled.'));}}
 cancel(id){this.clearDeferred(id);const job=this.active.get(id);if(job)this.cancelRequest(id,job.request);}
 finish(job,error,event){if(job.done)return;job.done=true;if(this.active.get(job.actor)===job){this.active.delete(job.actor);Object.assign(this.actors.get(job.actor),{walking:false,running:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,gait:'walk',gaitWeight:0,turning:false,lift:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null});}job.signal?.removeEventListener('abort',job.abort);if(error){this.worker?.postMessage({type:'cancel',request:job.request});job.reject(error);this.emit({type:error.name==='AbortError'?'map.command.cancelled':'map.command.failed',actor:job.actor,request:job.request,message:error.message});}else{job.resolve(event);this.emit(event);}}
 arrive(job){const actor=this.actors.get(job.actor),event={type:'map.actor.arrived',actor:job.actor,request:job.request,target:job.target,x:actor.x,y:actor.y,gait:job.gait};if(job.prop?.kind==='chest')Object.defineProperty(this.objects,job.prop.id,{value:{opened:true},enumerable:true,configurable:true,writable:true});this.finish(job,null,event);if(job.prop&&!this.disposed)this.emit({type:'map.object.interacted',actor:job.actor,object:job.prop.id,kind:job.prop.kind,request:job.request});}
 advance(dt){
  this.check();if(!Number.isFinite(dt)||dt<0)throw Error('Map step must be finite and nonnegative.');dt=Math.min(dt,.1);
  for(const job of [...this.active.values()]){
   if(this.active.get(job.actor)!==job)continue;
   if(job.jump){this.advanceJump(job,dt);continue;}
   if(job.roll){this.advanceRoll(job,dt);continue;}
   if(job.skid){this.advanceSkid(job,dt);continue;}
   if(!job.route)continue;
   if(job.kind==='face'){
    const actor=this.actors.get(job.actor),delta=angleDelta(actor.facing,job.heading);actor.facing+=Math.max(-7*dt,Math.min(7*dt,delta));
    if(Math.abs(delta)<=7*dt+1e-8)this.finish(job,null,{type:'map.actor.faced',actor:job.actor,request:job.request,facing:actor.facing});
    continue;
   }
   const actor=this.actors.get(job.actor),startX=actor.x,startY=actor.y,speed=(actor.speed??3.5)*(job.gait==='run'?1.8:1),acceleration=speed*5;
   if(this.map.navigation?.mode==='continuous'&&job.allowVault!==false){
    const jump=planMapVault(this.index,actor,job.route,job.index,job.gait);
    if(jump&&job.velocity>speed*.4&&Math.abs(angleDelta(actor.facing,jump.heading))<.6){
     job.jump=jump;actor.jumping=true;actor.jumpProgress=0;actor.vaultId=jump.object;actor.traversalAction=jump.action;actor.traversalProgress=0;actor.facing=actor.travelFacing=jump.heading;
     this.emit({type:'map.vault.started',actor:actor.id,object:jump.object,x:actor.x,y:actor.y,gait:job.gait});
     if(this.active.get(actor.id)===job)this.advanceJump(job,dt);continue;
    }
   }
   // Each integration step covers at most .04 cells and 1/120 second. Turns
   // therefore constrain movement through curves even at the maximum speed.
   const frequency=120*Math.max(1,Math.ceil(speed/(.04*120))),steps=Math.max(1,Math.ceil(dt*frequency)),h=dt/steps;
   let travelled=0;
   for(let n=0;n<steps&&job.index<job.route.length;n++){
    if(!job.route)break;
    const target=job.route[job.index],direct=Math.atan2(target.y-actor.y,target.x-actor.x),ahead=angleDelta(direct,routeHeading(actor,job.route,job.index));
    const heading=direct+Math.max(-.35,Math.min(.35,ahead)),error=angleDelta(actor.facing,heading),maxTurn=7*h;
    actor.facing+=Math.max(-maxTurn,Math.min(maxTurn,error));
    const alignment=Math.max(0,Math.cos(angleDelta(actor.facing,heading)));
    job.velocity=Math.min(speed,job.velocity+acceleration*h,Math.sqrt(Math.max(0,2*acceleration*job.remaining)));
    let travel=Math.min(job.remaining,Math.max(.01,job.velocity)*h*alignment*alignment);
    while(job.index<job.route.length&&travel>0){
     const p=job.route[job.index],dx=p.x-actor.x,dy=p.y-actor.y,d=Math.hypot(dx,dy),length=Math.min(travel,d);
     // A rejected rounding can leave a sharp corner. Never advance backwards
     // into its next segment merely because look-ahead spans that corner.
     // Keep translation within 38 degrees of body facing while it turns.
     if(d>1e-9&&Math.abs(angleDelta(actor.facing,Math.atan2(dy,dx)))>.65)break;
     if(d>1e-9&&this.map.navigation?.mode==='continuous'&&!continuousSegmentClear(this.index,actor,{x:actor.x+dx/d*length,y:actor.y+dy/d*length},this.map.navigation.radius)){
      // A short runway or blocked landing means detour, never walk through a rock.
      job.allowVault=false;job.route=null;job.start={x:actor.x,y:actor.y};actor.walking=false;actor.running=false;job.velocity=0;this.requestPath(job);break;
     }
     if(d>1e-9){actor.x+=dx/d*length;actor.y+=dy/d*length;actor.phase=(actor.phase+length*Math.PI*2/((actor.stride??1)*(actor.running?1.4:1)))%(Math.PI*2);actor.travelFacing=Math.atan2(dy,dx);}
     travel-=length;travelled+=length;job.remaining=Math.max(0,job.remaining-length);
     if(d-length<1e-7){actor.x=p.x;actor.y=p.y;job.index++;}else break;
    }
   }
   job.motion=dt>0?{x:(actor.x-startX)/dt,y:(actor.y-startY)/dt}:job.motion;
   actor.gaitWeight=dt>0?Math.min(1,travelled/(dt*speed)):0;
   if(!this.index.isPointBlocked(actor.x,actor.y,this.map.navigation?.radius??0))actor.lastGround={x:actor.x,y:actor.y};
   this.indexActor(actor);
   if(this.active.get(job.actor)===job&&job.route&&job.index>=job.route.length){this.reachDestination(job);const pending=this.afterVault.get(actor.id);if(pending&&!job.jump){this.afterVault.delete(actor.id);pending.run();}}
  }
 }

 step(dt){this.advance(dt);return this.frame();}
 visibleFrame(rect,props=[],{routeActor}={}){
  this.check();if(!point(rect)||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)throw Error('Invalid map viewport.');
  const pad=Math.max(this.actorPadding,this.map.tileSize.width),left=rect.x-pad,top=rect.y-pad,right=rect.x+rect.width+pad,bottom=rect.y+rect.height+pad;
  const corners=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].map(p=>unprojectMap(this.map,p));
  const x0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))/16)),x1=Math.min(Math.floor((this.map.width-1)/16),Math.floor(Math.max(...corners.map(p=>p.x))/16));
  const y0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))/16)),y1=Math.min(Math.floor((this.map.height-1)/16),Math.floor(Math.max(...corners.map(p=>p.y))/16));
  const actors=[],routeSegments=[],jobs=[...this.active.values()],job=jobs.find(j=>j.kind!=='face'&&(routeActor===undefined||j.actor===routeActor)),segments=new Set();let candidateActors=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const key=x+','+y;
   for(const id of this.actorChunks.get(key)||[]){candidateActors++;const a=this.actors.get(id),p=projectMap(this.map,a);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)actors.push({...a});}
   for(const i of job?.routeChunks?.get(key)||[])if(job?.route&&i>=job.index)segments.add(i);
  }
  for(const i of [...segments].sort((a,b)=>a-b)){const from=i===job.index?this.actors.get(job.actor):job.route[i-1],to=job.route[i],a=projectMap(this.map,from),b=projectMap(this.map,to);if(Math.max(a.x,b.x)>=left&&Math.min(a.x,b.x)<=right&&Math.max(a.y,b.y)>=top&&Math.min(a.y,b.y)<=bottom)routeSegments.push({from:{x:from.x,y:from.y},to:{...to},offset:(job.routeOffsets?.[i-1]??0)+(i===job.index?Math.hypot(from.x-job.route[i-1].x,from.y-job.route[i-1].y):0)});}
  if(job?.manualTraversal&&job.route){const from=job.manualTraversal.entry,to=job.manualTraversal.landing;routeSegments.push({from:{...from},to:{...to},offset:job.routeOffsets?.at(-1)??0});}
  if(job?.jump){const from={x:this.actors.get(job.actor).x,y:this.actors.get(job.actor).y},to=job.jump.landing;routeSegments.push({from,to:{...to},offset:0});}
  const objects=Object.create(null);for(const p of props)if(Object.hasOwn(this.objects,p.id))objects[p.id]={...this.objects[p.id]};
  return {actors,objects,route:null,routeSegments,destination:movementDestination(job),pending:jobs.filter(j=>!j.route&&!j.jump).length,candidateActors,candidateRouteSegments:segments.size};
 }
 frame(){const jobs=[...this.active.values()],job=jobs.find(j=>j.kind!=='face');this.stats.pending=jobs.filter(j=>!j.route&&!j.jump).length;return {actors:[...this.actors.values()].map(a=>({...a,supportContact:a.supportContact?{...a.supportContact}:null})),objects:structuredClone(this.objects),route:job?.route?.map(p=>({...p}))??null,destination:movementDestination(job),pending:this.stats.pending};}
 snapshot(){this.check();return {format:'posecraft-map-state',version:1,map:this.signature,actors:[...this.actors.values()].map(a=>({id:a.id,x:(a.jumping||a.lift>0?a.lastGround:null)?.x??a.x,y:(a.jumping||a.lift>0?a.lastGround:null)?.y??a.y,facing:a.facing})),objects:structuredClone(this.objects)};}
 restore(input){
  this.check();const state=structuredClone(input);
  if(state?.format!=='posecraft-map-state'||state.version!==1||state.map!==this.signature||!Array.isArray(state.actors)||state.actors.length!==this.actors.size||!state.objects||typeof state.objects!=='object'||Array.isArray(state.objects))throw Error('Incompatible map save.');
  const ids=new Set();
  for(const a of state.actors){if(!a||!this.actors.has(a.id)||ids.has(a.id)||!point(a)||!Number.isFinite(a.facing)||a.x<0||a.y<0||a.x>=this.map.width||a.y>=this.map.height||(this.map.navigation?.mode==='continuous'?this.index.isPointBlocked(a.x,a.y):this.index.isBlocked(a.x,a.y)))throw Error('Invalid saved actor position.');ids.add(a.id);}
  for(const [id,value]of Object.entries(state.objects))if(this.index.prop(id)?.kind!=='chest'||!value||typeof value!=='object'||Array.isArray(value)||value.opened!==true||Object.keys(value).some(k=>k!=='opened'))throw Error('Invalid saved object state.');
  this.restoring=true;
  try{
   for(const id of this.afterVault.keys())this.clearDeferred(id);for(const job of [...this.active.values()])this.finish(job,abortError('Map restored.'));
   for(const a of state.actors){Object.assign(this.actors.get(a.id),{x:a.x,y:a.y,facing:a.facing,travelFacing:a.facing,gaitWeight:0,gait:'walk',running:false,walking:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,phase:0,turning:false,lift:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,lastGround:{x:a.x,y:a.y}});this.indexActor(this.actors.get(a.id));}
   this.objects=Object.assign(Object.create(null),state.objects);
  }finally{this.restoring=false;}
  this.emit({type:'map.restored'});return this.frame();
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const id of this.afterVault.keys())this.clearDeferred(id);for(const job of [...this.active.values()])this.finish(job,abortError('Map disposed.'));clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.rejectReady?.(abortError('Map disposed.'));this.listeners.clear();}
}
