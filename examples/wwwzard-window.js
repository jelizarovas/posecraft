// Shared room placement. Moving the whole opening back keeps its frame, view,
// Contact casement and paper-plane destination in the same authored space.
export const windowPlacement = {x:90,y:-20,rotation:0,scale:.84};
export const windowPoint = (x,y) => [90+x*.84,-20+y*.84];
const root={id:'root',parent:null,x:0,y:0,rotation:0,min:-180,max:180,length:0};
const slide=(d,dy)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,
  pair=>{const [x,y]=pair.split(/\s+/).map(Number);return `${x} ${y+dy}`;});

// Separate event name lets the host receive one request without feeding a
// theme event back into its own handler. The character's action is untouched.
export function addWwwzardWindowInteraction(scene){
  if(!scene.packs.sky)return scene;
  scene.interactions??=[];
  for(const [actor,joint] of [['sky',null],['room','windowView'],...(scene.packs.window?[['window',null]]:[])]){
    const id='window-theme-'+actor;
    if(!scene.interactions.some(i=>i.id===id))scene.interactions.push({id,actor,
      ...(joint?{joint}:{}),gesture:'click',response:'event',event:'window-theme-toggle',resistance:0,cooldown:0});
  }
  const graph=scene.behaviorGraph;
  if(graph){graph.handlers??=[];if(!graph.handlers.some(h=>h.event==='window-theme-toggle'))
    graph.handlers.push({event:'window-theme-toggle',actions:[{type:'event',event:'theme-toggle',actor:'sky'}]});}
  scene.requiredFeatures=[...new Set([...scene.requiredFeatures,'pointer-interactions','motion-layers'])];
  return scene;
}

function createSky(){
  const aperture='M335 90L402 127L402 220L335 183Z';
  const masked=(id,d,fill,joint='root')=>({id,joint,d,fill,spatial:{mask:'window-sky'}});
  const cloud=x=>`M${x-22} 144Q${x-19} 137 ${x-12} 138Q${x-7} 124 ${x+3} 133Q${x+13} 132 ${x+18} 144Z`;
  const clouds=cloud(292)+cloud(377)+cloud(462);
  const sun=masked('window-sun','M395 135C395 150 375 150 375 135C375 120 395 120 395 135Z','#fff4ba');
  sun.spatial.morph={channel:'night.bend',target:slide(sun.d,100),frames:[{value:.48,target:slide(sun.d,100)}]};
  const crescent='M390 124C376 120 368 140 382 148Q390 151 395 144C382 148 377 131 390 124Z';
  const moon=masked('window-moon',slide(crescent,100),'#fff8d9');
  moon.spatial.morph={channel:'night.bend',target:crescent,frames:[{value:.52,target:moon.d}]};
  return {name:'View through the window',spatial:true,
    joints:[root,...['clouds','night','stars'].map(id=>({...root,id,parent:'root'}))],
    inputs:{night:{type:'number',default:0,min:0,max:1}},parts:[
      {id:'window-sky',joint:'root',d:aperture,fill:'#aedbf4',gradient:{type:'linear',x1:0,y1:0,x2:0,y2:1,stops:[[0,'#8cbfe6'],[1,'#e6f3f5']]}},
      {...masked('window-night-sky',aperture,'#1e254a'),opacityChannel:'night.opacity',gradient:{type:'linear',x1:0,y1:0,x2:0,y2:1,stops:[[0,'#171c3d'],[1,'#555383']]}},
      sun,moon,
      {...masked('window-stars','M348 105L349 108L352 109L349 110L348 113L347 110L344 109L347 108ZM368 120L369 122L371 123L369 124L368 126L367 124L365 123L367 122ZM397 158L398 160L400 161L398 162L397 164L396 162L394 161L396 160Z','#f7f1cf'),opacityChannel:'stars.opacity'},
      masked('window-horizon','M315 171L420 171L420 240L315 240Z','#bbdce3'),
      masked('window-distant-water','M315 177L420 177L420 181L315 181Z','#d3e8eb'),
      {...masked('window-night-horizon','M315 171L420 171L420 240L315 240Z','#353858'),opacityChannel:'night.opacity'},
      {...masked('window-night-water','M315 177L420 177L420 181L315 181Z','#545774'),opacityChannel:'night.opacity'},
      masked('window-cloud',clouds,'#e6f2f8','clouds'),
      {...masked('window-night-cloud',clouds,'#717caa','clouds'),opacityChannel:'night.opacity'},
    ],clips:{drift:{duration:80,loop:true,tracks:{'clouds.x':[[0,0,'linear'],[80,85,'linear']],
      'night.bend':[[0,0]],'night.opacity':[[0,0]],'stars.opacity':[[0,0]]}}},
    states:{drift:{clip:'drift',transitions:[]}},initial:'drift'};
}

export function addWwwzardWindow(scene){
  const room=scene.packs.room;
  if(scene.packs.sky||!room)return scene;
  const outside=new Set(['window-glass','window-cloud','window-distant-cloud','window-moon']);
  room.parts=room.parts.filter(part=>!outside.has(part.id));
  // Hollow reveal: the separate sky remains visible through the opening, while
  // the frame and mullions occlude it naturally in front.
  room.parts.find(part=>part.id==='window-inner').d='M324 78L408 125L408 236L324 188ZM335 90L335 183L402 220L402 127Z';
  room.parts.find(part=>part.id==='window-frame').d+='M335 90L335 183L402 220L402 127Z';
  room.joints.push({...root,id:'windowView',parent:'root'});
  for(const part of room.parts.filter(part=>part.id.startsWith('window-'))){
    part.transform='translate(90 -20) scale(.84)';part.joint='windowView';
  }
  // The base rig keeps only the daytime view and needs no optional input-layer
  // provider. Home and Contact explicitly opt into the theme authoring below.
  const sky=createSky();
  sky.parts=sky.parts.filter(part=>!part.opacityChannel&&part.id!=='window-moon');
  delete sky.parts.find(part=>part.id==='window-sun').spatial.morph;
  sky.joints=sky.joints.filter(joint=>!['night','stars'].includes(joint.id));
  sky.inputs={};
  for(const channel of ['night.bend','night.opacity','stars.opacity'])delete sky.clips.drift.tracks[channel];
  scene.packs.sky=sky;
  const roomActor=scene.actors.find(actor=>actor.id==='room');
  scene.actors.splice(scene.actors.indexOf(roomActor),0,{id:'sky',name:'Distant sky',pack:'sky',
    layer:'background',unlit:true,transform:{...windowPlacement}});
  return scene;
}

export function addWwwzardWindowTheme(scene){
  if(!scene.packs.sky||scene.packs.sky.inputs.night)return scene;
  scene.packs.sky=createSky();
  scene.motionLayers??=[];
  for(const [joint,channel,range] of [['night','bend',[-1,1]],['night','opacity',[-1,1]],['stars','opacity',[0,1]]])
    scene.motionLayers.push({id:`sky-${joint}-${channel}`,actor:'sky',joint,channel,type:'input',
      amplitude:1,frequency:1,phase:0,seed:0,input:'night',range});
  return addWwwzardWindowInteraction(scene);
}
