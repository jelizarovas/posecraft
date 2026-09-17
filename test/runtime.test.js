import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationController, forwardKinematics, interpolate, sampleClip, solveTwoBoneIK } from '../src/index.js';

const bone = (id, parent, x, length) => ({ id, parent, x, y: 0, length, rotation: 0, min: -180, max: 180 });
// A crane, not a humanoid: no eyes, hands, robe, React, or browser.
const crane = () => ({
  joints: [bone('boom', null, 0, 10), bone('jib', 'boom', 10, 8)],
  defaults: { 'boom.rotation': 0, 'jib.rotation': 0 },
  clips: {
    parked: { duration: 1, loop: true, tracks: { 'boom.rotation': [[0, 0], [1, 0]] } },
    lift: { duration: 1, loop: false, tracks: { 'boom.rotation': [[0, 0], [1, 60]] }, events: [{ time: .5, name: 'halfway' }] }
  },
  events: ['LIFT'],
  layers: [{ name: 'boom', initial: 'parked', mode: 'override', weight: 1,
    mask: ['boom.rotation'], neutral: { 'boom.rotation': 0 },
    states: { parked: { clip: 'parked', transitions: [{ event: 'LIFT', to: 'lift', duration: 0 }] }, lift: { clip: 'lift' } }
  }]
});

test('a non-humanoid rig runs without character-specific inputs or effects', () => {
  const runtime = new AnimationController(crane());
  const events = [];
  runtime.subscribe(event => events.push(event));
  runtime.send('LIFT');
  const frame = runtime.step(.5);
  assert.equal(frame.pose['boom.rotation'], 30);
  assert.ok(Math.abs(frame.world.jib.x - Math.cos(Math.PI / 6) * 10) < 1e-9);
  assert.equal('cloth' in frame, false);
  assert.equal(events.filter(event => event.type === 'marker').length, 1);
  runtime.step(.5);
  assert.equal(runtime.frame.pose['boom.rotation'], 60);
  assert.equal(events.filter(event => event.type === 'complete').length, 1);
});

test('a skeleton alone has a valid resting pose', () => {
  const runtime = new AnimationController({ joints: [bone('root', null, 0, 1)] });
  assert.equal(runtime.step(1).world.root.endX, 1);
});

test('custom IK targets do not require left or right hand conventions', () => {
  const definition = crane();
  definition.inputs = { reach: { type: 'number', default: 10, min: 1, max: 16 } };
  definition.chains = [{ id: 'tool', upper: 'boom', lower: 'jib', bend: 1,
    target: ({ inputs }) => ({ x: inputs.reach, y: 8, weight: 1 }) }];
  const runtime = new AnimationController(definition);
  assert.ok(runtime.frame.targets.tool.error < .001);
  runtime.setInput('reach', 6);
  assert.ok(runtime.step(.1).targets.tool.error < .001);
  assert.throws(() => runtime.setInput('reach', NaN));
});

test('default IK channels and zero weight preserve a pose', () => {
  const definition = crane();
  definition.defaults = { ...definition.defaults, 'ik.tool.x': 10, 'ik.tool.y': 8, 'ik.tool.weight': 0 };
  definition.chains = [{ id: 'tool', upper: 'boom', lower: 'jib', bend: 1 }];
  const runtime = new AnimationController(definition);
  assert.equal(runtime.frame.world.jib.endX, 18);
  definition.defaults['ik.tool.x'] = NaN;
  assert.throws(() => new AnimationController(definition), /Invalid IK target/);
});

test('math functions preserve interpolation, constraints, and bone lengths', () => {
  assert.equal(interpolate([[0, 0], [1, 10]], .25, 'linear'), 2.5);
  assert.equal(sampleClip({ duration: 1, loop: true, tracks: { x: [[0, 0], [1, 10]] } }, 1.5).x, 5);
  const joints = crane().joints;
  const pose = solveTwoBoneIK(joints, {}, { upper: 'boom', lower: 'jib', bend: 1 }, { x: 10, y: 8 });
  const world = forwardKinematics(joints, pose);
  assert.ok(Math.abs(Math.hypot(world.jib.endX - world.jib.x, world.jib.endY - world.jib.y) - 8) < 1e-9);
});

test('takes round trip and invalid imports leave the current take intact', () => {
  const runtime = new AnimationController(crane());
  runtime.setKeyframe('boom', 0, 0);
  runtime.setKeyframe('boom', 1, 80);
  const take = runtime.exportTake();
  const other = new AnimationController(crane());
  other.importTake(take);
  assert.equal(other.seek(.5).pose['boom.rotation'], 40);
  assert.throws(() => other.importTake({ ...take, duration: -1 }));
  assert.deepEqual(other.exportTake(), take);
});
