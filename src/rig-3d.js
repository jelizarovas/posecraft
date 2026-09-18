import {Matrix4, Quaternion, Vector3} from 'three';

const caches = new WeakMap();
const EPS = 1e-10;
const identity = [0, 0, 0, 1];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const vector = value => new Vector3().fromArray(value);
const quaternion = value => new Quaternion().fromArray(value);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}
function tuple(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) throw new Error(`${label} must contain ${length} finite numbers.`);
  return [...value];
}
function rotation(value, label) {
  const result = tuple(value, 4, label);
  if (Math.abs(Math.hypot(...result) - 1) > 1e-5) throw new Error(`${label} must be a unit quaternion.`);
  return quaternion(result).normalize().toArray();
}
function name(value, label) {
  if (typeof value !== 'string' || !value.length || value.length > 128) throw new Error(`${label} must be a nonempty name of at most 128 characters.`);
  return value;
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
function cacheFor(compiled) {
  const cache = caches.get(compiled);
  if (!cache) throw new Error('Expected a rig created by compileRig3D.');
  return cache;
}
function placementValue(value = {}) {
  record(value, 'Placement');
  const position = tuple(value.position ?? [0, 0, 0], 3, 'Placement position');
  const q = rotation(value.rotation ?? identity, 'Placement rotation');
  const scale = value.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Placement scale must be finite and positive.');
  return {position, rotation: q, scale};
}
function poseValue(cache, value) {
  record(value, 'Pose');
  const pose = Object.create(null);
  for (const [id, override] of Object.entries(value)) {
    if (!cache.byId.has(id)) throw new Error(`Unknown pose joint: ${id}.`);
    record(override, `Pose joint ${id}`);
    for (const channel of Object.keys(override)) if (!['position', 'rotation'].includes(channel)) throw new Error(`Unknown pose channel: ${id}.${channel}.`);
    pose[id] = {};
    if (own(override, 'position')) pose[id].position = tuple(override.position, 3, `${id} position`);
    if (own(override, 'rotation')) pose[id].rotation = rotation(override.rotation, `${id} rotation`);
  }
  return pose;
}

/** Compile a Y-up, Z-forward rig in meters. Chain poles are model-space points.
 * The returned bind data is an immutable copy; poses never modify the cache.
 */
export function compileRig3D(rig) {
  record(rig, 'Rig');
  if (!Array.isArray(rig.joints) || !rig.joints.length || rig.joints.length > 256) throw new Error('A rig requires 1 to 256 joints.');
  const byId = new Map();
  const joints = rig.joints.map(source => {
    record(source, 'Joint');
    const id = name(source.id, 'Joint id');
    if (byId.has(id)) throw new Error(`Duplicate joint: ${id}.`);
    const joint = {id, parent: source.parent === null ? null : name(source.parent, `${id} parent`), position: tuple(source.position, 3, `${id} bind position`), rotation: rotation(source.rotation, `${id} bind rotation`)};
    byId.set(id, joint);
    return joint;
  });
  const order = [], visited = new Set(), visiting = new Set();
  const visit = joint => {
    if (visited.has(joint.id)) return;
    if (visiting.has(joint.id)) throw new Error('Rig hierarchy contains a cycle.');
    visiting.add(joint.id);
    if (joint.parent !== null) {
      if (!byId.has(joint.parent)) throw new Error(`Missing parent: ${joint.parent}.`);
      visit(byId.get(joint.parent));
    }
    visiting.delete(joint.id); visited.add(joint.id); order.push(joint);
  };
  joints.forEach(visit);
  if (joints.filter(joint => joint.parent === null).length !== 1) throw new Error('A rig must have exactly one root joint.');
  record(rig.chains, 'Rig chains');
  if (Object.keys(rig.chains).length > 64) throw new Error('A rig supports at most 64 chains.');
  const chains = Object.create(null);
  for (const [role, source] of Object.entries(rig.chains)) {
    name(role, 'Chain role'); record(source, `Chain ${role}`);
    const chain = {root: name(source.root, 'Chain root'), middle: name(source.middle, 'Chain middle'), tip: name(source.tip, 'Chain tip'), pole: tuple(source.pole, 3, 'Chain pole')};
    if (new Set([chain.root, chain.middle, chain.tip]).size !== 3 || !byId.has(chain.root) || byId.get(chain.middle)?.parent !== chain.root || byId.get(chain.tip)?.parent !== chain.middle) throw new Error(`Chain ${role} must contain three directly connected joints.`);
    if (vector(byId.get(chain.middle).position).length() <= EPS || vector(byId.get(chain.tip).position).length() <= EPS) throw new Error(`Chain ${role} requires nonzero bone lengths.`);
    record(source.bend, 'Chain bend');
    const {min, max} = source.bend;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > Math.PI || min > max) throw new Error('Bend limits must satisfy 0 <= min <= max <= PI.');
    chain.bend = {min, max}; chains[role] = chain;
  }
  const chainOrders = new Map();
  for (const [role, chain] of Object.entries(chains)) {
    const ancestors = new Set();
    for (let joint = byId.get(chain.tip); joint; joint = byId.get(joint.parent)) ancestors.add(joint.id);
    chainOrders.set(role, Object.freeze(order.filter(joint => ancestors.has(joint.id))));
  }
  const compiled = freeze({joints, chains});
  caches.set(compiled, {byId, order: Object.freeze(order), chainOrders});
  return compiled;
}

