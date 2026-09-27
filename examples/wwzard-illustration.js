import { addWwzardBehaviors } from './wwzard-behavior.js';
import {createWwzardArtwork} from './wwzard-artwork.js';
import {laptopDuration,laptopFoldKeys,laptopGrip,reachingSleeve} from './wwzard-laptop.js';
import {addWwzardEmotions} from './wwzard-emotions.js';
import {addClosedLaptop} from './wwzard-closed-laptop.js';
import {addWwzardTransitions} from './wwzard-transitions.js';
import {addWwzardWave} from './wwzard-wave.js';
import {addWwwzardWindow} from './wwwzard-window.js';

// Original editable path artwork, drawn for Posecraft from the user-supplied
// composition reference at docs/references/wwzard-style-reference.png.
const actor = (id, pack, layer = 'characters') => ({id, name:id, pack, layer, transform:{x:0,y:0,rotation:0,scale:1}});
const k = (values) => values.map(([time, value, easing]) =>
  easing ? [time, value, easing] : [time, value]);
const clip = (duration, loop, tracks, events = []) => ({
  duration, loop,
  tracks: Object.fromEntries(Object.entries(tracks).map(([channel, values]) => [channel, k(values)])),
  ...(events.length ? { events } : {}),
});

function wizardPack() {
  const {joints,parts}=createWwzardArtwork().wwzard;
  const clips = {
    work: clip(4.8, true, {
      'torso.y': [[0, 0], [1.05, 0], [1.35, 1], [2.15, 1], [2.5, 0], [4.8, 0]],
      'head.rotation': [[0, 0], [1.1, 0], [1.5, 2], [2.3, 2], [2.7, 0], [4.8, 0]],
      'leftHand.y': [[0, 0], [.48, 0], [.62, -4], [.78, 0], [1.3, 0], [1.43, -3], [1.57, 0], [4.8, 0]],
      'rightHand.y': [[0, 0], [.85, 0], [.97, -4], [1.15, 0], [1.68, 0], [1.82, -3], [1.98, 0], [4.8, 0]],
      'torso.bend': [[0, 0], [1.05, 0], [1.5, .15], [2.15, .15], [2.7, 0], [4.8, 0]],
      'hatTip.bend': [[0, 0], [1.4, 0], [1.9, .12], [2.45, .12], [3, 0], [4.8, 0]],
    }, [{ time: 2.75, name: 'work-phrase-complete' }]),
    notice: clip(1.15, false, {
      'torso.rotation': [[0, 0], [.12, 2], [.42, -5], [.83, -5], [1.15, 0]],
      'head.rotation': [[0, 0], [.16, 3], [.47, -12], [.83, -12], [1.15, 0]],
      'hat.rotation': [[0, 0], [.2, 0], [.55, -5], [.88, -5], [1.15, 0]],
      'torso.bend': [[0, 0], [.16, .45], [.47, .08], [.83, .08], [1.15, 0]],
      'hatTip.bend': [[0, 0], [.3, 0], [.61, .95], [.88, .65], [1.15, 0]],
      'leftHand.y': [[0, 0], [.25, -4], [.58, -12], [.86, -12], [1.15, 0]],
      'rightHand.y': [[0, 0], [.22, -4], [.57, -10], [.84, -10], [1.15, 0]],
    }, [{ time: .55, name: 'noticed' }, { time: 1.15, name: 'notice-complete' }]),
    curious: clip(2.5, false, {
      'torso.rotation': [[0, 0], [.35, -7], [1.67, -7], [2.5, 0]],
      'torso.x': [[0, 0], [.35, 4], [1.67, 4], [2.5, 0]],
      'head.rotation': [[0, 0], [.42, -10], [1.64, -10], [2.5, 0]],
      'hat.rotation': [[0, 0], [.48, -6], [1.8, -6], [2.5, 0]],
      'torso.bend': [[0, 0], [.4, .55], [1.64, .55], [2.5, 0]],
      'hatTip.bend': [[0, 0], [.2, 0], [.68, .85], [1.4, .85], [1.85, .55], [2.5, 0]],
      'leftArm.bend': [[0, 0], [.46, 1], [1.62, 1], [2.5, 0]],
      'leftArm.rotation': [[0, 0], [.39, -18], [1.62, -18], [2.5, 0]],
      'leftHand.rotation': [[0, 0], [.44, -13], [1.62, -13], [2.5, 0]],
      'rightHand.y': [[0, 0], [.42, -12], [1.67, -12], [2.5, 0]],
    }, [{ time: 2.5, name: 'curious-complete' }]),
    greet: clip(2.2, false, {
      'torso.rotation': [[0, 0], [.23, -5], [1.45, -5], [2.2, 0]],
      'head.rotation': [[0, 0], [.25, -8], [1.5, -8], [2.2, 0]],
      'rightArm.rotation': [[0, 0], [.19, 8], [.57, -54], [.91, -54], [1.12, -46], [1.36, -58], [1.5, -54], [2.2, 0]],
      'rightHand.rotation': [[0, 0], [.52, -5], [.78, 16], [1.09, -8], [1.36, 15], [1.53, 0], [2.2, 0]],
      'leftHand.y': [[0, 0], [.55, -8], [1.43, -8], [2.2, 0]],
      'torso.bend': [[0, 0], [.19, .35], [.54, .1], [1.5, .1], [2.2, 0]],
      'rightArm.bend': [[0, 0], [.19, .12], [.62, .95], [.91, .8], [1.12, .55], [1.36, 1], [1.55, .8], [2.2, 0]],
      'hatTip.bend': [[0, 0], [.32, 0], [.72, .9], [1.16, .28], [1.56, .45], [2.2, 0]],
    }, [{ time: .64, name: 'greet-gesture' }, { time: 2.2, name: 'greet-complete' }]),
    frustrated: clip(2.8, false, {
      'torso.rotation': [[0, 0], [.2, -3], [.64, 8], [1.9, 8], [2.8, 0]],
      'torso.y': [[0, 0], [.6, 7], [1.92, 7], [2.8, 0]],
      'head.rotation': [[0, 0], [.35, 2], [.75, 11], [1.9, 11], [2.8, 0]],
      'hat.rotation': [[0, 0], [.7, 2], [1.95, 2], [2.8, 0]],
      'torso.bend': [[0, 0], [.2, .12], [.72, 1], [1.9, 1], [2.8, 0]],
      'hatTip.bend': [[0, 0], [.35, .12], [.95, 1], [1.65, .8], [2.02, .8], [2.8, 0]],
      'leftArm.bend': [[0, 0], [.24, .1], [.78, .85], [1.85, .85], [2.8, 0]],
      'rightArm.bend': [[0, 0], [.24, .1], [.78, .65], [1.85, .65], [2.8, 0]],
      'leftArm.rotation': [[0, 0], [.24, 5], [.72, 24], [1.85, 24], [2.8, 0]],
      'rightArm.rotation': [[0, 0], [.24, -6], [.72, 18], [1.85, 18], [2.8, 0]],
      'leftHand.rotation': [[0, 0], [.68, -12], [1.85, -12], [2.8, 0]],
      'rightHand.rotation': [[0, 0], [.68, 13], [1.85, 13], [2.8, 0]],
    }, [{ time: 2.8, name: 'frustrated-complete' }]),
    rest: clip(4, true, {
      // Clear the back edge before changing order, then lower behind the desk.
      // Reverse that path before returning the hands above the keyboard.
      'leftArm.rotation': [[0,0],[.35,-30],[.45,-30],[1.1,35],[2.5,35],[3.25,-30],[3.4,-30],[4,0]],
      'rightArm.rotation': [[0,0],[.35,-16],[.45,-16],[1.1,35],[2.5,35],[3.25,-16],[3.4,-16],[4,0]],
      'rightArm.y': [[0,0],[.45,0],[1.1,8],[2.5,8],[3.25,0],[4,0]],
      'leftArm.bend': [[0,0],[.35,.4],[1.1,.25],[2.5,.25],[3.25,.4],[4,0]],
      'rightArm.bend': [[0,0],[.35,.25],[1.1,.2],[2.5,.2],[3.25,.25],[4,0]],
      'leftArm.z': [[0,0,'step'],[.4,-38,'step'],[3.32,0],[4,0]],
      'rightArm.z': [[0,0,'step'],[.4,-18,'step'],[3.32,0],[4,0]],
      'torso.y': [[0, 0], [.8, 0], [1.45, 2], [2.1, 2], [2.8, 0], [4, 0]],
      'head.rotation': [[0, 0], [.8, 0], [1.48, 2], [2.2, 2], [2.85, 0], [4, 0]],
      'torso.bend': [[0, 0], [.8, 0], [1.65, .3], [2.1, .3], [3, 0], [4, 0]],
      'hatTip.bend': [[0, 0], [1.1, 0], [1.85, .18], [2.5, .18], [3.2, 0], [4, 0]],
    }),
  };
  // Sleeve and hand share the same authored timing, not two approximations.
  // Older lift drawings become a shape track; bigger gestures author the bend
  // directly. The saved result contains ordinary editable animation channels.
  for(const motion of Object.values(clips))for(const [arm,hand,lift] of [['leftArm','leftHand',12],['rightArm','rightHand',10]]){
    const bend=arm+'.bend',travel=hand+'.y';
    if(!motion.tracks[bend]&&motion.tracks[travel])motion.tracks[bend]=motion.tracks[travel].map(([time,value])=>[time,Math.min(1,-value/lift)||0]);
    if(motion.tracks[bend])motion.tracks[travel]=motion.tracks[bend].map(([time,value])=>[time,+(-value*lift).toFixed(4)||0]);
  }
  // The contour channel reserves 0..0.25 for the existing elbow bend, then
  // follows authored reach poses around the lid's fixed hinge.
  joints.push({id:'leftGrip',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
  const folds=Array.from({length:9},(_,i)=>i/8),restWrist=[275,317],bentWrist=[275,305];
  for(const id of ['left-sleeve','left-sleeve-shadow']){
    const part=parts.find(p=>p.id===id),bent=part.spatial.morph.target;
    part.spatial.morph={channel:'leftGrip.bend',target:reachingSleeve(laptopGrip(1),id.endsWith('shadow')),frames:[{value:.25,target:bent},...folds.slice(0,-1).map(fold=>({value:.4+.6*fold,target:reachingSleeve(laptopGrip(fold),id.endsWith('shadow'))}))]};
  }
  for(const motion of Object.values(clips))if(motion.tracks['leftArm.bend'])motion.tracks['leftGrip.bend']=motion.tracks['leftArm.bend'].map(([time,value])=>[time,value*.25]);
  const times=[[0,0],[.35,.25],[.9,.4],...laptopFoldKeys.filter(([t])=>t>=1.05&&t<=5.4).map(([t,f,ease])=>[t,.4+.6*f,ease]),[5.7,.4],[6.3,.25],[7,0]];
  const wrist=value=>value===0?restWrist:value===.25?bentWrist:laptopGrip((value-.4)/.6);
  clips.laptop=clip(laptopDuration,false,{
    'leftGrip.bend':times,
    'leftHand.x':times.map(([t,v,ease])=>[t,wrist(v)[0]-restWrist[0],...(ease?[ease]:[])]),
    'leftHand.y':times.map(([t,v,ease])=>[t,wrist(v)[1]-restWrist[1],...(ease?[ease]:[])]),
    'leftArm.z':[[0,0],[7,0]],
    'head.rotation':[[0,0],[1.05,2],[2.55,7],[3.8,7],[5.4,2],[7,0]],
    'hatTip.bend':[[0,0],[2.55,.2],[3.8,.2],[5.4,.1],[7,0]],
  });
  // The other hand clears the deck before the lid moves, then resumes typing.
  for(const [channel,keys] of Object.entries(clips.rest.tracks))if(channel.startsWith('right'))clips.laptop.tracks[channel]=keys.map(([t,value,ease])=>[t<=1.1?t/1.1:t<=2.5?1+(t-1.1)*4.5/1.4:5.5+(t-2.5),value,...(ease?[ease]:[])]);
  // The palm and sleeve stay behind the cover. Only the fingertips curl over
  // its outer face, with the independently ordered rim covering their join.
  parts.push({id:'left-grip-fingers',joint:'leftHand',d:'M2 2Q5 -1 8 2L13 8Q15 12 11 13L7 11L3 7Z',fill:'#f2d9b7',gradient:{type:'linear',x1:0,y1:1,x2:1,y2:0,stops:[[0,'#d6b397'],[1,'#fff0cf']]},opacityChannel:'leftGrip.opacity',spatial:{sceneDepth:{value:60}}});
  for(const motion of Object.values(clips))motion.tracks['leftGrip.opacity']=[[0,0],[motion.duration,0]];
  clips.laptop.tracks['leftGrip.opacity']=[[0,0],[.75,0],[.9,1],[5.7,1],[5.95,0],[7,0]];
  // Births follow the uneven keystrokes. Each drawing rises, grows and pops
  // out before the work phrase ends. Other actions explicitly keep it hidden.
  for(const [i,start,life,dx,rise] of [[1,.58,1.55,-9,78],[2,1,1.2,12,62],[3,1.49,1.8,-4,94],[4,1.99,1.35,9,74]]){
    const id=`magic-${i}`,at=f=>+(start+life*f).toFixed(4);
    for(const motion of Object.values(clips))motion.tracks[id+'.opacity']=[[0,0],[motion.duration,0]];
    clips.work.tracks[id+'.opacity']=[[0,0],[start,0],[at(.12),.9],[at(.7),.85],[at(.82),.8],[at(.96),0],[4.8,0]];
    clips.work.tracks[id+'.bend']=[[0,0],[start,0],[at(.7),.43],[at(.82),.54],[at(.96),1],[4.8,0]];
    clips.work.tracks[id+'.x']=[[0,0],[start,0],[at(.82),dx],[at(.96),dx],[4.8,0]];
    clips.work.tracks[id+'.y']=[[0,0],[start,0],[at(.82),-rise],[at(.96),-rise],[4.8,0]];
    clips.work.tracks[id+'.rotation']=[[0,0],[start,0],[at(.7),32],[at(.96),72],[4.8,0]];
  }
  const states = Object.fromEntries(Object.keys(clips).map(id => [id, {
    clip: id,
    transitions: Object.keys(clips).filter(to => to !== id).map(to => ({
      to, duration: to === 'work' || to === 'rest' ? .32 : .22,
      when: { input: 'action', equals: to },
    })),
  }]));
  return {
    name: 'Wwwzard at work',
    description: 'Faceted wizard with a concealed face, deforming sleeves and robe, and a flexible folded hat.',
    provenance: {
      source: 'Original Posecraft path artwork based on the user-supplied Wwwzard visual reference',
      license: 'Project artwork; reference rights unspecified',
      note: 'The supplied image guides silhouette, palette and composition. No source pixels are embedded.',
    },
    spatial: true, joints, parts,
    inputs: { action: { type: 'string', default: 'work', options: Object.keys(clips) } },
    clips, states, initial: 'work',
  };
}

export function createWwzardIllustration() {
  const scene = {
    schemaVersion: 1, kind: 'scene', id: 'wwzard-desk',
    name: 'Wwwzard at the laptop', revision: 0,
    bounds: { width: 513, height: 529 },
    requiredFeatures: ['rigs', 'paths', 'instances', 'timelines', 'input-states', 'spatial-rig', 'scene-depth', 'part-gradients'],
    packs: {...createWwzardArtwork(), wwzard:wizardPack()},
    lighting: {enabled:false},
    actors: [
      { ...actor('room', 'room', 'background'), unlit: true },
      { ...actor('wwzard', 'wwzard'), depth: { value: 30 }, inputs: { action: 'work' } },
      { ...actor('desk', 'desk'), depth: { value: 5 }, unlit: true },
      { ...actor('keyboard', 'keyboard'), depth: { value: 10 }, unlit: true },
      { ...actor('screen', 'screen'), depth: { value: 50 }, unlit: true },
    ],
  };
  return addWwwzardWindow(addWwzardBehaviors(addWwzardWave(addWwzardTransitions(addClosedLaptop(addWwzardEmotions(scene))))));
}
