import {clamp} from './index.js';
import {EpisodeController} from './episode.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
const wrap=n=>((n+180)%360+360)%360-180;
const finite=n=>Number.isFinite(n);
export function performanceFeatures(result){
 const face=result.face,b=result.blendshapes||{},hands={};
 for(const h of result.hands||[]){if(h.score<.6||!['Left','Right'].includes(h.side)||h.points.length<21)continue;const p=h.points,size=Math.max(.01,distance(p[0],p[9])),pinch=distance(p[4],p[8])/size<.45,extended=[8,12,16,20].filter(i=>distance(p[i],p[0])>distance(p[i-2],p[0])*1.2).length;
  // MediaPipe handedness assumes a mirrored image. Inference receives the raw camera frame.
  const side=h.side==='Left'?'right':'left';hands[side]={x:p[0].x,y:p[0].y,roll:angle(p[0],p[9])+90,gesture:pinch?'pinch':extended>=3?'open':extended===1?'point':'fist'};
 }
 let expression='neutral';
 if((b.eyeBlinkLeft||0)>.55&&(b.eyeBlinkRight||0)>.55)expression='sleepy';
 else if(Math.max(b.eyeBlinkLeft||0,b.eyeBlinkRight||0)>.65)expression='wink';
 else if((b.jawOpen||0)>.35)expression='surprised';
 else if(((b.mouthSmileLeft||0)+(b.mouthSmileRight||0))/2>.4)expression='happy';
 else if(((b.browDownLeft||0)+(b.browDownRight||0))/2>.5)expression='angry';
 else if(((b.mouthFrownLeft||0)+(b.mouthFrownRight||0))/2>.35)expression='sad';
 return {face:!!face,roll:face?angle(face[33],face[263]):0,expression,hands};
}
export class PerformanceRetargeter{
 constructor(pack){this.pack=pack;this.neutral=null;this.pose={};this.time=null;}
 calibrate(features){if(!features.face)throw new Error('Keep your face visible to calibrate.');this.neutral=structuredClone(features);this.pose={};this.time=null;}
 sample(f,time){
  if(!this.neutral)throw new Error('Calibrate first.');
  const dt=this.time===null?.1:clamp(time-this.time,0,.5),alpha=1-Math.exp(-dt/.09),target={},gestures={};this.time=time;
  const set=(id,delta)=>{const j=this.pack.joints.find(j=>j.id===id);if(j)target[id+'.rotation']=clamp(j.rotation+delta,j.min,j.max);};
  set('head',f.face?wrap(f.roll-this.neutral.roll):0);
  for(const side of ['left','right']){
   const h=f.hands[side],n=this.neutral.hands[side],sign=side==='left'?1:-1,lift=h?clamp(((n?.y??.7)-h.y)*200,-70,100):0;
   const upper=this.pack.joints.find(j=>j.id===side+'Upper');
   if(upper)set(upper.id,sign*lift);else set(side+'Arm',sign*lift);
   set(side+'Hand',h?wrap(h.roll-(n?.roll??0))*.6:0);
   gestures[side]=h?.gesture||'lost';
  }
  for(const [key,value] of Object.entries(target))this.pose[key]=(this.pose[key]??value)+(value-(this.pose[key]??value))*alpha;
  const emotion=this.pack.inputs.emotion?.options.includes(f.expression)&&f.face?f.expression:this.pack.inputs.emotion?.default;
  return {pose:{...this.pose},emotion,gestures,face:f.face};
 }
}
export function assertTake(take,pack){
 if(!take||take.kind!=='performance-take'||take.schemaVersion!==1||!finite(take.duration)||take.duration<=0||take.duration>30||!Array.isArray(take.frames)||take.frames.length<2||take.frames.length>1000)throw new Error('Invalid performance take.');
 let previous=-1,channels;
 for(const f of take.frames){
  if(!finite(f.time)||f.time<0||f.time>take.duration||f.time<=previous||!f.pose||typeof f.pose!=='object'||Array.isArray(f.pose)||!pack.inputs.emotion?.options.includes(f.emotion))throw new Error('Invalid take frame.');previous=f.time;
  const keys=Object.keys(f.pose).sort();if(!keys.length||keys.length>pack.joints.length||channels&&JSON.stringify(keys)!==channels)throw new Error('Inconsistent take channels.');channels=JSON.stringify(keys);
  for(const [key,v] of Object.entries(f.pose)){const j=pack.joints.find(j=>key===j.id+'.rotation');if(!j||!finite(v)||v<j.min||v>j.max)throw new Error('Take exceeds joint limits.');}
 }
 if(take.frames[0].time!==0||take.frames.at(-1).time!==take.duration)throw new Error('Take must include both endpoints.');return take;
}
export function sampleTake(take,time){
 const t=clamp(time,0,take.duration),frames=take.frames;let i=0;while(i<frames.length-1&&frames[i+1].time<=t)i++;
 const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],mix=b.time===a.time?0:(t-a.time)/(b.time-a.time);
 return {pose:Object.fromEntries(Object.entries(a.pose).map(([k,v])=>[k,v+(b.pose[k]-v)*mix])),emotion:a.emotion};
}
export function applyTake(project,shotId,actorId,take,start=0){
 const shot=project.shots.find(s=>s.id===shotId),scene=project.scenes[shot?.scene],actor=scene?.actors.find(a=>a.id===actorId),pack=scene?.packs[actor?.pack];
 if(!pack||!finite(start)||start<0||start>=shot.duration)throw new Error('Choose a frame before the end of the shot.');assertTake(take,pack);
 if(Math.ceil(shot.duration*project.fps)>1995)throw new Error('Use a shorter shot: capture baking allows at most 2000 keys per channel.');
 const end=Math.min(shot.duration,start+take.duration),controller=new EpisodeController({...project,shots:[shot]}),original=t=>controller.frame(t).actors.find(a=>a.id===actorId),after=Math.min(shot.duration,end+1/project.fps);
 shot.actors||={};const cue=shot.actors[actorId]||={clip:pack.states[pack.initial].clip,offset:0,speed:1};cue.pose||={};
 // Sample the original outside the captured interval so clip motion and expression offsets survive.
 const times=[...new Set([0,start,end,shot.duration,...Array.from({length:Math.ceil(shot.duration*project.fps)},(_,i)=>i/project.fps)])].sort((a,b)=>a-b);
 const samples=times.map(t=>({time:t,pose:t>=start&&t<=end?sampleTake(take,t-start).pose:original(t).pose}));
 for(const channel of Object.keys(take.frames[0].pose))cue.pose[channel]=samples.map(f=>[f.time,f.pose[channel],'linear']);
 if(cue.motion&&Object.hasOwn(take.frames[0].pose,cue.motion.joint+'.'+cue.motion.channel))delete cue.motion;
 const keys=(cue.expressions||[]).filter(k=>k[0]<start||k[0]>after);
 for(const f of take.frames){const t=start+f.time;if(t>end)break;if(t===start||keys.at(-1)?.[1]!==f.emotion)keys.push([t,f.emotion]);}
 if(end<shot.duration)keys.push([after,original(after).inputs.emotion]);cue.expressions=keys.sort((a,b)=>a[0]-b[0]);return end-start;
}
