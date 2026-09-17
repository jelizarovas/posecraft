import ona from './characters/ona.json' with {type:'json'};
import {addSpatialRig} from './spatial-rigs.js';
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
 for(let i=0;i<2;i++){
  const id='meteor-'+i;p.joints.push(joint(id,'root'));p.parts.push(path(id+'-head',id,ellipse(0,0,2.4,2.4),'#fff7d9',{opacityChannel:id+'.opacity'}));
  const t=8+i*27,theta=Math.atan2(140,620)*180/Math.PI;
  tracks[id+'.x']=[[0,100],[t,100],[t+3,720],[60,720]];tracks[id+'.y']=[[0,20],[t,20],[t+3,160],[60,160]];tracks[id+'.rotation']=[[0,theta],[60,theta]];tracks[id+'.opacity']=[[0,0],[t,0],[t+.2,1],[t+2.4,1],[t+3,0],[60,0]];
  for(let n=0;n<16;n++){const tail=id+'-tail-'+n,a=-n*7,b=-(n+1)*7,width=2*(1-n/16);p.joints.push(joint(tail,id));p.parts.push(path(tail,tail,`M${a} -${width}L${b} -${width*.7}L${b} ${width*.7}L${a} ${width}Z`,'#f4dfae',{opacityChannel:tail+'.opacity'}));tracks[tail+'.opacity']=tracks[id+'.opacity'].map(([time,value])=>[time,value*(1-n/16)**1.7]);}
 }

 loop(p,60,tracks);return p;
}
function fire(){
 const p=pack('Campfire stones and logs');
 for(let i=0;i<11;i++){const a=i*Math.PI*2/11,x=400+Math.cos(a)*53,y=353+Math.sin(a)*16;p.parts.push(path('stone-'+i,'root',ellipse(x,y,13,8),i%2?'#798077':'#5d6a64'));}
 p.parts.push(path('log-a','root','M360 344L442 358L438 370L357 355Z','#745032'),path('log-b','root','M365 365L439 340L445 350L371 376Z','#956543'),path('log-grain','root','M368 352L431 365M377 368L438 347','none',{stroke:'#3d3528',strokeWidth:2}));
 loop(p,4,{});return p;
}
const uniqueId=(items,preferred)=>{let id=preferred,n=2;while(items.some(item=>item.id===id))id=preferred+'-'+n++;return id;};
function addCampfireEffects(doc){
 doc.groups||=[];doc.emitters||=[];
 const group=(id,name)=>{const existing=doc.groups.find(g=>g.id===id&&g.name===name);if(existing)return existing.id;const value=uniqueId(doc.groups,id);doc.groups.push({id:value,name,parent:null});return value;};
 const scenery=group('scenery','Scenery'),characters=group('characters','Characters'),campfire=group('campfire','Campfire'),fireActor=doc.actors.find(a=>a.id==='fire');
 for(const a of doc.actors)if(!a.group)a.group=a.id==='night'?scenery:a.id==='fire'?campfire:characters;
 const defaults={actor:fireActor.id,group:fireActor.group,layer:'characters',enabled:true,randomness:.8,opacity:1};
 const effects=[
  {id:'fire-flame',name:'Campfire flame',type:'flame',x:400,y:352,rate:2.5,lifetime:1,speed:0,spread:16,seed:6713,size:80,color:'#ee6f32',maxParticles:3},
  {id:'fire-smoke',name:'Campfire smoke',type:'smoke',x:400,y:283,rate:2.2,lifetime:4.5,speed:19,spread:15,seed:6714,size:14,color:'#9da392',opacity:.17,maxParticles:24},
  {id:'fire-embers',name:'Campfire embers',type:'embers',x:400,y:323,rate:5,lifetime:3.2,speed:37,spread:23,seed:6715,size:2,color:'#ffcd76',opacity:.9,maxParticles:32}
 ].map(effect=>({...defaults,...effect,id:uniqueId(doc.emitters,effect.id)}));
 doc.emitters.push(...effects);doc.lighting={...doc.lighting,emitter:effects[0].id};doc.requiredFeatures=[...new Set([...(doc.requiredFeatures||[]),'scene-groups','procedural-emitters'])];return doc;
}
// Explicit migration only: opening a saved draft must never rewrite authored work.
export function convertCampfireEffects(document){
 const doc=structuredClone(document),a=doc.actors?.find(a=>a.id==='fire'),p=doc.packs?.[a?.pack];
 if(doc.kind!=='scene'||doc.ensemble?.type!=='campfire'||!p)throw new Error('Choose a campfire scene to convert its fire effects.');
 const effects=new Set(p.joints.filter(j=>j.parent==='root'&&/^(flame|ember|smoke)-\d+$/.test(j.id)).map(j=>j.id));
 if(doc.emitters?.some(e=>e.actor===a.id&&e.type==='flame'&&e.id===doc.lighting?.emitter))return doc;
 p.parts=p.parts.filter(part=>!(effects.has(part.id)&&part.joint===part.id));
 // Keep a legacy joint if custom artwork or a custom child still depends on it.
 const retained=new Set(p.parts.map(part=>part.joint));for(const expression of Object.values(p.expressions||{}))for(const key of Object.keys(expression))retained.add(key.split('.')[0]);for(const j of p.joints)if(!effects.has(j.id)&&j.parent)retained.add(j.parent);
 const removed=new Set([...effects].filter(id=>!retained.has(id)));p.joints=p.joints.filter(j=>!removed.has(j.id));
 for(const clip of Object.values(p.clips))for(const key of Object.keys(clip.tracks))if(removed.has(key.split('.')[0]))delete clip.tracks[key];
 doc.revision++;return addCampfireEffects(doc);
}

