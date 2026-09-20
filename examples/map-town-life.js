const npcIds=Object.freeze(['npc-farmer','npc-trader','npc-villager']);
const abortName='AbortError';

const validPoint=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y);
const abortError=error=>error?.name===abortName;

function pauseLength(value,random){
 if(Array.isArray(value)){
  const [low,high]=value;
  return low+(high-low)*random();
 }
 return value;
}
function validPause(value){
 return Number.isFinite(value)&&value>=0||Array.isArray(value)&&value.length===2&&value.every(item=>Number.isFinite(item)&&item>=0)&&value[1]>=value[0];
}

/**
 * Give Millbrook's three residents a quiet, repeating walking route.
 *
 * The only timer belongs to the shared pause queue. Map movement stays in the
 * map controller, so roads, collisions and visibility all use the normal map
 * runtime.
 */
export function startTownLife(view,{routes,pauseMs=[900,1800],retryMs=3000,initialDelay=200,random=Math.random,onError=()=>{},document:hostDocument=globalThis.document,now=()=>Date.now(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
 if(!view?.controller?.actor)throw TypeError('Town life needs a map view with a controller.');
 if(!routes||typeof routes!=='object')throw TypeError('Town life needs named NPC routes.');
 if(!Number.isFinite(initialDelay)||initialDelay<0)throw TypeError('Initial delay must be a nonnegative number.');
 if(!Number.isFinite(retryMs)||retryMs<0)throw TypeError('Retry delay must be a nonnegative number.');
 if(typeof random!=='function'||typeof now!=='function'||typeof setTimer!=='function'||typeof clearTimer!=='function')throw TypeError('Town life scheduler options must be functions.');
 if(!validPause(pauseMs))throw TypeError('Pause duration must be a nonnegative number or ascending range.');

 const residents=new Map();
 for(const id of npcIds){
  const route=routes[id];
  if(!Array.isArray(route)||route.length<2||route.some(point=>!validPoint(point)))throw TypeError(`Town route for ${id} needs at least two finite map points.`);
  // Resolve the actor up front, before any timer can start a partial routine.
  residents.set(id,{id,actor:view.controller.actor(id),route:route.map(point=>({x:point.x,y:point.y})),index:0,due:null,moving:false,signal:null});
 }

 let manualPaused=false,visibilityPaused=!!hostDocument?.hidden,paused=manualPaused||visibilityPaused,disposed=false,timer=null;
 function report(error){if(!abortError(error)&&!disposed)try{onError(error);}catch{}}
 function clearSchedule(){if(timer!==null){clearTimer(timer);timer=null;}}
 function arrange(){
  clearSchedule();
  if(disposed||paused)return;
  let due=Infinity;
  for(const resident of residents.values())if(!resident.moving&&resident.due!==null)due=Math.min(due,resident.due);
  if(due!==Infinity)timer=setTimer(release,Math.max(0,due-now()));
 }
 function wait(resident,delay){
  resident.moving=false;resident.due=paused?delay:now()+delay;arrange();
}
 function release(){
  timer=null;
  if(disposed||paused)return;
  const time=now();
  for(const resident of residents.values())if(!resident.moving&&resident.due!==null&&resident.due<=time){resident.due=null;walk(resident);}
  arrange();
 }
 async function lookAround(resident,signal){
  if(typeof resident.actor.faceTo!=='function')return;
  const current=resident.route[resident.index],previous=resident.route[(resident.index+resident.route.length-1)%resident.route.length];
  const target={x:current.x+(current.x-previous.x),y:current.y+(current.y-previous.y)};
  await resident.actor.faceTo(target,{signal});
 }
 function walk(resident){
  if(disposed||paused||resident.moving)return;
  resident.moving=true;
  const signal=new AbortController();resident.signal=signal;
  const destination=resident.route[resident.index];
  Promise.resolve()
   .then(()=>resident.actor.moveTo(destination,{gait:'walk',signal:signal.signal}))
   .then(()=>lookAround(resident,signal.signal))
   .then(()=>{
    if(disposed||signal.signal.aborted)return;
    resident.index=(resident.index+1)%resident.route.length;
    wait(resident,pauseLength(pauseMs,random));
   })
   .catch(error=>{
    if(abortError(error)||disposed)return;
    report(error);
    resident.index=(resident.index+1)%resident.route.length;
    wait(resident,retryMs);
   })
   .finally(()=>{
    if(resident.signal!==signal)return;
    resident.signal=null;
    if(signal.signal.aborted||disposed){resident.moving=false;return;}
    // wait() changed moving before this runs. A failed command needs the same reset.
    if(resident.due===null)resident.moving=false;
   });
 }
 function setPaused(next){
  if(disposed||paused===next)return;
  paused=next;
  const time=now();
  if(paused){
   clearSchedule();
   for(const resident of residents.values())if(resident.due!==null)resident.due=Math.max(0,resident.due-time);
  }else{
   for(const resident of residents.values())if(resident.due!==null)resident.due=time+resident.due;
   arrange();
  }
 }
 function pause(){manualPaused=true;setPaused(true);}
 function resume(){manualPaused=false;setPaused(visibilityPaused);}
 function visibility(){visibilityPaused=!!hostDocument.hidden;setPaused(manualPaused||visibilityPaused);}
 hostDocument?.addEventListener?.('visibilitychange',visibility);
 let position=0;
 for(const resident of residents.values())wait(resident,initialDelay+position++*120);

 return {
  pause,resume,
  get paused(){return paused;},
  get moving(){return [...residents.values()].some(resident=>resident.moving);},
  state(){return {paused,moving:this.moving,actors:Object.fromEntries([...residents.values()].map(resident=>[resident.id,{moving:resident.moving,routeIndex:resident.index}]))};},
  dispose(){
   if(disposed)return;
   disposed=true;clearSchedule();hostDocument?.removeEventListener?.('visibilitychange',visibility);
   for(const resident of residents.values()){
    resident.due=null;resident.signal?.abort();resident.signal=null;resident.moving=false;
   }
  }
 };
}

export {npcIds as townLifeNpcIds};
