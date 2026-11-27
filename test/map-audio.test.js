import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlaySettings, settingsKey} from '../examples/map-play-settings.js';
import {createTownMap} from '../examples/town-map.js';
import {
  FOOT_CONTACTS, MAP_AUDIO_LEVELS, MAP_AUDIO_NODES, MAP_AUDIO_NODE_BUDGET, MAP_EVENT_SOUNDS,
  WATERFALL_FAR, RIVER_FAR, MapAudio, mapAudioMemory, footContactsCrossed, footContactsFor,
  soundForMapEvent, surfaceAt, distanceGain, screenPan, windShelter, livestockRoster,
  waterfallSources, clusterSources, nearestInto, nearestWaterInto
} from '../src/map-audio.js';

const TAU = Math.PI * 2;

function param(){
  const events = [];
  const value = {current: 0.0001};
  return {
    events,
    get value(){ return value.current; },
    set value(next){ value.current = next; },
    setValueAtTime(v, t){ events.push(['set', v, t]); value.current = v; },
    setTargetAtTime(v, t, c){ events.push(['target', v, t, c]); value.current = v; },
    exponentialRampToValueAtTime(v, t){ if(!(v > 0)) throw new Error('exponential ramp needs a positive value'); events.push(['exp', v, t]); value.current = v; },
    linearRampToValueAtTime(v, t){ events.push(['lin', v, t]); value.current = v; },
    cancelScheduledValues(t){ events.push(['cancel', t]); },
    cancelAndHoldAtTime(t){ events.push(['hold', t]); }
  };
}
function fakeContext(){
  const counts = {nodes: 0};
  const count = kind => { counts[kind] = (counts[kind] || 0) + 1; counts.nodes++; };
  const connectable = kind => { count(kind); return {connect(){}, disconnect(){}, start(){}, stop(){}}; };
  const context = {
    sampleRate: 8000,
    currentTime: 1,
    state: 'suspended',
    destination: {connect(){}, disconnect(){}},
    counts,
    createBuffer(_channels, length, sampleRate){ return {length, sampleRate, duration: length / sampleRate, getChannelData: () => new Float32Array(length)}; },
    createBufferSource(){ const node = connectable('source'); node.buffer = null; node.loop = false; return node; },
    createGain(){ count('gain'); return {gain: param(), connect(){}, disconnect(){}}; },
    createBiquadFilter(){ count('filter'); return {type: 'lowpass', frequency: param(), Q: param(), connect(){}, disconnect(){}}; },
    createStereoPanner(){ count('panner'); return {pan: param(), connect(){}, disconnect(){}}; },
    createOscillator(){ const node = connectable('osc'); node.frequency = param(); node.type = 'sine'; return node; },
    resume(){ context.state = 'running'; return Promise.resolve(); },
    suspend(){ context.state = 'suspended'; return Promise.resolve(); },
    close(){ context.state = 'closed'; return Promise.resolve(); }
  };
  return context;
}
const grid = {width: 4, height: 1, terrain: [0, 1, 3, 2]};
const actorAt = (phase, extra = {}) => ({x: 0.5, y: 0.2, phase, gait: 'walk', gaitWeight: 1, walking: true, running: false, skidding: false, jumping: false, rolling: false, traversalAction: null, ...extra});

