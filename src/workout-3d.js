import {workoutFace3D} from './face-3d.js';
import {Quaternion,Vector3} from 'three';
import {createBenchAction3D} from './bench-action-3d.js';
import {createLocomotionAction3D} from './locomotion-action-3d.js';
import {createPullupAction3D} from './pullup-action-3d.js';
import {createDrinkAction3D,createRestAction3D} from './drink-action-3d.js';
import {assertWorkoutProject3D} from './workout-project-3d.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const clone=structuredClone,clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n)),names=['pullup','bench','rest','drink'],station={pullup:'pullup',bench:'bench',drink:'bottle'},distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
/** Deterministic mechanism sequencing. Controls are journalled at the last sampled
 * clock time; backwards reads rebuild the same decisions and control history. */
export function createWorkout3D({rig,roles,grips,project}){
 project=clone(assertWorkoutProject3D(project));rig=clone(rig);roles=clone(roles);grips=clone(grips??{});
 const common={rig,roles,grips},journal=[];let serial=0,journalCursor=0,time=0,randomState,current,pending,stats,events,eventSerial=0,autoSerial=0,sequenceIndex,stopped,stopRequested,lastOutcome,previous,resetEvents=[],resetSequence=0;
 const bench=()=>createBenchAction3D({...common,bench:project.bench,settings:project.settings});
 const initialBench=bench(),initial=initialBench.sample(initialBench.duration),rack=clone(initial.bar);
 function initialize(){time=0;randomState=project.workout.seed>>>0;current=null;pending=null;stats={fatigue:project.workout.fatigue,dehydration:project.workout.dehydration,sets:0,reps:0,successes:0,failures:0,mechanicalFailures:0,drinks:0};events=clone(resetEvents);eventSerial=resetSequence;autoSerial=0;sequenceIndex=0;stopped=false;stopRequested=false;lastOutcome=null;previous=clone(initial);journalCursor=0;}
 function random(){randomState=(randomState+0x6D2B79F5)>>>0;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 function emit(type,item,error){events.push({sequence:++eventSerial,type,actor:'atlas',request:item.request,action:item.name,time,...(error?{error}:{})});if(events.length>64)events.shift();}
 function checkTime(t){if(!Number.isFinite(t)||t<0)throw Error('Workout time must be a nonnegative finite number.');}
 function snapshot(){return {activity:current?.walking?'walk':current?.item.name??'stopped',target:current?.item.name??null,stats:clone(stats),events:clone(events),lastOutcome:clone(lastOutcome),stopped,queued:pending?{action:pending.name,request:pending.request}:null,request:current?.item.request??null,time};}
 function wrap(frame){return {...frame,face:workoutFace3D(frame,time,stats),time,activityTime:frame.time,duration:Infinity,bar:frame.bar??clone(rack),bottle:frame.bottle??{...clone(project.bottle),visible:true,owner:null},workout:snapshot()};}
 function neutral(){return {...clone(previous),phase:'stopped',bar:clone(rack),bottle:{...clone(project.bottle),visible:true,owner:null}};}
 // Equipment-aware route in the bench's floor plane. Only this apparatus is
 // a blocking volume; arbitrary room navigation belongs in a separate planner.
 function waypoints(from,to){
  const q=new Quaternion(...project.bench.rotation),inverse=q.clone().invert(),center=new Vector3(...project.bench.position),local=p=>new Vector3(...p).sub(center).applyQuaternion(inverse).multiplyScalar(1/project.bench.scale),world=p=>new Vector3(p.x,0,p.z).multiplyScalar(project.bench.scale).applyQuaternion(q).add(center),a=local(from.position),b=local(to.position),x=.62,z=1.4,result=[];
  const inside=p=>Math.abs(p.x)<x&&Math.abs(p.z)<z;
  if(inside(a)){const exits=[{x:-x,z:a.z},{x:x,z:a.z},{x:a.x,z:-z},{x:a.x,z:z}];exits.sort((p,r)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(r.x-a.x,r.z-a.z));result.push(exits[0]);a.x=exits[0].x;a.z=exits[0].z;}
  const blocked=(p,r)=>{for(let i=1;i<40;i++){const t=i/40;if(Math.abs(p.x+(r.x-p.x)*t)<x-.001&&Math.abs(p.z+(r.z-p.z)*t)<z-.001)return true;}return false;};
  if(blocked(a,b)){const corners=[{x:-x,z:-z},{x:x,z:-z},{x:x,z:z},{x:-x,z:z}],paths=[];for(const c of corners){if(!blocked(a,c)&&!blocked(c,b))paths.push([c]);for(const d of corners)if(!blocked(a,c)&&!blocked(c,d)&&!blocked(d,b))paths.push([c,d]);}const len=path=>{let total=0,prior=a;for(const p of [...path,b]){total+=Math.hypot(p.x-prior.x,p.z-prior.z);prior=p;}return total;};paths.sort((p,r)=>len(p)-len(r));if(!paths.length)throw Error('No clear route around the bench to this target.');result.push(...paths[0]);}
  return result.map(p=>{const v=world(p);return {x:v.x,z:v.z};});
 }
 function plan(item){
  const w=project.workout,exercise=item.name==='pullup'||item.name==='bench',reps=exercise?w.reps.min+Math.floor(random()*(w.reps.max-w.reps.min+1)):0,effort=clamp(project.settings.effort+stats.fatigue/250+(random()-.5)*.12,0,1),tempo=clamp(project.settings.tempo*(.92+random()*.16),.25,3),failed=exercise&&random()<clamp(w.failureBase+stats.fatigue*.004+stats.dehydration*.002,0,.95),failedRep=failed?Math.max(1,Math.min(reps,2+Math.floor(random()*Math.max(1,reps-1)))):undefined;
  let action;
  if(item.name==='bench'){
   action=createBenchAction3D({...common,bench:project.bench,settings:{...project.settings,reps,effort,tempo,entryStyle:w.benchEntry&&w.benchEntry!=='varied'?w.benchEntry:random()<.5?'side-reach':'center'}});
   if(failed){
    const source=action,beat=source.beats.find(b=>b.id==='press-'+failedRep),at=beat.start+(beat.end-beat.start)*.56,hold=.6/tempo,retreat=1.4/tempo,rerack=source.beats.find(b=>b.id==='rerack').start,recoveryStart=at+hold+retreat,duration=recoveryStart+source.duration-rerack;
    const failedSample=t=>{let f;if(t<=at)f=source.sample(t);else if(t<at+hold)f=source.sample(at+.025*Math.sin((t-at)*28)*Math.sin(Math.PI*(t-at)/hold)**2);else if(t<recoveryStart)f=source.sample(at+(beat.start-at)*smooth((t-at-hold)/retreat));else f=source.sample(rerack+t-recoveryStart);return {...f,time:t,duration,...(t>=at&&t<recoveryStart?{phase:'attempt-failed',rep:failedRep}:{})};};
    const beats=source.beats.filter(b=>b.end<=beat.start).concat({id:'press-'+failedRep,label:'Attempt, stall and recover',start:beat.start,end:recoveryStart,rep:failedRep,failed:true},source.beats.filter(b=>b.start>=rerack).map(b=>({...b,start:recoveryStart+b.start-rerack,end:recoveryStart+b.end-rerack})));
    action={duration,beats,sample:failedSample};
   }
  }else if(item.name==='pullup')action=createPullupAction3D({...common,bar:project.pullup,settings:{...project.settings,reps,effort,tempo,failedRep,variation:w.pullupStyle&&w.pullupStyle!=='varied'?w.pullupStyle:random()<.5?'left-lead':'right-lead',restBetweenReps:effort>.65}});
  else if(item.name==='drink')action=createDrinkAction3D({...common,bottle:project.bottle,settings:{duration:w.drinkDuration,soleHeight:initialBench.measurements.soleHeight}});
  else action=createRestAction3D({...common,frame:previous,duration:w.restDuration});
  const issue=audit(action);if(issue)throw Error(issue);
  const startFrame=action.sample(0),destination=startFrame.placement,origin=previous.placement;
  const walking=item.name!=='rest'&&(distance(origin.position??[0,0,0],destination.position??[0,0,0])>1e-5||JSON.stringify(origin.rotation)!==JSON.stringify(destination.rotation)||JSON.stringify(previous.pose)!==JSON.stringify(startFrame.pose));
  const walk=walking?createLocomotionAction3D({...common,from:origin,to:destination,settings:{waypoints:waypoints(origin,destination),fromPose:previous.pose,toPose:startFrame.pose,soleHeight:initialBench.measurements.soleHeight}}):null;
  if(walk){const issue=audit(walk);if(issue)throw Error('Walking route: '+issue);}
  return {item,action:walk??action,next:walk?action:null,walking,started:time,reps,failed,failedRep,completedReps:0,cancelled:false,mechanicalError:null};
 }
 function begin(){if(stopped||current)return;if(stopRequested){stopped=true;return;}const item=pending??{name:stats.dehydration>=project.workout.drinkThreshold?'drink':stats.fatigue>=project.workout.restThreshold?'rest':project.workout.sequence[sequenceIndex%project.workout.sequence.length],request:'auto-'+(++autoSerial)};pending=null;
  try{current=plan(item);}catch(error){lastOutcome={action:item.name,type:'mechanical-invalid',error:error.message};stats.mechanicalFailures++;emit('actor.action.failed',item,error.message);stopRequested=true;stopped=true;current=null;}
 }
 function audit(action){const points=new Set([0,action.duration,...(action.beats??[]).flatMap(b=>[0,.1,.25,.5,.75,.9,1].map(u=>Math.min(action.duration,b.start+(b.end-b.start)*u)))]);for(const at of points){const frame=action.sample(at);if(frame.valid===false)return 'Mechanism could not satisfy its authored contacts or joint limits.';}return null;}
 function finish(){const c=current;previous=c.action.sample(c.action.duration);const error=c.mechanicalError??audit(c.action);if(error){stats.mechanicalFailures++;lastOutcome={action:c.item.name,type:'mechanical-invalid',error};emit('actor.action.failed',c.item,error);current=null;stopped=true;stopRequested=true;return;}
  if(c.walking&&c.next&&!c.cancelled&&!stopRequested){c.action=c.next;c.next=null;c.walking=false;c.started=time;return;}
  if(c.cancelled||stopRequested){emit('actor.command.cancelled',c.item,'Stopped at a safe action boundary.');lastOutcome={action:c.item.name,type:'cancelled'};}
  else if(c.item.name==='bench'||c.item.name==='pullup'){
   stats.sets++;stats.fatigue=clamp(stats.fatigue+5);stats.dehydration=clamp(stats.dehydration+3);stats[c.failed?'failures':'successes']++;sequenceIndex++;lastOutcome={action:c.item.name,type:c.failed?'exercise-failure':'success',reps:c.failed?Math.max(0,c.failedRep-1):c.reps};emit(c.failed?'actor.action.failed':'actor.action.completed',c.item,c.failed?'The exercise attempt failed; recovery completed safely.':undefined);
  }else{if(project.workout.sequence[sequenceIndex%project.workout.sequence.length]===c.item.name)sequenceIndex++;if(c.item.name==='drink'){stats.dehydration=clamp(stats.dehydration-55);stats.fatigue=clamp(stats.fatigue-8);stats.drinks++;}else stats.fatigue=clamp(stats.fatigue-35);lastOutcome={action:c.item.name,type:'success'};emit('actor.action.completed',c.item);}
  current=null;if(stopRequested)stopped=true;
 }
 function updateReps(){if(!current||current.walking||!['bench','pullup'].includes(current.item.name))return;const completed=(current.action.beats??[]).filter(b=>b.rep&&b.end<=time-current.started+1e-9&&!b.failed&&(!current.failed||b.rep<current.failedRep)).length;if(completed>current.completedReps){const count=completed-current.completedReps;stats.reps+=count;stats.fatigue=clamp(stats.fatigue+count*3);stats.dehydration=clamp(stats.dehydration+count*1.5);current.completedReps=completed;}}
 function stopCurrent(){if(!current)return;const local=time-current.started,tail=current.action.interrupt?.(local);if(tail?.supported){current.action={duration:tail.duration,beats:[],sample:tail.sample};current.started=time;current.next=null;current.walking=false;}}
 function apply(control){
  if(control.type==='variable'){stats[control.name]=control.value;return;}
  if(control.type==='request'){if(pending)emit('actor.command.cancelled',pending,'Replaced by another queued request.');pending={name:control.action,request:control.request};stopped=false;stopRequested=false;return;}
  if(control.type==='cancel'){if(pending?.request===control.request){emit('actor.command.cancelled',pending,'Queued request cancelled.');pending=null;}if(current?.item.request===control.request){current.cancelled=true;stopCurrent();}return;}
  if(control.type==='stop'){stopRequested=true;if(pending){emit('actor.command.cancelled',pending,'Workout stopping.');pending=null;}if(current){current.cancelled=true;stopCurrent();}else stopped=true;}
 }
 function advance(target){let transitions=0;while(true){
   begin();while(journalCursor<journal.length&&journal[journalCursor].time<=time+1e-9)apply(journal[journalCursor++]);
   begin();const commandTime=journal[journalCursor]?.time??Infinity,end=current?current.started+current.action.duration:Infinity,next=Math.min(target,commandTime,end);
   time=next;updateReps();
   if(end<=time+1e-9){finish();if(++transitions>256)throw Error('Seek spans too many workout decisions; sample smaller intervals.');continue;}
   if(commandTime<=time+1e-9)continue;
   return;
  }}
 function sample(target){checkTime(target);if(target<time-1e-9){initialize();begin();}advance(target);return wrap(current?current.action.sample(time-current.started):neutral());}
 function control(entry){if(journal.length>=4096)throw Error('Workout control history is full; reset before adding more commands.');if(journalCursor<journal.length)throw Error('Cannot edit past workout history; sample the latest recorded time or reset.');journal.push({...entry,time});apply(entry);journalCursor=journal.length;}
 const describe=()=>({actors:[{id:'atlas',actions:[...names]}],anchors:['bench','pullup','bottle'],variables:{fatigue:{min:0,max:100},dehydration:{min:0,max:100}}});
 initialize();begin();
 return {get duration(){return Infinity;},get beats(){return (current?.action.beats??[]).map(b=>({...b,start:b.start+current.started,end:b.end+current.started}));},sample,snapshot,describe,
  setVariable(name,value){if(!['fatigue','dehydration'].includes(name)||!Number.isFinite(value)||value<0||value>100)throw Error('Workout variables are fatigue/dehydration in 0..100.');control({type:'variable',name,value});},
  request(action,{request,target}={}){if(!names.includes(action))throw Error('Unknown workout action.');if(target!==undefined&&target!==station[action])throw Error('Unsupported target for this workout action.');if(request!==undefined&&(typeof request!=='string'||!request.trim()||request.length>128))throw Error('Request ID must be 1..128 characters.');request=request??'workout-'+(++serial);if(journal.some(c=>c.type==='request'&&c.request===request))throw Error('Request ID has already been used.');control({type:'request',action,request});return request;},
  cancel(request){if(typeof request!=='string')throw Error('Expected a request ID.');control({type:'cancel',request});},
  interrupt(at=time){sample(at);control({type:'stop'});return {supported:true};},
  reset(){const cancellations=[];for(const item of [current?.item,pending].filter(Boolean))cancellations.push({sequence:++eventSerial,type:'actor.command.cancelled',actor:'atlas',request:item.request,action:item.name,time,error:'Workout reset.'});resetEvents=cancellations;resetSequence=eventSerial;journal.length=0;serial=0;initialize();begin();return sample(0);}
 };
}
