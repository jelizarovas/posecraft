import {interpolate,sampleClip} from '@posecraft/runtime/animation';
import {laptopGrip,reachingSleeve} from './wwzard-laptop.js';

const round=n=>+n.toFixed(4)||0;
const moods=['normal','disappointed','angry'];
const id=(base,mood)=>mood==='normal'?base:`${base}--${mood}`;
const clip=(duration,tracks)=>({duration,loop:false,tracks});
const mapPath=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,p=>move(...p.split(/\s+/).map(Number)).map(round).join(' '));
const elbowRest={wrist:[300,301],elbow:[248,323]};
const nearStops=[[.5,laptopGrip(1)],[.65,[248,332]],[.8,elbowRest.wrist],[1,[200,371]]];
const farStops=[[0,[308,295]],[.25,[308,285]],[.5,[315,309]],[1,[268,393]]];
const coordinates=(stops,keys,axis,origin)=>keys.map(([t,v,ease])=>[t,round(interpolate(stops.map(([value,p])=>[value,p[axis]]),v,'linear')-origin),...(ease?[ease]:[])]);
// Insert geometry stops into a movement before sampling its paired wrist.
// Each segment follows exactly the same interpolation as its sleeve contour.
function route(stops,keys){
 const out=[keys[0]];
 for(let i=1;i<keys.length;i++){
  const [a,av]=keys[i-1],[b,bv]=keys[i];
  const between=stops.map(([v])=>v).filter(v=>v>Math.min(av,bv)&&v<Math.max(av,bv)).map(v=>[round(a+(b-a)*(v-av)/(bv-av)),v,'linear']).sort((x,y)=>x[0]-y[0]);
  out.push(...between,[b,bv,'linear']);
 }
 for(const key of out)key[2]='linear';
 return out;
}
function slice(source,start,end){
 const tracks={};
 for(const [channel,keys] of Object.entries(source.tracks)){
  const easeAt=t=>keys.findLast(k=>k[0]<=t)?.[2];
  const keyAt=(t,out)=>[round(out),round(sampleClip({...source,loop:false},t)[channel]),...(easeAt(t)?[easeAt(t)]:[])];
  tracks[channel]=[keyAt(start,0),...keys.filter(k=>k[0]>start&&k[0]<end).map(([t,v,e])=>[round(t-start),v,...(e?[e]:[])]),keyAt(end,end-start)];
 }
 return clip(round(end-start),tracks);
}
function join(first,second){
 const tracks={},duration=round(first.duration+second.duration);
 for(const channel of new Set([...Object.keys(first.tracks),...Object.keys(second.tracks)])){
  const a=first.tracks[channel]||[[0,0],[first.duration,0]],b=second.tracks[channel]||[[0,0],[second.duration,0]];
  tracks[channel]=[...a.filter(k=>k[0]<first.duration),...b.map(([t,v,e])=>[round(t+first.duration),v,...(e?[e]:[])])];
 }
 return clip(duration,tracks);
}
function durationOf(c,duration){
 const scale=duration/c.duration;
 for(const keys of Object.values(c.tracks))for(const key of keys)key[0]=round(key[0]*scale);
 c.duration=duration;return c;
}
const quiet={ 'torso.x':0,'torso.y':0,'torso.rotation':0,'torso.bend':0,'head.rotation':0,'hat.rotation':0,'hatTip.bend':0,
 'leftArm.rotation':0,'leftArm.y':0,'leftArm.z':20,'leftGrip.bend':.65,'leftHand.x':-27,'leftHand.y':15,'leftHand.rotation':0,'leftHand.bend':0,'leftGrip.opacity':0,
 'rightArm.rotation':0,'rightArm.y':0,'rightArm.z':40,'rightArm.bend':.5,'rightHand.x':7,'rightHand.y':14,'rightHand.rotation':0,'rightHand.bend':0,
 ...Object.fromEntries([1,2,3,4].map(i=>[`magic-${i}.opacity`,0]))};
