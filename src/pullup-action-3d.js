import {Quaternion,Vector3} from 'three';
import {evaluateRig3D} from './rig-3d.js';
import {wristTargetForGrip3D,applyGripPose3D} from './grip-3d.js';
import {nativeActionContext,nativeActionSolve,nativeRelaxedGoals,actionPoint,actionQuat,actionSmooth} from './locomotion-action-3d.js';
export function createPullupAction3D({rig,roles,grips={},bar,settings={}}){
 const context=nativeActionContext(rig,roles),position=bar?.position,rotation=bar?.rotation??[0,0,0,1],width=bar?.width??1.1;if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Array.isArray(rotation)||rotation.length!==4||!rotation.every(Number.isFinite)||Math.abs(Math.hypot(...rotation)-1)>1e-5||!Number.isFinite(width)||width<.3||width>3)throw Error('Pull-up needs a finite bar position, upright unit rotation and width .3..3m.');
 const q=actionQuat(rotation);if(actionPoint([0,1,0]).applyQuaternion(q).distanceTo(actionPoint([0,1,0]))>1e-6)throw Error('Pull-up bar must be level.');
 const reps=settings.reps??5,effort=settings.effort??.5,tempo=settings.tempo??1,failedRep=settings.failedRep??null,floorY=settings.floorY??0;if(!Number.isInteger(reps)||reps<1||reps>20||!Number.isFinite(effort)||effort<0||effort>1||!Number.isFinite(tempo)||tempo<.25||tempo>3||failedRep!==null&&(!Number.isInteger(failedRep)||failedRep<1||failedRep>reps)||!Number.isFinite(floorY))throw Error('Invalid pull-up repetitions, effort, tempo, failure, or floor height.');
 const variation=settings.variation??'balanced',restBetweenReps=settings.restBetweenReps??effort>.65;if(!['balanced','left-lead','right-lead'].includes(variation)||typeof restBetweenReps!=='boolean')throw Error('Invalid pull-up variation or rest setting.');const lead=variation==='right-lead'?'right':'left',other=lead==='left'?'right':'left';
 const heading=Math.atan2(actionPoint([0,0,1]).applyQuaternion(q).x,actionPoint([0,0,1]).applyQuaternion(q).z),back=-.23,localOrigin=actionPoint([0,0,back]).applyQuaternion(q).add(actionPoint([position[0],floorY,position[2]])),standingPlacement={position:localOrigin.toArray(),rotation:[...rotation],scale:1},standingWorld=evaluateRig3D(context.compiled,{},standingPlacement),standing=nativeActionSolve(context,{},standingPlacement,nativeRelaxedGoals(context,standingWorld,heading)),standingPose=standing.pose;
 const halfGrip=Math.max(...['left','right'].map(side=>Math.abs(context.bind[context.limbs[side+'Arm'].chain.root].position[0]-context.bind[roles.pelvis].position[0])))+.06;if(halfGrip>width/2-.035)throw Error('Pull-up bar is too narrow for this rig shoulder span.');
 const contactQ=q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2)),targets={},contacts={};let hangHeight=Infinity,topHeight=Infinity;
 for(const[side,sign]of[['left',1],['right',-1]]){const limb=context.limbs[side+'Arm'],contact={position:actionPoint([sign*halfGrip,0,0]).applyQuaternion(q).add(actionPoint(position)).toArray(),rotation:contactQ.toArray()};contacts[side]=contact;const target=grips[side]?wristTargetForGrip3D(grips[side],contact):contact;targets[side]=target;const shoulder=standing.world[limb.chain.root].position,dx=target.position[0]-shoulder[0],dz=target.position[2]-shoulder[2],reach=limb.length*.945,horizontal=dx*dx+dz*dz;if(horizontal>=reach*reach)throw Error('Pull-up grip lies outside this rig arm reach.');hangHeight=Math.min(hangHeight,target.position[1]-shoulder[1]-Math.sqrt(reach*reach-horizontal));topHeight=Math.min(topHeight,target.position[1]-shoulder[1]-.04);}
 if(hangHeight<.035||hangHeight>.5)throw Error('Pull-up bar requires a jump outside the supported .035..0.5m range.');if(topHeight<=hangHeight+.08)throw Error('Pull-up bar does not allow a complete bent-elbow repetition.');
 let clock=0;const beats=[],add=(id,label,duration,extra={})=>{beats.push({id,label,start:clock,end:clock+duration,...extra});clock+=duration;};
 add('ready','Breathe before the jump',(.45+effort*.45)/tempo);
 add('jump-grip','Jump and take the bar',.7/tempo);
 if(variation!=='balanced'){add('one-hand-entry','Hang from the first hand',.75/tempo,{side:lead});add('second-grip','Reach with the other hand',.6/tempo,{side:lead});}
 add('hang','Settle into the grip',.3/tempo);
 const count=Math.min(reps,failedRep??reps);
 for(let rep=1;rep<=count;rep++){
  const load=rep===failedRep?Math.max(.88,effort):effort*(.55+.45*(rep-1)/Math.max(1,reps-1));
  add('pull-'+rep,rep===failedRep?'Struggle, stall and lower':'Pull-up',2.4*(1+load*.45+Math.sin(rep*2.3)*.09)/tempo,{rep,failed:rep===failedRep,load});
  if(restBetweenReps&&rep<count&&rep>=Math.ceil(count/2)){
   const side=rep%2?lead:other;add('rest-release-'+rep,'Release one hand to rest',.45/tempo,{side});add('one-hand-rest-'+rep,'Recover on one arm',(.65+effort*.65)/tempo,{side});add('regrip-'+rep,'Take the bar again',.55/tempo,{side});
  }
 }
 if(variation!=='balanced'){add('release-hand','Let go with one hand',.45/tempo,{side:other});add('one-hand-exit','Pause before dropping',.6/tempo,{side:other});}
 add('release','Release the bar',.25/tempo);add('land','Land softly',.55/tempo);add('finish','Stand',.25/tempo);const duration=clock;
 function sample(time){
  if(!Number.isFinite(time))throw Error('Action time must be finite.');
  const t=Math.max(0,Math.min(duration,time)),beat=beats.find(b=>t<b.end)??beats.at(-1),u=Math.max(0,Math.min(1,(t-beat.start)/(beat.end-beat.start))),phase=t===duration?'complete':beat.id.startsWith('pull-')?(beat.failed?'attempt-failed':'pull-up'):beat.id.replace(/-\d+$/,'');
  let height=0,pull=0,lean=0,asymmetry=0;const grip={left:0,right:0},f=actionSmooth(u),hanging=['hang','pull-up','attempt-failed','one-hand-entry','second-grip','rest-release','one-hand-rest','regrip','release-hand','one-hand-exit','release'].includes(phase);
  if(hanging){height=hangHeight;grip.left=grip.right=1;}
  if(phase==='jump-grip'){height=hangHeight*f+.045*Math.sin(Math.PI*u)**2;grip[lead]=f;grip[other]=variation==='balanced'?f:0;}
  const supportSide=beat.side??(phase==='jump-grip'?lead:phase==='release'?other:null);
  let single=0;
  if(['one-hand-entry','one-hand-rest','one-hand-exit'].includes(phase))single=1;
  if(['second-grip','regrip'].includes(phase))single=1-f;
  if(['rest-release','release-hand'].includes(phase))single=f;
  if(phase==='jump-grip'&&variation!=='balanced')single=f;
  if(phase==='release'&&variation!=='balanced')single=1;
  if(supportSide&&single>0){grip[supportSide==='left'?'right':'left']*=1-single;lean=(supportSide==='left'?1:-1)*.14*single;}
  let strain=0,breath=.2+.18*effort;
  if(phase==='pull-up'||phase==='attempt-failed'){
   // Three effort stages: initial drive, a slow sticking point, then the last push.
   // Both grips stay on the bar; asymmetric effort moves the shoulders and elbows.
   const load=beat.load,riseEnd=.47+load*.1,holdEnd=riseEnd+.09+load*.025;
   const rise=u<.22?actionSmooth(u/.22)*.64:u<riseEnd?.64+.36*actionSmooth((u-.22)/(riseEnd-.22)):1;
   const descent=1-actionSmooth((u-holdEnd)/(1-holdEnd));pull=rise*descent*(beat.failed?.60:1);
   const envelope=Math.sin(Math.PI*u)**2,stall=Math.sin(Math.PI*Math.max(0,Math.min(1,(u-.22)/(riseEnd-.22))))**2;
   const tremble=(Math.sin(u*Math.PI*22)+.4*Math.sin(u*Math.PI*37))*.008*load*envelope*(.3+.7*stall);
   height=hangHeight+(topHeight-hangHeight)*pull+tremble;
   asymmetry=(beat.rep%2?1:-1)*(.015+load*.04)*envelope;lean=asymmetry;
   strain=(.25+.75*load)*envelope;breath=.3+strain*.7;
  }
  if(phase==='release'){grip.left*=1-f;grip.right*=1-f;lean*=1-f;height=hangHeight*(1-.2*f);}
  if(phase==='land')height=hangHeight*.8*(1-f)-.035*Math.sin(Math.PI*u)**2;
  // Roll around the shoulder line, so the pelvis hangs toward the supporting hand.
  // The original shoulder span and bone lengths are retained throughout the transfer.
  const pivotY=(standing.world[context.limbs.leftArm.chain.root].position[1]+standing.world[context.limbs.rightArm.chain.root].position[1])/2-floorY;
  const roll=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),lean),rot=q.clone().multiply(roll),offset=actionPoint([0,pivotY,0]).sub(actionPoint([0,pivotY,0]).applyQuaternion(roll)).applyQuaternion(q);
  const placement={...standingPlacement,position:actionPoint(standingPlacement.position).add(offset).add(new Vector3(0,height,0)).toArray(),rotation:rot.toArray()},world=evaluateRig3D(context.compiled,{},placement),goals=[];
  for(const side of ['left','right']){
   const limb=context.limbs[side+'Leg'],hip=actionPoint(world[limb.chain.root].position),foot=actionPoint(standing.world[limb.chain.tip].position).sub(actionPoint(standingPlacement.position)).applyQuaternion(q.clone().invert()).applyQuaternion(roll).applyQuaternion(q).add(actionPoint(placement.position)).toArray(),ground=height<=.005;
   const ankleRotation=rot.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.36*actionSmooth(Math.max(0,height)/hangHeight))).multiply(q.clone().invert()).multiply(actionQuat(standing.world[limb.chain.tip].rotation)).toArray();
   goals.push({id:side+'Leg',target:{position:foot,rotation:ankleRotation},pole:hip.add(actionPoint([0,-.1,limb.length]).applyQuaternion(rot)).toArray(),active:ground});
  }
  const relaxed=nativeRelaxedGoals(context,world,heading);
  for(const goal of relaxed){
   const side=goal.id.startsWith('left')?'left':'right',limb=context.limbs[goal.id],target=targets[side],weight=grip[side];goal.target.position=actionPoint(goal.target.position).lerp(actionPoint(target.position),weight).toArray();
   goal.target.rotation=rot.clone().multiply(q.clone().invert()).multiply(actionQuat(standing.world[limb.chain.tip].rotation)).slerp(actionQuat(target.rotation),weight).toArray();
   const shoulder=actionPoint(world[limb.chain.root].position),sign=side==='left'?1:-1,barPole=shoulder.add(actionPoint([sign*limb.length,-.15,.2+asymmetry*sign*2]).applyQuaternion(q));goal.pole=actionPoint(goal.pole).lerp(barPole,weight).toArray();goal.active=weight>=1-1e-8;goals.push(goal);
  }
  let solved=nativeActionSolve(context,{},placement,goals);for(const side of ['left','right'])if(grips[side])solved.pose=applyGripPose3D(context.rig,solved.pose,grips[side],grip[side]);solved.world=evaluateRig3D(context.compiled,solved.pose,placement);
  if(t===0||t===duration){solved.pose=structuredClone(standingPose);solved.placement=structuredClone(standingPlacement);solved.world=evaluateRig3D(context.compiled,solved.pose,standingPlacement);}
  return{time:t,duration,phase,rep:beat.rep??null,effort,...solved,apparatus:{type:'pullup-bar',position:[...position],rotation:[...rotation],width},outcome:beat.rep?{success:!beat.failed}:null,hang:single>0?{side:supportSide,lean}:null,exertion:{intensity:strain,breath,asymmetry,left:Math.max(0,strain+asymmetry),right:Math.max(0,strain-asymmetry)},support:{seat:false,feet:solved.contacts.filter(d=>d.id.endsWith('Leg')).map(d=>d.actual.position)}};
 }
 return{duration,beats,sample,standingPlacement,standingPose,measurements:{hangHeight,topHeight,halfGrip,gripTargets:targets}};
}
