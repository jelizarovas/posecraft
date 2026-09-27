import {sampleClip} from '@posecraft/runtime/animation';

const round=n=>+n.toFixed(4)||0;
const constant=pose=>Object.fromEntries(Object.entries(pose).map(([key,value])=>[key,[[0,value]]]));
const motion=(duration,pose,tracks)=>({duration,loop:false,tracks:{...constant(pose),...tracks}});
const warp=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>move(...pair.split(/\s+/).map(Number)).map(round).join(' '));

/** Authoring helper only. Saved scenes contain the resulting paths and keys. */
export function addWwwzardLivingMotion(scene){
  const hero=scene.packs.wwzard;
  const open=sampleClip({...hero.clips.work,loop:false},0),closed=sampleClip(hero.clips['closed-pause'],0);
  for(const id of [1,2,3,4])open[`magic-${id}.opacity`]=0;
  // A visitor moves the lid. The wizard's hands withdraw before the cover
  // reaches them, then his elbows stay tucked while his open palms rise.
  hero.joints.push({id:'queryLift',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
  for(const [joint,origin,span,lift,spread] of [['leftArm',191,54,18,-14],['rightArm',249,36,8,22]]){
    for(const part of hero.parts.filter(part=>part.joint===joint)){
      const target=warp(part.d,(x,y)=>{const w=Math.max(0,Math.min(1,(x-origin)/span));return [x+spread*w,y-lift*w];});
      part.spatial.morph.layers.push({channel:'queryLift.bend',target});
    }
  }
  const query={...open,'nearRetract.bend':.5,'farRetract.bend':.5,'queryLift.bend':1,
    'leftGrip.bend':0,'rightArm.bend':0,'leftHand.x':-57,'leftHand.y':-48,'rightHand.x':-38,'rightHand.y':-40,
    'leftHand.bend':1,'rightHand.bend':1,'leftArm.z':0,'rightArm.z':0};
  hero.clips['visitor-close']=motion(.9,open,{
    'nearRetract.bend':[[0,0],[.12,.5],[.9,.5]],'farRetract.bend':[[0,0],[.12,.5],[.9,.5]],
    'queryLift.bend':[[0,0],[.12,0],[.42,1],[.9,1]],
    'leftGrip.bend':[[0,0]],'rightArm.bend':[[0,0]],
    'leftHand.x':[[0,0],[.12,-43],[.42,-57],[.9,-57]],'leftHand.y':[[0,0],[.12,-30],[.42,-48],[.9,-48]],
    'rightHand.x':[[0,0],[.12,-60],[.42,-38],[.9,-38]],'rightHand.y':[[0,0],[.12,-32],[.42,-40],[.9,-40]],
    'leftHand.bend':[[0,0],[.42,1],[.9,1]],'rightHand.bend':[[0,0],[.42,1],[.9,1]],
    'head.rotation':[[0,0],[.17,7],[.52,-8],[.9,-8]],
    'hatTip.bend':[[0,0],[.28,.6],[.65,.2],[.9,.2]],
  });
  scene.packs.screen.clips['visitor-close']={duration:.9,loop:false,tracks:{'hinge.bend':[[0,0],[.1,0],[.58,1],[.9,1]],'hinge.z':[[0,0,'step'],[.61,-20,'step'],[.9,-20]]}};
  scene.packs.screen.states['visitor-close']={clip:'visitor-close',transitions:[]};
  const scroll=(duration,keys,tracks)=>motion(duration,open,{
    'nearRetract.bend':keys,
    // This follows the existing first retraction segment exactly. Both the
    // sleeve contour and wrist move onto the actual trackpad, behind the lid.
    'leftHand.x':keys.map(([t,v])=>[t,round(-86*v)]),
    'leftHand.y':keys.map(([t,v])=>[t,round(-60*v)]),
    'leftGrip.bend':[[0,0]],'leftArm.z':[[0,0]],
    ...tracks,
  });
  hero.clips.trackpad=scroll(3.3,[[0,0],[.55,.31],[.95,.31],[1.22,.35],[1.42,.29],[1.7,.33],[1.95,.29],[2.45,.29],[3.3,0]],{
    'leftHand.bend':[[0,0],[.8,0],[1.1,.7],[1.38,0],[1.68,.55],[2,0],[3.3,0]],
    'head.rotation':[[0,0],[.65,3],[2.45,3],[3.3,0]],
  });
  hero.clips.doomscroll=scroll(7.8,[[0,0],[.6,.31],[1.3,.31],[1.55,.35],[1.8,.29],[2.65,.29],[2.95,.35],[3.25,.29],[4.2,.29],[4.5,.34],[4.8,.29],[6.65,.29],[7.8,0]],{
    'leftHand.bend':[[0,0],[1.3,0],[1.55,.6],[1.8,0],[2.65,0],[2.95,.6],[3.25,0],[4.2,0],[4.5,.6],[4.8,0],[7.8,0]],
    'head.rotation':[[0,0],[.85,4],[2.7,4],[3.45,8],[5.7,8],[6.55,3],[7.8,0]],
    'head.x':[[0,0],[.85,3],[3.45,7],[5.7,7],[7.8,0]],
    'head.y':[[0,0],[.85,1],[3.45,3],[5.7,3],[7.8,0]],
    'torso.bend':[[0,0],[.85,.08],[3.45,.2],[5.7,.2],[7.8,0]],
    'hatTip.bend':[[0,0],[1,.06],[3.8,.2],[5.7,.2],[7.8,0]],
  });
  hero.clips.sigh=motion(3.8,open,{
    'head.rotation':[[0,0],[.9,-3],[1.25,-3],[2.05,9],[2.9,7],[3.8,0]],
    'head.y':[[0,0],[.9,-3],[1.25,-3],[2.05,4],[2.9,3],[3.8,0]],
    'torso.bend':[[0,0],[.9,.05],[1.25,.05],[2.05,.35],[2.9,.28],[3.8,0]],
    'hatTip.bend':[[0,0],[1.25,.08],[2.2,.45],[2.9,.32],[3.8,0]],
  });
  hero.clips['laptop-puzzled']=motion(2.25,query,{
    'head.rotation':[[0,0],[.28,10],[.68,10],[.98,-12],[1.55,-12],[2.25,0]],
    'head.x':[[0,0],[.28,2],[.68,2],[.98,-4],[1.55,-4],[2.25,0]],
    'hat.rotation':[[0,0],[.35,3],[.68,3],[1.08,-4],[1.55,-4],[2.25,0]],
    'hatTip.bend':[[0,0],[.4,.3],[.68,.2],[1.15,.5],[1.6,.2],[2.25,0]],
  });
  hero.clips['laptop-annoyed']=motion(2.7,query,{
    'head.rotation':[[0,0],[.22,8],[.5,-11],[.82,10],[1.1,-10],[1.6,-10],[2.1,5],[2.7,0]],
    'head.x':[[0,0],[.22,2],[.5,-4],[.82,3],[1.1,-4],[1.6,-4],[2.7,0]],
    'hatTip.bend':[[0,0],[.35,.6],[.68,.2],[.96,.7],[1.4,.3],[2.7,0]],
    'torso.bend':[[0,0],[.3,.2],[1.6,.2],[2.7,0]],
  });
  hero.clips.breathe=motion(7.4,closed,{
    // Two measured inhales and longer exhales. Hands stay supported on the lid.
    'head.y':[[0,0],[1.15,-5],[1.55,-5],[3.25,3],[3.7,3],[4.85,-4],[5.25,-4],[6.95,2],[7.4,0]],
    'head.rotation':[[0,0],[1.15,-3],[1.55,-3],[3.25,4],[3.7,4],[4.85,-2],[5.25,-2],[6.95,2],[7.4,0]],
    'torso.bend':[[0,0],[1.15,.04],[1.55,.04],[3.25,.27],[3.7,.27],[4.85,.03],[5.25,.03],[6.95,.15],[7.4,0]],
    'hatTip.bend':[[0,0],[1.55,.03],[3.45,.25],[3.7,.25],[5.25,.03],[7.05,.15],[7.4,0]],
  });
  hero.clips['breath-settle']=motion(.65,closed,{});
  for(const id of ['trackpad','doomscroll','sigh','visitor-close','laptop-puzzled','laptop-annoyed','breath-settle','breathe']){
    hero.states[id]={clip:id,transitions:[]};
    hero.inputs.action.options.push(id);
  }
  return scene;
}
