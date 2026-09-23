export {AUTHENTIC_CAST as authenticCast, getAuthenticCast} from '../src/map-cast.js';
import {AUTHENTIC_CAST, getAuthenticCast} from '../src/map-cast.js';

export function applyAuthenticCast(map){
  for(const actor of map.actors){
    const authentic = getAuthenticCast(actor.id, actor);
    if(authentic){
      actor.appearance = actor.appearance || {};
      actor.appearance.authentic = true;
      actor.appearance.authenticId = authentic.id;
      // Pip is baked to genuine 1.20m child scale; remove runtime .66 downscaling
      if(actor.id === 'npc-child-1') actor.appearance.scale = 1;
    }
  }
  return map;
}

/** Actor definitions, appearances and routine home areas survive map export. */
export function addVillageCast(map, {authentic=false}={}){
 const cx=Math.floor(map.width/2),cy=Math.floor(map.height/2),clips=map.art.actors.hero;
 const home={x:cx-35,y:cy-22,width:58,height:46};
 const adults=[
  ['npc-farmer','Mara','farmer','#a7823b','straw','#bd8b62',1],
  ['npc-trader','Tomas','carrier','#466c99','cap','#be966b',1.05],
  ['npc-villager','Elin','villager','#96557b','hood','#d5a47f',.94],
  ['npc-herder','Ivo','herder','#994f3f','cap','#855a40',1.02],
  ['npc-gardener','Nell','farmer','#55794b','straw','#d3a57f',.92],
  ['npc-miller','Bram','carrier','#947d64','none','#a67953',1.08]
 ];
 const extraPositions={'npc-herder':{x:cx+4.5,y:cy+12},'npc-gardener':{x:cx-16.5,y:cy+.5},'npc-miller':{x:cx-12.5,y:cy-.5}};
 for(const [id,name,role,palette,hat,skin,scale]of adults){
  let actor=map.actors.find(a=>a.id===id);
  if(!actor){actor={id,name,...extraPositions[id],speed:2.3,stride:2.4};map.actors.push(actor);}
  Object.assign(actor,{name,npc:{species:'human',role,home:{...home}},appearance:{kind:'villager',palette,hat,skin,scale}});
  map.art.actors[id]=clips;
 }
 for(const [id,name,x,y,palette,hat]of [
  ['npc-child-1','Pip',cx+.5,cy+2.5,'#c37238','cap'],
  ['npc-child-2','Wren',cx+2.5,cy+2.5,'#5f91a4','none']
 ]){
  map.actors.push({id,name,x,y,speed:3.1,stride:1.6,npc:{species:'child',home:{x:cx-1,y:cy,width:5,height:4}},appearance:{kind:'villager',palette,skin:'#ce9d75',hat,scale:.66}});map.art.actors[id]=clips;
 }
 const regions={sheep:{x:cx-2.5,y:cy+14,width:14,height:8.5},cow:{x:cx+12.5,y:cy+14,width:10,height:8.5},chicken:{x:cx+16,y:cy-15,width:7,height:7}};
 const animalProps=map.props.filter(p=>['farm-sheep','farm-cow','farm-chicken'].includes(p.art));
 for(const prop of animalProps){
  const species=prop.art.slice(5);
  map.actors.push({id:prop.id,name:prop.id.replace('-', ' '),x:prop.x+prop.width/2,y:prop.y+prop.height/2,speed:species==='chicken'?2.2:species==='cow'?1.35:1.75,stride:species==='chicken'?.9:1.7,npc:{species,home:regions[species]},appearance:{kind:'livestock',image:prop.art,scale:1}});
 }
 const animalIds=new Set(animalProps.map(p=>p.id));map.props=map.props.filter(p=>!animalIds.has(p.id));
 if(authentic) applyAuthenticCast(map);
 return map;
}

