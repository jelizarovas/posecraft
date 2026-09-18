import {repairRotationCharts} from './rotation-interpolation.js';
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
export const wrapAngle = angle => ((angle + 180) % 360 + 360) % 360 - 180;
export const mixAngle = (a, b, t) => a + wrapAngle(b - a) * t;

export function interpolate(track, time, interpolation = 'smooth', angular = false) {
  if (time <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (time <= track[i][0]) {
      const [start, a] = track[i - 1];
      const [end, b] = track[i];
      const mode = track[i - 1][2] || interpolation;
      let t = (time - start) / (end - start);
      if (mode === 'step') t = time === end ? 1 : 0;
      if (mode === 'smooth') t = t * t * (3 - 2 * t);
      const value=angular==='yaw'&&Math.abs(Math.abs(b-a)-180)<1e-9?lerp(a,b,t):angular?mixAngle(a,b,t):lerp(a,b,t);
      return angular==='yaw'&&(value>180||value< -180)?wrapAngle(value):value;
    }
  }
  return track.at(-1)[1];
}

export function sampleClip(clip, elapsed, interpolation) {
  const time = clip.loop ? elapsed % clip.duration : Math.min(elapsed, clip.duration);
  const pose=Object.fromEntries(Object.entries(clip.tracks).map(([key, track]) => {const value=interpolate(track,time,interpolation,key.endsWith('.yaw')?'yaw':key.endsWith('.rotation'));return [key,key.endsWith('.rotation')&&(value>180||value< -180)?wrapAngle(value):value];}));
  return repairRotationCharts(clip.tracks,time,pose,interpolate,interpolation);
}

export function forwardKinematics(joints, pose) {
  const world = {};
  for (const joint of joints) {
    const parent = joint.parent ? world[joint.parent] : { x: 0, y: 0, rotation: 0 };
    const angle = radians(parent.rotation);
    const x = joint.x + (pose[`${joint.id}.x`] || 0);
    const y = joint.y + (pose[`${joint.id}.y`] || 0);
    const rotation = parent.rotation + (pose[`${joint.id}.rotation`] ?? joint.rotation);
    world[joint.id] = {
      x: parent.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: parent.y + x * Math.sin(angle) + y * Math.cos(angle), rotation,
      endX: parent.x + x * Math.cos(angle) - y * Math.sin(angle) + joint.length * Math.cos(radians(rotation)),
      endY: parent.y + x * Math.sin(angle) + y * Math.cos(angle) + joint.length * Math.sin(radians(rotation))
    };
  }
  return world;
}

export function constrainPose(joints, pose) {
  const result = { ...pose };
  for (const joint of joints) result[`${joint.id}.rotation`] = clamp(result[`${joint.id}.rotation`] ?? joint.rotation, joint.min, joint.max);
  return result;
}

// Analytic two-bone solution, followed by constrained coordinate descent.
// An unreachable target stops at the nearest pose found without breaking the rig.
export function solveTwoBoneIK(joints, source, chain, target, weight = 1) {
  const pose = constrainPose(joints, source);
  const upper = joints.find(j => j.id === chain.upper);
  const lower = joints.find(j => j.id === chain.lower);
  let world = forwardKinematics(joints, pose);
  const origin = world[upper.id];
  const parentRotation = upper.parent ? world[upper.parent].rotation : 0;
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const bend = chain.bend * Math.acos(clamp((distance * distance - upper.length ** 2 - lower.length ** 2) / (2 * upper.length * lower.length), -1, 1));
  const shoulder = Math.atan2(dy, dx) - Math.atan2(lower.length * Math.sin(bend), upper.length + lower.length * Math.cos(bend));
  pose[`${upper.id}.rotation`] = clamp(wrapAngle(degrees(shoulder) - parentRotation), upper.min, upper.max);
  pose[`${lower.id}.rotation`] = clamp(degrees(bend), lower.min, lower.max);
  for (let i = 0; i < 16; i++) {
    for (const joint of [lower, upper]) {
      world = forwardKinematics(joints, pose);
      const pivot = world[joint.id], end = world[lower.id];
      const delta = degrees(Math.atan2(target.y - pivot.y, target.x - pivot.x) - Math.atan2(end.endY - pivot.y, end.endX - pivot.x));
      const key = `${joint.id}.rotation`;
      pose[key] = clamp(pose[key] + wrapAngle(delta), joint.min, joint.max);
    }
  }
  for (const joint of [upper, lower]) {
    const key = `${joint.id}.rotation`;
    pose[key] = clamp(mixAngle(source[key] ?? joint.rotation, pose[key], clamp(weight, 0, 1)), joint.min, joint.max);
  }
  return pose;
}

