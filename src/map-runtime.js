import {MapNavigationJob} from './map-navigation.js';
import {continuousSegmentClear,mapWaterDepth} from './map-collision.js';
import {planMapVault} from './map-vault.js';
import {manualTraversalPlan} from './map-traversal.js';
import {groundHeight} from './map-art-layout.js';
import {terrainHeightOffset} from './map-cliffs.js';
import {MapRoutePreparation,routeHeading,angleDelta,brakeMapMotion} from './map-motion.js';
import {assertMap,MapIndex,MapPathJob,approachTiles,projectMap,unprojectMap} from './map.js';

const abortError=message=>Object.assign(new Error(message),{name:'AbortError'});
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const cell=p=>({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5});
const now=()=>(globalThis.performance?.now()??Date.now())/1000;
const movementDestination=job=>job?(job.manualTraversal?.landing??job.route?.at(-1)??job.goals?.[0]??null):null;
function signature(map){let hash=2166136261;const fields=[map.width,map.height,map.tileSize,map.terrain,map.props,map.actors];if(map.navigation)fields.push(map.navigation);if(map.elevations!==undefined)fields.push(map.elevations);if(map.terraces!==undefined)fields.push(map.terraces);const text=JSON.stringify(fields);for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return `map1-${map.id}-${(hash>>>0).toString(16)}-${text.length}`;}

