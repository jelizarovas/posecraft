import {clamp} from '../src/index.js';
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
const bar={x:180,y:150,grip:43},bench={x:650,y:330,barX:585,barY:270,grip:40};
// Alternate world-space support anchors. Only the swinging foot moves; its
// partner remains planted while the pelvis passes over it.
export function gymWalk(time,start,end,from,to){
 const duration=end-start,age=clamp(time-start,0,duration),direction=Math.sign(to-from),steps=20,dt=duration/steps;
 const progress=a=>{const q=clamp(a/duration,0,1),r=.06,k=1/(1-r);return q<r?k*q*q/(2*r):q>1-r?1-k*(1-q)**2/(2*r):k*(q-r/2);};
 const rootAt=a=>lerp(from,to,progress(a)),x=rootAt(age),blend=between(age,0,dt)*(1-between(age,duration-dt,duration)),feet={};
 for(const [name,side,parity]of [['left',-1,0],['right',1,1]]){
  let last=parity;while(last+2<steps&&(last+2)*dt<=age)last+=2;
  const swingStart=last*dt,q=clamp((age-swingStart)/(dt*.78),0,1),previous=last<2?from+side*18:rootAt((last-1)*dt)-direction*Math.abs(to-from)/steps*.25+side*5;
  const target=last>=steps-2?to+side*18:rootAt((last+1)*dt)-direction*Math.abs(to-from)/steps*.25+side*5;
  feet[name]=age<swingStart?{x:from+side*18,y:383,planted:true}:{x:lerp(previous,target,ease(q)),y:383-12*Math.sin(Math.PI*q),planted:q>=1,rotation:-direction*16*Math.sin(Math.PI*q)};
 }
 const reach=Math.max(...Object.entries(feet).map(([name,foot])=>Math.abs(foot.x-x-lerp((name==='left'?-1:1)*16,(name==='left'?-1:1)*5,blend))));
 const supportY=371-Math.sqrt(Math.max(1,71.8**2-reach**2));
 return {x,y:lerp(300,supportY,blend),blend,direction,feet};
}
export function gymPose(time,mode='workout'){
 const t=((time%60)+60)%60,{outcome}=gymPhase(time,mode),pose={},walking=t>=29&&t<36?gymWalk(t,29,36,180,710):t>=52.5&&t<59?gymWalk(t,52.5,59,710,180):null;
 const sit=between(t,36,38)*(1-between(t,51,52.5)),lying=between(t,38,40)*(1-between(t,49,51)),hang=between(t,4.6,6)*(1-between(t,25,26.5));
 let x=walking?.x??(t>=36&&t<52.5?710-35*sit:180),y=walking?.y??300,lift=0,effort=0,shake=0;
 if(t>=6&&t<24){const index=repEnds.findIndex(end=>t<end),start=index?repEnds[index-1]:6,duration=gymTiming.repDurations[index];if(index<outcome){const q=(t-start)/duration;lift=q<.52?ease(q/.52):q<.62?1:1-ease((q-.62)/.38);effort=lift*(.55+index*.065);shake=index>4?Math.sin(t*22)*.6*lift:0;}else{const start=repEnds[outcome-1],q=(t-start)/(24-start),up=ease(q/.28),down=1-ease((q-.76)/.24);lift=.56*up*down;effort=up*down;shake=Math.sin(t*28)*1.5*up*down;}}
 y-=4*hang+70*lift+shake;y=lerp(y,326,sit);y=lerp(y,330,lying);
 const tired=(outcome<8?1:.45)*between(t,25,26.5)*(1-between(t,28.3,29)),anticipation=(outcome<8?.7:.3)*Math.sin(Math.PI*clamp(t/4,0,1))**2,breath=Math.sin(t*3.2)*1.3*(tired+anticipation);
 pose['root.x']=x;pose['root.y']=y;pose['torso.x']=-52*lying;pose['torso.y']=48*lying+breath;pose['torso.rotation']=-90*lying-15*tired-7*anticipation;pose['torso.yaw']=(walking?.direction||1)*40*(walking?.blend||0);pose['head.rotation']=20*lying+8*tired;pose['head.yaw']=48*lying+(walking?.direction||1)*10*(walking?.blend||0);pose['head.pitch']=-10*effort+12*tired+7*anticipation;
 let weightY=bench.barY,pressEffort=0;const benchEnds=[43.05,45.35,48];if(t>=41&&t<48){const index=benchEnds.findIndex(end=>t<end),start=index?benchEnds[index-1]:41,q=(t-start)/(benchEnds[index]-start);pressEffort=q<.42?ease(q/.42):q<.55?1:1-ease((q-.55)/.45);weightY+=32*pressEffort+(index===2?Math.sin(t*24)*.7*pressEffort:0);}
 pose['barbell.x']=bench.barX-x;pose['barbell.y']=weightY-y;pose['barbell.z']=-.3*(1-between(t,40,41)*(1-between(t,48,49)));pose['pullbar.x']=bar.x-x;pose['pullbar.y']=bar.y-y;pose['pullbar.z']=10;
 const hesitation=outcome<8&&t<4?.24*Math.sin(Math.PI*clamp((t-.6)/2.8,0,1))**2:0,grip=between(t,4,6)*(1-between(t,25,26.5))+hesitation,reachBench=between(t,40,41)*(1-between(t,48,49));
 for(const [name,side] of [['left',-1],['right',1]]){
  const shoulder=mix({x:side*lerp(34,25,walking?.blend||0),y:-68+breath},{x:side<0?-70:-60,y:side<0?-8:8},lying);pose[name+'Upper.x']=shoulder.x-side*34;pose[name+'Upper.y']=shoulder.y+68;pose[name+'Upper.z']=side<0&&lying>.5?-1:15;
  const stride=walking?clamp((walking.feet[name].x-x-side*5)/32,-1,1):0,resting={x:side*43-stride*9,y:5+stride*4};let hand=mix(resting,{x:bar.x+side*bar.grip-x,y:bar.y-y},grip);
  hand=mix(hand,{x:side*30,y:12},Math.max(sit,tired*.6));if(lying>0)hand=mix(hand,{x:side<0?-48:-18,y:22},lying);if(reachBench>0)hand=mix(hand,{x:bench.barX+side*bench.grip-x,y:weightY-y},reachBench);
  const arm=solve(shoulder,hand,40,side<0?-1:1);pose[name+'Upper.rotation']=arm.upper;pose[name+'Lower.rotation']=arm.lower;pose[name+'Hand.rotation']=arm.wrist;pose[name+'Hand.z']=12;
  const hip={x:lerp(side*16,side*5,walking?.blend||0),y:12},homeFoot={x:side*18,y:83-3*hang},seatedFoot={x:(side<0?692:728)-x,y:383-y},target=t>=36&&t<52.5?seatedFoot:homeFoot,foot=walking?{x:walking.feet[name].x-x,y:walking.feet[name].y-y}:target;
  const bend=walking?walking.direction>0?-1:1:sit>.01?-1:side<0?1:-1,leg=solve(hip,foot,36,bend);pose[name+'Thigh.x']=hip.x-side*16;pose[name+'Thigh.y']=0;pose[name+'Thigh.rotation']=leg.upper;pose[name+'Calf.rotation']=leg.lower;pose[name+'Foot.rotation']=leg.wrist+(walking?.feet[name].rotation||0);pose[name+'Foot.yaw']=walking?.direction<0?180*walking.blend:0;pose[name+'Thigh.z']=side<0?.008:.012;
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
 const joints=[joint('root',null),joint('torso','root',0,-48),joint('head','torso',0,-58),...['face','face-neutral','face-effort','face-blink','sweat','effort-lines'].map(id=>joint(id,'head'))];
 for(const [name,side] of [['left',-1],['right',1]])joints.push(joint(name+'Upper','root',side*34,-68,40),joint(name+'Lower',name+'Upper',40,0,40),joint(name+'Hand',name+'Lower',40),joint(name+'Thigh','root',side*16,12,36),joint(name+'Calf',name+'Thigh',36,0,36),joint(name+'Foot',name+'Calf',36));
 joints.push(joint('barbell','root'),joint('pullbar','root'));
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
 parts.push(part('hair','head','M-24-9L-25-24Q-15-36 0-36Q15-39 25-25L23-7L16-22Q6-16-8-24L-18-20Z','#40332e',{spatial:{order:43}}),part('beard','face','M-21 9L-12 13L-7 8Q0 5 7 8L12 13L21 9Q18 27 0 29Q-18 27-21 9Z','#534037',{strokeWidth:1.5,spatial:{order:44}}));
 parts.push(part('eyes','face-neutral',circle(-9,-5,3)+circle(9,-5,3),'#252b36',{opacityChannel:'face-neutral.opacity',strokeWidth:0,spatial:{order:50}}),part('eyebrows','face','M-16-13L-5-15M5-15L16-13','none',{stroke:'#45332e',strokeWidth:3,spatial:{order:51}}));
 parts.push(part('effort','face-effort','M-15-5L-7-2L-15 1M15-5L7-2L15 1M-7 15Q0 10 7 15L5 19H-5Z','#faf0dc',{opacityChannel:'face-effort.opacity',strokeWidth:2,spatial:{order:52}}),part('blink','face-blink','M-14-4Q-9 1-4-4M4-4Q9 1 14-4','none',{opacityChannel:'face-blink.opacity',strokeWidth:2,spatial:{order:52}}));
 parts.push(part('nose','face','M0-2Q4 0 6 4L0 5',highlight,{stroke:shadow,strokeWidth:1,spatial:{order:53}}));
 parts.push(part('sweat-drop','sweat','M27-14Q39 0 31 4Q21 4 27-14Z','#9bdeeb',{opacityChannel:'sweat.opacity',stroke:'#428aa2',strokeWidth:1,spatial:{order:54}}),part('strain-lines','effort-lines','M-35-19L-43-23M-37-7L-46-6M35-19L43-23M37-7L46-6','none',{opacityChannel:'effort-lines.opacity',stroke:'#dc8268',strokeWidth:3,spatial:{order:54}}));
 parts.push(part('barbell-shaft','barbell','M-96 0H96','none',{stroke:'#c1d0d7',strokeWidth:6,spatial:{order:90}}));
 for(const side of [-1,1]){parts.push(part('plate-'+(side<0?'left':'right'),'barbell',`M${side*74-9}-26h18v52h-18Z`,'#405d70',{stroke:'#182d3c',strokeWidth:3,spatial:{order:93}}),part('collar-'+(side<0?'left':'right'),'barbell',`M${side*91-3}-13h6v26h-6Z`,'#ced9de',{strokeWidth:1,spatial:{order:94}}));}
 parts.push(part('pullup-front-bar','pullbar','M-75 0H75','none',{stroke:'#233445',strokeWidth:9,spatial:{order:80}}));
 const clips={};for(const mode of gymModes){const duration=mode==='workout'?180:60,times=new Set(Array.from({length:duration*15+1},(_,i)=>+(i/15).toFixed(6)));for(let cycle=0;cycle<duration/60;cycle++){for(const t of [...phaseRanges.flatMap(r=>[r[1],r[2]]),...repEnds])times.add(+(cycle*60+t).toFixed(6));}const tracks={};for(const t of [...times].sort((a,b)=>a-b)){const sample=t===duration?gymPose(0,mode):gymPose(t,mode);for(const [key,value]of Object.entries(sample))(tracks[key]??=[]).push([t,+value.toFixed(5),'linear']);}for(const [key,keys]of Object.entries(tracks))tracks[key]=compactKeys(keys,key.endsWith('opacity')?.025:key.endsWith('rotation')?(/Thigh|Calf|Foot/.test(key)?.65:1.7):.8);clips[mode]={duration,loop:true,tracks};}
 const inputs={action:{type:'string',default:'workout',options:gymModes}},states=Object.fromEntries(gymModes.map(id=>[id,{clip:id,transitions:gymModes.filter(v=>v!==id).map(to=>({to,duration:.15,when:{input:'action',equals:to}}))}]));
 return {name:'Atlas · gym athlete',spatial:true,joints,parts,clips,inputs,initial:'workout',states,provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};
}
function equipment(){const joints=[joint('root',null)],parts=[part('wall','root','M0 0H800V390H0Z','#e5e7e5',{strokeWidth:0}),part('floor','root','M0 390H800V450H0Z','#9cafb4',{strokeWidth:0}),part('wall-panels','root','M0 115H800M0 235H800M400 0V390','none',{stroke:'#d2d9d7',strokeWidth:2}),part('window','root','M318 30H470V169H318Z','#a2c3c8',{stroke:'#718f99',strokeWidth:7}),part('window-bars','root','M394 31V168M319 99H469','none',{stroke:'#e1eeea',strokeWidth:5}),part('pullup-frame','root','M86 390V150Q86 122 112 122H248Q274 122 274 150V390M74 390H110M252 390H287','none',{stroke:'#3c5265',strokeWidth:12}),part('pullup-grip','root','M105 150H255','none',{stroke:'#233445',strokeWidth:9}),part('rubber-mat','root','M77 396H286V406H77Z','#506777',{strokeWidth:0}),part('bench-mat','root','M487 396H738V406H487Z','#506777',{strokeWidth:0}),part('bench-legs','root','M537 355L524 390M682 355L697 390M514 390H543M682 390H710','none',{stroke:'#456275',strokeWidth:9}),part('bench-pad','root','M510 347Q509 340 517 340H706Q715 341 713 355H510Z','#31505f',{stroke:'#203d4b',strokeWidth:2}),part('bench-rack','root','M501 390V260H516M669 390V260H654','none',{stroke:'#58788b',strokeWidth:8}),part('wall-line','root','M320 364H463','none',{stroke:'#b5c3c4',strokeWidth:4})];return {name:'Gym stations',spatial:true,joints,parts,clips:{still:{duration:1,loop:true,tracks:{}}},inputs:{},initial:'still',states:{still:{clip:'still'}},provenance:{source:'Original Posecraft gym artwork',license:'MIT'}};}
function buildGym(){return {schemaVersion:1,kind:'scene',id:'gym-routine',name:'One more rep',revision:0,bounds:{width:800,height:450},requiredFeatures:['spatial-rig','soft-limbs','scene-groups','scene-lighting','contacts'],groups:[{id:'gym',name:'Gym / equipment',parent:null},{id:'athlete',name:'Atlas / character',parent:null}],contacts:['left','right'].flatMap((side,i)=>{const chain={upper:side+'Upper',lower:side+'Lower',end:side+'Hand'},base={enabled:true,actor:'atlas',chain,bend:i?-1:1,weight:1,period:60};return [{...base,id:side+'-pullup',name:side+' hand / pull-up bar',target:{type:'joint',actor:'gym',joint:'root',offsetX:i?223:137,offsetY:150},start:6,end:25},{...base,id:side+'-bench',name:side+' hand / barbell',target:{type:'joint',actor:'atlas',joint:'barbell',offsetX:i?40:-40,offsetY:0},start:41,end:48}];}),packs:{gym:equipment(),atlas:lifter()},actors:[{id:'gym',name:'Gym stations',pack:'gym',layer:'background',unlit:true,group:'gym',transform:{x:0,y:0,scale:1,rotation:0}},{id:'atlas',name:'Atlas',pack:'atlas',group:'athlete',groundY:390,transform:{x:0,y:0,scale:1,rotation:0},inputs:{action:'workout'},behavior:{mode:'animated',autoFace:false}}],lighting:{enabled:true,shading:'cel',type:'directional',receiver:'floor',angle:-130,elevation:50,intensity:.45,ambient:.78,color:'#fff2de',shadowColor:'#283b48',floorY:390,wallY:330,floorShadow:.19,wallShadow:0,reflection:0,softness:3,celThickness:.25,celIntensity:.34,gloss:.15}};}

let cachedGym;
export function createGym(){return structuredClone(cachedGym??=buildGym());}
export const gymBeat=gymPhase;