function validateDefinition(definition) {
  const ids = new Set();
  for (const joint of definition.joints) {
    if (ids.has(joint.id) || (joint.parent && !ids.has(joint.parent))) throw new Error('Joints must have unique IDs and follow their parent.');
    if (![joint.x, joint.y, joint.length, joint.rotation, joint.min, joint.max].every(Number.isFinite) || joint.min > joint.max || joint.length < 0) throw new Error(`Invalid joint: ${joint.id}`);
    ids.add(joint.id);
  }
  for (const chain of definition.chains) {
    const upper = definition.joints.find(j => j.id === chain.upper), lower = definition.joints.find(j => j.id === chain.lower);
    if (!upper || !lower || lower.parent !== upper.id || upper.length <= 0 || lower.length <= 0 || lower.x !== upper.length || lower.y !== 0 || ![-1, 1].includes(chain.bend)) throw new Error('IK requires two connected, nonzero bones.');
  }
  for (const clip of Object.values(definition.clips)) {
    if (!(clip.duration > 0)) throw new Error('Clip duration must be positive.');
    for (const track of Object.values(clip.tracks)) {
      if (!track.length || track.some(([t, value], i) => !Number.isFinite(t) || !Number.isFinite(value) || t < 0 || t > clip.duration || (i && t <= track[i - 1][0]))) throw new Error('Keyframes must have finite values and strictly increasing times within the clip.');
    }
  }
  for (const layer of definition.layers) {
    if (!layer.states[layer.initial]) throw new Error('A layer needs a valid initial state.');
    for (const state of Object.values(layer.states)) {
      for (const name of state.blend ? state.blend.children.map(child => child.clip) : state.clip ? [state.clip] : []) if (!definition.clips[name]) throw new Error(`Missing clip: ${name}`);
      for (const transition of state.transitions || []) if (!layer.states[transition.to]) throw new Error(`Missing state: ${transition.to}`);
    }
  }
}

