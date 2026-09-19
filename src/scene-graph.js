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
 const field={actor:'actors',prop:'props',emitter:'emitters',object:'objects'}[kind];if(!field)throw new Error('Unknown scene item.');
 const next=structuredClone(document);if(!next[field]?.some(n=>n.id===id))throw new Error('Missing scene item.');next[field]=next[field].filter(n=>n.id!==id);
 if(next.game){
  if(kind==='actor'&&next.game.actors)delete next.game.actors[id];
  if(next.game.anchors)next.game.anchors=Object.fromEntries(Object.entries(next.game.anchors).filter(([,target])=>!(kind==='actor'&&target.type==='joint'&&target.actor===id)&&!(kind==='prop'&&target.type==='prop'&&target.prop===id)&&!(kind==='object'&&target.type==='object'&&target.object===id)));
 }
 if(kind==='prop'&&next.contacts)next.contacts=next.contacts.filter(c=>c.target.type!=='prop'||c.target.prop!==id);
 if(kind==='object'){
  if(next.contacts)next.contacts=next.contacts.filter(c=>c.target.type!=='object'||c.target.object!==id);
  if(next.objectGames)next.objectGames=next.objectGames.filter(game=>game.object!==id);
  for(const prop of next.props||[])if(prop.attachment?.type==='object'&&prop.attachment.object===id)delete prop.attachment;
 }
 if(kind==='actor'){
  for(const p of next.props||[])if(p.attachment?.type==='joint'&&p.attachment.actor===id)delete p.attachment;
  if(next.motionLayers)next.motionLayers=next.motionLayers.filter(l=>l.actor!==id);
  if(next.scroll){if(next.scroll.clips)next.scroll.clips=next.scroll.clips.filter(c=>c.actor!==id);if(next.scroll.bindings)next.scroll.bindings=next.scroll.bindings.filter(b=>b.target.actor!==id);}
  if(next.actorBehaviors)next.actorBehaviors=next.actorBehaviors.filter(g=>g.actor!==id);
  if(next.objectGames)next.objectGames=next.objectGames.filter(g=>!g.participants.some(p=>p.actor===id));
  for(const object of next.objects||[])if(object.owner?.actor===id)delete object.owner;
  if(next.fluid&&(next.fluid.vessel===id||next.fluid.contents===id)){delete next.fluid;if(next.requiredFeatures)next.requiredFeatures=next.requiredFeatures.filter(feature=>feature!=='bottle-fluid');}
  if(next.poseBindings)next.poseBindings=next.poseBindings.filter(b=>b.actor!==id);
  if(next.interactions)next.interactions=next.interactions.filter(b=>b.actor!==id);
  if(next.contacts)next.contacts=next.contacts.filter(c=>c.actor!==id&&!(c.target.type==='joint'&&c.target.actor===id));
  if(next.emitters)next.emitters=next.emitters.filter(e=>e.actor!==id);
  if(next.ensemble&&(next.ensemble.sky===id||next.ensemble.members.includes(id))){delete next.ensemble;if(next.actorBehaviors)next.actorBehaviors=next.actorBehaviors.filter(s=>![...(s.sensors||[]),...(s.outputs||[])].some(b=>b.source.startsWith('campfire.')));}
 }
 for(const graph of [next.behaviorGraph,...(next.actorBehaviors||[]).map(s=>s.graph)].filter(Boolean)){
  if(kind==='actor'&&graph.activities)for(const [key,activity]of Object.entries(graph.activities))if(activity.actor===id)delete graph.activities[key];
  const keep=action=>!(action.type==='object'&&(kind==='actor'&&(action.command.actor===id||action.command.from===id)||kind==='object'&&action.command.object===id))&&!(action.type==='perform'&&!graph.activities?.[action.activity])&&!(action.actor&&action.actor!=='$actor'&&!next.actors.some(a=>a.id===action.actor))&&!(action.type==='emitter'&&!next.emitters?.some(e=>e.id===action.emitter))&&!(action.type==='ensemble'&&!next.ensemble)&&!(action.type==='input'&&action.actor==='$actor'&&!next.actors.some(a=>validBehaviorInput(next,a.id,action.input,action.value)));
  for(const state of Object.values(graph.states))state.actions=state.actions.filter(keep);
  for(const handler of graph.handlers||[])handler.actions=handler.actions.filter(keep);
  for(const activity of Object.values(graph.activities||{})){for(const key of ['onStart','onSuccess','onFailure'])activity[key]=(activity[key]||[]).filter(keep);for(const variant of [...activity.variants,...activity.failureVariants||[]])if(variant.onSuccess)variant.onSuccess=variant.onSuccess.filter(keep);}
 }
 if(next.lighting?.emitter&&!next.emitters?.some(e=>e.id===next.lighting.emitter)){delete next.lighting.emitter;next.lighting.enabled=false;}
 return next;
}
