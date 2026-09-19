import {ActorBehaviorRuntime} from './actor-behaviors.js';
import {actorBehaviorContext,tickActorBehaviors} from './actor-signals.js';
import {applyMotionLayers} from './motion-layers.js';
import {ReplayCheckpoints} from './replay-checkpoints.js';
import {captureIllustrationState,restoreIllustrationState} from './illustration-checkpoint.js';
import {SceneObjects,validateObjectCommand,objectEventPayload} from './scene-objects.js';
import {PropGameRuntime} from './prop-games.js';
import {BottleFluid} from './bottle-fluid.js';
import {validateFluidCommand} from './bottle-validation.js';
import {ScenePointerInteraction} from './pointer-interactions.js';
import {BehaviorRuntime,validateBehaviorEvent,validateBehaviorVariable} from './behaviors.js';
import {applyContacts} from './contacts.js';
import {CampfireEnsemble,ensembleEvents} from './ensemble.js';
import { AnimationController, clamp, forwardKinematics, constrainPose, sampleClip } from './index.js';
import { assertDocument } from './schema.js';
import {poseDefaults,spatialChannels} from './spatial.js';
import {RecoveryMotion} from './recovery.js';
import {GamePerformance} from './game-performance.js';
import {captureGameState,restoreGameState} from './game-state.js';
import { PhysicalCharacter, behaviorConfig, behaviorModes } from './physics.js';
export const STEP = 1 / 120;

export function compilePack(pack) {
  const defaults = poseDefaults(pack);
  const states = Object.fromEntries(Object.entries(pack.states).map(([id, state]) => [id, { clip: state.clip, transitions: (state.transitions || []).map(t => ({ to: t.to, duration: t.duration, when: inputs => inputs[t.when.input] === t.when.equals })) }]));
  return { joints: pack.joints, defaults, inputs: pack.inputs, clips: pack.clips, layers: [{ name: 'action', mode: 'override', weight: 1, initial: pack.initial, mask: Object.keys(defaults), neutral: defaults, states }] };
}

