import {gymBenchTargets,gymSceneDepths} from './gym-room.js';

const target=gymBenchTargets(),rad=Math.PI/180,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,q)=>a+(b-a)*q;
const point=(a,b,q)=>({x:mix(a.x,b.x,q),y:mix(a.y,b.y,q)}),rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const roll=target.bodyRotation,backLength=Math.hypot(target.back.x-target.hips.x,target.back.y-target.hips.y);
const braces={left:{x:663,y:338},right:{x:675,y:333}};
const matrix=(a,b)=>{a*=rad;b*=rad;const c=Math.cos(a),s=Math.sin(a),cy=Math.cos(b),sy=Math.sin(b);return [c*cy,-s,c*sy,s*cy,c,s*sy,-sy,0,cy];};
const multiply=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
// Sweep the knee around the hip-to-ankle axis instead of switching IK branches.
function plantedLeg(pose,name,hip,foot,degrees){
 const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.max(.001,Math.hypot(dx,dy)),height=Math.sqrt(Math.max(0,36**2-d*d/4)),theta=degrees*rad,z=Math.min(21.6,height*Math.sin(theta)),across=Math.sign(Math.cos(theta))*Math.sqrt(Math.max(0,height*height-z*z)),elbow=[dx/2+dy/d*across,dy/2-dx/d*across,z];
 const upper=Math.atan2(elbow[1],elbow[0])/rad,yaw=-Math.asin(Math.max(-1,Math.min(1,z/36)))/rad,m=matrix(upper,yaw),remaining=[dx-elbow[0],dy-elbow[1],-z],local=[m[0]*remaining[0]+m[3]*remaining[1]+m[6]*remaining[2],m[1]*remaining[0]+m[4]*remaining[1]+m[7]*remaining[2],m[2]*remaining[0]+m[5]*remaining[1]+m[8]*remaining[2]],lower=Math.atan2(local[1],local[0])/rad,lowerYaw=-Math.asin(Math.max(-1,Math.min(1,local[2]/36)))/rad,lm=matrix(lower,lowerYaw),axis=multiply(m,[lm[0],lm[3],lm[6]]),cross=multiply(m,[lm[1],lm[4],lm[7]]);
 let wrist=Math.atan2(-axis[1],cross[1]);if(axis[0]*Math.cos(wrist)+cross[0]*Math.sin(wrist)<0)wrist+=Math.PI;
 Object.assign(pose,{[name+'Thigh.rotation']:upper,[name+'Thigh.yaw']:yaw,[name+'Calf.rotation']:lower,[name+'Calf.yaw']:lowerYaw,[name+'Foot.rotation']:((wrist/rad+540)%360)-180});
}

/** A reversible stand / step / sit / brace / recline / grasp construction.
 * Ground and palm targets are world points; rotations are solved afterwards.
 * The press itself is deliberately left to the ordinary exercise sampler. */
export function gymBenchTransitionTargets(time){
 const t=((time%60)+60)%60;if(t<36||t>52.5||(t>41&&t<48))return null;
 const s=t<=41?t-36:t<=49?5-(t-48):t<=51?4-(t-49):2-(t-51)*2/1.5;
 const sitting=smooth(s/2),reclining=smooth((s-2)/2),reaching=smooth(s-4),turn=smooth(s/.9),angle=mix(0,roll,reclining),yaw=60*turn;
 const root=point({x:710,y:300},target.sit,sitting);Object.assign(root,point(root,target.hips,reclining));
 const feet={};for(const [name,side,start]of [['left',-1,0],['right',1,.9]]){const step=clamp((s-start)/.9),q=smooth(step);feet[name]=point({x:710+side*18,y:383},target.feet[name],q);feet[name].y-=7*Math.sin(Math.PI*step);feet[name].planted=step===0||step===1;}
 const hips={},shoulders={},hands={},length=mix(48,backLength,reclining),torso=rotate({x:0,y:-length},angle*rad);
 for(const [name,side]of [['left',-1],['right',1]]){
  hips[name]=point({x:side*16*Math.cos(yaw*rad),y:12},{x:24*Math.cos((roll+90)*rad),y:24*Math.sin((roll+90)*rad)-side*9},reclining);
  const finalLocal=rotate({x:target.shoulders[name].x-target.back.x,y:target.shoulders[name].y-target.back.y},-roll*rad),local=point({x:side*34*Math.cos(yaw*rad),y:-20},finalLocal,reclining),offset=rotate(local,angle*rad);
  shoulders[name]={x:torso.x+offset.x,y:torso.y+offset.y};
 }
 // The support leg can reach the next floor position before the seat takes weight.
 root.y=Math.max(root.y,...Object.entries(feet).map(([name,p])=>p.y-hips[name].y-Math.sqrt(Math.max(1,71.94**2-(p.x-root.x-hips[name].x)**2))));
 for(const [name,side]of [['left',-1],['right',1]]){
  const rest={x:root.x+side*40*Math.cos(yaw*rad),y:root.y+11},brace=braces[name],grip=target.bar[name];
  hands[name]=point(point(rest,brace,smooth(s-1)),grip,reaching);
 }
 return {s,root,torso,hips,shoulders,hands,feet,angle,yaw,sitting,reclining,reaching,braces};
}

/** Mutates only transition pose channels. Call before face-offset evaluation. */
export function applyGymBenchTransition(pose,time,{solve,limbDepth,orientFoot}){
 const q=gymBenchTransitionTargets(time);if(!q)return pose;
 // Exact external boundaries retain the established walking/press joins.
 if(q.s<=1e-9||q.s>=5-1e-9)return pose;
 const {root,torso}=q;pose['root.x']=root.x;pose['root.y']=root.y;pose['floor-depth.y']=(gymSceneDepths.bench-383)*q.sitting;
 pose['torso.x']=torso.x;pose['torso.y']=48+torso.y;pose['torso.rotation']=q.angle;pose['torso.yaw']=q.yaw;pose['pelvis.rotation']=q.angle;pose['pelvis.yaw']=q.yaw;
 pose['head.rotation']=20*q.reclining;pose['head.yaw']=-12*q.reclining;pose['head.pitch']=0;
 for(const [name,side]of [['left',-1],['right',1]]){
  const shoulder=q.shoulders[name],hand={x:q.hands[name].x-root.x,y:q.hands[name].y-root.y},arm=solve(shoulder,hand,40,side<0?-1:1);
  pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=shoulder.y+68;pose[name+'Upper.z']=side<0?mix(15,-1,q.reclining):15;
  pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;pose[name+'Hand.z']=12;
  limbDepth(pose,name,false,mix(82,15,smooth(q.s/1.7))*(1-q.reaching));
  const hip=q.hips[name],foot={x:q.feet[name].x-root.x,y:q.feet[name].y-root.y};
  pose[name+'Thigh.x']=hip.x-side*16;pose[name+'Thigh.y']=hip.y-12;
  plantedLeg(pose,name,hip,foot,mix(side<0?105:75,30,q.sitting));pose[name+'Foot.yaw']=0;pose[name+'Foot.pitch']=0;
  orientFoot?.(pose,name,{rotation:0,yaw:0,pitch:0});
 }
 pose['barbell.x']=target.bar.x-root.x;pose['barbell.y']=target.bar.y-root.y;pose['barbell.rotation']=target.bar.rotation;pose['pullbar.x']=180-root.x;pose['pullbar.y']=150-root.y;
 return pose;
}
