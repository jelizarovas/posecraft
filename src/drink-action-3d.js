import {Quaternion,Vector3} from 'three';
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from './rig-3d.js';
import {wristTargetForGrip3D,applyGripPose3D} from './grip-3d.js';
import {relaxedArmGoal} from './arm-pose-3d.js';
const I=[0,0,0,1],clamp=v=>Math.max(0,Math.min(1,v)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);},mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
/** Bottle position is its center. A standing, planted-foot reach, sip and replacement. */
export function createDrinkAction3D({rig,roles,grips={},bottle,settings={}}){
 const compiled=compileRig3D(rig),bind=evaluateRig3D(compiled),duration=settings.duration??4;
 if(!Number.isFinite(duration)||duration<3||duration>30)throw Error('Drink duration must be 3..30 seconds.');
 const hips=bind[roles.pelvis],head=bind[roles.head]??Object.values(bind).reduce((a,b)=>a.position[1]>b.position[1]?a:b),names={};
 for(const key of ['leftArm','rightArm','leftLeg','rightLeg']){names[key]=roles[key]??key;if(!compiled.chains[names[key]])throw Error('Drink action needs four semantic limb chains.');}
 if(!hips)throw Error('Drink action needs a pelvis role.');
 const low=Math.min(...['leftLeg','rightLeg'].map(key=>bind[compiled.chains[names[key]].tip].position[1]));
 const placement={position:[bottle.position[0]+.2-hips.position[0],(settings.soleHeight??.025)-low,bottle.position[2]-.27-hips.position[2]],rotation:[...I],scale:1};
 const standing=evaluateRig3D(compiled,{},placement),feet={};for(const key of ['leftLeg','rightLeg'])feet[key]=standing[compiled.chains[names[key]].tip].position;
 const phases=[['reach',0,.2],['lift',.2,.42],['drink',.42,.65],['replace',.65,.85],['release',.85,1]],beats=phases.map(([id,a,b])=>({id,label:id,start:a*duration,end:b*duration}));
 function sample(input){
  const time=Math.max(0,Math.min(duration,Number(input)||0)),u=time/duration,beat=phases.find(([,a,b])=>u>=a&&u<b)??phases.at(-1),phase=time===duration?'complete':beat[0];let pose={},world=evaluateRig3D(compiled,pose,placement),diagnostics=[];
  const chest=roles.chest;if(chest&&bind[chest]){const q=new Quaternion(...bind[chest].rotation).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.sin(u*Math.PI*4)*.012*Math.sin(u*Math.PI)**2));pose[chest]={rotation:q.toArray()};world=evaluateRig3D(compiled,pose,placement);}
  const right=compiled.chains[names.rightArm],hand=world[right.tip],grip=grips.right;
  const rest=relaxedArmGoal({shoulder:world[right.root].position,sign:-1,length:distance(bind[right.root].position,bind[right.middle].position)+distance(bind[right.middle].position,bind[right.tip].position)});
  const restWrist={position:rest.hand,rotation:hand.rotation},restPalm=grip?new Vector3(...grip.position).applyQuaternion(new Quaternion(...hand.rotation)).add(new Vector3(...rest.hand)).toArray():rest.hand;
  const headWorld=world[roles.head]?.position??head.position.map((v,i)=>v+placement.position[i]);
  const mouth=[headWorld[0],headWorld[1]-.065,headWorld[2]+.14];
  const bottleRotation=new Quaternion(...bottle.rotation),sipRotation=bottleRotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI*.34));
  const sip=mouth.map((v,i)=>v-new Vector3(0,.12,0).applyQuaternion(sipRotation).toArray()[i]);
  let target=[...bottle.position],rotation=bottleRotation,held=u>=.2&&u<.85,amount=1;
  if(u<.2){amount=smooth(u/.2);target=mix(restPalm,bottle.position,amount);}
  else if(u<.42){const k=smooth((u-.2)/.22);target=mix(bottle.position,sip,k);rotation=bottleRotation.clone().slerp(sipRotation,k);}
  else if(u<.65){target=sip;rotation=sipRotation;}
  else if(u<.85){const k=smooth((u-.65)/.2);target=mix(sip,bottle.position,k);rotation=sipRotation.clone().slerp(bottleRotation,k);}
  else{amount=1-smooth((u-.85)/.15);target=mix(restPalm,bottle.position,amount);}
  const palmRotation=new Quaternion(...restWrist.rotation).multiply(new Quaternion(...(grip?.rotation??I))).multiply(bottleRotation.clone().invert()).multiply(rotation).toArray();
  function solve(key,target,pole,active=true){const chain=compiled.chains[names[key]],result=solveTwoBone3D(compiled,pose,names[key],target,{placement,poleWorld:pole});pose=result.pose;world=result.world;diagnostics.push({id:key,chain:names[key],active,target,actual:world[chain.tip],...result.diagnostics});}
  const wrist=grip?wristTargetForGrip3D(grip,{position:target,rotation:palmRotation}):{position:target,rotation:palmRotation};
  solve('rightArm',wrist,[world[right.root].position[0]-.4,world[right.root].position[1]-.25,world[right.root].position[2]-.3],held);
  if(grip)pose=applyGripPose3D(rig,pose,grip,amount);
  const left=compiled.chains[names.leftArm],leftGoal=relaxedArmGoal({shoulder:world[left.root].position,sign:1,length:distance(bind[left.root].position,bind[left.middle].position)+distance(bind[left.middle].position,bind[left.tip].position)});solve('leftArm',{position:leftGoal.hand},leftGoal.pole,false);
  for(const key of ['leftLeg','rightLeg']){const foot=feet[key];solve(key,{position:foot},[foot[0],foot[1]+.4,foot[2]+.5]);}
  world=evaluateRig3D(compiled,pose,placement);for(const d of diagnostics)d.actual=world[compiled.chains[d.chain].tip];
  return {time,duration,phase,rep:null,effort:0,pose,placement,world,diagnostics,contacts:diagnostics.filter(d=>d.active),valid:diagnostics.every(d=>d.status==='solved'),support:{seat:false,feet:Object.values(feet)},bottle:{position:held?target:[...bottle.position],rotation:held?rotation.toArray():[...bottle.rotation],visible:true,owner:held?'atlas':null}};
 }
 return {duration,beats,sample,standingPlacement:placement};
}
/** A supported recovery breath; the existing feet remain exactly planted. */
export function createRestAction3D({rig,roles,frame,duration=4}){
 const compiled=compileRig3D(rig),source=structuredClone(frame),chest=roles.chest??roles.pelvis,joint=rig.joints.find(j=>j.id===chest),base=source.pose[chest]?.rotation??joint?.rotation??I;
 if(!Number.isFinite(duration)||duration<.1||duration>30)throw Error('Invalid rest duration.');
 return {duration,beats:[{id:'rest',label:'Catch breath',start:0,end:duration}],sample(time){time=Math.max(0,Math.min(duration,time));const pose=structuredClone(source.pose),envelope=Math.sin(Math.PI*time/duration)**2,angle=Math.sin(time*2*Math.PI*.6)*.025*envelope;pose[chest]={...pose[chest],rotation:new Quaternion(...base).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),angle)).toArray()};let world=evaluateRig3D(compiled,pose,source.placement);const diagnostics=[];for(const key of ['leftLeg','rightLeg']){const name=roles[key]??key,chain=compiled.chains[name];if(!chain)continue;const target={position:source.world[chain.tip].position,rotation:source.world[chain.tip].rotation},result=solveTwoBone3D(compiled,pose,name,target,{placement:source.placement});Object.assign(pose,result.pose);world=result.world;diagnostics.push({id:key,chain:name,active:true,target,actual:world[chain.tip],...result.diagnostics});}return {...source,time,duration,phase:time===duration?'complete':'rest',pose,world,diagnostics,contacts:diagnostics,valid:diagnostics.every(d=>d.status==='solved')};}};
}
