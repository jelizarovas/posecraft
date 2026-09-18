// Rest choreography is ordinary editable clips. A single root-joint bottle
// remains anchored in world space until the hand reaches its table position.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t);return t*t*(3-2*t);},blend=(t,a,b)=>ease((t-a)/(b-a)),lerp=(a,b,t)=>a+(b-a)*t,rad=Math.PI/180;
const defaults={bottle:{x:400,y:270},bottleStand:{x:355,y:383},window:{x:335,y:323},mirror:{x:690,y:343}};
export const gymBottleLocations=[
 {id:0,name:'water table',point:{x:400,y:270},stand:{x:355,y:383}},
 {id:1,name:'window sill',point:{x:320,y:205},stand:{x:275,y:323}},
 {id:2,name:'mirror shelf',point:{x:755,y:255},stand:{x:710,y:368}}
];
const waterId=(source,destination,place)=>source===0&&destination===1?'drink-at-'+place:destination===0?'drink-from-'+source+'-'+place:'drink-from-'+source+'-to-'+destination+'-'+place;
export const gymWaterReviews=gymBottleLocations.flatMap(source=>gymBottleLocations.filter(v=>v.id!==source.id).flatMap(destination=>['bar','bench'].map(place=>({id:waterId(source.id,destination.id,place),clip:waterId(source.id,destination.id,place),label:(source.id===1&&destination.id===2?'Search / water: ':'Water: ')+source.name+' to '+destination.name+' / '+place,source:source.id,destination:destination.id,place}))));
export const gymIdleReviews=[
 {id:'rack-contemplate-rise',clip:'rack-contemplate-rise',label:'Sit / contemplate / rise',duration:9},
 ...['bar','bench'].flatMap(place=>[
  {id:'wipe-forehead-'+place,clip:'wipe-forehead-'+place,label:'Wipe forehead / '+place,duration:4.8},
  {id:'window-look-'+place,clip:'window-look-'+place,label:'Look through window / '+place},
  {id:'mirror-flex-'+place,clip:'mirror-flex-'+place,label:'Mirror / flex / '+place}
 ]),...gymWaterReviews
];
const cleanFace=p=>{p['face-neutral.opacity']=1;p['face-effort.opacity']=0;p['face-blink.opacity']=0;p['effort-lines.opacity']=0;return p;};
function planarArm(p,side,target,amount=1,elbowSide=side<0?-1:1){
 const name=side<0?'left':'right',x=side*34+(p[name+'Upper.x']||0),y=-68+(p[name+'Upper.y']||0),dx=target.x-x,dy=target.y-y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,79.94),ex=x+dx/d*reach,ey=y+dy/d*reach,height=Math.sqrt(Math.max(0,1600-reach*reach/4)),bend=elbowSide,elbow={x:(x+ex)/2-dy/d*height*bend,y:(y+ey)/2+dx/d*height*bend},upper=Math.atan2(elbow.y-y,elbow.x-x)/rad,lower=Math.atan2(ey-elbow.y,ex-elbow.x)/rad;
 for(const [joint,value]of [[name+'Upper',upper],[name+'Lower',((lower-upper+540)%360)-180],[name+'Hand',((540-lower)%360)-180]])p[joint+'.rotation']=lerp(p[joint+'.rotation']||0,value,amount);
 p[name+'Upper.yaw']=(p[name+'Upper.yaw']||0)*(1-amount);p[name+'Lower.yaw']=(p[name+'Lower.yaw']||0)*(1-amount);p[name+'Upper.z']=lerp(p[name+'Upper.z']||0,22,amount);p[name+'Hand.z']=lerp(p[name+'Hand.z']||0,35,amount);
}
function hand(p,side=1){const name=side<0?'left':'right',a=(p[name+'Upper.rotation']||0)*rad,b=(p[name+'Lower.rotation']||0)*rad,uy=(p[name+'Upper.yaw']||0)*rad,ly=(p[name+'Lower.yaw']||0)*rad,u=[Math.cos(a)*Math.cos(uy),-Math.sin(a),Math.cos(a)*Math.sin(uy),Math.sin(a)*Math.cos(uy),Math.cos(a),Math.sin(a)*Math.sin(uy)],v=[40+40*Math.cos(b)*Math.cos(ly),40*Math.sin(b)*Math.cos(ly),-40*Math.sin(ly)];return {x:side*34+(p[name+'Upper.x']||0)+u[0]*v[0]+u[1]*v[1]+u[2]*v[2],y:-68+(p[name+'Upper.y']||0)+u[3]*v[0]+u[4]*v[1]+u[5]*v[2]};}
function anchoredBottle(p,point){p['water-bottle.x']=point.x-p['root.x'];p['water-bottle.y']=point.y-p['root.y'];p['water-bottle.rotation']=0;p['water-bottle.opacity']=1;p['water-bottle.z']=35;return p;}
function anchorBottleClips(pack,point,excluded){for(const [name,clip]of Object.entries(pack.clips)){if(excluded.has(name))continue;for(const axis of ['x','y']){const root=clip.tracks['root.'+axis]||[[0,0],[clip.duration,0]];clip.tracks['water-bottle.'+axis]=root.map(k=>[k[0],+(point[axis]-k[1]).toFixed(5),k[2]||'linear']);}for(const [key,value]of [['rotation',0],['opacity',1],['z',35]])clip.tracks['water-bottle.'+key]=[[0,value],[clip.duration,value]];}}
// Water routes share ordinary rig channels; sparse linear keys keep the portable
// document small without substituting a hidden runtime animation system.
function waterClip(duration,sampler,beats){
 const times=[...new Set([0,duration,...beats,...Array.from({length:Math.ceil(duration*12)},(_,i)=>i/12)].filter(t=>t<=duration).map(t=>+t.toFixed(6)))].sort((a,b)=>a-b),tracks={};
 for(const t of times)for(const [key,value]of Object.entries(sampler(t)))(tracks[key]??=[]).push([+t.toFixed(6),+value.toFixed(5),'linear']);
 for(const [key,keys]of Object.entries(tracks)){
  if(keys.every(k=>k[1]===keys[0][1])){tracks[key]=[keys[0].slice(0,2),keys.at(-1).slice(0,2)];continue;}
  const tolerance=key.startsWith('water-bottle.')?.055:key==='rightUpper.rotation'||key==='rightLower.rotation'?.15:key.endsWith('.opacity')?.008:key.endsWith('.rotation')||key.endsWith('.yaw')||key.endsWith('.pitch')?1.1:.18,keep=new Set([0,keys.length-1]);
  for(const t of (/^(root|water-bottle|rightUpper|rightLower|rightHand)\./.test(key)?beats:[0,duration])){const i=keys.findIndex(k=>Math.abs(k[0]-t)<1e-5);if(i>=0)keep.add(i);}
  const visit=(a,b)=>{let worst=tolerance,index=-1;for(let i=a+1;i<b;i++){const q=(keys[i][0]-keys[a][0])/(keys[b][0]-keys[a][0]),error=Math.abs(keys[i][1]-lerp(keys[a][1],keys[b][1],q));if(error>worst){worst=error;index=i;}}if(index>=0){keep.add(index);visit(a,index);visit(index,b);}};
  const anchors=[...keep].sort((a,b)=>a-b);for(let i=1;i<anchors.length;i++)visit(anchors[i-1],anchors[i]);tracks[key]=[...keep].sort((a,b)=>a-b).map(i=>keys[i]);
 }
 return {duration,loop:false,tracks};
}
export function installGymIdleActions(scene,{poseAt,makeClip,walkPose,stations={},onInstalled=()=>{}}){
 if(typeof walkPose!=='function')throw Error('Gym idle actions need a complete travel-pose sampler.');
 const pack=scene.packs.atlas,graph=scene.behaviorGraph,at={...defaults,...stations,bottle:stations.bottle?.point||stations.bottle||defaults.bottle,bottleStand:stations.bottle?.stand?{x:stations.bottle.stand.x,y:stations.bottle.floorY}:stations.bottleStand||defaults.bottleStand,window:stations.window?.stand?{x:stations.window.stand.x,y:stations.window.floorY}:stations.window||defaults.window,mirror:stations.mirror?.stand?{x:stations.mirror.stand.x,y:stations.mirror.floorY}:stations.mirror||defaults.mirror},specs=[],metadata={};
 const baseAt=time=>({...poseAt(time,'full-set')}),baseline=place=>baseAt(place==='bench'?52.5:29),floor=p=>({x:p['root.x'],y:p['root.y']+83}),duration=(a,b)=>Math.ceil(Math.max(1.3,Math.hypot(b.x-a.x,b.y-a.y)/78)*10)/10,sampleWalk=(t,d,from,to)=>walkPose(clamp(t/d)*d,d,from,to);
 const add=(id,length,sampler,meta={},author=makeClip)=>{pack.clips[id]=author(length,sampler);const final=sampler(length);for(const [key,value]of Object.entries(final)){const keys=pack.clips[id].tracks[key]??=[];if(keys.length&&Math.abs(keys.at(-1)[0]-length)<1e-5)keys[keys.length-1]=[length,value,'linear'];else keys.push([length,value,'linear']);}specs.push({id,clip:id,label:gymIdleReviews.find(v=>v.id===id)?.label||id,duration:length});metadata[id]={duration:length,...meta};};
 add('rack-contemplate-rise',9,t=>{
  let p=t<2.2?baseAt(lerp(48,51,blend(t,0,2.2))):t<6.8?baseAt(51):baseAt(lerp(51,52.5,blend(t,6.8,9)));
  const quiet=blend(t,2.2,2.7)*(1-blend(t,6.2,6.8));p['head.pitch']=(p['head.pitch']||0)+8*quiet;p['head.yaw']=(p['head.yaw']||0)+12*Math.sin((t-2.2)*.65)*quiet;p['torso.y']=(p['torso.y']||0)+Math.sin((t-2.2)*2.3)*1.2*quiet;if(quiet)cleanFace(p);return anchoredBottle(p,at.bottle);
 },{startPose:48,endPose:52.5,seated:[2.2,6.8]});
 for(const place of ['bar','bench']){
  const start=baseline(place),home=floor(start);
  add('wipe-forehead-'+place,4.8,t=>{const p={...start},reach=blend(t,.35,1.25)*(1-blend(t,3.5,4.5)),wipe=blend(t,1.25,1.6)*(1-blend(t,3.1,3.5));planarArm(p,1,{x:6+12*Math.sin((t-1.25)*4)*wipe,y:-127+2*Math.cos((t-1.25)*4)*wipe},reach);p['head.pitch']=(start['head.pitch']||0)+5*reach;p['sweat.opacity']=lerp(start['sweat.opacity']||0,.45*(1-blend(t,1.5,3.4)),blend(t,0,.25)*(1-blend(t,4.5,4.8)));if(reach)cleanFace(p);return anchoredBottle(p,at.bottle);},{startPose:place==='bar'?29:52.5,endPose:place==='bar'?29:52.5});
  for(const kind of ['window','mirror']){
   const stop=at[kind],travel=duration(home,stop),hold=kind==='mirror'?4.8:4,total=travel*2+hold;
   add((kind==='mirror'?'mirror-flex-':'window-look-')+place,total,t=>{
    if(t<=0)return anchoredBottle({...start},at.bottle);if(t>=total)return anchoredBottle({...start},at.bottle);
    let p=t<travel?sampleWalk(t,travel,home,stop):t>travel+hold?sampleWalk(t-travel-hold,travel,stop,home):sampleWalk(travel,travel,home,stop);const q=t-travel,active=blend(q,0,.75)*(1-blend(q,hold-.75,hold));
    p=cleanFace(p);p['head.yaw']=(p['head.yaw']||0)+(kind==='mirror'?12:-12)*active;p['torso.yaw']=(p['torso.yaw']||0)+(kind==='mirror'?145:-155)*active;p['pelvis.yaw']=(p['pelvis.yaw']||0)+(kind==='mirror'?140:-145)*active;p['head.pitch']=(p['head.pitch']||0)-5*active;
    for(const side of [-1,1]){const name=side<0?'left':'right';p[name+'Foot.yaw']=(p[name+'Foot.yaw']||0)+(kind==='mirror'?140:-145)*active;planarArm(p,side,kind==='mirror'?{x:side*60,y:-108+Math.sin(q*2)*2}:{x:side*43,y:5},active,kind==='window'?-side:side);}return anchoredBottle(p,at.bottle);
   },{startPose:place==='bar'?29:52.5,endPose:place==='bar'?29:52.5,station:stop,arrive:travel,depart:travel+hold});
  }
  for(const spec of gymWaterReviews.filter(v=>v.place===place)){
   const waterDuration=(a,b)=>Math.max(2.5,duration(a,b)),waterWalk=(t,d,a,b)=>walkPose(clamp(t/d)*d,d,a,b,{via:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}});
   const source=gymBottleLocations[spec.source],destination=gymBottleLocations[spec.destination],stop=source.stand,end=destination.stand,search=spec.source===1&&spec.destination===2,wrong=gymBottleLocations[0].stand,first=search?waterDuration(home,wrong):0,searchEnd=search?first+1.8:0,travel=searchEnd+waterDuration(search?wrong:home,stop),pickup=travel+1.4,sipStart=pickup+1.3,carryStart=sipStart+.4,carryDuration=Math.max(3.6,waterDuration(stop,end)*1.3),carryEnd=carryStart+carryDuration,sipEnd=carryEnd+.4,replace=sipEnd+1.3,depart=replace+1.4,back=waterDuration(end,home),total=depart+back;
   const beats=[first,searchEnd,travel,pickup,sipStart,carryStart,carryEnd,sipEnd,replace,depart,total];
   add(spec.id,total,t=>{
    if(t<=0)return anchoredBottle({...start},source.point);if(t>=total)return anchoredBottle({...start},destination.point);
    let p;
    if(search&&t<first)p=waterWalk(t,first,home,wrong);
    else if(search&&t<searchEnd){p=waterWalk(first,first,home,wrong);p['head.yaw']=30*Math.sin((t-first)*Math.PI*1.5)*blend(t,first,first+.25)*(1-blend(t,searchEnd-.25,searchEnd));}
    else if(t<travel)p=waterWalk(t-searchEnd,travel-searchEnd,search?wrong:home,stop);
    else if(t<carryStart)p=waterWalk(travel-searchEnd,travel-searchEnd,search?wrong:home,stop);
    else if(t<carryEnd)p=waterWalk(t-carryStart,carryDuration,stop,end);
    else if(t<depart)p=waterWalk(carryDuration,carryDuration,stop,end);
    else p=waterWalk(t-depart,back,end,home);
    p['leftFoot.pitch']=0;p['rightFoot.pitch']=0;
    const reach=blend(t,travel,pickup),release=1-blend(t,replace,depart),holding=reach*release,lift=blend(t,pickup,sipStart)*(1-blend(t,sipEnd,replace)),restPoint=t<sipEnd?source.point:destination.point;
    // Turn the upper body toward the viewer while drinking. Hips and feet keep
    // their travel heading, so this remains a walking sip rather than a slide.
    for(const key of ['torso.yaw','head.yaw','rightUpper.x','rightUpper.y'])p[key]=(p[key]||0)*(1-holding);
    const grasp={x:restPoint.x-p['root.x']+8,y:restPoint.y-p['root.y']},raised={x:20+(p['torso.x']||0),y:-90+(p['torso.y']||0)},target={x:lerp(grasp.x,raised.x,lift)+35*Math.sin(Math.PI*lift),y:lerp(grasp.y,raised.y,lift)-25*Math.sin(Math.PI*lift)};
    planarArm(p,1,target,holding);const sip=blend(t,sipStart,sipStart+.35)*(1-blend(t,sipEnd-.35,sipEnd));p['head.pitch']=(p['head.pitch']||0)-8*sip;p['head.rotation']=(p['head.rotation']||0)-4*sip;cleanFace(p);
    if(t>=pickup&&t<=replace){const h=hand(p),angle=-65*sip*rad;p['water-bottle.x']=h.x-8*Math.cos(angle);p['water-bottle.y']=h.y-8*Math.sin(angle);p['water-bottle.rotation']=angle/rad;p['water-bottle.opacity']=1;p['water-bottle.z']=35;}else anchoredBottle(p,t<pickup?source.point:destination.point);
    return p;
   },{startPose:place==='bar'?29:52.5,endPose:place==='bar'?29:52.5,source:source.id,destination:destination.id,station:source.point,destinationPoint:destination.point,search,searchStart:first,searchEnd,arrive:travel,pickup,sipStart,sipEnd,carryStart,carryEnd,replace,depart},(d,sample)=>waterClip(d,sample,beats));
  }
 }
 anchorBottleClips(pack,at.bottle,new Set(specs.map(s=>s.clip)));
 const addStat=(variable,value)=>({type:'add',variable,value}),event=name=>({type:'event',event:name}),variant=(id,weight=1)=>({id,clip:id,start:0,end:metadata[id].duration,weight,speed:{min:.95,max:1.05}}),recipe=(variants,done,effects)=>({actor:'atlas',variants,success:{base:1,modifiers:[]},onStart:[],onSuccess:[...effects,event(done)],onFailure:[event(done)]});
 for(const place of ['bar','bench']){
  graph.activities['idle-'+place]=recipe([variant('wipe-forehead-'+place,3),variant('window-look-'+place,1),variant('mirror-flex-'+place,1)],'idle-'+place+'-done',[addStat('fatigue',-10)]);
  const variants=gymWaterReviews.filter(v=>v.place===place).map(v=>({...variant(v.id,v.source===1&&v.destination===2?1:3),when:{variable:'bottleLocation',op:'eq',value:v.source},onSuccess:[{type:'set',variable:'bottleLocation',value:v.destination},{type:'set',variable:'bottleX',value:gymBottleLocations[v.destination].point.x},{type:'set',variable:'bottleY',value:gymBottleLocations[v.destination].point.y}]}));
  const water=graph.activities['drink-'+place];if(water)water.variants=variants;else graph.activities['drink-'+place]=recipe(variants,'drank-'+place,[addStat('dehydration',-45),addStat('fatigue',-7),addStat('drinks',1)]);
 }
 // Completion effects belong to the existing rack recovery recipe so fatigue
 // and set count are awarded once, even when this longer seated variant wins.
 if(graph.activities['rack-and-rise']){graph.activities['rack-and-rise'].variants=graph.activities['rack-and-rise'].variants.filter(v=>v.id!=='rack-contemplate-rise');graph.activities['rack-and-rise'].variants.forEach(v=>v.weight=3);graph.activities['rack-and-rise'].variants.push(variant('rack-contemplate-rise',2));}
 scene.requiredFeatures=[...new Set([...(scene.requiredFeatures||[]),'pose-bindings'])];
 Object.assign(graph.variables,{bottleLocation:0,bottleX:gymBottleLocations[0].point.x,bottleY:gymBottleLocations[0].point.y});
 graph.variableBounds={...graph.variableBounds,bottleLocation:{min:0,max:2},bottleX:{min:0,max:800},bottleY:{min:0,max:450}};
 scene.poseBindings=[...(scene.poseBindings||[]).filter(b=>!(b.actor==='atlas'&&b.joint==='water-bottle')),{actor:'atlas',joint:'water-bottle',space:'world',x:{variable:'bottleX'},y:{variable:'bottleY'},excludeClips:gymWaterReviews.map(v=>v.clip)}];
 onInstalled({reviews:specs,metadata});return scene;
}
