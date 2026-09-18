import {clamp,wrapAngle} from '../src/index.js';
import {addGymPreparation} from './gym-preparation.js';
import {configureGymRoom,gymBenchTargets,gymRoomStations} from './gym-room.js';
import {installGymIdleActions} from './gym-idle-actions.js';
import {addGymTurnaround,applyGymFacing} from './gym-turnaround.js';
const rad=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},mix=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}),between=(t,a,b)=>ease((t-a)/(b-a));
export const gymModes=['workout','full-set','fail-six','fail-seven'];
export const gymTiming={round:60,preparation:0,reach:4,grab:6,pullEnd:24,release:25,recover:26.5,walkToBench:29,sit:36,lieDown:38,grasp:40,benchStart:41,benchEnd:48,rack:48,sitUp:49,stand:51,returnStart:52.5,home:59,repDurations:[1.65,1.8,1.95,2.1,2.3,2.5,2.7,3]};
export const gymBeats=[{id:'preparation',label:'Prepare and grip',start:0,end:6},{id:'pullups',label:'Pull-up set',start:6,end:24},{id:'failure',label:'Final effort',start:18.3,end:24},{id:'recovery',label:'Release and catch breath',start:24,end:29},{id:'walkout',label:'Walk to bench',start:29,end:36},{id:'benchsetup',label:'Sit, recline and grip',start:36,end:41},{id:'bench',label:'Bench press',start:41,end:49},{id:'standup',label:'Sit up and stand',start:49,end:52.5},{id:'walkback',label:'Walk back',start:52.5,end:60}];
const repEnds=gymTiming.repDurations.reduce((a,v)=>(a.push((a.at(-1)||6)+v),a),[]),roundOutcomes=[8,6,7];
const phaseRanges=[['preparation',0,4,'preparing'],['grab',4,6,'grabbing bar'],['pull-ups',6,24,'pull-ups'],['hold',24,25,'hanging and recovering'],['dismount',25,26.5,'stepping down'],['recover',26.5,29,'catching breath'],['walk',29,36,'walking to bench'],['sit',36,38,'sitting on bench'],['recline',38,40,'lying back'],['grasp',40,41,'setting grip'],['bench',41,48,'bench press'],['rack',48,49,'racking weight'],['sit-up',49,51,'sitting up'],['stand',51,52.5,'standing up'],['return',52.5,59,'walking to pull-up bar'],['settle',59,60,'recovering']];
export function gymPhase(time,mode='workout'){
 const cycle=Math.floor(Math.max(0,time)/60),t=((time%60)+60)%60,outcome=mode==='fail-six'?6:mode==='fail-seven'?7:mode==='full-set'?8:roundOutcomes[cycle%3],completed=repEnds.slice(0,outcome).filter(end=>t>=end-1e-7).length,failing=outcome<8&&t>=repEnds[outcome-1]&&t<24,range=phaseRanges.find(r=>t>=r[1]&&t<r[2]);
 return {cycle,outcome,completed,rep:t>=6&&t<24?Math.min(completed+1,outcome+1):0,failed:outcome<8&&t>=24,phaseKey:failing?'failed-attempt':range[0],phase:failing?'last rep stalls':range[3],start:failing?repEnds[outcome-1]:range[1],end:range[2],benchReps:[43.05,45.35,48].filter(end=>t>=end-1e-7).length};
}
function solve(shoulder,target,length,bend=1){const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,length*2-.06),end={x:shoulder.x+dx/d*reach,y:shoulder.y+dy/d*reach},height=Math.sqrt(Math.max(0,length*length-reach*reach/4)),elbow={x:(shoulder.x+end.x)/2-dy/d*height*bend,y:(shoulder.y+end.y)/2+dx/d*height*bend},upper=Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x)/rad,lower=Math.atan2(end.y-elbow.y,end.x-elbow.x)/rad;return {upper,lower:((lower-upper+540)%360)-180,wrist:((540-lower)%360)-180,end};}
// Swivel a bent chain toward the viewer while preserving its screen-space
// endpoint. This authors ordinary joint yaw/rotation tracks, not a render trick.
function limbMatrix(rotation,yaw=0){const a=rotation*rad,b=yaw*rad,c=Math.cos(a),s=Math.sin(a),cy=Math.cos(b),sy=Math.sin(b);return [c*cy,-s,c*sy,s*cy,c,s*sy,-sy,0,cy];}
const matrixVector=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
function limbDepth(pose,name,leg,swivel){
 const upper=name+(leg?'Thigh':'Upper'),lower=name+(leg?'Calf':'Lower'),end=name+(leg?'Foot':'Hand'),side=name==='left'?-1:1,L=leg?36:40;
 const origin={x:side*(leg?16:34)+(pose[upper+'.x']||0),y:(leg?12:-68)+(pose[upper+'.y']||0)},target=jointEndpoint(pose,side,leg),dx=target.x-origin.x,dy=target.y-origin.y,d=Math.max(.001,Math.hypot(dx,dy)),height=Math.sqrt(Math.max(0,L*L-d*d/4)),branch=Math.sign(Math.sin((pose[lower+'.rotation']||0)*rad))||1,angle=Math.min(swivel*rad,Math.asin(clamp(L*.6/Math.max(.001,height),0,1)));
 const elbow=[dx/2+dy/d*height*branch*Math.cos(angle),dy/2-dx/d*height*branch*Math.cos(angle),height*Math.sin(angle)],u=Math.atan2(elbow[1],elbow[0])/rad,y=-Math.asin(clamp(elbow[2]/L,-1,1))/rad,m=limbMatrix(u,y),v=[dx-elbow[0],dy-elbow[1],-elbow[2]],local=[m[0]*v[0]+m[3]*v[1]+m[6]*v[2],m[1]*v[0]+m[4]*v[1]+m[7]*v[2],m[2]*v[0]+m[5]*v[1]+m[8]*v[2]],r=Math.atan2(local[1],local[0])/rad,ly=-Math.asin(clamp(local[2]/L,-1,1))/rad,lm=limbMatrix(r,ly),axis=matrixVector(m,[lm[0],lm[3],lm[6]]),cross=matrixVector(m,[lm[1],lm[4],lm[7]]);
 let wrist=Math.atan2(-axis[1],cross[1]);if(axis[0]*Math.cos(wrist)+cross[0]*Math.sin(wrist)<0)wrist+=Math.PI;
 pose[upper+'.rotation']=u;pose[upper+'.yaw']=y;pose[lower+'.rotation']=r;pose[lower+'.yaw']=ly;pose[end+'.rotation']=((wrist/rad+540)%360)-180;
}
const benchTargets=gymBenchTargets(),bar={x:180,y:150,grip:43},bench={x:benchTargets.hips.x,y:benchTargets.hips.y,barX:benchTargets.bar.x,barY:benchTargets.bar.y,grip:25};
// Alternate world-space support anchors. Only the swinging foot moves; its
// partner remains planted while the pelvis passes over it.
export function gymWalk(time,start,end,from,to,options={}){
 const a=typeof from==='number'?{x:from,y:383}:from,b=typeof to==='number'?{x:to,y:383}:to,duration=end-start,age=clamp(time-start,0,duration),distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(4,Math.round(distance/26/2)*2),dt=duration/steps;
 const progress=v=>{const q=clamp(v/duration,0,1),r=.06,k=1/(1-r);return q<r?k*q*q/(2*r):q>1-r?1-k*(1-q)**2/(2*r):k*(q-r/2);};
 const via=options.via||{x:(a.x+b.x)/2,y:(a.y+b.y)/2-38},at=v=>{const q=progress(v),arc=4*q*(1-q);return {x:lerp(a.x,b.x,q)+(via.x-(a.x+b.x)/2)*arc,y:lerp(a.y,b.y,q)+(via.y-(a.y+b.y)/2)*arc};};
 const root=at(age),before=at(Math.max(0,age-.04)),after=at(Math.min(duration,age+.04)),heading=Math.atan2(after.x-before.x,after.y-before.y)/rad,blend=between(age,0,dt)*(1-between(age,duration-dt,duration)),yaw=heading*blend,spread=Math.cos(yaw*rad),feet={};
 for(const [name,side,parity]of [['left',-1,0],['right',1,1]]){
  let last=parity;while(last+2<steps&&(last+2)*dt<=age)last+=2;
  const q=clamp((age-last*dt)/(dt*.78),0,1),previous=last<2?{x:a.x+side*18,y:a.y}:{...at((last-1)*dt),x:at((last-1)*dt).x+side*5},target=last>=steps-2?{x:b.x+side*18,y:b.y}:{...at((last+1)*dt),x:at((last+1)*dt).x+side*5};
  feet[name]=age<last*dt?{x:a.x+side*18,y:a.y,planted:true,rotation:0}:{x:lerp(previous.x,target.x,ease(q)),y:lerp(previous.y,target.y,ease(q))-12*Math.sin(Math.PI*q),planted:q>=1,rotation:-Math.sign(b.x-a.x||1)*16*Math.sin(Math.PI*q)};
 }
 const supportY=Math.max(...Object.entries(feet).map(([name,foot])=>foot.y-12-Math.sqrt(Math.max(1,71.8**2-(foot.x-root.x-(name==='left'?-1:1)*lerp(16,5,blend)*spread)**2))));
 return {x:root.x,y:Math.max(root.y-83,supportY),floorY:root.y,blend,direction:Math.sign(b.x-a.x||1),yaw,feet};
}
export function gymTravelPose(time,duration,from,to,options={}){
 const pose={...gymPose(0,'full-set')},w=gymWalk(time,0,duration,from,to,options),heading=w.yaw,across=Math.cos(heading*rad),depth=Math.sin(heading*rad);
 pose['root.x']=w.x;pose['root.y']=w.y;pose['torso.yaw']=heading;pose['pelvis.yaw']=heading;pose['head.yaw']=0;
 for(const [name,side]of [['left',-1],['right',1]]){
  const shoulder={x:side*34*across,y:-68},stride=clamp((w.feet[name].x-w.x)/32,-1,1),target={x:shoulder.x-stride*21,y:6-Math.abs(stride)*5},arm=solve(shoulder,target,40,side<0?-1:1);
  pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=0;pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;pose[name+'Upper.z']=-side*depth*30+4;pose[name+'Hand.z']=0;
  limbDepth(pose,name,false,70);
  const hip={x:side*lerp(16,5,w.blend)*across,y:12},foot={x:w.feet[name].x-w.x,y:w.feet[name].y-w.y},leg=solve(hip,foot,36,w.direction>0?-1:1);
  pose[name+'Thigh.x']=hip.x-side*16;pose[name+'Thigh.y']=0;pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Thigh.yaw']=0;pose[name+'Calf.yaw']=0;pose[name+'Thigh.z']=-side*depth*14;
  limbDepth(pose,name,true,35);pose[name+'Foot.rotation']=wrapAngle(pose[name+'Foot.rotation']+(w.feet[name].rotation||0));pose[name+'Foot.yaw']=heading;pose[name+'Foot.pitch']=-12*Math.abs(Math.sin((time/duration)*Math.PI*20));
 }
 pose['barbell.x']=bench.barX-w.x;pose['barbell.y']=bench.barY-w.y;pose['pullbar.x']=bar.x-w.x;pose['pullbar.y']=bar.y-w.y;
 return pose;
}
export function gymPose(time,mode='workout'){
 const phase=((time%60)+60)%60;if(phase>=29&&phase<36)return gymTravelPose(phase-29,7,{x:180,y:383},{x:710,y:383});if(phase>=52.5&&phase<59)return gymTravelPose(phase-52.5,6.5,{x:710,y:383},{x:180,y:383});
 const t=phase,{outcome}=gymPhase(time,mode),pose={},walking=t>=29&&t<36?gymWalk(t,29,36,180,710):t>=52.5&&t<59?gymWalk(t,52.5,59,710,180):null;
 const sit=between(t,36,38)*(1-between(t,51,52.5)),lying=between(t,38,40)*(1-between(t,49,51)),hang=between(t,4.6,6)*(1-between(t,25,26.5));
 let x=walking?.x??(t>=36&&t<52.5?lerp(710,lerp(benchTargets.sit.x,benchTargets.hips.x,lying),sit):180),y=walking?.y??300,lift=0,effort=0,shake=0;
 if(t>=6&&t<24){const index=repEnds.findIndex(end=>t<end),start=index?repEnds[index-1]:6,duration=gymTiming.repDurations[index];if(index<outcome){const q=(t-start)/duration;lift=q<.52?ease(q/.52):q<.62?1:1-ease((q-.62)/.38);effort=lift*(.55+index*.065);shake=index>4?Math.sin(t*22)*.6*lift:0;}else{const start=repEnds[outcome-1],q=(t-start)/(24-start),up=ease(q/.28),down=1-ease((q-.76)/.24);lift=.56*up*down;effort=up*down;shake=Math.sin(t*28)*1.5*up*down;}}
 y-=4*hang+70*lift+shake;y=lerp(y,benchTargets.sit.y,sit);y=lerp(y,benchTargets.hips.y,lying);
 const tired=(outcome<8?1:.45)*between(t,25,26.5)*(1-between(t,28.3,29)),anticipation=(outcome<8?.7:.3)*Math.sin(Math.PI*clamp(t/4,0,1))**2,breath=Math.sin(t*3.2)*1.3*(tired+anticipation);
 const benchRoll=Math.atan2(benchTargets.back.x-benchTargets.hips.x,benchTargets.hips.y-benchTargets.back.y)/rad,reclineAngle=-lying*benchRoll*rad,torsoLength=lerp(48,Math.hypot(benchTargets.back.x-benchTargets.hips.x,benchTargets.back.y-benchTargets.hips.y),lying),torsoX=-torsoLength*Math.sin(reclineAngle),torsoY=48-torsoLength*Math.cos(reclineAngle);
 pose['root.x']=x;pose['root.y']=y;pose['pelvis.z']=30;pose['torso.x']=torsoX;pose['torso.y']=torsoY+breath;pose['torso.rotation']=benchRoll*lying-15*tired-7*anticipation;pose['torso.yaw']=(walking?.direction||1)*40*(walking?.blend||0)+60*lying;pose['pelvis.rotation']=benchRoll*lying;pose['pelvis.yaw']=(walking?.direction||1)*30*(walking?.blend||0)+60*lying;pose['head.rotation']=20*lying+8*tired;pose['head.yaw']=-12*lying+(walking?.direction||1)*10*(walking?.blend||0);pose['head.pitch']=-10*effort+12*tired+7*anticipation;
 let weightY=bench.barY,pressEffort=0;const benchEnds=[43.05,45.35,48];if(t>=41&&t<48){const index=benchEnds.findIndex(end=>t<end),start=index?benchEnds[index-1]:41,q=(t-start)/(benchEnds[index]-start);pressEffort=q<.42?ease(q/.42):q<.55?1:1-ease((q-.55)/.45);weightY+=32*pressEffort+(index===2?Math.sin(t*24)*.7*pressEffort:0);}
 pose['barbell.x']=bench.barX-x;pose['barbell.y']=weightY-y;pose['barbell.rotation']=benchTargets.bar.rotation;pose['barbell.z']=-.3*(1-between(t,40,41)*(1-between(t,48,49)));pose['pullbar.x']=bar.x-x;pose['pullbar.y']=bar.y-y;pose['pullbar.z']=10;
 const hesitation=outcome<8&&t<4?.24*Math.sin(Math.PI*clamp((t-.6)/2.8,0,1))**2:0,grip=between(t,4,6)*(1-between(t,25,26.5))+hesitation,reachBench=between(t,40,41)*(1-between(t,48,49));
 for(const [name,side] of [['left',-1],['right',1]]){
  const shoulder=mix({x:side*lerp(34,25,walking?.blend||0),y:-68+breath},{x:benchTargets.shoulders[name].x-benchTargets.hips.x,y:benchTargets.shoulders[name].y-benchTargets.hips.y},lying);shoulder.x+=torsoX-(benchTargets.back.x-benchTargets.hips.x)*lying;shoulder.y+=torsoY-(48+benchTargets.back.y-benchTargets.hips.y)*lying;pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=shoulder.y+68;pose[name+'Upper.z']=side<0&&lying>.5?-1:15;
  const stride=walking?clamp((walking.feet[name].x-x-side*5)/32,-1,1):0,resting={x:side*43-stride*9,y:5+stride*4};let hand=mix(resting,{x:bar.x+side*bar.grip-x,y:bar.y-y},grip);
  hand=mix(hand,{x:side*30,y:12},Math.max(sit,tired*.6));if(lying>0)hand=mix(hand,{x:side<0?-48:-18,y:22},lying);if(reachBench>0)hand=mix(hand,{x:benchTargets.bar[name].x-x,y:benchTargets.bar[name].y+weightY-bench.barY-y},reachBench);
  const arm=solve(shoulder,hand,40,side<0?-1:1);pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;pose[name+'Hand.z']=12;
  const hip={x:lerp(lerp(side*16,side*5,walking?.blend||0),24*Math.cos((benchRoll+90)*rad),lying),y:lerp(12,24*Math.sin((benchRoll+90)*rad)-side*9,lying)},homeFoot={x:side*18,y:83-3*hang},seatedFoot={x:lerp(710+side*18,benchTargets.feet[name].x,sit)-x,y:lerp(383,benchTargets.feet[name].y,sit)-y},target=t>=36&&t<52.5?seatedFoot:homeFoot,foot=walking?{x:walking.feet[name].x-x,y:walking.feet[name].y-y}:target;
  const bend=walking?walking.direction>0?-1:1:sit>.01?-1:side<0?1:-1,leg=solve(hip,foot,36,bend);pose[name+'Thigh.x']=hip.x-side*16;pose[name+'Thigh.y']=hip.y-12;pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Foot.rotation']=leg.wrist+(walking?.feet[name].rotation||0);pose[name+'Foot.yaw']=walking?.direction<0?180*walking.blend:0;pose[name+'Thigh.z']=side<0?.008:.012;
  limbDepth(pose,name,false,82*(1-grip)*(1-reachBench)*(1-.65*lying));limbDepth(pose,name,true,lerp(lerp(75,40,walking?.blend||0),30,lying));
  pose[name+'Foot.rotation']+=walking?.feet[name].rotation||0;pose[name+'Foot.pitch']=walking?-14*clamp((383-walking.feet[name].y)/12,0,1):0;pose[name+'Foot.yaw']=side<0?180*hang:0;pose[name+'Foot.rotation']+=side*30*hang;
 }
 const faceTurn=clamp(pose['head.yaw']/50,-1,1);for(const name of ['face','face-neutral','face-effort','face-blink']){pose[name+'.x']=8*faceTurn;pose[name+'.z']=Math.abs(8*faceTurn)+.2;}
 const pressing=t>=41&&t<48,blink=((t+.8)%3.7)<.13;pose['face-neutral.opacity']=effort>.5||pressing||blink?0:1;pose['face-effort.opacity']=effort>.5||pressing?1:0;pose['face-blink.opacity']=blink&&effort<=.5&&!pressing?1:0;pose['sweat.opacity']=outcome<8&&t>18&&t<29?.9:pressing?.6:0;pose['effort-lines.opacity']=outcome<8&&t>=repEnds[outcome-1]&&t<24?.7+.25*Math.sin(t*16):0;
 return pose;
}
// Remove only keys whose linear reconstruction stays within the channel error
// budget. This keeps the three-minute portable clip below the key limit.
function compactKeys(keys,tolerance){const keep=new Set([0,keys.length-1,...keys.flatMap((key,i)=>phaseRanges.some(r=>Math.abs(key[0]%60-r[1])<1e-5)?[i]:[])]);function visit(a,b){let error=tolerance,index=-1;for(let i=a+1;i<b;i++){const p=(keys[i][0]-keys[a][0])/(keys[b][0]-keys[a][0]),e=Math.abs(keys[i][1]-lerp(keys[a][1],keys[b][1],p));if(e>error){error=e;index=i;}}if(index>=0){keep.add(index);visit(a,index);visit(index,b);}}const anchors=[...keep].sort((a,b)=>a-b);for(let i=1;i<anchors.length;i++)visit(anchors[i-1],anchors[i]);return [...keep].sort((a,b)=>a-b).map(i=>keys[i]);}
const joint=(id,parent,x=0,y=0,length=0)=>({id,parent,x,y,length,rotation:0,min:-180,max:180});
const part=(id,jointId,d,fill,extra={})=>({id,joint:jointId,d,fill,stroke:'#292c38',strokeWidth:2,spatial:{order:0},...extra});
const circle=(x,y,r)=>`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0Z`;
function lifter(){
 const joints=[joint('root',null),joint('torso','root',0,-48),joint('pelvis','root'),joint('head','torso',0,-58),...['face','face-neutral','face-effort','face-blink','sweat','effort-lines'].map(id=>joint(id,'head'))];
 for(const [name,side] of [['left',-1],['right',1]])joints.push(joint(name+'Upper','root',side*34,-68,40),joint(name+'Lower',name+'Upper',40,0,40),joint(name+'Hand',name+'Lower',40),joint(name+'Thigh','root',side*16,12,36),joint(name+'Calf',name+'Thigh',36,0,36),joint(name+'Foot',name+'Calf',36));
 joints.push(joint('barbell','root'),joint('pullbar','root'),joint('water-bottle','root'));
 const skin='#c98159',highlight='#e6a67b',shadow='#a65f46',parts=[];
 for(const [name,side] of [['left',-1],['right',1]]){
  parts.push(part(name+'leg',name+'Thigh','M0 0L88 0',skin,{strokeWidth:2,spatial:{softLimb:{elbow:name+'Calf',hand:name+'Foot',radius:10},order:8}}));
  parts.push(part(name+'shoe',name+'Foot','M-9-7Q-2-9 3-3L15-2Q21 0 18 7H-10Q-14 4-9-7Z','#e6e7eb',{spatial:{order:45}}));
  parts.push(part(name+'arm',name+'Upper','M0 0L80 0',skin,{strokeWidth:2,spatial:{softLimb:{elbow:name+'Lower',hand:name+'Hand',radius:13},order:34}}));
  parts.push(part(name+'biceps',name+'Upper','M4-8Q19-15 31-6Q20-8 11 1Z',highlight,{stroke:'none',strokeWidth:0,spatial:{order:35}}));
  parts.push(part(name+'grip',name+'Hand','M-7-5Q-3-10 5-8L10-3V6Q3 10-6 5Z',skin,{spatial:{order:105}}));
 }
 parts.push(part('trunk','torso','M-38-25Q-29-37-15-33Q0-25 15-33Q30-37 38-25L31 4Q24 18 22 38Q0 46-22 38Q-24 18-31 4Z',skin,{spatial:{order:20,thickness:.3,axis:'x'}}));
 parts.push(part('left-pec','torso','M-31-23Q-15-32-2-17L-2-2Q-20 7-32-4Z',highlight,{stroke:shadow,strokeWidth:1.5,spatial:{order:21}}),part('right-pec','torso','M31-23Q15-32 2-17L2-2Q20 7 32-4Z',highlight,{stroke:shadow,strokeWidth:1.5,spatial:{order:21}}));
 parts.push(part('abs','torso','M-12 9Q0 4 12 9M-12 19Q0 14 12 19M-10 29Q0 24 10 29M0 5V34','none',{stroke:shadow,strokeWidth:2,spatial:{order:22}}));
 parts.push(part('shorts','pelvis','M-25-10Q0-4 25-10L29 28L5 30L0 13L-5 30L-29 28Z','#33465f',{spatial:{order:32}}),part('shorts-stripe','pelvis','M-24-5L-20 24M24-5L20 24','none',{stroke:'#93d2be',strokeWidth:4,spatial:{order:33}}));
 parts.push(part('head-shape','head','M-24-16Q-22-31 0-32Q23-31 24-16L21 14Q11 28 0 28Q-11 28-21 14Z',skin,{spatial:{order:40,thickness:.65,axis:'x'}}));
 parts.push(part('hair','head','M-24-9L-25-24Q-15-36 0-36Q15-39 25-25L23-7L16-22Q6-16-8-24L-18-20Z','#40332e',{spatial:{order:43}}),part('beard','face','M-21 9L-12 13L-7 8Q0 5 7 8L12 13L21 9Q18 27 0 29Q-18 27-21 9Z','#534037',{strokeWidth:1.5,spatial:{order:44}}));
 parts.push(part('eyes','face-neutral',circle(-9,-5,3)+circle(9,-5,3),'#252b36',{opacityChannel:'face-neutral.opacity',strokeWidth:0,spatial:{order:50}}),part('eyebrows','face','M-16-13L-5-15M5-15L16-13','none',{stroke:'#45332e',strokeWidth:3,spatial:{order:51}}));
 parts.push(part('effort','face-effort','M-15-5L-7-2L-15 1M15-5L7-2L15 1M-7 15Q0 10 7 15L5 19H-5Z','#faf0dc',{opacityChannel:'face-effort.opacity',strokeWidth:2,spatial:{order:52}}),part('blink','face-blink','M-14-4Q-9 1-4-4M4-4Q9 1 14-4','none',{opacityChannel:'face-blink.opacity',strokeWidth:2,spatial:{order:52}}));
 parts.push(part('nose','face','M0-2Q4 0 6 4L0 5',highlight,{stroke:shadow,strokeWidth:1,spatial:{order:53}}));
 parts.push(part('sweat-drop','sweat','M27-14Q39 0 31 4Q21 4 27-14Z','#9bdeeb',{opacityChannel:'sweat.opacity',stroke:'#428aa2',strokeWidth:1,spatial:{order:54}}),part('strain-lines','effort-lines','M-35-19L-43-23M-37-7L-46-6M35-19L43-23M37-7L46-6','none',{opacityChannel:'effort-lines.opacity',stroke:'#dc8268',strokeWidth:3,spatial:{order:54}}));
 parts.push(part('barbell-shaft','barbell','M-96 0H96','none',{stroke:'#c1d0d7',strokeWidth:6,spatial:{order:90}}));
 for(const side of [-1,1]){parts.push(part('plate-'+(side<0?'left':'right'),'barbell',`M${side*74-9}-26h18v52h-18Z`,'#405d70',{stroke:'#182d3c',strokeWidth:3,spatial:{order:93}}),part('collar-'+(side<0?'left':'right'),'barbell',`M${side*91-3}-13h6v26h-6Z`,'#ced9de',{strokeWidth:1,spatial:{order:94}}));}
 parts.push(part('pullup-front-bar','pullbar','M-75 0H75','none',{stroke:'#233445',strokeWidth:9,spatial:{order:80}}));
 parts.push(part('water-bottle-body','water-bottle','M-5-17H5V-11Q9-8 9-3V16Q0 21-9 16V-3Q-9-8-5-11Z','#91d9dc',{opacityChannel:'water-bottle.opacity',stroke:'#386c79',strokeWidth:1.5,spatial:{order:120}}),part('water-bottle-label','water-bottle','M-8-1H8V11H-8Z','#eaf6e8',{opacityChannel:'water-bottle.opacity',strokeWidth:0,spatial:{order:121}}),part('water-bottle-cap','water-bottle','M-6-20H6V-15H-6Z','#355e72',{opacityChannel:'water-bottle.opacity',strokeWidth:1,spatial:{order:122}}));
 const clips={};for(const mode of gymModes){const duration=mode==='workout'?180:60,times=new Set(Array.from({length:duration*15+1},(_,i)=>+(i/15).toFixed(6)));for(let cycle=0;cycle<duration/60;cycle++){for(const t of [...phaseRanges.flatMap(r=>[r[1],r[2]]),...repEnds])times.add(+(cycle*60+t).toFixed(6));}const tracks={};for(const t of [...times].sort((a,b)=>a-b)){const sample=t===duration?gymPose(0,mode):gymPose(t,mode);for(const [key,value]of Object.entries(sample))(tracks[key]??=[]).push([t,+value.toFixed(5),'linear']);}for(const [key,keys]of Object.entries(tracks))tracks[key]=compactKeys(keys,key.endsWith('opacity')?.025:key.endsWith('rotation')?(/Thigh|Calf|Foot/.test(key)?.65:1.7):/^(root|barbell|pullbar)\.y$/.test(key)?1.3:.8);clips[mode]={duration,loop:true,tracks};}
 for(const clip of Object.values(clips))clip.tracks['water-bottle.opacity']=[[0,0],[clip.duration,0]];
 Object.assign(clips,liveClips());
 const inputs={action:{type:'string',default:'workout',options:gymModes}},states=Object.fromEntries(gymModes.map(id=>[id,{clip:id,transitions:gymModes.filter(v=>v!==id).map(to=>({to,duration:.15,when:{input:'action',equals:to}}))}]));
 return {name:'Atlas · gym athlete',spatial:true,joints,parts,clips,inputs,initial:'workout',states,provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};
}