test('foot contacts follow the rig or the adventurer sheet', () => {
  assert.deepEqual([...FOOT_CONTACTS.procedural], [0, Math.PI]);
  assert.ok(Math.abs(FOOT_CONTACTS.walk[0] - TAU / 12) < 1e-9);
  assert.ok(Math.abs(FOOT_CONTACTS.walk[1] - 7 * TAU / 12) < 1e-9);
  assert.equal(FOOT_CONTACTS.run[0], 0);
  assert.ok(Math.abs(FOOT_CONTACTS.run[1] - Math.PI) < 1e-9);
  assert.equal(footContactsFor('walk', {frames: 12, image: 'adventurer-walk'}), FOOT_CONTACTS.walk);
  assert.equal(footContactsFor('run', {frames: 12, image: 'adventurer-run'}), FOOT_CONTACTS.run);
  assert.equal(footContactsFor('walk', {frames: 12, image: 'custom-walk'}), FOOT_CONTACTS.procedural);
  assert.equal(footContactsFor('run', {frames: 8, image: 'adventurer-run'}), FOOT_CONTACTS.procedural);
  assert.equal(footContactsCrossed(0.2, 0.4, FOOT_CONTACTS.procedural), 0);
  assert.equal(footContactsCrossed(Math.PI - 0.05, Math.PI + 0.05, FOOT_CONTACTS.procedural), 1);
  assert.equal(footContactsCrossed(TAU - 0.05, 0.05, FOOT_CONTACTS.procedural), 1);
  assert.equal(footContactsCrossed(0.4, 0.2, FOOT_CONTACTS.procedural), 0);
  assert.equal(footContactsCrossed(0.1, 0.1 + TAU * 3, FOOT_CONTACTS.procedural), 2);
  for (const [name, contacts] of Object.entries(FOOT_CONTACTS)) {
    let phase = 0.02, hits = 0;
    for (let i = 0; i < 32; i++) {
      const next = phase + TAU / 32;
      hits += footContactsCrossed(phase, next >= TAU ? next - TAU : next, contacts);
      phase = next >= TAU ? next - TAU : phase + TAU / 32;
    }
    assert.equal(hits, 2, name);
  }
});

test('event names map to cues, and unreachable water and ledge names stay silent', () => {
  assert.equal(soundForMapEvent({type: 'map.jump.started'}), 'jump-takeoff');
  assert.equal(soundForMapEvent({type: 'map.jump.landed'}), 'jump-land');
  assert.equal(soundForMapEvent({type: 'map.vault.started'}), 'vault-takeoff');
  assert.equal(soundForMapEvent({type: 'map.vault.landed'}), 'vault-land');
  assert.equal(soundForMapEvent({type: 'map.roll.started'}), 'roll');
  assert.equal(soundForMapEvent({type: 'map.roll.finished'}), 'roll-recover');
  assert.equal(soundForMapEvent({type: 'map.object.interacted'}), 'interact');
  assert.equal(soundForMapEvent({type: 'map.traversal.started', action: 'vault'}), 'vault-takeoff');
  assert.equal(soundForMapEvent({type: 'map.traversal.started', action: 'climb-up'}), 'climb');
  assert.equal(soundForMapEvent({type: 'map.traversal.started', action: 'climb-down'}), 'climb');
  assert.equal(soundForMapEvent({type: 'map.traversal.started'}), null);
  assert.equal(soundForMapEvent({type: 'map.move.started'}), null);
  assert.equal(soundForMapEvent({type: 'map.restored'}), null);
  for (const type of ['map.water.entered', 'map.dive.started', 'map.ledge.grab', 'map.ledge.hang', 'map.ledge.climb', 'map.ledge.climbed', 'map.ledge.release', 'map.ledge.dropped']) {
    assert.equal(Object.hasOwn(MAP_EVENT_SOUNDS, type), true, type);
    assert.equal(MAP_EVENT_SOUNDS[type], null, type);
    assert.equal(soundForMapEvent({type}), null, type);
  }
  assert.equal(soundForMapEvent({type: 'map.unknown'}), null);
  assert.equal(Object.hasOwn(MAP_EVENT_SOUNDS, 'map.unknown'), false);
});