/** Logical map movement. Rendering and camera changes never affect navigation. */
export class MapController {
 constructor(document,{execution='worker',onEvent,onError}={}){
  this.map=structuredClone(assertMap(document));this.index=new MapIndex(this.map);this.signature=signature(this.map);
  this.actorPadding=this.map.actors.reduce((pad,actor)=>{const look=actor.appearance,spec=look?.image&&this.map.art?.images?.[look.image];return Math.max(pad,(Math.max(spec?.width??64,spec?.height??94)+36)*(look?.scale??1)*this.map.tileSize.width/64);},64);
  this.actors=new Map(this.map.actors.map(a=>[a.id,{...a,facing:Math.PI/4,travelFacing:Math.PI/4,gaitWeight:0,gait:'walk',running:false,walking:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,phase:0,turning:false,lift:0,traversalAction:null,traversalProgress:0,supportContact:null,swimming:false,swimDepth:0,lastGround:{x:a.x,y:a.y}}]));
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
 actor(id){this.check();if(!this.actors.has(id))throw Error('Unknown map actor.');return {moveTo:(target,options)=>this.moveTo(id,target,options),faceTo:(target,options)=>this.faceTo(id,target,options),steer:(direction,options)=>this.steer(id,direction,options),jump:()=>this.jump(id),cancel:()=>this.cancel(id)};}
 /**
  * Direct control along a map-space direction, such as from held keys. The
  * actor accelerates, slides along obstacles and vaults low crossings until
  * steered with `null`, then slows to a stop. Resolves once it has stopped.
  */
 steer(id,direction,{gait='walk'}={}){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(gait!=='walk'&&gait!=='run')throw TypeError('Map gait must be walk or run.');
  if(direction!==null&&!point(direction))throw TypeError('Steering direction must be null or a finite map vector.');
  const length=direction?Math.hypot(direction.x,direction.y):0,input=length>1e-9?{x:direction.x/length,y:direction.y/length}:null;
  let job=this.active.get(id);
  // Held keys take over from a swim to the shore, dropping the queued route.
  if(job?.kind==='steer'&&!job.goal){job.input=input;job.gait=gait;return job.promise;}
  if(!input)return Promise.resolve(null);
  if(actor.jumping||actor.rolling)return this.deferVault(id,()=>this.steer(id,direction,{gait}),undefined);
  if(this.active.size>=16&&!job)return Promise.reject(Error('At most 16 map movements may be active.'));
  job=this.startSteer(id,input,gait);return job.promise;
 }
 startSteer(id,input,gait){
  const previous=this.active.get(id),request='map-'+(++this.serial),momentum=previous?.skid?.velocity??previous?.motion;let job;
  // Steered people can wade and swim in open water; animals stay ashore.
  const swims=this.actors.get(id).appearance?.kind!=='livestock';
  const promise=new Promise((resolve,reject)=>{job={kind:'steer',actor:id,request,gait,input,swims,velocity:momentum?{x:momentum.x,y:momentum.y}:{x:0,y:0},route:[],resolve,reject};this.active.set(id,job);});
  promise.catch(()=>{});job.promise=promise;
  this.clearDeferred(id);if(previous)this.finish(previous,abortError('Movement replaced.'));this.active.set(id,job);
  Object.assign(this.actors.get(id),{turning:false,skidding:false,gait});
  this.emit({type:'map.move.started',actor:id,request,target:null,gait,steering:true});return job;
 }
 /** A hop in place or along the current motion. False while already airborne. */
 jump(id){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(actor.jumping||actor.rolling||actor.swimDepth>0)return false;
  let job=this.active.get(id);
  if(job?.ledge){if(job.ledge.phase!=='hang')return false;job.ledge.phase='climb';job.ledge.elapsed=0;actor.traversalAction='climb-ledge';actor.traversalProgress=0;this.emit({type:'map.ledge.climb',actor:id,request:job.request});return true;}
  const facing=job?.kind==='steer'&&job.input?job.input:{x:Math.cos(actor.facing),y:Math.sin(actor.facing)},ledge=this.findLedge(actor,facing);
  if(ledge){if(!job||job.kind!=='steer'){if(this.active.size>=16&&!job)return false;job=this.startSteer(id,null,job?.gait??'walk');}this.grabLedge(job,actor,ledge);return true;}
  if(job?.kind!=='steer'){if(this.active.size>=16&&!job)return false;job=this.startSteer(id,null,job?.gait??'walk');}
  const v=job.velocity,speed=Math.hypot(v.x,v.y),duration=job.gait==='run'?.62:.56,heading=speed>.05?Math.atan2(v.y,v.x):actor.facing;
  const radius=this.map.navigation?.radius??0,start={x:actor.x,y:actor.y},reach={x:start.x+v.x*duration*.8,y:start.y+v.y*duration*.8};
  // Land at the farthest clear point along the hop. Low crossings can be cleared.
  // Hops may land in water when the actor can swim.
  const clear=to=>this.steerClear(start,to,radius,{allowVault:true,allowWater:job.swims})&&this.steerClear(to,to,radius,{allowWater:job.swims});
  let landing=start;
  if(clear(reach))landing=reach;
  else{let low=0,high=1;for(let n=0;n<10;n++){const t=(low+high)/2,to={x:start.x+(reach.x-start.x)*t,y:start.y+(reach.y-start.y)*t};if(clear(to))low=t;else high=t;}landing={x:start.x+(reach.x-start.x)*low,y:start.y+(reach.y-start.y)*low};}
  job.jump={hop:true,start,landing,startZ:groundHeight(this.map,actor),endZ:groundHeight(this.map,landing),height:.42,duration,elapsed:0,heading,style:'hop',action:null,object:null};
  Object.assign(actor,{jumping:true,jumpProgress:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,facing:heading,travelFacing:heading,walking:false,running:false});
  this.emit({type:'map.jump.started',actor:id,request:job.request,x:actor.x,y:actor.y});return true;
 }
 /**
  * A cliff edge straight ahead that the actor can reach by jumping: the wall
  * must rise within reach and the top must have room to stand.
  */
 findLedge(actor,direction){
  if(!this.map.terraces?.length)return null;
  const length=Math.hypot(direction.x,direction.y);if(length<1e-9)return null;
  const ux=direction.x/length,uy=direction.y/length,here=terrainHeightOffset(this.map,actor),radius=this.map.navigation?.radius??0;
  for(let s=.02;s<=.7;s+=.02){
   const p={x:actor.x+ux*s,y:actor.y+uy*s},level=terrainHeightOffset(this.map,p);if(level===here)continue;
   if(level<here)return null;
   // Snap to the crossed cell edge so the hands meet the wall square-on.
   const fx=Math.floor(p.x)!==Math.floor(actor.x+ux*(s-.02)),normal=fx?{x:Math.sign(ux),y:0}:{x:0,y:Math.sign(uy)};
   const edge=fx?{x:Math.round(p.x),y:p.y}:{x:p.x,y:Math.round(p.y)};
   const base={x:edge.x-normal.x*(radius+.06),y:edge.y-normal.y*(radius+.06)},top={x:edge.x+normal.x*.42,y:edge.y+normal.y*.42};
   const tile=this.map.tileSize.height,clip=this.map.art?.actors?.[actor.id]?.idle,spec=clip&&this.map.art.images[clip.image];
   const reach=(spec?spec.height*spec.anchorY:50)*1.12*this.map.tileSize.width/64/tile,wall=groundHeight(this.map,top)-groundHeight(this.map,base);
   if(wall>reach*1.75||wall<=.2)return null;
   if(!continuousSegmentClear(this.index,top,top,radius,{ignoreCliffs:true})||!continuousSegmentClear(this.index,actor,base,radius))return null;
   const lip={x:edge.x+normal.x*.02,y:edge.y+normal.y*.02,z:groundHeight(this.map,top)};
   return{base,top,lip,heading:Math.atan2(normal.y,normal.x),hang:Math.max(0,wall-reach),wall};
  }
  return null;
 }
 grabLedge(job,actor,ledge){
  job.ledge={...ledge,phase:'grab',elapsed:0,from:{x:actor.x,y:actor.y}};job.velocity={x:0,y:0};job.motion={x:0,y:0};
  Object.assign(actor,{walking:false,running:false,jumping:true,jumpProgress:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,facing:ledge.heading,travelFacing:ledge.heading});
  this.emit({type:'map.ledge.grab',actor:actor.id,request:job.request,x:actor.x,y:actor.y});
 }
 /** Let go of a ledge and drop back to the foot of the wall. */
 release(id){
  this.check();const job=this.active.get(id);if(!job?.ledge||job.ledge.phase!=='hang')return false;
  job.ledge.phase='drop';job.ledge.elapsed=0;job.ledge.dropFrom=this.actors.get(id).lift;
  Object.assign(this.actors.get(id),{traversalAction:null,ledgeContact:null,jumping:true,jumpProgress:.6});this.emit({type:'map.ledge.release',actor:id,request:job.request});return true;
 }
 advanceLedge(job,dt){
  const actor=this.actors.get(job.actor),ledge=job.ledge;ledge.elapsed+=dt;
  const ground=()=>groundHeight(this.map,actor);
  if(ledge.phase==='grab'){
   // Jump up the wall: settle against it, then rise until the hands catch the edge.
   const p=Math.min(1,ledge.elapsed/.32),ease=1-(1-p)*(1-p);
   actor.x=ledge.from.x+(ledge.base.x-ledge.from.x)*Math.min(1,p*2);actor.y=ledge.from.y+(ledge.base.y-ledge.from.y)*Math.min(1,p*2);
   actor.lift=ledge.hang*ease+Math.sin(p*Math.PI)*.12;actor.jumpProgress=p*.5;this.indexActor(actor);
   if(p>=1){ledge.phase='hang';ledge.elapsed=0;Object.assign(actor,{jumping:false,jumpProgress:0,traversalAction:'hang',traversalProgress:0,lift:ledge.hang,ledgeContact:{...ledge.lip}});this.emit({type:'map.ledge.hang',actor:actor.id,request:job.request});}
   return;
  }
  if(ledge.phase==='hang'){actor.traversalProgress=(ledge.elapsed/1.2)%1;return;}
  if(ledge.phase==='climb'){
   // The pull-up hangs from the hands (pinned by the renderer) until frame 8 of
   // 12, when the feet take over on the lip and the climber steps onto the top.
   const p=Math.min(1,ledge.elapsed/1),handover=8/12;
   if(p<handover){const rise=p/handover;actor.x=ledge.base.x;actor.y=ledge.base.y;actor.lift=ledge.hang+(ledge.wall-ledge.hang)*rise*rise;}
   else{const step=(p-handover)/(1-handover),from={x:ledge.lip.x+(ledge.top.x-ledge.lip.x)*.12,y:ledge.lip.y+(ledge.top.y-ledge.lip.y)*.12};actor.x=from.x+(ledge.top.x-from.x)*step*step;actor.y=from.y+(ledge.top.y-from.y)*step*step;actor.lift=0;}
   actor.traversalProgress=p;this.indexActor(actor);
   if(p>=1){Object.assign(actor,{x:ledge.top.x,y:ledge.top.y,lift:0,traversalAction:null,traversalProgress:0,ledgeContact:null,lastGround:{...ledge.top}});this.indexActor(actor);job.ledge=null;this.emit({type:'map.ledge.climbed',actor:actor.id,request:job.request,x:actor.x,y:actor.y});}
   return;
  }
  // Drop: fall back down the wall and land.
  const p=Math.min(1,ledge.elapsed/.28);actor.lift=Math.max(0,ledge.dropFrom*(1-p*p));actor.jumpProgress=.6+p*.4;
  if(p>=1){Object.assign(actor,{lift:0,jumping:false,jumpProgress:0,lastGround:{x:actor.x,y:actor.y}});job.ledge=null;this.emit({type:'map.ledge.dropped',actor:actor.id,request:job.request,x:actor.x,y:actor.y});}
 }
 swimAshore(id,toward,signal){
  const actor=this.actors.get(id),radius=this.map.navigation?.radius??0;let best=null;
  for(let r=.5;r<=8&&!best;r+=.5)for(let i=0;i<32;i++){
   const angle=i/32*Math.PI*2,p={x:actor.x+Math.cos(angle)*r,y:actor.y+Math.sin(angle)*r};
   if(mapWaterDepth(this.map,p.x,p.y)>0||this.index.isPointBlocked(p.x,p.y,radius)||!continuousSegmentClear(this.index,actor,p,radius,{allowWater:true}))continue;
   const score=r+.35*Math.hypot(toward.x-p.x,toward.y-p.y);if(!best||score<best.score)best={score,p};
  }
  if(!best)return Promise.reject(Error('No reachable shore.'));
  const job=this.startSteer(id,null,'walk');job.goal=best.p;
  if(signal){const abort=()=>this.cancelRequest(id,job.request);signal.addEventListener('abort',abort,{once:true});job.promise.finally(()=>signal.removeEventListener('abort',abort)).catch(()=>{});}
  return job.promise;
 }
 /** A short hop from the bank into open water. */
 dive(job,actor,input){
  const radius=this.map.navigation?.radius??0,start={x:actor.x,y:actor.y};
  for(const distance of [.95,.75,.55]){
   const landing={x:start.x+input.x*distance,y:start.y+input.y*distance};
   if(mapWaterDepth(this.map,landing.x,landing.y)<=0||!this.steerClear(start,landing,radius,{allowWater:true}))continue;
   const heading=Math.atan2(input.y,input.x);
   job.jump={hop:true,dive:true,start,landing,startZ:groundHeight(this.map,actor),endZ:groundHeight(this.map,landing),height:.34,duration:.42,elapsed:0,heading,style:'hop',action:null,object:null};
   Object.assign(actor,{jumping:true,jumpProgress:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,facing:heading,travelFacing:heading,walking:false,running:false});
   this.emit({type:'map.dive.started',actor:actor.id,request:job.request,x:actor.x,y:actor.y});return true;
  }
  return false;
 }
 steerClear(from,to,radius,{allowVault=false,allowWater=false}={}){
  if(this.map.navigation?.mode==='continuous')return continuousSegmentClear(this.index,from,to,radius,{allowVault,allowWater});
  if(!(to.x>=0&&to.y>=0&&to.x<this.map.width&&to.y<this.map.height))return false;
  const x=Math.floor(to.x),y=Math.floor(to.y);
  return !this.index.isBlocked(x,y)||allowWater&&this.map.terrain[y*this.map.width+x]===2&&!this.index.propsAt(x,y).length;
 }
 advanceSteer(job,dt){
  const actor=this.actors.get(job.actor),radius=this.map.navigation?.radius??0,v=job.velocity;
  if(job.goal){
   const dx=job.goal.x-actor.x,dy=job.goal.y-actor.y,distance=Math.hypot(dx,dy);
   if(distance<.06){this.finish(job,null,{type:'map.swim.ashore',actor:job.actor,request:job.request,x:actor.x,y:actor.y});return;}
   job.input={x:dx/distance,y:dy/distance};
  }
  const input=job.input;
  // Swimming is slower than walking and never runs; wading eases between them.
  const depth=mapWaterDepth(this.map,actor.x,actor.y),gait=depth>0?'walk':job.gait,speed=(actor.speed??3.5)*(gait==='run'?1.8:1)*(1-.45*depth);
  if(depth===0&&input&&job.swims&&Math.hypot(v.x,v.y)>speed*.35&&mapWaterDepth(this.map,actor.x+input.x*.32,actor.y+input.y*.32)>0&&this.dive(job,actor,input))return;
  if(depth===0&&this.map.navigation?.mode==='continuous'&&input&&Math.hypot(v.x,v.y)>speed*.4&&job.allowVault!==false&&actor.appearance?.kind!=='livestock'){
   // Walking into a low crossing vaults it, exactly as routed movement does.
   const jump=planMapVault(this.index,actor,[{x:actor.x,y:actor.y},{x:actor.x+input.x*2.5,y:actor.y+input.y*2.5}],1,job.gait);
   if(jump&&Math.abs(angleDelta(actor.facing,jump.heading))<.6){
    job.jump=jump;Object.assign(actor,{jumping:true,jumpProgress:0,vaultId:jump.object,traversalAction:jump.action,traversalProgress:0,facing:jump.heading,travelFacing:jump.heading});
    this.emit({type:'map.vault.started',actor:actor.id,object:jump.object,x:actor.x,y:actor.y,gait:job.gait});
    if(this.active.get(actor.id)===job)this.advanceJump(job,dt);return;
   }
  }
  const target=input?{x:input.x*speed,y:input.y*speed}:{x:0,y:0},steps=Math.max(1,Math.ceil(dt*120*Math.max(1,speed/(.04*120)))),h=dt/steps;
  let travelled=0;
  for(let n=0;n<steps;n++){
   const dx=target.x-v.x,dy=target.y-v.y,change=Math.hypot(dx,dy),rate=speed*(input?6:8)*h;
   if(change<=rate){v.x=target.x;v.y=target.y;}else{v.x+=dx/change*rate;v.y+=dy/change*rate;}
   const mx=v.x*h,my=v.y*h;if(!mx&&!my)break;
   // Slide along whatever blocks the full step instead of stopping dead.
   const from={x:actor.x,y:actor.y};let moved=null;
   for(const [ax,ay] of [[mx,my],[mx,0],[0,my]]){
    if(!ax&&!ay)continue;const to={x:from.x+ax,y:from.y+ay};
    if(this.steerClear(from,to,radius,{allowWater:job.swims})){moved=to;if(ax!==mx)v.x=0;if(ay!==my)v.y=0;break;}
   }
   if(!moved){v.x=0;v.y=0;break;}
   const length=Math.hypot(moved.x-from.x,moved.y-from.y);actor.x=moved.x;actor.y=moved.y;travelled+=length;
   actor.travelFacing=Math.atan2(moved.y-from.y,moved.x-from.x);
   actor.phase=(actor.phase+length*Math.PI*2/((actor.stride??1)*(gait==='run'?1.4:1)*(1-.45*depth)))%(Math.PI*2);
  }
  const entering=!(actor.swimDepth>0);actor.swimDepth=mapWaterDepth(this.map,actor.x,actor.y);actor.swimming=actor.swimDepth>0;
  if(entering&&actor.swimming){actor.splashAt=now();this.emit({type:'map.water.entered',actor:actor.id,x:actor.x,y:actor.y});}
  if(input){const error=angleDelta(actor.facing,Math.atan2(input.y,input.x)),turn=12*dt;actor.facing+=Math.max(-turn,Math.min(turn,error));}
  const moving=Math.hypot(v.x,v.y)>.05;
  actor.walking=moving;actor.running=moving&&gait==='run';actor.gait=gait;actor.gaitWeight=dt>0?Math.min(1,travelled/(dt*speed)):0;
  job.motion={x:v.x,y:v.y};
  if(!this.index.isPointBlocked(actor.x,actor.y,radius))actor.lastGround={x:actor.x,y:actor.y};
  this.indexActor(actor);
  if(!input&&!moving){v.x=0;v.y=0;this.finish(job,null,{type:'map.steer.stopped',actor:job.actor,request:job.request,x:actor.x,y:actor.y});}
 }
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
 moveTo(id,target,{signal,gait='walk',allowVault}={}){
  this.check();const actor=this.actors.get(id);if(!actor)throw Error('Unknown map actor.');
  if(gait!=='walk'&&gait!=='run')throw TypeError('Map gait must be walk or run.');
  if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw Error('Expected AbortSignal.');
  const prop=typeof target==='string'?this.index.prop(target):null;
  if(typeof target==='string'&&!prop)throw Error('Unknown map object.');
  if(!prop&&(!point(target)||target.x<0||target.y<0||target.x>=this.map.width||target.y>=this.map.height))throw Error('Map destination must be inside the grid.');
  if(allowVault!==undefined&&typeof allowVault!=='boolean')throw TypeError('allowVault must be a boolean.');
  const continuous=this.map.navigation?.mode==='continuous',authoredTraversal=prop?.traversal?.endpoints,manual=authoredTraversal?manualTraversalPlan(this.index,prop,actor):null;
  if(authoredTraversal&&!manual)return Promise.reject(Error('Traversal exit is blocked.'));
  const destination=prop?null:continuous?{x:target.x,y:target.y}:cell(target);
  const goals=manual?[manual.entry]:prop?approachTiles(this.map,this.index,prop):[destination];
  if(!goals.length||goals.every(p=>continuous?this.index.isPointBlocked(p.x,p.y):this.index.isBlocked(p.x,p.y)))return Promise.reject(Error('Destination is blocked or has no accessible approach.'));
  if(signal?.aborted)return Promise.reject(abortError('Movement cancelled.'));
  // Routes start on land: a swimmer first swims to the shore nearest the way.
  if(continuous&&actor.swimDepth>0&&!actor.jumping)return this.swimAshore(id,goals[0],signal).then(()=>this.moveTo(id,target,{signal,gait,allowVault}));
  if(actor.jumping||actor.rolling){
   const active=this.active.get(id),heading=Math.atan2(goals[0].y-actor.y,goals[0].x-actor.x);
   if(active?.jump&&active.gait==='run'&&Math.abs(angleDelta(active.jump.heading,heading))>.35)active.rollOnLand=true;
   return this.deferVault(id,()=>this.moveTo(id,target,{signal,gait,allowVault}),signal);
  }
  if(this.active.size>=16&&!this.active.has(id))return Promise.reject(Error('At most 16 map movements may be active.'));
  // Reject invalid destinations before replacing a valid movement.
  const previous=this.active.get(id),request='map-'+(++this.serial);let job;
  const momentum=previous?.skid?.velocity??previous?.motion,velocity=momentum?Math.hypot(momentum.x,momentum.y):0;
  const desired=Math.atan2(goals[0].y-actor.y,goals[0].x-actor.x);
  const skid=this.map.navigation?.mode==='continuous'&&previous?.gait==='run'&&velocity>.15&&(previous.skid||Math.abs(angleDelta(Math.atan2(momentum.y,momentum.x),desired))>.45)
   ?{velocity:{...momentum},deceleration:actor.speed*1.8*3.5}:null;
  const actorAllowsVault=allowVault??(actor.appearance?.kind!=='livestock');
  const promise=new Promise((resolve,reject)=>{const abort=()=>this.cancelRequest(id,request);job={actor:id,request,gait,skid,target:typeof target==='string'?target:destination,prop,goals,manualTraversal:manual,start:{x:actor.x,y:actor.y},resolve,reject,signal,abort,route:null,index:1,velocity:0,allowVault:!manual&&actorAllowsVault};signal?.addEventListener('abort',abort,{once:true});this.active.set(id,job);});
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
  actor.lift=0;actor.jumping=false;actor.vaultId=null;actor.traversalAction=null;actor.traversalProgress=0;actor.supportContact=null;
  if(!this.index.isPointBlocked(actor.x,actor.y,this.map.navigation?.radius??0))actor.lastGround={x:actor.x,y:actor.y};
  const wasDry=!(actor.swimDepth>0);actor.swimDepth=mapWaterDepth(this.map,actor.x,actor.y);actor.swimming=actor.swimDepth>0;
  // Landing in water throws up a splash; the renderer animates it from this time.
  if(actor.swimming&&wasDry){actor.splashAt=now();this.emit({type:'map.water.entered',actor:actor.id,x:actor.x,y:actor.y});}
  if(job.kind==='steer'){
   // Steering keeps its momentum through a hop or vault and carries on.
   job.jump=null;this.emit(jump.hop?{type:'map.jump.landed',actor:actor.id,request:job.request,x:actor.x,y:actor.y}:{type:'map.vault.landed',actor:actor.id,object:jump.object,x:actor.x,y:actor.y});
   if(this.active.get(actor.id)!==job)return;
   if(job.stopAfterVault){this.finish(job,abortError('Movement cancelled after landing.'));}
   const pending=this.afterVault.get(actor.id);if(pending){this.afterVault.delete(actor.id);pending.run();}
   return;
  }
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
 finish(job,error,event){if(job.done)return;job.done=true;if(this.active.get(job.actor)===job){this.active.delete(job.actor);Object.assign(this.actors.get(job.actor),{walking:false,running:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,gait:'walk',gaitWeight:0,turning:false,lift:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,ledgeContact:null});}job.signal?.removeEventListener('abort',job.abort);if(error){this.worker?.postMessage({type:'cancel',request:job.request});job.reject(error);this.emit({type:error.name==='AbortError'?'map.command.cancelled':'map.command.failed',actor:job.actor,request:job.request,message:error.message});}else{job.resolve(event);this.emit(event);}}
 arrive(job){const actor=this.actors.get(job.actor),event={type:'map.actor.arrived',actor:job.actor,request:job.request,target:job.target,x:actor.x,y:actor.y,gait:job.gait};if(job.prop?.kind==='chest')Object.defineProperty(this.objects,job.prop.id,{value:{opened:true},enumerable:true,configurable:true,writable:true});this.finish(job,null,event);if(job.prop&&!this.disposed)this.emit({type:'map.object.interacted',actor:job.actor,object:job.prop.id,kind:job.prop.kind,request:job.request});}
 advance(dt){
  this.check();if(!Number.isFinite(dt)||dt<0)throw Error('Map step must be finite and nonnegative.');dt=Math.min(dt,.1);
  for(const job of [...this.active.values()]){
   if(this.active.get(job.actor)!==job)continue;
   if(job.ledge){this.advanceLedge(job,dt);continue;}
   if(job.jump){this.advanceJump(job,dt);continue;}
   if(job.roll){this.advanceRoll(job,dt);continue;}
   if(job.skid){this.advanceSkid(job,dt);continue;}
   if(job.kind==='steer'){this.advanceSteer(job,dt);continue;}
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
   for(let n=0;n<steps&&job.route&&job.index<job.route.length;n++){
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
  if(job?.jump&&job.kind!=='steer'){const from={x:this.actors.get(job.actor).x,y:this.actors.get(job.actor).y},to=job.jump.landing;routeSegments.push({from,to:{...to},offset:0});}
  const objects=Object.create(null);for(const p of props)if(Object.hasOwn(this.objects,p.id))objects[p.id]={...this.objects[p.id]};
  return {actors,objects,route:null,routeSegments,destination:movementDestination(job),pending:jobs.filter(j=>!j.route&&!j.jump).length,candidateActors,candidateRouteSegments:segments.size};
 }
 frame(){const jobs=[...this.active.values()],job=jobs.find(j=>j.kind!=='face');this.stats.pending=jobs.filter(j=>!j.route&&!j.jump).length;return {actors:[...this.actors.values()].map(a=>({...a,supportContact:a.supportContact?{...a.supportContact}:null})),objects:structuredClone(this.objects),route:job?.route?.map(p=>({...p}))??null,destination:movementDestination(job),pending:this.stats.pending};}
 snapshot(){this.check();return {format:'posecraft-map-state',version:1,map:this.signature,actors:[...this.actors.values()].map(a=>({id:a.id,x:(a.jumping||a.lift>0||a.swimDepth>0?a.lastGround:null)?.x??a.x,y:(a.jumping||a.lift>0||a.swimDepth>0?a.lastGround:null)?.y??a.y,facing:a.facing})),objects:structuredClone(this.objects)};}
 restore(input){
  this.check();const state=structuredClone(input);
  if(state?.format!=='posecraft-map-state'||state.version!==1||state.map!==this.signature||!Array.isArray(state.actors)||state.actors.length!==this.actors.size||!state.objects||typeof state.objects!=='object'||Array.isArray(state.objects))throw Error('Incompatible map save.');
  const ids=new Set();
  for(const a of state.actors){if(!a||!this.actors.has(a.id)||ids.has(a.id)||!point(a)||!Number.isFinite(a.facing)||a.x<0||a.y<0||a.x>=this.map.width||a.y>=this.map.height||(this.map.navigation?.mode==='continuous'?this.index.isPointBlocked(a.x,a.y):this.index.isBlocked(a.x,a.y)))throw Error('Invalid saved actor position.');ids.add(a.id);}
  for(const [id,value]of Object.entries(state.objects))if(this.index.prop(id)?.kind!=='chest'||!value||typeof value!=='object'||Array.isArray(value)||value.opened!==true||Object.keys(value).some(k=>k!=='opened'))throw Error('Invalid saved object state.');
  this.restoring=true;
  try{
   for(const id of this.afterVault.keys())this.clearDeferred(id);for(const job of [...this.active.values()])this.finish(job,abortError('Map restored.'));
   for(const a of state.actors){Object.assign(this.actors.get(a.id),{x:a.x,y:a.y,facing:a.facing,travelFacing:a.facing,gaitWeight:0,gait:'walk',running:false,walking:false,skidding:false,jumping:false,jumpProgress:0,rolling:false,rollProgress:0,phase:0,turning:false,lift:0,vaultId:null,traversalAction:null,traversalProgress:0,supportContact:null,swimming:false,swimDepth:0,lastGround:{x:a.x,y:a.y}});this.indexActor(this.actors.get(a.id));}
   this.objects=Object.assign(Object.create(null),state.objects);
  }finally{this.restoring=false;}
  this.emit({type:'map.restored'});return this.frame();
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const id of this.afterVault.keys())this.clearDeferred(id);for(const job of [...this.active.values()])this.finish(job,abortError('Map disposed.'));clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.rejectReady?.(abortError('Map disposed.'));this.listeners.clear();}
}
