import { assertDocument } from './schema.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const transform = w => `translate(${w.x} ${w.y}) rotate(${w.rotation})`;
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
function physicsOverlay(frame){return frame.actors.filter(a=>a.physics).map(a=>{
 const p=a.physics,c=p.center,n=value=>Number(value).toFixed(2);
 return p.contacts.map(v=>`<circle cx="${n(v.x)}" cy="${n(v.y)}" r="3" fill="#df7951"/>`).join('')+`<circle cx="${n(c.x)}" cy="${n(c.y)}" r="3" fill="#418ea1"/><path d="M${n(c.x)} ${n(c.y)}l${n(p.velocity.x*.15)} ${n(p.velocity.y*.15)}" stroke="#418ea1" stroke-width="1.5"/>`;
}).join('');}
export function renderSVG(document, frame, { label = document.name, bones = false, limits = false, selectedActor, selectedJoint,physicsDebug=false,colliders=false,selectedProp,camera=frame.camera } = {}) {
  assertDocument(document);
  const props=(document.props||[]).map(p=>{const c=p.collider;return `<g data-prop="${p.id}" transform="${transform(p)}"><title>${escape(p.name)}</title><rect x="${-p.width/2}" y="${-p.height/2}" width="${p.width}" height="${p.height}" rx="3" fill="${escape(p.fill)}" stroke="${p.id===selectedProp?'#7351bd':'#797481'}" stroke-width="${p.id===selectedProp?2:1}"/>${colliders||physicsDebug||p.id===selectedProp?`<rect data-collider="${p.id}" x="${c.x-c.width/2}" y="${c.y-c.height/2}" width="${c.width}" height="${c.height}" fill="none" stroke="${c.enabled?'#df7951':'#999999'}" stroke-width="1.5" stroke-dasharray="5 3" pointer-events="none"/>`:''}</g>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${camera?.width||document.bounds.width} ${camera?.height||document.bounds.height}" role="img" aria-label="${escape(label)}" width="100%" height="100%">${camera?`<g data-camera="" transform="${cameraTransform(camera,document.bounds)}">`:''}${props}${document.actors.map(actor => {
    const pack = document.packs[actor.pack], evaluated = frame.actors.find(a => a.id === actor.id);
    if (!evaluated) throw new Error(`Missing evaluated actor ${actor.id}`);
    return `<g data-actor="${actor.id}" data-response="${escape(evaluated.response||'calm')}" data-emotion="${escape(evaluated.inputs?.emotion||'neutral')}" transform="${placement(evaluated.placement||actor.transform)}">${pack.parts.map(part => {
      const paint = appearance(part,actor,evaluated);
      return `<g data-joint="${part.joint}" data-selected="${actor.id===selectedActor && part.joint===selectedJoint}" transform="${transform(evaluated.world[part.joint])}"><path data-part="${part.id}" d="${escape(paint.d)}" fill="${escape(paint.fill)}" stroke="${escape(part.stroke || 'none')}" stroke-width="${part.strokeWidth || 0}" stroke-linejoin="round" stroke-linecap="round" transform="${escape(paint.transform)}" visibility="${paint.visible?'visible':'hidden'}"/></g>`;
    }).join('')}${bones ? pack.joints.map(j => `<g data-bone="${j.id}" transform="${transform(evaluated.world[j.id])}">${limits && j.id===selectedJoint && actor.id===selectedActor ? `<path data-limit="${j.id}" d="${limitArc(j,evaluated.pose[j.id+'.rotation'])}" fill="#9c71ff22" stroke="#7955be" stroke-width=".6" pointer-events="none"/>`:''}<path d="M0 0H${j.length || 12}" stroke="#7751bd" stroke-width="1.1" pointer-events="none"/><circle r="3" fill="${j.id===selectedJoint&&actor.id===selectedActor?'#7253bc':'#fff'}" stroke="#7253bc" stroke-width="1"/><circle data-handle="${j.id}" cx="${j.length || 12}" r="2.2" fill="#7253bc" stroke="#fff" stroke-width=".6"/></g>`).join('') : ''}</g>`;
  }).join('')}${physicsDebug?`<g data-physics-debug="" pointer-events="none">${physicsOverlay(frame)}</g>`:''}${camera?'</g>':''}</svg>`;
}
export function mountSVG(element, document, frame, options) {
  element.innerHTML = renderSVG(document, frame, options);
  let previous;
  const attribute=(node,key,value)=>{if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);};
  const bindings = document.actors.map(actor => {
    const root = element.querySelector(`[data-actor="${actor.id}"]`);
    return { actor, root, joints: [...root.querySelectorAll('[data-joint], [data-bone]')], paths: document.packs[actor.pack].parts.map(part => ({ part, node:root.querySelector(`[data-part="${part.id}"]`) })), limits:[...root.querySelectorAll('[data-limit]')] };
  });
  return {
    update(next) {
      if(next===previous)return;previous=next;
      if(next.camera){const node=element.querySelector('[data-camera]');if(node)attribute(node,'transform',cameraTransform(next.camera,document.bounds));}
      for (const b of bindings) {
        const evaluated = next.actors.find(a => a.id === b.actor.id);
        if(evaluated.placement)attribute(b.root,'transform',placement(evaluated.placement));
        attribute(b.root,'data-recovery',evaluated.recovery?.phase||'none');attribute(b.root,'data-response',evaluated.response||'calm');attribute(b.root,'data-emotion',evaluated.inputs?.emotion||'neutral');attribute(b.root,'data-motion-mode',evaluated.physics?.mode||'animated');
        for (const node of b.joints) attribute(node,'transform', transform(evaluated.world[node.dataset.joint || node.dataset.bone]));
        const inputKey=JSON.stringify(evaluated.inputs);
        if(inputKey!==b.inputKey){b.inputKey=inputKey;for (const {part,node} of b.paths) if (part.variants || part.showWhen) { const paint=appearance(part,b.actor,evaluated);attribute(node,'d',paint.d);attribute(node,'transform',paint.transform);attribute(node,'visibility',paint.visible?'visible':'hidden'); }}
        for (const node of b.limits) { const j=document.packs[b.actor.pack].joints.find(j=>j.id===node.dataset.limit);node.setAttribute('d',limitArc(j,evaluated.pose[j.id+'.rotation'])); }
      }
      const overlay=element.querySelector('[data-physics-debug]');if(overlay)overlay.innerHTML=physicsOverlay(next);
    },
    dispose() { element.replaceChildren(); }
  };
}
