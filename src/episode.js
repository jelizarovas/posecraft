import {poseDefaults,spatialChannels} from './spatial.js';
import {assertDocument} from './schema.js';
import {sampleClip,interpolate,constrainPose,forwardKinematics} from './index.js';
export const episodeCapabilities=Object.freeze({schemaVersion:1,kind:'episode',features:['reusable-scenes','ordered-shots','keyed-camera','actor-placement','pose-keys','seeded-motion','rotation-baking','local-reference-frames','expression-keys','performance-takes'],unavailable:['automatic-asset-extraction','motion-fitting','dialogue-tracks','movie-encoding','physics-baking']});
const id=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const validId=value=>typeof value==='string'&&id.test(value);
const finite=(n,min=-10000,max=10000)=>Number.isFinite(n)&&n>=min&&n<=max;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function require(condition,message){if(!condition)throw new Error(message);}
export function episodeDuration(project){return project.shots.reduce((sum,s)=>sum+s.duration,0);}
export function assertEpisode(project){
 require(object(project)&&project.schemaVersion===1&&project.kind==='episode','Expected a version 1 episode.');
 let count=0;function walk(v,depth=0){require(++count<=750000&&depth<=28,'Episode exceeds resource limits.');if(v&&typeof v==='object')for(const [k,child] of Object.entries(v)){require(!['__proto__','prototype','constructor'].includes(k),'Reserved key.');walk(child,depth+1);}else require(v===null||['string','number','boolean'].includes(typeof v)&&!(typeof v==='number'&&!Number.isFinite(v)),'Expected finite JSON data.');}walk(project);
 require(JSON.stringify(project).length<=20000000,'Episode exceeds 20 MB.');
 require(validId(project.id)&&typeof project.name==='string'&&project.name.length<=100&&Number.isSafeInteger(project.revision)&&project.revision>=0,'Invalid episode identity.');
 require([12,24,25,30,60].includes(project.fps)&&object(project.size)&&finite(project.size.width,64,4096)&&finite(project.size.height,64,4096),'Invalid frame rate or output size.');
 require(object(project.scenes)&&Object.keys(project.scenes).length>0&&Object.keys(project.scenes).length<=32,'Expected 1..32 scenes.');
 for(const [key,scene] of Object.entries(project.scenes)){require(id.test(key),'Invalid scene ID.');assertDocument(scene);}
 require(Array.isArray(project.shots)&&project.shots.length>0&&project.shots.length<=120,'Expected 1..120 shots.');
 const shots=new Set();
 for(const shot of project.shots){
  require(object(shot)&&validId(shot.id)&&!shots.has(shot.id)&&typeof shot.name==='string'&&shot.name.length<=100,'Invalid or duplicate shot.');shots.add(shot.id);
  require(Object.hasOwn(project.scenes,shot.scene)&&finite(shot.duration,1/project.fps,600),'Invalid shot scene or duration.');
  function track(keys,min,max){require(Array.isArray(keys)&&keys.length>0&&keys.length<=2000&&keys.every((k,i)=>Array.isArray(k)&&k.length>=2&&k.length<=3&&finite(k[0],0,shot.duration)&&finite(k[1],min,max)&&(!i||k[0]>keys[i-1][0])&&(k[2]===undefined||['smooth','linear','step'].includes(k[2]))),'Invalid shot keyframes.');}
  require(object(shot.camera),'Expected a keyed camera.');
  require(Object.keys(shot.camera).every(k=>['x','y','zoom','rotation'].includes(k)),'Unknown camera channel.');
  for(const [key,min,max] of [['x',-10000,10000],['y',-10000,10000],['zoom',.1,10],['rotation',-180,180]])track(shot.camera[key],min,max);
  require(shot.actors===undefined||object(shot.actors),'Expected shot actor cues.');
  const scene=project.scenes[shot.scene];
  for(const [actorId,cue] of Object.entries(shot.actors||{})){
   const actor=scene.actors.find(a=>a.id===actorId),pack=scene.packs[actor?.pack];require(actor&&object(cue)&&Object.hasOwn(pack.clips,cue.clip)&&finite(cue.offset,0,600)&&finite(cue.speed,0,4),'Invalid actor clip cue.');
   if(cue.emotion!==undefined)require(pack.inputs.emotion?.options.includes(cue.emotion),'Unknown expression.');
   if(cue.expressions!==undefined)require(Array.isArray(cue.expressions)&&cue.expressions.length>0&&cue.expressions.length<=2000&&cue.expressions.every((k,i)=>Array.isArray(k)&&k.length===2&&finite(k[0],0,shot.duration)&&(!i||k[0]>cue.expressions[i-1][0])&&pack.inputs.emotion?.options.includes(k[1])),'Invalid expression keys.');
   if(cue.placement)for(const [key,keys] of Object.entries(cue.placement)){require(['x','y','scale','rotation'].includes(key),'Unknown placement channel.');track(keys,key==='scale'?.05:key==='rotation'?-180:-10000,key==='scale'?10:key==='rotation'?180:10000);}
   if(cue.pose)for(const [channel,keys] of Object.entries(cue.pose)){const [id,property]=channel.split('.'),joint=pack.joints.find(j=>j.id===id),range=pack.spatial&&spatialChannels[property];require(joint&&(property==='rotation'||range),'Unknown pose channel.');track(keys,range?.min??joint.min,range?.max??joint.max);}
   if(cue.motion){const m=cue.motion;require(object(m)&&['sway','noise'].includes(m.kind)&&pack.joints.some(j=>j.id===m.joint)&&['rotation','x','y'].includes(m.channel)&&finite(m.amplitude,0,180)&&finite(m.frequency,.01,10)&&Number.isSafeInteger(m.seed)&&m.seed>=0&&m.seed<=2147483647,'Invalid procedural motion.');}
  }
  if(shot.reference)require(object(shot.reference)&&validId(shot.reference.id)&&typeof shot.reference.name==='string'&&shot.reference.name.length<=200&&finite(shot.reference.time,0,86400),'Invalid reference metadata.');
 }
 require(episodeDuration(project)<=7200,'Episode exceeds two hours.');return project;
}
export function shotAt(project,time){
 require(finite(time,0,episodeDuration(project)),'Time is outside the episode.');let start=0;
 for(let i=0;i<project.shots.length;i++){const shot=project.shots[i];if(time<start+shot.duration||i===project.shots.length-1)return {shot,index:i,start,time:Math.min(time-start,shot.duration)};start+=shot.duration;}
}
const hash=(seed,n)=>{let x=(seed^Math.imul(n,374761393))|0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967295*2-1;};
export function motionValue(m,time){const t=time*m.frequency;if(m.kind==='sway')return Math.sin(t*Math.PI*2+hash(m.seed,0)*Math.PI)*m.amplitude;const n=Math.floor(t),f=t-n,s=f*f*(3-2*f);return (hash(m.seed,n)*(1-s)+hash(m.seed,n+1)*s)*m.amplitude;}
export class EpisodeController {
 constructor(project){this.project=structuredClone(assertEpisode(project));this.defaults=new Map();for(const [id,scene] of Object.entries(project.scenes))for(const [key,pack] of Object.entries(scene.packs))this.defaults.set(id+':'+key,poseDefaults(pack));}
 frame(time){
  const located=shotAt(this.project,time),{shot}=located,scene=this.project.scenes[shot.scene],local=located.time;
  const camera={...this.project.size,...Object.fromEntries(Object.entries(shot.camera).map(([key,track])=>[key,interpolate(track,local)]))};
  const actors=scene.actors.map(actor=>{
   const pack=scene.packs[actor.pack],cue=shot.actors?.[actor.id],clip=cue?.clip||pack.states[pack.initial].clip;
   let pose={...this.defaults.get(shot.scene+':'+actor.pack),...sampleClip(pack.clips[clip],local*(cue?.speed??1)+(cue?.offset??0))};
   const inputs={...Object.fromEntries(Object.entries(pack.inputs).map(([k,v])=>[k,v.default])),...actor.inputs};if(pack.inputs.action?.options.includes(clip))inputs.action=clip;if(cue?.emotion)inputs.emotion=cue.emotion;
   for(const key of cue?.expressions||[])if(key[0]<=local)inputs.emotion=key[1];else break;
   for(const [key,value] of Object.entries(pack.expressions?.[inputs.emotion]||{}))pose[key]+=value;
   for(const [key,keys] of Object.entries(cue?.pose||{}))pose[key]=interpolate(keys,local);
   if(cue?.motion){const m=cue.motion;pose[m.joint+'.'+m.channel]+=motionValue(m,local);}
   pose=constrainPose(pack.joints,pose);
   const placement={...actor.transform,...Object.fromEntries(Object.entries(cue?.placement||{}).map(([key,keys])=>[key,interpolate(keys,local)]))};
   return {id:actor.id,pose,world:forwardKinematics(pack.joints,pose),inputs,placement,state:clip,response:'calm',physics:null,spring:{x:0,y:0,vx:0,vy:0}};
  });
  return {time,shot:shot.id,scene:shot.scene,localTime:local,shotIndex:located.index,camera,actors};
 }
 bakeMotion(shotId,actorId){
  const shot=this.project.shots.find(s=>s.id===shotId),cue=shot?.actors?.[actorId];require(cue?.motion,'Select a procedural motion to bake.');
  const motion=cue.motion,channel=motion.joint+'.'+motion.channel;require(motion.channel==='rotation','Baking currently supports joint rotation.');
  require(shot.duration*this.project.fps<=1999,'Bake a shorter shot; at most 2000 keys per track.');
  const keys=[];
  // Sample the selected shot directly at its endpoint, without cutting to the next shot.
  const isolated=new EpisodeController({...this.project,shots:[shot]});
  for(let frame=0;frame<=Math.ceil(shot.duration*this.project.fps);frame++){const t=Math.min(frame/this.project.fps,shot.duration);if(keys.length&&Math.abs(keys.at(-1)[0]-t)<1e-9)continue;keys.push([t,isolated.frame(t).actors.find(a=>a.id===actorId).pose[channel],'linear']);}
  return keys;
 }
}