function held(duration,pose=quiet){return clip(duration,Object.fromEntries(Object.entries(pose).map(([k,v])=>[k,[[0,v],[duration,v]]])));}
function arms(target,near,far){
 near=route(nearStops,near);far=route(farStops,far);
 Object.assign(target.tracks,{'leftGrip.bend':near,'leftHand.x':coordinates(nearStops,near,0,275),'leftHand.y':coordinates(nearStops,near,1,317),
  'rightArm.bend':far,'rightHand.x':coordinates(farStops,far,0,308),'rightHand.y':coordinates(farStops,far,1,295)});
 return target;
}
function restArt(hero){
 // Retain the original pose range in the lower half of the contour channel.
 for(const part of hero.parts){
  const m=part.spatial?.morph;
  if(m?.channel==='leftGrip.bend'){
   const shadow=part.id.endsWith('shadow');
   m.frames=[...(m.frames||[]).map(f=>({...f,value:f.value*.5})),{value:.5,target:m.target},
    {value:.65,target:mapPath(reachingSleeve([248,332],shadow,[220,318]),(x,y)=>[x-8*Math.max(0,(290-y)/55),y])},{value:.8,target:reachingSleeve(elbowRest.wrist,shadow,elbowRest.elbow)}];
   m.target=reachingSleeve([200,371],shadow,[185,320]);
  }
  if(m?.channel==='rightArm.bend'){
   const base=part.d;
   const reach=point=>mapPath(base,(x,y)=>{const t=Math.max(0,Math.min(1,(x-249)/59));return [x+(point[0]-308)*t,y+(point[1]-295)*t+Math.sin(t*Math.PI)*8];});
   m.frames=[{value:.25,target:m.target},{value:.5,target:mapPath(reach([315,309]),(x,y)=>[x-8*Math.max(0,Math.min(1,(285-x)/36)),y])}];m.target=reach([268,393]);
  }
  if(m?.channel==='torso.bend'){
   m.frames=[{value:.5,target:m.target}];
   m.target=mapPath(part.d,(x,y)=>{const w=Math.max(0,Math.min(1,(340-y)/100));return [x-12*w,y-3*w];});
  }
  if(['left-hand','left-thumb','right-hand','right-thumb'].includes(part.id)){
   const left=part.joint==='leftHand',threshold=left?280:314;
   part.spatial={...part.spatial,morph:{channel:part.joint+'.bend',target:mapPath(part.d,(x,y)=>[x,y-Math.max(0,Math.min(1,(x-threshold)/12))*5])}};
  }
 }
 for(const c of Object.values(hero.clips))for(const [channel,factor] of [['leftGrip.bend',.5],['rightArm.bend',.25],['torso.bend',.5]])
  if(c.tracks[channel])c.tracks[channel]=c.tracks[channel].map(([t,v,e])=>[t,round(v*factor),...(e?[e]:[])]);
}
function settle(sourcePose,duration=2.4){
 const c=held(duration);
 for(const channel of new Set([...Object.keys(sourcePose),...Object.keys(quiet)]))c.tracks[channel]=[[0,sourcePose[channel]||0],[duration,quiet[channel]||0]];
 // Release the edge and settle directly into supported hands. Do not cross
 // the unrelated elbow-rest contour or lower and immediately raise the arms.
 arms(c,[[0,.5],[1.6,.65],[duration,.65]],[[0,sourcePose['rightArm.bend']||0],[.8,.25],[2.1,.5],[duration,.5]]);
 for(const channel of ['leftGrip.bend','leftHand.x','leftHand.y','rightArm.bend','rightHand.x','rightHand.y'])for(const key of c.tracks[channel])key[2]='smooth';
 // Bring the far hand around the back edge before changing its draw order.
 c.tracks['rightArm.rotation']=[[0,sourcePose['rightArm.rotation']||0],[.8,-12],[2.1,0],[duration,0]];
 c.tracks['rightArm.y']=[[0,sourcePose['rightArm.y']||0],[.8,0],[duration,0]];
 c.tracks['rightArm.z']=[[0,-18,'step'],[.7,40,'step'],[duration,40]];
 c.tracks['leftArm.z']=[[0,0,'step'],[.08,20,'step'],[duration,20]];
 c.tracks['leftGrip.opacity']=[[0,1],[.15,0],[duration,0]];
 return c;
}
function approach(targetPose,duration=1.8){
 const c=held(duration);
 for(const channel of new Set([...Object.keys(targetPose),...Object.keys(quiet)]))c.tracks[channel]=[[0,quiet[channel]||0],[duration,targetPose[channel]||0]];
 arms(c,[[0,.65],[duration,.5]],[[0,.5],[.7,.25],[duration,targetPose['rightArm.bend']||0]]);
 c.tracks['rightArm.rotation']=[[0,0],[.7,-12],[duration,targetPose['rightArm.rotation']||0]];
 c.tracks['rightArm.y']=[[0,0],[.7,0],[duration,targetPose['rightArm.y']||0]];
 c.tracks['rightArm.z']=[[0,40,'step'],[.7,-18,'step'],[duration,-18]];
 c.tracks['leftArm.z']=[[0,20,'step'],[duration-.05,0,'step'],[duration,0]];
 c.tracks['leftGrip.opacity']=[[0,0],[duration-.2,0],[duration,1]];
 return c;
}
function idle(mood){
 const duration=mood==='normal'?9:mood==='angry'?10.8:12.8,c=held(duration);
 const near=mood==='normal'?[[0,.65],[duration,.65]]:mood==='angry'?[[0,.65],[1.3,.8],[4.3,.8],[5.7,1],[8.7,1],[duration,.65]]:[[0,.65],[1.4,.65],[2.3,.5],[4.2,.5],[5,.52],[5.8,.5],[7,.65],[8.5,1],[10.7,1],[duration,.65]];
 const far=mood==='normal'?[[0,.5],[duration,.5]]:mood==='angry'?[[0,.5],[1.3,1],[8.7,1],[duration,.5]]:[[0,.5],[6.7,.5],[8.5,1],[10.7,1],[duration,.5]];
 arms(c,near,far);
 const lower=mood==='normal'?8.75:mood==='angry'?5.42:8.32;
 c.tracks['leftArm.z']=mood==='normal'?[[0,20]]:[[0,20,'step'],[lower,-38,'step'],[duration-1.25,20,'step'],[duration,20]];
 c.tracks['rightArm.z']=mood==='normal'?[[0,40]]:[[0,40,'step'],[mood==='angry'?1.15:lower,-18,'step'],[duration-1.05,40,'step'],[duration,40]];
 if(mood==='normal')Object.assign(c.tracks,{
  'head.rotation':[[0,0],[1.8,-9],[5.6,-9],[7,-5],[duration,0]],
  'hat.rotation':[[0,0],[2,-3],[6,-3],[duration,0]],
  'head.x':[[0,0],[1.8,-12],[6.7,-12],[duration,0]],
  'head.y':[[0,0],[1.8,-3],[6.7,-3],[duration,0]],
  'torso.bend':[[0,0],[1.8,1],[6.7,1],[duration,0]],
  'leftHand.bend':[[0,0],[2.8,0],[3.1,.4],[3.36,0],[5.8,0],[6.1,.35],[6.38,0],[duration,0]],
  'rightHand.bend':[[0,0],[4.2,0],[4.55,.35],[4.85,0],[duration,0]],
 });
 else if(mood==='angry')Object.assign(c.tracks,{
  'head.rotation':[[0,0],[1.3,7],[1.8,-8],[2.25,9],[2.7,-9],[3.2,8],[3.7,4],[4.3,7],[5.7,3],[6.8,-17],[8.5,-17],[duration,0]],
  'head.x':[[0,0],[1.3,0],[1.8,-4],[2.25,4],[2.7,-4],[3.2,4],[3.7,0],[duration,0]],
  'torso.bend':[[0,0],[1.4,.4],[4.3,.4],[5.7,.175],[6.8,.05],[8.5,.05],[duration,0]],
  'hatTip.bend':[[0,0],[1.9,.4],[2.4,.9],[2.9,.25],[3.4,.75],[4.4,.3],[6.8,.5],[duration,0]],
 });
 else Object.assign(c.tracks,{
  'head.rotation':[[0,0],[1.5,8],[2.6,12],[3.8,12],[4.25,-16],[5.7,-16],[6.6,13],[7.4,16],[9,8],[duration,0]],
  'head.x':[[0,0],[3.9,0],[4.3,8],[5.7,8],[6.8,0],[duration,0]],
  'hat.rotation':[[0,0],[3.9,0],[4.3,-7],[5.7,-7],[6.8,3],[8,0],[duration,0]],
  'torso.bend':[[0,0],[2.4,.225],[3.9,.225],[4.35,.075],[5.7,.075],[6.35,.5],[7.5,.3],[9,.125],[duration,0]],
  'hatTip.bend':[[0,0],[2.6,.35],[4.3,.65],[5.7,.3],[6.6,1],[7.6,.65],[9,.35],[duration,0]],
  'leftHand.bend':[[0,0],[2.3,0],[2.8,.75],[3.6,.75],[4.4,0],[5.2,.4],[5.8,0],[duration,0]],
  'leftGrip.opacity':[[0,0],[2.1,0],[2.3,1],[4.4,1],[4.7,0],[duration,0]],
 });
 return c;
}

