import ona from './characters/ona.json' with {type:'json'};
import {addSpatialRig} from './spatial-rigs.js';
import {forwardKinematics} from '../src/index.js';
import {poseDefaults} from '../src/spatial.js';
const joint=(id,parent,x=0,y=0)=>({id,parent,x,y,rotation:0,min:-180,max:180,length:0});
const path=(id,joint,d,fill,extra={})=>({id,joint,d,fill,...extra});
const ellipse=(x,y,rx,ry)=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0`;
const flame='M-28 0C-57 -27 -6 -43 -19 -80C4 -66 7 -45 13 -54C30 -36 42 -20 28 0Z';
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const snack='M-8 -10Q0 -14 8 -10L8 10Q0 14 -8 10Z';
const pack=name=>({name,spatial:true,joints:[joint('root',null)],parts:[],clips:{},inputs:{},states:{},initial:'loop'});
const actor=(id,pack,layer)=>({id,name:id,pack,transform:{x:0,y:0,scale:1,rotation:0},...(layer?{layer,unlit:true}:{}),behavior:{mode:'animated',autoFace:false}});
function loop(p,duration,tracks){p.clips.loop={duration,loop:true,tracks};p.states.loop={clip:'loop',transitions:[]};}
function sky(){
 const p=pack('Night sky and clouds');
 p.parts.push(path('sky','root','M0 0H800V450H0Z','#101d33'),path('moon','root',ellipse(654,65,24,24),'#ecddae'),path('moon-shade','root',ellipse(663,57,23,23),'#101d33'));
 for(let i=0;i<55;i++){const random=k=>{const n=Math.sin(k*12.9898+78.233)*43758.5453;return n-Math.floor(n);},x=18+random(i+17)*765,y=20+random(i+183)*170,r=i%7===0?1.8:.8;p.parts.push(path('star-'+i,'root',ellipse(x,y,r,r),i%3?'#a5b3cb':'#f2dba8'));}
 const tracks={};
 for(let i=0;i<3;i++){const id='cloud-'+i;p.joints.push(joint(id,'root',400,75+i*40));p.parts.push(path(id,id,'M-92 15C-110 -1 -79 -16 -61 -10C-64 -43 -13 -46 1 -19C19 -37 53 -24 53 -7C101 -14 119 25 83 28H-66Z',['#24324b','#29364d','#202f46'][i]));const wrap=60-i*20,start=-300+i*1400/3-400;tracks[id+'.x']=i===0?[[0,start],[60,1100-400,'linear']]:[[0,start],[wrap-.001,1100-400,'step'],[wrap,-300-400,'step'],[60,start,'linear']];}
 p.parts.push(path('mountains','root','M0 270L95 170L175 250L286 153L405 255L503 169L620 265L715 183L800 243V450H0Z','#172b3a'),path('near-hills','root','M0 286Q113 244 246 283T509 274T800 279V450H0Z','#203930'),path('clearing','root','M0 334Q400 277 800 333V450H0Z','#334239'),path('fire-ground','root',ellipse(400,359,170,48),'#4b4b37'));
 for(const x of [28,72,744,785]){p.parts.push(path('pine-'+x,'root',`M${x} 171l-33 85h17l-28 51h88l-28 -51h17Z`,'#132c2b'));}
 for(let i=0;i<2;i++){const id='meteor-'+i;p.joints.push(joint(id,'root',0,0));p.parts.push(path(id,id,'M0 0L-92 -38L-52 -14Z','#eed7a0',{opacityChannel:id+'.opacity'}),path(id+'-head',id,ellipse(0,0,2.4,2.4),'#fff7d9',{opacityChannel:id+'.opacity'}));const t=8+i*27;tracks[id+'.x']=[[0,-100],[t,-100,'step'],[t+.1,160],[t+1.6,780],[t+1.7,1000,'step'],[60,1000]];tracks[id+'.y']=[[0,-100],[t,-100,'step'],[t+.1,10],[t+1.6,155],[t+1.7,-100,'step'],[60,-100]];tracks[id+'.opacity']=[[0,0],[t,0,'step'],[t+.1,1],[t+1.4,1],[t+1.7,0],[60,0]];}
 loop(p,60,tracks);return p;
}
function fire(){
 const p=pack('Campfire, embers and smoke'),tracks={};
 for(let i=0;i<11;i++){const a=i*Math.PI*2/11,x=400+Math.cos(a)*53,y=353+Math.sin(a)*16;p.parts.push(path('stone-'+i,'root',ellipse(x,y,13,8),i%2?'#798077':'#5d6a64'));}
 p.parts.push(path('log-a','root','M360 344L442 358L438 370L357 355Z','#745032'),path('log-b','root','M365 365L439 340L445 350L371 376Z','#956543'),path('log-grain','root','M368 352L431 365M377 368L438 347','none',{stroke:'#3d3528',strokeWidth:2}));
 for(let i=0;i<3;i++){const id='flame-'+i;p.joints.push(joint(id,'root',400+(i-1)*9,352));p.parts.push(path(id,id,flame,['#e96a32','#ffb143','#ffe199'][i],{transform:`scale(${1-i*.26} ${1-i*.15})`}));tracks[id+'.rotation']=Array.from({length:41},(_,k)=>[k*.1,Math.sin(k*1.8+i)*7,'smooth']);tracks[id+'.y']=Array.from({length:41},(_,k)=>[k*.1,Math.sin(k*2.1+i)*4,'smooth']);}
 for(let i=0;i<6;i++){const id='ember-'+i;p.joints.push(joint(id,'root',380+i*8,323));p.parts.push(path(id,id,ellipse(0,0,1.5,3),'#ffcd76',{opacityChannel:id+'.opacity'}));tracks[id+'.y']=[[0,0],[4,-100-i*8]];tracks[id+'.x']=[[0,0],[4,Math.sin(i*2)*36]];tracks[id+'.opacity']=[[0,0],[.3+i*.15,.8],[3,.4],[4,0]];}
 for(let i=0;i<3;i++){const id='smoke-'+i;p.joints.push(joint(id,'root',400+i*5,283-i*23));p.parts.push(path(id,id,ellipse(0,0,12+i*5,7+i*4),'#9da392',{opacityChannel:id+'.opacity'}));tracks[id+'.y']=[[0,0],[4,-35]];tracks[id+'.x']=[[0,0],[4,26]];tracks[id+'.opacity']=[[0,0],[1,.13],[4,0]];}
 loop(p,4,tracks);return p;
}
export function campPhase(time,index=0){const t=(time+index*5)%24;return t<9?'roasting':t<12?'toasting':t<15?'burning':t<17?'blowing':t<20?'eating':t<22?'replacing':'fresh';}
function camper(index,x,scale,colors,hair){
 const p=structuredClone(ona.packs.ona);addSpatialRig(p,'ona');p.name='Camper '+(index+1);const right=x<400,arm=right?'rightArm':'leftArm',free=right?'leftArm':'rightArm',sign=right?1:-1,rootY=365-58*scale,rest=poseDefaults(p),w=forwardKinematics(p.joints,rest)[arm],r=w.rotation*Math.PI/180,hand={x:w.x+sign*14*Math.cos(r)-30*Math.sin(r),y:w.y+sign*14*Math.sin(r)+30*Math.cos(r)},target={x:(400+[-32,-10,12,34][index]-x)/scale,y:([267,275,269,279][index]-rootY)/scale},dx=target.x-hand.x,dy=target.y-hand.y,angle=((Math.atan2(dy,dx)*180/Math.PI-w.rotation+540)%360)-180,length=Math.hypot(dx,dy);
 p.joints.push(joint('skewer',arm,sign*14,30),joint('food','root'),joint('toast','food'),joint('snack-flame','food'));
 p.parts.push(path('roasting-stick','skewer',`M0 0H${length}`,'none',{stroke:'#b99567',strokeWidth:2,spatial:{order:80}}),path('marshmallow','food',snack,'#fff1d9',{stroke:'#b79876',strokeWidth:.6,opacityChannel:'food.opacity',spatial:{order:90}}),path('toast','toast',snack,'#563523',{opacityChannel:'toast.opacity',spatial:{order:91}}),path('snack-flame','snack-flame',flame,'#ffad46',{transform:'scale(.23 .3)',opacityChannel:'snack-flame.opacity',spatial:{order:92}}));
 const tracks={};const add=(key,t,value,easing='smooth')=>(tracks[key]??=[]).push([t,value,easing]);
 // Baked numeric keys keep the complete performance portable in the scene JSON.
 for(let n=0;n<=192;n++){const time=n/8,t=(time+index*5)%24,phase=campPhase(time,index),eat=t>=17&&t<20,replace=t>=20&&t<22,bring=Math.max(0,Math.min(1,(t-16.5)/1.1)),returning=ease(t-21),eatWeight=ease((t-16.5)/.9)*ease((20.2-t)/.9),replaceWeight=ease((t-20)/.6)*ease((22.5-t)/.6),mouth={x:sign*3,y:-4},bag={x:-sign*24,y:27};let food={...target};
  if(t>=16.5&&t<20)food={x:target.x+(mouth.x-target.x)*bring,y:target.y+(mouth.y-target.y)*bring};else if(t>=20&&t<22)food={x:bag.x+(target.x-bag.x)*returning,y:bag.y+(target.y-bag.y)*returning};
  add('skewer.rotation',time,angle);add(arm+'.rotation',time,rest[arm+'.rotation']);add(free+'.rotation',time,rest[free+'.rotation']*(1-Math.max(eatWeight,replaceWeight))-sign*(112*eatWeight+48*replaceWeight));add('head.rotation',time,phase==='burning'?Math.sin(t*12)*7:eat?Math.sin(t*15)*3:Math.sin(t*.7)*3);add('head.y',time,8*eatWeight);add('head.yaw',time,sign*18);add('mouth.rotation',time,Math.sin(t*19)*8*eatWeight);
  add('food.x',time,food.x);add('food.y',time,food.y);add('food.rotation',time,Math.sin(t*2)*6);add('food.opacity',time,t>=19&&t<20.7?0:1,'step');add('toast.opacity',time,t<9||t>=19?0:Math.min(.9,(t-9)/3));add('snack-flame.opacity',time,phase==='burning'?.65+.3*Math.sin(t*14):0,'step');add('snack-flame.rotation',time,Math.sin(t*12)*12);
 }
 p.clips.campfire={duration:24,loop:true,tracks};p.states.campfire={clip:'campfire',transitions:[]};p.inputs.action.options.push('campfire');p.inputs.action.default='campfire';p.initial='campfire';
 for(const [name,state] of Object.entries(p.states))state.transitions=p.inputs.action.options.filter(to=>to!==name).map(to=>({to,duration:.25,when:{input:'action',equals:to}}));
 for(const part of p.parts.filter(part=>['roasting-stick','marshmallow','toast','snack-flame'].includes(part.id)))part.showWhen={input:'action',equals:'campfire'};
 const a={...structuredClone(ona.actors[0]),id:'camper-'+index,name:['Maple','Juniper','Ember','Clover'][index],pack:'camper-'+index,transform:{x,y:rootY,scale,rotation:0},appearance:{...ona.actors[0].appearance,...colors},inputs:{...ona.actors[0].inputs,action:'campfire',hair,emotion:'happy'},behavior:{mode:'animated',autoFace:false}};return {a,p};
}
export function createCampfire(){
 const outfits=[{clothing:'#de9b69',hair:'#674538',eyes:'#477b78'},{clothing:'#a9bf8c',hair:'#b57840',eyes:'#72509b'},{clothing:'#a29acf',hair:'#372f3e',eyes:'#438e9a'},{clothing:'#78afb0',hair:'#ceb16d',eyes:'#729052'}],hair=['bob','curls','swept','ponytail'],campers=[140,278,522,660].map((x,i)=>camper(i,x,i%3===0?1.15:1.05,outfits[i],hair[i]));
 return {schemaVersion:1,kind:'scene',id:'campfire-night',name:'Campfire night',revision:0,bounds:{width:800,height:450},requiredFeatures:['spatial-rig','scene-lighting','scenery-layers'],packs:{night:sky(),fire:fire(),...Object.fromEntries(campers.map(({a,p})=>[a.pack,p]))},actors:[actor('night','night','background'),...campers.map(c=>c.a),actor('fire','fire','foreground')],lighting:{enabled:true,shading:'cel',celThickness:.4,celIntensity:.72,type:'point',receiver:'floor',pointX:400,pointY:315,pointHeight:100,range:390,intensity:1.5,ambient:.48,color:'#ffd099',shadowColor:'#091420',floorY:365,wallY:280,floorShadow:.25,wallShadow:0,reflection:0,softness:0,gloss:.2,motion:'flicker',flicker:.35,motionSpeed:1}};
}
