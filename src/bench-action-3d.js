import {Quaternion,Vector3} from 'three';
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from './rig-3d.js';
import {wristTargetForGrip3D,applyGripPose3D,applySupportPose3D} from './grip-3d.js';
import {relaxedArmGoal} from './arm-pose-3d.js';
import {createBenchScoot3D} from './bench-scoot-3d.js';

const I=[0,0,0,1],clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t,lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const point=p=>new Vector3(...p),quat=q=>new Quaternion(...q);
const turn=(axis,angle)=>new Quaternion().setFromAxisAngle(point(axis),angle);
const length=(a,b)=>point(a).distanceTo(point(b));
const finite=(value,name,min,max)=>{if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${name} must be ${min}..${max}.`);return value;};

/** Kinematic bench choreography in native meters/Y-up coordinates. The bench
 * origin is the floor center; +Z is the foot end. Targets and bone lengths are
 * evaluated in world space. This module applies no physical force or stretch. */
export function createBenchAction3D({rig,roles,grips,bench,settings={}}){
 const sourceRig=structuredClone(rig),sourceRoles=structuredClone(roles??{}),sourceGrips=structuredClone(grips??{});
 const elbowMax=finite(settings.elbowMax??170,'Maximum elbow bend',20,175),kneeMax=finite(settings.kneeMax??170,'Maximum knee bend',20,175);
 for(const key of ['leftArm','rightArm','leftLeg','rightLeg']){const chain=sourceRig.chains[sourceRoles[key]??key];if(chain){chain.bend.max=Math.min(chain.bend.max,(key.endsWith('Arm')?elbowMax:kneeMax)*Math.PI/180);if(chain.bend.min>chain.bend.max)throw new RangeError('Configured maximum bend is below the rig\'s minimum bend.');}}
 const compiled=compileRig3D(sourceRig),bind=evaluateRig3D(compiled);
 const pelvis=sourceRoles.pelvis;if(!bind[pelvis])throw new Error('Bench action needs a semantic pelvis joint.');
 const limbs={};
 for(const [key,fallback]of [['leftArm','leftArm'],['rightArm','rightArm'],['leftLeg','leftLeg'],['rightLeg','rightLeg']]){
  const name=sourceRoles[key]??fallback,chain=compiled.chains[name];
  if(!chain)throw new Error(`Bench action needs the ${key} chain role.`);
  limbs[key]={name,chain,lengths:[length(bind[chain.root].position,bind[chain.middle].position),length(bind[chain.middle].position,bind[chain.tip].position)]};
 }
 // Sparse solves reuse the untouched base pose for independent limb origins.
 // Reject a coupled rig rather than silently reading stale ancestor geometry.
 const jointsById=new Map(compiled.joints.map(j=>[j.id,j]));
 const ancestors=id=>{const ids=[];for(let joint=jointsById.get(id);joint;joint=jointsById.get(joint.parent))ids.push(joint.id);return ids;};
 const limbEntries=Object.entries(limbs);
 for(let i=0;i<limbEntries.length;i++)for(let j=i+1;j<limbEntries.length;j++){
  const [a,first]=limbEntries[i],[b,second]=limbEntries[j],aa=[first.chain.root,first.chain.middle,first.chain.tip],bb=[second.chain.root,second.chain.middle,second.chain.tip];
  if(aa.some(id=>bb.includes(id))||ancestors(first.chain.root).some(id=>bb.includes(id))||ancestors(second.chain.root).some(id=>aa.includes(id)))throw new Error(`Unsupported bench rig: ${a} and ${b} must be independent, disjoint limb chains.`);
 }
 for(const side of ['left','right'])if(sourceGrips[side]){
  const grip=sourceGrips[side],tip=limbs[side+'Arm'].chain.tip;
  if(grip.joint!==tip||[...(grip.fingers??[]),...(grip.supportFingers??[])].some(f=>f.joint===tip||!ancestors(f.joint).includes(tip)))throw new Error(`Unsupported ${side} grip: finger joints must descend from that arm's tip.`);
 }
 const placement={position:[...(bench?.position??[0,0,0])],rotation:[...(bench?.rotation??I)],scale:bench?.scale??1};
 if(placement.position.length!==3||!placement.position.every(Number.isFinite)||placement.rotation.length!==4||!placement.rotation.every(Number.isFinite)||Math.abs(Math.hypot(...placement.rotation)-1)>1e-5)throw new Error('Bench needs a finite position and unit quaternion.');
 finite(placement.scale,'Bench scale',.1,10);
 const bq=quat(placement.rotation),up=point([0,1,0]).applyQuaternion(bq);
 if(up.distanceTo(point([0,1,0]))>1e-6)throw new RangeError('The bench must be level. This action supports bench yaw, not a tilted floor.');
 const size=bench?.size??[.62,.48,1.9];if(size.length!==3||!size.every(v=>Number.isFinite(v)&&v>0))throw new Error('Bench size must be [width, seat-top height, length] in meters.');
 const [width,seat,lengthOfBench]=size.map(v=>v*placement.scale);
 const reps=finite(settings.reps??3,'Repetitions',1,12);if(!Number.isInteger(reps))throw new RangeError('Repetitions must be an integer.');
 const effort=finite(settings.effort??.6,'Effort',0,1),tempo=finite(settings.tempo??1,'Tempo',.25,3),repDuration=finite(settings.repetitionDuration??3.2,'Repetition duration',1.5,8)/tempo;
 const center=bind[pelvis].position,avg=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const arms=[limbs.leftArm,limbs.rightArm],legs=[limbs.leftLeg,limbs.rightLeg];
 const armReach=Math.min(...arms.map(l=>l.lengths[0]+l.lengths[1])),legReach=Math.min(...legs.map(l=>l.lengths[0]+l.lengths[1]));
 const hipOffset=avg(legs.map(l=>bind[l.chain.root].position[1]-center[1]));
 const sole=finite(settings.soleHeight??Math.max(.035,Math.min(.12,avg(legs.map(l=>bind[l.chain.tip].position[1])))),'Ankle floor height',.01,.25);
 const standY=sole+legReach*.96-hipOffset,seatY=seat+Math.min(.105,legReach*.115);
 const shoulderRise=avg(arms.map(l=>bind[l.chain.root].position[1]-center[1]));
 const rackHeight=finite(bench?.rackHeight??1,'Rack height',.5,2),rack=[0,rackHeight*placement.scale,-.5*placement.scale],supineZ=rack[2]+shoulderRise+.07;
 if(seatY+hipOffset-sole>legReach*.94)throw new RangeError('Bench is too high for this rig to keep its feet planted. Lower the seat or choose a taller rig.');
 if(shoulderRise+legReach*.17>lengthOfBench*.69)throw new RangeError('Bench is too short to support this rig reclined. Increase bench length.');
 const endZ=lengthOfBench*.5+.21,sitZ=lengthOfBench*.5-.22,approachDistance=finite(settings.startOffset??Math.max(.8,legReach*1.25),'Approach distance',.2,3),startZ=endZ+approachDistance;
 const stance=Math.max(.09,avg(legs.map(l=>Math.abs(bind[l.chain.root].position[0]-center[0])))*1.1),benchStance=Math.max(stance,width*.5+.24);
 const reclinedFeetZ=supineZ+Math.min(.3,legReach*.28),supineRotation=turn([1,0,0],-Math.PI/2);
 const supineShoulders=arms.map(l=>point(bind[l.chain.root].position).sub(point(center)).applyQuaternion(supineRotation).add(point([0,seatY,supineZ])).toArray());
 const shoulderY=avg(supineShoulders.map(p=>p[1])),barZ=avg(supineShoulders.map(p=>p[2]))+.035,halfGrip=Math.max(.16,avg(supineShoulders.map(p=>Math.abs(p[0])))+.065);
 const upperBarY=shoulderY+armReach*.86,lowerBarY=shoulderY+Math.max(.13,armReach*.24);
 const scootOptions={armReach,legReach,seatY,sole,stance,wideStance:benchStance,tempo};
 const scootBack=createBenchScoot3D({...scootOptions,from:sitZ,to:supineZ,entryFootZ:endZ,exitFootZ:reclinedFeetZ,direction:'back'});
 const scootForward=createBenchScoot3D({...scootOptions,from:supineZ,to:sitZ,entryFootZ:reclinedFeetZ,exitFootZ:endZ,direction:'forward'});
 for(const shoulder of supineShoulders){const target=[Math.sign(shoulder[0])*halfGrip,rack[1],rack[2]];if(length(shoulder,target)>armReach*.99)throw new RangeError('The rack is outside this rig\'s reach. Lower the bench/rack or use a taller rig.');}
 let time=0;const beats=[];const add=(id,label,duration,extra={})=>{const b={id,label,start:time,end:time+duration,...extra};time=b.end;beats.push(b);return b;};
 add('approach','Approach',3/tempo);add('plant','Plant and turn',1.4/tempo);add('sit','Sit',2.2/tempo);add('scoot-back','Scoot into position',scootBack.duration);add('recline','Recline',2.8/tempo);add('grip','Take the bar',2.2/tempo);add('unrack','Lift off the rack',1.2/tempo);
 for(let i=0;i<reps;i++)add('press-'+(i+1),'Press '+(i+1),repDuration*(1+effort*.27*i/Math.max(1,reps-1)),{rep:i+1});
 add('rerack','Return the bar',1.2/tempo);add('release','Release',1.4/tempo);add('sit-up','Sit up',2.4/tempo);add('scoot-forward','Scoot to the edge',scootForward.duration);add('stand','Stand',2.2/tempo);
 const duration=time,byId=Object.fromEntries(beats.map(b=>[b.id,b]));
 const worldPoint=p=>point(p).applyQuaternion(bq).add(point(placement.position)).toArray();
 const worldRotation=q=>bq.clone().multiply(q).normalize().toArray();
 const fraction=(t,id)=>clamp((t-byId[id].start)/(byId[id].end-byId[id].start));

 function sample(rawTime){
  if(!Number.isFinite(rawTime))throw new Error('Bench action time must be finite.');
  const t=clamp(rawTime,0,duration),beat=beats.find(b=>t<b.end)??beats.at(-1),phase=t>=duration?'complete':beat.id.startsWith('press-')?'press':beat.id;
  const sit=smooth(fraction(t,'sit')),recline=smooth(fraction(t,'recline')),sitUp=smooth(fraction(t,'sit-up')),standUp=smooth(fraction(t,'stand'));
  const reclineAmount=recline*(1-sitUp),sitAmount=sit*(1-standUp),plant=smooth(fraction(t,'plant'));
  const backward=phase==='scoot-back',forward=phase==='scoot-forward',scoot=backward?scootBack.sample(t-byId['scoot-back'].start):forward?scootForward.sample(t-byId['scoot-forward'].start):null;
  const stationed=t>=byId['scoot-back'].end&&t<byId['scoot-forward'].start;
  const spreadAmount=scoot?clamp((scoot.feet[0].x-stance)/(benchStance-stance)):stationed?1:0;
  const walk=smooth(fraction(t,'approach')),heading=Math.PI*(1-plant),pitch=scoot?scoot.pitch:-Math.PI/2*reclineAmount;
  const standingZ=mix(startZ,endZ,walk),bodyZ=scoot?scoot.hipZ:stationed?supineZ:mix(standingZ,sitZ,sitAmount),bodyY=scoot?scoot.hipY:mix(standY,seatY,sitAmount);
  const bodyRotation=turn([0,1,0],heading).multiply(turn([1,0,0],pitch)),rotationQ=bq.clone().multiply(bodyRotation);
  const body=[0,bodyY,bodyZ],origin=point(worldPoint(body)).sub(point(center).applyQuaternion(rotationQ));
  const actorPlacement={position:origin.toArray(),rotation:rotationQ.toArray(),scale:1};
  let pose={},world=evaluateRig3D(compiled,pose,actorPlacement);const contacts=[],diagnostics=[];
  const solve=(key,target,pole,active=true)=>{
   const limb=limbs[key],result=solveTwoBone3D(compiled,pose,limb.name,target,{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'});
   pose=result.pose;
   const actual=result.world[limb.chain.tip],diagnostic={id:key,chain:limb.name,active,target:structuredClone(target),actual:structuredClone(actual),...result.diagnostics};
   diagnostics.push(diagnostic);if(active)contacts.push(diagnostic);
  };
  // Six alternating steps keep the stance foot fixed while its partner swings.
  const walking=fraction(t,'approach'),step=Math.min(5,Math.floor(walking*6)),stepT=walking>=1?1:walking*6-step;
  const keys=[[0,0],[.2,0],[.2,.4],[.6,.4],[.6,.8],[1,.8],[1,1]],from=keys[step],to=keys[step+1];
  for(const [index,side]of ['left','right'].entries()){
   const key=side+'Leg',limb=limbs[key],sign=Math.sign(bind[limb.chain.root].position[0]-center[0])|| (index===0?1:-1);
   const moving=from[index]!==to[index]&&walking<1,footProgress=mix(from[index],to[index],smooth(stepT));
   const pivot=clamp((fraction(t,'plant')-(index===0?0:.35))/.65),footHeading=Math.PI*(1-smooth(pivot)),pivoting=pivot>0&&pivot<1;
   const walkZ=mix(startZ,endZ,footProgress),turnX=Math.cos(footHeading)*sign*stance,turnZ=-Math.sin(footHeading)*sign*stance;
   const baseFoot=[turnX,sole+(moving?Math.sin(Math.PI*stepT)*Math.min(.075,legReach*.085):0)+(pivoting?Math.sin(Math.PI*pivot)*.045:0),walkZ+turnZ];
   // Sit keeps both feet planted. Scoots reset them one at a time between
   // pushes; recline and sit-up retain the final support positions.
   const foot=scoot?[sign*scoot.feet[index].x,scoot.feet[index].y,scoot.feet[index].z]:stationed?[sign*benchStance,sole,reclinedFeetZ]:baseFoot;
   const hip=point(world[limb.chain.root].position).sub(point(placement.position)).applyQuaternion(bq.clone().invert()).toArray();
   const pole=lerp([hip[0]+Math.sin(heading)*legReach*1.5,hip[1]-.12,hip[2]+Math.cos(heading)*legReach*1.5],[sign*(width*.5+legReach),hip[1]+.18,hip[2]+legReach*.3],spreadAmount);
   solve(key,{position:worldPoint(foot),rotation:worldRotation(turn([0,1,0],footHeading).multiply(quat(bind[limb.chain.tip].rotation)))},pole,scoot?scoot.feet[index].active:!moving&&!pivoting);
  }
  const unrack=smooth(fraction(t,'unrack'))*(1-smooth(fraction(t,'rerack')));
  let barY=mix(rack[1],upperBarY,unrack),barPositionZ=mix(rack[2],barZ,unrack),barX=0;
  if(phase==='press'){
   const u=clamp((t-beat.start)/(beat.end-beat.start)),load=(beat.rep-1)/Math.max(1,reps-1),down=.37,upEnd=.92;
   const amount=u<down?smooth(u/down):1-smooth((u-down)/(upEnd-down));
   barY=mix(upperBarY,lowerBarY,amount);
   const envelope=Math.sin(Math.PI*clamp((u-down)/(upEnd-down)))**2;
   barY+=Math.sin(t*23)*.0018*effort*load*envelope;barX=Math.sin(t*17)*.0015*effort*load*envelope;
  }
  const bar={position:worldPoint([barX,barY,barPositionZ]),rotation:placement.rotation.slice(),scale:1,length:Math.max(1.15,halfGrip*2+.6)};
  const reach=smooth(fraction(t,'grip'))*(1-smooth(fraction(t,'release'))),held=t>=byId.grip.end&&t<byId.release.start;
  for(const [index,side]of ['left','right'].entries()){
   const limb=limbs[side+'Arm'],sign=Math.sign(bind[limb.chain.root].position[0]-center[0])||(index===0?1:-1);
   const shoulder=point(world[limb.chain.root].position).sub(point(placement.position)).applyQuaternion(bq.clone().invert()).toArray(),armLength=limb.lengths[0]+limb.lengths[1];
   const swing=t<byId.approach.end?Math.sin(walking*Math.PI*6+(index===0?0:Math.PI))*.075*Math.sin(Math.PI*walking):0;
   const relaxed=relaxedArmGoal({shoulder,sign,length:armLength,heading,swing});
   const restStanding=relaxed.hand;
   // Seated hands rest above the thighs. Letting the standing fingers hang
   // beside the hips would put them inside the cushion before a scoot starts.
   const lap=[sign*Math.abs(bind[limb.chain.root].position[0]-center[0])*.85,bodyY+.18,bodyZ+.2];
   const belly=[sign*(halfGrip-.015),seatY+.15,supineZ-.05],rest=lerp(lerp(restStanding,lap,sitAmount),belly,reclineAmount);
   const grip=sourceGrips[side],contactFrame={position:worldPoint([barX+sign*halfGrip,barY,barPositionZ]),rotation:placement.rotation.slice()};
   const gripTarget=grip?wristTargetForGrip3D(grip,contactFrame):contactFrame;
   const hand=lerp(worldPoint(rest),gripTarget.position,reach),pole=lerp(relaxed.pole,[shoulder[0]+sign*armLength,shoulder[1]-.2,shoulder[2]+armLength*.45],reclineAmount);
   const gripQ=sourceRoles.gripRotations?.[side]??bind[limb.chain.tip].rotation;
   const target={position:hand};
   if(scoot){
    const support=[sign*Math.min(width*.5-.035,Math.abs(bind[limb.chain.root].position[0]-center[0])+.05),seat+(grip?.supportHeight??.034)+.001+scoot.handLift,scoot.handZ];
    target.position=lerp(target.position,worldPoint(support),scoot.handBlend);
    target.position[1]+=.055*Math.sin(Math.PI*scoot.handBlend)**2;
    const supportPole=[shoulder[0]+sign*.12,shoulder[1]-.15,shoulder[2]-.6];
    for(let i=0;i<3;i++)pole[i]=mix(pole[i],supportPole[i],scoot.handBlend);
    if(grip&&scoot.handBlend>0){const free=solveTwoBone3D(compiled,pose,limb.name,{position:target.position},{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'}),supportQ=bq.clone().multiply(turn([1,0,0],Math.PI)).multiply(quat(grip.rotation).invert());target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(supportQ,scoot.handBlend).toArray();}
   }
   if(reach>0){const free=solveTwoBone3D(compiled,pose,limb.name,target,{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'});target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(quat(grip?gripTarget.rotation:worldRotation(quat(gripQ))),reach).toArray();}
   solve(side+'Arm',target,pole,held||!!scoot?.handActive);
   if(grip)pose=applyGripPose3D(sourceRig,pose,grip,smooth((reach-.78)/.22));
   if(grip&&scoot)pose=applySupportPose3D(sourceRig,pose,grip,scoot.handBlend);
  }
  world=evaluateRig3D(compiled,pose,actorPlacement);
  // Re-measure from the final pose, rather than retaining intermediate solves.
  for(const d of diagnostics){const limb=limbs[d.id];d.actual=structuredClone(world[limb.chain.tip]);d.error=length(d.actual.position,d.target.position);if(d.status==='solved'&&d.error>1e-6)d.status='conflict';}
  const scootFrame=scoot?{active:true,direction:scoot.direction,cycle:scoot.cycle,stage:scoot.stage,progress:scoot.progress,seatLift:scoot.seatLift,handTargets:diagnostics.filter(d=>d.id.endsWith('Arm')).map(d=>d.target.position),footTargets:diagnostics.filter(d=>d.id.endsWith('Leg')).map(d=>d.target.position)}:null;
  return {time:t,duration,phase,rep:beat.rep??null,effort,pose,placement:actorPlacement,world,bar,contacts,diagnostics,scoot:scootFrame,valid:diagnostics.every(d=>d.status==='solved'),support:{seat:(reclineAmount>0||sitAmount>.99)&&!(scoot?.seatLift>1e-6),feet:contacts.filter(c=>c.id.endsWith('Leg')).map(c=>c.actual.position)}};
 }
 function interrupt(at){
  const t=clamp(at,0,duration);if(!Number.isFinite(at))throw new Error('Interruption time must be finite.');
  if(t<byId.grip.start)return {supported:false,reason:'No weight has been taken yet. Pause this preparation and reposition before starting another action.'};
  const beat=beats.find(b=>t<b.end)??beats.at(-1);
  const follow=beat.id==='grip'?byId.release.start:beat.id==='unrack'||beat.id.startsWith('press-')?byId.rerack.start:null;
  const first=follow===null?duration-t:beat.end-t,remaining=first+(follow===null?0:duration-follow);
  return {supported:true,duration:remaining,sample(elapsed){if(!Number.isFinite(elapsed))throw new Error('Recovery time must be finite.');const e=clamp(elapsed,0,remaining);return sample(e>=remaining?duration:e<=first?t+e:follow+e-first);}};
 }
 return {duration,beats:structuredClone(beats),sample,interrupt,measurements:{armReach,legReach,seatY,standY,halfGrip,soleHeight:sole,rackPosition:worldPoint(rack)},settings:{reps,effort,tempo,repDuration,elbowMax,kneeMax},bench:structuredClone({...placement,size,rackHeight})};
}
