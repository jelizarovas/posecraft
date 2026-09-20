const animalSpecies=new Set(['sheep','cow','chicken']);
const supportedSpecies=new Set([...animalSpecies,'human','child']);
const abortError=error=>error?.name==='AbortError';
const finitePoint=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
const copyPoint=value=>value&&({x:value.x,y:value.y});
const center=value=>({x:value.x+(value.width??0)/2,y:value.y+(value.height??0)/2});
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

function seeded(seed){
 let value=typeof seed==='number'?seed>>>0:[...String(seed)].reduce((sum,char)=>Math.imul(sum^char.charCodeAt(0),16777619)>>>0,2166136261);
 return()=>{value+=0x6d2b79f5;let next=value;next=Math.imul(next^next>>>15,next|1);next^=next+Math.imul(next^next>>>7,next|61);return((next^next>>>14)>>>0)/4294967296;};
}
function duration(value,random){return Array.isArray(value)?value[0]+(value[1]-value[0])*random():value;}
function validDuration(value){return Number.isFinite(value)&&value>=0||Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)&&value[0]>=0&&value[1]>=value[0];}
function homePoint(home,random,margin=.4){const ix=Math.min(margin,home.width/2),iy=Math.min(margin,home.height/2);return{x:home.x+ix+Math.max(0,home.width-ix*2)*random(),y:home.y+iy+Math.max(0,home.height-iy*2)*random()};}
function gateFor(props,home){
 const gates=props.filter(prop=>{const p=center(prop);return p.x>=home.x-2&&p.x<=home.x+home.width+2&&p.y>=home.y-2&&p.y<=home.y+home.height+2&&/gate/i.test(String(prop.id??''))&&/broken|open/i.test(`${prop.id??''} ${prop.kind??''} ${prop.type??''} ${prop.asset??''} ${prop.art??''}`);});if(!gates.length)return null;const origin=center(home);
 return gates.reduce((best,item)=>Math.hypot(center(item).x-origin.x,center(item).y-origin.y)<Math.hypot(center(best).x-origin.x,center(best).y-origin.y)?item:best);
}
function throughGate(gate,home,distance=1.3){const at=center(gate),origin=center(home),dx=at.x-origin.x,dy=at.y-origin.y,length=Math.hypot(dx,dy)||1;return{x:at.x+dx/length*distance,y:at.y+dy/length*distance};}
function neighboringHomes(a,b){
 const ar=a.x+a.width,ab=a.y+a.height,br=b.x+b.width,bb=b.y+b.height,xGap=Math.max(0,b.x-ar,a.x-br),yGap=Math.max(0,b.y-ab,a.y-bb),y0=Math.max(a.y,b.y),y1=Math.min(ab,bb),x0=Math.max(a.x,b.x),x1=Math.min(ar,br);
 if(xGap<=1.5&&y1>y0){const left=center(a).x<center(b).x?a:b,right=left===a?b:a,y=(y0+y1)/2;return{a:left===a?{x:ar-.35,y}:{x:a.x+.35,y},b:left===b?{x:br-.35,y}:{x:b.x+.35,y}};}
 if(yGap<=1.5&&x1>x0){const top=center(a).y<center(b).y?a:b,bottom=top===a?b:a,x=(x0+x1)/2;return{a:top===a?{x,y:ab-.35}:{x,y:a.y+.35},b:top===b?{x,y:bb-.35}:{x,y:b.y+.35}};}
 return null;
}

