import {sampleEmitters} from './emitters.js';
import {nodeVisible} from './scene-graph.js';
import {surfaceStopValues,sampleLighting,partLighting,actorAnchor,wallProjection,lightingConfig,surfaceStops,surfaceRamp,surfaceFocus,shadowProjection,contactShadow,lightingDefinitions} from './lighting.js';
import {spatialParts} from './spatial.js';
let spatialInstance=0;
import { assertDocument } from './schema.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const transform = w => `translate(${w.x} ${w.y}) rotate(${w.rotation})`;
const spatialBone=j=>`matrix(${j.m[0]} ${j.m[3]} ${j.m[1]} ${j.m[4]} ${j.x} ${j.y})`;
const placement = t => `${transform(t)} scale(${t.scale})`;
function cameraTransform(c,bounds){
 if(![c.x,c.y,c.rotation,c.zoom,c.width,c.height].every(Number.isFinite)||c.zoom<=0||c.width<=0||c.height<=0)throw new Error('Invalid camera.');
 return `translate(${c.width/2} ${c.height/2}) scale(${c.width/bounds.width*c.zoom}) rotate(${-c.rotation}) translate(${-c.x} ${-c.y})`;
}
function appearance(part, actor, evaluated) {
  const variant = part.variants?.[evaluated.inputs?.[part.variantInput]] || {};
  return { d: variant.d || part.d, fill: actor.appearance?.[part.channel] || part.fill, transform: `${variant.transform || ''} ${part.transform || ''}`.trim(), visible: variant.visible !== false && (!part.showWhen || evaluated.inputs?.[part.showWhen.input] === part.showWhen.equals) };
}
function limitArc(joint, rotation) {
  const r = 18, angle = deg => deg * Math.PI / 180;
  const from = angle(joint.min - rotation), to = angle(joint.max - rotation), span = joint.max - joint.min;
  if (span >= 359) return 'M18 0 A18 18 0 1 0 -18 0 A18 18 0 1 0 18 0';
  return `M0 0 L${r*Math.cos(from)} ${r*Math.sin(from)} A${r} ${r} 0 ${span>180?1:0} 1 ${r*Math.cos(to)} ${r*Math.sin(to)} Z`;
}
function physicsOverlay(frame,document){return frame.actors.filter(a=>a.physics&&(!document||nodeVisible(document,document.actors.find(node=>node.id===a.id)))).map(a=>{
 const p=a.physics,c=p.center,n=value=>Number(value).toFixed(2);
 return p.contacts.map(v=>`<circle cx="${n(v.x)}" cy="${n(v.y)}" r="3" fill="#df7951"/>`).join('')+`<circle cx="${n(c.x)}" cy="${n(c.y)}" r="3" fill="#418ea1"/><path d="M${n(c.x)} ${n(c.y)}l${n(p.velocity.x*.15)} ${n(p.velocity.y*.15)}" stroke="#418ea1" stroke-width="1.5"/>`;
}).join('');}
const particlePath=kind=>kind==='flame'?'M0 0C-.56-.11-.61-.39-.14-1C-.22-.69.64-.47.28-.03Q.11.07 0 0Z':kind==='smoke'?'M-1 0C-1.4-.6-.6-1.2 0-.8C.5-1.2 1.3-.5 1 0C1.2.7.3 1-.2.6C-.8 1-1.5.4-1 0Z':'M-1 0A1 1 0 1 0 1 0A1 1 0 1 0-1 0Z';
const particleTransform=p=>`translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.scaleX} ${p.scaleY})`;
function emitterPlacement(document,frame,emitter){const actor=emitter.actor&&document.actors.find(a=>a.id===emitter.actor);return actor?placement(frame.actors.find(a=>a.id===actor.id)?.placement||actor.transform):'';}
function emitterVisible(document,emitter){const actor=emitter.actor&&document.actors.find(a=>a.id===emitter.actor);return emitter.enabled&&nodeVisible(document,emitter)&&(!emitter.actor||actor&&nodeVisible(document,actor));}
function emitterSVG(document,frame,sample){const {emitter,particles}=sample;return `<g data-emitter="${emitter.id}" data-emitter-type="${emitter.type}" transform="${emitterPlacement(document,frame,emitter)}" visibility="${emitterVisible(document,emitter)?'visible':'hidden'}" display="${emitterVisible(document,emitter)?'inline':'none'}" pointer-events="none" aria-hidden="true">${particles.map(p=>`<path data-particle="${p.slot}" d="${particlePath(p.kind)}" transform="${particleTransform(p)}" fill="${p.color}" opacity="${p.opacity}"/>`).join('')}</g>`;}
export function renderSVG(document, frame, { label = document.name, bones = false, limits = false, selectedActor, selectedJoint,physicsDebug=false,colliders=false,selectedProp,camera=frame.camera } = {}) {
  assertDocument(document);
  const prefix='pc-view-'+(++spatialInstance),light=sampleLighting(lightingConfig(document,frame),frame.effectsTime??frame.localTime??frame.time),emitterSamples=sampleEmitters(document,frame.effectsTime??frame.localTime??frame.time);
  const effects=light.enabled?`<rect data-light-wash="" width="${document.bounds.width}" height="${document.bounds.height}" fill="url(#${prefix}-wash)" pointer-events="none"/>`+document.actors.filter(a=>!a.unlit).map(actor=>{
   const receiver={...light,floorY:actor.groundY??light.floorY};
   const evaluated=frame.actors.find(a=>a.id===actor.id),p=placement(evaluated.placement||actor.transform),href=`#${prefix}-${actor.id}-artwork`,contact=contactShadow(actor,document.packs[actor.pack],evaluated,receiver),anchor=actorAnchor(actor,evaluated),wall=wallProjection(receiver,anchor);
   return `<g data-light-effects="${actor.id}" visibility="${nodeVisible(document,actor)?'visible':'hidden'}" display="${nodeVisible(document,actor)?'inline':'none'}" pointer-events="none" aria-hidden="true">${receiver.wallShadow&&receiver.receiver==='corner'?`<g data-wall-strength="" clip-path="url(#${prefix}-wall)" opacity="${receiver.wallShadow}"><g data-wall-shadow="" visibility="${wall?'visible':'hidden'}" transform="${wall||''}" filter="url(#${prefix}-shadow)"><use data-light-placement="" href="${href}" transform="${p}"/></g></g>`:''}${receiver.floorShadow?`<g data-floor-strength="" clip-path="url(#${prefix}-floor)" opacity="${receiver.floorShadow}"><g filter="url(#${prefix}-shadow)"><g data-floor-shadow="" transform="${shadowProjection(receiver,anchor)}"><use data-light-placement="" href="${href}" transform="${p}"/></g></g></g><ellipse data-contact="${actor.id}" cx="${contact.cx}" cy="${receiver.floorY}" rx="${contact.rx}" ry="5" fill="${receiver.shadowColor}" opacity="${contact.opacity}" filter="url(#${prefix}-shadow)"/>`:''}${receiver.reflection?`<g data-reflection="" mask="url(#${prefix}-mirror-mask)" opacity="${receiver.reflection}"><g transform="translate(0 ${2*light.floorY}) scale(1 -1)"><use data-light-placement="" href="${href}" transform="${p}"/></g></g>`:''}</g>`;
  }).join(''):'';
  const renderProps=layer=>(document.props||[]).filter(p=>(p.layer||'background')===layer).map(p=>{const c=p.collider;return `<g data-prop="${p.id}" visibility="${nodeVisible(document,p)?'visible':'hidden'}" display="${nodeVisible(document,p)?'inline':'none'}" transform="${transform(p)}"><title>${escape(p.name)}</title><rect x="${-p.width/2}" y="${-p.height/2}" width="${p.width}" height="${p.height}" rx="3" fill="${escape(p.fill)}" stroke="${p.id===selectedProp?'#7351bd':'#797481'}" stroke-width="${p.id===selectedProp?2:1}"/>${colliders||physicsDebug||p.id===selectedProp?`<rect data-collider="${p.id}" x="${c.x-c.width/2}" y="${c.y-c.height/2}" width="${c.width}" height="${c.height}" fill="none" stroke="${c.enabled?'#df7951':'#999999'}" stroke-width="1.5" stroke-dasharray="5 3" pointer-events="none"/>`:''}</g>`;}).join('');
  const renderActor=actor=>{
    const pack = document.packs[actor.pack], evaluated = frame.actors.find(a => a.id === actor.id);
    if (!evaluated) throw new Error(`Missing evaluated actor ${actor.id}`);
    const spatial=spatialParts(pack,evaluated),ordered=spatial?spatial.order.map(id=>pack.parts[spatial.parts.get(id).index]):pack.parts;
    const masks=spatial?[...new Set(pack.parts.map(p=>p.spatial?.mask).filter(Boolean))]:[];
    const gradients=light.enabled&&!actor.unlit?pack.parts.map(part=>{const paint=appearance(part,actor,evaluated),surfaceLight=partLighting(light,actor,evaluated,part,spatial),ramp=surfaceRamp(paint.fill,surfaceLight);if(!ramp)return '';const focus=surfaceFocus(surfaceLight,(evaluated.placement||actor.transform).rotation,`${spatial?.parts.get(part.id).transform||transform(evaluated.world[part.joint])} ${paint.transform}`);return `<radialGradient data-surface="${part.id}" data-shading="${light.shading}" id="${prefix}-${actor.id}-${part.id}-surface" cx="${focus.cx}" cy="${focus.cy}" r=".85">${surfaceStops(ramp,surfaceLight)}</radialGradient>`;}).join(''):'';
    const definitions=gradients+masks.map(id=>{const p=pack.parts.find(p=>p.id===id),paint=appearance(p,actor,evaluated);return `<clipPath id="${prefix}-${actor.id}-${id}" clipPathUnits="userSpaceOnUse"><path data-mask-part="${id}" d="${escape(paint.d)}" transform="${spatial.parts.get(id).transform} ${escape(paint.transform)}"/></clipPath>`;}).join('');
    return `<g data-actor="${actor.id}" visibility="${nodeVisible(document,actor)?'visible':'hidden'}" display="${nodeVisible(document,actor)?'inline':'none'}" data-activity="${escape(evaluated.activity||'')}" data-response="${escape(evaluated.response||'calm')}" data-emotion="${escape(evaluated.inputs?.emotion||'neutral')}" transform="${placement(evaluated.placement||actor.transform)}"><defs>${definitions}</defs><g data-artwork="" id="${prefix}-${actor.id}-artwork">${ordered.map(part => {
      const paint = appearance(part,actor,evaluated),view=spatial?.parts.get(part.id);
      return `<g data-slot="${part.id}" ${part.spatial?.mask?`clip-path="url(#${prefix}-${actor.id}-${part.spatial.mask})"`:''}><g data-joint="${part.joint}" data-selected="${actor.id===selectedActor && part.joint===selectedJoint}" transform="${view?.transform||transform(evaluated.world[part.joint])}"><path opacity="${(part.opacityChannel?evaluated.pose[part.opacityChannel]??1:1)*(view?.opacity??1)}" data-part="${part.id}" d="${escape(view?.d||paint.d)}" fill="${light.enabled&&!actor.unlit&&surfaceRamp(paint.fill,light)?`url(#${prefix}-${actor.id}-${part.id}-surface)`:escape(paint.fill)}" stroke="${escape(part.stroke || 'none')}" stroke-width="${part.strokeWidth || 0}" stroke-linejoin="round" stroke-linecap="round" transform="${escape(paint.transform)}" visibility="${paint.visible&&view?.visible!==false?'visible':'hidden'}"/></g></g>`;
    }).join('')}</g>${bones ? pack.joints.map(j => `<g data-bone="${j.id}" transform="${spatial?spatialBone(spatial.world[j.id]):transform(evaluated.world[j.id])}">${limits && j.id===selectedJoint && actor.id===selectedActor ? `<path data-limit="${j.id}" d="${limitArc(j,evaluated.pose[j.id+'.rotation'])}" fill="#9c71ff22" stroke="#7955be" stroke-width=".6" pointer-events="none"/>`:''}<path d="M0 0H${j.length || 12}" stroke="#7751bd" stroke-width="1.1" pointer-events="none"/><circle r="3" fill="${j.id===selectedJoint&&actor.id===selectedActor?'#7253bc':'#fff'}" stroke="#7253bc" stroke-width="1"/><circle data-handle="${j.id}" cx="${j.length || 12}" r="2.2" fill="#7253bc" stroke="#fff" stroke-width=".6"/></g>`).join('') : ''}</g>`;

  };
  const renderLayer=layer=>document.actors.filter(a=>(a.layer||'characters')===layer).map(a=>renderActor(a)+emitterSamples.filter(s=>s.emitter.actor===a.id).map(s=>emitterSVG(document,frame,s)).join('')).join('')+emitterSamples.filter(s=>!s.emitter.actor&&(s.emitter.layer||'characters')===layer).map(s=>emitterSVG(document,frame,s)).join('');
  return `<svg data-scene-time="${frame.time}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${camera?.width||document.bounds.width} ${camera?.height||document.bounds.height}" role="img" aria-label="${escape(label)}" width="100%" height="100%">${camera?`<g data-camera="" transform="${cameraTransform(camera,document.bounds)}">`:''}${lightingDefinitions(light,document.bounds,prefix)}${renderLayer('background')}${renderProps('background')}${effects}${renderLayer('characters')}${renderProps('characters')}${renderLayer('foreground')}${renderProps('foreground')}${light.enabled&&light.type==='point'&&light.showSource?`<g data-light-source="" transform="translate(${light.pointX} ${light.pointY})" pointer-events="none"><circle r="10" fill="${light.color}" stroke="#fff"/><circle r="18" fill="none" stroke="${light.color}" stroke-dasharray="2 4"/></g>`:''}${physicsDebug?`<g data-physics-debug="" pointer-events="none">${physicsOverlay(frame,document)}</g>`:''}${camera?'</g>':''}</svg>`;
}
export function mountSVG(element, document, frame, options) {
  element.innerHTML = renderSVG(document, frame, options);
  let previous;const baseLight=lightingConfig(document,frame);
  const emitterBindings=new Map((document.emitters||[]).map(e=>{const node=element.querySelector(`[data-emitter="${e.id}"]`);return [e.id,{node,particles:node?[...node.querySelectorAll('[data-particle]')]:[]}];}));
  const propBindings=(document.props||[]).map(p=>({prop:p,node:element.querySelector(`[data-prop="${p.id}"]`)}));
  const attribute=(node,key,value)=>{if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);};
  const bindings = document.actors.map(actor => {
    const root = element.querySelector(`[data-actor="${actor.id}"]`),effects=element.querySelector(`[data-light-effects="${actor.id}"]`);
    return { actor, root, effects,lightPlacements:effects?[...effects.querySelectorAll('[data-light-placement]')]:[],contact:effects?.querySelector('[data-contact]'),floor:effects?.querySelector('[data-floor-shadow]'),wall:effects?.querySelector('[data-wall-shadow]'),surfaces:[...root.querySelectorAll("[data-surface]")].map(node=>({node,part:document.packs[actor.pack].parts.find(p=>p.id===node.dataset.surface)})), artwork:root.querySelector('[data-artwork]'),slots:new Map([...root.querySelectorAll('[data-slot]')].map(node=>[node.dataset.slot,node])), joints: [...root.querySelectorAll('[data-joint], [data-bone]')], paths: document.packs[actor.pack].parts.map(part => ({ part, node:root.querySelector(`[data-part="${part.id}"]`) })), limits:[...root.querySelectorAll('[data-limit]')] };
  });
  return {
    update(next) {
      if(next===previous)return;previous=next;attribute(element.firstElementChild,'data-scene-time',next.time);const light=sampleLighting(document.lighting?.emitter?lightingConfig(document,next):baseLight,next.effectsTime??next.localTime??next.time);
      for(const {emitter,particles} of sampleEmitters(document,next.effectsTime??next.localTime??next.time)){const binding=emitterBindings.get(emitter.id);if(!binding?.node)continue;attribute(binding.node,'transform',emitterPlacement(document,next,emitter));attribute(binding.node,'visibility',emitterVisible(document,emitter)?'visible':'hidden');attribute(binding.node,'display',emitterVisible(document,emitter)?'inline':'none');for(let i=0;i<binding.particles.length;i++){const p=particles[i],node=binding.particles[i];attribute(node,'opacity',p?.opacity||0);if(p){attribute(node,'transform',particleTransform(p));attribute(node,'fill',p.color);}}}
      for(const {prop,node} of propBindings){attribute(node,'visibility',nodeVisible(document,prop)?'visible':'hidden');attribute(node,'display',nodeVisible(document,prop)?'inline':'none');}
      if(next.camera){const node=element.querySelector('[data-camera]');if(node)attribute(node,'transform',cameraTransform(next.camera,document.bounds));}
      for (const b of bindings) {
        const visible=nodeVisible(document,b.actor);attribute(b.root,'visibility',visible?'visible':'hidden');attribute(b.root,'display',visible?'inline':'none');if(b.effects){attribute(b.effects,'visibility',visible?'visible':'hidden');attribute(b.effects,'display',visible?'inline':'none');}if(!visible)continue;
        const evaluated = next.actors.find(a => a.id === b.actor.id),pack=document.packs[b.actor.pack],spatial=spatialParts(pack,evaluated);
        if(evaluated.placement)attribute(b.root,'transform',placement(evaluated.placement));
        if(b.effects){for(const [selector,opacity] of [['[data-floor-strength]',light.floorShadow],['[data-wall-strength]',light.wallShadow]]){const strength=b.effects.querySelector(selector);if(strength)attribute(strength,'opacity',opacity);}const receiver={...light,floorY:b.actor.groundY??light.floorY},anchor=actorAnchor(b.actor,evaluated),wall=wallProjection(receiver,anchor);if(b.floor)attribute(b.floor,'transform',shadowProjection(receiver,anchor));if(b.wall){attribute(b.wall,'transform',wall||'');attribute(b.wall,'visibility',wall?'visible':'hidden');}for(const node of b.lightPlacements)attribute(node,'transform',placement(evaluated.placement||b.actor.transform));const node=b.contact;if(node){const contact=contactShadow(b.actor,pack,evaluated,receiver);for(const [key,value] of Object.entries(contact))attribute(node,key,value);}
         for(const {node,part} of b.surfaces){const surfaceLight=partLighting(light,b.actor,evaluated,part,spatial),focus=surfaceFocus(surfaceLight,(evaluated.placement||b.actor.transform).rotation,`${spatial?.parts.get(part.id).transform||transform(evaluated.world[part.joint])} ${appearance(part,b.actor,evaluated).transform}`);attribute(node,'cx',focus.cx);attribute(node,'cy',focus.cy);const key=surfaceLight.intensity+':'+surfaceLight.celThickness;if(node._lightIntensity!==key){node._lightIntensity=key;const ramp=surfaceRamp(appearance(part,b.actor,evaluated).fill,surfaceLight);surfaceStopValues(ramp,surfaceLight).forEach(([offset,color],i)=>{attribute(node.children[i],'offset',offset);attribute(node.children[i],'stop-color',color);});}}
        }
        attribute(b.root,'data-activity',evaluated.activity||'');attribute(b.root,'data-recovery',evaluated.recovery?.phase||'none');attribute(b.root,'data-response',evaluated.response||'calm');attribute(b.root,'data-emotion',evaluated.inputs?.emotion||'neutral');attribute(b.root,'data-motion-mode',evaluated.physics?.mode||'animated');
        for (const node of b.joints) {
          const part=spatial?node.firstElementChild?.dataset.part:null,view=spatial?.parts.get(part);attribute(node,'transform',view?.transform||(spatial&&node.dataset.bone?spatialBone(spatial.world[node.dataset.bone]):transform(evaluated.world[node.dataset.joint || node.dataset.bone])));
        }
        if(spatial){
          const order=spatial.order.join('|');if(order!==b.order){for(const id of spatial.order)b.artwork.append(b.slots.get(id));b.order=order;}
          for(const mask of b.root.querySelectorAll('[data-mask-part]')){const part=pack.parts.find(p=>p.id===mask.dataset.maskPart);attribute(mask,'transform',spatial.parts.get(part.id).transform+' '+appearance(part,b.actor,evaluated).transform);}
        }
        const inputKey=JSON.stringify(evaluated.inputs);
        if(spatial||inputKey!==b.inputKey){b.inputKey=inputKey;for (const {part,node} of b.paths) if (spatial||part.variants || part.showWhen) { const paint=appearance(part,b.actor,evaluated),view=spatial?.parts.get(part.id);attribute(node,'d',view?.d||paint.d);attribute(node,'transform',paint.transform);attribute(node,'visibility',paint.visible&&view?.visible!==false?'visible':'hidden'); }}
        for(const {part,node} of b.paths)if(part.opacityChannel||part.spatial?.facingFade)attribute(node,'opacity',(part.opacityChannel?evaluated.pose[part.opacityChannel]??1:1)*(spatial?.parts.get(part.id).opacity??1));
        for (const node of b.limits) { const j=document.packs[b.actor.pack].joints.find(j=>j.id===node.dataset.limit);node.setAttribute('d',limitArc(j,evaluated.pose[j.id+'.rotation'])); }
      }
      const source=element.querySelector('[data-light-source]');if(source){attribute(source,'transform',`translate(${light.pointX} ${light.pointY})`);attribute(source,'visibility',light.enabled&&light.showSource?'visible':'hidden');}const wash=element.querySelector('[data-light-wash-gradient]');if(wash&&light.type==='point'){attribute(wash,'cx',light.pointX/document.bounds.width);attribute(wash,'cy',light.pointY/document.bounds.height);attribute(wash.firstElementChild,'stop-opacity',light.intensity*.2);}
      const overlay=element.querySelector('[data-physics-debug]');if(overlay)overlay.innerHTML=physicsOverlay(next,document);
    },
    dispose() { element.replaceChildren(); }
  };
}
