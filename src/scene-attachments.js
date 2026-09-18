import {objectGrip} from './scene-objects.js';
import {nodeVisible} from './scene-graph.js';
const rad=Math.PI/180,record=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export function validateAttachments(document,check){
 for(const prop of Array.isArray(document.props)?document.props:[]){if(!record(prop)||prop.attachment===undefined)continue;const a=prop.attachment,p='props.'+prop.id+'.attachment';
  check(record(a)&&['joint','object'].includes(a.type),p,'Expected joint or shared object attachment.');if(!record(a))continue;
  check(Object.keys(a).every(k=>['type','offsetX','offsetY','rotation','inheritRotation',...(a.type==='joint'?['actor','joint']:['object'])].includes(k)),p,'Unknown attachment setting.');
  if(a.type==='joint'){const actor=document.actors?.find(v=>v?.id===a.actor);check(!!document.packs?.[actor?.pack]?.joints.some(j=>j.id===a.joint),p,'Missing attachment actor or joint.');}
  if(a.type==='object')check(Array.isArray(document.objects)&&document.objects.some(o=>o?.id===a.object),p,'Missing shared object.');
  for(const k of ['offsetX','offsetY'])if(a[k]!==undefined)check(finite(a[k],-1000,1000),p+'.'+k,'Offsets must be -1000..1000.');
  if(a.rotation!==undefined)check(finite(a.rotation,-180,180),p+'.rotation','Rotation must be -180..180 degrees.');
  if(a.inheritRotation!==undefined)check(typeof a.inheritRotation==='boolean',p+'.inheritRotation','Expected boolean.');
  check(prop.collider?.enabled===false,p,'Attached artwork cannot be a static collision box. Use its shared object for collisions.');
  check(document.requiredFeatures?.includes('prop-attachments'),'requiredFeatures','Declare prop-attachments.');
 }
}

/** Resolve decoration from the same live grip/object positions used by contacts.
 * Width and height stay in scene units. Unavailable targets hide the artwork;
 * they never snap it back to its saved unattached position. No state is mutated. */
export function evaluatedProps(document,frame){
 return (document.props||[]).map(prop=>{const a=prop.attachment;if(!a)return prop;let target;
  if(a.type==='joint')target=objectGrip(document,frame,{actor:a.actor,joint:a.joint,offsetX:a.offsetX||0,offsetY:a.offsetY||0});
  else{const object=(frame.objects||document.objects||[]).find(o=>o.id===a.object);if(object&&object.enabled!==false&&object.visible!==false){const ownerAvailable=!object.owner||nodeVisible(document,document.actors.find(v=>v.id===object.owner.actor)),grip=ownerAvailable?(frame.objects?object:object.owner?objectGrip(document,frame,object.owner):object):null;if(grip){const angle=(grip.rotation||0)*rad,x=a.offsetX||0,y=a.offsetY||0;target={x:grip.x+x*Math.cos(angle)-y*Math.sin(angle),y:grip.y+x*Math.sin(angle)+y*Math.cos(angle),rotation:grip.rotation||0};}}}
  if(!target||!nodeVisible(document,prop))return {...prop,hidden:true};
  return {...prop,x:target.x,y:target.y,rotation:(a.inheritRotation===false?0:target.rotation)+(a.rotation||0)};
 });
}
