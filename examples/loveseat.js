import dummy from './characters/dummy.json' with {type:'json'};
import {addSpatialRig} from './spatial-rigs.js';
import {forwardKinematics} from '../src/index.js';
export const loveseatActions=['carry','rest-left','rest-right'];
const RAD=Math.PI/180,STEP=60,RISE=18,BASE=480,ROOT_X=[260,560],saturate=t=>Math.max(0,Math.min(1,t)),ease=t=>{t=saturate(t);return t*t*(3-2*t);},wrap=a=>((a+540)%360)-180;
const joint=(id,parent,x=0,y=0,rotation=0)=>({id,parent,x,y,rotation,min:-180,max:180,length:0});
const path=(id,joint,d,fill,extra={})=>({id,joint,d,fill,...extra});
const oval=(x,y,rx,ry)=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`;
const bare=name=>({name,spatial:true,joints:[joint('root',null)],parts:[],clips:{},inputs:{action:{type:'string',default:'carry',options:loveseatActions}},states:{},initial:'carry'});
const actor=(id,name,pack,group,extra={})=>({id,name,pack,group,transform:{x:0,y:0,rotation:0,scale:1},behavior:{mode:'animated',autoFace:false},inputs:{action:'carry'},...extra});
const transform=(p,t)=>{const a=t.rotation*RAD;return {x:t.x+p.x*Math.cos(a)-p.y*Math.sin(a),y:t.y+p.x*Math.sin(a)+p.y*Math.cos(a)};};
const blend=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const restEnvelope=(t,start,end)=>ease((t-start)/.4)*(1-ease((t-(end-.5))/.5));
// A loaded step-to gait: lift the leading foot before advancing, plant it,
// transfer the weight, then bring the trailing foot onto the same tread.
const gaitProgress=(t,action)=>action!=='carry'?0:t<4?3*t/4:t<6?3:t<10?3+3*(t-6)/4:6;
function gaitAt(t,action){const progress=gaitProgress(t,action),step=Math.floor(progress),phase=progress-step;return {step,phase,moving:action==='carry'&&(t<4||t>=6&&t<10),travel:STEP*(step+ease(phase))};}
function footAt(rootX,gait,side){
 const phase=gait.phase,start=side===1?.05:.55,end=side===1?.45:.95,q=saturate((phase-start)/(end-start));
 const tread=Math.floor(rootX/STEP)+gait.step,ground=BASE-tread*RISE,initialX=rootX+(side===0?-12:12)+gait.step*STEP;
 const advance=ease((q-.2)/.6),lift=(RISE+8)*ease(q/.3)-8*ease((q-.8)/.2);
 return {x:initialX+STEP*advance-gait.travel,y:ground-5-lift+gait.travel*RISE/STEP,planted:q===0||q===1,phase:q};
}
function bodyAt(index,gait){
 const feet=[footAt(ROOT_X[index],gait,0),footAt(ROOT_X[index],gait,1)];
 const shift=gait.phase<.5?-5*Math.sin(Math.PI*ease(gait.phase/.5)):5*Math.sin(Math.PI*ease((gait.phase-.5)/.5));
 const x=ROOT_X[index]+shift;
 // Keep both legs inside their reachable envelope. A planted leg stays long
 // while the other knee lifts; the pelvis rises only after the high foot bears weight.
 const heights=feet.map((foot,side)=>foot.y-Math.sqrt(72*72-(foot.x-x-(side===0?-12:12))**2)-10);
 const y=(heights[0]+heights[1]+Math.hypot(heights[0]-heights[1],3))/2;
 return {x,y,feet};
}
export function loveseatBeat(time,action='carry'){
 const duration=action==='carry'?12:6,t=((time%duration)+duration)%duration,gait=gaitAt(t,action),distance=gait.travel;
 const rests=action==='carry'?[restEnvelope(t,4,6),restEnvelope(t,10,12)]:action==='rest-left'?[restEnvelope(t,.7,5.4),0]:[0,restEnvelope(t,.7,5.4)];
 const sway=Math.sin(t*Math.PI*2/3),strain=rests[0]-rests[1],body=bodyAt(0,gait),base=bodyAt(0,gaitAt(0,'carry'));
 const sofa={x:400+(body.x-base.x)*.6+strain*1.5,y:218+(body.y-base.y)*.8+Math.abs(strain),rotation:-17+strain*1.5};
 return {time:t,duration,distance,rests,sway,sofa,gait};
}
const phaseTime=phase=>{let lo=0,hi=4;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(gaitProgress(mid,'carry')<phase)lo=mid;else hi=mid;}return (lo+hi)/2;};
/** Deterministic review points in the first loaded step (seconds). */
export const loveseatPhaseTimes={stand:0,lift:phaseTime(.09),clearRiser:phaseTime(.15),leadSwing:phaseTime(.25),leadPlant:phaseTime(.45),transfer:phaseTime(.5),followLift:phaseTime(.59),followSwing:phaseTime(.75),settle:phaseTime(.97),lowerRest:4.9,upperRest:10.9};
export const loveseatBeats=[{id:'lift',label:'Lift and plant',start:0,end:phaseTime(.5)},{id:'transfer',label:'Transfer the weight',start:phaseTime(.5),end:phaseTime(1)},{id:'climb',label:'Climb together',start:phaseTime(1),end:4},{id:'rest-lower',label:'Lower carrier rests',start:4,end:6},{id:'climb-again',label:'Another three steps',start:6,end:10},{id:'rest-upper',label:'Upper carrier rests',start:10,end:12}];
function solve(shoulder,target,l1,l2,bend=1){const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=Math.hypot(dx,dy),reach=Math.min(l1+l2-.001,Math.max(Math.abs(l1-l2)+.001,d)),a=Math.atan2(dy,dx)+bend*Math.acos(Math.max(-1,Math.min(1,(reach*reach+l1*l1-l2*l2)/(2*reach*l1)))),elbow={x:shoulder.x+Math.cos(a)*l1,y:shoulder.y+Math.sin(a)*l1};return {upper:a/RAD,lower:wrap(Math.atan2(target.y-elbow.y,target.x-elbow.x)/RAD-a/RAD),distance:d};}
export const loveseatHandles={lowerLeft:{x:-128,y:43},lowerRight:{x:-115,y:36},upperLeft:{x:115,y:36},upperRight:{x:128,y:43}};
function carrierPose(pack,index,beat){
 const body=bodyAt(index,beat.gait),x=body.x,rootY=body.y+beat.sway*.25+(index?beat.rests[0]:beat.rests[1])*1.5;
 const rest=beat.rests[index],partner=beat.rests[1-index],lean=(index?-5:7)+(index?-1:1)*partner*6-rest*2,pose={'root.x':x,'root.y':rootY,'torso.rotation':-90+lean,'head.rotation':90-lean+beat.sway,'head.yaw':index?-12:18,'head.pitch':-4-partner*3,'strain.opacity':.5+partner*.5,'sweat.opacity':.35+partner*.6};
 const feet=[];
 for(const [side,n] of [['left',0],['right',1]]){
  const foot=body.feet[n],hip={x:x+(side==='left'?-12:12),y:rootY+10},leg=solve(hip,foot,39,36,-1);feet.push(foot);
  pose[side+'Contact.opacity']=foot.planted?.13:0;pose[side+'Thigh.rotation']=leg.upper;pose[side+'Calf.rotation']=leg.lower;pose[side+'Foot.rotation']=wrap(-leg.upper-leg.lower);pose[side+'Foot.yaw']=0;pose[side+'Foot.pitch']=0;
 }
 const world=forwardKinematics(pack.joints,pose),hands={};
 for(const side of ['left','right']){
  const handle=(index?'upper':'lower')+(side==='left'?'Left':'Right'),grip=transform(loveseatHandles[handle],beat.sofa),released=(index===0&&side==='left'||index===1&&side==='right')?rest:0,restPoint={x:x+(index?23:-23),y:rootY-5},target=blend(grip,restPoint,released),shoulder=world[side+'Upper'],arm=solve(shoulder,target,32,29,side==='left'?-1:1),torso=world.torso.rotation;
  pose[side+'Upper.rotation']=wrap(arm.upper-torso);pose[side+'Lower.rotation']=arm.lower;pose[side+'Hand.rotation']=wrap(beat.sofa.rotation-arm.upper-arm.lower);pose[side+'Upper.yaw']=0;pose[side+'Lower.yaw']=0;pose[side+'Hand.yaw']=0;pose[side+'Hand.pitch']=released*25;
  hands[side]={target,handle,released,distance:arm.distance};
 }
 return {pose,feet,hands};
}
function bake(pack,sample){
 for(const action of loveseatActions){const duration=action==='carry'?12:6,tracks={};for(let n=0;n<=duration*40;n++){const time=n/40,value=sample(loveseatBeat(time===duration?0:time,action),action,time);for(const [key,v] of Object.entries(value))(tracks[key]??=[]).push([time,+v.toFixed(6),'linear']);}
  for(const [key,keys] of Object.entries(tracks))tracks[key]=keys.filter((v,i)=>i===0||i===keys.length-1||v[1]!==keys[i-1][1]||v[1]!==keys[i+1][1]);pack.clips[action]={duration,loop:true,tracks};pack.states[action]={clip:action,transitions:loveseatActions.filter(a=>a!==action).map(to=>({to,duration:0,when:{input:'action',equals:to}}))};
 }
 pack.inputs.action={type:'string',default:'carry',options:loveseatActions};pack.initial='carry';
}
function stairs(){
 const p=bare('Endless staircase');
 // Geometry extends far beyond the viewport; six identical steps wrap per loop.
 for(let n=-14;n<=28;n++){const id='step-'+(n<0?'n'+(-n):n);p.joints.push(joint(id,'root',n*STEP,BASE-n*RISE));p.parts.push(path(id+'-riser',id,`M0 0H${STEP}V650H0Z`,n%2?'#677c7a':'#6f8581'),path(id+'-tread',id,`M0 0H${STEP}L${STEP+12} -7H12Z`,'#a1b2a6',{stroke:'#d2d6bd',strokeWidth:1}),path(id+'-edge',id,`M0 0H${STEP}`,'none',{stroke:'#425955',strokeWidth:2}));}
 bake(p,(beat,action,time)=>{const d=action==='carry'&&time===12?STEP*6:beat.distance;return {'root.x':-d,'root.y':d*RISE/STEP};});return p;
}
function room(){const p=bare('Warm stairwell');p.parts.push(path('wall','root','M0 0H800V450H0Z','#eee4d2'),path('window-trim','root','M48 47Q48 35 60 35H181Q194 35 194 48V207H48Z','#d2c3a7'),path('window','root','M58 47H184V194H58Z','#bdced0'),path('window-light','root','M58 47H120V194H58Z','#dbe5df'),path('window-bars','root','M121 47V194M58 117H184','none',{stroke:'#f6f0e4',strokeWidth:6}),path('window-sill','root','M42 195H201V207H42Z','#fff7e9'),path('sunbeam','root','M184 47L414 287L255 340L58 194Z','#f5ecdb'),path('wall-rail','root','M-80 385L880 111','none',{stroke:'#c4b194',strokeWidth:8}),path('rail-highlight','root','M-80 382L880 108','none',{stroke:'#faf1de',strokeWidth:2}));const beam=p.parts.splice(p.parts.findIndex(part=>part.id==='sunbeam'),1);p.parts.splice(1,0,...beam);bake(p,()=>({}));return p;}
function sofa(){const p=bare('Upholstered loveseat');p.parts.push(path('back-frame','root','M-124 -51Q-124 -76 -98 -76H98Q124 -76 124 -51V40H-124Z','#884b55',{stroke:'#603e45',strokeWidth:2}),path('left-back-cushion','root','M-112 -53Q-112 -65 -98 -65H-10Q-3 -65 -3 -53V3H-112Z','#c17b7e',{stroke:'#dda19b',strokeWidth:1.5}),path('right-back-cushion','root','M3 -53Q3 -65 15 -65H98Q112 -65 112 -53V3H3Z','#bb7076',{stroke:'#dda19b',strokeWidth:1.5}),path('tuft-left','root',oval(-57,-31,3,3),'#9b5963'),path('tuft-right','root',oval(57,-31,3,3),'#9b5963'),path('seat-base','root','M-123 13H123V56Q0 68 -123 56Z','#95505d',{stroke:'#603e45',strokeWidth:2}),path('seat-cushions','root','M-113 4Q-60 -3 -3 4V30H-113ZM3 4Q60 -3 113 4V30H3Z','#d08b86',{stroke:'#e1a49a',strokeWidth:1.5}),path('lower-piping','root','M-119 48Q0 57 119 48','none',{stroke:'#c98381',strokeWidth:2}),path('left-armrest','root','M-137 -21Q-137 -34 -124 -34H-109Q-98 -34 -98 -20V44H-131Z','#b1646d',{stroke:'#603e45',strokeWidth:2}),path('right-armrest','root','M98 -20Q98 -34 109 -34H124Q137 -34 137 -21L131 44H98Z','#a85b67',{stroke:'#603e45',strokeWidth:2}),path('feet','root','M-107 57H-94L-98 73H-108ZM94 57H107L108 73H98Z','#664b40'));
 for(const [id,point] of Object.entries(loveseatHandles)){p.joints.push(joint(id,'root',point.x,point.y));p.parts.push(path('handle-'+id,id,'M-7 -3Q0 -7 7 -3V5Q0 9 -7 5Z','none',{stroke:'#e7c08b',strokeWidth:3}));}
 bake(p,beat=>({'root.x':beat.sofa.x,'root.y':beat.sofa.y,'root.rotation':beat.sofa.rotation}));return p;}
function carrier(index){const p=structuredClone(dummy.packs.dummy);addSpatialRig(p,'dummy',{studies:false});p.name=index?'Upper stair carrier':'Lower stair carrier';p.clips={};p.states={};
 for(const j of p.joints){if(/Upper|Lower|Hand/.test(j.id)){j.min=-180;j.max=180;}if(j.id.endsWith('Thigh')){j.min=-25;j.max=125;}if(j.id.endsWith('Calf')){j.min=0;j.max=120;}if(j.id.endsWith('Foot')){j.min=-170;j.max=-30;}}
 p.physics.responses.curl['rightThigh.rotation']=45;p.physics.responses.curl['rightCalf.rotation']=110;
 for(const side of ['left','right']){const j=p.joints.find(j=>j.id===side+'Upper');j.y=side==='left'?-13:13;const foot=p.parts.find(part=>part.id===side+'Foot-shell');foot.d='M-8 -6Q1 -10 17 -5Q22 -3 22 3L20 5H-7Q-10 3 -8 -6Z';foot.fill='#485957';delete foot.channel;p.joints.push(joint(side+'Contact','root'));p.parts.push(path(side+'-tread-contact',side+'Foot',oval(4,6,15,1.8),'#203d38',{opacityChannel:side+'Contact.opacity',spatial:{order:-110,depth:-2}}));}
 p.joints.push(joint('strain','head'),joint('sweat','head'));p.parts.push(path('strain-brows','strain','M-12 -25L-4 -22M4 -22L12 -25','none',{stroke:'#51433b',strokeWidth:1.7,opacityChannel:'strain.opacity',spatial:{depth:14,order:100,facing:'front'}}),path('sweat-drop','sweat','M23 -22Q15 -10 22 -7Q31 -8 23 -22Z','#87b8c4',{stroke:'#517d89',strokeWidth:1,opacityChannel:'sweat.opacity',spatial:{depth:15,order:105}}));
 p.parts.find(part=>part.id==='mouth').d='M-6 -9H6V-4H-6Z';p.parts.find(part=>part.id==='mouth').fill='#fff7e3';delete p.parts.find(part=>part.id==='mouth').variantInput;delete p.parts.find(part=>part.id==='mouth').variants;
 bake(p,beat=>carrierPose(p,index,beat).pose);return p;}
function carryContacts(){
 const result=[];const add=(actor,side,clip,start,end)=>result.push({id:'grip-'+result.length,name:actor+' '+side+' hand'+(clip?' / '+clip:''),enabled:true,actor,chain:{upper:side+'Upper',lower:side+'Lower',end:side+'Hand'},target:{type:'joint',actor:'loveseat',joint:actor+side[0].toUpperCase()+side.slice(1)},bend:side==='left'?1:-1,weight:1,start,end,...clip?{clip}:{}});
 add('lower','right',null,0,180);add('upper','left',null,0,180);
 for(const [actor,side,rest,other,start,end]of [['lower','left','rest-left','rest-right',4,6],['upper','right','rest-right','rest-left',10,12]]){add(actor,side,'carry',0,start);if(end<12)add(actor,side,'carry',end,12);add(actor,side,other,0,6);add(actor,side,rest,0,.7);add(actor,side,rest,5.4,6);}return result;
}
export function createLoveseat(){const lower=carrier(0),upper=carrier(1);return {schemaVersion:1,kind:'scene',id:'loveseat-stairs',name:'One more flight',revision:0,bounds:{width:800,height:450},requiredFeatures:['spatial-rig','scenery-layers','scene-lighting','scene-groups','contacts'],groups:[{id:'scenery',name:'Stairwell',parent:null},{id:'carriers',name:'Carriers',parent:null},{id:'furniture',name:'Furniture',parent:null}],contacts:carryContacts(),packs:{room:room(),stairs:stairs(),loveseat:sofa(),lower,upper},actors:[actor('room','Stairwell','room','scenery',{layer:'background',unlit:true}),actor('stairs','Moving stairs','stairs','scenery',{layer:'background',unlit:true}),actor('loveseat','Loveseat','loveseat','furniture'),actor('lower','Lower carrier','lower','carriers',{inputs:{action:'carry',emotion:'neutral'},appearance:{shell:'#d7b994'}}),actor('upper','Upper carrier','upper','carriers',{inputs:{action:'carry',emotion:'neutral'},appearance:{shell:'#d6cab4'}})],lighting:{enabled:true,shading:'cel',celThickness:.26,celIntensity:.35,type:'directional',angle:-125,elevation:60,intensity:.7,ambient:.76,color:'#fff1d6',shadowColor:'#344d4a',receiver:'floor',floorShadow:0,wallShadow:0,reflection:0,gloss:.08}};}
