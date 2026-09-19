import {Quaternion,Vector3} from 'three';
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from './rig-3d.js';
import {wristTargetForGrip3D,applyGripPose3D,applySupportPose3D} from './grip-3d.js';
import {relaxedArmGoal} from './arm-pose-3d.js';
import {createBenchScoot3D} from './bench-scoot-3d.js';
import {DEFAULT_BENCH_SIZE_3D} from './bench-geometry-3d.js';
import {sampleSeatTransfer3D} from './seat-transfer-3d.js';

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
 const size=bench?.size??DEFAULT_BENCH_SIZE_3D;if(size.length!==3||!size.every(v=>Number.isFinite(v)&&v>0))throw new Error('Bench size must be [width, seat-top height, length] in meters.');
 const [width,seat,lengthOfBench]=size.map(v=>v*placement.scale);
 const reps=finite(settings.reps??3,'Repetitions',1,12);if(!Number.isInteger(reps))throw new RangeError('Repetitions must be an integer.');
 const effort=finite(settings.effort??.6,'Effort',0,1),tempo=finite(settings.tempo??1,'Tempo',.25,3),repDuration=finite(settings.repetitionDuration??3.2,'Repetition duration',1.5,8)/tempo;
 const entryStyle=settings.entryStyle??'center';if(!['center','side-reach'].includes(entryStyle))throw new RangeError('Bench entry style must be center or side-reach.');
 const center=bind[pelvis].position,avg=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const arms=[limbs.leftArm,limbs.rightArm],legs=[limbs.leftLeg,limbs.rightLeg];
 const armReach=Math.min(...arms.map(l=>l.lengths[0]+l.lengths[1])),legReach=Math.min(...legs.map(l=>l.lengths[0]+l.lengths[1]));
 const hipOffset=avg(legs.map(l=>bind[l.chain.root].position[1]-center[1]));
 const sole=finite(settings.soleHeight??Math.max(.035,Math.min(.12,avg(legs.map(l=>bind[l.chain.tip].position[1])))),'Ankle floor height',.01,.25);
 const standY=sole+legReach*.96-hipOffset,reclinedY=seat+Math.min(.115,legReach*.125),seatY=seat+Math.min(.17,legReach*.18);
 const shoulderRise=avg(arms.map(l=>bind[l.chain.root].position[1]-center[1]));
 const rackHeight=finite(bench?.rackHeight??1,'Rack height',.5,2),rack=[0,rackHeight*placement.scale,-.5*placement.scale],supineZ=rack[2]+shoulderRise+.07;
 if(seatY+hipOffset-sole>legReach*.94)throw new RangeError('Bench is too high for this rig to keep its feet planted. Lower the seat or choose a taller rig.');
 if(shoulderRise+legReach*.17>lengthOfBench*.69)throw new RangeError('Bench is too short to support this rig reclined. Increase bench length.');
 const endZ=lengthOfBench*.5+.10,sitZ=lengthOfBench*.5-.22,approachDistance=finite(settings.startOffset??Math.max(.8,legReach*1.25),'Approach distance',.2,3),startZ=endZ+approachDistance;
 const stance=Math.max(.13,avg(legs.map(l=>Math.abs(bind[l.chain.root].position[0]-center[0])))*1.15),benchStance=Math.max(stance,width*.5+.17);
 const reclinedFeetZ=supineZ+Math.min(.3,legReach*.28),supineRotation=turn([1,0,0],-Math.PI/2);
 const supineShoulders=arms.map(l=>point(bind[l.chain.root].position).sub(point(center)).applyQuaternion(supineRotation).add(point([0,reclinedY,supineZ])).toArray());
 const shoulderY=avg(supineShoulders.map(p=>p[1])),barZ=avg(supineShoulders.map(p=>p[2]))+.035,halfGrip=Math.max(.16,avg(supineShoulders.map(p=>Math.abs(p[0])))+.065);
 const upperBarY=shoulderY+armReach*.86,lowerBarY=shoulderY+Math.max(.13,armReach*.24);
 // Sit up footward of the racked bar, then move underneath it while flat.
 // The reverse shift clears the head before any upward rotation on exit.
 const clearanceDistance=Math.max(.25,legReach*.34),clearanceZ=supineZ+clearanceDistance;
 const scootOptions={armReach,legReach,seatY,sole,stance,wideStance:benchStance,tempo};
 const scootBack=createBenchScoot3D({...scootOptions,from:sitZ,to:clearanceZ,entryFootZ:endZ,exitFootZ:reclinedFeetZ+clearanceDistance,direction:'back'});
 const scootForward=createBenchScoot3D({...scootOptions,from:clearanceZ,to:sitZ,entryFootZ:reclinedFeetZ+clearanceDistance,exitFootZ:endZ,direction:'forward'});
 for(const shoulder of supineShoulders){const target=[Math.sign(shoulder[0])*halfGrip,rack[1],rack[2]];if(length(shoulder,target)>armReach*.99)throw new RangeError('The rack is outside this rig\'s reach. Lower the bench/rack or use a taller rig.');}
 let time=0;const beats=[];const add=(id,label,duration,extra={})=>{const b={id,label,start:time,end:time+duration,...extra};time=b.end;beats.push(b);return b;};
 add('approach','Approach',3/tempo);add('plant','Plant and turn',1.4/tempo);add('sit','Sit',1.8/tempo);add('scoot-back','Scoot into position',scootBack.duration);add('recline','Recline',4.8/tempo);add('grip','Take the bar',2.2/tempo);add('unrack','Lift off the rack',1.2/tempo);
 for(let i=0;i<reps;i++)add('press-'+(i+1),'Press '+(i+1),repDuration*(1+effort*.48*i/Math.max(1,reps-1))*[1,.96,1.06,.98][i%4],{rep:i+1});
 add('rerack','Return the bar',1.2/tempo);add('release','Release',1.4/tempo);add('sit-up','Sit up',4.8/tempo);add('scoot-forward','Scoot to the edge',scootForward.duration);add('stand','Stand',1.9/tempo);
 const duration=time,byId=Object.fromEntries(beats.map(b=>[b.id,b]));
 const worldPoint=p=>point(p).applyQuaternion(bq).add(point(placement.position)).toArray();
 const worldRotation=q=>bq.clone().multiply(q).normalize().toArray();
 const fraction=(t,id)=>clamp((t-byId[id].start)/(byId[id].end-byId[id].start));

 function sample(rawTime){
  if(!Number.isFinite(rawTime))throw new Error('Bench action time must be finite.');
  const t=clamp(rawTime,0,duration),beat=beats.find(b=>t<b.end)??beats.at(-1),phase=t>=duration?'complete':beat.id.startsWith('press-')?'press':beat.id;
  const rawTransfer=phase==='sit'?1-fraction(t,'sit'):fraction(t,'stand'),transferU=rawTransfer<.70?rawTransfer*.84/.70:.84+(rawTransfer-.70)*.16/.30;
  const transfer=phase==='sit'||phase==='stand'?sampleSeatTransfer3D(transferU,{seatY,standY,sitZ,footZ:endZ}):null;
  const sit=phase==='sit'?1-transfer.rise:smooth(fraction(t,'sit')),recline=smooth(fraction(t,'recline')),sitUp=smooth(fraction(t,'sit-up')),standUp=phase==='stand'?transfer.rise:smooth(fraction(t,'stand'));
  const reclining=phase==='recline'||phase==='sit-up',riseU=phase==='sit-up'?fraction(t,'sit-up'):1-fraction(t,'recline');
  const clearShift=reclining?smooth((riseU-.28)/.2):0,clearRise=reclining?smooth((riseU-.68)/.32):0;
  // Brace, lift, reset each foot, shift, settle, release, then curl upward.
  // The reverse parameter drives reclining through the same support path.
  const bridge=reclining?{handBlend:smooth(riseU/.11)*(1-smooth((riseU-.56)/.12)),lift:.035*smooth((riseU-.08)/.04)*(1-smooth((riseU-.48)/.08))}:null;
  const reclineAmount=reclining?1-clearRise:recline*(1-sitUp),sitAmount=sit*(1-standUp),plant=smooth(fraction(t,'plant'));
  const backward=phase==='scoot-back',forward=phase==='scoot-forward',scoot=backward?scootBack.sample(t-byId['scoot-back'].start):forward?scootForward.sample(t-byId['scoot-forward'].start):null;
  const stationed=t>=byId['scoot-back'].end&&t<byId['scoot-forward'].start;
  const spreadAmount=scoot?1:stationed?1:transfer?1-smooth((transferU-.84)/.15):0;
  const walk=smooth(fraction(t,'approach')),heading=Math.PI*(1-plant),pitch=scoot?scoot.pitch:transfer?transfer.pitch:-Math.PI/2*reclineAmount;
  const standingZ=mix(startZ,endZ,walk),bodyZ=scoot?scoot.hipZ:transfer?transfer.hipZ:stationed?supineZ+(reclining?clearanceDistance*clearShift:0):mix(standingZ,sitZ,sitAmount),bodyY=scoot?scoot.hipY:transfer?transfer.hipY:mix(mix(standY,seatY,sitAmount),reclinedY,reclineAmount)+(bridge?.lift??0)-(phase==='approach'?.014*Math.sin(Math.PI*fraction(t,'approach'))**2:0);
  const bodyRotation=turn([0,1,0],heading).multiply(turn([1,0,0],pitch)),rotationQ=bq.clone().multiply(bodyRotation);
  const body=[0,bodyY,bodyZ],origin=point(worldPoint(body)).sub(point(center).applyQuaternion(rotationQ));
  const actorPlacement={position:origin.toArray(),rotation:rotationQ.toArray(),scale:1};
  let pose={},world=evaluateRig3D(compiled,pose,actorPlacement);const contacts=[],diagnostics=[];
  // Lead the sit-up with the upper body instead of rotating a rigid plank.
  // Apply the bend in the bench frame so imported bone axes need no guesses.
  const curl=reclining?Math.sin(Math.PI*clearRise)**2:0;
  const spineBends=scoot?[['torso',12],['chest',8],['head',-6]]:[['torso',9],['chest',9],['head',7]],bendAmount=scoot?clamp(scoot.pitch/(42*Math.PI/180)):curl;
  if(bendAmount>0)for(const [role,degrees]of spineBends){
   const id=sourceRoles[role],joint=jointsById.get(id);if(!joint||id===pelvis)continue;
   const parent=joint.parent?quat(world[joint.parent].rotation):quat(actorPlacement.rotation),delta=bq.clone().multiply(turn([1,0,0],degrees*Math.PI/180*bendAmount)).multiply(bq.clone().invert());
   pose[id]={rotation:parent.clone().invert().multiply(delta).multiply(parent).multiply(quat(joint.rotation)).normalize().toArray()};world=evaluateRig3D(compiled,pose,actorPlacement);
  }
  // Reach across while settling back, then square the shoulders before the
  // supported clearance shift. The pelvis stays on its proven support path.
  const entryU=phase==='recline'?fraction(t,'recline'):0;
  const entryLean=entryStyle==='side-reach'?smooth(entryU/.15)*(1-smooth((entryU-.23)/.13)):0;
  if(entryLean>0)for(const role of ['torso','chest']){
   const id=sourceRoles[role],joint=jointsById.get(id);if(!joint||id===pelvis)continue;
   const parent=joint.parent?quat(world[joint.parent].rotation):quat(actorPlacement.rotation);
   const delta=bq.clone().multiply(turn([0,0,1],-.045*entryLean)).multiply(bq.clone().invert());
   pose[id]={rotation:parent.clone().invert().multiply(delta).multiply(parent).multiply(quat(pose[id]?.rotation??joint.rotation)).normalize().toArray()};world=evaluateRig3D(compiled,pose,actorPlacement);
  }
  const solve=(key,target,pole,active=true)=>{
   const limb=limbs[key],result=solveTwoBone3D(compiled,pose,limb.name,target,{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'});
   pose=result.pose;
   const actual=result.world[limb.chain.tip],diagnostic={id:key,chain:limb.name,active,target:structuredClone(target),actual:structuredClone(actual),...result.diagnostics};
   diagnostics.push(diagnostic);if(active)contacts.push(diagnostic);
  };
  // Four purposeful steps keep the stance foot fixed while its partner swings.
  const walking=fraction(t,'approach'),step=Math.min(3,Math.floor(walking*4)),stepT=walking>=1?1:walking*4-step;
  const keys=[[0,0],[1/3,0],[1/3,2/3],[1,2/3],[1,1]],from=keys[step],to=keys[step+1];
  for(const [index,side]of ['left','right'].entries()){
   const key=side+'Leg',limb=limbs[key],sign=Math.sign(bind[limb.chain.root].position[0]-center[0])|| (index===0?1:-1);
   const moving=from[index]!==to[index]&&walking<1,footProgress=mix(from[index],to[index],smooth(stepT));
   const pivot=clamp((fraction(t,'plant')-(index===0?0:.35))/.65),footHeading=Math.PI*(1-smooth(pivot)),pivoting=pivot>0&&pivot<1;
   const walkZ=mix(startZ,endZ,footProgress),turnX=Math.cos(footHeading)*sign*stance,turnZ=-Math.sin(footHeading)*sign*stance;
   const baseFoot=[turnX,sole+(moving?Math.sin(Math.PI*stepT)*Math.min(.075,legReach*.085):0)+(pivoting?Math.sin(Math.PI*pivot)*.045:0),walkZ+turnZ];
   // Sit keeps both feet planted. Scoots reset them one at a time between
   // pushes. Reclined clearance transfers reset them before the hip shift.
   const resetU=clamp((transferU-.84-index*.075)/.075),reset=smooth(resetU);
   const clearStep=reclining?clamp((riseU-.12-index*.06)/.06):0;
   const foot=scoot?[sign*scoot.feet[index].x,scoot.feet[index].y,scoot.feet[index].z]:transfer?[sign*mix(benchStance,stance,reset),sole+.035*Math.sin(Math.PI*resetU)**2,endZ]:stationed?[sign*benchStance,sole+(reclining?.03*Math.sin(Math.PI*clearStep)**2:0),reclinedFeetZ+(reclining?clearanceDistance*smooth(clearStep):0)]:baseFoot;
   const hip=point(world[limb.chain.root].position).sub(point(placement.position)).applyQuaternion(bq.clone().invert()).toArray();
   const pole=lerp([hip[0]+Math.sin(heading)*legReach*1.5,hip[1]-.12,hip[2]+Math.cos(heading)*legReach*1.5],[sign*(width*.5+.38),hip[1]+.03,hip[2]+legReach],spreadAmount);
   solve(key,{position:worldPoint(foot),rotation:worldRotation(turn([0,1,0],footHeading).multiply(quat(bind[limb.chain.tip].rotation)))},pole,scoot?scoot.feet[index].active:transfer?resetU===0||resetU===1:reclining?clearStep===0||clearStep===1:!moving&&!pivoting);
  }
  const unrack=smooth(fraction(t,'unrack'))*(1-smooth(fraction(t,'rerack')));
  let barY=mix(rack[1],upperBarY,unrack),barPositionZ=mix(rack[2],barZ,unrack),barX=0,barTilt=0;
  let exertion={intensity:0,breath:0,laggingSide:null,sticking:false};
  if(phase==='press'){
   const u=clamp((t-beat.start)/(beat.end-beat.start)),load=(beat.rep-1)/Math.max(1,reps-1),down=.34,upEnd=.95;
   const ascent=clamp((u-down)/(upEnd-down)),strain=effort*(.45+.55*load);
   // A slow sticking region is followed by a committed lockout. The uneven
   // side acts on the rigid bar, so both palms retain a real shared grip.
   const grind=ascent<.27?.22*smooth(ascent/.27):ascent<.57?.22+.08*smooth((ascent-.27)/.30):.30+.70*smooth((ascent-.57)/.43);
   const raised=mix(smooth(ascent),grind,strain),amount=u<down?smooth(u/down):1-raised;
   const envelope=Math.sin(Math.PI*ascent)**2;
   barY=mix(upperBarY,lowerBarY,amount);
   barTilt=(beat.rep%2?1:-1)*.065*strain*envelope;
   barY+=Math.sin(t*23)*.004*strain*envelope;barX=Math.sin(t*17)*.003*strain*envelope;
   exertion={intensity:strain*envelope,breath:envelope,laggingSide:barTilt>0?'right':barTilt<0?'left':null,sticking:ascent>.27&&ascent<.57&&strain>.3};
  }
  const localBarQ=turn([0,0,1],barTilt);
  const bar={position:worldPoint([barX,barY,barPositionZ]),rotation:worldRotation(localBarQ),scale:1,length:Math.max(1.15,halfGrip*2+.6)};
  const reach=smooth(fraction(t,'grip'))*(1-smooth(fraction(t,'release'))),held=t>=byId.grip.end&&t<byId.release.start;
  if(transfer||scoot)world=evaluateRig3D(compiled,pose,actorPlacement);
  for(const [index,side]of ['left','right'].entries()){
   const limb=limbs[side+'Arm'],sign=Math.sign(bind[limb.chain.root].position[0]-center[0])||(index===0?1:-1);
   const shoulder=point(world[limb.chain.root].position).sub(point(placement.position)).applyQuaternion(bq.clone().invert()).toArray(),armLength=limb.lengths[0]+limb.lengths[1];
   const swing=t<byId.approach.end?Math.sin(walking*Math.PI*4+(index===0?0:Math.PI))*.075*Math.sin(Math.PI*walking):0;
   const relaxed=relaxedArmGoal({shoulder,sign,length:armLength,heading,swing});
   const restStanding=relaxed.hand;
   // Seated hands rest above the thighs. Letting the standing fingers hang
   // beside the hips would put them inside the cushion before a scoot starts.
   const lap=[sign*Math.abs(bind[limb.chain.root].position[0]-center[0])*.85,bodyY+.18,bodyZ+.2];
   const armSeated=transfer?1-transfer.armRelease:sitAmount;
   const belly=[sign*(halfGrip-.015),reclinedY+.15+(bridge?.lift??0),supineZ+(reclining?clearanceDistance*clearShift:0)-.05],rest=lerp(lerp(restStanding,lap,armSeated),belly,reclineAmount);
   const gripOffset=point([sign*halfGrip,0,0]).applyQuaternion(localBarQ);
   const grip=sourceGrips[side],contactFrame={position:worldPoint([barX+gripOffset.x,barY+gripOffset.y,barPositionZ]),rotation:bar.rotation.slice()};
   const gripTarget=grip?wristTargetForGrip3D(grip,contactFrame):contactFrame;
   const seatedPole=[shoulder[0]+sign*armLength*.55,shoulder[1]-armLength*.65,shoulder[2]+.04];
   const earlyReach=entryStyle==='side-reach'&&index===0?smooth((entryU-.04)/.20)*(1-smooth((entryU-.23)/.20)):0;
   const shoulderWorld=world[limb.chain.root].position;
   const earlyTarget=point(gripTarget.position).sub(point(shoulderWorld)).clampLength(0,armLength*.92).add(point(shoulderWorld)).toArray();
   const hand=lerp(lerp(worldPoint(rest),earlyTarget,earlyReach),gripTarget.position,reach),pole=lerp(lerp(relaxed.pole,seatedPole,armSeated),[shoulder[0]+sign*armLength,shoulder[1]-.2,shoulder[2]+armLength*.45],reclineAmount);
   const gripQ=sourceRoles.gripRotations?.[side]??bind[limb.chain.tip].rotation;
   const target={position:hand};
   if(transfer?.brace>0){
    const leg=limbs[side+'Leg'],local=p=>point(p).sub(point(placement.position)).applyQuaternion(bq.clone().invert());
    const hip=local(world[leg.chain.root].position),knee=local(world[leg.chain.middle].position),slope=Math.atan2(hip.y-knee.y,knee.z-hip.z);
    const normal=point([0,Math.cos(slope),Math.sin(slope)]),thigh=hip.clone().lerp(knee,.42).addScaledVector(normal,legReach*.10+(grip?.supportHeight??.034));
    target.position=lerp(target.position,worldPoint(thigh.toArray()),transfer.brace);
    if(grip){const free=solveTwoBone3D(compiled,pose,limb.name,{position:target.position},{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'}),braceQ=bq.clone().multiply(turn([1,0,0],Math.PI+slope)).multiply(quat(grip.rotation).invert());target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(braceQ,transfer.brace).toArray();}
   }
   if(bridge?.handBlend>0){
    const support=[sign*Math.min(width*.5-.035,Math.abs(bind[limb.chain.root].position[0]-center[0])),seat+(grip?.supportHeight??.034)+.001,supineZ-.03];
    target.position=lerp(target.position,worldPoint(support),bridge.handBlend);
    target.position[1]+=.06*Math.sin(Math.PI*bridge.handBlend)**2;
    if(grip){const free=solveTwoBone3D(compiled,pose,limb.name,{position:target.position},{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'}),supportQ=bq.clone().multiply(turn([1,0,0],Math.PI)).multiply(quat(grip.rotation).invert());target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(supportQ,bridge.handBlend).toArray();}
   }
   if(scoot){
    // The feet drive this push. Rest palms on the moving thighs instead of
    // inventing a fixed bench brace that short arms cannot reach upright.
    const leg=limbs[side+'Leg'],local=p=>point(p).sub(point(placement.position)).applyQuaternion(bq.clone().invert());
    const hip=local(world[leg.chain.root].position),knee=local(world[leg.chain.middle].position),slope=Math.atan2(hip.y-knee.y,knee.z-hip.z);
    const normal=point([0,Math.cos(slope),Math.sin(slope)]),thigh=hip.clone().lerp(knee,.52).addScaledVector(normal,legReach*.10+(grip?.supportHeight??.034));
    target.position=lerp(target.position,worldPoint(thigh.toArray()),scoot.handBlend);
    if(grip){const free=solveTwoBone3D(compiled,pose,limb.name,{position:target.position},{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'}),braceQ=bq.clone().multiply(turn([1,0,0],Math.PI+slope)).multiply(quat(grip.rotation).invert());target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(braceQ,scoot.handBlend).toArray();}
   }
   if(reach>0){const free=solveTwoBone3D(compiled,pose,limb.name,target,{placement:actorPlacement,poleWorld:worldPoint(pole),world:'chain'});target.rotation=quat(free.world[limb.chain.tip].rotation).slerp(quat(grip?gripTarget.rotation:worldRotation(quat(gripQ))),reach).toArray();}
   solve(side+'Arm',target,pole,held||!!scoot?.handActive||bridge?.handBlend===1);
   if(grip)pose=applyGripPose3D(sourceRig,pose,grip,smooth((reach-.78)/.22));
   if(grip&&bridge)pose=applySupportPose3D(sourceRig,pose,grip,bridge.handBlend);
   if(grip&&transfer)pose=applySupportPose3D(sourceRig,pose,grip,transfer.brace);
   if(grip&&scoot)pose=applySupportPose3D(sourceRig,pose,grip,scoot.handBlend);
  }
  world=evaluateRig3D(compiled,pose,actorPlacement);
  // Re-measure from the final pose, rather than retaining intermediate solves.
  for(const d of diagnostics){const limb=limbs[d.id];d.actual=structuredClone(world[limb.chain.tip]);d.error=length(d.actual.position,d.target.position);if(d.status==='solved'&&d.error>1e-6)d.status='conflict';}
  const scootFrame=scoot?{active:true,propulsion:scoot.propulsion,direction:scoot.direction,cycle:scoot.cycle,stage:scoot.stage,progress:scoot.progress,seatLift:scoot.seatLift,handTargets:diagnostics.filter(d=>d.id.endsWith('Arm')).map(d=>d.target.position),footTargets:diagnostics.filter(d=>d.id.endsWith('Leg')).map(d=>d.target.position)}:null;
  return {time:t,duration,phase,rep:beat.rep??null,effort,exertion,pose,placement:actorPlacement,world,bar,contacts,diagnostics,scoot:scootFrame,clearance:bridge?{progress:riseU,shift:clearanceDistance*clearShift,rise:clearRise,seatLift:bridge.lift,handBlend:bridge.handBlend}:null,transfer:transfer?{stage:transfer.stage,rise:transfer.rise,pitch:transfer.pitch}:null,valid:diagnostics.every(d=>d.status==='solved'),support:{seat:(reclineAmount>0||sitAmount>.999999)&&!(scoot?.seatLift>1e-6)&&!(bridge?.lift>1e-6),feet:contacts.filter(c=>c.id.endsWith('Leg')).map(c=>c.actual.position)}};
 }
 function interrupt(at){
  const t=clamp(at,0,duration);if(!Number.isFinite(at))throw new Error('Interruption time must be finite.');
  if(t<byId.grip.start)return {supported:false,reason:'No weight has been taken yet. Pause this preparation and reposition before starting another action.'};
  const beat=beats.find(b=>t<b.end)??beats.at(-1);
  const follow=beat.id==='grip'?byId.release.start:beat.id==='unrack'||beat.id.startsWith('press-')?byId.rerack.start:null;
  const first=follow===null?duration-t:beat.end-t,remaining=first+(follow===null?0:duration-follow);
  return {supported:true,duration:remaining,sample(elapsed){if(!Number.isFinite(elapsed))throw new Error('Recovery time must be finite.');const e=clamp(elapsed,0,remaining);return sample(e>=remaining?duration:e<=first?t+e:follow+e-first);}};
 }
 return {duration,beats:structuredClone(beats),sample,interrupt,measurements:{armReach,legReach,seatY,standY,halfGrip,soleHeight:sole,rackPosition:worldPoint(rack)},settings:{reps,effort,tempo,repDuration,elbowMax,kneeMax,entryStyle},bench:structuredClone({...placement,size,rackHeight})};
}