export class SceneController {
  constructor(document, { reducedMotion = false, checkpoints } = {}) {
    this.document = structuredClone(assertDocument(document)); this.reducedMotion = reducedMotion;
    this.checkpoints=new ReplayCheckpoints(checkpoints===false?{enabled:false}:checkpoints);this.checkpointRevision=this.document.revision;
    this.listeners = new Set(); this.log = []; this.playing = true; this.animationPlaying = true; this.reset();
  }
  reset() {
    this.gamePerformance?.cancelAll('Scene reset.');this.gamePerformance=new GamePerformance(this);
    if(!this.replaying)this.checkpoints.clear();this.checkpointRevision=this.document.revision;
    this.log = [];
    this.actors = this.document.actors.map(actor => {
      const pack = this.document.packs[actor.pack], runtime = new AnimationController(compilePack(pack));
      for (const [name, value] of Object.entries(actor.inputs || {})) runtime.setInput(name, value);
      runtime.subscribe(event => { if (!this.replaying) for (const fn of this.listeners) fn({ ...event, actor: actor.id }); });
      return { actor, pack, runtime, behavior:behaviorConfig(actor.behavior), response:{state:'calm',until:0}, physics:null,recovery:null,quiet:0, spring: { x: 0, y: 0, vx: 0, vy: 0 } };
    });
    this.objects=this.document.objects?.length?new SceneObjects(this.document,{onEvent:e=>{if(e.type==='object-impact'&&e.actor)this.actors.find(a=>a.actor.id===e.actor)?.physics?.applyObjectImpulse(e);this.emit(e);this.graph?.dispatch(e.type,objectEventPayload(e));this.actorBehaviors?.dispatch(e.type,objectEventPayload(e));}}):null;
    this.propGames=this.document.objectGames?.length&&this.objects?new PropGameRuntime(this.document,this.objects,{onEvent:e=>{this.emit(e);this.graph?.dispatch(e.type,objectEventPayload(e));this.actorBehaviors?.dispatch(e.type,objectEventPayload(e));}}):null;
    this.fluid=this.document.fluid?new BottleFluid(this.document):null;
    this.ensemble=this.document.ensemble?new CampfireEnsemble(this.document):null;
    this.time = 0; this.accumulator = 0; this.motion = { ax: 0, ay: 0 }; this.baseline = null;
    this.graph=null;this.graph=this.document.behaviorGraph&&this.document.presentation!=='sequence'?new BehaviorRuntime(this.document,{apply:(action,payload)=>this.applyGraphAction(action,payload)}):null;
    this.actorBehaviors=this.document.actorBehaviors?.length&&this.document.presentation!=='sequence'?new ActorBehaviorRuntime(this.document,actorBehaviorContext(this)):null;
    if(this.ensemble)this.ensemble.authoredCooking=new Set((this.actorBehaviors?this.document.actorBehaviors:[]).filter(s=>s.outputs?.some(b=>b.source==='campfire.heat')).map(s=>s.actor));
    this.pointers=new ScenePointerInteraction(this.document,{dispatch:(event,payload)=>this.dispatch(event,payload)});
    for(const a of this.actors)if(a.behavior.autoRecover&&a.behavior.mode!=='floating'&&a.behavior.mode!=='animated'){a.recovery=new RecoveryMotion(this.document,a.actor,a.pack,this.frame().actors.find(f=>f.id===a.actor.id),{walkX:a.actor.transform.x});a.recovery.tick(1);}
    return this.frame();
  }
  objectCommand(command){if(!this.objects)throw Error('This scene has no shared objects.');const safe=validateObjectCommand(this.document,command),result=this.objects.command(safe,this.frame());if(!this.replaying)this.record({type:'object',command:safe});return result;}
  objectCommandAck(command){return this.objectCommand(command);}
  snapshot(){return captureGameState(this);}
  restore(snapshot){return restoreGameState(this,snapshot);}
  setActorSleeping(actorId,sleeping){
    const a=this.actors.find(a=>a.actor.id===actorId);if(!a||typeof sleeping!=='boolean')throw Error('Sleep needs an existing actor and boolean.');
    if(!!a.sleeping===sleeping)return true;
    if(sleeping){
      if(this.ensemble||this.fluid||this.propGames||a.behavior.mode!=='animated'||a.physics||a.recovery||a.preview||this.graph?.hasActivity(actorId)||this.objects?.bodies.some(b=>b.owner?.actor===actorId)||this.pointers?.active?.binding.actor===actorId)throw Error('Only animated actors without active physical, carried-object, preview or scene activity ownership can sleep.');
      for(const request of [...this.gamePerformance.active.values()])if(request.actor===actorId)this.gamePerformance.cancel(actorId,request.request,'Actor sleeping.');
      for(const [key,request] of this.gamePerformance.held)if(request.actor===actorId)this.gamePerformance.held.delete(key);
      a.sleepFrame=structuredClone(this.frame().actors.find(f=>f.id===actorId));a.sleeping=true;
    }else{a.sleeping=false;a.sleepFrame=null;}
    return true;
  }
  fluidInput(command){
    if(!this.fluid)throw new Error('This scene has no bottle fluid.');const safe=validateFluidCommand(command);this.frame();this.fluid.command(safe);
    const manualStep=this.replaying?!!this.replayFluidManualStep:this.reducedMotion||!this.playing||!this.animationPlaying;if(manualStep)this.fluid.tick(STEP);
    if(!this.replaying){const previous=this.log.at(-1);if(['move','motion','wind'].includes(safe.type)&&previous?.type==='fluid'&&previous.time===this.time&&previous.command.type===safe.type&&!manualStep&&!previous.manualStep){this.checkpoints.invalidateFrom(this.time);previous.command=safe;}else this.record({type:'fluid',command:safe,manualStep});}
    return this.frame();
  }
  pointer(command){this.frame();this.applyingPointer=true;try{this.pointers.input(command);}finally{this.applyingPointer=false;}if(!this.replaying)this.record({type:'pointer',command:{...command}});}
  applyGraphAction(action,payload){this.applyingGraph=true;try{if(action.type==='object')this.objectCommand(action.command);else if(action.type==='input')this.setInput(action.actor,action.input,action.value);else if(action.type==='ensemble')this.triggerEnsemble(action.event,payload);else if(action.type==='emitter')this.ensemble?.setEmitterEnabled?.(action.emitter,action.enabled);}finally{this.applyingGraph=false;}}
  dispatch(event,payload={}){const safe=validateBehaviorEvent(this.document,event,payload);if(!this.graph&&!this.actorBehaviors)return false;if(!this.replaying)this.record({type:'dispatch',event,payload:safe});const scoped=this.actorBehaviors?.dispatch(event,safe)||false,accepted=this.graph?.dispatch(event,safe)||false;this.graph?.tick(0);return accepted||scoped;}
  setActorVariable(actor,name,value){const spec=this.document.actorBehaviors?.find(s=>s.actor===actor);validateBehaviorVariable(spec?.graph,name,value);if(!this.actorBehaviors)return;this.actorBehaviors.setVariable(actor,name,value);this.record({type:'actor-variable',actor,name,value});}
  dispatchActor(actor,event,payload={}){return this.dispatch(event,{...payload,actor});}
  setVariable(name,value){validateBehaviorVariable(this.document.behaviorGraph,name,value);if(!this.graph)return;if(!this.replaying)this.record({type:'variable',name,value});this.graph.setVariable(name,value);this.graph.tick(0);}
  triggerEnsemble(type,payload={}){payload=validateBehaviorEvent(this.document,type,payload);if(!this.ensemble||!ensembleEvents.includes(type))throw new Error('Unknown ensemble event.');this.ensemble.advance(this.time,new Set(this.actors.filter(a=>a.preview||this.graph?.hasActivity(a.actor.id)||a.behavior.mode!=='animated'||a.runtime.inputs.action!=='campfire').map(a=>a.actor.id)));this.ensemble.trigger(type,payload);if(!this.replaying)this.record({type:'ensemble',event:type,payload});}
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event){if(!this.replaying)for(const fn of this.listeners)fn({...event,time:this.time});}
  respond(a,state,duration=.2,strength=1){
    if(a.response.state!==state)this.emit({type:'response',actor:a.actor.id,from:a.response.state,to:state,strength});
    a.response={state,until:this.time+duration,strength};
  }
  setBehavior(actorId,patch){
    const a=this.actors.find(a=>a.actor.id===actorId);if(!a)throw new Error('Missing actor.');
    const next=behaviorConfig({...a.behavior,...patch});
    if(!behaviorModes.includes(next.mode)||!['auto','brace','protect','curl'].includes(next.strategy)||typeof next.autoFace!=='boolean'||typeof next.autoRecover!=='boolean'||!Number.isFinite(next.resistance)||next.resistance<0||next.resistance>1||!Number.isFinite(next.gravity)||next.gravity<0||next.gravity>2||!Number.isFinite(next.bounce)||next.bounce<0||next.bounce>1)throw new Error('Invalid behavior settings.');
    if(next.mode!=='animated'&&!a.pack.physics)throw new Error('This pack has no physics profile.');
    if(JSON.stringify(next)===JSON.stringify(a.behavior)&&(next.mode==='animated'||a.physics||a.recovery))return;
    if((!next.autoRecover||next.mode==='floating')&&a.recovery){const f=this.frame().actors.find(v=>v.id===actorId);a.recovery=null;if(next.mode!=='animated')a.physics=new PhysicalCharacter(this.document,a.actor,a.pack,f,next);}
    if(next.mode==='animated'&&a.behavior.mode!=='animated'){a.recovery=null;a.physics=null;a.spring={x:0,y:0,vx:0,vy:0};this.respond(a,'calm',0);}
    if(next.mode!=='animated'&&!a.physics&&!a.recovery)a.physics=new PhysicalCharacter(this.document,a.actor,a.pack,this.frame().actors.find(v=>v.id===actorId),next);
    a.behavior=next;a.physics?.configure(next);
    if(!this.replaying)this.record({type:'behavior',actor:actorId,value:next});
  }
  interact(actorId,interaction,strength=1){
    const a=this.actors.find(a=>a.actor.id===actorId);
    if(!a||!['tap','pet','startle','drop','toss','hurt','catch'].includes(interaction)||!Number.isFinite(strength)||strength<0||strength>2)throw new Error('Invalid character interaction.');
    if(!this.replaying)this.record({type:'interaction',actor:actorId,interaction,strength});
    if(a.recovery&&['drop','toss','tap','hurt','startle'].includes(interaction)){const f=this.frame().actors.find(v=>v.id===actorId);a.recovery=null;if(a.behavior.mode!=='animated')a.physics=new PhysicalCharacter(this.document,a.actor,a.pack,f,a.behavior);}
    a.quiet=0;
    if(a.behavior.mode!=='animated'&&!a.physics)this.setBehavior(actorId,{});
    a.physics?.command(interaction,strength);
    const state={tap:'startled',pet:'happy',startle:'scared',drop:'falling',toss:'falling',hurt:'hurt',catch:'relieved'}[interaction];
    this.respond(a,state,['drop','toss'].includes(interaction)?0:interaction==='hurt'?1.25:.7,strength);
    this.emit({type:'interaction',actor:actorId,interaction,strength});
  }
  walkTo(actorId,x){
    const a=this.actors.find(a=>a.actor.id===actorId);
    if(!a?.pack.physics||!Number.isFinite(x)||x<0||x>this.document.bounds.width)throw new Error('Walk target must be inside the scene.');
    if(a.physics||a.recovery&& !['home','blocked','walking'].includes(a.recovery.phase))return;
    const frame=this.frame().actors.find(f=>f.id===actorId);a.recovery=new RecoveryMotion(this.document,a.actor,a.pack,frame,{walkX:x});
    if(!this.replaying)this.record({type:'walk',actor:actorId,x});
  }
  previewClip(actorId, clip, time, overrides = {}) {
    const a = this.actors.find(a => a.actor.id === actorId);
    if (!a || !a.pack.clips[clip] || !Number.isFinite(time) || time < 0 || time > a.pack.clips[clip].duration) throw new Error('Invalid clip preview.');
    for (const [key, value] of Object.entries(overrides)) if (!Object.hasOwn(a.runtime.definition.defaults, key) || !Number.isFinite(value)||(spatialChannels[key.split('.')[1]]&&(value<spatialChannels[key.split('.')[1]].min||value>spatialChannels[key.split('.')[1]].max))) throw new Error('Invalid pose override.');
    a.preview = { clip, time, overrides: { ...overrides } };
    return this.frame();
  }
  clearPreview(actorId) { const a = this.actors.find(a => a.actor.id === actorId); if (a) a.preview = null; }
  setInput(actorId, name, value) {
    const actor = this.actors.find(a => a.actor.id === actorId); if (!actor) throw new Error(`Missing actor ${actorId}`);
    const previous=actor.runtime.inputs[name];
    actor.runtime.setInput(name, value);
    if (!this.replaying&&previous!==value) this.record({ type: 'input', actor: actorId, name, value });
  }
  setAcceleration(ax, ay) {
    if (![ax, ay].every(Number.isFinite)) throw new Error('Acceleration must be finite CSS pixels/sÂ².');
    const next = { ax: clamp(ax, -6000, 6000), ay: clamp(ay, -6000, 6000) };
    const changed = next.ax !== this.motion.ax || next.ay !== this.motion.ay;
    this.motion = next;
    if (!this.replaying && changed) this.record({ type: 'acceleration', ...this.motion });
  }
  invalidateCheckpoints(){this.checkpoints.clear();}
  checkpointStats(){return this.checkpoints.stats();}
  record(event) {
    if(!this.replaying)this.checkpoints.invalidateFrom(this.time);
    if(this.applyingGraph||this.applyingPointer)return;
    if (this.time > 180) return;
    while (this.log.length && this.log.at(-1).time > this.time) this.log.pop();
    if (this.log.length >= 20000) throw new Error('Replay recording is full. Reset to start a new recording.');
    this.log.push({ time: this.time, ...event });
  }
  sampleHost({ x, y, time, teleport = false }) {
    if (![x, y, time].every(Number.isFinite)) throw new Error('Host samples need finite x, y, time in seconds.');
    const old = this.baseline, dt = old ? time - old.time : 0;
    if (teleport || !old || dt <= 0 || dt > .1 || Math.hypot(x - old.x, y - old.y) > 300) {
      this.baseline = { x, y, time, vx: null, vy: null }; this.setAcceleration(0, 0); return;
    }
    // Pointer events and animation frames arrive on different clocks. Smooth velocity
    // before differentiating so alternating move/empty frames do not cancel the impulse.
    const blend = 1 - Math.exp(-dt / .06);
    const rawX = (x - old.x) / dt, rawY = (y - old.y) / dt;
    const vx = old.vx === null ? rawX : old.vx + (rawX - old.vx) * blend;
    const vy = old.vy === null ? rawY : old.vy + (rawY - old.vy) * blend;
    this.setAcceleration(old.vx === null ? 0 : (vx - old.vx) / dt, old.vy === null ? 0 : (vy - old.vy) / dt);
    this.baseline = { x, y, time, vx, vy };
  }
  rebaseline() { this.baseline = null; this.setAcceleration(0, 0); this.accumulator = 0; }
  play() { this.playing = true; this.rebaseline(); }
  pause() { this.playing = false; this.rebaseline(); }
  step(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Time must be finite and nonnegative.');
    if (!this.playing) return this.frame();
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= STEP) { this.tick(); this.accumulator -= STEP; }
    return this.frame();
  }
  gameCommand(command){return this.gamePerformance.command(command);}
  tick() {
    this.time += STEP;
    this.gamePerformance?.tick(STEP,this.reducedMotion);
    if(this.objects&&!this.reducedMotion&&this.animationPlaying){this.objects.tick(STEP,this.frame());this.propGames?.tick(STEP,this.frame());}
    if(this.fluid&&!this.reducedMotion&&this.animationPlaying)this.fluid.tick(STEP);
    if(this.graph&&this.ensemble){this.ensemble.advance(this.time,new Set(this.actors.filter(a=>a.preview||this.graph?.hasActivity(a.actor.id)||a.behavior.mode!=='animated'||a.runtime.inputs.action&&a.runtime.inputs.action!=='campfire').map(a=>a.actor.id)));if(this.ensemble.drainEvents)for(const {event,...payload} of this.ensemble.drainEvents())this.graph.dispatch(event,payload);}
    this.graph?.tick(this.reducedMotion||!this.animationPlaying?0:STEP);
    tickActorBehaviors(this,this.reducedMotion||!this.animationPlaying?0:STEP,new Set(this.actors.filter(a=>a.sleeping||a.preview||this.graph?.hasActivity(a.actor.id)||a.behavior.mode!=='animated').map(a=>a.actor.id)));
    this.pointers?.step(STEP);
    for (const a of this.actors) {
      if(a.sleeping)continue;
      const directed=this.graph?.hasActivity(a.actor.id)||this.ensemble&&a.behavior.mode==='animated'&&!a.preview&&(a.actor.unlit||a.runtime.inputs.action==='campfire'&&a.runtime.layers[0].state==='campfire');
      if(!directed)a.runtime.step(this.reducedMotion || !this.animationPlaying ? 0 : STEP);
      if (this.reducedMotion) { a.runtime.layers.forEach(layer => layer.transition = null); a.runtime.frame = a.runtime.evaluate(); }
      const r = a.pack.reaction, s = a.spring;
      a.quiet=Math.hypot(this.motion.ax,this.motion.ay)>220?0:a.quiet+STEP;
      if(a.recovery&&!this.reducedMotion&&a.behavior.autoRecover&&a.behavior.mode!=='animated'&&Math.hypot(this.motion.ax,this.motion.ay)>320){const f=this.frame().actors.find(v=>v.id===a.actor.id);a.recovery=null;a.physics=new PhysicalCharacter(this.document,a.actor,a.pack,f,a.behavior);}
      if(a.recovery){if(!this.reducedMotion){const phase=a.recovery.tick(STEP);if(phase!=='home'||this.time>=a.response.until)this.respond(a,phase==='home'?'calm':phase,0);}}
      else if(a.behavior.mode!=='animated'&&!this.reducedMotion){
        if(!a.physics){try{a.physics=new PhysicalCharacter(this.document,a.actor,a.pack,this.frame().actors.find(v=>v.id===a.actor.id),a.behavior);}catch(error){a.behavior.mode='animated';this.respond(a,'unsupported',Number.MAX_VALUE);this.emit({type:'error',actor:a.actor.id,message:error.message});continue;}}
        const diagnostics=a.physics.tick(STEP,this.motion,a.runtime.frame.pose);
        if(diagnostics.impact){this.respond(a,'hurt',1.1,diagnostics.impact.strength);this.emit({type:'impact',actor:a.actor.id,...diagnostics.impact});}
        if(a.behavior.autoRecover&&a.behavior.mode!=='floating'&&a.quiet>1&&a.physics.time>1.5&&diagnostics.contacts.some(c=>c.normal.y<-.5)&&(a.physics.stable>.18||a.quiet>3)&&a.physics.time-a.physics.lastImpact>.7){
          a.recovery=new RecoveryMotion(this.document,a.actor,a.pack,this.frame().actors.find(v=>v.id===a.actor.id));a.physics=null;this.respond(a,'getting-up',0);
        }
        else if(this.time>=a.response.until){if(a.response.state==='hurt'&&a.behavior.mode==='protective')this.respond(a,'recovering',.7);else this.respond(a,diagnostics.state,0);}
      }else if(this.time>=a.response.until){
        const moving=Math.hypot(this.motion.ax,this.motion.ay)>1800;
        this.respond(a,moving?'startled':'calm',moving?.25:0);
      }
      if (r && !this.reducedMotion) {
        for (const axis of ['x', 'y']) {
          const v = 'v' + axis;
          s[v] += (-this.motion['a' + axis] * .6 * r.strength - r.stiffness * s[axis] - r.damping * s[v]) * STEP;
          s[axis] = clamp(s[axis] + s[v] * STEP, -15, 15);
          if (Math.abs(s[axis]) === 15) s[v] = 0;
        }
      }
    }
  }
  frame() {
    const frame={ time: this.time, effectsTime:this.reducedMotion?0:this.time, actors: this.actors.map(({ actor, pack, runtime, spring, preview,behavior,response,physics,recovery,sleeping,sleepFrame }) => {
      if(sleeping&&sleepFrame)return {...sleepFrame,sleeping:true};
      const action=!preview&&behavior.mode==='animated'?this.graph?.actionPose?.(actor.id):null;
      let pose = preview ? { ...runtime.definition.defaults, ...sampleClip({ ...pack.clips[preview.clip], loop: false }, preview.time), ...preview.overrides } : { ...(action?.pose||runtime.frame.pose) };
      const inputs={...runtime.inputs};
      const emotion={startled:'surprised',scared:'scared',falling:'scared',bracing:'focused',protecting:'scared',curling:'scared',hurt:'hurt',recovering:'dizzy','getting-up':'focused',returning:'relieved',walking:'happy',relieved:'relieved',happy:'happy'}[response.state];
      if(behavior.autoFace&&emotion&&pack.inputs.emotion?.options.includes(emotion))inputs.emotion=emotion;
      for (const [key, value] of Object.entries(pack.expressions?.[inputs.emotion] || {})) pose[key] += value;
      if (pack.reaction && !this.reducedMotion && behavior.mode==='animated') {
        const key = pack.reaction.joint;
        pose[`${key}.rotation`] += spring.x;
        pose[`${key}.x`] += spring.x * 1.2;
        pose[`${key}.y`] += spring.y;
      }
      pose = constrainPose(runtime.joints, pose);
      if(recovery){const authored=pose;pose={...pose,...recovery.pose};if(recovery.phase==='home'){const blend=clamp((recovery.time-recovery.standDuration-recovery.duration)/.35,0,1);for(const key of Object.keys(pose))if(!key.startsWith(pack.physics.root+'.'))pose[key]+=(authored[key]-pose[key])*blend;}}
      let world=forwardKinematics(runtime.joints,pose);
      if(physics&&behavior.mode!=='animated')({pose,world}=physics.apply(pose));
      const clip=preview?.clip||action?.clip||pack.states[runtime.layers[0].state]?.clip,definition=pack.clips[clip],elapsed=preview?.time??action?.clipTime??runtime.layers[0].time,clipTime=preview||action?elapsed:definition?.loop?elapsed%definition.duration:Math.min(elapsed,definition?.duration??elapsed);
      return { id: actor.id, clip, clipTime, ...(action?{activity:action.activity}:{}), pose, inputs, world, response:response.state, physics:behavior.mode==='animated'?null:physics?.diagnostics||null, recovery:recovery?{phase:recovery.phase,blocked:recovery.blocked,target:{x:recovery.to.x,y:recovery.to.y}}:null,state: recovery?.phase==='walking'||recovery?.phase==='returning'?'walk':preview?.clip || action?.activity || runtime.layers[0].state, spring: { ...spring } };
    }) };
    let evaluated=this.ensemble?this.ensemble.apply(frame,new Set(this.actors.filter(a=>a.preview||this.graph?.hasActivity(a.actor.id)||a.behavior.mode!=='animated'||a.runtime.inputs.action&&a.runtime.inputs.action!=='campfire').map(a=>a.actor.id))):frame;
    if(this.fluid)evaluated=this.fluid.apply(evaluated,{disabledActors:new Set(this.actors.filter(a=>a.preview).map(a=>a.actor.id))});
    if(this.graph){evaluated.behavior=this.graph.snapshot();evaluated.emitterOverrides={...this.graph.emitterOverrides,...evaluated.emitterOverrides};}
    evaluated=applyMotionLayers(this.document,evaluated,{disabledActors:new Set(this.actors.filter(a=>a.sleeping||a.preview).map(a=>a.actor.id))});
    if(this.actorBehaviors){evaluated.actorBehaviors=this.actorBehaviors.snapshot();evaluated.emitterOverrides={...evaluated.emitterOverrides,...this.actorBehaviors.emitterOverrides()};}
    if(this.propGames)evaluated=this.propGames.apply(evaluated,{disabledActors:new Set(this.actors.filter(a=>a.preview).map(a=>a.actor.id))});
    evaluated=this.gamePerformance?.apply(evaluated)||evaluated;
    if(this.objects&&this.document.contacts?.some(c=>['object','prop'].includes(c.target.type)))evaluated=this.objects.apply(evaluated);
    const constrained=applyContacts(this.document,this.pointers?.apply(evaluated)||evaluated),bound=this.graph?.bindFrame(constrained,{disabledActors:new Set(this.actors.filter(a=>a.sleeping||a.preview).map(a=>a.actor.id))})||constrained;
    for(let i=0;i<bound.actors.length;i++){const a=this.actors[i];if(a.sleeping&&a.sleepFrame)bound.actors[i]={...a.sleepFrame,sleeping:true};}
    return this.objects?this.objects.apply(bound):bound;
  }
  seek(time) {
    if(!Number.isFinite(time)||time<0||time>180)throw new Error('Seek range is 0..180 seconds.');
    this.gamePerformance?.cancelAll('Scene seek.');
    const log=structuredClone(this.log),wasPlaying=this.playing,wasAnimating=this.animationPlaying,wasReduced=this.reducedMotion,pool=this.checkpoints;
    if(this.checkpointRevision!==this.document.revision)pool.clear();pool.syncHistory(log);const checkpoint=pool.enabled?pool.find(time):null;
    this.animationPlaying=true;this.reducedMotion=false;this.replaying=true;this.reset();let cursor=0,lastCheckpoint=0,replayedTicks=0;
    try {
      if(checkpoint){restoreIllustrationState(this,checkpoint.state);cursor=checkpoint.cursor;lastCheckpoint=checkpoint.time;}
      const apply = () => { while (cursor < log.length && log[cursor].time <= this.time + 1e-9) { const e = log[cursor++]; if(e.type==='actor-variable')this.setActorVariable(e.actor,e.name,e.value);else if(e.type==='object')this.objectCommand(e.command);else if(e.type==='fluid'){this.replayFluidManualStep=e.manualStep;this.fluidInput(e.command);this.replayFluidManualStep=false;}else if(e.type==='pointer')this.pointer(e.command);else if(e.type==='dispatch')this.dispatch(e.event,e.payload);else if(e.type==='variable')this.setVariable(e.name,e.value);else if(e.type==='ensemble')this.triggerEnsemble(e.event,e.payload);else if (e.type === 'input') this.setInput(e.actor, e.name, e.value); else if(e.type==='behavior')this.setBehavior(e.actor,e.value);else if(e.type==='walk')this.walkTo(e.actor,e.x);else if(e.type==='interaction')this.interact(e.actor,e.interaction,e.strength);else this.setAcceleration(e.ax, e.ay); } };
      while(this.time+STEP<=time+1e-9){apply();this.tick();replayedTicks++;if(pool.enabled&&this.time-lastCheckpoint>=pool.interval-1e-9){
        // Planck bodies require solver/contact snapshots; never cache transforms alone.
        if(this.actors.every(a=>a.behavior.mode==='animated'&&!a.physics&&!a.recovery)){try{pool.store(this.time,cursor,captureIllustrationState(this));}catch(error){pool.reason=error.message;}}else pool.reason='Physical solver states replay from the last animated checkpoint or zero.';
        lastCheckpoint=this.time;
      }}apply();
    }finally{this.log=log;this.replaying=false;this.playing=wasPlaying;this.animationPlaying=wasAnimating;this.reducedMotion=wasReduced;pool.replayedTicks=replayedTicks;}
    return this.frame();
  }
  dispose() { this.gamePerformance?.cancelAll('Scene disposed.');this.pause(); this.listeners.clear(); this.checkpoints.clear(); }
}