function evaluate(cache, pose, placement, order = cache.order) {
  const world = Object.create(null), matrices = new Map(), rotations = new Map();
  const placementQ = quaternion(placement.rotation);
  const placementMatrix = new Matrix4().compose(vector(placement.position), placementQ, new Vector3().setScalar(placement.scale));
  for (const joint of order) {
    const local = pose[joint.id] ?? {}, q = quaternion(local.rotation ?? joint.rotation);
    const matrix = new Matrix4().compose(vector(local.position ?? joint.position), q, new Vector3(1, 1, 1));
    matrix.premultiply(joint.parent === null ? placementMatrix : matrices.get(joint.parent));
    const worldQ = (joint.parent === null ? placementQ.clone() : rotations.get(joint.parent).clone()).multiply(q).normalize();
    matrices.set(joint.id, matrix); rotations.set(joint.id, worldQ);
    world[joint.id] = {position: new Vector3().setFromMatrixPosition(matrix).toArray(), rotation: worldQ.toArray(), matrix: matrix.toArray()};
  }
  return world;
}

/** Absolute local pose overrides. Matrices are column-major and include placement scale. */
export function evaluateRig3D(compiled, pose = {}, placement = {}) {
  const cache = cacheFor(compiled);
  return evaluate(cache, poseValue(cache, pose), placementValue(placement));
}

function perpendicular(direction, pole, fallback) {
  const projected = pole.clone().addScaledVector(direction, -pole.dot(direction));
  if (projected.lengthSq() > EPS * EPS) return projected.normalize();
  projected.copy(fallback).addScaledVector(direction, -fallback.dot(direction));
  if (projected.lengthSq() > EPS * EPS) return projected.normalize();
  // Choose the least parallel cardinal axis at a fully straight/folded singularity.
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  axes.sort((a, b) => Math.abs(a.dot(direction)) - Math.abs(b.dot(direction)));
  return axes[0].addScaledVector(direction, -axes[0].dot(direction)).normalize();
}

/** Analytic two-bone position IK with a pole and middle-joint bend limits.
 * No translations or lengths are changed. Optional target rotation constrains
 * the tip's world orientation; otherwise its authored local rotation is kept.
 * world:'chain' returns only the chain and its ancestors. The solve and output
 * pose are unchanged; callers must evaluate full FK before drawing descendants.
 */