export class AnimationController {
  constructor(definition) {
    definition = { defaults: {}, inputs: {}, chains: [], clips: {}, layers: [], events: [], ...definition };
    validateDefinition(definition);
    this.definition = definition;
    this.joints = definition.joints.map(j => ({ ...j }));
    this.inputs = Object.fromEntries(Object.entries(definition.inputs).map(([key, input]) => [key, input.default]));
    this.layers = definition.layers.map(layer => ({ ...layer, state: layer.initial, time: 0, transition: null }));
    this.listeners = new Set();
    this.interpolation = 'smooth';
    this.time = 0;
    this.transitionDuration = .25;
    this.preview = null;
    this.take = { duration: 4, time: 0, tracks: {}, enabled: false, playing: false, weight: 1 };
    this.frame = this.evaluate();
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(type, detail = {}) { for (const listener of [...this.listeners]) listener({ type, time: this.time, ...detail }); }

  setInput(name, value) {
    const spec = this.definition.inputs[name];
    if (!spec || typeof value !== spec.type || (spec.type === 'number' && !Number.isFinite(value))) throw new TypeError(`Invalid input: ${name}`);
    if (spec.options && !spec.options.includes(value)) throw new TypeError(`Invalid option: ${name}`);
    if (spec.type === 'number') value = clamp(value, spec.min, spec.max);
    if (this.inputs[name] === value) return;
    this.inputs[name] = value;
    this.emit('input', { name, value });
  }

  setInterpolation(mode) {
    if (!['linear', 'smooth', 'step'].includes(mode)) throw new Error('Unknown interpolation mode.');
    this.interpolation = mode;
  }

  setLayerWeight(name, weight) {
    const layer = this.layers.find(item => item.name === name);
    if (!layer || !Number.isFinite(weight)) throw new Error('Invalid layer weight.');
    layer.weight = clamp(weight, 0, 1);
  }

  setKeyframe(id, time, rotation) {
    const joint = this.joints.find(j => j.id === id);
    if (!joint || ![time, rotation].every(Number.isFinite) || time < 0 || time > this.take.duration) throw new Error('Invalid joint keyframe.');
    const key = id + '.rotation';
    const track = this.take.tracks[key] || [];
    this.take.tracks[key] = [...track.filter(([t]) => Math.abs(t-time) > .001), [time, clamp(rotation,joint.min,joint.max)]].sort((a,b)=>a[0]-b[0]);
    this.take.enabled = true;
    this.preview = null;
    this.emit('keyframe', { joint:id, at:time });
  }

  removeKeyframe(id, time) {
    const key = id + '.rotation';
    if (!this.joints.some(j=>j.id===id) || !Number.isFinite(time)) throw new Error('Invalid keyframe selection.');
    const remaining = (this.take.tracks[key] || []).filter(([t])=>Math.abs(t-time)>.001);
    if (remaining.length) this.take.tracks[key]=remaining; else delete this.take.tracks[key];
  }

  seek(time) {
    if (!Number.isFinite(time)) throw new Error('Invalid timeline position.');
    this.take.time=clamp(time,0,this.take.duration);this.take.playing=false;this.take.enabled=true;this.preview=null;
    return this.step(0);
  }

  exportTake() {
    return { version: 1, duration: this.take.duration, tracks: structuredClone(this.take.tracks) };
  }

  previewJoint(id, rotation) {
    const joint=this.joints.find(j=>j.id===id);
    if(!joint||!Number.isFinite(rotation)) throw new Error('Invalid joint pose.');
    this.preview={key:id+'.rotation',rotation:clamp(rotation,joint.min,joint.max)};
    return this.step(0);
  }

  setTransitionDuration(value) {
    if(!Number.isFinite(value)||value<0||value>2) throw new Error('Transition duration must be between 0 and 2 seconds.');
    this.transitionDuration=value;
  }

  importTake(data) {
    if (!data || data.version!==1 || !Number.isFinite(data.duration) || data.duration<.1 || data.duration>60 || !data.tracks || typeof data.tracks!=='object' || Array.isArray(data.tracks)) throw new Error('Expected a Posecraft take with a duration between 0.1 and 60 seconds.');
    const allowed = new Map(this.joints.map(j=>[j.id+'.rotation',j]));
    const tracks={};
    for (const [key,track] of Object.entries(data.tracks)) {
      if (!allowed.has(key) || !Array.isArray(track) || !track.length || track.length>1000) throw new Error('Unknown joint or invalid track.');
      const joint=allowed.get(key);
      if (track.some((pair,i)=>!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isFinite)||pair[0]<0||pair[0]>data.duration||(i && pair[0]<=track[i-1][0])||pair[1]<joint.min||pair[1]>joint.max)) throw new Error('Keyframes must be ordered, within the timeline, and within joint limits.');
      tracks[key]=track.map(pair=>[...pair]);
    }
    this.take={duration:data.duration,time:0,tracks,playing:false,enabled:true,weight:1};
    this.emit('take:imported');
    return this.step(0);
  }

  setJointLimit(id, min, max) {
    const joint = this.joints.find(item => item.id === id);
    if (!joint || ![min, max].every(Number.isFinite) || min < -180 || max > 180 || min > max) throw new Error('Invalid joint limits.');
    joint.min = min; joint.max = max;
    this.emit('constraint', { joint: id, min, max });
  }

  transition(layer, next, duration = this.transitionDuration) {
    if (layer.state === next) return;
    const previous = layer.state;
    const from = this.sampleLayer(layer);
    layer.state = next; layer.time = 0;
    layer.transition = duration > 0 ? { from, elapsed: 0, duration } : null;
    this.emit('transition', { layer: layer.name, from: previous, to: next });
  }

  send(event) {
    if (!this.definition.events.includes(event)) throw new Error(`Unknown animation event: ${event}`);
    for (const [name, value] of Object.entries(this.definition.eventInputs?.[event] || {})) this.setInput(name, value);
    this.emit('trigger', { name: event });
    for (const layer of this.layers) {
      const state = layer.states[layer.state];
      const transition = [...(state.transitions || []), ...(layer.transitions || [])].find(t => t.event === event);
      if (transition) this.transition(layer, transition.to, transition.duration);
    }
  }

  sampleState(layer) {
    const state = layer.states[layer.state];
    let result;
    if (state.blend) {
      const { children, input } = state.blend;
      const value = this.inputs[input];
      const upperIndex = children.findIndex(child => child.at >= value);
      const high = children[upperIndex < 0 ? children.length - 1 : upperIndex];
      const low = children[Math.max(0, (upperIndex < 0 ? children.length - 1 : upperIndex) - 1)];
      const t = high.at === low.at ? 0 : clamp((value - low.at) / (high.at - low.at), 0, 1);
      // Blend clips at the same normalized phase, even if their durations differ.
      const phase = layer.time / state.duration;
      const a = sampleClip(this.definition.clips[low.clip], phase * this.definition.clips[low.clip].duration, this.interpolation);
      const b = sampleClip(this.definition.clips[high.clip], phase * this.definition.clips[high.clip].duration, this.interpolation);
      result = Object.fromEntries(layer.mask.map(key => [key, lerp(a[key] ?? layer.neutral[key], b[key] ?? layer.neutral[key], t)]));
    } else result = state.sample ? state.sample(this.inputs, layer.time) : sampleClip(this.definition.clips[state.clip], layer.time, this.interpolation);
    return { ...layer.neutral, ...result };
  }

