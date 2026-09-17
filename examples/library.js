import ona from './characters/ona.json';
import wwwzard from './characters/wwwzard.json';
import rusty from './characters/rusty.json';
import dummy from './characters/dummy.json';
export const library = { ona, wwwzard, rusty, dummy };
export const starter = structuredClone(ona);
export function upgradeLibraryDocument(document){
 const next=structuredClone(document);let changed=false;
 for(const [id,p] of Object.entries(next.packs||{})){
  const fresh=library[id]?.packs[id];if(!fresh||p.physics||p.provenance?.source!==fresh.provenance.source)continue;
  if(!fresh.joints.every(j=>p.joints.some(old=>old.id===j.id&&old.parent===j.parent)))continue;
  p.physics=structuredClone(fresh.physics);
  for(const pose of Object.values(p.physics.responses))for(const key of Object.keys(pose)){const j=p.joints.find(j=>key===j.id+'.rotation');pose[key]=Math.max(j.min,Math.min(j.max,pose[key]));}
  p.expressions={...fresh.expressions,...p.expressions};
  p.inputs.emotion.options=[...new Set([...p.inputs.emotion.options,...fresh.inputs.emotion.options])];
  for(const part of fresh.parts){const old=p.parts.find(v=>v.id===part.id);if(!old)p.parts.push(structuredClone(part));else if(part.variants)old.variants={...structuredClone(part.variants),...old.variants};}
  changed=true;
 }
 if(changed){next.requiredFeatures=[...new Set([...(next.requiredFeatures||[]),'rigid-body-physics','response-states'])];next.revision++;}
 return {document:next,changed};
}