test('surfaces, distance, pan and livestock ignore villagers and unknown species', () => {
  assert.equal(surfaceAt(grid, 0.2, 0.2), 'grass');
  assert.equal(surfaceAt(grid, 1.2, 0.2), 'road');
  assert.equal(surfaceAt(grid, 2.2, 0.2), 'sand');
  assert.equal(surfaceAt(grid, 3.2, 0.2), 'water');
  assert.equal(distanceGain(1, 2, 14), 1);
  assert.equal(distanceGain(14, 2, 14), 0);
  assert.ok(distanceGain(8, 2, 14) > 0 && distanceGain(8, 2, 14) < 1);
  assert.equal(screenPan(100, 100, 200), 0);
  assert.ok(screenPan(200, 0, 100) <= 0.6);
  assert.ok(screenPan(0, 200, 100) >= -0.6);
  assert.equal(windShelter(3), 0.7);
  assert.equal(windShelter(9), 1);
  const roster = livestockRoster([
    {id: 'hero', appearance: {kind: 'villager'}, npc: {species: 'human'}},
    {id: 'child', appearance: {kind: 'villager'}, npc: {species: 'child'}},
    {id: 'hen', appearance: {kind: 'livestock'}, npc: {species: 'chicken'}},
    {id: 'bossy', appearance: {kind: 'livestock'}, npc: {species: 'cow'}},
    {id: 'wool', appearance: {kind: 'livestock'}, npc: {species: 'sheep'}},
    {id: 'goat', appearance: {kind: 'livestock'}, npc: {species: 'goat'}}
  ]);
  assert.deepEqual(roster.map(animal => animal.species), ['chicken', 'cow', 'sheep']);
  for (const value of Object.values(MAP_AUDIO_LEVELS)) assert.ok(value > 0 && value <= 0.45);
  assert.ok(MAP_AUDIO_NODES <= MAP_AUDIO_NODE_BUDGET);
  assert.equal(mapAudioMemory(8000).bytes, 32000);
  assert.equal(mapAudioMemory(8000).buffers, 1);
});

test('scheduling waits for a gesture, alternates step voices, and follows the actor', async () => {
  const context = fakeContext();
  const audio = new MapAudio({volume: 0.45, createContext: () => context});
  assert.equal(audio.context, null);
  assert.equal(audio.handle({type: 'map.jump.started', actor: 'hero'}, 'hero'), false);
  assert.equal(await new MapAudio().unlock(), false);
  assert.equal(await audio.unlock(), true);
  assert.equal(context.state, 'running');
  assert.equal(audio.nodeCount, context.counts.nodes);
  assert.equal(audio.bufferSamples * 4, mapAudioMemory(context.sampleRate).bytes);
  assert.equal(audio.handle({type: 'map.jump.started', actor: 'npc'}, 'hero'), false);
  assert.equal(audio.handle({type: 'map.jump.started', actor: 'hero'}, 'hero'), true);
  assert.equal(audio.recentCues().at(-1).name, 'jump-takeoff');
  assert.ok(audio.accent.gain.gain.events.some(event => event[0] === 'exp' && event[1] === MAP_AUDIO_LEVELS.jumpTakeoff));
  const actor = actorAt(0.2);
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.phase = Math.PI + 0.05;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 1);
  actor.phase = TAU - 0.04;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.phase = 0.08;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 1);
  const steps = audio.recentCues().filter(cue => cue.name === 'step');
  assert.deepEqual(steps.map(cue => cue.voice), [0, 1]);
  assert.equal(steps[0].surface, 'grass');
  assert.ok(steps[0].gain > 0.1 && steps[0].gain <= MAP_AUDIO_LEVELS.step * 1.08);
  assert.ok(audio.steps[0].gain.gain.events.some(event => event[0] === 'hold'));
  assert.ok(audio.steps[1].gain.gain.events.some(event => event[0] === 'hold'));
  actor.x = 1.5;
  actor.gaitWeight = 0.2;
  actor.phase = Math.PI + 0.05;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 1);
  const quiet = audio.recentCues().at(-1);
  assert.equal(quiet.surface, 'road');
  assert.ok(quiet.gain < 0.1);
  actor.x = 2.5;
  actor.gaitWeight = 1;
  actor.phase = TAU - 0.05;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.phase = 0.05;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 1);
  assert.equal(audio.recentCues().at(-1).surface, 'sand');
  actor.x = 3.5;
  actor.phase = Math.PI;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.x = 0.5;
  actor.skidding = true;
  actor.phase = TAU - 0.02;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.phase = 0.04;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.skidding = false;
  actor.rolling = true;
  actor.phase = Math.PI;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  actor.rolling = false;
  assert.equal(audio.handle({type: 'map.roll.started', actor: 'hero'}, 'hero'), true);
  assert.equal(audio.handle({type: 'map.vault.landed', actor: 'hero'}, 'hero'), true);
  assert.equal(audio.handle({type: 'map.vault.landed', actor: 'hero'}, 'hero'), false);
  assert.equal(audio.recentCues().filter(cue => cue.name === 'vault-land').length, 1);
  assert.equal(audio.handle({type: 'map.water.entered', actor: 'hero'}, 'hero'), false);
  audio.handle({type: 'map.restored'});
  actor.phase = 0.4;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  audio.setMuted(true);
  actor.phase = Math.PI + 0.4;
  assert.equal(audio.poll(actor, grid, FOOT_CONTACTS.procedural), 0);
  assert.equal(audio.cueAnimal('goat', 1, 0), false);
  audio.setMuted(false);
  await audio.resume();
  assert.equal(audio.cueAnimal('chicken', 1, 0.2), true);
  assert.equal(audio.cueAnimal('cow', 0.5, -0.2), true);
  assert.equal(audio.recentCues().at(-1).placeholder, true);
  assert.equal(audio.cueAnimal('sheep', 0, 0), false);
  assert.throws(() => audio.setVolume(NaN), /finite/);
  audio.setVolume(4);
  assert.equal(audio.volume, 1);
  audio.dispose();
});

