import {validBehaviorInput,validateBehaviorVariable,validateBehaviorEvent} from './behaviors.js';
import {behaviorConfig} from './physics.js';

const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const fields=(v,keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k));
const finite=(v,min=-1000000,max=1000000)=>Number.isFinite(v)&&v>=min&&v<=max;
const check=(ok,message)=>{if(!ok)throw new Error('Invalid game snapshot: '+message);};
const sameKeys=(a,b)=>record(a)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>Object.hasOwn(a,k));
const copy=v=>structuredClone(v);
const rootOf=pack=>pack.physics?.root??pack.joints.find(j=>!j.parent)?.id;

// A compatibility stamp, not a security signature. Sorting makes JSON round trips
// independent of object insertion order. Changed scene content requires migration.
export function gameSceneSignature(document){
 const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':record(v)?'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
 const text=canonical(document);let a=2166136261,b=0x9e3779b9;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}
 return `pc1-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}-${text.length}`;
}

function supported(document){
 check(!document.ensemble&&!document.fluid&&!document.objectGames?.length,'specialized ensembles, fluids and prop games do not support semantic saves yet.');
}
function graphState(runtime){
 if(!runtime)return null;
 return {state:runtime.state,variables:copy(runtime.variables),age:Math.max(0,runtime.time-runtime.enteredAt),rng:runtime.rng>>>0,payload:copy(runtime.payload),deadlines:Object.fromEntries([...runtime.deadlines].map(([id,time])=>[id,Math.max(0,time-runtime.time)])),emitters:copy(runtime.emitterOverrides)};
}
function validateGraph(document,graph,state){
 if(!graph){check(state===null,'unexpected behavior state.');return;}
 check(fields(state,['state','variables','age','rng','payload','deadlines','emitters'])&&Object.hasOwn(graph.states,state.state),'unknown behavior state.');
 check(sameKeys(state.variables,graph.variables),'behavior variables differ.');
 for(const [name,value] of Object.entries(state.variables)){validateBehaviorVariable(graph,name,value);const bounds=graph.variableBounds?.[name];check(!bounds||finite(value,bounds.min,bounds.max),'behavior variable outside authored bounds.');}
 check(finite(state.age,0,1e9)&&Number.isInteger(state.rng)&&finite(state.rng,0,4294967295),'invalid behavior clock or random seed.');
 validateBehaviorEvent(document,'restore',state.payload);
 const timed=Object.fromEntries(graph.edges.filter(e=>(e.from===state.state||e.from==='*')&&e.after).map(e=>[e.id,e]));
 check(sameKeys(state.deadlines,timed)&&Object.values(state.deadlines).every(v=>finite(v,0,86400)),'invalid behavior timers.');
 check(record(state.emitters)&&Object.entries(state.emitters).every(([id,v])=>document.emitters?.some(e=>e.id===id)&&fields(v,['enabled'])&&typeof v.enabled==='boolean'),'unknown emitter override.');
}
function restoreGraph(runtime,state,time){
 if(!runtime)return;
 runtime.state=state.state;runtime.variables=copy(state.variables);runtime.time=time;runtime.enteredAt=time-state.age;runtime.rng=state.rng;runtime.payload=copy(state.payload);
 runtime.deadlines=new Map(Object.entries(state.deadlines).map(([id,remaining])=>[id,time+remaining]));runtime.emitterOverrides=copy(state.emitters);
 // Never re-enter a state or replay handlers/rewards during loading. Host calls,
 // graph activities and queued events are deliberately not resumable promises.
 runtime.queue=[];runtime.activities.actions.clear();runtime.transitions=0;runtime.droppedEvents=0;
}

/** JSON-safe semantic save. Transient performances/velocities are not captured. */
export function captureGameState(controller){
 supported(controller.document);
 check(controller.actors.every(a=>a.behavior.mode==='animated'&&!a.physics&&!a.preview&&!a.recovery),'save requires animated actors without physical recovery or preview.');
 controller.frame();
 const state={format:'posecraft-game-state',version:1,scene:gameSceneSignature(controller.document),time:controller.time,
  actors:controller.actors.map(a=>{const root=rootOf(a.pack),position=controller.gamePerformance.ground.get(a.actor.id);return {id:a.actor.id,sleeping:!!a.sleeping,inputs:copy(a.runtime.inputs),state:a.runtime.layers[0].state,clipTime:a.runtime.layers[0].time,root,position:position?{x:position[root+'.x']??0,y:position[root+'.y']??0}:null};}),
  behavior:graphState(controller.graph),actorBehaviors:(controller.actorBehaviors?.scopes||[]).map(({spec,runtime})=>({id:spec.id,state:graphState(runtime)})),
  objects:(controller.objects?.bodies||[]).map(b=>({id:b.id,x:b.x,y:b.y,rotation:b.rotation,enabled:b.enabled,owner:copy(b.owner)}))};
 return validateGameState(controller.document,state);
}

