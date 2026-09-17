import { AnimationController, clamp, forwardKinematics, constrainPose } from './index.js';
import { assertDocument } from './schema.js';
export const STEP = 1 / 120;

export function compilePack(pack) {
  const defaults = Object.fromEntries(pack.joints.flatMap(j => [[`${j.id}.rotation`, j.rotation], [`${j.id}.x`, 0], [`${j.id}.y`, 0]]));
  const states = Object.fromEntries(Object.entries(pack.states).map(([id, state]) => [id, { clip: state.clip, transitions: (state.transitions || []).map(t => ({ to: t.to, duration: t.duration, when: inputs => inputs[t.when.input] === t.when.equals })) }]));
  return { joints: pack.joints, defaults, inputs: pack.inputs, clips: pack.clips, layers: [{ name: 'action', mode: 'override', weight: 1, initial: pack.initial, mask: Object.keys(defaults), neutral: defaults, states }] };
}

export class SceneController {
  constructor(document, { reducedMotion = false } = {}) {
    this.document = structuredClone(assertDocument(document)); this.reducedMotion = reducedMotion;
    this.listeners = new Set(); this.log = []; this.playing = true; this.reset();
  }
  reset() {
    this.log = [];
    this.actors = this.document.actors.map(actor => {
      const pack = this.document.packs[actor.pack], runtime = new AnimationController(compilePack(pack));
      runtime.subscribe(event => { if (!this.replaying) for (const fn of this.listeners) fn({ ...event, actor: actor.id }); });
      return { actor, pack, runtime, spring: { x: 0, y: 0, vx: 0, vy: 0 } };
    });
    this.time = 0; this.accumulator = 0; this.motion = { ax: 0, ay: 0 }; this.baseline = null;
    return this.frame();
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  setInput(actorId, name, value) {
    const actor = this.actors.find(a => a.actor.id === actorId); if (!actor) throw new Error(`Missing actor ${actorId}`);
    actor.runtime.setInput(name, value);
    if (!this.replaying) this.record({ type: 'input', actor: actorId, name, value });
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
    const vx = (x - old.x) / dt, vy = (y - old.y) / dt;
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
      a.runtime.step(this.reducedMotion ? 0 : STEP);
      if (this.reducedMotion) { a.runtime.layers.forEach(layer => layer.transition = null); a.runtime.frame = a.runtime.evaluate(); }
      const r = a.pack.reaction, s = a.spring;
      if (r && !this.reducedMotion) {
        for (const axis of ['x', 'y']) {
          const v = 'v' + axis;
          s[v] += (-this.motion['a' + axis] * .012 * r.strength - r.stiffness * s[axis] - r.damping * s[v]) * STEP;
          s[axis] = clamp(s[axis] + s[v] * STEP, -15, 15);
          if (Math.abs(s[axis]) === 15) s[v] = 0;
        }
      }
    }
  }
  frame() {
    return { time: this.time, actors: this.actors.map(({ actor, pack, runtime, spring }) => {
      let pose = { ...runtime.frame.pose };
      if (pack.reaction && !this.reducedMotion) {
        const key = pack.reaction.joint;
        pose[`${key}.rotation`] += spring.x;
        pose[`${key}.y`] += spring.y;
        pose = constrainPose(runtime.joints, pose);
      }
      return { id: actor.id, pose, world: forwardKinematics(runtime.joints, pose), state: runtime.layers[0].state, spring: { ...spring } };
    }) };
  }
  seek(time) {
    if (!Number.isFinite(time) || time < 0 || time > 60) throw new Error('Seek range is 0..60 seconds.');
    const log = this.log.map(e => ({ ...e })), wasPlaying = this.playing;
    this.replaying = true; this.reset(); let cursor = 0;
    try {
      const apply = () => { while (cursor < log.length && log[cursor].time <= this.time + 1e-9) { const e = log[cursor++]; if (e.type === 'input') this.setInput(e.actor, e.name, e.value); else this.setAcceleration(e.ax, e.ay); } };
      while (this.time + STEP <= time + 1e-9) { apply(); this.tick(); } apply();
    } finally { this.log = log; this.replaying = false; this.playing = wasPlaying; }
    return this.frame();
  }
  dispose() { this.pause(); this.listeners.clear(); }
}
