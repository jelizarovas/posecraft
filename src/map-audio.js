import {cliffFaces} from './map-cliffs.js';

/**
 * Map beds and footsteps for Littlelands.
 *
 * `src/audio.js` (`SoundEffects`) is a short oscillator palette for scene
 * interactions. This graph is separate: one noise buffer, looping beds, and
 * retriggered voices tied to map phase. Folding that into SoundEffects would
 * mix two lifetimes and two mixes.
 *
 * Player swim, splash, dive and ledge cues are named and silent. Terrain 2 is
 * blocked, so the player never stands in water, and those events are not
 * emitted yet. Cow and sheep calls are quiet oscillator placeholders.
 */

const TAU = Math.PI * 2;
const FLOOR = 0.0001;
const NOISE_SECONDS = 1;
const CUE_SLOTS = 32;
const NODE_BUDGET = 25;

/** Adventurer sheets are 12 frames. Walk plants were measured on frames 1 and 7, run on 0 and 6 (lowest opaque pixel, side row). Procedural `footCycle` plants at phase 0 and π. */
const framePhase = frame => frame / 12 * TAU;
export const FOOT_CONTACTS = Object.freeze({
  procedural: Object.freeze([0, Math.PI]),
  walk: Object.freeze([framePhase(1), framePhase(7)]),
  run: Object.freeze([framePhase(0), framePhase(6)])
});

export const MAP_AUDIO_LEVELS = Object.freeze({
  master: 0.45,
  step: 0.16,
  jumpTakeoff: 0.18,
  jumpLand: 0.22,
  vaultTakeoff: 0.16,
  vaultLand: 0.2,
  roll: 0.12,
  rollRecover: 0.1,
  climb: 0.1,
  interact: 0.07,
  wind: 0.065,
  bird: 0.045,
  river: 0.04,
  waterfall: 0.15,
  chicken: 0.08,
  livestockPlaceholder: 0.04
});

export const MAP_AUDIO_NODES = 24;
export const MAP_AUDIO_NODE_BUDGET = NODE_BUDGET;
export const WATERFALL_NEAR = 2;
export const WATERFALL_FAR = 14;
export const RIVER_NEAR = 1.5;
export const RIVER_FAR = 6;
export const WATERFALL_CLUSTER = 3;

const SURFACES = Object.freeze({0: 'grass', 1: 'road', 2: 'water', 3: 'sand'});
const STEP_TIMBRE = Object.freeze({
  grass: {frequency: 720, q: 0.65, decay: 0.085},
  road: {frequency: 1680, q: 1.35, decay: 0.05},
  sand: {frequency: 380, q: 0.45, decay: 0.13}
});
const JITTER_GAIN = Float32Array.of(0.92, 1, 0.86, 1.04, 0.95, 1.08, 0.9, 1.02);
const JITTER_FREQ = Float32Array.of(0.96, 1.05, 0.92, 1.08, 1, 0.94, 1.06, 0.98);
const ONESHOTS = Object.freeze({
  'jump-takeoff': {frequency: 240, sweep: 980, decay: 0.12, gain: MAP_AUDIO_LEVELS.jumpTakeoff, q: 0.8},
  'jump-land': {frequency: 180, sweep: 90, decay: 0.16, gain: MAP_AUDIO_LEVELS.jumpLand, q: 0.6},
  'vault-takeoff': {frequency: 320, sweep: 1100, decay: 0.1, gain: MAP_AUDIO_LEVELS.vaultTakeoff, q: 0.9},
  'vault-land': {frequency: 160, sweep: 80, decay: 0.14, gain: MAP_AUDIO_LEVELS.vaultLand, q: 0.7},
  roll: {frequency: 140, sweep: 70, decay: 0.28, gain: MAP_AUDIO_LEVELS.roll, q: 0.5},
  'roll-recover': {frequency: 200, sweep: 100, decay: 0.12, gain: MAP_AUDIO_LEVELS.rollRecover, q: 0.6},
  climb: {frequency: 500, sweep: 900, decay: 0.09, gain: MAP_AUDIO_LEVELS.climb, q: 1.2},
  interact: {frequency: 1400, sweep: 700, decay: 0.05, gain: MAP_AUDIO_LEVELS.interact, q: 2}
});