/** All validation precedes mutation, including references and authored bounds. */
export function validateGameState(document,input){
 supported(document);
 check(fields(input,['format','version','scene','time','actors','behavior','actorBehaviors','objects'])&&input.format==='posecraft-game-state'&&input.version===1,'unsupported format/version.');
 check(input.scene===gameSceneSignature(document),'scene content differs; migrate the save explicitly.');
 check(finite(input.time,0,1e9),'invalid scene clock.');
 check(Array.isArray(input.actors)&&input.actors.length===document.actors.length,'actor layout differs.');
 const seen=new Set();
 for(const a of input.actors){const actor=document.actors.find(v=>v.id===a?.id),pack=document.packs[actor?.pack];check(fields(a,['id','sleeping','inputs','state','clipTime','root','position'])&&actor&&!seen.has(a.id),'unknown or duplicate actor.');seen.add(a.id);check(typeof a.sleeping==='boolean','invalid sleep state.');
  check(sameKeys(a.inputs,pack.inputs)&&Object.entries(a.inputs).every(([name,value])=>validBehaviorInput(document,a.id,name,value)),'invalid actor inputs.');
  check(Object.hasOwn(pack.states,a.state)&&finite(a.clipTime,0,1e9),'invalid animation state or clock.');
  check(a.root===rootOf(pack)&&(a.position===null||fields(a.position,['x','y'])&&finite(a.position.x)&&finite(a.position.y)),'invalid actor position.');
 }
 validateGraph(document,document.presentation==='sequence'?null:document.behaviorGraph,input.behavior);
 const scopes=document.presentation==='sequence'?[]:document.actorBehaviors||[];
 check(Array.isArray(input.actorBehaviors)&&input.actorBehaviors.length===scopes.length,'actor behavior layout differs.');seen.clear();
 for(const entry of input.actorBehaviors){const spec=scopes.find(s=>s.id===entry?.id);check(fields(entry,['id','state'])&&spec&&!seen.has(entry.id),'unknown or duplicate actor behavior.');seen.add(entry.id);validateGraph(document,spec.graph,entry.state);}
 check(Array.isArray(input.objects)&&input.objects.length===(document.objects?.length||0),'object layout differs.');seen.clear();
 for(const entry of input.objects){const spec=document.objects.find(s=>s.id===entry?.id);check(fields(entry,['id','x','y','rotation','enabled','owner'])&&spec&&!seen.has(entry.id),'unknown or duplicate object.');seen.add(entry.id);
  check(finite(entry.x)&&finite(entry.y)&&finite(entry.rotation)&&typeof entry.enabled==='boolean','invalid object transform or enabled state.');
  if(entry.owner!==null){const o=entry.owner,actor=document.actors.find(a=>a.id===o?.actor),pack=document.packs[actor?.pack];check(fields(o,['actor','joint','offsetX','offsetY','breakDistance'])&&spec.mass>0&&entry.enabled&&pack?.joints.some(j=>j.id===o.joint)&&!input.actors.find(a=>a.id===o.actor)?.sleeping,'invalid object owner.');for(const k of ['offsetX','offsetY','breakDistance'])if(o[k]!==undefined)check(finite(o[k],k==='breakDistance'?1:-2000,k==='breakDistance'?500:2000),'invalid grip offset.');}
 }
 return copy(input);
}

export function restoreGameState(controller,input){
 const state=validateGameState(controller.document,input);
 controller.gamePerformance.cancelAll('Scene restored.');controller.gamePerformance.held.clear();controller.gamePerformance.ground.clear();
 controller.time=state.time;controller.accumulator=0;controller.motion={ax:0,ay:0};controller.baseline=null;controller.log=[];controller.checkpoints.clear();controller.pointers?.reset();
 for(const saved of state.actors){const a=controller.actors.find(a=>a.actor.id===saved.id);a.sleeping=false;a.sleepFrame=null;a.physics=null;a.recovery=null;a.preview=null;a.quiet=0;a.spring={x:0,y:0,vx:0,vy:0};a.response={state:'calm',until:0};a.behavior=behaviorConfig({...a.actor.behavior,mode:'animated'});
  a.runtime.inputs=copy(saved.inputs);a.runtime.time=state.time;Object.assign(a.runtime.layers[0],{state:saved.state,time:saved.clipTime,transition:null});a.runtime.frame=a.runtime.evaluate();
  if(saved.position)controller.gamePerformance.ground.set(saved.id,{[saved.root+'.x']:saved.position.x,[saved.root+'.y']:saved.position.y});
 }
 restoreGraph(controller.graph,state.behavior,state.time);
 for(const saved of state.actorBehaviors)restoreGraph(controller.actorBehaviors.scopes.find(s=>s.spec.id===saved.id).runtime,saved.state,state.time);
 if(controller.objects){controller.objects.reset();controller.objects.time=state.time;for(const saved of state.objects){const b=controller.objects.bodies.find(b=>b.id===saved.id);Object.assign(b,copy(saved),{previousX:saved.x,previousY:saved.y,vx:0,vy:0});}}
 const frame=controller.frame();for(const saved of state.actors)if(saved.sleeping){const a=controller.actors.find(a=>a.actor.id===saved.id);a.sleeping=true;a.sleepFrame=copy(frame.actors.find(f=>f.id===saved.id));}
 return controller.frame();
}
