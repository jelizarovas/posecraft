import {clamp} from '../src/index.js';
const rad=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},mix=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}),between=(t,a,b)=>ease((t-a)/(b-a));
export const gymModes=['workout','full-set','fail-six','fail-seven'];
export const gymTiming={round:20,grab:1.2,pullEnd:8.4,walkToBench:8.85,lieDown:10.65,benchStart:12,benchEnd:15,returnStart:16.2,home:18.4};
const roundOutcomes=[8,6,7];
export function gymPhase(time,mode='workout'){
 const cycle=Math.floor(Math.max(0,time)/20),t=((time%20)+20)%20,outcome=mode==='fail-six'?6:mode==='fail-seven'?7:mode==='full-set'?8:roundOutcomes[cycle%3],completed=clamp(Math.floor((t-1.2+1e-7)/.9),0,outcome),failing=outcome<8&&t>=1.2+outcome*.9&&t<8.4;
 return {cycle,outcome,completed,rep:t>=1.2&&t<8.4?Math.min(outcome+1,Math.floor((t-1.2)/.9)+1):0,failed:outcome<8&&t>=8.4,phase:t<1.2?'grabbing bar':t<8.4?failing?'last rep stalls':'pull-ups':t<8.85?'stepping down':t<10.65?'walking to bench':t<12?'setting up bench press':t<15?'bench press':t<16.2?'racking and standing':t<18.4?'walking to pull-up bar':'recovering',benchReps:clamp(Math.floor(t-12+1e-7),0,3)};
}
function solve(shoulder,target,length,bend=1){const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,length*2-.1),end={x:shoulder.x+dx/d*reach,y:shoulder.y+dy/d*reach},height=Math.sqrt(Math.max(0,length*length-reach*reach/4)),elbow={x:(shoulder.x+end.x)/2-dy/d*height*bend,y:(shoulder.y+end.y)/2+dx/d*height*bend},upper=Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x)/rad,lower=Math.atan2(end.y-elbow.y,end.x-elbow.x)/rad;return {upper,lower:((lower-upper+540)%360)-180,wrist:((540-lower)%360)-180,end};}
const bar={x:180,y:150,grip:43},bench={x:650,y:300,barX:585,barY:245,grip:40};
export function gymPose(time,mode='workout'){
 const t=((time%20)+20)%20,{outcome}=gymPhase(time,mode),pose={},pull=t>=1.2&&t<=8.4,hang=t>=.65&&t<8.85,walkOut=between(t,8.85,10.65),walkBack=between(t,16.2,18.4),lying=between(t,10.65,11.5)*(1-between(t,15.35,16.2));
 let x=lerp(bar.x,bench.x,walkOut)*(1-walkBack)+bar.x*walkBack,y=310,effort=0,lift=0;
 if(pull){const elapsed=t-1.2,completedTime=outcome*.9;if(elapsed<completedTime){lift=Math.sin(Math.PI*(elapsed%.9)/.9)**2;effort=lift;}else if(outcome<8){const duration=7.2-completedTime,age=elapsed-completedTime,up=ease(age/(duration*.3)),down=1-ease((age-duration*.72)/(duration*.28));lift=.52*up*down+Math.sin(age*39)*.025*up*down;effort=up*down;}}
 if(hang)y=310-14*between(t,.65,1.2)*(1-between(t,8.4,8.85))-70*lift;
 y=lerp(y,bench.y,lying);
 const walking=t>=8.85&&t<10.65||t>=16.2&&t<18.4,walkAmount=walking?Math.sin(Math.PI*(t<11?(t-8.85)/1.8:(t-16.2)/2.2)):0;
 y-=Math.abs(Math.sin(t*12))*3*walkAmount;
 pose['root.x']=x;pose['root.y']=y;pose['torso.x']=-52*lying;pose['torso.y']=48*lying;pose['torso.rotation']=-90*lying;pose['head.rotation']=25*lying;pose['head.yaw']=48*lying;pose['head.pitch']=-10*effort;
 let weightY=bench.barY;if(t>=12&&t<=15)weightY+=37*Math.sin(Math.PI*((t-12)%1))**2;
 pose['barbell.x']=bench.barX-x;pose['barbell.y']=weightY-y;pose['barbell.z']=95;
 const reachBench=between(t,11.5,12)*(1-between(t,15,15.35));
 for(const [name,side] of [['left',-1],['right',1]]){
  const shoulder=mix({x:side*34,y:-68},{x:side<0?-70:-60,y:side<0?-8:8},lying);pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=shoulder.y+68;pose[name+'Upper.z']=side<0&&lying>.5?-25:30;
  const resting={x:side*45+Math.sin(t*12)*12*walkAmount*side,y:4-Math.cos(t*12)*8*walkAmount};
  let hand=resting;
  if(t<1.2)hand=mix(resting,{x:bar.x+side*bar.grip-x,y:bar.y-y},between(t,.1,1.2));
  else if(t<=8.4)hand={x:bar.x+side*bar.grip-x,y:bar.y-y};
  else if(t<8.85)hand=mix({x:bar.x+side*bar.grip-x,y:bar.y-y},resting,between(t,8.4,8.85));
  if(lying>0)hand=mix(hand,{x:side<0?-48:-18,y:22},lying);
  if(reachBench>0)hand=mix(hand,{x:bench.barX+side*bench.grip-x,y:weightY-y},reachBench);
  const arm=solve(shoulder,hand,40,side<0?-1:1);pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;
  const liftFoot=Math.max(0,Math.sin(t*12)*side)*15*walkAmount,stepX=Math.cos(t*12)*21*walkAmount*side,hip={x:side*16,y:12+10*lying},foot=mix({x:side*18+stepX,y:73-liftFoot-(hang?3:0)},{x:side*22,y:83},lying),leg=solve(hip,foot,30.8,side<0?1:-1);
  pose[name+'Thigh.y']=10*lying;
  pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Foot.rotation']=leg.wrist;pose[name+'Thigh.z']=side<0?8:12;
 }
 const pressing=t>=12&&t<15,blink=(t%3.7)<.13;pose['face-neutral.opacity']=effort>.5||pressing||blink?0:1;pose['face-effort.opacity']=effort>.5||pressing?1:0;pose['face-blink.opacity']=blink&&effort<=.5&&!pressing?1:0;pose['sweat.opacity']=outcome<8&&t>6&&t<10?.9:pressing?.6:0;pose['effort-lines.opacity']=outcome<8&&t>=1.2+outcome*.9&&t<8.4?.7+.25*Math.sin(t*27):0;
 return pose;
}
const joint=(id,parent,x=0,y=0,length=0)=>({id,parent,x,y,length,rotation:0,min:-180,max:180});
const part=(id,jointId,d,fill,extra={})=>({id,joint:jointId,d,fill,stroke:'#292c38',strokeWidth:2,spatial:{order:0},...extra});
const circle=(x,y,r)=>`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0Z`;
function lifter(){
 const joints=[joint('root',null),joint('torso','root',0,-48),joint('head','torso',0,-58),...['face-neutral','face-effort','face-blink','sweat','effort-lines'].map(id=>joint(id,'head'))];
 for(const [name,side] of [['left',-1],['right',1]])joints.push(joint(name+'Upper','root',side*34,-68,40),joint(name+'Lower',name+'Upper',40,0,40),joint(name+'Hand',name+'Lower',40),joint(name+'Thigh','root',side*16,12,30.8),joint(name+'Calf',name+'Thigh',30.8,0,30.8),joint(name+'Foot',name+'Calf',30.8));
 joints.push(joint('barbell','root'));
 const skin='#c98159',highlight='#e6a67b',shadow='#a65f46',parts=[];
 for(const [name,side] of [['left',-1],['right',1]]){
  parts.push(part(name+'leg',name+'Thigh','M0 0L88 0',skin,{strokeWidth:2,spatial:{softLimb:{elbow:name+'Calf',hand:name+'Foot',radius:10},order:8}}));
  parts.push(part(name+'shoe',name+'Foot','M-9-7Q-2-9 3-3L15-2Q21 0 18 7H-10Q-14 4-9-7Z','#e6e7eb',{spatial:{order:45}}));
  parts.push(part(name+'arm',name+'Upper','M0 0L80 0',skin,{strokeWidth:2,spatial:{softLimb:{elbow:name+'Lower',hand:name+'Hand',radius:13},order:34}}));
  parts.push(part(name+'biceps',name+'Upper','M4-8Q19-15 31-6Q20-8 11 1Z',highlight,{stroke:'none',strokeWidth:0,spatial:{order:35}}));
  parts.push(part(name+'grip',name+'Hand','M-7-5Q-3-10 5-8L10-3V6Q3 10-6 5Z',skin,{spatial:{order:105}}));
 }
 parts.push(part('trunk','torso','M-38-25Q-29-37-15-33Q0-25 15-33Q30-37 38-25L31 4Q24 18 22 38Q0 46-22 38Q-24 18-31 4Z',skin,{spatial:{order:20}}));
 parts.push(part('left-pec','torso','M-31-23Q-15-32-2-17L-2-2Q-20 7-32-4Z',highlight,{stroke:shadow,strokeWidth:1.5,spatial:{order:21}}),part('right-pec','torso','M31-23Q15-32 2-17L2-2Q20 7 32-4Z',highlight,{stroke:shadow,strokeWidth:1.5,spatial:{order:21}}));
 parts.push(part('abs','torso','M-12 9Q0 4 12 9M-12 19Q0 14 12 19M-10 29Q0 24 10 29M0 5V34','none',{stroke:shadow,strokeWidth:2,spatial:{order:22}}));
 parts.push(part('shorts','root','M-25-10Q0-4 25-10L29 28L5 30L0 13L-5 30L-29 28Z','#33465f',{spatial:{order:32}}),part('shorts-stripe','root','M-24-5L-20 24M24-5L20 24','none',{stroke:'#93d2be',strokeWidth:4,spatial:{order:33}}));
 parts.push(part('head-shape','head','M-24-16Q-22-31 0-32Q23-31 24-16L21 14Q11 28 0 28Q-11 28-21 14Z',skin,{spatial:{order:40,thickness:.65,axis:'x'}}));
 parts.push(part('hair','head','M-24-9L-25-24Q-15-36 0-36Q15-39 25-25L23-7L16-22Q6-16-8-24L-18-20Z','#40332e',{spatial:{order:43}}),part('beard','head','M-21 9L-12 13L-7 8Q0 5 7 8L12 13L21 9Q18 27 0 29Q-18 27-21 9Z','#534037',{strokeWidth:1.5,spatial:{order:44}}));
 parts.push(part('eyes','face-neutral',circle(-9,-5,3)+circle(9,-5,3),'#252b36',{opacityChannel:'face-neutral.opacity',strokeWidth:0,spatial:{order:50}}),part('eyebrows','head','M-16-13L-5-15M5-15L16-13','none',{stroke:'#45332e',strokeWidth:3,spatial:{order:51}}));
 parts.push(part('effort','face-effort','M-15-5L-7-2L-15 1M15-5L7-2L15 1M-7 15Q0 10 7 15L5 19H-5Z','#faf0dc',{opacityChannel:'face-effort.opacity',strokeWidth:2,spatial:{order:52}}),part('blink','face-blink','M-14-4Q-9 1-4-4M4-4Q9 1 14-4','none',{opacityChannel:'face-blink.opacity',strokeWidth:2,spatial:{order:52}}));
 parts.push(part('sweat-drop','sweat','M27-14Q39 0 31 4Q21 4 27-14Z','#9bdeeb',{opacityChannel:'sweat.opacity',stroke:'#428aa2',strokeWidth:1,spatial:{order:54}}),part('strain-lines','effort-lines','M-35-19L-43-23M-37-7L-46-6M35-19L43-23M37-7L46-6','none',{opacityChannel:'effort-lines.opacity',stroke:'#dc8268',strokeWidth:3,spatial:{order:54}}));
 parts.push(part('barbell-shaft','barbell','M-96 0H96','none',{stroke:'#c1d0d7',strokeWidth:6,spatial:{order:90}}));
 for(const side of [-1,1]){parts.push(part('plate-'+(side<0?'left':'right'),'barbell',`M${side*74-9}-26h18v52h-18Z`,'#405d70',{stroke:'#182d3c',strokeWidth:3,spatial:{order:93}}),part('collar-'+(side<0?'left':'right'),'barbell',`M${side*91-3}-13h6v26h-6Z`,'#ced9de',{strokeWidth:1,spatial:{order:94}}));}
 const clips={};for(const mode of gymModes){const duration=mode==='workout'?60:20,times=new Set(Array.from({length:duration*15+1},(_,i)=>+(i/15).toFixed(6)));for(let cycle=0;cycle<duration/20;cycle++){for(const t of [0,.1,.65,1.2,8.4,8.85,10.65,11.5,12,15,15.35,16.2,18.4,20])times.add(+(cycle*20+t).toFixed(6));for(let n=0;n<=16;n++)times.add(+(cycle*20+1.2+n*.45).toFixed(6));}const tracks={};for(const t of [...times].sort((a,b)=>a-b)){const sample=t===duration?gymPose(0,mode):gymPose(t,mode);for(const [key,value]of Object.entries(sample))(tracks[key]??=[]).push([t,+value.toFixed(5),'linear']);}for(const [key,keys]of Object.entries(tracks))tracks[key]=keys.filter((v,i)=>i===0||i===keys.length-1||v[1]!==keys[i-1][1]||v[1]!==keys[i+1][1]);clips[mode]={duration,loop:true,tracks};}
 const inputs={action:{type:'string',default:'workout',options:gymModes}},states=Object.fromEntries(gymModes.map(id=>[id,{clip:id,transitions:gymModes.filter(v=>v!==id).map(to=>({to,duration:.15,when:{input:'action',equals:to}}))}]));
 return {name:'Atlas · gym athlete',spatial:true,joints,parts,clips,inputs,initial:'workout',states,provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};
}
function equipment(){const joints=[joint('root',null)],parts=[part('wall','root','M0 0H800V390H0Z','#e5e7e5',{strokeWidth:0}),part('floor','root','M0 390H800V450H0Z','#9cafb4',{strokeWidth:0}),part('wall-panels','root','M0 115H800M0 235H800M400 0V390','none',{stroke:'#d2d9d7',strokeWidth:2}),part('window','root','M318 30H470V169H318Z','#a2c3c8',{stroke:'#718f99',strokeWidth:7}),part('window-bars','root','M394 31V168M319 99H469','none',{stroke:'#e1eeea',strokeWidth:5}),part('pullup-frame','root','M86 390V150Q86 122 112 122H248Q274 122 274 150V390M74 390H110M252 390H287','none',{stroke:'#3c5265',strokeWidth:12}),part('pullup-grip','root','M105 150H255','none',{stroke:'#233445',strokeWidth:9}),part('rubber-mat','root','M77 396H286V406H77Z','#506777',{strokeWidth:0}),part('bench-mat','root','M487 396H738V406H487Z','#506777',{strokeWidth:0}),part('bench-legs','root','M537 327L524 390M682 327L697 390M514 390H543M682 390H710','none',{stroke:'#456275',strokeWidth:9}),part('bench-pad','root','M510 315Q509 308 517 308H706Q715 309 713 323H510Z','#31505f',{stroke:'#203d4b',strokeWidth:2}),part('bench-rack','root','M501 390V235H516M669 390V235H654','none',{stroke:'#58788b',strokeWidth:8}),part('wall-line','root','M320 364H463','none',{stroke:'#b5c3c4',strokeWidth:4})];return {name:'Gym stations',spatial:true,joints,parts,clips:{still:{duration:1,loop:true,tracks:{}}},inputs:{},initial:'still',states:{still:{clip:'still'}},provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};}
function buildGym(){return {schemaVersion:1,kind:'scene',id:'gym-routine',name:'One more rep',revision:0,bounds:{width:800,height:450},requiredFeatures:['spatial-rig','soft-limbs','scene-groups','scene-lighting'],groups:[{id:'gym',name:'Gym / equipment',parent:null},{id:'athlete',name:'Atlas / character',parent:null}],packs:{gym:equipment(),atlas:lifter()},actors:[{id:'gym',name:'Gym stations',pack:'gym',layer:'background',unlit:true,group:'gym',transform:{x:0,y:0,scale:1,rotation:0}},{id:'atlas',name:'Atlas',pack:'atlas',group:'athlete',groundY:390,transform:{x:0,y:0,scale:1,rotation:0},inputs:{action:'workout'},behavior:{mode:'animated',autoFace:false}}],lighting:{enabled:true,shading:'cel',type:'directional',receiver:'floor',angle:-130,elevation:50,intensity:.45,ambient:.78,color:'#fff2de',shadowColor:'#283b48',floorY:390,wallY:330,floorShadow:.19,wallShadow:0,reflection:0,softness:3,celThickness:.25,celIntensity:.34,gloss:.15}};}

let cachedGym;
export function createGym(){return structuredClone(cachedGym??=buildGym());}
export const gymBeat=gymPhase;
