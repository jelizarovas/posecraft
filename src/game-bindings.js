import {objectGrip} from './scene-objects.js';
import {evaluatedProps} from './scene-attachments.js';
import {nodeVisible} from './scene-graph.js';

const reserved=new Set(['__proto__','prototype','constructor']);
const name=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(v)&&!reserved.has(v);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fields=(v,keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k)&&!reserved.has(k));
const finite=(v,min=-10000,max=10000)=>Number.isFinite(v)&&v>=min&&v<=max;
const own=(v,key)=>record(v)&&Object.hasOwn(v,key);
const actors=doc=>Array.isArray(doc?.actors)?doc.actors:[];
const actorPack=(doc,id)=>{const actor=actors(doc).find(a=>a?.id===id);return actor&&own(doc.packs,actor.pack)?doc.packs[actor.pack]:null;};

function validateTarget(doc,target,path,check){
 const type=target?.type,keys={point:['type','x','y'],joint:['type','actor','joint','offsetX','offsetY'],prop:['type','prop','offsetX','offsetY'],object:['type','object','offsetX','offsetY']};
 check(own(keys,type)&&fields(target,keys[type]),path,'Expected a point, joint, prop or shared-object target.');if(!record(target)||!own(keys,type))return;
 if(type==='point'){check(finite(target.x)&&finite(target.y),path,'Coordinates must be finite within -10000..10000.');return;}
 for(const key of ['offsetX','offsetY'])if(target[key]!==undefined)check(finite(target[key],-1000,1000),path+'.'+key,'Local offsets must be -1000..1000.');
 if(type==='joint')check(actorPack(doc,target.actor)?.joints?.some(j=>j.id===target.joint),path,'Missing target actor or joint.');
 else check(Array.isArray(doc[type+'s'])&&doc[type+'s'].some(node=>node?.id===target[type]),path,'Missing target '+type+'.');
}

/** Validate saved game-facing names without creating runtime state. */
export function validateGameBindings(document,check){
 const game=document.game;if(game===undefined)return;
 check(fields(game,['anchors','actors']),'game','Expected plain game anchors and actor mappings.');if(!record(game))return;
 const mapping=(value,path,limit)=>{check(record(value)&&Object.keys(value).length<=limit,path,`Expected a plain mapping with at most ${limit} entries.`);if(!record(value))return [];for(const key of Object.keys(value))check(name(key),path+'.'+key,'Use a nonreserved semantic name, up to 80 characters.');return Object.entries(value).slice(0,limit);};
 for(const [key,target]of mapping(game.anchors===undefined?{}:game.anchors,'game.anchors',128))validateTarget(document,target,'game.anchors.'+key,check);
 for(const [id,binding]of mapping(game.actors===undefined?{}:game.actors,'game.actors',24)){
  const path='game.actors.'+id,pack=actorPack(document,id);
  check(!!pack,path,'Missing bound actor.');check(fields(binding,['actions','reactions','gaze','speech']),path,'Unknown actor binding setting.');if(!record(binding))continue;
  const actions=new Set(Object.keys(pack?.clips??{}));
  for(const [action,clip]of mapping(binding.actions===undefined?{}:binding.actions,path+'.actions',128)){check(typeof clip==='string'&&own(pack?.clips,clip),path+'.actions.'+action,'Missing action clip.');actions.add(action);}
  for(const [reaction,value]of mapping(binding.reactions===undefined?{}:binding.reactions,path+'.reactions',128)){
   const p=path+'.reactions.'+reaction;check(fields(value,['action','emotion'])&&(value.action!==undefined||value.emotion!==undefined),p,'A reaction needs an action, an emotion, or both.');if(!record(value))continue;
   if(value.action!==undefined)check(typeof value.action==='string'&&actions.has(value.action),p+'.action','Missing semantic action.');
   if(value.emotion!==undefined)check(typeof value.emotion==='string'&&pack?.inputs?.emotion?.options?.includes(value.emotion),p+'.emotion','Emotion must be supported by the actor input.');
  }
  if(binding.gaze!==undefined){const gaze=binding.gaze;check(fields(gaze,['joint','maxAngle'])&&pack?.joints?.some(j=>j.id===gaze.joint),path+'.gaze','Gaze needs an existing joint.');if(record(gaze)&&gaze.maxAngle!==undefined)check(finite(gaze.maxAngle,0,180),path+'.gaze.maxAngle','Maximum gaze angle must be 0..180 degrees.');}
  if(binding.speech!==undefined)check(typeof binding.speech==='boolean',path+'.speech','Expected a speech capability boolean.');
 }
 check(document.requiredFeatures?.includes('game-bindings'),'requiredFeatures','Declare game-bindings.');
}

