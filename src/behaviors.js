import {validateObjectCommand} from './scene-objects.js';
import {ActionVariations,validateActivities} from './action-variations.js';
import {PoseBindings,validatePoseBindings} from './pose-bindings.js';
const id=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/,eventName=/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),number=v=>Number.isFinite(v)&&Math.abs(v)<=1000000,value=v=>typeof v==='boolean'||number(v);
export const BEHAVIOR_LIMITS=Object.freeze({states:32,edges:128,variables:32,actions:16,queue:64,events:16,transitions:8});
export const behaviorEnsembleEvents=['conversation','doze','meteor','share','share-missed','share-help','burn','fire-off','fire-relight','fire-on','food-throw','face-shoo','food-ready'];
export function validBehaviorInput(document,actor,input,value){const a=document.actors.find(a=>a.id===actor),spec=document.packs[a?.pack]?.inputs?.[input];return !!spec&&typeof value===spec.type&&(!spec.options||spec.options.includes(value))&&(spec.type!=='number'||Number.isFinite(value)&&value>=spec.min&&value<=spec.max);}
export function validateBehaviorEvent(document,event,payload={}){if(typeof event!=='string'||!eventName.test(event)||!object(payload)||Object.keys(payload).some(k=>!['actor','x','y','object','game'].includes(k))||payload.actor!==undefined&&!document.actors.some(a=>a.id===payload.actor)||payload.object!==undefined&&!document.objects?.some(o=>o.id===payload.object)||payload.game!==undefined&&!document.objectGames?.some(g=>g.id===payload.game)||['x','y'].some(k=>payload[k]!==undefined&&!number(payload[k])))throw Error('Invalid scene event or payload.');return {...payload};}
export function validateBehaviorVariable(graph,name,next){if(!graph||!Object.hasOwn(graph.variables,name)||!value(next)||typeof next!==typeof graph.variables[name])throw Error('Unknown behavior variable or invalid value.');}
/** Data-only validation shared by scene loading and the lightweight runtime. */
export function validateBehaviorGraph(document,check){
 validatePoseBindings(document,check);
 if(document.presentation!==undefined)check(['live','sequence'].includes(document.presentation),'presentation','Expected live or sequence.');
 const g=document.behaviorGraph;if(g===undefined)return;
 check(object(g),'behaviorGraph','Expected behavior graph.');if(!object(g))return;
 check(Number.isInteger(g.seed)&&g.seed>=0&&g.seed<=4294967295,'behaviorGraph.seed','Expected unsigned seed.');
 check(object(g.variables)&&Object.keys(g.variables).length<=32,'behaviorGraph.variables','Expected at most 32 variables.');
 for(const [name,v] of Object.entries(object(g.variables)?g.variables:{}))check(id.test(name)&&value(v),'behaviorGraph.variables.'+name,'Expected named boolean or finite number within +/-1000000.');
 check(object(g.states)&&Object.keys(g.states).length>0&&Object.keys(g.states).length<=32,'behaviorGraph.states','Expected 1..32 states.');
 const states=object(g.states)?g.states:{};check(typeof g.initial==='string'&&Object.hasOwn(states,g.initial),'behaviorGraph.initial','Missing initial state.');
 const actor=a=>a==='$actor'||document.actors.some(v=>v.id===a);
 const validateActions=(actions,p,allowPerform=true)=>{check(Array.isArray(actions)&&actions.length<=16,p,'Expected at most 16 actions.');if(!Array.isArray(actions))return;
  for(const action of actions){check(object(action),p,'Expected action.');if(!object(action))continue;
   if(action.type==='set')check(object(g.variables)&&Object.hasOwn(g.variables,action.variable)&&value(action.value)&&typeof action.value===typeof g.variables[action.variable],p,'Invalid variable assignment.');
   else if(action.type==='add')check(typeof g.variables?.[action.variable]==='number'&&number(action.value),p,'Invalid numeric variable addition.');
   else if(action.type==='perform')check(allowPerform&&object(g.activities)&&Object.hasOwn(g.activities,action.activity),p,'Invalid activity or recursive perform effect.');
   else if(action.type==='input')check(actor(action.actor)&&(action.actor==='$actor'?document.actors.some(a=>validBehaviorInput(document,a.id,action.input,action.value)):validBehaviorInput(document,action.actor,action.input,action.value)),p,'Invalid actor input action.');
   else if(action.type==='emitter')check(document.emitters?.some(e=>e.id===action.emitter)&&typeof action.enabled==='boolean',p,'Invalid emitter action.');
   else if(action.type==='ensemble')check(!!document.ensemble&&behaviorEnsembleEvents.includes(action.event)&&(action.actor===undefined||actor(action.actor)),p,'Invalid ensemble event action.');
   else if(action.type==='object'){try{validateObjectCommand(document,action.command);}catch(e){check(false,p,e.message);}}
   else if(action.type==='event')check(typeof action.event==='string'&&eventName.test(action.event)&&(action.actor===undefined||actor(action.actor)),p,'Invalid scene event action.');
   else check(false,p,'Unknown behavior action.');
  }
 };
 validateActivities(document,check,validateActions);
 for(const [name,state] of Object.entries(states)){const p='behaviorGraph.states.'+name;check(id.test(name)&&object(state),p,'Expected named state.');if(object(state))validateActions(state.actions,p);}
 check(g.handlers===undefined||Array.isArray(g.handlers)&&g.handlers.length<=32,'behaviorGraph.handlers','Expected at most 32 event handlers.');const handlerEvents=new Set();for(const handler of Array.isArray(g.handlers)?g.handlers:[]){const p='behaviorGraph.handlers';check(object(handler)&&typeof handler.event==='string'&&eventName.test(handler.event)&&!handlerEvents.has(handler.event),p,'Handlers need unique event names.');if(object(handler)){handlerEvents.add(handler.event);validateActions(handler.actions,p);}}
 check(Array.isArray(g.edges)&&g.edges.length<=128,'behaviorGraph.edges','Expected at most 128 edges.');const ids=new Set();
 for(const edge of Array.isArray(g.edges)?g.edges:[]){const p='behaviorGraph.edges';check(object(edge),p,'Expected edge.');if(!object(edge))continue;
  check(typeof edge.id==='string'&&id.test(edge.id)&&!ids.has(edge.id),p,'Edges need unique stable IDs.');ids.add(edge.id);
  check((edge.from==='*'||Object.hasOwn(states,edge.from))&&Object.hasOwn(states,edge.to),p,'Missing edge state.');
  check(Number.isFinite(edge.weight)&&edge.weight>0&&edge.weight<=1000,p,'Expected positive branch weight <=1000.');
  check((edge.event!==undefined)!==(edge.after!==undefined),p,'Choose an event or a time delay.');
  if(edge.event!==undefined)check(typeof edge.event==='string'&&eventName.test(edge.event),p,'Invalid event name.');
  if(edge.after!==undefined)check(object(edge.after)&&Number.isFinite(edge.after.min)&&Number.isFinite(edge.after.max)&&edge.after.min>=0&&edge.after.max>=edge.after.min&&edge.after.max<=86400,p,'Expected ordered delay 0..86400 seconds.');
  if(edge.when!==undefined){const w=edge.when;check(object(w)&&object(g.variables)&&Object.hasOwn(g.variables,w.variable)&&['eq','neq','gt','gte','lt','lte'].includes(w.op)&&value(w.value)&&typeof w.value===typeof g.variables[w.variable]&&(['eq','neq'].includes(w.op)||typeof w.value==='number'),p,'Invalid variable condition.');}
 }
}
const condition=(w,variables)=>!w||({eq:(a,b)=>a===b,neq:(a,b)=>a!==b,gt:(a,b)=>a>b,gte:(a,b)=>a>=b,lt:(a,b)=>a<b,lte:(a,b)=>a<=b}[w.op])(variables[w.variable],w.value);
/** A seeded finite-state machine with no timers, callbacks in data or history replay. */
export class BehaviorRuntime {
 constructor(document,{apply=()=>{}}={}){const errors=[];validateBehaviorGraph(document,(ok,path,message)=>{if(!ok)errors.push(path+': '+message);});if(errors.length||!document.behaviorGraph)throw Error(errors.join('; ')||'Missing behavior graph.');this.document=document;this.bindings=new PoseBindings(document);this.graph=document.behaviorGraph;this.apply=apply;this.handlers=new Map((this.graph.handlers||[]).map(h=>[h.event,h.actions]));this.outgoing=new Map(Object.keys(this.graph.states).map(state=>[state,this.graph.edges.filter(e=>e.from===state||e.from==='*')]));this.reset();}
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 reset(){this.time=0;this.rng=this.graph.seed>>>0;this.variables={...this.graph.variables};for(const name of Object.keys(this.variables))this.variables[name]=this.boundedVariable(name,this.variables[name]);this.activities=new ActionVariations(this.document,{random:()=>this.random(),variables:()=>this.variables,effects:(actions,payload)=>this.runActions(actions,payload)});this.queue=[];this.emitterOverrides={};this.transitions=0;this.droppedEvents=0;this.enter(this.graph.initial,{});return this.snapshot();}
 enter(state,payload){this.state=state;this.enteredAt=this.time;this.payload={...payload};this.deadlines=new Map();for(const edge of this.outgoing.get(state))if(edge.after)this.deadlines.set(edge.id,this.time+edge.after.min+(edge.after.max-edge.after.min)*(edge.after.max===edge.after.min?0:this.random()));
  this.runActions(this.graph.states[state].actions,payload);
 }
 runActions(actions,payload){for(const original of actions){const action={...original};if(action.actor==='$actor')action.actor=payload.actor;
   if(action.type==='set')this.setVariable(action.variable,action.value);
   else if(action.type==='add')this.variables[action.variable]=this.boundedVariable(action.variable,this.variables[action.variable]+action.value);
   else if(action.type==='perform')this.activities.start(action.activity,this.time,payload);
   else if(action.type==='event'){const next={...payload};if(action.actor)next.actor=action.actor;this.dispatch(action.event,next);}
   else if(action.type==='emitter'){this.emitterOverrides[action.emitter]={enabled:action.enabled};this.apply(action,payload);}
   else if(action.type==='input'){if(action.actor&&validBehaviorInput(this.document,action.actor,action.input,action.value))this.apply(action,payload);}
   else if(action.type==='object')this.apply(action,payload);
   else if(action.type==='ensemble'){if(original.actor==='$actor'&&!action.actor)continue;this.apply(action,{...payload,...(action.actor?{actor:action.actor}:{})});}
  }
 }
 dispatch(event,payload={}){const safe=validateBehaviorEvent(this.document,event,payload);if(this.queue.length>=64){this.droppedEvents++;return false;}this.queue.push({event,payload:safe});return true;}
 boundedVariable(name,value){const bounds=this.graph.variableBounds?.[name];return typeof value==='number'?Math.max(bounds?.min??-1000000,Math.min(bounds?.max??1000000,value)):value;}
 setVariable(name,value){validateBehaviorVariable(this.graph,name,value);this.variables[name]=this.boundedVariable(name,value);}
 hasActivity(actor){return this.activities.actions.has(actor);}
 actionPose(actor){return this.activities.pose(actor);}
 bindFrame(frame,options){return this.bindings.apply(frame,this.variables,options);}
 cancelActivity(actor){return this.activities.cancel(actor);}
 tick(dt){if(!Number.isFinite(dt)||dt<0)throw Error('Behavior elapsed time must be finite and nonnegative.');this.time+=dt;this.activities.advance(this.time);let transitions=0,events=0;
  while(transitions<8&&events<16){const pending=this.queue.shift();if(pending){events++;this.runActions(this.handlers.get(pending.event)||[],pending.payload);}const outgoing=this.outgoing.get(this.state),choices=outgoing.filter(edge=>condition(edge.when,this.variables)&&(pending?edge.event===pending.event:edge.after&&this.time+1e-9>=this.deadlines.get(edge.id)));
   if(!choices.length){if(pending)continue;break;}
   let edge=choices[0];if(choices.length>1){let threshold=this.random()*choices.reduce((sum,e)=>sum+e.weight,0);for(const candidate of choices){threshold-=candidate.weight;if(threshold<0){edge=candidate;break;}}}
   this.transitions++;transitions++;this.enter(edge.to,pending?.payload||this.payload);
  }
  return this.snapshot();
 }
 snapshot(){return {actions:this.activities.snapshot(),state:this.state,variables:{...this.variables},enteredAt:this.enteredAt,time:this.time,transitions:this.transitions,droppedEvents:this.droppedEvents,pendingEvents:this.queue.length};}
}
