import {reachingSleeve} from './wwzard-laptop.js';

const round=n=>+n.toFixed(3)||0;
const warp=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>move(...pair.split(/\s+/).map(Number)).map(round).join(' '));
const fixed=value=>[[0,value]];
const bone=id=>({id,parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
const clamp=n=>Math.max(0,Math.min(1,n));
const appendMorph=(part,layer)=>{
  part.spatial??={};
  if(part.spatial.morph){part.spatial.morph.layers??=[];part.spatial.morph.layers.push(layer);}
  else part.spatial.morph=layer;
};
const variant=(pack,part,brace,depart)=>{
  const layer={channel:'hostArms.bend',frames:[{value:.5,target:brace}],target:depart};
  appendMorph(part,layer);
};

function addBodyInertia(hero){
  hero.joints.push(bone('hostBody'));
  for(const part of hero.parts){
    let weight;
    if(part.id.startsWith('robe-'))weight=(x,y)=>clamp((360-y)/100);
    else if(part.id==='reading-near-sleeve')weight=(x,y)=>clamp((306-y)/55);
    else if(part.id==='reading-far-sleeve')weight=x=>1-clamp((x-260)/58);
    else if(part.id.startsWith('left-sleeve'))weight=x=>1-clamp((x-207)/52);
    else if(part.id==='right-sleeve')weight=x=>1-clamp((x-259)/28);
    else continue;
    // Displace shoulders, not the wrist or seated hem. The same contour layer
    // sits over the current arm drawing, including paper/book contacts.
    const target=sign=>warp(part.d,(x,y)=>[x+sign*18*weight(x,y),y]);
    appendMorph(part,{channel:'hostBody.bend',frames:[{value:.5,target:target(-1)}],target:target(1)});
  }
}

function addPlantInertia(scene,names){
  const room=scene.packs.room;
  if(!room?.parts.some(p=>p.id.startsWith('plant-')))return;
  // The root stays inside the soil. One transform moves foliage and existing
  // gust contours together; the pot, desk shadow and window remain cached.
  room.joints.push({...bone('hostPlant'),x:102,y:327});
  for(const part of room.parts.filter(p=>p.id.startsWith('plant-'))){
    part.joint='hostPlant';part.transform=`translate(-102 -327)${part.transform?' '+part.transform:''}`;
  }
  for(const phase of ['depart','arrive'])for(const [side,sign] of [['left',-1],['right',1]]){
    const id=names[phase][side];
    const keys=phase==='depart'?[[0,-sign*3],[.2,-sign*8],[.65,-sign*6],[1,-sign*5]]:[[0,-sign*4],[.45,-sign*5],[.76,sign*9],[.88,-sign*5],[1,0]];
    room.clips[id]={duration:1,loop:false,tracks:{'hostPlant.rotation':keys}};
    room.states[id]={clip:id,transitions:[]};
  }
  scene.hostTransition.actors.push({actor:'room',...structuredClone(names)});
}

/** Shared authored travel response. Playback only receives phase/direction/progress. */
export function addWwwzardHostTransition(scene){
  if(scene.hostTransition)return scene;
  const hero=scene.packs.wwzard,story=scene.id==='wwwzard-stories',contact=scene.id==='wwwzard-contact';
  addBodyInertia(hero);
  const depart={},arrive={};
  if(contact){
    // The far hand may be holding the separately animated paper plane. Keep
    // that whole contact intact and let the free hand brace against the hat.
    const arm=hero.joints.find(j=>j.id==='leftArm');arm.min=Math.min(arm.min,-58);
    depart['leftArm.rotation']=fixed(-58);arrive['leftArm.rotation']=fixed(-12);
  }else{
    hero.joints.push(bone('hostArms'));
    if(story){
      const near=hero.parts.find(p=>p.id==='reading-near-sleeve');
      const raisedNear='M180 243Q199 235 211 251Q193 257 162 234L151 177Q149 155 134 151Q120 151 122 168L144 239Q151 266 180 243Z';
      variant(hero,near,near.d,raisedNear);
      const far=hero.parts.find(p=>p.id==='reading-far-sleeve');
      const raisedFar='M238 239Q250 232 260 243Q282 245 350 165L366 168Q300 269 250 267Q237 257 238 239Z';
      variant(hero,far,far.d,raisedFar);
      for(const part of hero.parts.filter(p=>p.id.startsWith('reading-left-')))variant(hero,part,part.d,warp(part.d,(x,y)=>[x-36,y-170]));
      for(const part of hero.parts.filter(p=>p.id.startsWith('reading-right-')))variant(hero,part,part.d,warp(part.d,(x,y)=>[x+21,y-149]));
      depart['pageHand.bend']=fixed(0);arrive['pageHand.bend']=fixed(0);
    }else{
      for(const id of ['left-sleeve','left-sleeve-shadow']){
        const part=hero.parts.find(p=>p.id===id),shadow=id.endsWith('shadow');
        // The overhead elbow has its own outline. Reusing the downward reach
        // controls here would leave a thin ribbon and a pointed elbow tail.
        const raised=shadow?warp(part.d,()=>[182,249]):'M181 244Q193 234 207 246Q180 263 158 244Q139 226 113 173L138 164L145 176Q153 215 174 229Q187 237 190 248Q169 255 177 253Z';
        variant(hero,part,reachingSleeve([232,291],shadow,[209,289]),raised);
      }
      for(const id of ['right-sleeve','right-cuff']){
        const part=hero.parts.find(p=>p.id===id);
        const target=(dx,dy)=>warp(part.d,(x,y)=>{const weight=Math.max(0,Math.min(1,(x-249)/59));return [x+dx*weight,y+dy*weight];});
        variant(hero,part,target(-18,-16),target(43,-139));
      }
      Object.assign(depart,{'leftHand.x':fixed(-149),'leftHand.y':fixed(-149),'rightHand.x':fixed(43),'rightHand.y':fixed(-139)});
      Object.assign(arrive,{'leftHand.x':fixed(-43),'leftHand.y':fixed(-26),'rightHand.x':fixed(-18),'rightHand.y':fixed(-16)});
      for(const channel of ['leftArm.rotation','rightArm.rotation','leftHand.rotation','rightHand.rotation','leftArm.y','rightArm.y','leftGrip.bend','leftArm.bend','rightArm.bend','nearRetract.bend','farRetract.bend','queryLift.bend','leftGrip.opacity']){
        if(hero.joints.some(j=>j.id===channel.split('.')[0])){depart[channel]=fixed(0);arrive[channel]=fixed(0);}
      }
    }
    depart['hostArms.bend']=fixed(1);arrive['hostArms.bend']=fixed(.5);
  }
  // Shoulder contours lean over a planted lower body. The head follows that
  // lean, then the softer hat and foliage follow the stop a little later.
  const names={depart:{},arrive:{}};
  for(const [phase,arms] of [['depart',depart],['arrive',arrive]])for(const [side,direction] of [['left',-1],['right',1]]){
    const id=`host-${phase}-${side}`,sign=direction;
    const tracks={...structuredClone(arms),
      'hostBody.bend':phase==='depart'?fixed(.75-sign*.2):[[0,.75-sign*.12],[.45,.75-sign*.17],[.75,.75+sign*.25],[.88,.75-sign*.16],[1,.75]],
      'head.rotation':phase==='depart'?[[0,-sign*7],[.18,-sign*13],[.65,-sign*13],[1,-sign*10]]:[[0,-sign*7],[.45,-sign*7],[.75,sign*17],[.88,-sign*9],[1,0]],
      'head.x':phase==='depart'?[[0,-sign*9],[.22,-sign*14],[1,-sign*14]]:[[0,-sign*9],[.45,-sign*12],[.75,sign*18],[.88,-sign*11],[1,0]],
      'hat.rotation':phase==='depart'?[[0,-sign*3],[.3,-sign*7],[1,-sign*5]]:[[0,-sign*3],[.48,-sign*4],[.78,sign*9],[.9,-sign*6],[1,0]],
      'hatTip.bend':phase==='depart'?[[0,.2],[.3,.8],[.65,.7],[1,.7]]:[[0,.2],[.48,.25],[.78,.9],[.91,.25],[1,0]],
    };
    hero.clips[id]={duration:1,loop:false,tracks};hero.states[id]={clip:id,transitions:[]};
    if(hero.inputs.action?.options)hero.inputs.action.options.push(id);
    names[phase][side]=id;
  }
  scene.hostTransition={actors:[{actor:'wwzard',...names}]};
  addPlantInertia(scene,names);
  if(story){
    // A page-turn leaf is released during travel, not left suspended between
    // the book and a hand overhead. The fixed book covers never move.
    const book=scene.packs.book;
    for(const id of Object.values(names).flatMap(group=>Object.values(group))){book.clips[id]={duration:1,loop:false,tracks:{'leaf.opacity':fixed(0)}};book.states[id]={clip:id,transitions:[]};}
    scene.hostTransition.actors.push({actor:'book',...structuredClone(names)});
  }
  return scene;
}
