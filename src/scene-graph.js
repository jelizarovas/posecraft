import {validBehaviorInput} from './behaviors.js';
/** Scene folders organize visibility and editing; they do not change transforms. */
export function nodeVisible(document,node){
 if(!node||node.hidden)return false;
 const seen=new Set();let id=node.group;
 while(id){if(seen.has(id))return false;seen.add(id);const group=document.groups?.find(g=>g.id===id);if(!group||group.hidden)return false;id=group.parent;}
 return true;
}
export function createEmitter(type,id){
 if(!['flame','smoke','embers'].includes(type))throw new Error('Unknown emitter type.');
 return {id,name:{flame:'Flame',smoke:'Smoke',embers:'Embers'}[type],type,enabled:true,x:400,y:300,rate:type==='smoke'?1.5:type==='embers'?6:8,lifetime:type==='smoke'?5:3,speed:type==='smoke'?16:35,spread:type==='smoke'?28:32,randomness:.6,seed:17,size:type==='flame'?80:type==='smoke'?14:3,color:type==='flame'?'#ffae42':type==='smoke'?'#9da392':'#ffcd76',opacity:type==='smoke'?.18:1,maxParticles:type==='flame'?3:type==='smoke'?24:48};
}
export function removeGroup(document,id){
 const next=structuredClone(document),group=next.groups?.find(g=>g.id===id);if(!group)throw new Error('Missing folder.');
 next.groups=next.groups.filter(g=>g.id!==id);
 for(const g of next.groups)if(g.parent===id)g.parent=group.parent;
 for(const node of [...next.actors,...(next.props||[]),...(next.emitters||[])])if(node.group===id){if(group.parent)node.group=group.parent;else delete node.group;}
 return next;
}
export function removeSceneEntity(document,kind,id){
 const field={actor:'actors',prop:'props',emitter:'emitters'}[kind];if(!field)throw new Error('Unknown scene item.');
 const next=structuredClone(document);if(!next[field]?.some(n=>n.id===id))throw new Error('Missing scene item.');next[field]=next[field].filter(n=>n.id!==id);
 if(kind==='actor'){
  if(next.interactions)next.interactions=next.interactions.filter(b=>b.actor!==id);
  if(next.contacts)next.contacts=next.contacts.filter(c=>c.actor!==id&&!(c.target.type==='joint'&&c.target.actor===id));
  if(next.emitters)next.emitters=next.emitters.filter(e=>e.actor!==id);
  if(next.ensemble&&(next.ensemble.sky===id||next.ensemble.members.includes(id)))delete next.ensemble;
 }
 if(next.behaviorGraph){
  const keep=action=>!(action.actor&&action.actor!=='$actor'&&!next.actors.some(a=>a.id===action.actor))&&!(action.type==='emitter'&&!next.emitters?.some(e=>e.id===action.emitter))&&!(action.type==='ensemble'&&!next.ensemble)&&!(action.type==='input'&&action.actor==='$actor'&&!next.actors.some(a=>validBehaviorInput(next,a.id,action.input,action.value)));
  for(const state of Object.values(next.behaviorGraph.states))state.actions=state.actions.filter(keep);
  for(const handler of next.behaviorGraph.handlers||[])handler.actions=handler.actions.filter(keep);
 }
 if(next.lighting?.emitter&&!next.emitters?.some(e=>e.id===next.lighting.emitter)){delete next.lighting.emitter;next.lighting.enabled=false;}
 return next;
}
