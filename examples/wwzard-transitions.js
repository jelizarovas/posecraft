import {sampleClip,interpolate} from '@posecraft/runtime/animation';

const round=n=>+n.toFixed(4)||0;
const movePath=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,p=>move(...p.split(/\s+/).map(Number)).map(round).join(' '));
const arms=[{side:'left',control:'nearRetract',pull:[-43,-30],down:[-48,39],origin:191,span:54,z:20,hidden:-38},
 {side:'right',control:'farRetract',pull:[-60,-32],down:[-65,48],origin:249,span:36,z:40,hidden:-18}];
const curve=(keys)=>keys.map(([t,v,e])=>[round(t),v,e||'linear']);

// Retraction is independent of the gesture shape. The elbow can fold while
// the hand slides back, without travelling through unrelated grip poses.
function retract(c,arm,keys,depth){
 const channel=arm.control+'.bend',tracks=c.tracks,old={...c,tracks:{...tracks}};
 keys=curve(keys);tracks[channel]=keys;
 for(const [axis,index] of [['x',0],['y',1]]){
  const hand=arm.side+'Hand.'+axis;
  const times=[...new Set([...keys.map(k=>k[0]),...(old.tracks[hand]||[]).map(k=>k[0])])].sort((a,b)=>a-b);
  tracks[hand]=times.map(t=>[t,round((sampleClip(old,t)[hand]||0)+interpolate([[0,0],[.5,arm.pull[index]],[1,arm.down[index]]],interpolate(keys,t), 'linear')),'linear']);
 }
 tracks[arm.side+'Arm.rotation']=[[0,0]];tracks[arm.side+'Arm.y']=[[0,0]];
 tracks[arm.side+'Arm.z']=depth.map(([t,v])=>[round(t),v,'step']);
}
const fixed=(c,channel,value)=>c.tracks[channel]=[[0,value]];
function closedBase(c,side){
 if(side==='left'){fixed(c,'leftGrip.bend',.65);fixed(c,'leftHand.x',-27);fixed(c,'leftHand.y',15);}
 else{fixed(c,'rightArm.bend',.5);fixed(c,'rightHand.x',7);fixed(c,'rightHand.y',14);}
}

export function addWwzardTransitions(scene){
 const hero=scene.packs.wwzard;
 for(const arm of arms){
  hero.joints.push({id:arm.control,parent:'root',x:0,y:0,length:0,rotation:0,min:-180,max:180});
  for(const part of hero.parts.filter(p=>p.joint===arm.side+'Arm')){
   const shape=delta=>movePath(part.d,(x,y)=>{const w=Math.max(0,Math.min(1,(x-arm.origin)/arm.span));return [x+delta[0]*w,y+delta[1]*w];});
   const layer={channel:arm.control+'.bend',frames:[{value:.5,target:shape(arm.pull)}],target:shape(arm.down)};
   if(!part.spatial.morph)throw Error('Retraction requires an authored sleeve morph');
   // Preserve a hanging sleeve's volume instead of compressing its entire
   // width through an x-weighted translation. The wrist still meets the hand.
   if (arm.side === 'left') layer.target = part.id.endsWith('shadow')
    ? 'M186 279Q187 309 202 339L213 357L216 367L192 328Q180 309 177 286Z'
    : 'M181 244Q193 234 207 246Q222 266 220 294Q222 323 225 338L225 357L211 369Q199 349 192 328Q180 309 177 286Q169 272 177 253Z';
   part.spatial.morph.layers=[layer];
  }
 }
 for(const [name,c] of Object.entries(hero.clips)){
  const base=name.split('--')[0];
  if(base==='rest'){
   const duration=name.endsWith('--disappointed')?2.2:name.endsWith('--angry')?1.6:1.8,scale=duration/c.duration;
   for(const keys of Object.values(c.tracks))for(const key of keys)key[0]=round(key[0]*scale);
   c.duration=duration;
  }
  const duration=c.duration;
  if(base==='rest'){
   for(const arm of arms){
    // Keep the original working contour; only fold and retract it.
    fixed(c,arm.side==='left'?'leftGrip.bend':'rightArm.bend',0);
    fixed(c,arm.side+'Hand.x',0);fixed(c,arm.side+'Hand.y',0);
    const end=duration,exit=end-.7;
    retract(c,arm,[[0,0],[.3,.5],[.7,1],[exit,1],[end-.3,.5],[end,0]],[[0,0],[.3,arm.hidden],[end-.3,0]]);
   }
  }
  if(base==='closed-idle'&&name.includes('--')){
   const angry=name.endsWith('--angry'),release=angry?4.3:7,returnAt=angry?8.7:10.7,pullTime=angry?.45:.3;
   // Preserve the angry elbow hold, then fold directly toward the body.
   const left=arms[0],right=arms[1];
   if(angry){
    c.tracks['leftGrip.bend']=[[0,.65],[1.3,.8],[release,.8],[release+pullTime,.65],[duration,.65]];
    c.tracks['leftHand.x']=[[0,-27],[1.3,25],[release,25],[release+pullTime,-27],[duration,-27]];
    c.tracks['leftHand.y']=[[0,15],[1.3,-16],[release,-16],[release+pullTime,15],[duration,15]];
   }else{
    for(const channel of ['leftGrip.bend','leftHand.x','leftHand.y'])c.tracks[channel]=c.tracks[channel].filter(k=>k[0]<=release);
    for(const [channel,value]of [['leftGrip.bend',.65],['leftHand.x',-27],['leftHand.y',15]])c.tracks[channel].push([duration,value]);
   }
   for(const channel of ['leftGrip.bend','leftHand.x','leftHand.y'])c.tracks[channel]=curve(c.tracks[channel]);
   retract(c,left,[[0,0],[release,0],[release+pullTime,.5],[release+pullTime+.4,1],[returnAt,1],[returnAt+.35,.5],[returnAt+.7,0],[duration,0]],[[0,left.z],[release+pullTime,left.hidden],[returnAt+.35,left.z]]);
   closedBase(c,'right');
   const rightRelease=angry?0:release;
   retract(c,right,[[0,0],...(rightRelease?[[rightRelease,0]]:[]),[rightRelease+.3,.5],[rightRelease+.7,1],[returnAt,1],[returnAt+.35,.5],[returnAt+.7,0],[duration,0]],[[0,right.z],[rightRelease+.3,right.hidden],[returnAt+.35,right.z]]);
  }
  if(base==='close'||base==='open'){
   const arm=arms[1],closing=base==='close',returnAt=closing?duration-1.05:duration-.8;
   const bend=closing?.5:0,from=closing?0:.5;
   c.tracks['rightArm.bend']=[[0,from],[.7,from],[returnAt,bend],[duration,bend]];
   c.tracks['rightHand.x']=[[0,from*14],[.7,from*14],[returnAt,bend*14],[duration,bend*14]];
   c.tracks['rightHand.y']=[[0,from*28],[.7,from*28],[returnAt,bend*28],[duration,bend*28]];
   retract(c,arm,[[0,0],[.3,.5],[.7,1],[returnAt,1],[returnAt+.35,.5],[returnAt+.7,0],[duration,0]],[[0,closing?0:arm.z],[.3,arm.hidden],[returnAt+.35,closing?arm.z:0]]);
  }
 }
 // Compact stationary runs without altering their moving intervals.
 for(const pack of Object.values(scene.packs))for(const c of Object.values(pack.clips))for(const keys of Object.values(c.tracks))
  for(let i=keys.length-2;i>0;i--)if(keys[i-1][1]===keys[i][1]&&keys[i][1]===keys[i+1][1])keys.splice(i,1);
 return scene;
}