export function campPhase(time,index=0){const t=(time+index*5)%24;return t<9?'roasting':t<12?'toasting':t<13.5?'burning':t<15?'lowering the stick':t<15.8?'blowing':t<16.4?'reaching':t<17?'sliding off':t<19?'eating':t<20?'swallowing':t<21.5?'replacing':t<23?'returning to fire':'fresh';}
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const angle=v=>Math.atan2(v.y,v.x)*180/Math.PI;
const wrap=v=>((v+540)%360)-180;
function armPose(shoulder,hand,bend){
 const dx=hand.x-shoulder.x,dy=hand.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy)),h=Math.sqrt(Math.max(0,26*26-d*d/4));
 const elbow={x:(shoulder.x+hand.x)/2-dy/d*h*bend,y:(shoulder.y+hand.y)/2+dx/d*h*bend},upper=angle({x:elbow.x-shoulder.x,y:elbow.y-shoulder.y}),lower=angle({x:hand.x-elbow.x,y:hand.y-elbow.y});
 return {upper,lower:wrap(lower-upper),hand:wrap(-lower)};
}
// All contacts are solved in the character plane before baking portable keys.
export function cookingPose(t,index,x,scale,groundY=365,yaw=0){
 const facing=Math.cos(yaw*Math.PI/180),sign=(400-x)/facing>0?1:-1,rootY=groundY-58*scale,tip={x:(400+[-32,-10,12,34][index]-x)/(scale*facing),y:([267,275,269,279][index]-rootY)/scale},hold={x:sign*39,y:31},dist=Math.hypot(tip.x-hold.x,tip.y-hold.y),unit={x:(tip.x-hold.x)/dist,y:(tip.y-hold.y)/dist},roastBase={x:hold.x-unit.x*18,y:hold.y-unit.y*18},parkBase={x:sign*38,y:56},parkTip={x:0,y:-4},park=ramp(t,13.5,15)*(1-ramp(t,21.5,23)),base=mix(roastBase,parkBase,park),end=mix(tip,parkTip,park),length=Math.max(dist+18,Math.hypot(parkTip.x-parkBase.x,parkTip.y-parkBase.y)),projected=Math.hypot(end.x-base.x,end.y-base.y),direction={x:(end.x-base.x)/projected,y:(end.y-base.y)/projected},holding={x:base.x+direction.x*18,y:base.y+direction.y*18};
 const rest={x:-sign*39,y:30},bag={x:-sign*25,y:29},off={x:end.x+direction.x*10,y:end.y+direction.y*10},mouth={x:0,y:-12};let hand=rest,food=end;
 if(t>=15.8&&t<16.4)hand=mix(rest,end,ramp(t,15.8,16.4));
 else if(t>=16.4&&t<17){hand=food=mix(end,off,ramp(t,16.4,17));}
 else if(t>=17&&t<17.8){hand=food=mix(off,mouth,ramp(t,17,17.8));}
 else if(t>=17.8&&t<19){hand=food={x:mouth.x+Math.sin(t*15)*.8,y:mouth.y+Math.sin(t*15)*.6};}
 else if(t>=19&&t<20){hand=mix(mouth,rest,ramp(t,19,20));food=hand;}
 else if(t>=20&&t<20.7){hand=mix(rest,bag,ramp(t,20,20.7));food=hand;}
 else if(t>=20.7&&t<21.5){hand=food=mix(bag,end,ramp(t,20.7,21.5));}
 else if(t>=21.5&&t<22.3)hand=mix(parkTip,rest,ramp(t,21.5,22.3));
 return {base,end,length,projected,holding,hand,food,sign,stickRotation:angle(direction),stickYaw:Math.acos(Math.min(1,projected/length))*180/Math.PI};
}
function camper(index,x,scale,colors,hair,groundY=365,yaw=0){
 const p=structuredClone(ona.packs.ona);addSpatialRig(p,'ona');p.name='Camper '+(index+1);const sign=(400-x)/Math.cos(yaw*Math.PI/180)>0?1:-1,rootY=groundY-58*scale,length=cookingPose(0,index,x,scale,groundY,yaw).length;
 p.joints.push(joint('camp-original','root'));
 const shell=p.parts.find(v=>v.id==='face-0');Object.assign(shell,{d:'M-32 -47Q0 -55 32 -47Q42 -43 40 -10Q38 9 0 9Q-38 9 -40 -10Q-42 -43 -32 -47Z',transform:'',stroke:'#383936',strokeWidth:2.2});
 p.parts.find(v=>v.id==='face-1').opacityChannel='camp-original.opacity';
 // One opaque cap follows the head in depth. No front/back opacity swap.
 for(const id of ['hair-front','hair-rear-cap']){const part=p.parts.find(v=>v.id===id);part.opacityChannel='camp-original.opacity';delete part.spatial.facingFade;delete part.spatial.hairShell;}
 p.parts.push({id:'camp-hair-shell',joint:'head',d:'M0 0',fill:'#65504a',channel:'hair',stroke:'#383936',strokeWidth:1.5,variantInput:'hair',variants:{none:{visible:false}},spatial:{order:96,hairShell:{width:43,height:33,depth:31,y:-22}}});
 const tail=p.parts.find(v=>v.id==='hair-back');tail.spatial={depth:-23,center:[45,-10],order:-10};tail.variants.bob={visible:false};
 for(const part of p.parts)if(['leftArm','rightArm','eyes','mouth'].includes(part.joint)||['brows','hurt-cheek'].includes(part.id))part.opacityChannel='camp-original.opacity';
 const addPart=(...args)=>{const v=path(...args);v.showWhen={input:'action',equals:'campfire'};p.parts.push(v);return v;};
 for(const [name,side] of [['hold',sign],['take',-sign]]){
  p.joints.push(joint(name+'-upper','root',side*27,0),joint(name+'-elbow',name+'-upper',26,0),joint(name+'-hand',name+'-elbow',26,0));
  addPart(name+'-palm',name+'-hand','M0 0','none');
  addPart(name+'-skin',name+'-upper','M0 -7Q26 -7 52 -4.5Q58 0 52 4.5Q26 7 0 7Q-7 0 0 -7Z','#fafbf8',{channel:'skin',stroke:'#383936',strokeWidth:1.5,spatial:{order:100,softLimb:{elbow:name+'-elbow',hand:name+'-hand',radius:7}}});
 }
 p.joints.push(joint('camp-point','take-hand')); // Kept for older editable clips; no extra finger artwork.
 p.joints.push(joint('skewer','root'),joint('food','root'),joint('toast','food'),joint('snack-flame','food'));
 addPart('roasting-stick','skewer',`M0 0H${length}`,'none',{stroke:'#b99567',strokeWidth:2,opacityChannel:'skewer.opacity',spatial:{order:80,morph:{channel:'skewer.bend',target:'M0 0H0'}}});
 addPart('marshmallow','food',snack,'#fff1d9',{stroke:'#b79876',strokeWidth:.6,opacityChannel:'food.opacity',spatial:{order:90,morph:{channel:'food.bend',target:'M-8 0Q0 6 8 0L8 10Q0 14 -8 10Z'}}});
 addPart('toast','toast',snack,'#563523',{opacityChannel:'toast.opacity',spatial:{order:91,morph:{channel:'food.bend',target:'M-8 0Q0 6 8 0L8 10Q0 14 -8 10Z'}}});
 addPart('snack-flame','snack-flame',flame,'#ffad46',{transform:'scale(.23 .3)',opacityChannel:'snack-flame.opacity',spatial:{order:92}});
 const face=(id,d,fill,extra={})=>{p.joints.push(joint(id,'head'));return addPart(id,id,d,fill,{opacityChannel:id+'.opacity',spatial:{depth:26,order:60,facing:'front',mask:'face-0',surface:{x:0,width:44,depth:29}},...extra});};
 face('camp-eyes',ellipse(-15,-10,4.2,6)+ellipse(17,-10,4.2,6),colors.eyes,{channel:'eyes'});
 face('camp-eye-shine',ellipse(-16,-12,1.2,1.5)+ellipse(16,-12,1.2,1.5),'#fffdf4');
 face('camp-blink','M-20 -9Q-15 -5 -10 -9M12 -9Q17 -5 22 -9','none',{stroke:'#383936',strokeWidth:1.8});
 face('camp-brows','M-21 -21L-10 -22M11 -22L22 -21','none',{stroke:'#65504a',strokeWidth:1.7});
 face('camp-worried','M-21 -20L-10 -24M11 -24L22 -20','none',{stroke:'#65504a',strokeWidth:1.7});
 face('camp-smile','M-7 4Q0 13 7 4','none',{stroke:'#383936',strokeWidth:1.7});
 face('camp-oh',ellipse(0,6,4,6),'#513d35');
 face('camp-blow',ellipse(2,5,2.5,3),'#513d35');
 face('camp-chew-open','M-5 3Q0 1 5 3Q4 10 0 10Q-4 10 -5 3Z','#513d35');
 face('camp-chew-closed','M-5 5Q0 8 5 5','none',{stroke:'#383936',strokeWidth:1.8});
 face('camp-cheeks',ellipse(-23,2,5,2.5)+ellipse(23,2,5,2.5),'#d98978');
 // Short directed reactions sit outside the silhouette; no extra fingers or props.
 const mark=(id,d,color,filled=false)=>{p.joints.push(joint(id,'head'));addPart(id,id,d,filled?color:'none',{stroke:filled?'#465568':color,strokeWidth:filled?1.3:2.8,opacityChannel:id+'.opacity',spatial:{depth:32,order:125}});};
 mark('camp-startle','M-48 -48L-59 -61M-34 -60L-37 -75M49 -68L49 -54M49 -47L49 -45','#ffe697');
 mark('camp-sweat','M48 -46C47 -41 42 -37 42 -33C42 -25 53 -24 55 -32C57 -37 51 -42 48 -46Z','#acdce5',true);
 mark('camp-disappointed','M29 -47V-33M36 -45V-29M43 -42V-27','#899bbd');
 mark('camp-shout','M47 -8L60 -14M49 1L65 1M47 10L60 16','#ffe697');
 mark('camp-cold','M-51 -8L-56 -2L-51 4L-56 10M51 -8L56 -2L51 4L56 10','#b6dce8');
 face('camp-chatter','M-8 4L-4 2L0 4L4 2L8 4V9L4 7L0 9L-4 7L-8 9Z','#ebf8fc',{stroke:'#536576',strokeWidth:1.1});
 face('camp-angry','M-23 -22L-10 -17M10 -17L23 -22M-7 5Q0 1 7 5V9H-7Z','#f7e9d4',{stroke:'#4e3432',strokeWidth:2});
 mark('camp-notice','M-48 -67L-44 -58L-35 -54L-44 -50L-48 -41L-52 -50L-61 -54L-52 -58Z','#fff0b5',true);
 face('camp-startle-eyes',ellipse(-15,-10,5.5,8)+ellipse(17,-10,5.5,8),colors.eyes,{channel:'eyes',opacityChannel:'camp-startle.opacity'});
 face('camp-startle-mouth',ellipse(0,6,4.8,8),'#513d35',{opacityChannel:'camp-startle.opacity'});

 // Separate curved placements keep the near eye visible as the far eye turns away.
 for(const [id,left,right,x1,x2] of [
  ['camp-eyes',ellipse(-15,-10,4.2,6),ellipse(17,-10,4.2,6),-15,17],
  ['camp-startle-eyes',ellipse(-15,-10,5.5,8),ellipse(17,-10,5.5,8),-15,17],
  ['camp-eye-shine',ellipse(-16,-12,1.2,1.5),ellipse(16,-12,1.2,1.5),-15,17],
  ['camp-blink','M-20 -9Q-15 -5 -10 -9','M12 -9Q17 -5 22 -9',-15,17],
  ['camp-brows','M-21 -21L-10 -22','M11 -22L22 -21',-15,17],
  ['camp-worried','M-21 -20L-10 -24','M11 -24L22 -20',-15,17],
  ['camp-cheeks',ellipse(-23,2,5,2.5),ellipse(23,2,5,2.5),-23,23]]){
  const part=p.parts.find(v=>v.id===id);part.d=left;part.spatial.surface.x=x1;const other=structuredClone(part);other.id=id+'-right';other.d=right;other.spatial.surface.x=x2;p.parts.push(other);
 }
 const tracks={},add=(key,t,value,easing='linear')=>(tracks[key]??=[]).push([t,value,easing]);
 // 24 fps sampling preserves visible hand/food contact, including scrubbed frames.
 for(let n=0;n<=576;n++){
  const time=n/24,t=(time+index*5)%24,c=cookingPose(t,index,x,scale,groundY,yaw),burn=t>=12&&t<15,blow=t>=15&&t<16.4,chew=t>=17.8&&t<19,blink=[2.2,6.6,10.4,15.4,19.6,22.8].some(at=>Math.abs(t-at)<.09),bite=(Math.sin(t*22)+1)/2;
  add('camp-original.opacity',time,0);add('camp-point.opacity',time,0);add('root.yaw',time,yaw);
  for(const [name,side,hand,bend] of [['hold',sign,c.holding,-sign],['take',-sign,c.hand,sign]]){const pose=armPose({x:side*27,y:0},hand,bend);add(name+'-upper.rotation',time,pose.upper);add(name+'-elbow.rotation',time,pose.lower);add(name+'-hand.rotation',time,pose.hand);add(name+'-upper.z',time,42);}
  add('skewer.opacity',time,1);add('skewer.x',time,c.base.x);add('skewer.y',time,c.base.y);add('skewer.rotation',time,c.stickRotation);add('skewer.bend',time,Math.max(0,1-c.projected/c.length));add('skewer.z',time,43);
  add('food.x',time,c.food.x);add('food.y',time,c.food.y);add('food.z',time,44);add('food.rotation',time,0);add('food.bend',time,t>=17.8&&t<19?ramp(t,17.8,18.9):0);add('food.opacity',time,t>=19&&t<20.7?0:1,'step');add('toast.opacity',time,t<9||t>=19?0:Math.min(.9,(t-9)/3));add('snack-flame.opacity',time,burn?.65+.3*Math.sin(t*14):0,'step');add('snack-flame.rotation',time,Math.sin(t*12)*12);
  add('head.rotation',time,burn?Math.sin(t*9)*3:chew?Math.sin(t*22)*.6:Math.sin(t*.7)*1.5);add('head.yaw',time,0);
  for(const [id,value] of [['camp-eyes',blink?0:1],['camp-eye-shine',blink?0:1],['camp-blink',blink?1:0],['camp-brows',burn?0:1],['camp-worried',burn?1:0],['camp-smile',!burn&&!blow&&!chew?1:0],['camp-oh',burn?1:0],['camp-blow',blow?1:0],['camp-chew-open',chew?bite:0],['camp-chew-closed',chew?1-bite:0],['camp-cheeks',chew?.45:burn?.3:.12]])add(id+'.opacity',time,value,'step');
 }
 for(const id of ['camp-cold','camp-chatter','camp-angry','camp-startle','camp-sweat','camp-disappointed','camp-shout','camp-notice','camp-startle-eyes','camp-startle-mouth'])tracks[id+'.opacity']=[[0,0],[24,0]];
 // Drop only redundant held samples; retain transition endpoints and contact samples.
 for(const [key,keys] of Object.entries(tracks))tracks[key]=keys.filter((v,i)=>i===0||i===keys.length-1||v[1]!==keys[i-1][1]||v[1]!==keys[i+1][1]);
 p.clips.campfire={duration:24,loop:true,tracks};p.states.campfire={clip:'campfire',transitions:[]};p.inputs.action.options.push('campfire');p.inputs.action.default='campfire';p.initial='campfire';
 for(const [name,state] of Object.entries(p.states))state.transitions=p.inputs.action.options.filter(to=>to!==name).map(to=>({to,duration:.25,when:{input:'action',equals:to}}));
 const a={...structuredClone(ona.actors[0]),id:'camper-'+index,name:['Maple','Juniper','Ember','Clover'][index],pack:'camper-'+index,transform:{x,y:rootY,scale,rotation:0},groundY,appearance:{...ona.actors[0].appearance,...colors},inputs:{...ona.actors[0].inputs,action:'campfire',hair,emotion:'neutral'},behavior:{mode:'animated',autoFace:false}};return {a,p};
}
export function createCampfire(){
 const outfits=[{clothing:'#de9b69',hair:'#674538',eyes:'#477b78'},{clothing:'#a9bf8c',hair:'#b57840',eyes:'#72509b'},{clothing:'#a29acf',hair:'#372f3e',eyes:'#438e9a'},{clothing:'#78afb0',hair:'#ceb16d',eyes:'#729052'}],hair=['bob','curls','swept','ponytail'],campers=[[320,.92,302,24],[470,.92,295,-24],[235,1.12,407,135],[567,1.12,411,-135]].map(([x,scale,ground,yaw],i)=>camper(i,x,scale,outfits[i],hair[i],ground,yaw));
 return addCampfireEffects({schemaVersion:1,kind:'scene',id:'campfire-night',name:'Campfire night',revision:0,bounds:{width:800,height:450},presentation:'live',interactions:[{id:'fire-click',actor:'fire',gesture:'click',response:'event',event:'extinguish-fire',resistance:0},...campers.flatMap(({a})=>[{id:a.id+'-food',actor:a.id,joint:'food',gesture:'drag',response:'carry',event:'food-throw',resistance:0},{id:a.id+'-head',actor:a.id,joint:'head',gesture:'drag',response:'resist',event:'face-shoo',resistance:.8},...['hold-hand','take-hand'].map(joint=>({id:a.id+'-'+joint,actor:a.id,joint,gesture:'drag',response:'resist',event:'face-shoo',resistance:.65})),{id:a.id+'-hover',actor:a.id,gesture:'hover-fast',response:'event',event:'face-shoo',resistance:0,threshold:450}])],behaviorGraph:{seed:20260917,variables:{fireEnabled:true},initial:'warm',states:{warm:{actions:[{type:'set',variable:'fireEnabled',value:true}]},cold:{actions:[{type:'set',variable:'fireEnabled',value:false},{type:'ensemble',event:'fire-off'}]},recover:{actions:[{type:'ensemble',event:'fire-relight'}]}},edges:[{id:'douse',from:'*',to:'cold',event:'extinguish-fire',weight:1},{id:'recover',from:'cold',to:'recover',after:{min:8,max:14},weight:1},{id:'ignite',from:'*',to:'warm',event:'fire-lit',weight:1}],handlers:[{event:'ignite-fire',actions:[{type:'ensemble',event:'fire-on'}]},{event:'food-throw',actions:[{type:'ensemble',event:'food-throw',actor:'$actor'}]},{event:'face-shoo',actions:[{type:'ensemble',event:'face-shoo',actor:'$actor'}]}]},requiredFeatures:['spatial-rig','scene-lighting','scenery-layers','campfire-ensemble','soft-limbs','hair-shell','behavior-graphs','pointer-interactions'],ensemble:{type:'campfire',seed:20260917,members:campers.map(c=>c.a.id),sky:'night'},packs:{night:sky(),fire:fire(),...Object.fromEntries(campers.map(({a,p})=>[a.pack,p]))},actors:[actor('night','night','background'),campers[0].a,campers[1].a,actor('fire','fire','characters'),campers[2].a,campers[3].a],lighting:{enabled:true,shading:'cel',celThickness:.4,celIntensity:.72,type:'point',receiver:'floor',pointX:400,pointY:315,pointHeight:100,range:390,intensity:1.5,ambient:.48,color:'#ffd099',shadowColor:'#091420',floorY:365,wallY:280,floorShadow:.25,wallShadow:0,reflection:0,softness:0,gloss:.2,motion:'flicker',flicker:.35,motionSpeed:1}});
}