export function addClosedLaptop(scene){
 const hero=scene.packs.wwzard,screen=scene.packs.screen;
 restArt(hero);
 for(const mood of moods){
  const source=hero.clips[id('laptop',mood)],lid=screen.clips[id('laptop',mood)];
  const boundary=mood==='normal'?3.8:mood==='angry'?2.35:8.8;
  const closeEnd=mood==='normal'?2.8:boundary;
  const closing=slice(source,0,closeEnd),opening=slice(source,boundary,source.duration);
  const pose=sampleClip(closing,closing.duration),exit=durationOf(settle(pose),1.1),entry=durationOf(approach(sampleClip(opening,0)),.8);
  hero.clips[id('close',mood)]=join(closing,exit);
  screen.clips[id('close',mood)]=join(slice(lid,0,closeEnd),clip(exit.duration,{'hinge.bend':[[0,1],[exit.duration,1]],'hinge.z':[[0,0,'step'],[.04,-20,'step'],[exit.duration,-20]]}));
  hero.clips[id('open',mood)]=join(entry,opening);
  screen.clips[id('open',mood)]=join(clip(entry.duration,{'hinge.bend':[[0,1],[entry.duration,1]],'hinge.z':[[0,-20,'step'],[entry.duration-.05,0,'step'],[entry.duration,0]]}),slice(lid,boundary,lid.duration));
  const acting=idle(mood),pause=held(mood==='normal'?3.8:mood==='angry'?4.8:6.2);
  hero.clips[id('closed-idle',mood)]=acting;hero.clips[id('closed-pause',mood)]=pause;
  for(const [name,c] of [['closed-idle',acting],['closed-pause',pause]])screen.clips[id(name,mood)]=clip(c.duration,{'hinge.bend':[[0,1]],'hinge.z':[[0,-20]]});
 }
 // Constant channels need a single saved key, not repeated endpoint values.
 for(const p of Object.values(scene.packs))for(const c of Object.values(p.clips))for(const [channel,keys] of Object.entries(c.tracks))
  if(keys.every(k=>k[1]===keys[0][1]))c.tracks[channel]=[[0,keys[0][1]]];
 return scene;
}