/** Reachable cues play. Water, dive and ledge names are reserved and silent. */
export const MAP_EVENT_SOUNDS = Object.freeze({
  'map.jump.started': 'jump-takeoff',
  'map.jump.landed': 'jump-land',
  'map.vault.started': 'vault-takeoff',
  'map.vault.landed': 'vault-land',
  'map.roll.started': 'roll',
  'map.roll.finished': 'roll-recover',
  'map.object.interacted': 'interact',
  'map.move.started': null,
  'map.route.ready': null,
  'map.actor.arrived': null,
  'map.restored': null,
  'map.water.entered': null,
  'map.dive.started': null,
  'map.ledge.grab': null,
  'map.ledge.hang': null,
  'map.ledge.climb': null,
  'map.ledge.climbed': null,
  'map.ledge.release': null,
  'map.ledge.dropped': null
});

export function mapAudioMemory(sampleRate = 48000) {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48000;
  const samples = Math.ceil(rate * NOISE_SECONDS);
  return {sampleRate: rate, buffers: 1, seconds: NOISE_SECONDS, samples, bytes: samples * 4, nodes: MAP_AUDIO_NODES};
}

export function terrainAt(map, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (!map || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 0;
  const value = map.terrain[ty * map.width + tx];
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

export function surfaceAt(map, x, y) {
  return SURFACES[terrainAt(map, x, y)];
}

export function footContactsFor(gait, clip) {
  if ((gait === 'walk' || gait === 'run') && clip?.frames === 12 && typeof clip.image === 'string' && clip.image.startsWith('adventurer-')) return FOOT_CONTACTS[gait];
  return FOOT_CONTACTS.procedural;
}

/** Contacts crossed while phase advances. A forward wrap past 0 looks like a large negative delta. */
export function footContactsCrossed(previous, next, contacts = FOOT_CONTACTS.procedural) {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || !contacts?.length) return 0;
  let delta = next - previous;
  if (delta < -Math.PI) delta += TAU * Math.ceil(-delta / TAU);
  if (!(delta > 0)) return 0;
  if (delta > TAU) delta = TAU;
  const prev = ((previous % TAU) + TAU) % TAU;
  const end = prev + delta;
  let count = 0;
  for (let i = 0; i < contacts.length; i++) {
    const mark = contacts[i];
    if (!Number.isFinite(mark)) continue;
    const point = ((mark % TAU) + TAU) % TAU;
    if (point > prev && point <= end) count++;
    else if (point + TAU > prev && point + TAU <= end) count++;
  }
  return count;
}

export function soundForMapEvent(event) {
  if (!event || typeof event.type !== 'string') return null;
  if (event.type === 'map.traversal.started') {
    if (event.action === 'vault') return 'vault-takeoff';
    if (typeof event.action === 'string' && event.action.startsWith('climb')) return 'climb';
    return null;
  }
  if (Object.hasOwn(MAP_EVENT_SOUNDS, event.type)) return MAP_EVENT_SOUNDS[event.type];
  return null;
}

export function distanceGain(distance, near, far) {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  if (distance <= near) return 1;
  if (distance >= far) return 0;
  const t = (distance - near) / (far - near);
  return (1 - t) * (1 - t);
}

/** Pan from the source's screen position relative to the listener, about ±0.6. */
export function screenPan(sourceX, listenerX, viewWidth) {
  if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX) || !(viewWidth > 0)) return 0;
  const span = (sourceX - listenerX) / viewWidth;
  return Math.max(-0.6, Math.min(0.6, span * 1.15));
}

export function windShelter(distance) {
  return Number.isFinite(distance) && distance < 6 ? 0.7 : 1;
}

export function housePoints(map) {
  const houses = [];
  const props = map?.props || [];
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (prop?.kind === 'house') houses.push({x: prop.x + prop.width / 2, y: prop.y + prop.height / 2});
  }
  return houses;
}

export function nearestDistance(points, x, y) {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - x, points[i].y - y);
    if (d < best) best = d;
  }
  return best;
}

