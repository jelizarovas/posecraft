import {validateAttachments} from './scene-attachments.js';
import {validateActorBehaviors} from './actor-behaviors.js';
import {validateMotionLayers} from './motion-layers.js';
import {validateScrollConfig} from './scroll-bindings.js';
import {validateSceneObjects} from './scene-objects.js';
import {validatePropGames} from './prop-games.js';
import {validateBottleFluid} from './bottle-validation.js';
import {validateInteractions} from './pointer-interactions.js';
import {validateBehaviorGraph} from './behaviors.js';
import {lightRanges} from './lighting.js';
import {spatialChannels} from './spatial.js';
export const capabilities = Object.freeze({ schemaVersion: 1, renderer: 'svg', renderers: ['svg','canvas'], features: ['rigs', 'paths', 'instances', 'timelines', 'input-states', 'transactions', 'translation-inertia', 'appearance-variants', 'expressions','rigid-body-physics','response-states','synth-audio','prop-colliders','assisted-recovery','assisted-walking','spatial-rig','scene-lighting','scenery-layers','campfire-ensemble','soft-limbs','hair-shell','scene-groups','procedural-emitters','contacts','behavior-graphs','pointer-interactions','bottle-fluid','action-variations','directional-artwork','pose-bindings','scene-depth','surface-decals','skinned-mesh','scene-objects','prop-games','motion-layers','scroll-bindings','actor-behaviors','navigation','prop-attachments','contact-targets'], unavailable: ['general-fluid-dynamics', 'svg-import','inter-character-collisions'] });
const safeId = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const colors = /^(#[0-9a-fA-F]{3,8}|none)$/;
const record = v => v && typeof v === 'object' && !Array.isArray(v);
const finite = (v, min = -10000, max = 10000) => Number.isFinite(v) && v >= min && v <= max;
const fields=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key));