// These short clips are authored mechanics. Their outcomes and sequencing are
// selected by the reusable graph below, never by gymPose or an ambient timer.
function authoredClip(duration,sampler){const tracks={};for(let i=0;i<=duration*30;i++){const t=Math.min(duration,i/30),pose=sampler(t);for(const [key,value]of Object.entries(pose))(tracks[key]??=[]).push([+t.toFixed(6),+value.toFixed(5),'linear']);}for(const [key,keys]of Object.entries(tracks))tracks[key]=compactKeys(keys,key.endsWith('opacity')?.01:key.endsWith('rotation')?.3:.15);return {duration,loop:false,tracks};}
function drinkPose(t,atBench){
 const pose={...gymPose(atBench?52.5:29,'full-set')},raise=between(t,.3,1.4)*(1-between(t,3.5,4.6)),sip=between(t,1.4,1.8)*(1-between(t,3.1,3.5));
 // Fold toward the mouth with the elbow below the shoulder. Blending joint
 // angles keeps the resting bend continuous instead of flipping IK branches.
 const drinking=solve({x:34,y:-68},{x:18,y:-80},40,-1);
 for(const [joint,value]of [['rightUpper',drinking.upper],['rightLower',drinking.lower],['rightHand',drinking.wrist]])pose[joint+'.rotation']=lerp(pose[joint+'.rotation'],value,raise);
 pose['rightUpper.yaw']*=1-raise;pose['rightLower.yaw']*=1-raise;const wrist=jointEndpoint(pose,1);
 pose['rightUpper.z']=25;pose['rightHand.z']=30;pose['head.rotation']=-5*sip;pose['head.pitch']=-8*sip;pose['face-neutral.opacity']=1;pose['face-effort.opacity']=0;pose['face-blink.opacity']=0;pose['sweat.opacity']=.15*(1-sip);
 pose['water-bottle.x']=wrist.x;pose['water-bottle.y']=wrist.y;pose['water-bottle.rotation']=-65*sip;pose['water-bottle.opacity']=between(t,0,.2)*(1-between(t,4.6,5));pose['water-bottle.z']=35;
 return pose;
}
export const gymGripReviews=[
 {id:'jump-grab-left',label:'Jump / left hand first',clip:'jump-grab-left',duration:5.6,hold:1.8},
 {id:'jump-grab-right',label:'Jump / right hand first',clip:'jump-grab-right',duration:5.6,hold:1.8},
 {id:'release-one-hand',label:'One-hand release',clip:'release-one-hand',duration:5.6,hold:1.5},
 {id:'release-cheer',label:'One-hand hang / small cheer',clip:'release-cheer',duration:5.6,hold:1.5}
];
function jointEndpoint(pose,side,leg=false){const name=side<0?'left':'right',upper=name+(leg?'Thigh':'Upper'),lower=name+(leg?'Calf':'Lower'),length=leg?36:40,m=limbMatrix(pose[upper+'.rotation'],pose[upper+'.yaw']||0),l=limbMatrix(pose[lower+'.rotation'],pose[lower+'.yaw']||0),v=matrixVector(m,[length*(1+l[0]),length*l[3],length*l[6]]);return {x:side*(leg?16:34)+(pose[upper+'.x']||0)+v[0],y:(leg?12:-68)+(pose[upper+'.y']||0)+v[1]};}
function leanHang(pose,degrees,held={left:true,right:true}){
 const rootShift=-Math.abs(degrees)*.9;pose['root.y']+=rootShift;pose['barbell.y']-=rootShift;pose['pullbar.y']-=rootShift;
 const a=degrees*rad,turn=p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
 const chest=turn({x:pose['torso.x']||0,y:-48+(pose['torso.y']||0)});pose['torso.x']=chest.x;pose['torso.y']=chest.y+48;pose['torso.rotation']=(pose['torso.rotation']||0)+degrees;pose['pelvis.rotation']=(pose['pelvis.rotation']||0)+degrees;
 for(const [name,side]of [['left',-1],['right',1]]){
  const hand=jointEndpoint(pose,side),foot=turn(jointEndpoint(pose,side,true)),shoulder=turn({x:side*34+(pose[name+'Upper.x']||0),y:-68+(pose[name+'Upper.y']||0)}),hip=turn({x:side*16+(pose[name+'Thigh.x']||0),y:12+(pose[name+'Thigh.y']||0)}),arm=solve(shoulder,mix(turn(hand),{x:hand.x,y:hand.y-rootShift},Number(held[name])),40,side<0?-1:1),leg=solve(hip,foot,36,side<0?1:-1);
  pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=shoulder.y+68;pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;
  pose[name+'Thigh.x']=hip.x-side*16;pose[name+'Thigh.y']=hip.y-12;pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Thigh.yaw']=0;pose[name+'Calf.yaw']=0;
  limbDepth(pose,name,false,65*(1-Number(held[name])));limbDepth(pose,name,true,65);
 }
 return pose;
}
function hangingRestPose(t){
 const pose={...gymPose(6,'full-set')},leftFree=between(t,2.5,2.9)*(1-between(t,4.6,5.1)),rightFree=between(t,.4,.9)*(1-between(t,1.9,2.4));
 for(const [name,side,free]of [['left',-1,leftFree],['right',1,rightFree]]){
  const shoulder={x:side*34,y:-68},grip={x:side*43,y:150-pose['root.y']},target=mix(grip,{x:side*46,y:0},free),arm=solve(shoulder,target,40,side<0?-1:1);
  pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;limbDepth(pose,name,false,65*free);
 }
 leanHang(pose,14*(leftFree-rightFree),{left:1-leftFree,right:1-rightFree});
 for(const [name,side]of [['left',-1],['right',1]]){pose[name+'Foot.rotation']+=side*30;pose[name+'Foot.yaw']=side<0?180:0;}
 pose['head.pitch']=5*Math.sin(Math.PI*t/5.8);return pose;
}
function gripPose(t,first=-1,releasing=false,cheer=false){
 const duration=5.6,start=gymPose(releasing?24:0,'full-set'),end=gymPose(releasing?29:6,'full-set'),progress=between(t,0,duration),pose=Object.fromEntries(Object.keys(start).map(key=>[key,lerp(start[key],end[key],progress)]));
 let x=180,y,flight,reach,drop=0;
 if(!releasing){
  y=t<.5?lerp(300,316,between(t,0,.5)):t<1.15?lerp(316,275,between(t,.5,1.15)):t<1.55?lerp(275,288,between(t,1.15,1.55)):lerp(288,296,between(t,3.25,duration));
  const sway=between(t,1.2,1.55)*(1-between(t,3.1,4));x+=first*(5+2*Math.sin((t-1.2)*3))*sway;y+=Math.sin((t-1.55)*3)*1.8*sway;
  flight=between(t,.55,.8);reach=between(t,.5,1.2);
 }else{
  drop=between(t,2.4,3);y=t<2.4?296-7*Math.sin(Math.PI*clamp(t/2.4,0,1))**2:t<3?lerp(296,310,drop):lerp(310,300,between(t,3,3.6));
  x-=5*Math.sin(Math.PI*clamp(t/2.4,0,1))**2;flight=1-between(t,2.4,3);reach=1-between(t,2.4,2.95);
 }
 pose['root.x']=x;pose['root.y']=y;pose['torso.rotation']=(releasing?5:-9)*Math.sin(Math.PI*clamp(t/(releasing?3.6:1.2),0,1))**2;pose['head.pitch']=(releasing?5:-7)*Math.sin(Math.PI*progress);pose['head.rotation']=cheer?-6*between(t,.5,1)*(1-between(t,2,2.5)):0;
 pose['barbell.x']=bench.barX-x;pose['barbell.y']=bench.barY-y;pose['barbell.rotation']=benchTargets.bar.rotation;pose['pullbar.x']=180-x;pose['pullbar.y']=150-y;pose['water-bottle.opacity']=0;
 for(const [name,side]of [['left',-1],['right',1]]){
  const shoulder={x:side*34,y:-68},initial=jointEndpoint(start,side),final=jointEndpoint(end,side),grip={x:180+43*side-x,y:150-y};let hand;
  if(!releasing){const join=side===first?reach:between(t,2.35,3.1);hand=mix(initial,grip,join);hand.x+=side*42*Math.sin(Math.PI*join);}
  else if(side<0){hand=mix(grip,final,1-reach);hand.x+=side*42*Math.sin(Math.PI*reach);}
  else{
   const release=between(t,.2,.65),celebrate=cheer?between(t,.6,1)*(1-between(t,2,2.4)):0,free=mix({x:48,y:5},{x:54,y:-69-7*Math.sin((t-.7)*Math.PI*3)},celebrate);
   hand=mix(grip,free,release);hand.x+=side*36*Math.sin(Math.PI*release);hand=mix(hand,final,between(t,2.4,3.5));
  }
  const arm=solve(shoulder,hand,40,side<0?-1:1);pose[name+'Upper.yaw']=0;pose[name+'Lower.yaw']=0;pose[name+'Thigh.yaw']=0;pose[name+'Calf.yaw']=0;pose[name+'Upper.x']=0;pose[name+'Upper.y']=0;pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;
  const initialFoot=jointEndpoint(start,side,true),finalFoot=jointEndpoint(end,side,true),ground={x:180+initialFoot.x-x,y:383-y};let foot;
  if(!releasing){const air=mix({x:side*18,y:69},finalFoot,between(t,3.25,duration));foot=mix(ground,air,flight);}
  else{const air={x:initialFoot.x,y:initialFoot.y};foot=mix(ground,air,flight);foot=mix(foot,finalFoot,between(t,3.6,duration));}
  const leg=solve({x:side*16,y:12},foot,36,side<0?1:-1);pose[name+'Thigh.x']=0;pose[name+'Thigh.y']=0;pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Foot.rotation']=leg.wrist;pose[name+'Foot.yaw']=0;
  const attached=!releasing?(side===first?reach:between(t,2.35,3.1)):side<0?reach:1-between(t,.2,.65);limbDepth(pose,name,false,82*(1-attached));limbDepth(pose,name,true,75);
 }
 pose['face-neutral.opacity']=1;pose['face-effort.opacity']=0;pose['face-blink.opacity']=0;pose['sweat.opacity']=releasing?.3*(1-between(t,3.5,duration)):0;pose['effort-lines.opacity']=0;
 const single=!releasing?reach-between(t,2.35,3.1):reach-(1-between(t,.2,.65));
 leanHang(pose,(releasing?-1:first)*12*single,{left:!releasing?(first<0?reach:between(t,2.35,3.1)):reach,right:!releasing?(first>0?reach:between(t,2.35,3.1)):1-between(t,.2,.65)});
 for(const [name,side]of [['left',-1],['right',1]]){pose[name+'Foot.rotation']+=side*30*flight;pose[name+'Foot.yaw']=side<0?180*flight:0;}
 return pose;
}
function gripClips(){return Object.fromEntries(gymGripReviews.map(review=>[review.clip,authoredClip(review.duration,t=>gripPose(t,review.id==='jump-grab-right'?1:-1,review.id.startsWith('release'),review.id==='release-cheer'))]));}
function liveClips(){return {...gripClips(),'hang-switch':authoredClip(5.8,hangingRestPose),'drink-at-bar':authoredClip(5,t=>drinkPose(t,false)),'drink-at-bench':authoredClip(5,t=>drinkPose(t,true)),'bench-failed':authoredClip(4.4,t=>{const phase=t<.85?lerp(0,.5,between(t,0,.85)):t<1.8?lerp(.5,.73,between(t,.85,1.8)):t<3.1?lerp(.73,.57,between(t,1.8,3.1)):lerp(.57,1,between(t,3.1,4.4)),pose={...gymPose(41+2.05*phase,'full-set')},strain=between(t,.6,1.1)*(1-between(t,3.3,4.4));pose['head.pitch']=8*strain;pose['head.rotation']=Math.sin(t*22)*1.3*strain;pose['face-effort.opacity']=strain>.2?1:0;pose['face-neutral.opacity']=strain>.2?0:1;pose['face-blink.opacity']=0;pose['effort-lines.opacity']=.85*strain;pose['sweat.opacity']=.9*strain;pose['water-bottle.opacity']=0;return pose;})};}
export const gymLiveVariables={fatigue:'Fatigue',dehydration:'Thirst',reps:'Set reps',sets:'Completed sets',successes:'Successful reps',failures:'Failed attempts',drinks:'Water breaks'};
export function gymLiveStatus(frame){const v=frame.behavior?.variables||{};return {state:frame.behavior?.state||'review',fatigue:Number(v.fatigue||0),dehydration:Number(v.dehydration||0),reps:Number(v.reps||0),sets:Number(v.sets||0),successes:Number(v.successes||0),failures:Number(v.failures||0),drinks:Number(v.drinks||0),station:v.atBench?'bench':'pull-ups'};}
function addLiveGym(scene){
 const event=name=>({type:'event',event:name}),add=(variable,value)=>({type:'add',variable,value}),set=(variable,value)=>({type:'set',variable,value}),perform=activity=>({type:'perform',activity});
 const variant=(id,clip,start,end,min=.95,max=1.05,weight=1,offsets)=>({id,clip,start,end,weight,speed:{min,max},...(offsets?{offsets}:{})}),steady={base:1,modifiers:[]},head={'head.pitch':{min:-1.5,max:1.5},'head.rotation':{min:-1,max:1}};
 const recipe=(variants,done,effects=[])=>({actor:'atlas',variants,success:steady,onStart:[],onSuccess:[...effects,event(done)],onFailure:[event(done)]});
 const activities={
  prepare:recipe([variant('reach-bar','full-set',0,6,.92,1.06,2),variant('jump-left','jump-grab-left',0,5.6,.95,1.04),variant('jump-right','jump-grab-right',0,5.6,.95,1.04)],'ready'),
  pull:{actor:'atlas',variants:[variant('fresh','full-set',6,7.65,.9,1.08,3,head),variant('measured','full-set',13.5,15.8,.86,1.02,1,head)],failureVariants:[variant('stalled-six','fail-six',18.3,24,.96,1.04)],success:{base:1,modifiers:[{variable:'fatigue',weight:-.0035},{variable:'dehydration',weight:-.0015}]},onStart:[add('fatigue',8),add('dehydration',3)],onSuccess:[add('reps',1),add('successes',1),event('pull-complete')],onFailure:[add('failures',1),add('fatigue',6),event('pull-failed')]},
  recover:recipe([variant('catch-breath','full-set',24,29,.85,1),variant('one-hand','release-one-hand',0,5.6,.94,1.03)],'recovered',[add('fatigue',-22),add('sets',1)]),
  'recover-failed':recipe([variant('catch-breath','fail-six',24,29,.9,1,2),variant('one-hand','release-one-hand',0,5.6,.94,1.03,2),variant('small-cheer','release-cheer',0,5.6,.94,1.03)],'recovered',[add('fatigue',-22),add('sets',1)]),
  'walk-bench':recipe([variant('walk','full-set',29,36,.92,1.04)],'at-bench'),
  'bench-setup':recipe([variant('sit-and-grip','full-set',36,41,.92,1.04)],'bench-ready'),
  bench:{actor:'atlas',variants:[variant('steady','full-set',41,43.05,.9,1.06,3,head),variant('measured','full-set',43.05,45.35,.86,1,1,head)],failureVariants:[variant('stalled-press','bench-failed',0,4.4,.96,1.02)],success:{base:1,modifiers:[{variable:'fatigue',weight:-.0032},{variable:'dehydration',weight:-.0015}]},onStart:[add('fatigue',7),add('dehydration',3)],onSuccess:[add('reps',1),add('successes',1),event('bench-complete')],onFailure:[add('failures',1),add('fatigue',5),event('bench-failed')]},
  'rack-and-rise':recipe([variant('rack-sit-stand','full-set',48,52.5,.88,1.02)],'bench-recovered',[add('fatigue',-20),add('sets',1)]),
  'walk-home':recipe([variant('return','full-set',52.5,60,.92,1.04)],'at-home',[add('fatigue',-8)]),
  'drink-bar':recipe([variant('drink','drink-at-bar',0,5,.92,1.06)],'drank-bar',[add('dehydration',-45),add('fatigue',-7),add('drinks',1)]),
  'drink-bench':recipe([variant('drink','drink-at-bench',0,5,.92,1.06)],'drank-bench',[add('dehydration',-45),add('fatigue',-7),add('drinks',1)])
 };
 const states={prepare:{actions:[set('reps',0),set('atBench',false),perform('prepare')]},pull:{actions:[perform('pull')]},'pull-check':{actions:[]},recover:{actions:[perform('recover')]},'recover-failed':{actions:[perform('recover-failed')]},'bar-water-check':{actions:[]},'drink-bar':{actions:[perform('drink-bar')]},'walk-bench':{actions:[perform('walk-bench')]},'bench-setup':{actions:[set('reps',0),set('atBench',true),perform('bench-setup')]},bench:{actions:[perform('bench')]},'bench-check':{actions:[]},'rack-and-rise':{actions:[perform('rack-and-rise')]},'bench-water-check':{actions:[]},'drink-bench':{actions:[perform('drink-bench')]},'walk-home':{actions:[perform('walk-home')]}};
 const edges=[],on=(id,from,to,name)=>edges.push({id,from,to,event:name,weight:1}),when=(id,from,to,variable,op,value)=>edges.push({id,from,to,after:{min:.1,max:.25},when:{variable,op,value},weight:1});
 on('prepared','prepare','pull','ready');on('pull-success','pull','pull-check','pull-complete');on('pull-failure','pull','recover-failed','pull-failed');when('another-pull','pull-check','pull','reps','lt',8);when('pull-set-done','pull-check','recover','reps','gte',8);on('caught-breath','recover','bar-water-check','recovered');on('recovered-failure','recover-failed','bar-water-check','recovered');when('thirst-at-bar','bar-water-check','drink-bar','dehydration','gte',40);when('leave-bar','bar-water-check','walk-bench','dehydration','lt',40);on('water-at-bar','drink-bar','walk-bench','drank-bar');on('arrived-bench','walk-bench','bench-setup','at-bench');on('bench-prepared','bench-setup','bench','bench-ready');on('bench-success','bench','bench-check','bench-complete');on('bench-failure','bench','rack-and-rise','bench-failed');when('another-press','bench-check','bench','reps','lt',8);when('bench-set-done','bench-check','rack-and-rise','reps','gte',8);on('racked','rack-and-rise','bench-water-check','bench-recovered');when('thirst-at-bench','bench-water-check','drink-bench','dehydration','gte',40);when('leave-bench','bench-water-check','walk-home','dehydration','lt',40);on('water-at-bench','drink-bench','walk-home','drank-bench');on('back-home','walk-home','prepare','at-home');
 scene.presentation='live';scene.requiredFeatures.push('behavior-graphs','action-variations');scene.behaviorGraph={seed:20260930,variables:{fatigue:8,dehydration:10,reps:0,sets:0,successes:0,failures:0,drinks:0,atBench:false},variableBounds:{fatigue:{min:0,max:100},dehydration:{min:0,max:100},reps:{min:0,max:8},sets:{min:0,max:1000000},successes:{min:0,max:1000000},failures:{min:0,max:1000000},drinks:{min:0,max:1000000}},initial:'prepare',states,edges,activities};
 for(const review of gymGripReviews)for(const [side,sign]of [['left',-1],['right',1]]){
  const jump=review.id.startsWith('jump'),first=review.id==='jump-grab-right'?1:-1;
  scene.contacts.push({id:review.id+'-'+side,name:review.label+' / '+side+' grip',enabled:true,actor:'atlas',chain:{upper:side+'Upper',lower:side+'Lower',end:side+'Hand'},target:{type:'joint',actor:'gym',joint:'root',offsetX:180+43*sign,offsetY:150},bend:sign<0?1:-1,weight:1,start:jump?(sign===first?1.2:3.1):0,end:jump?5.6:(sign<0?2.4:.2),clip:review.clip});
 }
 for(const [side,i]of [['left',0],['right',1]])scene.contacts.push({id:side+'-failed-bench',name:side+' hand / stalled bench press',enabled:true,actor:'atlas',chain:{upper:side+'Upper',lower:side+'Lower',end:side+'Hand'},target:{type:'joint',actor:'atlas',joint:'barbell',offsetX:i?40:-40,offsetY:0},bend:i?-1:1,weight:1,start:0,end:4.4,clip:'bench-failed'});
 addGymPreparation(scene,{poseAt:gymPose,makeClip:authoredClip});
 configureGymRoom(scene);installGymIdleActions(scene,{poseAt:gymPose,makeClip:authoredClip,walkPose:gymTravelPose,stations:gymRoomStations});
 return finishGymScene(scene);
}