export function nearestWaterInto(map, x, y, radius, out) {
  out.found = false;
  out.distance = Infinity;
  out.x = x;
  out.y = y;
  if (!map) return false;
  const x0 = Math.max(0, Math.floor(x - radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const x1 = Math.min(map.width - 1, Math.floor(x + radius));
  const y1 = Math.min(map.height - 1, Math.floor(y + radius));
  for (let ty = y0; ty <= y1; ty++) {
    const row = ty * map.width;
    for (let tx = x0; tx <= x1; tx++) {
      if (map.terrain[row + tx] !== 2) continue;
      const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      if (d < out.distance) { out.distance = d; out.x = tx + 0.5; out.y = ty + 0.5; out.found = true; }
    }
  }
  return out.found;
}

export function waterfallSources(map) {
  if (!map?.terraces?.length || !map.terrain) return [];
  const faces = cliffFaces(map);
  const sources = [];
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    if (face.edge !== 'east' && face.edge !== 'south') continue;
    if (map.terrain[face.y * map.width + face.x] !== 2) continue;
    sources.push({x: (face.top[0].x + face.top[1].x) / 2, y: (face.top[0].y + face.top[1].y) / 2});
  }
  return sources;
}

export function clusterSources(points, radius = WATERFALL_CLUSTER) {
  const clusters = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let cluster = null;
    for (let c = 0; c < clusters.length; c++) {
      if (Math.hypot(clusters[c].x - point.x, clusters[c].y - point.y) <= radius) { cluster = clusters[c]; break; }
    }
    if (!cluster) clusters.push({x: point.x, y: point.y, count: 1});
    else {
      const n = cluster.count;
      cluster.x = (cluster.x * n + point.x) / (n + 1);
      cluster.y = (cluster.y * n + point.y) / (n + 1);
      cluster.count = n + 1;
    }
  }
  return clusters;
}

export function nearestInto(points, x, y, out) {
  out.index = -1;
  out.distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - x, points[i].y - y);
    if (d < out.distance) { out.distance = d; out.index = i; }
  }
  return out.index >= 0;
}

const LIVESTOCK = new Set(['cow', 'sheep', 'chicken']);
export function livestockRoster(actors) {
  const roster = [];
  const list = actors || [];
  for (let i = 0; i < list.length; i++) {
    const actor = list[i];
    const species = actor?.npc?.species;
    if (actor?.appearance?.kind !== 'livestock' || !LIVESTOCK.has(species)) continue;
    roster.push({id: actor.id, species});
  }
  return roster;
}

function envelope(param, now, peak, attack, decay) {
  const safe = Math.max(FLOOR, peak);
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
  const held = Math.max(FLOOR, Number.isFinite(param.value) ? param.value : FLOOR);
  param.setValueAtTime(held, now);
  param.exponentialRampToValueAtTime(safe, now + attack);
  param.exponentialRampToValueAtTime(FLOOR, now + attack + decay);
}

function fillNoise(buffer) {
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, brown * 3.5));
  }
}

export class MapAudio {
  constructor({volume = MAP_AUDIO_LEVELS.master, muted = false, createContext} = {}) {
    if (!Number.isFinite(volume)) throw new Error('Volume must be finite.');
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = !!muted;
    this.createContext = createContext;
    this.context = null;
    this.master = null;
    this.noise = null;
    this.built = false;
    this.running = false;
    this.disposed = false;
    this.primed = false;
    this.prevPhase = 0;
    this.stepCursor = 0;
    this.jitterCursor = 0;
    this.lastVaultLand = -Infinity;
    this.muteToken = 0;
    this.nextBird = Infinity;
    this.nodeCount = 0;
    this.bufferSamples = 0;
    this.cueRing = Array.from({length: CUE_SLOTS}, () => ({name: '', time: 0, surface: '', gain: 0, voice: -1, placeholder: false}));
    this.cueWrite = 0;
    this.cueCount = 0;
    this.onstatechange = null;
  }

  get enabled() { return this.running && !this.muted; }

  prime(phase) {
    this.prevPhase = Number.isFinite(phase) ? phase : 0;
    this.primed = true;
  }

  /** Create the context synchronously. Call this inside the gesture handler, before any await. */
  unlock() {
    if (this.disposed) return Promise.resolve(false);
    try {
      if (!this.context) this.open();
      if (!this.context) return Promise.resolve(false);
      const pending = this.context.state === 'running' ? Promise.resolve() : this.context.resume();
      return Promise.resolve(pending).then(() => {
        if (this.disposed || !this.context || this.context.state !== 'running') return false;
        if (!this.built) this.build();
        this.running = true;
        this.applyMaster(0.08);
        if (this.muted) this.suspendSoon();
        return true;
      }).catch(() => false);
    } catch { return Promise.resolve(false); }
  }

