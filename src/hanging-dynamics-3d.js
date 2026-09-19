const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Reduced articulated hanging dynamics. Angles are rotations about the loaded
 * grip. Gravity acts on the displaced centre of mass; posture muscles supply
 * bounded restoring torque. Fixed steps and cached states make seeks repeatable.
 * This is a suspended-body model, not a general collision ragdoll. */
export function createHangingDynamics3D({duration,driver,gravity=9.81,step=1/120,initial={}}){
 if(!Number.isFinite(duration)||duration<=0||duration>600||!Number.isFinite(gravity)||Math.abs(gravity)>30||!Number.isFinite(step)||step<1/1000||step>1/30||typeof driver!=='function'||Math.ceil(duration/step)>100000)throw Error('Invalid hanging dynamics configuration.');
 const pair=(value,name,predicate=()=>true)=>{if(!Array.isArray(value)||value.length!==2||!value.every(v=>Number.isFinite(v)&&predicate(v)))throw Error('Invalid hanging '+name+'.');return value;};
 for(const name of ['angle','velocity','legAngle','legVelocity','armAngle','armVelocity'])pair(initial[name]??[0,0],'initial '+name);
 function checkedDriver(time){const d=driver(time);if(!d||typeof d!=='object'||!Number.isFinite(d.length)||d.length<=0||d.legLength!==undefined&&(!Number.isFinite(d.legLength)||d.legLength<=0)||d.armLength!==undefined&&(!Number.isFinite(d.armLength)||d.armLength<=0)||d.activation!==undefined&&(!Number.isFinite(d.activation)||d.activation<0||d.activation>1)||d.maxMuscleTorque!==undefined&&(!Number.isFinite(d.maxMuscleTorque)||d.maxMuscleTorque<0))throw Error('Invalid hanging driver dimensions or activation.');pair(d.offset??[0,0],'offset');pair(d.stiffness??[0,0],'stiffness',v=>v>=0);pair(d.damping??[.8,.8],'damping',v=>v>=0);pair(d.limits??[.42,.16],'limits',v=>v>0&&v<=Math.PI);return d;}
 const zero=()=>[0,0],states=[{angle:[...(initial.angle??zero())],velocity:[...(initial.velocity??zero())],legAngle:[...(initial.legAngle??zero())],legVelocity:[...(initial.legVelocity??zero())],armAngle:[...(initial.armAngle??zero())],armVelocity:[...(initial.armVelocity??zero())],gravityTorque:zero(),muscleTorque:zero(),dampingTorque:zero()}];
 const copy=s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,[...v]]));
 function advance(i){
  const previous=states[i-1],s=copy(previous),d=checkedDriver((i-.5)*step),length=Math.max(.25,d.length),legLength=Math.max(.2,d.legLength??.8),armLength=Math.max(.15,d.armLength??.55),active=clamp(d.activation??1,0,1);
  for(let axis=0;axis<2;axis++){
   const theta=s.angle[axis],omega=s.velocity[axis],offset=(d.offset??zero())[axis],muscle=(d.stiffness??[0,0])[axis],damping=(d.damping??[.8,.8])[axis];
   s.gravityTorque[axis]=gravity/length*(offset/length*Math.cos(theta)-Math.sin(theta))*active;
   s.muscleTorque[axis]=clamp(-muscle*theta,-(d.maxMuscleTorque??5),d.maxMuscleTorque??5);
   s.dampingTorque[axis]=-damping*omega;
   const acceleration=s.gravityTorque[axis]+s.muscleTorque[axis]+s.dampingTorque[axis];
   s.velocity[axis]+=acceleration*step;s.angle[axis]+=s.velocity[axis]*step;
   const limit=(d.limits??[.42,.16])[axis];if(Math.abs(s.angle[axis])>limit){s.angle[axis]=Math.sign(s.angle[axis])*limit;if(s.velocity[axis]*s.angle[axis]>0)s.velocity[axis]*=-.12;}
   // A passive lower-body link is accelerated by the torso above it. It keeps
   // moving after the catch and pulls back toward vertical under gravity.
   const hipAcceleration=clamp(acceleration*length,-12,12);
   const armAcceleration=-gravity/armLength*Math.sin(s.armAngle[axis])-hipAcceleration/armLength*Math.cos(s.armAngle[axis])-1.4*s.armVelocity[axis];
   s.armVelocity[axis]+=armAcceleration*step;s.armAngle[axis]+=s.armVelocity[axis]*step;
   if(Math.abs(s.armAngle[axis])>.6){s.armAngle[axis]=Math.sign(s.armAngle[axis])*.6;s.armVelocity[axis]*=.2;}
   const legAcceleration=-gravity/legLength*Math.sin(s.legAngle[axis])-hipAcceleration/legLength*Math.cos(s.legAngle[axis])-1.6*s.legVelocity[axis];
   s.legVelocity[axis]+=legAcceleration*step;s.legAngle[axis]+=s.legVelocity[axis]*step;
   if(Math.abs(s.legAngle[axis])>.4){s.legAngle[axis]=Math.sign(s.legAngle[axis])*.4;s.legVelocity[axis]*=.2;}
  }
  states.push(s);
 }
 return {sample(time){if(!Number.isFinite(time))throw Error('Hanging time must be finite.');const at=clamp(time,0,duration)/step,lo=Math.floor(at),hi=Math.ceil(at);while(states.length<=hi)advance(states.length);const a=states[lo],b=states[hi],u=at-lo;return Object.fromEntries(Object.keys(a).map(k=>[k,a[k].map((v,j)=>v+(b[k][j]-v)*u)]));}};
}
