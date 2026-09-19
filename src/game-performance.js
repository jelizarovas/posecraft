import {sampleClip,forwardKinematics,constrainPose,wrapAngle} from './index.js';
import {RecoveryMotion} from './recovery.js';
import {nodeVisible} from './scene-graph.js';
import {gameActorBindings} from './game-bindings.js';
import {GameNavigationMotion} from './game-navigation.js';
const blendPose=(from,to,t)=>Object.fromEntries(Object.keys({...from,...to}).map(key=>{const a=from[key]??to[key],b=to[key]??a;return [key,a+(key.endsWith('.rotation')?wrapAngle(b-a):b-a)*t];}));
export function validateGameCommand(document,c){
 if(!c||!['action','look','move','cancel'].includes(c.type)||typeof c.request!=='string'||!c.request.length||c.request.length>128||typeof c.actor!=='string')throw Error('Invalid game command.');
 const actor=document.actors.find(a=>a.id===c.actor),pack=document.packs[actor?.pack];if(!actor)throw Error('Unknown game actor.');
 if(c.channel!==undefined&&(!['motion','gaze'].includes(c.channel)||c.channel==='gaze'&&!['look','cancel'].includes(c.type)))throw Error('Invalid game command channel.');
 if(c.type==='action'&&(typeof c.clip!=='string'||!Object.hasOwn(pack.clips,c.clip)))throw Error('Unknown action clip.');
 if(c.type==='move'&&(!Number.isFinite(c.x)||c.x<0||c.x>document.bounds.width))throw Error('Move target must be inside the scene.');
 if(c.type==='move'&&['planar','float'].includes(gameActorBindings(document,c.actor)?.locomotion?.mode)&&(!Number.isFinite(c.y)||c.y<0||c.y>document.bounds.height))throw Error('Move target must be inside the scene.');
 if(c.type==='look'&&(!pack.joints.some(j=>j.id===c.joint)||!c.target||![c.target.x,c.target.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)||!Number.isFinite(c.maxAngle)||c.maxAngle<0||c.maxAngle>180||!Number.isFinite(c.duration)||c.duration<0||c.duration>180))throw Error('Invalid look target, joint, angle, or duration.');
 return structuredClone(c);
}
/** Ephemeral requests, advanced only by the controller's simulation clock. */
export class GamePerformance{
 constructor(controller){this.controller=controller;this.active=new Map();this.held=new Map();this.ground=new Map();}
 available(entry){return !entry.sleeping&&nodeVisible(this.controller.document,entry.actor)&&!entry.physics&&entry.behavior.mode==='animated'&&!entry.preview&&(!entry.recovery||['home','blocked'].includes(entry.recovery.phase));}
 relinquish(actor){for(const [key,s]of this.held)if(s.actor===actor)this.held.delete(key);this.ground.delete(actor);for(const s of [...this.active.values()])if(s.actor===actor)this.finish(s,'Actor is now controlled by another motion or preview.',true);}
 finish(s,error,cancelled=false){if(this.active.get(s.key)!==s)return;this.active.delete(s.key);this.controller.emit({type:error?'actor.command.failed':'actor.command.completed',actor:s.actor,request:s.request,command:s.type,...(error?{error,cancelled}:{})});}
 cancel(actor,request,reason='Command cancelled.'){const states=[...this.active.values()].filter(s=>s.actor===actor&&(!request||s.request===request));for(const s of states){const frame=this.controller.frame().actors.find(a=>a.id===actor);if(s.root&&frame&&s.channel!=='gaze')this.ground.set(actor,{[s.root+'.x']:frame.pose[s.root+'.x']??0,[s.root+'.y']:frame.pose[s.root+'.y']??0});this.held.delete(s.key);this.finish(s,reason,true);}return states.length>0;}
 cancelAll(reason){for(const s of [...this.active.values()])this.cancel(s.actor,s.request,reason);}
 command(input){
  const c=validateGameCommand(this.controller.document,input);if(c.type==='cancel')return this.cancel(c.actor,c.request);
  const key=c.channel==='gaze'?c.actor+'\0gaze':c.actor,visible=this.controller.frame().actors.find(a=>a.id===c.actor),old=this.active.get(key);if(old)this.cancel(c.actor,old.request,'Command replaced.');
  const entry=this.controller.actors.find(a=>a.actor.id===c.actor),frame=visible,root=entry.pack.physics?.root??entry.pack.joints.find(j=>!j.parent)?.id;
  const s={...c,key,time:0,entry,root,base:{...frame.pose},duration:c.type==='action'?entry.pack.clips[c.clip].duration:c.type==='look'?c.duration:0};this.active.set(key,s);this.held.delete(key);
  if(!nodeVisible(this.controller.document,entry.actor)||entry.physics||entry.behavior.mode!=='animated'||entry.preview||entry.recovery&&!['home','blocked'].includes(entry.recovery.phase)){this.finish(s,'Actor is hidden, previewed, or controlled by another motion.');return false;}
  if(root&&c.channel!=='gaze')this.ground.set(c.actor,{[root+'.x']:frame.pose[root+'.x']??0,[root+'.y']:frame.pose[root+'.y']??0});
  if(c.type==='move'){
   const binding=gameActorBindings(this.controller.document,c.actor).locomotion;
   if(binding&&binding.mode!=='ground-x'){
    try{s.navigation=true;s.motion=new GameNavigationMotion(this.navigationDocument(),entry,frame,{x:c.x,y:c.y},binding);s.duration=Infinity;}catch(error){this.finish(s,error.message);return false;}
   }else{
   if(!entry.pack.physics){this.finish(s,'Actor has no walking collision rig.');return false;}
   s.motion=new RecoveryMotion(this.controller.document,entry.actor,entry.pack,frame,{walkX:c.x});s.duration=s.motion.duration;
   if(s.motion.blocked||Math.abs(s.motion.to.x-c.x)>.05){this.finish(s,s.motion.blocked?'Walking route is blocked.':'Walking target was clamped by actor bounds.');return false;}
   }
  }
  if(this.controller.reducedMotion&&this.controller.playing&&this.controller.animationPlaying)this.tick(0,true);
  return true;
 }
 navigationDocument(){return {...this.controller.document,objects:this.controller.objects?.bodies??this.controller.document.objects};}
 tick(dt,immediate=false){
  if(!this.controller.playing||!this.controller.animationPlaying)return;
  for(const [actor,s]of this.held){if(s.type==='look')continue;s.releaseTime=(s.releaseTime??0)+(immediate ? .2 : dt);if(s.releaseTime>=.2-1e-9)this.held.delete(actor);}
  for(const s of [...this.active.values()]){
   if(!this.available(s.entry)){if(s.entry.sleeping)this.finish(s,'Actor sleeping.',true);else this.relinquish(s.actor);continue;}
   s.time=immediate&&!s.navigation?s.duration:Math.min(s.duration,s.time+dt);
   if(s.motion){
    if(s.navigation){const motion=s.motion;motion.tick(dt,immediate,this.navigationDocument());if(motion.error){this.finish(s,motion.error);continue;}if(motion.done)s.duration=s.time;}
    else s.motion.tick(immediate?s.duration:dt);
    this.ground.set(s.actor,{[s.root+'.x']:s.motion.pose[s.root+'.x'],[s.root+'.y']:s.motion.pose[s.root+'.y']});
   }
   if(s.time+1e-9>=s.duration){this.held.set(s.key,s);this.finish(s);}
  }
 }
 apply(frame){
  if(!this.active.size&&!this.held.size&&!this.ground.size)return frame;
  return {...frame,actors:frame.actors.map(actor=>{
   const s=this.active.get(actor.id)??this.held.get(actor.id),gaze=this.active.get(actor.id+'\0gaze')??this.held.get(actor.id+'\0gaze'),anchor=this.ground.get(actor.id);if(!s&&!gaze&&!anchor)return actor;
   const entry=s?.entry??gaze?.entry??this.controller.actors.find(a=>a.actor.id===actor.id);if(entry.sleeping)return actor;if(!this.available(entry)){this.relinquish(actor.id);return actor;}
   const underlying={...actor.pose,...anchor};let pose={...underlying};
   if(s?.type==='action'){
    pose={...entry.runtime.definition.defaults,...sampleClip({...entry.pack.clips[s.clip],loop:false},s.time)};
    for(const key of Object.keys(anchor??{}))pose[key]=(pose[key]??0)+anchor[key];
    if(this.active.get(actor.id)===s&&s.duration>0)pose=blendPose(s.base,pose,Math.min(1,s.time/Math.min(.15,s.duration*.2)));
   }else if(s?.type==='move')pose={...pose,...s.motion.pose};
   else if(s?.type==='look'){
    const world=forwardKinematics(entry.pack.joints,pose),joint=world[s.joint],placement=actor.placement??entry.actor.transform,r=placement.rotation*Math.PI/180,dx=(s.target.x-placement.x)/placement.scale,dy=(s.target.y-placement.y)/placement.scale,x=dx*Math.cos(r)+dy*Math.sin(r),y=-dx*Math.sin(r)+dy*Math.cos(r);
    const desired=Math.atan2(y-joint.y,x-joint.x)*180/Math.PI,delta=Math.max(-s.maxAngle,Math.min(s.maxAngle,wrapAngle(desired-joint.rotation))),blend=s.duration?Math.min(1,s.time/s.duration):1;
    pose[s.joint+'.rotation']=(pose[s.joint+'.rotation']??0)+delta*blend;
   }
   if(s&&this.held.get(actor.id)===s&&s.type!=='look'&&s.releaseTime>0)pose=blendPose(pose,underlying,Math.min(1,s.releaseTime/.2));
   if(gaze){const world=forwardKinematics(entry.pack.joints,pose),joint=world[gaze.joint],placement=actor.placement??entry.actor.transform,r=placement.rotation*Math.PI/180,dx=(gaze.target.x-placement.x)/placement.scale,dy=(gaze.target.y-placement.y)/placement.scale,x=dx*Math.cos(r)+dy*Math.sin(r),y=-dx*Math.sin(r)+dy*Math.cos(r),desired=Math.atan2(y-joint.y,x-joint.x)*180/Math.PI,delta=Math.max(-gaze.maxAngle,Math.min(gaze.maxAngle,wrapAngle(desired-joint.rotation))),blend=gaze.duration?Math.min(1,gaze.time/gaze.duration):1;pose[gaze.joint+'.rotation']=(pose[gaze.joint+'.rotation']??0)+delta*blend;}
   pose=constrainPose(entry.pack.joints,pose);return {...actor,pose,world:forwardKinematics(entry.pack.joints,pose),...(s?.type==='action'?{clip:s.clip,clipTime:s.time}:{}),...(s?.type==='move'?{state:s.time<s.duration?'walk':actor.state}:{})};
  })};
 }
}
