import {Quaternion,Vector3} from 'three';
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from './rig-3d.js';
import {relaxedArmGoal} from './arm-pose-3d.js';
export const actionSmooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export const actionPoint=p=>new Vector3().fromArray(p);
export const actionQuat=q=>new Quaternion().fromArray(q);
export function nativeActionContext(rig,roles){
 const source=structuredClone(rig),compiled=compileRig3D(source),bind=evaluateRig3D(compiled),limbs={};if(!bind[roles?.pelvis])throw Error('Action needs a pelvis role.');
 for(const key of ['leftArm','rightArm','leftLeg','rightLeg']){const name=roles[key]??key,chain=compiled.chains[name];if(!chain)throw Error(`Action needs ${key}.`);const lengths=[actionPoint(bind[chain.root].position).distanceTo(actionPoint(bind[chain.middle].position)),actionPoint(bind[chain.middle].position).distanceTo(actionPoint(bind[chain.tip].position))];limbs[key]={name,chain,lengths,length:lengths[0]+lengths[1]};}
 return {rig:source,roles:structuredClone(roles),compiled,bind,limbs};
}
export function nativeActionSolve(context,pose,placement,goals){
 const diagnostics=[];for(const goal of goals){const limb=context.limbs[goal.id],solved=solveTwoBone3D(context.compiled,pose,limb.name,goal.target,{placement,poleWorld:goal.pole,world:'chain'});pose=solved.pose;diagnostics.push({id:goal.id,chain:limb.name,active:goal.active!==false,target:structuredClone(goal.target),...solved.diagnostics});}
 const world=evaluateRig3D(context.compiled,pose,placement);for(const d of diagnostics){d.actual=world[context.limbs[d.id].chain.tip];d.error=actionPoint(d.actual.position).distanceTo(actionPoint(d.target.position));if(d.status==='solved'&&d.error>1e-6)d.status='conflict';}
 return {pose,placement,world,diagnostics,contacts:diagnostics.filter(d=>d.active),valid:diagnostics.every(d=>d.status==='solved')};
}
export function nativeRelaxedGoals(context,world,heading,swing=0,scale=1){return ['left','right'].map((side,i)=>{const limb=context.limbs[side+'Arm'],sign=Math.sign(context.bind[limb.chain.root].position[0]-context.bind[context.roles.pelvis].position[0])||(i?-1:1),goal=relaxedArmGoal({shoulder:world[limb.chain.root].position,sign,length:limb.length*scale,heading,swing:swing*(i?-1:1)});return{id:side+'Arm',target:{position:goal.hand},pole:goal.pole,active:false};});}
function placement(value){const p={position:[...(value?.position??[0,0,0])],rotation:[...(value?.rotation??[0,0,0,1])],scale:value?.scale??1};if(p.position.length!==3||!p.position.every(Number.isFinite)||p.rotation.length!==4||!p.rotation.every(Number.isFinite)||Math.abs(Math.hypot(...p.rotation)-1)>1e-5||!Number.isFinite(p.scale)||p.scale<=0)throw Error('Locomotion needs finite positions, unit rotations, and positive scales.');if(actionPoint([0,1,0]).applyQuaternion(actionQuat(p.rotation)).distanceTo(actionPoint([0,1,0]))>1e-6)throw Error('Locomotion placements must be upright.');return p;}
export function createLocomotionAction3D({rig,roles,grips,from,to,settings={}}){
 if(settings.waypoints!==undefined&&(!Array.isArray(settings.waypoints)||settings.waypoints.length>16||!settings.waypoints.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z))))throw Error('Locomotion supports up to16 finite XZ waypoints.');
 if(settings.waypoints?.length){
  if(!Array.isArray(settings.waypoints)||settings.waypoints.length>16||!settings.waypoints.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)))throw Error('Locomotion supports up to16 finite XZ waypoints.');
  const start=placement(from),end=placement(to),points=[...settings.waypoints.map(p=>({position:[p.x,start.position[1],p.z],rotation:start.rotation,scale:start.scale})),end],segments=[];let origin=start,pose=settings.fromPose,time=0;
  for(let i=0;i<points.length;i++){const destination=structuredClone(points[i]);if(i<points.length-1)destination.rotation=new Quaternion().setFromAxisAngle(actionPoint([0,1,0]),Math.atan2(destination.position[0]-origin.position[0],destination.position[2]-origin.position[2])).toArray();const action=createLocomotionAction3D({rig,roles,grips,from:origin,to:destination,settings:{...settings,waypoints:undefined,fromPose:pose,toPose:i===points.length-1?settings.toPose:undefined}});segments.push({action,start:time,end:time+action.duration});time+=action.duration;origin=destination;pose=action.sample(action.duration).pose;}
  return{duration:time,beats:segments.flatMap((s,i)=>s.action.beats.map(b=>({...b,id:i+':'+b.id,start:b.start+s.start,end:b.end+s.start}))),sample(t){if(!Number.isFinite(t))throw Error('Action time must be finite.');const at=Math.max(0,Math.min(time,t)),s=segments.find(s=>at<s.end)??segments.at(-1);return{...s.action.sample(at-s.start),time:at,duration:time};}};
 }
 const context=nativeActionContext(rig,roles),a=placement(from),b=placement(to);if(Math.abs(a.scale-b.scale)>1e-8)throw Error('Locomotion cannot change character scale.');
 const speed=settings.speed??1.05,tempo=settings.tempo??1;if(!Number.isFinite(speed)||speed<.1||speed>3||!Number.isFinite(tempo)||tempo<.25||tempo>3)throw Error('Invalid locomotion speed or tempo.');
 const displacement=actionPoint(b.position).sub(actionPoint(a.position)),distance=Math.hypot(displacement.x,displacement.z),heading=distance>1e-8?Math.atan2(displacement.x,displacement.z):Math.atan2(2*(a.rotation[3]*a.rotation[1]),1-2*a.rotation[1]**2),travelQ=new Quaternion().setFromAxisAngle(actionPoint([0,1,0]),heading),prepare=.6/tempo,arrive=.6/tempo,walk=Math.max(.1,distance/speed)/tempo,duration=prepare+walk+arrive;
 const rest=(p)=>{const world=evaluateRig3D(context.compiled,{},p),q=actionQuat(p.rotation),h=Math.atan2(actionPoint([0,0,1]).applyQuaternion(q).x,actionPoint([0,0,1]).applyQuaternion(q).z);return nativeActionSolve(context,{},p,nativeRelaxedGoals(context,world,h,0,p.scale)).pose;};
 const fromPose=structuredClone(settings.fromPose??rest(a)),toPose=structuredClone(settings.toPose??rest(b)),fromWorld=evaluateRig3D(context.compiled,fromPose,a),toWorld=evaluateRig3D(context.compiled,toPose,b),steps=Math.max(2,Math.ceil(distance/(Math.min(context.limbs.leftLeg.length,context.limbs.rightLeg.length)*a.scale*.38)/2)*2),beats=[{id:'turn-to-path',label:'Turn toward path',start:0,end:prepare},{id:'walk',label:'Walk',start:prepare,end:prepare+walk},{id:'arrive',label:'Arrive',start:prepare+walk,end:duration}];
 const root=context.compiled.joints.find(j=>j.parent===null),rootAt=p=>({[root.id]:{position:actionPoint(fromPose[root.id]?.position??root.position).lerp(actionPoint(toPose[root.id]?.position??root.position),p).toArray(),rotation:actionQuat(fromPose[root.id]?.rotation??root.rotation).slerp(actionQuat(toPose[root.id]?.rotation??root.rotation),p).toArray()}}),landings=new Map();
 if(steps>256)throw Error('Locomotion route exceeds256 steps. Split it into shorter actions.');
 const blendPose=(start,end,t)=>{const pose={};for(const id of new Set([...Object.keys(start),...Object.keys(end)])){const joint=context.compiled.joints.find(j=>j.id===id);if(!joint)throw Error('Endpoint pose references missing joint '+id);pose[id]={position:actionPoint(start[id]?.position??joint.position).lerp(actionPoint(end[id]?.position??joint.position),t).toArray(),rotation:actionQuat(start[id]?.rotation??joint.rotation).slerp(actionQuat(end[id]?.rotation??joint.rotation),t).toArray()};}return pose;};
 const footAt=(side,p)=>{const key=side+':'+p;if(landings.has(key))return [...landings.get(key)];const limb=context.limbs[side+'Leg'],world=evaluateRig3D(context.compiled,rootAt(p),{position:actionPoint(a.position).lerp(actionPoint(b.position),p).toArray(),rotation:travelQ.toArray(),scale:a.scale}),point=[...world[limb.chain.tip].position];point[1]=fromWorld[limb.chain.tip].position[1]+(toWorld[limb.chain.tip].position[1]-fromWorld[limb.chain.tip].position[1])*p;landings.set(key,point);return [...point];};

 function sample(time){if(!Number.isFinite(time))throw Error('Action time must be finite.');const t=Math.max(0,Math.min(duration,time)),progress=Math.max(0,Math.min(1,(t-prepare)/walk)),first=t<prepare,last=t>=prepare+walk,turn=actionSmooth(first?t/prepare:last?(t-prepare-walk)/arrive:1),rotation=first?actionQuat(a.rotation).slerp(travelQ,turn):last?travelQ.clone().slerp(actionQuat(b.rotation),turn):travelQ.clone(),p={position:actionPoint(a.position).lerp(actionPoint(b.position),progress).toArray(),rotation:rotation.toArray(),scale:a.scale};
  if(t===0||t===duration){const pose=structuredClone(t===0?fromPose:toPose),exact=t===0?a:b,world=evaluateRig3D(context.compiled,pose,exact);return{time:t,duration,phase:t===0?'prepare':'complete',rep:null,effort:0,pose,placement:structuredClone(exact),world,contacts:[],diagnostics:[],valid:true,support:{seat:false,feet:['left','right'].map(side=>world[context.limbs[side+'Leg'].chain.tip].position)}};}
  p.position[1]-=Math.min(context.limbs.leftLeg.length,context.limbs.rightLeg.length)*a.scale*.125*(first?turn:last?1-turn:1);
  const stride=progress*steps*Math.PI,acting=first?turn:last?1-turn:1;
  const sway=Math.sin(stride)*.018*a.scale*acting;
  p.position[0]+=Math.cos(heading)*sway;p.position[2]-=Math.sin(heading)*sway;p.position[1]+=Math.sin(stride*2)*.009*a.scale*acting;
  const step=Math.min(steps-1,Math.floor(progress*steps)),u=progress*steps-step,goals=[],basePose={...(first?blendPose(fromPose,{},turn):last?blendPose({},toPose,turn):{}),...rootAt(progress)},baseWorld=evaluateRig3D(context.compiled,basePose,p);
  // Counter-rotation and gaze belong to the rig, before solving planted feet.
  for(const [role,yaw,roll] of [['pelvis',Math.sin(stride)*.035,-Math.sin(stride)*.02],['chest',-Math.sin(stride)*.065,Math.sin(stride)*.024],['head',Math.sin(progress*Math.PI*2)*.24+Math.sin(stride*.29)*.07,Math.sin(stride*.4)*.025]]){
   const id=roles[role],joint=context.compiled.joints.find(j=>j.id===id);if(!joint)continue;
   const parent=joint.parent?baseWorld[joint.parent].rotation:p.rotation,desired=new Quaternion().setFromAxisAngle(actionPoint([0,1,0]),yaw*acting).multiply(actionQuat(baseWorld[id].rotation));
   desired.premultiply(new Quaternion().setFromAxisAngle(actionPoint([Math.cos(heading),0,-Math.sin(heading)]),roll*acting));
   basePose[id]={...basePose[id],rotation:actionQuat(parent).invert().multiply(desired).normalize().toArray()};
   Object.assign(baseWorld,evaluateRig3D(context.compiled,basePose,p));
  }
  for(const[side,index]of[['left',0],['right',1]]){
   const limb=context.limbs[side+'Leg'],pivotU=Math.max(0,Math.min(1,((first?t/prepare:(t-prepare-walk)/arrive)-index*.5)*2)),pivotBlend=actionSmooth(pivotU),pivoting=(first||last)&&pivotU>0&&pivotU<1;
   const swinging=!first&&!last&&step%2===index,previousStep=step-1-((step-1-index)%2+2)%2,previous=previousStep<0?footAt(side,0):footAt(side,previousStep>=steps-2?1:Math.min(1,(previousStep+1.5)/steps)),destination=footAt(side,step>=steps-2?1:Math.min(1,(step+1.5)/steps));
   let target=first?actionPoint(fromWorld[limb.chain.tip].position).lerp(actionPoint(footAt(side,0)),pivotBlend).toArray():last?actionPoint(footAt(side,1)).lerp(actionPoint(toWorld[limb.chain.tip].position),pivotBlend).toArray():swinging?actionPoint(previous).lerp(actionPoint(destination),actionSmooth(u)).toArray():previous;
   if(swinging||pivoting)target[1]+=Math.sin(Math.PI*(pivoting?pivotU:u))**2*.065*a.scale;
   const flat=travelQ.clone().multiply(actionQuat(context.bind[limb.chain.tip].rotation)),footRotation=first?actionQuat(fromWorld[limb.chain.tip].rotation).slerp(flat,pivotBlend):last?flat.slerp(actionQuat(toWorld[limb.chain.tip].rotation),pivotBlend):flat;
   const hip=actionPoint(baseWorld[limb.chain.root].position),forward=actionPoint([0,0,1]).applyQuaternion(rotation);let pole=hip.clone().add(forward.multiplyScalar(limb.length)).add(new Vector3(0,-.1,0));if(first)pole=actionPoint(fromWorld[limb.chain.middle].position).lerp(pole,turn);if(last)pole.lerp(actionPoint(toWorld[limb.chain.middle].position),turn);
   goals.push({id:side+'Leg',target:{position:[...target],rotation:footRotation.toArray()},pole:pole.toArray(),active:!swinging&&!pivoting});
  }
  const actualHeading=Math.atan2(actionPoint([0,0,1]).applyQuaternion(rotation).x,actionPoint([0,0,1]).applyQuaternion(rotation).z),armGoals=nativeRelaxedGoals(context,baseWorld,actualHeading,Math.sin(stride)*.10*a.scale*acting,a.scale);
  for(const goal of armGoals){const limb=context.limbs[goal.id];if(first){goal.target.position=actionPoint(fromWorld[limb.chain.tip].position).lerp(actionPoint(goal.target.position),turn).toArray();goal.pole=actionPoint(fromWorld[limb.chain.middle].position).lerp(actionPoint(goal.pole),turn).toArray();}if(last){goal.target.position=actionPoint(goal.target.position).lerp(actionPoint(toWorld[limb.chain.tip].position),turn).toArray();goal.pole=actionPoint(goal.pole).lerp(actionPoint(toWorld[limb.chain.middle].position),turn).toArray();goal.target.rotation=actionQuat(baseWorld[limb.chain.tip].rotation).slerp(actionQuat(toWorld[limb.chain.tip].rotation),turn).toArray();}}
  const solved=nativeActionSolve(context,basePose,p,[...goals,...armGoals]);return{time:t,duration,phase:first?'prepare':last?'arrive':'walk',rep:null,effort:0,...solved,support:{seat:false,feet:solved.contacts.filter(d=>d.id.endsWith('Leg')).map(d=>d.actual.position)}};
 }
 return{duration,beats,sample};
}