export function solveTwoBone3D(compiled, sourcePose = {}, chainRole, targetWorld, options = {}) {
  const cache = cacheFor(compiled), chain = compiled.chains[chainRole];
  if (!chain) throw new Error(`Unknown chain role: ${chainRole}.`);
  record(targetWorld, 'Target'); record(options, 'Solver options');
  if (options.world !== undefined && options.world !== 'full' && options.world !== 'chain') throw new Error('Solver world must be full or chain.');
  const order = options.world === 'chain' ? cache.chainOrders.get(chainRole) : cache.order;
  const target = vector(tuple(targetWorld.position, 3, 'Target position'));
  const targetRotation = targetWorld.rotation === undefined ? null : quaternion(rotation(targetWorld.rotation, 'Target rotation'));
  const pose = poseValue(cache, sourcePose), placement = placementValue(options.placement);
  const before = evaluate(cache, pose, placement, order);
  const a = vector(before[chain.root].position), b = vector(before[chain.middle].position), c = vector(before[chain.tip].position);
  const first = b.clone().sub(a), second = c.clone().sub(b), lengths = [first.length(), second.length()];
  const [l1, l2] = lengths;
  if (l1 <= EPS || l2 <= EPS) throw new Error('Cannot solve a chain with zero posed bone length.');
  const delta = target.clone().sub(a), distance = delta.length(), direction = delta.clone();
  if (distance > EPS) direction.divideScalar(distance);
  else { direction.copy(c).sub(a); if (direction.lengthSq() <= EPS * EPS) direction.copy(first); direction.normalize(); }
  const pole = options.poleWorld === undefined ? vector(chain.pole).multiplyScalar(placement.scale).applyQuaternion(quaternion(placement.rotation)).add(vector(placement.position)) : vector(tuple(options.poleWorld, 3, 'World pole'));
  const bendDirection = perpendicular(direction, pole.sub(a), first);
  const reach = bend => Math.sqrt(Math.max(0, l1*l1 + l2*l2 + 2*l1*l2*Math.cos(bend)));
  const minimum = reach(chain.bend.max), maximum = reach(chain.bend.min);
  const actualDistance = Math.max(minimum, Math.min(maximum, distance));
  const tolerance = Math.max(l1 + l2, 1) * 1e-8;
  const status = distance > l1+l2+tolerance || distance < Math.abs(l1-l2)-tolerance ? 'unreachable' : distance < minimum-tolerance || distance > maximum+tolerance ? 'limited' : 'solved';
  const along = actualDistance <= EPS ? 0 : (l1*l1-l2*l2+actualDistance*actualDistance)/(2*actualDistance);
  const height = Math.sqrt(Math.max(0, l1*l1-along*along));
  const desiredMiddle = a.clone().addScaledVector(direction, along).addScaledVector(bendDirection, height);
  const desiredTip = a.clone().addScaledVector(direction, actualDistance);
  const rootDelta = new Quaternion().setFromUnitVectors(first.clone().normalize(), desiredMiddle.clone().sub(a).normalize());
  const rootWorldQ = rootDelta.clone().multiply(quaternion(before[chain.root].rotation)).normalize();
  const movedSecond = second.clone().applyQuaternion(rootDelta).normalize();
  const middleDelta = new Quaternion().setFromUnitVectors(movedSecond, desiredTip.clone().sub(desiredMiddle).normalize());
  const middleWorldQ = middleDelta.multiply(rootDelta).multiply(quaternion(before[chain.middle].rotation)).normalize();
  const parent = cache.byId.get(chain.root).parent;
  const parentQ = quaternion(parent === null ? placement.rotation : before[parent].rotation);
  pose[chain.root] = {...pose[chain.root], rotation: parentQ.invert().multiply(rootWorldQ).normalize().toArray()};
  pose[chain.middle] = {...pose[chain.middle], rotation: rootWorldQ.clone().invert().multiply(middleWorldQ).normalize().toArray()};
  if (targetRotation) pose[chain.tip] = {...pose[chain.tip], rotation: middleWorldQ.clone().invert().multiply(targetRotation).normalize().toArray()};
  const world = evaluate(cache, pose, placement, order);
  return {pose, world, diagnostics: {status, error: vector(world[chain.tip].position).distanceTo(target), boneLengths: lengths, maxStretch: 1}};
}