export const gymSceneReviews=[{id:'hang-switch',clip:'hang-switch',label:'Hang / rest / switch hands',duration:5.8},{id:'turnaround',clip:'turnaround',label:'Atlas / full 360° views',duration:12},{id:'floor-walk',clip:'floor-walk',label:'Walk / floor depth',duration:12}];
function finishGymScene(scene){
 const pack=scene.packs.atlas,g=scene.behaviorGraph,event=name=>({type:'event',event:name});
 scene.contacts=scene.contacts.flatMap(c=>c.clip?[c]:gymModes.map(clip=>({...c,id:clip==='workout'?c.id:c.id+'-'+clip,clip})));
 for(const c of scene.contacts)if(c.target.joint==='barbell'){const name=c.chain.upper.startsWith('left')?'left':'right';c.target.offsetX=benchTargets.bar.gripOffsets[name].x;c.target.offsetY=0;}
 for(const [name,windows]of [['left',[[0,2.5],[5.1,5.8]]],['right',[[0,.4],[2.4,5.8]]]])for(const [index,[start,end]]of windows.entries())scene.contacts.push({id:'hang-switch-'+name+'-'+index,name:'Rest / '+name+' grip',enabled:true,actor:'atlas',chain:{upper:name+'Upper',lower:name+'Lower',end:name+'Hand'},target:{type:'joint',actor:'gym',joint:'root',offsetX:name==='left'?137:223,offsetY:150},bend:name==='left'?1:-1,weight:1,start,end,clip:'hang-switch'});
 g.activities['hang-rest']={actor:'atlas',variants:[{id:'switch-hands',clip:'hang-switch',start:0,end:5.8,weight:1,speed:{min:.95,max:1.05}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[{type:'add',variable:'fatigue',value:-7},event('hang-rested')],onFailure:[event('hang-rested')]};
 g.states['hang-choice']={actions:[]};g.states['hang-rest']={actions:[{type:'perform',activity:'hang-rest'}]};g.edges.find(e=>e.id==='another-pull').to='hang-choice';
 g.edges.push({id:'pull-no-rest-fresh',from:'hang-choice',to:'pull',after:{min:0,max:0},when:{variable:'fatigue',op:'lt',value:35},weight:1},{id:'pull-no-rest-tired',from:'hang-choice',to:'pull',after:{min:0,max:0},when:{variable:'fatigue',op:'gte',value:35},weight:3},{id:'pull-rest-tired',from:'hang-choice',to:'hang-rest',after:{min:0,max:0},when:{variable:'fatigue',op:'gte',value:35},weight:1},{id:'resume-after-hang',from:'hang-rest',to:'pull',event:'hang-rested',weight:1});
 for(const place of ['bar','bench']){
  const next=place==='bar'?'walk-bench':'walk-home',check=place+'-idle-choice',state='idle-'+place;
  for(const e of g.edges)if(e.to===next&&['leave-'+place,'water-at-'+place].includes(e.id))e.to=check;
  g.states[check]={actions:[]};g.states[state]={actions:[{type:'perform',activity:state}]};g.edges.push({id:place+'-continue',from:check,to:next,after:{min:0,max:0},weight:3},{id:place+'-take-break',from:check,to:state,after:{min:0,max:0},weight:2},{id:place+'-break-over',from:state,to:next,event:state+'-done',weight:1});
 }
 g.activities['catch-breath-before'].onSuccess.unshift({type:'add',variable:'fatigue',value:-4});
 const withBottle=pose=>{pose['water-bottle.x']=400-pose['root.x'];pose['water-bottle.y']=270-pose['root.y'];pose['water-bottle.opacity']=1;return pose;};
 pack.clips.turnaround=authoredClip(12,t=>{const pose=applyGymFacing({...gymPose(0,'full-set')},t/12*360),angle=pose['torso.yaw']*rad;for(const [name,side]of [['left',-1],['right',1]]){pose[name+'Upper.x']=side*34*(Math.cos(angle)-1);pose[name+'Upper.z']=-side*Math.sin(angle)*30+4;pose[name+'Hand.z']=0;pose[name+'Thigh.x']=side*16*(Math.cos(angle)-1);pose[name+'Thigh.z']=-side*Math.sin(angle)*14;}return withBottle(pose);});
 pack.clips['floor-walk']=authoredClip(12,t=>withBottle(t<6?gymTravelPose(t,6,{x:180,y:383},{x:420,y:310}):gymTravelPose(t-6,6,{x:420,y:310},{x:180,y:383})));
 addGymTurnaround(pack);scene.requiredFeatures.push('directional-artwork');
 return scene;
}

function equipment(){const joints=[joint('root',null)],parts=[part('wall','root','M0 0H800V390H0Z','#e5e7e5',{strokeWidth:0}),part('floor','root','M0 390H800V450H0Z','#9cafb4',{strokeWidth:0}),part('wall-panels','root','M0 115H800M0 235H800M400 0V390','none',{stroke:'#d2d9d7',strokeWidth:2}),part('window','root','M318 30H470V169H318Z','#a2c3c8',{stroke:'#718f99',strokeWidth:7}),part('window-bars','root','M394 31V168M319 99H469','none',{stroke:'#e1eeea',strokeWidth:5}),part('pullup-frame','root','M86 390V150Q86 122 112 122H248Q274 122 274 150V390M74 390H110M252 390H287','none',{stroke:'#3c5265',strokeWidth:12}),part('pullup-grip','root','M105 150H255','none',{stroke:'#233445',strokeWidth:9}),part('rubber-mat','root','M77 396H286V406H77Z','#506777',{strokeWidth:0}),part('bench-mat','root','M487 396H738V406H487Z','#506777',{strokeWidth:0}),part('bench-legs','root','M537 355L524 390M682 355L697 390M514 390H543M682 390H710','none',{stroke:'#456275',strokeWidth:9}),part('bench-pad','root','M510 347Q509 340 517 340H706Q715 341 713 355H510Z','#31505f',{stroke:'#203d4b',strokeWidth:2}),part('bench-rack','root','M501 390V260H516M669 390V260H654','none',{stroke:'#58788b',strokeWidth:8}),part('wall-line','root','M320 364H463','none',{stroke:'#b5c3c4',strokeWidth:4})];return {name:'Gym stations',spatial:true,joints,parts,clips:{still:{duration:1,loop:true,tracks:{}}},inputs:{},initial:'still',states:{still:{clip:'still'}},provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};}
function buildGym(){const scene={schemaVersion:1,kind:'scene',id:'gym-routine',name:'One more rep',revision:0,bounds:{width:800,height:450},requiredFeatures:['spatial-rig','soft-limbs','scene-groups','scene-lighting','contacts'],groups:[{id:'gym',name:'Gym / equipment',parent:null},{id:'athlete',name:'Atlas / character',parent:null}],contacts:['left','right'].flatMap((side,i)=>{const chain={upper:side+'Upper',lower:side+'Lower',end:side+'Hand'},base={enabled:true,actor:'atlas',chain,bend:i?-1:1,weight:1,period:60};return [{...base,id:side+'-pullup',name:side+' hand / pull-up bar',target:{type:'joint',actor:'gym',joint:'root',offsetX:i?223:137,offsetY:150},start:6,end:25},{...base,id:side+'-bench',name:side+' hand / barbell',target:{type:'joint',actor:'atlas',joint:'barbell',offsetX:i?40:-40,offsetY:0},start:41,end:48}];}),packs:{gym:equipment(),atlas:lifter()},actors:[{id:'gym',name:'Gym stations',pack:'gym',layer:'background',unlit:true,group:'gym',transform:{x:0,y:0,scale:1,rotation:0}},{id:'atlas',name:'Atlas',pack:'atlas',group:'athlete',groundY:390,transform:{x:0,y:0,scale:1,rotation:0},inputs:{action:'workout'},behavior:{mode:'animated',autoFace:false}}],lighting:{enabled:true,shading:'cel',type:'directional',receiver:'floor',angle:-130,elevation:50,intensity:.45,ambient:.78,color:'#fff2de',shadowColor:'#283b48',floorY:390,wallY:330,floorShadow:.19,wallShadow:0,reflection:0,softness:3,celThickness:.25,celIntensity:.34,gloss:.15}};return addLiveGym(scene);}

let cachedGym;
export function createGym(){return structuredClone(cachedGym??=buildGym());}
export const gymBeat=gymPhase;
