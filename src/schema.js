export const capabilities = Object.freeze({ schemaVersion: 1, renderer: 'svg', features: ['rigs', 'paths', 'instances', 'timelines', 'input-states', 'transactions', 'translation-inertia', 'appearance-variants', 'expressions'], unavailable: ['contacts', 'ragdoll', 'fluids', 'mesh-deformation', 'svg-import', 'attachments'] });
const safeId = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const colors = /^(#[0-9a-fA-F]{3,8}|none)$/;
const record = v => v && typeof v === 'object' && !Array.isArray(v);
const finite = (v, min = -10000, max = 10000) => Number.isFinite(v) && v >= min && v <= max;

export function validateDocument(doc) {
  try { return validateStructure(doc); }
  catch (error) { return { valid: false, errors: [{ path: '$', message: `Malformed scene structure: ${error.message}` }] }; }
}
function validateStructure(doc) {
  const errors = [];
  const check = (condition, path, message) => { if (!condition) errors.push({ path, message }); };
  if (!record(doc)) return { valid: false, errors: [{ path: '$', message: 'Expected a scene object.' }] };
  // Bound import cost and reject executable values and prototype-sensitive keys before compilation.
  let count = 0;
  function walk(value, path, depth) {
    if (++count > 200000 || depth > 24) throw new Error('Document exceeds resource limits.');
    if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`${path}: only JSON data is accepted.`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path}: expected a finite number.`);
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`${path}: reserved key.`);
      walk(child, `${path}.${key}`, depth + 1);
    }
  }
  try { walk(doc, '$', 0); if (JSON.stringify(doc).length > 5000000) throw new Error('Document exceeds 5 MB.'); } catch (e) { return { valid: false, errors: [{ path: '$', message: e.message }] }; }
  check(doc.schemaVersion === 1, 'schemaVersion', 'Only schema version 1 is supported.');
  check(doc.kind === 'scene', 'kind', 'Expected scene.');
  check(safeId.test(doc.id), 'id', 'Use a stable alphanumeric ID.');
  check(typeof doc.name === 'string' && doc.name.length <= 100, 'name', 'Expected a name up to 100 characters.');
  check(Number.isSafeInteger(doc.revision) && doc.revision >= 0, 'revision', 'Expected a nonnegative revision.');
  check(record(doc.bounds) && finite(doc.bounds.width, 1, 4096) && finite(doc.bounds.height, 1, 4096), 'bounds', 'Width and height must be 1..4096.');
  check(doc.requiredFeatures === undefined || Array.isArray(doc.requiredFeatures), 'requiredFeatures', 'Expected capability array.');
  for (const feature of Array.isArray(doc.requiredFeatures) ? doc.requiredFeatures : []) check(capabilities.features.includes(feature), 'requiredFeatures', `Unsupported capability: ${feature}`);
  if (!record(doc.packs) || !Array.isArray(doc.actors)) return { valid: false, errors: [...errors, { path: '$', message: 'Expected packs and actors.' }] };
  check(Object.keys(doc.packs).length <= 16 && doc.actors.length <= 24, '$', 'At most 16 packs and 24 actors.');
  for (const [packId, pack] of Object.entries(doc.packs)) {
    const p = `packs.${packId}`;
    if (!record(pack) || !Array.isArray(pack.joints) || !Array.isArray(pack.parts) || !record(pack.clips) || !record(pack.inputs) || !record(pack.states)) { check(false, p, 'Expected joints, parts, clips, inputs and states.'); continue; }
    check(safeId.test(packId), p, 'Invalid pack ID.');
    check(pack.joints.length > 0 && pack.joints.length <= 128 && pack.parts.length <= 1000, p, 'Rig or geometry exceeds limits.');
    const joints = new Set();
    for (const j of pack.joints) {
      if (!record(j)) { check(false, p, 'Expected joint object.'); continue; }
      check(safeId.test(j.id) && !joints.has(j.id), `${p}.joints`, 'Joint IDs must be unique.');
      check(j.parent === null || joints.has(j.parent), `${p}.joints.${j.id}.parent`, 'Parent must precede its child.');
      check(['x', 'y', 'rotation', 'min', 'max', 'length'].every(k => finite(j[k])) && j.length >= 0 && j.min <= j.rotation && j.rotation <= j.max && j.min >= -180 && j.max <= 180, `${p}.joints.${j.id}`, 'Invalid rest transform or joint limits.');
      joints.add(j.id);
    }
    const partIds = new Set();
    for (const part of pack.parts) {
      if (!record(part)) { check(false, `${p}.parts`, 'Expected part.'); continue; }
      check(safeId.test(part.id) && !partIds.has(part.id), `${p}.parts`, 'Part IDs must be unique.'); partIds.add(part.id);
      check(joints.has(part.joint), `${p}.parts.${part.id}.joint`, 'Missing joint.');
      check(typeof part.d === 'string' && part.d.length <= 200000 && /^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\s-]+$/.test(part.d), `${p}.parts.${part.id}.d`, 'Expected SVG path geometry only.');
      check(colors.test(part.fill), `${p}.parts.${part.id}.fill`, 'Expected hex color or none.');
      if (part.stroke !== undefined) check(colors.test(part.stroke), `${p}.parts.${part.id}.stroke`, 'Expected hex color or none.');
      if (part.strokeWidth !== undefined) check(finite(part.strokeWidth, 0, 30), `${p}.parts.${part.id}.strokeWidth`, 'Invalid stroke width.');
      if (part.transform !== undefined) check(typeof part.transform === 'string' && part.transform.length < 300 && /^(\s*(translate|scale|rotate|matrix)\(\s*[-+0-9.eE,\s]+\)\s*)*$/.test(part.transform), `${p}.parts.${part.id}.transform`, 'Only numeric SVG transforms are supported.');
      if (part.channel !== undefined) check(safeId.test(part.channel), `${p}.parts.${part.id}.channel`, 'Invalid appearance channel.');
      if (part.variants !== undefined) {
        const input = pack.inputs[part.variantInput];
        check(record(part.variants) && input?.type === 'string', `${p}.parts.${part.id}.variants`, 'Variants require a string input.');
        for (const [name, variant] of Object.entries(part.variants || {})) {
          check(input?.options?.includes(name) && record(variant), `${p}.parts.${part.id}.variants.${name}`, 'Unknown variant.');
          if (variant.d !== undefined) check(typeof variant.d === 'string' && variant.d.length <= 200000 && /^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\s-]+$/.test(variant.d), `${p}.parts.${part.id}.variants.${name}.d`, 'Invalid variant geometry.');
          if (variant.transform !== undefined) check(typeof variant.transform === 'string' && variant.transform.length < 300 && /^(\s*(translate|scale|rotate|matrix)\(\s*[-+0-9.eE,\s]+\)\s*)*$/.test(variant.transform), `${p}.parts.${part.id}.variants.${name}.transform`, 'Invalid variant transform.');
          if (variant.visible !== undefined) check(typeof variant.visible === 'boolean', `${p}.parts.${part.id}.variants.${name}.visible`, 'Expected boolean.');
        }
      }
      if (part.showWhen) check(Object.hasOwn(pack.inputs, part.showWhen.input) && typeof part.showWhen.equals === pack.inputs[part.showWhen.input].type, `${p}.parts.${part.id}.showWhen`, 'Invalid visibility condition.');
    }
    for (const [id, input] of Object.entries(pack.inputs)) {
      check(safeId.test(id), `${p}.inputs.${id}`, 'Invalid input ID.');
      check(record(input) && ['boolean', 'number', 'string'].includes(input.type) && typeof input.default === input.type, `${p}.inputs.${id}`, 'Input default must match its type.');
      if (input?.type === 'number') check(finite(input.min) && finite(input.max) && finite(input.default, input.min, input.max), `${p}.inputs.${id}`, 'Numeric input needs finite bounds.');
      if (input?.type === 'string') check(Array.isArray(input.options) && input.options.includes(input.default) && input.options.every(v => typeof v === 'string' && v.length <= 100), `${p}.inputs.${id}`, 'String input needs options.');
    }
    for (const [id, clip] of Object.entries(pack.clips)) {
      if (!record(clip) || !record(clip.tracks)) { check(false, `${p}.clips.${id}`, 'Expected clip tracks.'); continue; }
      check(safeId.test(id) && finite(clip.duration, .1, 60) && typeof clip.loop === 'boolean', `${p}.clips.${id}`, 'Invalid clip duration or loop.');
      for (const [key, track] of Object.entries(clip.tracks)) {
        const [joint, property] = key.split('.');
        check(joints.has(joint) && ['rotation', 'x', 'y'].includes(property) && key === `${joint}.${property}`, `${p}.clips.${id}.${key}`, 'Unknown animation channel.');
        const spec = pack.joints.find(j => j.id === joint);
        check(Array.isArray(track) && track.length > 0 && track.length <= 1000 && track.every((pair, i) => Array.isArray(pair) && (pair.length === 2 || pair.length === 3) && finite(pair[0], 0, clip.duration) && finite(pair[1], property === 'rotation' ? spec?.min : -1000, property === 'rotation' ? spec?.max : 1000) && (!i || pair[0] > track[i-1][0]) && (pair[2] === undefined || ['linear', 'smooth', 'step'].includes(pair[2]))), `${p}.clips.${id}.${key}`, 'Keys must be ordered, finite, in bounds, and use supported easing.');
      }
    }
    check(Object.hasOwn(pack.states, pack.initial), `${p}.initial`, 'Missing initial state.');
    for (const [id, state] of Object.entries(pack.states)) {
      check(safeId.test(id) && record(state) && Object.hasOwn(pack.clips, state.clip), `${p}.states.${id}`, 'State must reference a clip.');
      if (state?.transitions !== undefined && !Array.isArray(state.transitions)) { check(false, `${p}.states.${id}`, 'Expected transition array.'); continue; }
      for (const t of state?.transitions || []) {
        check(record(t) && Object.hasOwn(pack.states, t.to) && finite(t.duration, 0, 2), `${p}.states.${id}`, 'Invalid transition target or blend duration.');
        check(record(t.when) && Object.hasOwn(pack.inputs, t.when.input) && typeof t.when.equals === pack.inputs[t.when.input]?.type, `${p}.states.${id}`, 'Transition requires a typed input condition.');
      }
    }
    if (pack.reaction) check(joints.has(pack.reaction.joint) && finite(pack.reaction.strength, 0, 2) && finite(pack.reaction.stiffness, 10, 200) && finite(pack.reaction.damping, 2, 40), `${p}.reaction`, 'Invalid spring settings.');
    if (pack.appearanceDefaults !== undefined) {
      check(record(pack.appearanceDefaults), `${p}.appearanceDefaults`, 'Expected color channel defaults.');
      for (const [name, value] of Object.entries(pack.appearanceDefaults)) check(safeId.test(name) && colors.test(value), `${p}.appearanceDefaults`, 'Invalid color channel default.');
    }
    const channels = new Set(pack.joints.flatMap(j => ['x','y','rotation'].map(prop => `${j.id}.${prop}`)));
    for (const [emotion, pose] of Object.entries(pack.expressions || {})) {
      check(pack.inputs.emotion?.options?.includes(emotion) && record(pose), `${p}.expressions.${emotion}`, 'Expression needs an emotion input.');
      for (const [key, value] of Object.entries(pose)) check(channels.has(key) && finite(value,-180,180), `${p}.expressions.${emotion}.${key}`, 'Invalid expression channel.');
    }
  }
  const actorIds = new Set();
  for (const a of doc.actors) {
    if (!record(a)) { check(false, 'actors', 'Expected actor.'); continue; }
    check(safeId.test(a.id) && !actorIds.has(a.id), `actors.${a.id}`, 'Actor IDs must be unique.'); actorIds.add(a.id);
    check(typeof a.name === 'string' && a.name.length <= 100, `actors.${a.id}.name`, 'Expected name.');
    check(Object.hasOwn(doc.packs, a.pack), `actors.${a.id}.pack`, 'Missing pack.');
    check(record(a.transform) && finite(a.transform.x) && finite(a.transform.y) && finite(a.transform.scale, .05, 10) && finite(a.transform.rotation, -180, 180), `actors.${a.id}.transform`, 'Invalid transform.');
    if (a.appearance) for (const value of Object.values(a.appearance)) check(colors.test(value), `actors.${a.id}.appearance`, 'Expected hex color.');
    for (const [name, value] of Object.entries(a.inputs || {})) {
      const spec = doc.packs[a.pack]?.inputs?.[name];
      check(spec && typeof value === spec.type && (!spec.options || spec.options.includes(value)) && (spec.type !== 'number' || finite(value, spec.min, spec.max)), `actors.${a.id}.inputs.${name}`, 'Invalid actor input.');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertDocument(doc) {
  const result = validateDocument(doc);
  if (!result.valid) { const error = new Error(result.errors.map(e => `${e.path}: ${e.message}`).join('\n')); error.diagnostics = result.errors; throw error; }
  return doc;
}