  open() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context && !this.createContext) return;
    this.context = this.createContext ? this.createContext() : new Context();
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(FLOOR, this.context.currentTime || 0);
    this.master.connect(this.context.destination);
    this.context.onstatechange = () => {
      if (this.disposed || !this.context) return;
      if (this.context.state === 'interrupted') this.context.resume().catch(() => {});
      this.onstatechange?.(this.context.state);
    };
  }

  build() {
    const context = this.context;
    const now = context.currentTime || 0;
    const samples = Math.ceil(context.sampleRate * NOISE_SECONDS);
    const buffer = context.createBuffer(1, samples, context.sampleRate);
    fillNoise(buffer);
    this.bufferSamples = samples;
    this.noise = context.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noise.start(now);
    const bed = (type, frequency, q, pan) => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(frequency, now);
      filter.Q.setValueAtTime(q, now);
      const gain = context.createGain();
      gain.gain.setValueAtTime(FLOOR, now);
      filter.connect(gain);
      let panner = null;
      let output = gain;
      if (pan) {
        panner = context.createStereoPanner();
        panner.pan.setValueAtTime(0, now);
        gain.connect(panner);
        output = panner;
      }
      return {filter, gain, panner, output, fed: false, level: -1, dropAt: 0};
    };
    this.wind = bed('lowpass', 420, 0.7, false);
    this.river = bed('bandpass', 520, 0.8, true);
    this.fall = bed('lowpass', 860, 0.6, true);
    this.steps = [bed('bandpass', 720, 0.7, false), bed('bandpass', 720, 0.7, false)];
    this.accent = bed('bandpass', 300, 0.8, false);
    this.cluck = bed('bandpass', 2200, 1.6, true);
    const call = context.createOscillator();
    call.type = 'sine';
    call.frequency.setValueAtTime(180, now);
    const callGain = context.createGain();
    callGain.gain.setValueAtTime(FLOOR, now);
    const callPan = context.createStereoPanner();
    callPan.pan.setValueAtTime(0, now);
    call.connect(callGain); callGain.connect(callPan); callPan.connect(this.master); call.start(now);
    this.call = {osc: call, gain: callGain, panner: callPan};
    const bird = context.createOscillator();
    bird.type = 'sine';
    bird.frequency.setValueAtTime(1900, now);
    const birdGain = context.createGain();
    birdGain.gain.setValueAtTime(FLOOR, now);
    bird.connect(birdGain); birdGain.connect(this.master); bird.start(now);
    this.bird = {osc: bird, gain: birdGain};
    this.feed(this.wind);
    this.feed(this.steps[0]);
    this.feed(this.steps[1]);
    this.feed(this.accent);
    this.feed(this.cluck);
    // noise + master + wind(2) + river(3) + fall(3) + steps(4) + accent(2) + cluck(3) + call(3) + bird(2)
    this.nodeCount = 24;
    this.built = true;
  }

  feed(bed) {
    if (bed.fed || !this.noise) return;
    this.noise.connect(bed.filter);
    bed.output.connect(this.master);
    bed.fed = true;
    bed.dropAt = 0;
  }

  unfeed(bed) {
    if (!bed.fed || !this.noise) return;
    try { this.noise.disconnect(bed.filter); } catch { /* already disconnected */ }
    try { bed.output.disconnect(); } catch { /* already disconnected */ }
    bed.fed = false;
    bed.dropAt = 0;
    bed.level = 0;
  }

  aim(bed, level, pan) {
    if (!this.running || !bed) return;
    const now = this.context.currentTime;
    const audible = level > 0.002 && !this.muted;
    if (audible) this.feed(bed);
    if (bed.panner && Number.isFinite(pan)) bed.panner.pan.setTargetAtTime(pan, now, 0.22);
    if (Math.abs(level - bed.level) >= 0.003) {
      bed.level = audible ? level : 0;
      bed.gain.gain.setTargetAtTime(Math.max(FLOOR, audible ? level : FLOOR), now, 0.22);
    }
    if (!audible && bed.fed) bed.dropAt = bed.dropAt || now + 0.4;
    if (audible) bed.dropAt = 0;
    if (bed.dropAt && now >= bed.dropAt) this.unfeed(bed);
  }

  applyMaster(seconds) {
    if (!this.master || !this.context) return;
    const level = this.muted ? FLOOR : this.volume;
    this.master.gain.setTargetAtTime(Math.max(FLOOR, level), this.context.currentTime, seconds);
  }

  suspendSoon() {
    const token = ++this.muteToken;
    const wait = this.context?.state === 'running' ? 160 : 0;
    setTimeout(() => {
      if (token !== this.muteToken || !this.muted || !this.context || this.context.state !== 'running') return;
      this.context.suspend().catch(() => {});
    }, wait);
  }

  setVolume(value) {
    if (!Number.isFinite(value)) throw new Error('Volume must be finite.');
    this.volume = Math.max(0, Math.min(1, value));
    if (!this.muted) this.applyMaster(0.08);
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.applyMaster(0.05);
    if (!this.context) return;
    if (this.muted) this.suspendSoon();
    else if (this.built) this.context.resume().catch(() => {});
  }

  note(name, extra) {
    const cue = this.cueRing[this.cueWrite];
    cue.name = name;
    cue.time = this.context?.currentTime || 0;
    cue.surface = extra.surface || '';
    cue.gain = extra.gain || 0;
    cue.voice = extra.voice ?? -1;
    cue.placeholder = !!extra.placeholder;
    this.cueWrite = (this.cueWrite + 1) % CUE_SLOTS;
    if (this.cueCount < CUE_SLOTS) this.cueCount++;
  }

  recentCues() {
    const out = [];
    const start = this.cueCount < CUE_SLOTS ? 0 : this.cueWrite;
    for (let i = 0; i < this.cueCount; i++) {
      const cue = this.cueRing[(start + i) % CUE_SLOTS];
      out.push({name: cue.name, time: cue.time, surface: cue.surface, gain: cue.gain, voice: cue.voice, placeholder: cue.placeholder});
    }
    return out;
  }

  handle(event, playerId) {
    if (!event || typeof event.type !== 'string') return false;
    if (event.type === 'map.restored') { this.prime(0); return false; }
    if (playerId && event.actor && event.actor !== playerId) return false;
    const name = soundForMapEvent(event);
    if (!name || !this.running || this.muted || !this.built) return false;
    const now = this.context.currentTime;
    if (name === 'vault-land' && now - this.lastVaultLand < 0.05) return false;
    if (name === 'vault-land') this.lastVaultLand = now;
    const spec = ONESHOTS[name];
    if (!spec) return false;
    this.playAccent(spec, name);
    return true;
  }

  playAccent(spec, name) {
    const now = this.context.currentTime;
    const filter = this.accent.filter;
    filter.frequency.setValueAtTime(Math.max(40, spec.frequency), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, spec.sweep), now + spec.decay);
    filter.Q.setValueAtTime(spec.q, now);
    envelope(this.accent.gain.gain, now, spec.gain, 0.012, spec.decay);
    this.note(name, {gain: spec.gain});
  }

  poll(actor, map, contacts = FOOT_CONTACTS.procedural) {
    if (!actor) return 0;
    const phase = Number.isFinite(actor.phase) ? actor.phase : 0;
    if (!this.primed) { this.prime(phase); return 0; }
    const previous = this.prevPhase;
    this.prevPhase = phase;
    if (!this.running || this.muted || !this.built) return 0;
    if (actor.skidding || actor.jumping || actor.rolling || actor.traversalAction) return 0;
    if (!(actor.walking || actor.running)) return 0;
    const weight = Number.isFinite(actor.gaitWeight) ? Math.max(0, Math.min(1, actor.gaitWeight)) : 0;
    if (weight < 0.05) return 0;
    const surface = surfaceAt(map, actor.x, actor.y);
    if (surface === 'water' || !STEP_TIMBRE[surface]) return 0;
    const hits = footContactsCrossed(previous, phase, contacts);
    for (let i = 0; i < hits; i++) this.step(surface, weight);
    return hits;
  }

  step(surface, weight) {
    const voice = this.stepCursor;
    this.stepCursor ^= 1;
    const jitter = this.jitterCursor;
    this.jitterCursor = (this.jitterCursor + 1) % JITTER_GAIN.length;
    const spec = STEP_TIMBRE[surface];
    const bed = this.steps[voice];
    const now = this.context.currentTime;
    const gain = MAP_AUDIO_LEVELS.step * (0.35 + 0.65 * weight) * JITTER_GAIN[jitter];
    bed.filter.frequency.setValueAtTime(Math.max(80, spec.frequency * JITTER_FREQ[jitter]), now);
    bed.filter.Q.setValueAtTime(spec.q, now);
    envelope(bed.gain.gain, now, gain, 0.01, spec.decay);
    this.note('step', {surface, gain, voice});
  }

  setAmbience({wind = 0, river = 0, riverPan = 0, fall = 0, fallPan = 0, birdAt = 0} = {}) {
    if (!this.running || !this.built) return;
    this.aim(this.wind, wind, null);
    this.aim(this.river, river, riverPan);
    this.aim(this.fall, fall, fallPan);
    if (birdAt >= this.nextBird && !this.muted) {
      this.nextBird = birdAt + 3200;
      this.playBird();
    }
  }

  playBird() {
    const now = this.context.currentTime;
    const osc = this.bird.osc.frequency;
    osc.setValueAtTime(1680, now);
    osc.exponentialRampToValueAtTime(2460, now + 0.07);
    osc.setValueAtTime(1920, now + 0.16);
    osc.exponentialRampToValueAtTime(2740, now + 0.22);
    envelope(this.bird.gain.gain, now, MAP_AUDIO_LEVELS.bird, 0.012, 0.09);
    envelope(this.bird.gain.gain, now + 0.16, MAP_AUDIO_LEVELS.bird * 0.85, 0.01, 0.08);
    this.note('bird', {gain: MAP_AUDIO_LEVELS.bird});
  }

  cueAnimal(species, closeness, pan) {
    if (!this.running || this.muted || !this.built) return false;
    const amount = Math.max(0, Math.min(1, closeness));
    if (!(amount > 0)) return false;
    if (species === 'chicken') return this.playCluck(amount, pan);
    if (species === 'cow' || species === 'sheep') return this.playPlaceholder(species, amount, pan);
    return false;
  }

  playCluck(amount, pan) {
    const now = this.context.currentTime;
    const gain = MAP_AUDIO_LEVELS.chicken * amount;
    if (this.cluck.panner && Number.isFinite(pan)) this.cluck.panner.pan.setValueAtTime(Math.max(-0.6, Math.min(0.6, pan)), now);
    this.cluck.filter.frequency.setValueAtTime(2100, now);
    envelope(this.cluck.gain.gain, now, gain, 0.006, 0.045);
    envelope(this.cluck.gain.gain, now + 0.07, gain * 0.8, 0.005, 0.04);
    this.note('chicken', {gain});
    return true;
  }

  /** Short pitched beep. Not a convincing animal; kept quiet and named as a placeholder. */
  playPlaceholder(species, amount, pan) {
    const now = this.context.currentTime;
    const gain = MAP_AUDIO_LEVELS.livestockPlaceholder * amount;
    const low = species === 'cow';
    if (Number.isFinite(pan)) this.call.panner.pan.setValueAtTime(Math.max(-0.6, Math.min(0.6, pan)), now);
    this.call.osc.frequency.setValueAtTime(low ? 146 : 310, now);
    this.call.osc.frequency.exponentialRampToValueAtTime(low ? 112 : 250, now + (low ? 0.32 : 0.22));
    envelope(this.call.gain.gain, now, gain, 0.02, low ? 0.32 : 0.22);
    this.note(`${species}-placeholder`, {gain, placeholder: true});
    return true;
  }

  pause() {
    if (!this.context || this.context.state === 'closed') return;
    if (this.master) this.master.gain.setTargetAtTime(FLOOR, this.context.currentTime, 0.03);
    if (this.context.state === 'running') this.context.suspend().catch(() => {});
    this.running = false;
  }

  resume() {
    if (this.disposed || this.muted || !this.context) return Promise.resolve(false);
    return Promise.resolve(this.context.resume()).then(() => {
      const ok = !!this.context && this.context.state === 'running';
      this.running = ok && this.built;
      if (ok) this.applyMaster(0.08);
      return ok;
    }).catch(() => false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.muted = true;
    this.muteToken++;
    try { this.noise?.stop(); } catch { /* already stopped */ }
    try { this.call?.osc.stop(); } catch { /* already stopped */ }
    try { this.bird?.osc.stop(); } catch { /* already stopped */ }
    try { this.master?.disconnect(); } catch { /* already disconnected */ }
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
  }
}

