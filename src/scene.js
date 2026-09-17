import { AnimationController, clamp, forwardKinematics, constrainPose, sampleClip } from './index.js';
import { assertDocument } from './schema.js';
import {poseDefaults,spatialChannels} from './spatial.js';
import {RecoveryMotion} from './recovery.js';
import { PhysicalCharacter, behaviorConfig, behaviorModes } from './physics.js';
export const STEP = 1 / 120;

export function compilePack(pack) {
  const defaults = poseDefaults(pack);
  const states = Object.fromEntries(Object.entries(pack.states).map(([id, state]) => [id, { clip: state.clip, transitions: (state.transitions || []).map(t => ({ to: t.to, duration: t.duration, when: inputs => inputs[t.when.input] === t.when.equals })) }]));
  return { joints: pack.joints, defaults, inputs: pack.inputs, clips: pack.clips, layers: [{ name: 'action', mode: 'override', weight: 1, initial: pack.initial, mask: Object.keys(defaults), neutral: defaults, states }] };
}

export class SceneController {
  constructor(document, { reducedMotion = false } = {}) {
    this.document = structuredClone(assertDocument(document)); this.reducedMotion = reducedMotion;
    this.listeners = new Set(); this.log = []; this.playing = true; this.animationPlaying = true; this.reset();
  }
  reset() {
    this.log = [];
    this.actors = this.document.actors.map(actor => {
      const pack = this.document.packs[actor.pack], runtime = new AnimationController(compilePack(pack));
      for (const [name, value] of Object.entries(actor.inputs || {})) runtime.setInput(name, value);
      runtime.subscribe(event => { if (!this.replaying) for (const fn of this.listeners) fn({ ...event, actor: actor.id }); });
      return { actor, pack, runtime, behavior:behaviorConfig(actor.behavior), response:{state:'calm',until:0}, physics:null,recovery:null,quiet:0, spring: { x: 0, y: 0, vx: 0, vy: 0 } };
    });
    this.time = 0; this.accumulator = 0; this.motion = { ax: 0, ay: 0 }; this.baseline = null;
    for(const a of this.actors)if(a.behavior.autoRecover&&a.behavior.mode!=='floating'&&a.behavior.mode!=='animated'){a.recovery=new RecoveryMotion(this.document,a.actor,a.pack,this.frame().actors.find(f=>f.id===a.actor.id),{walkX:a.actor.transform.x});a.recovery.tick(1);}
    return this.frame();
  }
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
    if (![ax, ay].every(Number.isFinite)) throw new Error('Acceleration must be finite CSS pixels/s².');
    const next = { ax: clamp(ax, -6000, 6000), ay: clamp(ay, -6000, 6000) };
    const changed = next.ax !== this.motion.ax || next.ay !== this.motion.ay;
    this.motion = next;
    if (!this.replaying && changed) this.record({ type: 'acceleration', ...this.motion });
  }
  record(event) {
    if (this.time > 60) return;
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
  tick() {
    this.time += STEP;
    for (const a of this.actors) {
      a.runtime.step(this.reducedMotion || !this.animationPlaying ? 0 : STEP);
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
    return { time: this.time, actors: this.actors.map(({ actor, pack, runtime, spring, preview,behavior,response,physics,recovery }) => {
      let pose = preview ? { ...runtime.definition.defaults, ...sampleClip({ ...pack.clips[preview.clip], loop: false }, preview.time), ...preview.overrides } : { ...runtime.frame.pose };
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
      return { id: actor.id, pose, inputs, world, response:response.state, physics:behavior.mode==='animated'?null:physics?.diagnostics||null, recovery:recovery?{phase:recovery.phase,blocked:recovery.blocked,target:{x:recovery.to.x,y:recovery.to.y}}:null,state: recovery?.phase==='walking'||recovery?.phase==='returning'?'walk':preview?.clip || runtime.layers[0].state, spring: { ...spring } };
    }) };
  }
  seek(time) {
    if (!Number.isFinite(time) || time < 0 || time > 60) throw new Error('Seek range is 0..60 seconds.');
    const log = this.log.map(e => ({ ...e })), wasPlaying = this.playing;
    this.replaying = true; this.reset(); let cursor = 0;
    try {
      const apply = () => { while (cursor < log.length && log[cursor].time <= this.time + 1e-9) { const e = log[cursor++]; if (e.type === 'input') this.setInput(e.actor, e.name, e.value); else if(e.type==='behavior')this.setBehavior(e.actor,e.value);else if(e.type==='walk')this.walkTo(e.actor,e.x);else if(e.type==='interaction')this.interact(e.actor,e.interaction,e.strength);else this.setAcceleration(e.ax, e.ay); } };
      while (this.time + STEP <= time + 1e-9) { apply(); this.tick(); } apply();
    } finally { this.log = log; this.replaying = false; this.playing = wasPlaying; }
    return this.frame();
  }
  dispose() { this.pause(); this.listeners.clear(); }
}
