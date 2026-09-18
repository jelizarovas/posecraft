import {sampleClip,constrainPose,forwardKinematics} from './index.js';
import {poseDefaults,spatialChannels} from './spatial.js';
import {applyContacts} from './contacts.js';
import {objectGrip} from './scene-objects.js';
import {nodeVisible} from './scene-graph.js';

export const ANIMATION_PREVIEW_LIMITS=Object.freeze({ghostsPerSide:3,pathPoints:61});
const finiteTime=t=>Number.isFinite(t)&&Math.abs(t)<=1000000;
/** Capture an authored preview without owning or advancing a controller.
 * Other actors, free objects, ownership, inputs and procedural effects stay at
 * the supplied stage snapshot. Only the selected clip and its contacts change.
 * Physics, springs, graph actions, events and live motion layers are not replayed.
 * Recreate this sampler after an edit or stage change; its inputs are copied.
 */
export function createAnimationPreview(document,baseFrame,{actor:actorId,clip:clipId,overrides={},boundary='clamp'}={}){
 if(!['clamp','wrap'].includes(boundary))throw Error('Preview boundary must be clamp or wrap.');
 const sourceActor=document.actors.find(a=>a.id===actorId),sourcePack=document.packs[sourceActor?.pack],sourceClip=sourcePack?.clips[clipId],sourceFrame=baseFrame?.actors?.find(a=>a.id===actorId);
 if(!sourceActor||!sourceClip||!sourceFrame||!Number.isFinite(sourceClip.duration)||sourceClip.duration<=0)throw Error('Preview needs an existing actor, clip and evaluated actor frame.');
 // Sampling uses joint transforms, not artwork or unrelated clip libraries.
 // Keep a private snapshot of that data so edits cannot change an existing guide.
 const selectedContacts=(document.contacts||[]).filter(c=>c.actor===actorId&&(!c.clip||c.clip===clipId));
 const doc=structuredClone({actors:document.actors,groups:document.groups,props:document.props,objects:document.objects,contacts:selectedContacts,packs:Object.fromEntries(Object.entries(document.packs).map(([id,p])=>[id,{joints:p.joints,spatial:p.spatial,...(id===sourceActor.pack?{clips:{[clipId]:sourceClip},expressions:p.expressions}:{})}]))}),captured=structuredClone({...baseFrame,contacts:undefined}),actor=doc.actors.find(a=>a.id===actorId),pack=doc.packs[actor.pack],clip=pack.clips[clipId],defaults=poseDefaults(pack),changes={...overrides},duration=clip.duration,visible=nodeVisible(doc,actor),contactDocument=doc;
 for(const [key,value]of Object.entries(changes)){const range=spatialChannels[key.split('.')[1]];if(!Object.hasOwn(defaults,key)||!Number.isFinite(value)||range&&(value<range.min||value>range.max))throw Error('Invalid pose override.');}
 const normalize=time=>{if(!finiteTime(time))throw Error('Preview time must be finite and within +/-1000000 seconds.');return boundary==='wrap'?((time%duration)+duration)%duration:Math.max(0,Math.min(duration,time));};
 const attach=frame=>{const objects=frame.objects||doc.objects;if(!objects?.length)return frame;return {...frame,objects:objects.map(object=>{const owner=object.owner||null,point=owner?objectGrip(doc,frame,owner):null;return {...object,vx:object.vx||0,vy:object.vy||0,...(point||{}),owner:owner?{...owner}:null,visible:object.visible!==false&&object.enabled!==false&&nodeVisible(doc,object)&&(!owner||!!point)};})};};
 function sampleFrame(time,copy=true){const t=normalize(time),frame=copy?structuredClone(captured):{...captured,actors:captured.actors.slice()},index=frame.actors.findIndex(a=>a.id===actorId),current=frame.actors[index];let pose={...defaults,...sampleClip({...clip,loop:false},t),...changes};
  for(const [key,value]of Object.entries(pack.expressions?.[current.inputs.emotion]||{}))if(Object.hasOwn(pose,key))pose[key]+=value;
  pose=constrainPose(pack.joints,pose);frame.time=t;frame.effectsTime=captured.effectsTime??captured.time;delete frame.localTime;delete frame.contacts;
  frame.actors[index]={...current,clip:clipId,clipTime:t,state:clipId,pose,world:forwardKinematics(pack.joints,pose),physics:null,recovery:null,spring:{x:0,y:0,vx:0,vy:0}};delete frame.actors[index].activity;
  if(frame.fluid?.actor===actorId)delete frame.fluid;
  const prepared=attach(frame),contacts=copy?contactDocument:{...contactDocument,contacts:contactDocument.contacts.filter(c=>{const local=c.period?t%c.period:t;return c.enabled&&c.weight>0&&local>=c.start-1e-8&&local<=c.end+1e-8;})},result=visible?applyContacts(contacts,prepared):prepared;return attach(result);
 }
 const sample=time=>sampleFrame(time);
 function onion(time,{step=.1,count=2}={}){const center=normalize(time);if(!Number.isFinite(step)||step<=0||step>180||!Number.isInteger(count)||count<1||count>3)throw Error('Onion preview needs a positive step up to 180 seconds and 1..3 ghosts per side.');if(!visible)return [];const result=[],seen=new Set([center]);for(const side of ['before','after'])for(let i=1;i<=count;i++){const t=normalize(time+(side==='before'?-1:1)*step*i);if([...seen].some(old=>Math.abs(old-t)<1e-9))continue;seen.add(t);result.push({time:t,side,frame:sample(t)});}return result;}
 function path(joint,{start=0,end=duration,samples=31}={}){if(!pack.joints.some(j=>j.id===joint))throw Error('Unknown preview path joint.');if(!finiteTime(start)||!finiteTime(end)||end<start||end-start>duration+1e-9||!Number.isInteger(samples)||samples<2||samples>61)throw Error('Motion paths need 2..61 points over an ordered interval no longer than the clip.');if(!visible)return [];const result=[];for(let i=0;i<samples;i++){const t=normalize(start+(end-start)*i/(samples-1)),point=objectGrip(doc,sampleFrame(t,false),{actor:actorId,joint});if(point)result.push({time:t,x:point.x,y:point.y});}return result;}
 return {actor:actorId,clip:clipId,duration,boundary,sample,onion,path};
}
