import { assertDocument } from './schema.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const transform = w => `translate(${w.x} ${w.y}) rotate(${w.rotation})`;
const placement = t => `${transform(t)} scale(${t.scale})`;

export function renderSVG(document, frame, { label = document.name, bones = false } = {}) {
  assertDocument(document);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${document.bounds.width} ${document.bounds.height}" role="img" aria-label="${escape(label)}" width="100%" height="100%">${document.actors.map(actor => {
    const pack = document.packs[actor.pack], evaluated = frame.actors.find(a => a.id === actor.id);
    if (!evaluated) throw new Error(`Missing evaluated actor ${actor.id}`);
    return `<g data-actor="${actor.id}" transform="${placement(actor.transform)}">${pack.parts.map(part => `<g data-joint="${part.joint}" transform="${transform(evaluated.world[part.joint])}"><path data-part="${part.id}" d="${escape(part.d)}" fill="${escape(actor.appearance?.[part.channel] || part.fill)}" stroke="${escape(part.stroke || 'none')}" stroke-width="${part.strokeWidth || 0}" stroke-linejoin="round" transform="${escape(part.transform || '')}"/></g>`).join('')}${bones ? pack.joints.map(j => `<g data-bone="${j.id}" transform="${transform(evaluated.world[j.id])}"><circle r="2" fill="#6d4aff" stroke="#fff" stroke-width=".7"/><path d="M0 0H${j.length}" stroke="#6d4aff" stroke-width="1"/></g>`).join('') : ''}</g>`;
  }).join('')}</svg>`;
}

export function mountSVG(element, document, frame, options) {
  element.innerHTML = renderSVG(document, frame, options);
  const bindings = document.actors.map(actor => {
    const root = element.querySelector(`[data-actor="${actor.id}"]`);
    return { actor, root, parts: [...root.querySelectorAll('[data-joint], [data-bone]')] };
  });
  return {
    update(next) {
      for (const b of bindings) {
        const evaluated = next.actors.find(a => a.id === b.actor.id);
        for (const node of b.parts) node.setAttribute('transform', transform(evaluated.world[node.dataset.joint || node.dataset.bone]));
      }
    },
    dispose() { element.replaceChildren(); }
  };
}
