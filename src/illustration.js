import {validateFluidCommand} from './bottle-validation.js';
import {AnimationController,clamp,constrainPose,forwardKinematics,sampleClip} from './index.js';
import {assertDocument} from './schema.js';
import {poseDefaults,spatialChannels} from './spatial.js';
import {mountSVG} from './svg.js';
import {validateBehaviorEvent,validateBehaviorVariable} from './behaviors.js';

const STEP=1/120;
function compile(pack){const defaults=poseDefaults(pack);return {joints:pack.joints,defaults,inputs:pack.inputs,clips:pack.clips,layers:[{name:'action',mode:'override',weight:1,initial:pack.initial,mask:Object.keys(defaults),neutral:defaults,states:Object.fromEntries(Object.entries(pack.states).map(([id,state])=>[id,{clip:state.clip,transitions:(state.transitions||[]).map(t=>({to:t.to,duration:t.duration,when:inputs=>inputs[t.when.input]===t.when.equals}))}]))}]};}

/** Authored animation and bounded scene effects, with optional feature providers.
 * It deliberately cannot switch to a physical simulation at runtime. */
export class IllustrationController {
  constructor(document,{reducedMotion=false,ensembleFactory,contactSolver,behaviorFactory,pointerFactory,fluidFactory}={}){
    this.document=structuredClone(assertDocument(document));
    if(this.document.actors.some(a=>(a.behavior?.mode||'animated')!=='animated'))throw new Error('This scene requires the physics runtime.');
    for(const [needed,provider,name] of [[document.fluid,fluidFactory,'bottle fluid'],[document.ensemble,ensembleFactory,'ensemble'],[document.contacts?.length,contactSolver,'contacts'],[document.behaviorGraph&&document.presentation!=='sequence',behaviorFactory,'behaviors'],[document.interactions?.length,pointerFactory,'pointer interactions']])if(needed&&!provider)throw new Error(`Missing illustration provider: ${name}.`);
    this.providers={ensembleFactory,contactSolver,behaviorFactory,pointerFactory,fluidFactory};this.reducedMotion=reducedMotion;this.playing=true;this.animationPlaying=true;this.listeners=new Set();this.reset();
  }
  reset(){
    this.log=[];this.time=0;this.accumulator=0;this.motion={ax:0,ay:0};this.baseline=null;
    this.actors=this.document.actors.map(actor=>{const pack=this.document.packs[actor.pack],runtime=new AnimationController(compile(pack));for(const [key,value] of Object.entries(actor.inputs||{}))runtime.setInput(key,value);runtime.subscribe(event=>this.emit({...event,actor:actor.id}));return {actor,pack,runtime,behavior:{mode:'animated',autoFace:true,...actor.behavior},response:{state:'calm',until:0},spring:{x:0,y:0,vx:0,vy:0}};});
    this.fluid=this.document.fluid?new this.providers.fluidFactory(this.document):null;
    this.ensemble=this.document.ensemble?new this.providers.ensembleFactory(this.document):null;
    this.behaviors=null;this.behaviors=this.document.behaviorGraph&&this.document.presentation!=='sequence'?new this.providers.behaviorFactory(this.document,{apply:(action,payload)=>this.applyBehavior(action,payload)}):null;
    this.pointers=this.document.interactions?.length?new this.providers.pointerFactory(this.document,{dispatch:(event,payload)=>this.dispatch(event,payload)}):null;
    return this.frame();
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(event){if(this.replaying)return;for(const fn of this.listeners)fn({time:this.time,...event});}
  respond(a,state,duration=0,strength=1){if(a.response.state!==state)this.emit({type:'response',actor:a.actor.id,from:a.response.state,to:state,strength});a.response={state,until:this.time+duration,strength};}
  actor(id){const actor=this.actors.find(a=>a.actor.id===id);if(!actor)throw new Error(`Missing actor ${id}.`);return actor;}
  record(event){if(this.replaying||this.applyingGraph||this.applyingPointer||this.time>180)return;while(this.log.length&&this.log.at(-1).time>this.time)this.log.pop();if(this.log.length>=20000)throw new Error('Replay recording is full. Reset to start a new recording.');this.log.push({time:this.time,...event});}
  setInput(id,name,value){const a=this.actor(id),previous=a.runtime.inputs[name];a.runtime.setInput(name,value);if(previous!==value)this.record({type:'input',actor:id,name,value});}
  applyBehavior(action,payload){this.applyingGraph=true;try{
    if(action.type==='input')this.setInput(action.actor,action.input,action.value);
    else if(action.type==='ensemble')this.triggerEnsemble(action.event,payload);
    else if(action.type==='emitter')this.ensemble?.setEmitterEnabled?.(action.emitter,action.enabled);
  }finally{this.applyingGraph=false;}}
  dispatch(event,payload={}){const safe=validateBehaviorEvent(this.document,event,payload);if(!this.behaviors)return false;this.record({type:'dispatch',event,payload:safe});const accepted=this.behaviors.dispatch(event,safe);this.behaviors.tick(0);return accepted;}
  setVariable(name,value){validateBehaviorVariable(this.document.behaviorGraph,name,value);if(!this.behaviors)return;this.record({type:'variable',name,value});this.behaviors.setVariable(name,value);this.behaviors.tick(0);}
  fluidInput(command){
    if(!this.fluid)throw new Error('This scene has no bottle fluid.');const safe=validateFluidCommand(command);this.frame();this.fluid.command(safe);
    const manualStep=this.replaying?!!this.replayFluidManualStep:this.reducedMotion||!this.playing||!this.animationPlaying;if(manualStep)this.fluid.tick(STEP);
    if(!this.replaying){const previous=this.log.at(-1);if(['move','motion','wind'].includes(safe.type)&&previous?.type==='fluid'&&previous.time===this.time&&previous.command.type===safe.type&&!manualStep&&!previous.manualStep)previous.command=safe;else this.record({type:'fluid',command:safe,manualStep});}
    return this.frame();
  }
  pointer(command){if(!this.pointers)throw new Error('This scene has no pointer interactions.');this.frame();this.applyingPointer=true;try{this.pointers?.input(command);}finally{this.applyingPointer=false;}this.record({type:'pointer',command:{...command}});return this.frame();}
  triggerEnsemble(type,payload={}){payload=validateBehaviorEvent(this.document,type,payload);if(!this.ensemble)throw new Error('This scene has no ensemble.');this.ensemble.advance(this.time,this.excluded());this.ensemble.trigger(type,payload);this.record({type:'ensemble',event:type,payload});}
  excluded(){return new Set(this.actors.filter(a=>a.preview||a.runtime.inputs.action&&a.runtime.inputs.action!=='campfire').map(a=>a.actor.id));}
  interact(id,type,strength=1){const a=this.actor(id),states={tap:'startled',pet:'happy',startle:'scared',drop:'falling',toss:'falling',hurt:'hurt',catch:'relieved'};if(!states[type]||!Number.isFinite(strength)||strength<0||strength>2)throw new Error('Invalid character interaction.');this.respond(a,states[type],['drop','toss'].includes(type)?0:type==='hurt'?1.25:.7,strength);this.emit({type:'interaction',actor:id,interaction:type,strength});this.record({type:'interaction',actor:id,interaction:type,strength});}
  setBehavior(id,value){this.actor(id);if(value.mode&&value.mode!=='animated')throw new Error('Physical motion requires the physics runtime.');Object.assign(this.actor(id).behavior,value);this.record({type:'behavior',actor:id,value:{...value}});}
  previewClip(id,clip,time,overrides={}){const a=this.actor(id);if(!a.pack.clips[clip]||!Number.isFinite(time)||time<0||time>a.pack.clips[clip].duration)throw new Error('Invalid clip preview.');for(const [key,value] of Object.entries(overrides))if(!Object.hasOwn(a.runtime.definition.defaults,key)||!Number.isFinite(value)||spatialChannels[key.split('.')[1]]&&(value<spatialChannels[key.split('.')[1]].min||value>spatialChannels[key.split('.')[1]].max))throw new Error('Invalid pose override.');a.preview={clip,time,overrides:{...overrides}};return this.frame();}
  clearPreview(id){this.actor(id).preview=null;}
  setAcceleration(ax,ay){if(![ax,ay].every(Number.isFinite))throw new Error('Acceleration must be finite.');const next={ax:clamp(ax,-6000,6000),ay:clamp(ay,-6000,6000)},changed=next.ax!==this.motion.ax||next.ay!==this.motion.ay;this.motion=next;if(changed)this.record({type:'acceleration',...next});}
  sampleHost({x,y,time,teleport=false}){if(![x,y,time].every(Number.isFinite))throw new Error('Host samples must be finite.');const old=this.baseline,dt=old?time-old.time:0;if(teleport||!old||dt<=0||dt>.1||Math.hypot(x-old.x,y-old.y)>300){this.baseline={x,y,time,vx:null,vy:null};this.setAcceleration(0,0);return;}const blend=1-Math.exp(-dt/.06),vx=old.vx===null?(x-old.x)/dt:old.vx+((x-old.x)/dt-old.vx)*blend,vy=old.vy===null?(y-old.y)/dt:old.vy+((y-old.y)/dt-old.vy)*blend;this.setAcceleration(old.vx===null?0:(vx-old.vx)/dt,old.vy===null?0:(vy-old.vy)/dt);this.baseline={x,y,time,vx,vy};}
  rebaseline(){this.baseline=null;this.setAcceleration(0,0);this.accumulator=0;}
  play(){this.playing=true;this.rebaseline();}pause(){this.playing=false;this.rebaseline();}
  step(dt){if(!Number.isFinite(dt)||dt<0)throw new Error('Time must be finite and nonnegative.');if(!this.playing)return this.frame();this.accumulator+=Math.min(dt,.1);while(this.accumulator+1e-10>=STEP){this.tick();this.accumulator-=STEP;}return this.frame();}
  tick(){
    this.time+=STEP;if(this.fluid&&!this.reducedMotion&&this.animationPlaying)this.fluid.tick(STEP);if(this.behaviors&&this.ensemble){this.ensemble.advance(this.time,this.excluded());for(const {event,...payload} of this.ensemble.drainEvents?.()||[])this.behaviors.dispatch(event,payload);}this.behaviors?.tick(STEP);this.pointers?.step(STEP);
    for(const a of this.actors){const directed=this.ensemble&&!a.preview&&(a.actor.unlit||a.runtime.inputs.action==='campfire'&&a.runtime.layers[0].state==='campfire');if(!directed)a.runtime.step(this.reducedMotion||!this.animationPlaying?0:STEP);if(this.reducedMotion){a.runtime.layers.forEach(layer=>layer.transition=null);a.runtime.frame=a.runtime.evaluate();}if(this.time>=a.response.until){const moving=Math.hypot(this.motion.ax,this.motion.ay)>1800;this.respond(a,moving?'startled':'calm',moving?.25:0);}const r=a.pack.reaction,s=a.spring;if(r&&!this.reducedMotion)for(const axis of ['x','y']){const v='v'+axis;s[v]+=(-this.motion['a'+axis]*.6*r.strength-r.stiffness*s[axis]-r.damping*s[v])*STEP;s[axis]=clamp(s[axis]+s[v]*STEP,-15,15);if(Math.abs(s[axis])===15)s[v]=0;}}
  }
  frame(){
    let frame={time:this.time,effectsTime:this.reducedMotion?0:this.time,actors:this.actors.map(({actor,pack,runtime,preview,spring,response,behavior})=>{
      let pose=preview?{...runtime.definition.defaults,...sampleClip({...pack.clips[preview.clip],loop:false},preview.time),...preview.overrides}:{...runtime.frame.pose};const inputs={...runtime.inputs},emotion={startled:'surprised',scared:'scared',falling:'scared',hurt:'hurt',relieved:'relieved',happy:'happy'}[response.state];if(behavior.autoFace!==false&&emotion&&pack.inputs.emotion?.options.includes(emotion))inputs.emotion=emotion;for(const [key,value] of Object.entries(pack.expressions?.[inputs.emotion]||{}))pose[key]+=value;if(pack.reaction&&!this.reducedMotion){const key=pack.reaction.joint;pose[key+'.rotation']+=spring.x;pose[key+'.x']+=spring.x*1.2;pose[key+'.y']+=spring.y;}pose=constrainPose(runtime.joints,pose);const clip=preview?.clip||pack.states[runtime.layers[0].state]?.clip,definition=pack.clips[clip],elapsed=preview?.time??runtime.layers[0].time;return {id:actor.id,clip,clipTime:preview?elapsed:definition?.loop?elapsed%definition.duration:Math.min(elapsed,definition?.duration??elapsed),pose,inputs,world:forwardKinematics(runtime.joints,pose),response:response.state,physics:null,recovery:null,state:preview?.clip||runtime.layers[0].state,spring:{...spring}};
    })};
    if(this.ensemble)frame=this.ensemble.apply(frame,this.excluded());if(this.fluid)frame=this.fluid.apply(frame,{disabledActors:new Set(this.actors.filter(a=>a.preview).map(a=>a.actor.id))});if(this.behaviors){frame.behavior=this.behaviors.snapshot();frame.emitterOverrides={...this.behaviors.emitterOverrides,...frame.emitterOverrides};}if(this.pointers)frame=this.pointers.apply(frame);if(this.providers.contactSolver)frame=this.providers.contactSolver(this.document,frame);return frame;
  }
  seek(time){
    if(!Number.isFinite(time)||time<0||time>180)throw new Error('Seek range is 0..180 seconds.');
    const log=this.log.map(event=>({...event})),playing=this.playing,reduced=this.reducedMotion,animating=this.animationPlaying;
    this.replaying=true;this.reset();this.reducedMotion=false;this.animationPlaying=true;let cursor=0;
    try{const apply=()=>{while(cursor<log.length&&log[cursor].time<=this.time+1e-9){const e=log[cursor++];if(e.type==='fluid'){this.replayFluidManualStep=e.manualStep;this.fluidInput(e.command);this.replayFluidManualStep=false;}else if(e.type==='input')this.setInput(e.actor,e.name,e.value);else if(e.type==='pointer')this.pointer(e.command);else if(e.type==='dispatch')this.dispatch(e.event,e.payload);else if(e.type==='variable')this.setVariable(e.name,e.value);else if(e.type==='ensemble')this.triggerEnsemble(e.event,e.payload);else if(e.type==='interaction')this.interact(e.actor,e.interaction,e.strength);else if(e.type==='behavior')this.setBehavior(e.actor,e.value);else this.setAcceleration(e.ax,e.ay);}};while(this.time+STEP<=time+1e-9){apply();this.tick();}apply();}
    finally{this.log=log;this.replaying=false;this.reducedMotion=reduced;this.playing=playing;this.animationPlaying=animating;}
    return this.frame();
  }
  dispose(){this.pause();this.listeners.clear();}
}

export function mountIllustration(element,document,{host=element,reducedMotion='system',onEvent,onError,label,autoplay=true,mountPointers,mountBottleControls,...providers}={}){
  const media=matchMedia('(prefers-reduced-motion: reduce)'),controller=new IllustrationController(document,{...providers,reducedMotion:reducedMotion==='system'?media.matches:!!reducedMotion}),renderer=mountSVG(element,controller.document,controller.frame(),{label});
  const unsubscribe=onEvent?controller.subscribe(onEvent):()=>{};let disposed=false,raf=0,last=null,visible=true;
  const resetClock=()=>{last=null;controller.rebaseline();};
  function schedule(){if(!disposed&&!raf&&visible&&!globalThis.document.hidden&&controller.playing&&!controller.reducedMotion)raf=requestAnimationFrame(tick);}
  function tick(now){raf=0;if(disposed||!visible||globalThis.document.hidden||!controller.playing||controller.reducedMotion){last=null;return;}try{const rect=host.getBoundingClientRect();controller.sampleHost({x:rect.x,y:rect.y,time:now/1000});renderer.update(controller.step(last===null?0:(now-last)/1000));last=now;schedule();}catch(error){controller.pause();onError?.(error);if(!onError)throw error;}}
  const refresh=()=>{renderer.update(controller.frame());resetClock();schedule();};
  const bottle=mountBottleControls?.(element,controller.document,controller,{isEnabled:()=>!disposed,onUpdate:()=>renderer.update(controller.frame())});
  const pointers=mountPointers?.(element,controller.document,controller,{isEnabled:()=>!disposed,onUpdate:()=>renderer.update(controller.frame())});
  const policy=()=>{controller.reducedMotion=reducedMotion==='system'?media.matches:!!reducedMotion;refresh();},visibility=()=>{resetClock();schedule();};
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();}):null;observer?.observe(element);
  const size=typeof ResizeObserver==='function'?new ResizeObserver(resetClock):null;size?.observe(element);
  media.addEventListener('change',policy);globalThis.document.addEventListener('visibilitychange',visibility);if(!autoplay)controller.pause();schedule();
  return {controller,fluidInput(command){renderer.update(controller.fluidInput(command));},enableMotion(){if(!bottle)throw new Error('This scene has no bottle controls.');return bottle.enableMotion();},disableMotion(){bottle?.disableMotion();},setVariable(name,value){controller.setVariable(name,value);refresh();},pointer(command){renderer.update(controller.pointer(command));},setInput(actor,name,value){controller.setInput(actor,name,value);if(controller.reducedMotion)controller.tick();refresh();},dispatch(event,payload){controller.dispatch(event,payload);refresh();},interact(actor,type,strength){controller.interact(actor,type,strength);refresh();},play(){controller.play();refresh();},pause(){controller.pause();cancelAnimationFrame(raf);raf=0;},reset(){controller.reset();refresh();},seek(time){controller.seek(time);refresh();},dispose(){disposed=true;cancelAnimationFrame(raf);observer?.disconnect();size?.disconnect();media.removeEventListener('change',policy);globalThis.document.removeEventListener('visibilitychange',visibility);if(typeof pointers==='function')pointers();else pointers?.dispose?.();bottle?.dispose();unsubscribe();renderer.dispose();controller.dispose();}};
}
