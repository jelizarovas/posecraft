import {clamp,forwardKinematics} from './index.js';
import {spatialKinematics} from './spatial.js';
import {solveContact} from './contacts.js';
const rad=Math.PI/180,phases=['start','move','end','cancel','click','hover'];
const safeId=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const world=(pack,pose)=>pack.spatial?spatialKinematics(pack,pose):Object.fromEntries(Object.entries(forwardKinematics(pack.joints,pose)).map(([id,p])=>{const c=Math.cos(p.rotation*rad),s=Math.sin(p.rotation*rad);return [id,{...p,m:[c,-s,0,s,c,0,0,0,1]}];}));
const screen=(p,t)=>{const c=Math.cos(t.rotation*rad),s=Math.sin(t.rotation*rad);return {x:t.x+t.scale*(p.x*c-p.y*s),y:t.y+t.scale*(p.x*s+p.y*c)};};
const local=(p,t)=>{const c=Math.cos(t.rotation*rad),s=Math.sin(t.rotation*rad),x=(p.x-t.x)/t.scale,y=(p.y-t.y)/t.scale;return {x:x*c+y*s,y:-x*s+y*c};};
export function validateInteractions(document,check){
 check(document.interactions===undefined||Array.isArray(document.interactions),'interactions','Expected pointer interaction array.');
 const bindings=Array.isArray(document.interactions)?document.interactions:[],ids=new Set();check(bindings.length<=48,'interactions','At most 48 pointer bindings.');
 for(const b of bindings){if(!b||typeof b!=='object'){check(false,'interactions','Expected binding.');continue;}const path='interactions.'+b.id,actor=document.actors?.find(a=>a.id===b.actor),pack=document.packs?.[actor?.pack];
  check(typeof b.id==='string'&&safeId.test(b.id)&&!ids.has(b.id),path,'Binding IDs must be unique.');ids.add(b.id);check(!!pack,path,'Missing interaction actor.');
  check(['click','drag','hover-fast'].includes(b.gesture),path,'Unknown pointer gesture.');check(['event','carry','resist'].includes(b.response),path,'Unknown pointer response.');
  check(typeof b.event==='string'&&safeId.test(b.event),path,'Expected event name.');check(Number.isFinite(b.resistance)&&b.resistance>=0&&b.resistance<=1,path,'Resistance must be 0..1.');
  if(b.joint!==undefined)check(pack?.joints?.some(j=>j.id===b.joint),path,'Missing interaction joint.');if(b.part!==undefined)check(pack?.parts?.some(p=>p.id===b.part),path,'Missing interaction artwork.');
  if(b.response!=='event')check(b.gesture==='drag'&&typeof b.joint==='string',path,'Carry and resistance need a draggable joint.');
  if(b.threshold!==undefined)check(Number.isFinite(b.threshold)&&b.threshold>=50&&b.threshold<=5000,path,'Pointer speed threshold must be 50..5000 scene units per second.');
 }
}
/** Kinematic pointer resistance, independent of rigid-body physics. */
export class ScenePointerInteraction{
 constructor(document,{dispatch=()=>{}}={}){this.document=document;this.dispatch=dispatch;this.reset();}
 reset(){this.active=null;this.lastFrame=null;this.time=0;this.cooldowns=new Map();}
 input(command){
  const b=this.document.interactions?.find(b=>b.id===command?.binding);if(!b||!phases.includes(command.phase)||![command.x,command.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000))throw Error('Invalid pointer interaction.');
  const {phase,x,y}=command;
  if(phase==='click'||phase==='hover'){if(b.gesture!==(phase==='click'?'click':'hover-fast'))throw Error('Gesture does not match binding.');if(this.time<(this.cooldowns.get(b.id)||0))return;this.cooldowns.set(b.id,this.time+.8);this.dispatch(b.event,{actor:b.actor,x,y});return;}
  if(b.gesture!=='drag')throw Error('Binding is not draggable.');
  if(phase==='start'){
   const a=this.document.actors.find(a=>a.id===b.actor),f=this.lastFrame?.actors.find(a=>a.id===b.actor);if(!f||f.physics)return;const p=this.document.packs[a.pack],j=world(p,f.pose)[b.joint||p.joints[0].id],anchor=screen(j,f.placement||a.transform);
   this.active={binding:b,start:{x,y},cursor:{x,y},anchor,offset:{x:0,y:0},released:false};return;
  }
  const a=this.active;if(!a||a.binding.id!==b.id)return;a.cursor={x,y};
  if(phase==='end'||phase==='cancel'){a.released=true;if(phase==='end')this.dispatch(b.event,{actor:b.actor,x,y});if(b.response==='carry'||b.response==='event')this.active=null;}
 }
 step(dt){this.time+=dt;const a=this.active;if(!a)return;const factor=(1-a.binding.resistance)*.8+.04,speed=1-Math.exp(-dt*(a.released?13:20));for(const key of ['x','y']){const desired=a.released?0:clamp((a.cursor[key]-a.start[key])*factor,-32,32);a.offset[key]+=(desired-a.offset[key])*speed;}if(a.released&&Math.hypot(a.offset.x,a.offset.y)<.02)this.active=null;}
 apply(frame){
  this.lastFrame=frame;const active=this.active;if(!active||active.binding.response==='event')return frame;const b=active.binding,index=frame.actors.findIndex(a=>a.id===b.actor),f=frame.actors[index],actor=this.document.actors.find(a=>a.id===b.actor);if(!f||f.physics)return frame;
  const pack=this.document.packs[actor.pack],pose={...f.pose},w=world(pack,pose),joint=pack.joints.find(j=>j.id===b.joint),placement=f.placement||actor.transform,anchor=screen(w[joint.id],placement),target=b.response==='carry'?{x:active.anchor.x+active.cursor.x-active.start.x,y:active.anchor.y+active.cursor.y-active.start.y}:{x:anchor.x+active.offset.x,y:anchor.y+active.offset.y},aim=local(target,placement);
  let solved=pose;
  if(b.response==='resist'&&/hand|wrist|foot/i.test(joint.id)){
   const lower=pack.joints.find(j=>j.id===joint.parent),upper=lower&&pack.joints.find(j=>j.id===lower.parent);if(upper){const angle=(pose[lower.id+'.rotation']??lower.rotation)*rad+Math.atan2(joint.y,joint.x)-Math.atan2(lower.y,lower.x);solved=solveContact(pack,pose,{upper:upper.id,lower:lower.id,end:joint.id},aim,{bend:Math.sin(angle)<0?-1:1}).pose;}
  }else if(b.response!=='event'){
   const parent=w[joint.parent],m=parent?.m||[1,0,0,0,1,0,0,0,1],dx=aim.x-w[joint.id].x,dy=aim.y-w[joint.id].y,det=m[0]*m[4]-m[1]*m[3];
   if(Math.abs(det)>.05){pose[joint.id+'.x']=(pose[joint.id+'.x']||0)+(m[4]*dx-m[1]*dy)/det;pose[joint.id+'.y']=(pose[joint.id+'.y']||0)+(-m[3]*dx+m[0]*dy)/det;}
   if(b.response==='resist'){pose[joint.id+'.rotation']=clamp((pose[joint.id+'.rotation']??joint.rotation)+active.offset.x*.2,joint.min,joint.max);}
  }
  if(b.response==='carry'&&joint.id==='food'){solved['skewer.opacity']=0;solved['food.opacity']=1;solved['food.bend']=0;}
  const actors=frame.actors.slice();actors[index]={...f,pose:solved,world:forwardKinematics(pack.joints,solved),activity:b.response==='resist'?'resisting a tug':b.response==='carry'?'holding onto a treat':f.activity};return {...frame,actors,pointer:{actor:b.actor,joint:b.joint,response:b.response,released:active.released}};
 }
}