test('play settings keep a finite volume and a boolean sound switch', () => {
  const storage = {getItem: () => JSON.stringify({volume: 'loud', sound: 'yes', movementMode: 'walk'}), setItem(){}};
  assert.equal(readPlaySettings(storage).volume, 0.45);
  assert.equal(readPlaySettings(storage).sound, true);
  assert.equal(readPlaySettings(storage).movementMode, 'walk');
  const high = {getItem: () => JSON.stringify({volume: 2, sound: false}), setItem(){}};
  assert.equal(readPlaySettings(high).volume, 1);
  assert.equal(readPlaySettings(high).sound, false);
  const low = {getItem: () => JSON.stringify({volume: -3}), setItem(){}};
  assert.equal(readPlaySettings(low).volume, 0);
  assert.equal(readPlaySettings({getItem: () => '{', setItem(){}}).volume, MAP_AUDIO_LEVELS.master);
  assert.equal(settingsKey, 'posecraft-map-play-settings-v1');
});

test('the town waterfall is quiet at the village and audible beside a fall', () => {
  const map = createTownMap();
  const clusters = clusterSources(waterfallSources(map));
  assert.ok(clusters.length >= 2 && clusters.length <= 8, `clusters ${clusters.length}`);
  const hero = map.actors[0];
  const nearest = {index: -1, distance: Infinity};
  assert.equal(nearestInto(clusters, hero.x, hero.y, nearest), true);
  assert.ok(nearest.distance > WATERFALL_FAR, `village hears a fall at ${nearest.distance.toFixed(1)} tiles`);
  assert.equal(distanceGain(nearest.distance, 2, WATERFALL_FAR), 0);
  assert.ok(distanceGain(3, 2, WATERFALL_FAR) > 0.5);
  const water = {found: false, distance: Infinity, x: 0, y: 0};
  nearestWaterInto(map, hero.x, hero.y, RIVER_FAR, water);
  assert.equal(water.found, false);
  const roster = livestockRoster(map.actors);
  assert.ok(roster.some(animal => animal.species === 'cow'));
  assert.ok(roster.some(animal => animal.species === 'sheep'));
  assert.ok(roster.some(animal => animal.species === 'chicken'));
  assert.equal(roster.some(animal => animal.species === 'human' || animal.species === 'child'), false);
});
