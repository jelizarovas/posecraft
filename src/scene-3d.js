import {Matrix4,Quaternion,Vector3} from 'three';
import {assertScene3D,validateScene3D} from './scene-3d-schema.js';
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from './rig-3d.js';

export {assertScene3D,validateScene3D};

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const orientationError=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0))));

function objectFrame(object){
 const {position,rotation,scale}=object.transform,q=new Quaternion(...rotation),matrix=new Matrix4().compose(new Vector3(...position),q,new Vector3(scale,scale,scale));
 const anchors=Object.fromEntries(Object.entries(object.anchors).map(([name,anchor])=>[name,{
  position:new Vector3(...anchor.position).applyMatrix4(matrix).toArray(),
  rotation:q.clone().multiply(new Quaternion(...anchor.rotation)).normalize().toArray()
 }]));
 return {id:object.id,matrix:matrix.toArray(),anchors,geometry:structuredClone(object.geometry)};
}

function applyOverrides(base,overrides){
 if(!record(overrides)||Object.keys(overrides).some(k=>!['actorPoses','objectTransforms','camera'].includes(k)))throw Error('Expected native scene actorPoses, objectTransforms or camera overrides.');
 const actors=new Set(base.actors.map(a=>a.id)),objects=new Set(base.objects.map(o=>o.id));
 for(const [key,ids]of [['actorPoses',actors],['objectTransforms',objects]])if(overrides[key]!==undefined){
  if(!record(overrides[key]))throw Error(`${key} must be an ID map.`);
  for(const id of Object.keys(overrides[key]))if(!ids.has(id))throw Error(`${key}.${id}: unknown scene node.`);
 }
 const document={...base,actors:base.actors.map(actor=>{
  const patch=overrides.actorPoses?.[actor.id];if(patch===undefined)return actor;
  if(!record(patch))throw Error(`actorPoses.${actor.id}: expected joint pose overrides.`);
  const pose={...actor.pose};for(const [id,value]of Object.entries(patch)){
   if(!record(value))throw Error(`actorPoses.${actor.id}.${id}: expected a local transform.`);
   pose[id]={...pose[id],...value};
  }
  return {...actor,pose};
 }),objects:base.objects.map(object=>({...object,transform:overrides.objectTransforms?.[object.id]??object.transform})),camera:overrides.camera??base.camera};
 return assertScene3D(document);
}

/** Native 3D evaluation. No camera or renderer participates in the pose solve.
 * Compile once for playback. Explicit overrides are validated as scene edits.
 * Contact order is authored order; conflicts remain visible in final diagnostics.
 */
export function compileScene3D(document){
 const base=structuredClone(assertScene3D(document)),rigs=Object.fromEntries(Object.entries(base.rigs).map(([id,rig])=>[id,compileRig3D(rig)]));
 return {
  serialize(){return structuredClone(base);},
  evaluate(overrides){
   const scene=overrides===undefined?base:applyOverrides(base,overrides),objects=scene.objects.map(objectFrame),objectMap=new Map(objects.map(o=>[o.id,o]));
   const actors=scene.actors.map(actor=>{const pose=structuredClone(actor.pose);return {id:actor.id,pose,world:evaluateRig3D(rigs[actor.rig],pose,actor.transform)};}),actorMap=new Map(actors.map(a=>[a.id,a])),specs=new Map(scene.actors.map(a=>[a.id,a])),contacts=[];
   for(const contact of scene.contacts){
    const actor=actorMap.get(contact.actor),spec=specs.get(contact.actor),chain=scene.rigs[spec.rig].chains[contact.chain],target=objectMap.get(contact.target.object).anchors[contact.target.anchor];
    if(!contact.enabled){contacts.push({id:contact.id,actor:contact.actor,status:'disabled',target:structuredClone(target),actual:structuredClone(actor.world[chain.tip]),error:distance(actor.world[chain.tip].position,target.position),orientationError:orientationError(actor.world[chain.tip].rotation,target.rotation),boneLengths:[],maxStretch:1});continue;}
    const result=solveTwoBone3D(rigs[spec.rig],actor.pose,contact.chain,target,{placement:spec.transform});
    actor.pose=result.pose;actor.world=result.world;
    contacts.push({id:contact.id,actor:contact.actor,...result.diagnostics,target:structuredClone(target)});
   }
   // Re-measure after all solves. A later constraint must not silently invalidate
   // an earlier grip while leaving its diagnostic marked as solved.
   for(let i=0;i<contacts.length;i++){
    const result=contacts[i],contact=scene.contacts[i],actor=actorMap.get(contact.actor),spec=specs.get(contact.actor),chain=scene.rigs[spec.rig].chains[contact.chain];
    result.actual=structuredClone(actor.world[chain.tip]);result.error=distance(result.actual.position,result.target.position);result.orientationError=orientationError(result.actual.rotation,result.target.rotation);
    const lengths=[distance(actor.world[chain.root].position,actor.world[chain.middle].position),distance(actor.world[chain.middle].position,actor.world[chain.tip].position)];
    result.boneLengths=lengths;
    if(result.status==='solved'&&(result.error>1e-6*Math.max(1,...lengths)||result.orientationError>1e-5))result.status='conflict';
   }
   return {actors,objects,contacts,camera:structuredClone(scene.camera)};
  }
 };
}

/** Convenience entry for a one-off evaluated native scene. */
export function evaluateScene3D(document){return compileScene3D(document).evaluate();}
