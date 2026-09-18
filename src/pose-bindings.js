import {forwardKinematics} from './index.js';
import {spatialKinematics} from './spatial.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validatePoseBindings(document,check){
 if(document.poseBindings===undefined)return;
 const bindings=document.poseBindings,variables=document.behaviorGraph?.variables,seen=new Set();
 check(Array.isArray(bindings)&&bindings.length<=32,'poseBindings','Expected at most 32 position bindings.');
 for(const [i,binding]of (Array.isArray(bindings)?bindings:[]).entries()){
  const p='poseBindings.'+i;check(object(binding),p,'Expected a position binding.');if(!object(binding))continue;
  const actor=document.actors.find(a=>a.id===binding.actor),pack=document.packs[actor?.pack],joint=pack?.joints.find(j=>j.id===binding.joint),key=binding.actor+'/'+binding.joint;
  check(Object.keys(binding).every(k=>['actor','joint','space','x','y','excludeClips'].includes(k))&&!!actor&&!!joint?.parent&&binding.space==='world'&&!seen.has(key),p,'Expected a unique actor/non-root joint and world coordinate space.');seen.add(key);
  for(const axis of ['x','y']){const source=binding[axis];check(object(source)&&Object.keys(source).length===1&&typeof source.variable==='string'&&Object.hasOwn(variables||{},source.variable)&&typeof variables[source.variable]==='number',p+'.'+axis,'Expected an existing numeric graph variable.');}
  if(binding.excludeClips!==undefined)check(Array.isArray(binding.excludeClips)&&binding.excludeClips.length<=64&&new Set(binding.excludeClips).size===binding.excludeClips.length&&binding.excludeClips.every(id=>typeof id==='string'&&Object.hasOwn(pack?.clips||{},id)),p+'.excludeClips','Expected at most 64 unique actor clip names.');
 }
}

/** Positions are absolute within the actor pack, before Actor.transform.
 * Parent transforms are inverted; edge-on or out-of-range solves retain the
 * authored pose. Preview, physics and explicitly excluded clips are untouched. */
export class PoseBindings {
 constructor(document){
  this.actors=new Map();
  for(const actor of document.actors){const pack=document.packs[actor.pack],bindings=(document.poseBindings||[]).filter(b=>b.actor===actor.id);if(!bindings.length)continue;
   const joints=new Map(pack.joints.map(j=>[j.id,j])),depth=id=>{let n=0;while(joints.get(id)?.parent&&n<pack.joints.length){id=joints.get(id).parent;n++;}return n;};
   this.actors.set(actor.id,{pack,bindings:bindings.map(b=>({...b,joint:joints.get(b.joint),exclude:new Set(b.excludeClips||[])})).sort((a,b)=>depth(a.joint.id)-depth(b.joint.id))});
  }
 }
 apply(frame,variables,{disabledActors=new Set()}={}){
  if(!this.actors.size)return frame;let changed=false;
  const actors=frame.actors.map(actor=>{
   const compiled=this.actors.get(actor.id);if(!compiled||disabledActors.has(actor.id)||actor.physics||actor.recovery)return actor;
   let pose=actor.pose,altered=false;
   for(const binding of compiled.bindings){if(binding.exclude.has(actor.clip))continue;
    const x=variables[binding.x.variable],y=variables[binding.y.variable];if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const world=compiled.pack.spatial?spatialKinematics(compiled.pack,pose):forwardKinematics(compiled.pack.joints,pose),parent=world[binding.joint.parent];if(!parent)continue;
    const r=(parent.rotation||0)*Math.PI/180,m=parent.m||[Math.cos(r),-Math.sin(r),0,Math.sin(r),Math.cos(r),0,0,0,1],det=m[0]*m[4]-m[1]*m[3];if(Math.abs(det)<1e-6)continue;
    const dx=x-parent.x,dy=y-parent.y,nx=(dx*m[4]-dy*m[1])/det-binding.joint.x,ny=(dy*m[0]-dx*m[3])/det-binding.joint.y;
    if(!Number.isFinite(nx)||!Number.isFinite(ny)||Math.abs(nx)>4096||Math.abs(ny)>4096)continue;
    if(!altered)pose={...pose};pose[binding.joint.id+'.x']=nx;pose[binding.joint.id+'.y']=ny;altered=true;
   }
   if(!altered)return actor;changed=true;return {...actor,pose,world:forwardKinematics(compiled.pack.joints,pose)};
  });return changed?{...frame,actors}:frame;
 }
}
