import {poseDefaults} from '../src/spatial.js';
import {gymBenchTargets} from './gym-room.js';

const duration=3.6,rad=Math.PI/180;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const between=(t,a,b)=>smooth((t-a)/(b-a));
const rotate=(p,angle)=>({x:p.x*Math.cos(angle)-p.y*Math.sin(angle),y:p.x*Math.sin(angle)+p.y*Math.cos(angle)});
const sides=[['left',-1],['right',1]];

export const gymAsymmetryReviews=['pull','bench'].flatMap(kind=>[false,true].flatMap(failed=>sides.map(([lead])=>{
 const id=`${kind}-${failed?'stall':'lead'}-${lead}`;
 return {id,clip:id,label:`${kind==='pull'?'Pull-up':'Bench press'} / ${lead} leads${failed?' / stalled':''}`,kind,lead,failed,duration,hold:1.65};
})));

/** Each side has its own effort curve. The weaker side pauses before either
 * catching up or yielding; the final phase returns to the shared neutral pose. */
export function gymAsymmetryEffort(time,{kind,failed}){
 const t=Math.max(0,Math.min(duration,time));
 if(kind==='pull'){
  const lower=1-between(t,failed?2.25:2.55,duration);
  const strong=(failed?.74:1)*between(t,.18,1.15)*lower;
  let weak=.44*between(t,.3,1.05);
  if(failed)weak+=.09*Math.sin(Math.PI*between(t,1.15,2.2))**2;
  else weak+=.56*between(t,1.85,2.4);
  return {strong,weak:weak*lower};
 }
 const descent=between(t,0,.8),leadPush=(failed?.67:1)*between(t,.92,1.62);
 let weakPush=.3*between(t,1.03,1.4);
 if(failed)weakPush+=.08*Math.sin(Math.PI*between(t,1.45,2.2))**2;
 else weakPush+=.7*between(t,1.95,2.6);
 const yielding=failed?1-between(t,2.12,2.6):1,rack=1-between(t,failed?2.7:2.65,duration);
 return {strong:descent*(1-leadPush*yielding)*rack,weak:descent*(1-weakPush*yielding)*rack};
}

export function sampleGymAsymmetry(time,options,{poseAt,solve,limbDepth}){
 const {kind,lead,failed}=options,pose={...poseAt(kind==='pull'?6:41,'full-set')};
 pose['water-bottle.opacity']=1;
 pose['water-bottle.x']=400-pose['root.x'];pose['water-bottle.y']=270-pose['root.y'];
 if(time<=0||time>=duration)return pose;
 const t=Math.max(0,Math.min(duration,time)),{strong,weak}=gymAsymmetryEffort(t,options),leadSign=lead==='left'?-1:1,envelope=between(t,.12,.6)*(1-between(t,2.7,duration));
 const effortBySide=Object.fromEntries(sides.map(([name])=>[name,name===lead?strong:weak]));
 if(kind==='pull'){
  const lift=(strong+weak)*.5,lag=strong-weak,roll=-leadSign*lag*20;
  pose['root.y']-=70*lift;pose['root.x']+=leadSign*lag*3;
  pose['pullbar.x']=180-pose['root.x'];pose['pullbar.y']=150-pose['root.y'];
  const restingBar=gymBenchTargets().bar;
  pose['barbell.x']=restingBar.x-pose['root.x'];pose['barbell.y']=restingBar.y-pose['root.y'];
  pose['torso.rotation']+=roll;pose['pelvis.rotation']+=roll*.23;pose['head.rotation']-=roll*.38;
  for(const [name,sign]of sides){
   const shoulder=rotate({x:sign*34,y:-20},roll*rad);shoulder.y-=48;
   pose[name+'Upper.x']=shoulder.x-sign*34;pose[name+'Upper.y']=shoulder.y+68;
   const target={x:180+sign*43-pose['root.x'],y:150-pose['root.y']},arm=solve(shoulder,target,40,sign<0?-1:1);
   pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;
   pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;
   limbDepth(pose,name,false,Math.abs(lag)*22);
  }
 }else{
  const target=gymBenchTargets(),left=effortBySide.left,right=effortBySide.right,span=target.bar.gripOffsets.right.x-target.bar.gripOffsets.left.x;
  // One rigid bar owns both hand targets. Unequal travel changes its angle,
  // rather than stretching the shaft or independently drifting its grips.
  const angle=target.bar.rotation+Math.atan2((right-left)*25,span)/rad;
  const drop=(left+right)*16,center={x:target.bar.x,y:target.bar.y+drop};
  pose['barbell.x']=center.x-pose['root.x'];pose['barbell.y']=center.y-pose['root.y'];pose['barbell.rotation']=angle;
  for(const [name,sign]of sides){
   const shoulder={x:sign*34+(pose[name+'Upper.x']||0),y:-68+(pose[name+'Upper.y']||0)},grip=rotate({x:target.bar.gripOffsets[name].x,y:0},angle*rad),hand={x:center.x+grip.x-pose['root.x'],y:center.y+grip.y-pose['root.y']},arm=solve(shoulder,hand,40,sign<0?-1:1);
   pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;
   pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;
   limbDepth(pose,name,false,Math.abs(left-right)*12);
  }
 }
 const struggle=between(t,.85,1.3)*(1-between(t,failed?2.4:2.25,2.8));
 pose['head.pitch']=(pose['head.pitch']||0)+(failed?12:7)*struggle;
 pose['head.rotation']+=(failed?2:1)*Math.sin(t*14)*struggle;
 pose['face-neutral.opacity']*=1-envelope;pose['face-effort.opacity']=Math.max(pose['face-effort.opacity']||0,envelope);pose['face-blink.opacity']=0;
 pose['effort-lines.opacity']=(failed?.8:.4)*struggle;pose['sweat.opacity']=Math.max(pose['sweat.opacity']||0,(failed?.8:.35)*struggle);
 pose['water-bottle.x']=400-pose['root.x'];pose['water-bottle.y']=270-pose['root.y'];
 return pose;
}

export function installGymAsymmetry(scene,helpers){
 const pack=scene.packs.atlas,defaults=poseDefaults(pack);
 for(const review of gymAsymmetryReviews){
  const clip=helpers.makeClip(duration,t=>sampleGymAsymmetry(t,review,helpers));
  for(const [channel,keys]of Object.entries(clip.tracks)){
   const constant=keys.every(key=>Math.abs(key[1]-keys[0][1])<1e-8);
   if(constant&&Math.abs(keys[0][1]-(defaults[channel]??0))<1e-5)delete clip.tracks[channel];
   else clip.tracks[channel]=(constant?[keys[0]]:keys).map(([time,value])=>[time,value]);
  }
  pack.clips[review.clip]=clip;
 }
 return scene;
}
