import {generateMap} from '../src/map.js';
import {vaultSupportAnchors} from './adventurer-crossing-anchors.js';

// URLs are relative to the host page. Copy assets/map with exported map JSON.
const adventurerFrames={idle:1,walk:12,run:12,jump:8,roll:16,vault:14,climbUp:12,climbDown:12};
const adventurerSource=name=>name==='climbDown'?'climbUp':name;
const adventurerClip=name=>{const compact=['vault','climbUp','climbDown'].includes(name),clip={image:'adventurer-'+adventurerSource(name),frames:adventurerFrames[name],directions:16,frameWidth:compact?96:128,frameHeight:compact?132:176};return name==='vault'?{...clip,supportAnchors:vaultSupportAnchors,supportWindow:[.2,.62]}:clip;};
const adventurerImage=name=>({src:`./assets/map/characters/adventurer-${adventurerSource(name)}.webp`,width:60,height:82.5,anchorX:.5,anchorY:.7997777105572947});

export const woodlandArt={
 actors:{hero:Object.fromEntries(Object.keys(adventurerFrames).map(name=>[name,adventurerClip(name)]))},
 images:{
  ...Object.fromEntries(Object.keys(adventurerFrames).filter(name=>name!=='climbDown').map(name=>['adventurer-'+name,adventurerImage(name)])) ,
  meadow:{src:'./assets/map/terrain/meadow-v2.webp',width:512,height:512,anchorX:0,anchorY:0},
  road:{src:'./assets/map/terrain/road-v2.webp',width:384,height:384,anchorX:0,anchorY:0},
  water:{src:'./assets/map/terrain/water.webp',width:128,height:128,anchorX:0,anchorY:0},
  sand:{src:'./assets/map/terrain/sand.webp',width:128,height:128,anchorX:0,anchorY:0},
  oak:{src:'./assets/map/trees/oak.webp',width:220,height:201.058,anchorX:.52,anchorY:.9},
  fir:{src:'./assets/map/trees/fir.webp',width:170,height:255,anchorX:.505,anchorY:.915},
  birch:{src:'./assets/map/trees/birch.webp',width:175,height:210,anchorX:.455,anchorY:.92},
  boulder:{src:'./assets/map/rocks/mossy-boulder.webp',width:46,height:30.67,anchorX:.5,anchorY:.75},
  cluster:{src:'./assets/map/rocks/granite-cluster.webp',width:53,height:35.33,anchorX:.51,anchorY:.75},
  inn:{src:'./assets/map/buildings/woodland-inn.webp',width:248.4,height:204.228,anchorX:.534,anchorY:.753},
  chest:{src:'./assets/map/town/chest.webp',width:52,height:69.333,anchorX:.53,anchorY:.83,opened:'chest-open'},
  'chest-open':{src:'./assets/map/town/chest-open.webp',width:52,height:69.333,anchorX:.53,anchorY:.83}
 },
 props:{tree:['oak','fir','birch'],rock:['boulder','cluster'],house:['inn'],chest:['chest']},
 terrain:{grass:'meadow',road:'road',water:'water',sand:'sand'}
};

export function withWoodlandArt(map){return upgradeWoodlandArt({...map,art:map.art??structuredClone(woodlandArt)});}
/** Add newly shipped stock clips to older saved woodland drafts without touching custom art. */
export function upgradeWoodlandArt(map){
 const clips=map?.art?.actors?.hero,images=map?.art?.images;
 const stock=['idle','walk','run'].every(name=>clips?.[name]?.image===`adventurer-${name}`&&images?.[`adventurer-${name}`]?.src===`./assets/map/characters/adventurer-${name}.webp`);
 if(!stock)return map;
 const needsChest=!map.art.props?.chest&&map.props.some(prop=>prop.kind==='chest'&&!prop.art);
 if(!needsChest&&Object.keys(adventurerFrames).every(name=>clips[name]&&images[clips[name].image]))return map;
 const art=structuredClone(map.art),hero=art.actors.hero;
 for(const name of Object.keys(adventurerFrames)){hero[name]??=adventurerClip(name);const image=hero[name].image;art.images[image]??=adventurerImage(name);}
 if(needsChest){art.images.chest??=structuredClone(woodlandArt.images.chest);art.images['chest-open']??=structuredClone(woodlandArt.images['chest-open']);art.props??={};art.props.chest=['chest'];}
 return{...map,art};
}
export function createWoodlandMap(options){const map=generateMap({elevation:true,...options});map.tileSize={width:36,height:18};map.navigation={mode:'continuous',radius:.12};
 const trees=new Set(map.props.filter(p=>p.kind==='tree').map(p=>p.x+','+p.y));
 for(const p of map.props){
  if(p.kind==='tree'){const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,y])=>trees.has((p.x+x)+','+(p.y+y))).length;if(neighbors<3)p.collision={shape:'circle',radius:.34};}
  if(p.kind==='rock'){p.collision={shape:'circle',radius:.25};p.traversal={kind:'vault',height:.5};}
 }
 map.actors[0].stride=2.4;return withWoodlandArt(map);}