/** Fresh values: editing this result cannot change the saved scene. */
export function gameActorBindings(document,id){
 const pack=actorPack(document,id);if(!pack)return null;
 const saved=own(document.game?.actors,id)?document.game.actors[id]:{};
 const actions=Object.fromEntries(Object.keys(pack.clips).map(clip=>[clip,clip]));
 for(const [alias,clip]of Object.entries(saved.actions??{}))if(name(alias)&&own(pack.clips,clip))Object.defineProperty(actions,alias,{value:clip,writable:true,enumerable:true,configurable:true});
 return {actions,reactions:structuredClone(saved.reactions??{}),...(saved.gaze?{gaze:structuredClone(saved.gaze)}:{}),speech:saved.speech===true};
}

/** Resolve scene coordinates from the evaluated frame, never camera pixels. */
export function resolveGameTarget(document,frame,targetOrName){
 const target=typeof targetOrName==='string'?(own(document.game?.anchors,targetOrName)?document.game.anchors[targetOrName]:null):targetOrName;
 let valid=true;validateTarget(document,target,'target',ok=>{if(!ok)valid=false;});if(!valid)return null;
 if(target.type==='point')return {x:target.x,y:target.y};
 if(!frame||!Array.isArray(frame.actors))return null;
 if(target.type==='joint'){const point=objectGrip(document,frame,target);return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:point.x,y:point.y}:null;}
 const node=target.type==='prop'?evaluatedProps(document,frame).find(p=>p.id===target.prop):frame.objects?.find(o=>o.id===target.object);
 if(!node||node.enabled===false||node.visible===false||!nodeVisible(document,node))return null;
 const angle=(node.rotation??0)*Math.PI/180,x=target.offsetX??0,y=target.offsetY??0;
 const result={x:node.x+x*Math.cos(angle)-y*Math.sin(angle),y:node.y+x*Math.sin(angle)+y*Math.cos(angle)};
 return Number.isFinite(result.x)&&Number.isFinite(result.y)?result:null;
}

/** Discovery describes the 2D semantic facade, not native-3D choreography. */
export function describeGameScene(document){
 const errors=[];validateGameBindings(document,(valid,path,message)=>{if(!valid)errors.push(path+': '+message);});if(errors.length)throw new Error(errors.join('\n'));
 const anchors=Object.keys(document.game?.anchors??{}).sort(),events=new Set(['actor.action.completed','actor.command.completed','actor.command.cancelled','actor.command.failed']);
 const descriptions=actors(document).map(actor=>{
  const binding=gameActorBindings(document,actor.id),pack=actorPack(document,actor.id);if(!binding)throw new Error('Missing actor pack: '+actor.id);
  const reactions=Object.keys(binding.reactions).sort(),locomotion=pack.physics?'ground-x':'none';
  if(reactions.length)events.add('actor.reaction.completed');if(locomotion==='ground-x')events.add('actor.arrived');
  if(binding.gaze)events.add('actor.look.completed');if(binding.speech){events.add('actor.speech.requested');events.add('actor.speech.completed');}
  return {id:actor.id,name:actor.name,actions:Object.keys(binding.actions).sort(),reactions,canSpeak:binding.speech,canLook:!!binding.gaze,locomotion,anchors:anchors.slice()};
 });
 const objects=(document.objects??[]).map(object=>({id:object.id,properties:['enabled'],commands:['enable']}));if(objects.length)events.add('object.changed');
 return {schemaVersion:1,id:document.id,actors:descriptions,objects,anchors,events:[...events].sort()};
}