const POLL_START = new Set(['map.move.started', 'map.jump.started', 'map.vault.started', 'map.traversal.started', 'map.roll.started', 'map.route.ready']);
const STILL_SECONDS = 0.45;

function actorBusy(actor) {
  return !!(actor && (actor.walking || actor.running || actor.jumping || actor.rolling || actor.skidding || actor.traversalAction));
}

/**
 * Gesture unlock uses pointerup, click and keydown. A touch pointerdown does not
 * count as activation in Chrome. The context is constructed inside that handler.
 */
export function mountMapAudio(view, map, {playerId, volume = MAP_AUDIO_LEVELS.master, muted = false} = {}) {
  const id = playerId || map.actors[0]?.id;
  const audio = new MapAudio({volume, muted});
  const clips = map.art?.actors?.[id];
  const houses = housePoints(map);
  const falls = clusterSources(waterfallSources(map));
  const herd = livestockRoster(map.actors).map(animal => ({...animal, next: 0}));
  const water = {found: false, distance: Infinity, x: 0, y: 0};
  const nearestFall = {index: -1, distance: Infinity};
  const doc = globalThis.document;
  const stage = doc?.querySelector?.('#game');
  let disposed = false;
  let polling = false;
  let pollTimer = 0;
  let ambienceTimer = 0;
  let stillFor = 0;
  let lastNow = 0;
  let motionPending = false;
  let herdCursor = 0;
  const listenersArmed = {current: false};

  const contactsFor = actor => {
    const gait = actor.running || actor.gait === 'run' ? 'run' : 'walk';
    return footContactsFor(gait, clips?.[gait]);
  };
  const live = () => view.controller.actors?.get(id);
  const viewWidth = () => stage?.clientWidth || globalThis.innerWidth || 1;

  const stopPoll = () => {
    polling = false;
    stillFor = 0;
    if (pollTimer) globalThis.cancelAnimationFrame(pollTimer);
    pollTimer = 0;
  };
  const frame = now => {
    pollTimer = 0;
    if (!polling || disposed || doc?.hidden) return;
    const actor = live();
    if (actor && audio.running) audio.poll(actor, map, contactsFor(actor));
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (actorBusy(actor)) stillFor = 0;
    else stillFor += dt;
    if (stillFor < STILL_SECONDS) pollTimer = globalThis.requestAnimationFrame(frame);
    else polling = false;
  };
  const startPoll = () => {
    if (disposed || doc?.hidden) return;
    if (!audio.running) { motionPending = true; return; }
    motionPending = false;
    stillFor = 0;
    if (polling) return;
    polling = true;
    lastNow = 0;
    pollTimer = globalThis.requestAnimationFrame(frame);
  };
  const stopAmbience = () => {
    if (ambienceTimer) globalThis.clearTimeout(ambienceTimer);
    ambienceTimer = 0;
  };
  const updateWorld = () => {
    const actor = live();
    if (!actor || !audio.running) return;
    const width = viewWidth();
    const player = view.mapToScreen({x: actor.x, y: actor.y});
    const shelter = windShelter(nearestDistance(houses, actor.x, actor.y));
    nearestWaterInto(map, actor.x, actor.y, RIVER_FAR, water);
    let river = 0;
    let riverPan = 0;
    if (water.found) {
      river = MAP_AUDIO_LEVELS.river * distanceGain(water.distance, RIVER_NEAR, RIVER_FAR);
      if (river > 0) {
        const screen = view.mapToScreen({x: water.x, y: water.y});
        riverPan = screenPan(screen.x, player.x, width);
      }
    }
    nearestInto(falls, actor.x, actor.y, nearestFall);
    let fall = 0;
    let fallPan = 0;
    if (nearestFall.index >= 0) {
      fall = MAP_AUDIO_LEVELS.waterfall * distanceGain(nearestFall.distance, WATERFALL_NEAR, WATERFALL_FAR);
      if (fall > 0) {
        const cluster = falls[nearestFall.index];
        const screen = view.mapToScreen({x: cluster.x, y: cluster.y});
        fallPan = screenPan(screen.x, player.x, width);
      }
    }
    audio.setAmbience({wind: MAP_AUDIO_LEVELS.wind * shelter, river, riverPan, fall, fallPan, birdAt: globalThis.performance?.now?.() || 0});
    cueHerd(actor, player.x, width);
  };
  const cueHerd = (actor, playerX, width) => {
    if (!herd.length) return;
    const now = globalThis.performance?.now?.() || 0;
    for (let n = 0; n < herd.length; n++) {
      const animal = herd[herdCursor];
      herdCursor = (herdCursor + 1) % herd.length;
      if (now < animal.next) continue;
      const body = view.controller.actors?.get(animal.id);
      if (!body) { animal.next = now + 2000; continue; }
      const distance = Math.hypot(body.x - actor.x, body.y - actor.y);
      const far = animal.species === 'chicken' ? 12 : 14;
      const closeness = distanceGain(distance, 2, far);
      if (!(closeness > 0)) { animal.next = now + 2000; continue; }
      const screen = view.mapToScreen({x: body.x, y: body.y});
      audio.cueAnimal(animal.species, closeness, screenPan(screen.x, playerX, width));
      animal.next = now + (animal.species === 'chicken' ? 4500 : 9000);
      return;
    }
  };
  const ambience = () => {
    ambienceTimer = 0;
    if (disposed || doc?.hidden) return;
    if (audio.running) updateWorld();
    ambienceTimer = globalThis.setTimeout(ambience, 200);
  };
  const startAmbience = () => { if (!ambienceTimer && !disposed && !doc?.hidden) ambienceTimer = globalThis.setTimeout(ambience, 200); };
  const onReady = () => {
    const actor = live();
    if (actor) audio.prime(actor.phase);
    if (audio.nextBird === Infinity) audio.nextBird = (globalThis.performance?.now?.() || 0) + 1800;
    updateWorld();
    startAmbience();
    if (motionPending || actorBusy(actor)) startPoll();
    disarm();
  };
  const gesture = event => {
    // Settings clicks must not do audio work first. Fullscreen persistence runs in that same click.
    if (event.target?.closest?.('#play-settings, #settings-toggle')) return;
    audio.unlock().then(ok => { if (ok && !disposed) onReady(); });
  };
  const arm = () => {
    if (!doc || listenersArmed.current || disposed) return;
    doc.addEventListener('pointerup', gesture, true);
    doc.addEventListener('click', gesture, true);
    doc.addEventListener('keydown', gesture, true);
    listenersArmed.current = true;
  };
  const disarm = () => {
    if (!doc || !listenersArmed.current) return;
    if (audio.context?.state !== 'running') return;
    doc.removeEventListener('pointerup', gesture, true);
    doc.removeEventListener('click', gesture, true);
    doc.removeEventListener('keydown', gesture, true);
    listenersArmed.current = false;
  };
  const onEvent = event => {
    if (disposed) return;
    if (event?.type !== 'map.restored' && event?.actor && event.actor !== id) return;
    audio.handle(event, id);
    if (event?.actor === id && POLL_START.has(event.type)) startPoll();
  };
  const unsubscribe = view.controller.subscribe(onEvent);
  const onVisibility = () => {
    if (doc.hidden) { stopPoll(); stopAmbience(); audio.pause(); return; }
    audio.resume().then(ok => {
      if (disposed) return;
      if (!ok) { if (!audio.muted) arm(); return; }
      updateWorld();
      startAmbience();
      if (actorBusy(live())) startPoll();
    });
  };
  audio.onstatechange = state => { if (state === 'interrupted' && !disposed && !doc?.hidden) audio.resume().then(ok => { if (!ok) arm(); }); };
  arm();
  if (!muted && audio.context?.state === 'running') onReady();

  return {
    audio,
    get context() { return audio.context; },
    get running() { return audio.running && audio.context?.state === 'running'; },
    recentCues() { return audio.recentCues(); },
    setVolume(value) { audio.setVolume(value); },
    setMuted(value) {
      audio.setMuted(value);
      if (!value) audio.resume().then(ok => { if (ok && !disposed) { updateWorld(); startAmbience(); } });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPoll();
      stopAmbience();
      disarm();
      doc?.removeEventListener('visibilitychange', onVisibility);
      unsubscribe?.();
      audio.dispose();
    }
  };
}
