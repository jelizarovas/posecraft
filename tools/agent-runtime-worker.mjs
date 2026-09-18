import {parentPort,workerData} from 'node:worker_threads';
import {SceneController,STEP} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
import {objectGrip} from '../src/scene-objects.js';

const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
function event(runtime,e){switch(e.type){case'input':runtime.setInput(e.actor,e.name,e.value);break;case'variable':runtime.setVariable(e.name,e.value);break;case'event':runtime.dispatch(e.event,e.payload||{});break;case'pointer':runtime.pointer(e.command);break;case'object':runtime.objectCommand(e.command);break;case'acceleration':if(!finite(e.ax,-6000,6000)||!finite(e.ay,-6000,6000))throw Error('Acceleration must be within ±6000.');runtime.setAcceleration(e.ax,e.ay);break;case'interaction':runtime.interact(e.actor,e.interaction,e.strength??1);break;case'behavior':runtime.setBehavior(e.actor,e.value);break;default:throw Error('Unsupported simulation event.');}}
function run({kind,document,options={}}){
 const duration=kind==='preview'?(options.time??0):(options.duration??1);if(!finite(duration,0,60))throw Error('Time must be within 0..60 seconds.');
 const events=options.events??[];if(!Array.isArray(events)||events.length>256||events.some((e,i)=>!e||!finite(e.time,0,duration)||(i&&e.time<events[i-1].time)||!['input','variable','event','pointer','object','acceleration','interaction','behavior'].includes(e.type)))throw Error('Supply at most 256 ordered supported events within the duration.');
 const sampleCount=options.samples??12;if(!Number.isInteger(sampleCount)||sampleCount<1||sampleCount>120)throw Error('Samples must be 1..120.');
 const runtime=new SceneController(document),emitted=[],samples=[],errors=new Map();runtime.subscribe(e=>{if(emitted.length<512)emitted.push(e)});let cursor=0,lastSample=-Infinity,frame=runtime.frame();
 const applyEvents=()=>{while(cursor<events.length&&events[cursor].time<=runtime.time+1e-8)event(runtime,events[cursor++]);};
 const collect=()=>{samples.push({time:frame.time,actors:frame.actors.map(a=>({id:a.id,state:a.state,response:a.response,activity:a.activity,position:{x:a.world[document.packs[document.actors.find(v=>v.id===a.id).pack].joints[0].id].x,y:a.world[document.packs[document.actors.find(v=>v.id===a.id).pack].joints[0].id].y}})),behavior:frame.behavior,contacts:(frame.contacts||[]).filter(c=>c.active).map(c=>({id:c.id,error:c.error,limited:c.limited}))});lastSample=frame.time;};
 try{
  applyEvents();frame=runtime.frame();collect();while(runtime.time+STEP<=duration+1e-8){applyEvents();frame=runtime.step(STEP);for(const c of frame.contacts||[])if(c.active&&c.error>(errors.get(c.id)?.error||0))errors.set(c.id,{id:c.id,error:c.error,time:frame.time,limited:c.limited});if(kind==='simulate'&&samples.length<sampleCount&&frame.time-lastSample>=duration/Math.max(1,sampleCount-1)-STEP/2)collect();}
  applyEvents();frame=runtime.frame();
  if(options.preview){const p=options.preview;if(typeof p.actor!=='string'||typeof p.clip!=='string'||!finite(p.time,0,180))throw Error('Preview needs actor, clip and time 0..180.');frame=runtime.previewClip(p.actor,p.clip,p.time);}
  const ownership=(frame.objects||[]).filter(o=>o.owner).flatMap(o=>{const p=objectGrip(document,frame,o.owner),error=p?Math.hypot(o.x-p.x,o.y-p.y):Infinity;return error>.5?[{severity:'warning',code:p?'ownership-contact-error':'invalid-ownership',path:'objects.'+o.id+'.owner',message:p?'Owned object is separated from its grip.':'Owned object has no visible valid grip.',details:{actor:o.owner.actor,joint:o.owner.joint,error:Number.isFinite(error)?error:null}}]:[]});
  const diagnostics=[...errors.values()].filter(c=>c.error>.5).map(c=>({severity:'warning',code:'contact-error',path:'contacts.'+c.id,message:'Active contact exceeded 0.5 scene units during simulation.',details:c})).concat(ownership);
  if(kind==='preview')return {time:frame.time,revision:document.revision,svg:renderSVG(document,frame),diagnostics};
  return {revision:document.revision,fixedStep:STEP,time:frame.time,inputEventsApplied:cursor,samples,frame,events:emitted,eventLimit:512,diagnostics};
 }finally{runtime.dispose();}
}
try{const result=run(workerData);if(JSON.stringify(result).length>8_000_000)throw Error('Simulation result exceeds 8 MB.');parentPort.postMessage({result});}catch(error){parentPort.postMessage({error:error.message,diagnostics:error.diagnostics});}