/** Run metadata-driven village routines through the map controller. */
export function startVillageLife(view,{seed=1,random,intervalMs=[900,1800],dwellMs=[700,1300],initialDelay=0,retryMs=2000,maxConcurrent=6,escapeChance=.006,onEvent=()=>{},onError=()=>{},document:hostDocument=globalThis.document,now=()=>Date.now(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
 const controller=view?.controller,map=controller?.map;
 if(!map||!Array.isArray(map.actors)||typeof controller.actor!=='function')throw TypeError('Village life needs a map view whose controller exposes map actors.');
 if(random!==undefined&&typeof random!=='function')throw TypeError('Village random must be a function.');
 if(!validDuration(intervalMs)||!validDuration(dwellMs)||!Number.isFinite(initialDelay)||initialDelay<0||!Number.isFinite(retryMs)||retryMs<0)throw TypeError('Village delays must be nonnegative durations.');
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1)throw TypeError('Village maxConcurrent must be a positive integer.');
 if(!Number.isFinite(escapeChance)||escapeChance<0||escapeChance>1)throw TypeError('Village escapeChance must be between zero and one.');
 const choose=random??seeded(seed),props=map.props??[],records=new Map();
 for(const spec of map.actors){const npc=spec.npc;if(!npc)continue;if(!supportedSpecies.has(npc.species))throw TypeError(`Unsupported village species for ${spec.id}.`);if(!finitePoint(npc.home)||!Number.isFinite(npc.home.width)||!Number.isFinite(npc.home.height)||npc.home.width<0||npc.home.height<0)throw TypeError(`Village actor ${spec.id} needs a finite npc.home rectangle.`);records.set(spec.id,{id:spec.id,npc,actor:controller.actor(spec.id),action:'idle',target:null,targetActor:null,carrying:null,ball:null,due:null,busy:false,reserved:false,signal:null,phase:'routine',continuation:null,afterDwell:null,dwellOverride:null,release:null,cycle:0,escaped:false});}
 const animals=[...records.values()].filter(record=>animalSpecies.has(record.npc.species)),humans=[...records.values()].filter(record=>record.npc.species==='human'),children=[...records.values()].filter(record=>record.npc.species==='child');
 let disposed=false,manualPaused=false,visibilityPaused=!!hostDocument?.hidden,paused=visibilityPaused,timer=null,active=0,ballOwner=children[0]?.id??null;
 const emit=(type,record,extra={})=>{try{onEvent({type,actor:record.id,action:record.action,target:copyPoint(record.target),targetActor:record.targetActor,...extra});}catch{}};
 const present=record=>{try{view.setActorPresentation?.(record.id,{action:record.action,carrying:record.carrying,target:copyPoint(record.target),targetActor:record.targetActor,ball:record.ball&&{...record.ball,from:copyPoint(record.ball.from),to:copyPoint(record.ball.to)},escaped:record.escaped});}catch{}};
 const setState=(record,action,target=null,{carrying=record.carrying,targetActor=null,ball=record.ball}={})=>{record.action=action;record.target=copyPoint(target);record.targetActor=targetActor;record.carrying=carrying;record.ball=ball;present(record);emit('village.action',record);};
 const report=error=>{if(!abortError(error)&&!disposed)try{onError(error);}catch{}};
 const actorPoint=record=>{try{return copyPoint(controller.actorPosition(record.id));}catch{return center(record.npc.home);}};
 const openPoint=target=>!controller.index?.isPointBlocked?.(target.x,target.y,map.navigation?.radius??0);
 const safePoint=(record,target)=>{if(openPoint(target))return target;for(const offset of [[.5,0],[-.5,0],[0,.5],[0,-.5],[.5,.5],[-.5,.5],[.5,-.5],[-.5,-.5]]){const candidate={x:target.x+offset[0],y:target.y+offset[1]};if(openPoint(candidate))return candidate;}return actorPoint(record);};
 const safeHomePoint=record=>{for(let attempt=0;attempt<12;attempt++){const candidate=homePoint(record.npc.home,choose);if(openPoint(candidate))return candidate;}return actorPoint(record);};
 const fieldPoints=props.filter(prop=>['wheat','farm-soil','farm-vegetables','farm-pumpkin','farm-corn'].includes(prop.art)).map(center).filter(openPoint);
 function clearSchedule(){if(timer!==null){clearTimer(timer);timer=null;}}
 function schedule(record,delay){record.busy=false;record.due=paused?delay:now()+delay;arrange();}
 function releaseReservation(record){const release=record.release;record.release=null;try{release?.();}catch{}}
 function finishDwell(record){record.afterDwell?.();record.afterDwell=null;if(record.continuation){record.phase='routine';run(record);return;}setState(record,'idle',null,{carrying:null,ball:null});releaseReservation(record);record.phase='routine';schedule(record,duration(intervalMs,choose));}
 function arrange(){clearSchedule();if(disposed||paused)return;const ready=[...records.values()].filter(record=>!record.busy&&!record.reserved&&record.due!==null).sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id));while(ready[0]?.due<=now()&&active<maxConcurrent){const record=ready.shift();record.due=null;if(record.phase==='dwell')finishDwell(record);else run(record);}if(active>=maxConcurrent)return;const due=ready.find(record=>!record.reserved)?.due;if(due!==undefined)timer=setTimer(arrange,Math.max(0,due-now()));}
 async function move(record,destination,action,{carrying=record.carrying,target=destination,targetActor=null,gait='walk',signal=record.signal?.signal}={}){setState(record,action,target,{carrying,targetActor});await record.actor.moveTo(destination,{gait,signal});}
 async function face(record,target,action=record.action,signal=record.signal?.signal){setState(record,action,record.target,{carrying:record.carrying,targetActor:record.targetActor});if(typeof record.actor.faceTo==='function')await record.actor.faceTo(copyPoint(target),{signal});}
 function careChoice(species){const ids=species==='sheep'?['sheep-hay','sheep-water']:species==='cow'?['cow-hay','cow-water']:['chicken-grain','chicken-bucket'];const id=ids[Math.floor(choose()*ids.length)],prop=props.find(item=>item.id===id);return prop&&{id,point:center(prop),action:/water|bucket/.test(id)?'drink':'hay'};}
 async function escapeRoutine(record,gate,herder){
  herder.reserved=true;const signal=record.signal.signal,at=center(gate),outside=throughGate(gate,record.npc.home),inside=safeHomePoint(record);record.release=()=>{herder.reserved=false;setState(herder,'idle',null,{carrying:null});};
  await move(record,at,'graze');await move(record,outside,'graze');record.escaped=true;present(record);emit('village.escape',record,{gate:gate.id});
  await move(herder,at,'catch',{signal});await move(herder,outside,'catch',{target:actorPoint(record),targetActor:record.id,signal});await face(herder,actorPoint(record),'catch',signal);
  await move(record,at,'catch',{targetActor:herder.id});await move(herder,at,'catch',{target:actorPoint(record),targetActor:record.id,signal});await move(record,inside,'catch',{targetActor:herder.id});await move(herder,inside,'catch',{target:actorPoint(record),targetActor:record.id,signal});record.escaped=false;present(record);emit('village.caught',record,{herder:herder.id});
 }
 async function socialRoutine(record,peer,border){
  peer.reserved=true;record.release=()=>{peer.reserved=false;peer.phase='routine';setState(peer,'idle',null,{carrying:null,ball:null});schedule(peer,duration(intervalMs,choose));};
  const same=record.npc.species===peer.npc.species,here=actorPoint(record),there=actorPoint(peer),dx=there.x-here.x,dy=there.y-here.y,length=Math.hypot(dx,dy)||1,mid={x:(here.x+there.x)/2,y:(here.y+there.y)/2};
  const first=same?{x:mid.x-dx/length*.8,y:mid.y-dy/length*.8}:border.a,second=same?{x:mid.x+dx/length*.8,y:mid.y+dy/length*.8}:border.b,action=!same&&record.npc.species==='cow'?'intimidate':'social',peerAction=action==='intimidate'?'react':'social',signal=record.signal.signal;
  await move(record,safePoint(record,first),action,{targetActor:peer.id});await move(peer,safePoint(peer,second),peerAction,{targetActor:record.id,signal});await face(record,actorPoint(peer),action);await face(peer,actorPoint(record),peerAction,signal);
 }
 async function animalRoutine(record){
  const gate=gateFor(props,record.npc.home),herder=humans.find(item=>item.npc.role==='herder'&&!item.reserved&&!item.busy);if(gate&&herder&&choose()<escapeChance)return escapeRoutine(record,gate,herder);const roll=choose(),care=careChoice(record.npc.species);if(roll<.3&&care){await move(record,care.id,care.action,{target:care.point});await face(record,care.point,care.action);return;}
  const available=animals.filter(item=>item!==record&&!item.escaped&&!item.busy&&!item.reserved),same=available.filter(item=>item.npc.species===record.npc.species),cross=available.map(item=>({item,border:neighboringHomes(record.npc.home,item.npc.home)})).filter(candidate=>candidate.border),useSame=same.length&&choose()<.65;
  if(roll<.55&&(useSame||cross.length)){const peer=useSame?same[Math.floor(choose()*same.length)]:cross[Math.floor(choose()*cross.length)].item,border=useSame?null:neighboringHomes(record.npc.home,peer.npc.home);return socialRoutine(record,peer,border);}
  await move(record,safeHomePoint(record),'graze');
 }
 function workPoint(record){if(finitePoint(record.npc.work)&&openPoint(record.npc.work))return copyPoint(record.npc.work);return fieldPoints[Math.floor(choose()*fieldPoints.length)]??safeHomePoint(record);}
 async function farmerRoutine(record){if(record.continuation){const next=record.continuation;record.continuation=null;return next();}const work=workPoint(record),granary=props.find(prop=>prop.id==='town-granary'),granaryPoint=granary?center(granary):center(record.npc.home),transport=record.npc.role==='carrier'||record.cycle++%2===1;await move(record,work,'till');await face(record,{x:work.x+1,y:work.y},'till');record.dwellOverride=2000;if(transport)record.continuation=()=>{setState(record,'harvest',work,{carrying:'harvest',ball:null});record.dwellOverride=1000;record.continuation=async()=>{await move(record,granary?'town-granary':granaryPoint,'carry',{carrying:'wheelbarrow',target:granaryPoint});setState(record,'harvest',granaryPoint,{carrying:null,ball:null});record.dwellOverride=1500;};};}
 async function childRoutine(record){
  const mate=children.find(item=>item!==record&&!item.busy&&!item.reserved);if(!mate){await move(record,safeHomePoint(record),'play-ball',{gait:'run'});return;}mate.reserved=true;record.release=()=>{mate.reserved=false;mate.phase='routine';setState(mate,'idle',null,{carrying:mate.carrying,ball:null});schedule(mate,duration(intervalMs,choose));};
  const a=actorPoint(record),b=actorPoint(mate),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,offset={x:dx/length*1.1,y:dy/length*1.1},first={x:mid.x-offset.x,y:mid.y-offset.y},second={x:mid.x+offset.x,y:mid.y+offset.y},signal=record.signal.signal;
  await move(record,safePoint(record,first),'play-ball',{gait:'run',targetActor:mate.id,carrying:null,ball:null});await move(mate,safePoint(mate,second),'play-ball',{gait:'run',targetActor:record.id,carrying:null,ball:null,signal});await face(record,actorPoint(mate),'play-ball');await face(mate,actorPoint(record),'play-ball',signal);const owner=ballOwner===mate.id?mate:record,recipient=owner===record?mate:record,dwell=duration(dwellMs,choose),ball={from:actorPoint(owner),to:actorPoint(recipient),duration:dwell/1000,ownerId:owner.id};record.dwellOverride=dwell;setState(owner,'play-ball',actorPoint(recipient),{targetActor:recipient.id,carrying:null,ball});setState(recipient,'play-ball',actorPoint(owner),{targetActor:owner.id,carrying:null,ball:null});record.afterDwell=()=>{ballOwner=recipient.id;owner.ball=null;owner.carrying=null;recipient.carrying='ball';present(owner);present(recipient);};
 }
 async function routine(record){if(animalSpecies.has(record.npc.species))return animalRoutine(record);if(record.npc.species==='child')return childRoutine(record);if(record.npc.role==='farmer'||record.npc.role==='carrier')return farmerRoutine(record);await move(record,safeHomePoint(record),'social');}
 function run(record){
  if(disposed||paused||record.busy||record.reserved)return;record.busy=true;active++;const command=new AbortController();record.signal=command;let task;
  // Enter the routine synchronously so paired actors and herders are reserved
  // before arrange() can release another actor in the same timer turn.
  try{task=routine(record);}catch(error){task=Promise.reject(error);}
  Promise.resolve(task).then(()=>{if(!disposed&&!command.signal.aborted){record.phase='dwell';const dwell=record.dwellOverride??duration(dwellMs,choose);record.dwellOverride=null;schedule(record,dwell);}}).catch(error=>{releaseReservation(record);if(!abortError(error)){report(error);emit('village.error',record,{error});}if(!disposed){setState(record,'idle',null,{carrying:null,ball:null});record.phase='routine';record.continuation=null;record.afterDwell=null;schedule(record,retryMs);}}).finally(()=>{active=Math.max(0,active-1);if(record.signal===command)record.signal=null;if(disposed||command.signal.aborted)record.busy=false;arrange();});
 }
 function setPaused(next){if(disposed||paused===next)return;paused=next;const time=now();if(paused){clearSchedule();for(const record of records.values())if(record.due!==null)record.due=Math.max(0,record.due-time);}else{for(const record of records.values())if(record.due!==null)record.due=time+record.due;arrange();}}
 function pause(){manualPaused=true;setPaused(true);}function resume(){manualPaused=false;setPaused(visibilityPaused);}function visibility(){visibilityPaused=!!hostDocument.hidden;setPaused(manualPaused||visibilityPaused);}
 hostDocument?.addEventListener?.('visibilitychange',visibility);for(const record of records.values())present(record);
 const pending=[...records.values()].filter(item=>item.npc.role!=='herder').sort((a,b)=>a.id.localeCompare(b.id)),startup=[];
 const take=predicate=>{const index=pending.findIndex(predicate);if(index>=0)startup.push(...pending.splice(index,1));};
 take(item=>item.npc.role==='farmer');take(item=>item.npc.role==='carrier');take(item=>item.npc.species==='sheep');take(item=>item.npc.species==='cow');take(item=>item.npc.species==='chicken');take(item=>item.npc.species==='child');take(item=>item.npc.species==='child');
 let offset=0;for(const record of [...startup,...pending])schedule(record,initialDelay+offset++*25);
 return{pause,resume,get paused(){return paused;},get moving(){return active>0;},state(){return{paused,moving:active>0,active,actors:Object.fromEntries([...records].map(([id,record])=>[id,{action:record.action,target:copyPoint(record.target),targetActor:record.targetActor,carrying:record.carrying,ball:record.ball&&{...record.ball,from:copyPoint(record.ball.from),to:copyPoint(record.ball.to)},escaped:record.escaped,moving:record.busy}]))};},dispose(){if(disposed)return;disposed=true;clearSchedule();hostDocument?.removeEventListener?.('visibilitychange',visibility);for(const record of records.values()){record.signal?.abort();record.signal=null;record.due=null;record.busy=false;record.reserved=false;record.release=null;record.continuation=null;record.afterDwell=null;setState(record,'idle',null,{carrying:null,ball:null});}active=0;}};
}

export const villageSpecies=Object.freeze([...supportedSpecies]);