function validateSpatialMesh(mesh,joints,path,check){
 check(fields(mesh,['vertices','triangles','correctives','creaseAngle']),path,'Expected mesh vertices, triangles and optional correctives or crease angle.');if(!record(mesh))return;
 const vertices=Array.isArray(mesh.vertices)?mesh.vertices:[],triangles=Array.isArray(mesh.triangles)?mesh.triangles:[];
 check(Array.isArray(mesh.vertices)&&vertices.length>=3&&vertices.length<=512,path+'.vertices','Expected 3..512 weighted vertices.');
 check(Array.isArray(mesh.triangles)&&triangles.length>=1&&triangles.length<=1024,path+'.triangles','Expected 1..1024 triangles.');
 for(const [i,vertex]of vertices.entries()){
  const p=path+'.vertices.'+i,weights=Array.isArray(vertex?.weights)?vertex.weights:[];check(fields(vertex,['weights'])&&weights.length>=1&&weights.length<=4,p,'A vertex needs 1..4 joint weights.');let total=0;const used=new Set();
  for(const [n,w]of weights.entries()){const q=p+'.weights.'+n;check(fields(w,['joint','x','y','z','weight'])&&joints.has(w.joint)&&!used.has(w.joint),q,'Weights need distinct existing joints.');if(!record(w))continue;used.add(w.joint);check(finite(w.x)&&finite(w.y)&&(w.z===undefined||finite(w.z)),q,'Expected finite local coordinates within -10000..10000.');check(finite(w.weight,Number.MIN_VALUE,1),q+'.weight','Expected a positive weight no greater than 1.');total+=w.weight;}
  check(Number.isFinite(total)&&Math.abs(total-1)<=1e-6,p+'.weights','Vertex weights must sum to 1.');
 }
 const faces=new Set();for(const [i,face]of triangles.entries()){const valid=Array.isArray(face)&&face.length===3&&face.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length)&&new Set(face).size===3,key=valid?face.slice().sort((a,b)=>a-b).join(','):null;check(valid&&!faces.has(key),path+'.triangles.'+i,'Expected three distinct existing vertex indices and no duplicate triangles.');if(valid)faces.add(key);}
 if(mesh.creaseAngle!==undefined)check(finite(mesh.creaseAngle,0,180),path+'.creaseAngle','Expected crease angle 0..180 degrees.');
 if(mesh.correctives!==undefined){check(Array.isArray(mesh.correctives)&&mesh.correctives.length<=32,path+'.correctives','Expected at most 32 correctives.');let count=0;for(const [i,c]of (Array.isArray(mesh.correctives)?mesh.correctives:[]).entries()){
  const p=path+'.correctives.'+i;check(fields(c,['joint','channel','min','max','offsets']),p,'Expected a corrective driver and vertex offsets.');if(!record(c))continue;
  const joint=joints.get(c.joint),range=c.channel==='rotation'&&joint?[joint.min,joint.max]:({yaw:[-180,180],pitch:[-90,90],bend:[0,1]})[c.channel];check(!!joint&&!!range&&finite(c.min,...range)&&finite(c.max,...range)&&c.min<c.max,p,'Expected an existing joint, supported channel and increasing range within its limits.');
  const offsets=Array.isArray(c.offsets)?c.offsets:[];check(Array.isArray(c.offsets)&&offsets.length<=512,p+'.offsets','Expected at most 512 vertex offsets.');count+=offsets.length;const used=new Set();
  for(const [n,o]of offsets.entries()){const q=p+'.offsets.'+n;check(fields(o,['vertex','x','y','z'])&&Number.isInteger(o.vertex)&&o.vertex>=0&&o.vertex<vertices.length&&!used.has(o.vertex),q,'Expected a distinct existing vertex index.');if(!record(o))continue;used.add(o.vertex);check(['x','y','z'].some(k=>o[k]!==undefined)&&['x','y','z'].every(k=>o[k]===undefined||finite(o[k],-4096,4096)),q,'Expected at least one finite corrective offset within -4096..4096.');}
 }check(count<=2048,path+'.correctives','At most 2048 corrective offsets per mesh.');}
}

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
    if (++count > 500000 || depth > 24) throw new Error('Document exceeds resource limits.');
    if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`${path}: only JSON data is accepted.`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path}: expected a finite number.`);
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`${path}: reserved key.`);
      walk(child, `${path}.${key}`, depth + 1);
    }
  }
  try { walk(doc, '$', 0); if (JSON.stringify(doc).length > 5000000) throw new Error('Document exceeds 5 MB.'); } catch (e) { return { valid: false, errors: [{ path: '$', message: e.message }] }; }
  check(doc.schemaVersion === 1, 'schemaVersion', 'Only schema version 1 is supported.');
  if(doc.canvasDepth!==undefined)check(doc.canvasDepth==='actor'&&doc.renderer==='canvas','canvasDepth','Actor depth requires Canvas renderer.');
  if(doc.renderer!==undefined)check(['svg','canvas'].includes(doc.renderer),'renderer','Expected svg or canvas renderer.');
  check(doc.kind === 'scene', 'kind', 'Expected scene.');
  check(safeId.test(doc.id), 'id', 'Use a stable alphanumeric ID.');
  check(typeof doc.name === 'string' && doc.name.length <= 100, 'name', 'Expected a name up to 100 characters.');
  check(Number.isSafeInteger(doc.revision) && doc.revision >= 0, 'revision', 'Expected a nonnegative revision.');
  check(record(doc.bounds) && finite(doc.bounds.width, 1, 4096) && finite(doc.bounds.height, 1, 4096), 'bounds', 'Width and height must be 1..4096.');
  if(doc.lighting!==undefined){const l=doc.lighting;check(record(l),'lighting','Expected scene lighting.');if(record(l)){
    for(const [key,values] of Object.entries({type:['directional','point'],receiver:['corner','floor'],motion:['none','orbit','flicker']}))if(l[key]!==undefined)check(values.includes(l[key]),'lighting.'+key,'Unknown lighting option.');
    if(l.showSource!==undefined)check(typeof l.showSource==='boolean','lighting.showSource','Expected boolean.');
    if(l.shading!==undefined)check(['gradient','cel'].includes(l.shading),'lighting.shading','Expected gradient or cel.');
    if(l.enabled!==undefined)check(typeof l.enabled==='boolean','lighting.enabled','Expected boolean.');
    for(const [key,[min,max]] of Object.entries(lightRanges))if(l[key]!==undefined)check(finite(l[key],min,max),'lighting.'+key,`Expected ${min}..${max}.`);
    for(const key of ['color','shadowColor'])if(l[key]!==undefined)check(typeof l[key]==='string'&&/^#[a-fA-F0-9]{6}$/.test(l[key]),'lighting.'+key,'Expected a six-digit hex color.');
  }}
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
    if(pack.spatial!==undefined)check(typeof pack.spatial==='boolean',p+'.spatial','Expected boolean.');
    const partIds = new Set(),meshJoints=new Map(pack.joints.filter(record).map(j=>[j.id,j]));
    for (const part of pack.parts) {
      if (!record(part)) { check(false, `${p}.parts`, 'Expected part.'); continue; }
      check(safeId.test(part.id) && !partIds.has(part.id), `${p}.parts`, 'Part IDs must be unique.'); partIds.add(part.id);
      check(joints.has(part.joint), `${p}.parts.${part.id}.joint`, 'Missing joint.');
      check(typeof part.d === 'string' && part.d.length <= 200000 && /^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\s-]+$/.test(part.d), `${p}.parts.${part.id}.d`, 'Expected SVG path geometry only.');
      check(colors.test(part.fill), `${p}.parts.${part.id}.fill`, 'Expected hex color or none.');
      if (part.stroke !== undefined) check(colors.test(part.stroke), `${p}.parts.${part.id}.stroke`, 'Expected hex color or none.');
      if (part.strokeWidth !== undefined) check(finite(part.strokeWidth, 0, 30), `${p}.parts.${part.id}.strokeWidth`, 'Invalid stroke width.');
      if (part.transform !== undefined) check(typeof part.transform === 'string' && part.transform.length < 300 && /^(\s*(translate|scale|rotate|matrix)\(\s*[-+0-9.eE,\s]+\)\s*)*$/.test(part.transform), `${p}.parts.${part.id}.transform`, 'Only numeric SVG transforms are supported.');
      if(part.opacityChannel!==undefined)check(pack.spatial===true&&typeof part.opacityChannel==='string'&&joints.has(part.opacityChannel.split('.')[0])&&part.opacityChannel===part.opacityChannel.split('.')[0]+'.opacity',`${p}.parts.${part.id}.opacityChannel`,'Expected a spatial joint opacity channel.');
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
      if(part.spatial){
        const v=part.spatial,q=`${p}.parts.${part.id}.spatial`;
        check(pack.spatial===true&&record(v),q,'Spatial parts require a spatial rig.');
        for(const key of ['depth','order'])if(v[key]!==undefined)check(finite(v[key],-500,500),q,'Invalid depth.');
        if(v.thickness!==undefined)check(finite(v.thickness,.05,1)&&['x','y'].includes(v.axis),q,'Invalid volume thickness.');
        if(v.center!==undefined)check(Array.isArray(v.center)&&v.center.length===2&&v.center.every(n=>finite(n,-1000,1000)),q,'Invalid part center.');
        if(v.hairShell!==undefined)check(record(v.hairShell)&&['width','height','depth'].every(k=>finite(v.hairShell[k],1,100))&&finite(v.hairShell.y,-200,200)&&!v.softLimb&&!v.morph,q,'Invalid hair shell dimensions.');
        if(v.facingFade!==undefined)check(finite(v.facingFade,.01,1)&&['front','back'].includes(v.facing),q,'Facing fade requires a facing side and range .01..1.');
        if(v.facing!==undefined)check(['front','back'].includes(v.facing),q,'Invalid facing.');
        if(v.surface!==undefined)check(record(v.surface)&&finite(v.surface.x,-500,500)&&finite(v.surface.width,1,500)&&finite(v.surface.depth,1,500)&&Math.abs(v.surface.x)<v.surface.width,q,'Invalid curved surface.');
        if(v.sceneDepth!==undefined){depthField(v.sceneDepth,q+'.sceneDepth',pack.joints);check(v.surfaceOf===undefined,q+'.sceneDepth','Surface decorations inherit scene depth from their host.');}
        if(v.surfaceOf!==undefined){const host=pack.parts.find(candidate=>candidate?.id===v.surfaceOf);check(typeof v.surfaceOf==='string'&&!!host&&host.id!==part.id&&host.spatial?.surfaceOf===undefined,q+'.surfaceOf','Expected a different host part without its own surface attachment.');}
        if(v.mask!==undefined)check(pack.parts.some(p=>p.id===v.mask)&&v.mask!==part.id,q,'Missing mask part.');
        if(v.mesh!==undefined){check(!['softLimb','hairShell','turnaround','morph','surface'].some(key=>v[key]!==undefined),q+'.mesh','Mesh cannot combine with another geometry deformation.');check(doc.requiredFeatures?.includes('skinned-mesh'),'requiredFeatures','Mesh scenes must declare skinned-mesh.');validateSpatialMesh(v.mesh,meshJoints,q+'.mesh',check);}
        if(v.turnaround!==undefined){const views=v.turnaround?.views,number=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,signature=typeof part.d==='string'?part.d.replace(number,'#'):null;
          check(record(v.turnaround)&&Array.isArray(views)&&views.length>=3&&views.length<=73&&!v.morph&&!v.softLimb&&!v.hairShell&&!v.surface,q,'Turnaround needs 3..73 compatible directional paths.');
          if(Array.isArray(views)){let previous=-1;for(const [i,view]of views.entries()){check(record(view)&&finite(view.angle,0,360)&&view.angle>previous&&typeof view.d==='string'&&view.d.length<=20000&&/^[MmZzLlHhVvCcSsQqTtEe0-9.,+\s-]+$/.test(view.d)&&view.d.replace(number,'#')===signature&&(view.d.match(number)||[]).length>0&&(view.d.match(number)||[]).every(n=>finite(Number(n),-10000,10000)),q+'.turnaround.views.'+i,'Expected increasing angles and finite paths with matching commands.');previous=view?.angle;}
            check(views[0]?.angle===0&&views.at(-1)?.angle===360&&views[0]?.d===views.at(-1)?.d,q,'Turnaround must close from 0 to 360 with matching artwork.');}
        }
        if(v.softLimb){const e=pack.joints.find(j=>j.id===v.softLimb.elbow),h=pack.joints.find(j=>j.id===v.softLimb.hand);check(record(v.softLimb)&&e?.parent===part.joint&&h?.parent===e?.id&&finite(v.softLimb.radius,1,30)&&!v.morph,q,'Soft limbs require a connected elbow and hand, radius 1..30, and no morph.');}
        if(v.morph){const number=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,target=v.morph.target;
          check(typeof target==='string'&&target.length<=200000&&/^[MmZzLlHhVvCcSsQqTtEe0-9.,+\s-]+$/.test(target)&&target.replace(number,'#')===part.d.replace(number,'#')&&(target.match(number)||[]).length>0&&[...(target.match(number)||[]),...(part.d.match(number)||[])].every(n=>Number.isFinite(Number(n)))&&joints.has(v.morph.channel?.split('.')[0])&&v.morph.channel===v.morph.channel?.split('.')[0]+'.bend',q,'Morph paths must have matching commands and coordinates; use a joint bend channel.');
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
      check(safeId.test(id) && finite(clip.duration, .1, 180) && typeof clip.loop === 'boolean', `${p}.clips.${id}`, 'Invalid clip duration or loop.');
      if (clip.events !== undefined) {
        const seen = new Set();
        check(Array.isArray(clip.events) && clip.events.length <= 128 && clip.events.every((event, i) => {
          if (!record(event) || !finite(event.time, 0, clip.duration) || typeof event.name !== 'string' || !event.name.trim() || event.name !== event.name.trim() || event.name.length > 80 || /[\u0000-\u001f\u007f]/.test(event.name) || i > 0 && event.time < clip.events[i-1].time) return false;
          const key = JSON.stringify([event.time, event.name]);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        }), `${p}.clips.${id}.events`, 'Use at most 128 ordered markers with finite clip times and unique name/time pairs. Names need 1–80 trimmed characters without control characters.');
      }
      for (const [key, track] of Object.entries(clip.tracks)) {
        const [joint, property] = key.split('.');
        check(joints.has(joint) && (['rotation', 'x', 'y'].includes(property)||pack.spatial&&Object.hasOwn(spatialChannels,property)) && key === `${joint}.${property}`, `${p}.clips.${id}.${key}`, 'Unknown animation channel.');
        const spec = pack.joints.find(j => j.id === joint),range=pack.spatial&&spatialChannels[property];
        check(Array.isArray(track) && track.length > 0 && track.length <= 1000 && track.every((pair, i) => Array.isArray(pair) && (pair.length === 2 || pair.length === 3) && finite(pair[0], 0, clip.duration) && finite(pair[1], property === 'rotation' ? spec?.min : range?.min??-1000, property === 'rotation' ? spec?.max : range?.max??1000) && (!i || pair[0] > track[i-1][0]) && (pair[2] === undefined || ['linear', 'smooth', 'step'].includes(pair[2]))), `${p}.clips.${id}.${key}`, 'Keys must be ordered, finite, in bounds, and use supported easing.');
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
    if(pack.physics){
      const profile=pack.physics;check(record(profile.bodies)&&record(profile.responses)&&joints.has(profile.root)&&joints.has(profile.head),`${p}.physics`,'Invalid physical rig profile.');
      check(profile.bodies[profile.root]&&profile.bodies[profile.head],`${p}.physics`,'Physical head and root bodies are required.');
      for(const [id,body] of Object.entries(profile.bodies)){
        const j=pack.joints.find(j=>j.id===id);check(j&&(!j.parent||profile.bodies[j.parent]),`${p}.physics.bodies.${id}`,'Physical parents must have bodies.');
        check(record(body)&&finite(body.width,1,500)&&finite(body.height,1,500)&&finite(body.x,-500,500)&&finite(body.y,-500,500)&&finite(body.density,.1,20),`${p}.physics.bodies.${id}`,'Invalid collision box.');
      }
      for(const [name,pose] of Object.entries(profile.responses)){check(['brace','protect','curl'].includes(name)&&record(pose),`${p}.physics.responses`,'Unknown response pose.');for(const [key,value] of Object.entries(pose)){const j=pack.joints.find(j=>key===j.id+'.rotation');check(j&&finite(value,j.min,j.max),`${p}.physics.responses.${name}`,'Response rotations must obey joint limits.');}}
    }
    for (const [emotion, pose] of Object.entries(pack.expressions || {})) {
      check(pack.inputs.emotion?.options?.includes(emotion) && record(pose), `${p}.expressions.${emotion}`, 'Expression needs an emotion input.');
      for (const [key, value] of Object.entries(pose)) check(channels.has(key) && finite(value,-180,180), `${p}.expressions.${emotion}.${key}`, 'Invalid expression channel.');
    }
  }
  check(doc.props === undefined || Array.isArray(doc.props), 'props', 'Expected prop array.');
  const propIds = new Set();
  check((doc.props?.length || 0) <= 32, 'props', 'At most 32 props.');
  for (const prop of Array.isArray(doc.props) ? doc.props : []) {
    if (!record(prop)) { check(false, 'props', 'Expected prop.'); continue; }
    const p = `props.${prop.id}`;
    check(safeId.test(prop.id) && !propIds.has(prop.id), p, 'Prop IDs must be unique.'); propIds.add(prop.id);
    check(typeof prop.name === 'string' && prop.name.length <= 100, p, 'Expected name.');
    check(finite(prop.x) && finite(prop.y) && finite(prop.width, 4, 4096) && finite(prop.height, 4, 4096) && finite(prop.rotation, -180, 180) && colors.test(prop.fill), p, 'Invalid prop rectangle.');
    const c = prop.collider;
    check(record(c) && typeof c.enabled === 'boolean' && finite(c.width, 4, 4096) && finite(c.height, 4, 4096) && finite(c.x, -4096, 4096) && finite(c.y, -4096, 4096) && finite(c.friction, 0, 2) && finite(c.bounce, 0, 1), p+'.collider', 'Invalid collision box.');
  }
  function depthField(value,path,joints){if(value===undefined)return;const fixed=record(value)&&Object.hasOwn(value,'value');check(record(value)&&(fixed?Object.keys(value).every(k=>k==='value')&&finite(value.value,-10000,10000):Array.isArray(joints)&&Object.keys(value).every(k=>['joint','offset'].includes(k))&&typeof value.joint==='string'&&joints.some(j=>j.id===value.joint)&&(value.offset===undefined||finite(value.offset,-4096,4096))),path,'Expected fixed scene depth -10000..10000, or an actor joint with optional offset -4096..4096.');}
  for(const prop of (Array.isArray(doc.props)?doc.props:[]).filter(record))depthField(prop.depth,'props.'+prop.id+'.depth');
  const meshBudget=doc.actors.reduce((total,actor)=>{for(const part of doc.packs[actor?.pack]?.parts||[]){const m=part?.spatial?.mesh;if(Array.isArray(m?.vertices))total.vertices+=m.vertices.length;if(Array.isArray(m?.triangles))total.triangles+=m.triangles.length;}return total;},{vertices:0,triangles:0});
  check(meshBudget.vertices<=8192&&meshBudget.triangles<=16384,'actors','Instantiated meshes exceed 8192 vertices or 16384 triangles.');
  const actorIds = new Set();
  for (const a of doc.actors) {
    if (!record(a)) { check(false, 'actors', 'Expected actor.'); continue; }
    depthField(a.depth,'actors.'+a.id+'.depth',doc.packs[a.pack]?.joints);
    if(a.groundY!==undefined)check(finite(a.groundY,0,4096),`actors.${a.id}.groundY`,'Expected ground height 0..4096.');
    if(a.layer!==undefined)check(['background','characters','foreground'].includes(a.layer),`actors.${a.id}.layer`,'Unknown drawing layer.');
    if(a.unlit!==undefined)check(typeof a.unlit==='boolean',`actors.${a.id}.unlit`,'Expected boolean.');
    check(safeId.test(a.id) && !actorIds.has(a.id), `actors.${a.id}`, 'Actor IDs must be unique.'); actorIds.add(a.id);
    check(typeof a.name === 'string' && a.name.length <= 100, `actors.${a.id}.name`, 'Expected name.');
    check(Object.hasOwn(doc.packs, a.pack), `actors.${a.id}.pack`, 'Missing pack.');
    check(record(a.transform) && finite(a.transform.x) && finite(a.transform.y) && finite(a.transform.scale, .05, 10) && finite(a.transform.rotation, -180, 180), `actors.${a.id}.transform`, 'Invalid transform.');
    if (a.appearance) for (const value of Object.values(a.appearance)) check(colors.test(value), `actors.${a.id}.appearance`, 'Expected hex color.');
    if(a.behavior){
      const b=a.behavior;check(record(b),`actors.${a.id}.behavior`,'Expected behavior settings.');
      if(b.mode!==undefined)check(['animated','floating','ragdoll','protective'].includes(b.mode)&&(b.mode==='animated'||doc.packs[a.pack]?.physics),`actors.${a.id}.behavior.mode`,'Mode requires a physical rig.');
      for(const [key,max] of [['resistance',1],['gravity',2],['bounce',1]])if(b[key]!==undefined)check(finite(b[key],0,max),`actors.${a.id}.behavior.${key}`,'Invalid physical setting.');
      if(b.strategy!==undefined)check(['auto','brace','protect','curl'].includes(b.strategy),`actors.${a.id}.behavior.strategy`,'Unknown protective strategy.');
      if(b.autoRecover!==undefined)check(typeof b.autoRecover==='boolean',`actors.${a.id}.behavior.autoRecover`,'Expected boolean.');
      if(b.autoFace!==undefined)check(typeof b.autoFace==='boolean',`actors.${a.id}.behavior.autoFace`,'Expected boolean.');
    }
    for (const [name, value] of Object.entries(a.inputs || {})) {
      const spec = doc.packs[a.pack]?.inputs?.[name];
      check(spec && typeof value === spec.type && (!spec.options || spec.options.includes(value)) && (spec.type !== 'number' || finite(value, spec.min, spec.max)), `actors.${a.id}.inputs.${name}`, 'Invalid actor input.');
    }
  }
  check(doc.groups===undefined||Array.isArray(doc.groups),'groups','Expected scene folder array.');
  const groups=Array.isArray(doc.groups)?doc.groups:[],groupIds=new Set();
  check(groups.length<=32,'groups','At most 32 scene folders.');
  for(const g of groups){if(!record(g)){check(false,'groups','Expected folder.');continue;}check(typeof g.id==='string'&&safeId.test(g.id)&&!groupIds.has(g.id),'groups','Folder IDs must be unique.');groupIds.add(g.id);check(typeof g.name==='string'&&g.name.length>0&&g.name.length<=100,'groups.'+g.id,'Expected a folder name.');if(g.hidden!==undefined)check(typeof g.hidden==='boolean','groups.'+g.id+'.hidden','Expected boolean.');}
  const groupMap=new Map(groups.filter(record).map(g=>[g.id,g]));
  for(const g of groups.filter(record)){check(g.parent===null||groupIds.has(g.parent),'groups.'+g.id+'.parent','Missing parent folder.');const visited=new Set([g.id]);let at=g.parent;while(at&&groupMap.has(at)){if(visited.has(at)){check(false,'groups.'+g.id+'.parent','Folder cycle.');break;}visited.add(at);at=groupMap.get(at).parent;}check(visited.size<=8,'groups.'+g.id,'Folders support eight levels.');}
  function nodeFields(node,path){if(node.group!==undefined)check(groupIds.has(node.group),path+'.group','Missing scene folder.');if(node.hidden!==undefined)check(typeof node.hidden==='boolean',path+'.hidden','Expected boolean.');if(node.layer!==undefined)check(['background','characters','foreground'].includes(node.layer),path+'.layer','Unknown drawing layer.');}
  for(const a of doc.actors.filter(record))nodeFields(a,'actors.'+a.id);
  for(const p of (Array.isArray(doc.props)?doc.props:[]).filter(record))nodeFields(p,'props.'+p.id);
  check(doc.emitters===undefined||Array.isArray(doc.emitters),'emitters','Expected emitter array.');
  const emitters=Array.isArray(doc.emitters)?doc.emitters:[],emitterIds=new Set();let particles=0;
  check(emitters.length<=16,'emitters','At most 16 emitters.');
  const ranges={x:[-10000,10000],y:[-10000,10000],rate:[0,60],lifetime:[.1,30],speed:[0,300],spread:[0,500],randomness:[0,1],seed:[0,4294967295],size:[.5,300],opacity:[0,1],maxParticles:[1,128]};
  for(const e of emitters){if(!record(e)){check(false,'emitters','Expected emitter.');continue;}const p='emitters.'+e.id;check(typeof e.id==='string'&&safeId.test(e.id)&&!emitterIds.has(e.id),p,'Emitter IDs must be unique.');emitterIds.add(e.id);check(typeof e.name==='string'&&e.name.length>0&&e.name.length<=100,p+'.name','Expected emitter name.');check(['flame','smoke','embers'].includes(e.type),p+'.type','Unknown emitter type.');check(typeof e.enabled==='boolean',p+'.enabled','Expected boolean.');for(const [key,[min,max]] of Object.entries(ranges))check(finite(e[key],min,max),p+'.'+key,`Expected ${min}..${max}.`);check(Number.isInteger(e.seed)&&Number.isInteger(e.maxParticles),p,'Seed and particle cap must be integers.');check(typeof e.color==='string'&&/^#[a-fA-F0-9]{6}$/.test(e.color),p+'.color','Expected six-digit hex color.');if(e.actor!==undefined)check(actorIds.has(e.actor),p+'.actor','Missing emitter anchor actor.');nodeFields(e,p);particles+=Number.isFinite(e.maxParticles)?e.maxParticles:0;}
  check(particles<=512,'emitters','At most 512 reserved particle slots per scene.');
  if(doc.lighting?.emitter!==undefined)check(typeof doc.lighting.emitter==='string'&&emitterIds.has(doc.lighting.emitter),'lighting.emitter','Missing light emitter.');
  check(doc.contacts===undefined||Array.isArray(doc.contacts),'contacts','Expected contact constraint array.');
  const contacts=Array.isArray(doc.contacts)?doc.contacts:[],contactIds=new Set();
  check(contacts.length<=64,'contacts','At most 64 contact constraints per scene.');
  for(const contact of contacts){
   if(!record(contact)){check(false,'contacts','Expected contact constraint.');continue;}
   const p='contacts.'+contact.id,actor=doc.actors.find(a=>a.id===contact.actor),pack=doc.packs[actor?.pack];
   check(typeof contact.id==='string'&&safeId.test(contact.id)&&!contactIds.has(contact.id),p,'Contact IDs must be unique.');contactIds.add(contact.id);
   check(typeof contact.name==='string'&&contact.name.length>0&&contact.name.length<=100,p+'.name','Expected contact name.');
   check(typeof contact.enabled==='boolean',p+'.enabled','Expected boolean.');check(!!pack,p+'.actor','Missing contact actor.');
   check(record(contact.chain),p+'.chain','Expected upper, lower and end joints.');
   if(record(contact.chain)&&pack){const {upper,lower,end}=contact.chain,a=pack.joints.find(j=>j.id===upper),b=pack.joints.find(j=>j.id===lower),c=pack.joints.find(j=>j.id===end);check(!!a&&!!b&&!!c&&new Set([upper,lower,end]).size===3&&b.parent===upper&&c.parent===lower,p+'.chain','Contact chain must be connected upper/lower/end joints.');if(b&&c)check(Math.hypot(b.x,b.y)>.001&&Math.hypot(c.x,c.y)>.001,p+'.chain','Contact bones need nonzero rest offsets.');}
   check([1,-1].includes(contact.bend),p+'.bend','Bend side must be -1 or 1.');check(finite(contact.weight,0,1),p+'.weight','Expected weight 0..1.');
   check(finite(contact.start,0,180)&&finite(contact.end,0,180)&&contact.start<=contact.end,p,'Contact window must be ordered within 0..180 seconds.');
   if(contact.period!==undefined)check(finite(contact.period,.1,180),p+'.period','Expected repeat period .1..180 seconds.');
   if(contact.clip!==undefined)check(typeof contact.clip==='string'&&!!pack?.clips?.[contact.clip],p+'.clip','Missing contact clip.');
   for(const key of ['fadeIn','fadeOut'])if(contact[key]!==undefined)check(finite(contact[key],0,180),p+'.'+key,'Fade time must be 0..180 seconds.');
   check((contact.fadeIn||0)+(contact.fadeOut||0)<=contact.end-contact.start,p,'Contact fades must fit the active window.');
   if(['object','prop'].includes(contact.target?.type)||contact.fadeIn!==undefined||contact.fadeOut!==undefined)check(doc.requiredFeatures?.includes('contact-targets'),'requiredFeatures','Declare contact-targets.');
   if(contact.keepOrientation!==undefined)check(typeof contact.keepOrientation==='boolean',p+'.keepOrientation','Expected boolean.');
   const target=contact.target;check(record(target)&&['point','joint','object','prop'].includes(target.type),p+'.target','Expected point, joint, prop or shared object target.');
   if(record(target)&&target.type==='point')check(finite(target.x)&&finite(target.y),p+'.target','Expected finite scene target coordinates.');
   if(record(target)&&['object','prop'].includes(target.type)){const field=target.type==='object'?'objects':'props';check(Array.isArray(doc[field])&&doc[field].some(v=>v?.id===target[target.type]),p+'.target','Missing target '+target.type+'.');check(Object.keys(target).every(k=>['type',target.type,'offsetX','offsetY'].includes(k)),p+'.target','Unknown target setting.');for(const key of ['offsetX','offsetY'])if(target[key]!==undefined)check(finite(target[key],-1000,1000),p+'.target.'+key,'Expected offset -1000..1000.');}
   if(record(target)&&target.type==='joint'){const targetActor=doc.actors.find(a=>a.id===target.actor),targetPack=doc.packs[targetActor?.pack];check(!!targetPack?.joints.some(j=>j.id===target.joint),p+'.target','Missing target actor or joint.');for(const key of ['offsetX','offsetY'])if(target[key]!==undefined)check(finite(target[key],-1000,1000),p+'.target.'+key,'Expected local offset -1000..1000.');}
  }
  if(doc.ensemble!==undefined){const e=doc.ensemble;check(record(e)&&e.type==='campfire'&&Number.isInteger(e.seed)&&finite(e.seed,0,4294967295),'ensemble','Expected a seeded campfire ensemble.');
   if(record(e)){check(Array.isArray(e.members)&&e.members.length===4&&new Set(e.members).size===4,'ensemble.members','Expected four distinct campers.');
    for(const id of Array.isArray(e.members)?e.members:[]){const actor=doc.actors.find(a=>a.id===id),pack=doc.packs[actor?.pack];check(!!pack?.spatial&&pack.clips?.campfire?.duration===24&&['root','head','hold-upper','hold-elbow','hold-hand','take-upper','take-elbow','take-hand','food','skewer','camp-eyes','camp-smile'].every(id=>pack.joints.some(j=>j.id===id)),'ensemble.members','Campers require the campfire rig and clip.');}
    const sky=doc.actors.find(a=>a.id===e.sky),p=doc.packs[sky?.pack];check(!!p&&[0,1].every(i=>p.joints.some(j=>j.id==='meteor-'+i)&&Array.from({length:16},(_,n)=>'meteor-'+i+'-tail-'+n).every(id=>p.joints.some(j=>j.id===id))),'ensemble.sky','Missing meteor scenery rig.');
   }
  }
  validateBehaviorGraph(doc,check);
  validateActorBehaviors(doc,check);
  validateInteractions(doc,check);
  validateBottleFluid(doc,check);
  validateSceneObjects(doc,check);
  validateAttachments(doc,check);
  validatePropGames(doc,check);
  validateMotionLayers(doc,check);
  if(doc.scroll!==undefined)validateScrollConfig(doc,doc.scroll,check);
  return { valid: errors.length === 0, errors };
}

export function assertDocument(doc) {
  const result = validateDocument(doc);
  if (!result.valid) { const error = new Error(result.errors.map(e => `${e.path}: ${e.message}`).join('\n')); error.diagnostics = result.errors; throw error; }
  return doc;
}
