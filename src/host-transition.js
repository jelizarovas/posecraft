import {sampleClip,constrainPose,forwardKinematics,mixAngle} from './index.js';
import {morphPath,blendMorphPaths} from './spatial.js';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function validateHostTransition(document,check){
 const config=document.hostTransition;if(config===undefined)return;
 check(object(config)&&Object.keys(config).every(key=>key==='actors'),'hostTransition','Expected host-transition actor bindings.');
 if(!object(config))return;
 check(Array.isArray(config.actors)&&config.actors.length>0&&config.actors.length<=32,'hostTransition.actors','Expected 1..32 actor bindings.');
 const seen=new Set();
 for(const [i,binding]of (Array.isArray(config.actors)?config.actors:[]).entries()){
  const at=`hostTransition.actors.${i}`;
  check(object(binding),at,'Expected actor and directional depart/arrive clips.');if(!object(binding))continue;
  const actor=document.actors?.find(actor=>actor.id===binding.actor),pack=document.packs?.[actor?.pack];
  check(Object.keys(binding).every(key=>['actor','depart','arrive'].includes(key))&&!!pack&&!seen.has(binding.actor),at,'Expected a unique existing actor.');seen.add(binding.actor);
  for(const phase of ['depart','arrive']){
   const clips=binding[phase];check(object(clips)&&Object.keys(clips).every(key=>['left','right'].includes(key)),at+'.'+phase,'Expected left and right clip references.');
   for(const direction of ['left','right'])check(typeof clips?.[direction]==='string'&&!!pack?.clips?.[clips[direction]],at+'.'+phase+'.'+direction,'Expected an existing actor clip.');
  }
 }
}
export function assertHostTransitionSample(value){
 if(!object(value)||Object.keys(value).some(key=>!['phase','direction','progress'].includes(key))||!['depart','arrive'].includes(value.phase)||![-1,1].includes(value.direction)||!Number.isFinite(value.progress)||value.progress<0||value.progress>1)throw Error('Host transition requires depart/arrive, direction -1 or 1, and progress 0..1.');
 return {phase:value.phase,direction:value.direction,progress:value.progress};
}
const smooth=t=>t*t*(3-2*t);
export function hostTransitionWeight(progress){return progress<=0||progress>=1?0:progress<.18?smooth(progress/.18):progress>.78?1-smooth((progress-.78)/.22):1;}

/** Sparse absolute clips overlay the running behavior pose. Host progress is
 * explicit, so a paused outgoing page can still brace while it is translated. */
export class HostTransitionLayer {
 constructor(document){
  this.sample=null;
  this.actors=new Map((document.hostTransition?.actors||[]).map(binding=>{
   const actor=document.actors.find(a=>a.id===binding.actor),pack=document.packs[actor.pack],clips={};
   for(const phase of ['depart','arrive'])for(const side of ['left','right']){
    const clip={...pack.clips[binding[phase][side]],loop:false},keys=Object.keys(clip.tracks),keySet=new Set(keys);
    const morphs=pack.parts.filter(part=>part.spatial?.morph).map(part=>{const morph=part.spatial.morph,channels=[morph,...(morph.layers||[])].map(layer=>layer.channel);return {part,channels,affected:channels.some(channel=>keySet.has(channel)),values:null,path:null};});
    clips[phase+'-'+side]={clip,keys,morphs,hasMorphs:morphs.some(m=>m.affected),progress:null,target:null};
   }
   return [binding.actor,{pack,clips}];
  }));
 }
 set(value){this.sample=assertHostTransitionSample(value);}
 clear(){this.sample=null;}
 apply(frame,{reducedMotion=false}={}){
  const sample=this.sample;if(!sample||reducedMotion)return frame;
  const weight=hostTransitionWeight(sample.progress);if(!weight||!this.actors.size)return frame;
  return {...frame,actors:frame.actors.map(actor=>{
   const entry=this.actors.get(actor.id);if(!entry)return actor;
   const {pack}=entry,compiled=entry.clips[sample.phase+'-'+(sample.direction===-1?'left':'right')];
   if(compiled.progress!==sample.progress){compiled.progress=sample.progress;compiled.target=sampleClip(compiled.clip,sample.progress*compiled.clip.duration);}
   const target=compiled.target,pose={...actor.pose};
   for(const key in target){const from=pose[key]??0,value=target[key];pose[key]=key.endsWith('.rotation')||key.endsWith('.yaw')?mixAngle(from,value,weight):from+(value-from)*weight;}
   const constrained=constrainPose(pack.joints,pose);
   let shapeBlend=actor.shapeBlend;
   // Preserve the displayed contour of interrupted actions. Blending morph
   // scalar positions alone can traverse unrelated intermediate elbow shapes.
   if(compiled.hasMorphs){
    const fromPaths={};
    const destination={...actor.pose,...target};
    for(const item of compiled.morphs){
     const {part,affected,channels}=item,morph=part.spatial.morph,previous=actor.shapeBlend;
     // Unchanged contours can keep the renderer's ordinary path cache. Only
     // preserve an explicit path when an earlier action is already blending it.
     if(!affected&&!previous?.fromPaths[part.id])continue;
     if(affected){
      if(!item.values||channels.some((channel,i)=>item.values[i]!==destination[channel])){
       item.values=channels.map(channel=>destination[channel]);item.path=morphPath(part,destination[morph.channel],destination);
      }
      if(weight===1){fromPaths[part.id]=item.path;continue;}
     }
     const base=previous?.fromPaths[part.id]?blendMorphPaths(previous.fromPaths[part.id],morphPath(part,previous.to[morph.channel],previous.to),previous.weight):morphPath(part,actor.pose[morph.channel],actor.pose);
     fromPaths[part.id]=affected?blendMorphPaths(base,item.path,weight):base;
    }
    shapeBlend={fromPaths,to:constrained,weight:0};
   }
   return {...actor,pose:constrained,world:forwardKinematics(pack.joints,constrained),...(shapeBlend?{shapeBlend}:{})};
  })};
 }
}