  sampleLayer(layer) {
    const next = this.sampleState(layer);
    if (!layer.transition) return next;
    const raw = clamp(layer.transition.elapsed / layer.transition.duration, 0, 1);
    const t = raw * raw * (3 - 2 * raw);
    return Object.fromEntries(layer.mask.map(key => [key, lerp(layer.transition.from[key], next[key], t)]));
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Animation time must be finite and nonnegative.');
    this.time += dt;
    if (this.take.playing) this.take.time=(this.take.time+dt)%this.take.duration;
    for (const layer of this.layers) {
      const state = layer.states[layer.state];
      const automatic = (state.transitions || []).find(t => t.when?.(this.inputs));
      if (automatic) this.transition(layer, automatic.to, automatic.duration);
      const current = layer.states[layer.state];
      const previousTime = layer.time;
      layer.time += dt * (current.speedInput ? this.inputs[current.speedInput] : 1);
      if (layer.transition) {
        layer.transition.elapsed += dt;
        if (layer.transition.elapsed >= layer.transition.duration) layer.transition = null;
      }
      const clip = current.clip && this.definition.clips[current.clip];
      if (clip) {
        for (const marker of clip.events || []) {
          const startCycle = clip.loop ? Math.floor(previousTime / clip.duration) : 0;
          const endCycle = clip.loop ? Math.floor(layer.time / clip.duration) : 0;
          for (let cycle = startCycle; cycle <= endCycle; cycle++) {
            const time = cycle * clip.duration + marker.time;
            if (time > previousTime && time <= layer.time) this.emit('marker', { layer: layer.name, name: marker.name, cycle });
          }
        }
        if (!clip.loop && previousTime < clip.duration && layer.time >= clip.duration) {
          this.emit('complete', { layer: layer.name, state: layer.state });
          if (current.onComplete) this.transition(layer, current.onComplete, current.exitDuration ?? .25);
        }
      }
    }
    this.frame = this.evaluate();
    return this.frame;
  }

  evaluate() {
    let pose = { ...this.definition.defaults };
    for (const layer of this.layers) {
      const sampled = this.sampleLayer(layer);
      for (const key of layer.mask) pose[key] = layer.mode === 'additive' ? pose[key] + sampled[key] * layer.weight : lerp(pose[key], sampled[key], layer.weight);
    }
    pose = constrainPose(this.joints, pose);
    const targets = {};
    for (const chain of this.definition.chains) {
      const prefix = `ik.${chain.id}`;
      const target = chain.target
        ? chain.target({ pose, inputs: this.inputs, time: this.time })
        : { x: pose[`${prefix}.x`], y: pose[`${prefix}.y`], weight: pose[`${prefix}.weight`] ?? 1 };
      const weight = target.weight ?? 1;
      if (![target.x, target.y, weight].every(Number.isFinite)) throw new TypeError(`Invalid IK target: ${chain.id}`);
      pose = solveTwoBoneIK(this.joints, pose, chain, target, weight);
      targets[chain.id] = { ...target, weight };
    }
    // Authored keys are the final pose layer, so IK cannot overwrite an edited joint.
    if (this.take.enabled) {
      const sample=sampleClip({duration:this.take.duration,loop:false,tracks:this.take.tracks},this.take.time,this.interpolation);
      for(const [key,value] of Object.entries(sample)) pose[key]=mixAngle(pose[key],value,this.take.weight);
      pose=constrainPose(this.joints,pose);
    }
    if(this.preview) pose=constrainPose(this.joints,{...pose,[this.preview.key]:this.preview.rotation});
    const world = forwardKinematics(this.joints, pose);
    for (const chain of this.definition.chains) targets[chain.id].error = Math.hypot(world[chain.lower].endX - targets[chain.id].x, world[chain.lower].endY - targets[chain.id].y);
    return { pose, world, targets, time: this.time, layers: this.layers.map(layer => ({ name: layer.name, state: layer.state, time: layer.time, weight: layer.weight, mixing: !!layer.transition })) };
  }
}
