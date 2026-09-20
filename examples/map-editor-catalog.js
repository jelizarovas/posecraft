import {propHitsSegment} from '../src/map-collision.js';
import {townImages,townPropBrushes} from './town-map.js';
// Art is independent of the ground-space collision geometry below.
export const editorImages={
 ...townImages,
 'editor-dry-grass':{src:'./assets/map/editor/dry-grass.webp',width:384,height:384,anchorX:0,anchorY:0},
 'editor-moss-grass':{src:'./assets/map/editor/moss-grass.webp',width:384,height:384,anchorX:0,anchorY:0},
 'editor-bush':{src:'./assets/map/editor/bush.webp',width:90,height:60,anchorX:.5,anchorY:.84},
 'editor-tombstone':{src:'./assets/map/editor/tombstone.webp',width:48,height:46.197,anchorX:.5,anchorY:.86},
 'editor-branches':{src:'./assets/map/editor/branches.webp',width:74,height:49.333,anchorX:.5,anchorY:.6},
 'editor-fence':{src:'./assets/map/editor/fence.webp',width:140,height:93.333,anchorX:.5,anchorY:.65},
 'editor-ridge':{src:'./assets/map/editor/ridge.webp',width:120,height:80,anchorX:.5,anchorY:.7},
 'editor-shipwreck':{src:'./assets/map/editor/shipwreck.webp',width:240,height:160,anchorX:.5,anchorY:.67}
};
export const terrainBrushes=[
 {id:'grass',label:'Meadow',terrain:0,image:'meadow'},
 {id:'dry-grass',label:'Dry grass',terrain:0,image:'editor-dry-grass'},
 {id:'moss-grass',label:'Moss grass',terrain:0,image:'editor-moss-grass'},
 {id:'sand',label:'Sand',terrain:3,image:'sand'},
 {id:'road',label:'Road',terrain:1,image:'road'},
 {id:'water',label:'Water',terrain:2,image:'water'}
];
export const propBrushes=[
 ...townPropBrushes,
 {id:'branches',label:'Branches',prop:{kind:'decoration',art:'editor-branches',width:1,height:1,collision:{shape:'rect',x:.08,y:.4,width:.84,height:.18},traversal:{activation:'auto',kind:'vault',height:.28,style:'branch'}}},
 {id:'fence',label:'Low fence',prop:{kind:'decoration',art:'editor-fence',width:3,height:1,collision:{shape:'rect',x:0,y:.42,width:3,height:.16},traversal:{activation:'click',kind:'vault',height:.55,endpoints:[{x:1.5,y:-.45},{x:1.5,y:1.45}]}}},
 {id:'ridge',label:'Rocky ridge',prop:{kind:'decoration',art:'editor-ridge',width:3,height:3,collision:{shape:'rect',x:0,y:.96,width:3,height:.22},traversal:{activation:'click',kind:'climb',height:.4,endpoints:[{x:1.5,y:2.85},{x:1.5,y:.15}]}}},
 {id:'bush',label:'Bush',prop:{kind:'decoration',art:'editor-bush',width:1,height:1,collision:{shape:'circle',x:.5,y:.5,radius:.32}}},
 {id:'tombstone',label:'Tombstone',prop:{kind:'decoration',art:'editor-tombstone',width:1,height:1,collision:{shape:'rect',x:.18,y:.26,width:.64,height:.48}}},
 {id:'shipwreck',label:'Split wreckage',prop:{kind:'decoration',art:'editor-shipwreck',width:6,height:2,collision:{shape:'compound',parts:[
  {shape:'rect',x:.15,y:.12,width:2.1,height:1.76},
  {shape:'rect',x:3.65,y:.12,width:2.2,height:1.76}
 ]}}},
 {id:'oak',label:'Oak tree',prop:{kind:'tree',art:'oak',width:1,height:1,collision:{shape:'circle',radius:.34}}},
 {id:'fir',label:'Fir tree',prop:{kind:'tree',art:'fir',width:1,height:1,collision:{shape:'circle',radius:.34}}},
 {id:'rock',label:'Boulder',prop:{kind:'rock',art:'boulder',width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{kind:'vault',height:.5}}}
];

/** Upgrade only the bundled branch art, leaving authored props and collisions intact. */
export function upgradeStockBranches(map){
 const image=map?.art?.images?.['editor-branches'];
 if(image?.src!=='./assets/map/editor/branches.webp')return map;
 let changed=false;
 const props=map.props.map(prop=>{
  if(prop.kind!=='decoration'||prop.art!=='editor-branches'||prop.width!==1||prop.height!==1||prop.collision?.shape!=='none'||prop.traversal)return prop;
  const upgraded={...prop,collision:{shape:'rect',x:.08,y:.4,width:.84,height:.18},traversal:{activation:'auto',kind:'vault',height:.28,style:'branch'}};
  // A saved character may be standing on formerly walkable artwork. Preserve
  // that draft instead of introducing a collider through its spawn position.
  if(map.actors.some(actor=>propHitsSegment(upgraded,actor,actor,map.navigation?.radius??0)))return prop;
  changed=true;return upgraded;
 });
 return changed?{...map,props}:map;
}

/** Give a new three-cell ridge a climbable 0.4-tile rise without breaking an existing elevation field. */
export function shapeRidgeTerrain(map,prop){
 if(!map?.elevations||prop.width!==3||prop.height!==3)return false;
 const stride=map.width+1,original=map.elevations,next=original.slice();
 const actorOnRidge=(map.actors||[]).some(actor=>actor.x>=prop.x&&actor.x<=prop.x+prop.width&&actor.y>=prop.y&&actor.y<=prop.y+prop.height);
 if(actorOnRidge)return false;
 for(let y=0;y<=3;y++)for(let x=0;x<=3;x++){
  const index=(prop.y+y)*stride+prop.x+x;
  if(index<0||index>=next.length)return false;
  next[index]=y===0?.4:y===1?.2:0;
 }
 for(let y=0;y<=map.height;y++)for(let x=0;x<=map.width;x++){
  const value=next[y*stride+x];
  if(!Number.isFinite(value)||value<-16||value>16)return false;
  if(x&&Math.abs(value-next[y*stride+x-1])>.400000001)return false;
  if(y&&Math.abs(value-next[(y-1)*stride+x])>.400000001)return false;
 }
 map.elevations=next;
 return true;
}

function overlaps(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function clearFootprint(map,footprint){
 if(footprint.x<0||footprint.y<0||footprint.x+footprint.width>map.width||footprint.y+footprint.height>map.height)return false;
 if(map.props.some(prop=>overlaps(prop,footprint)))return false;
 if(map.actors.some(actor=>actor.x>=footprint.x-1&&actor.x<=footprint.x+footprint.width+1&&actor.y>=footprint.y-1&&actor.y<=footprint.y+footprint.height+1))return false;
 for(let y=footprint.y;y<footprint.y+footprint.height;y++)for(let x=footprint.x;x<footprint.x+footprint.width;x++)if(map.terrain[y*map.width+x]===2)return false;
 return true;
}

/** Add a nearby fence and ridge to a generated stock map. Call this only for the bundled play map, never a saved draft. */
export function withTraversalShowcase(source){
 const map=structuredClone(source),hero=map.actors[0];
 if(!hero)return map;
 map.art??={images:{}};map.art.images={...editorImages,...map.art.images};
 const origin={x:Math.floor(hero.x),y:Math.floor(hero.y)};
 const candidates=[];
 for(let radius=3;radius<=12;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===radius)candidates.push({x:origin.x+dx,y:origin.y+dy});
 let ridge=null;
 for(const point of candidates){
  const footprint={x:point.x,y:point.y,width:3,height:3};
  if(!clearFootprint(map,footprint))continue;
  const prior=map.elevations?.slice(),prop={id:'showcase-ridge',kind:'decoration',art:'editor-ridge',...footprint,collision:{shape:'rect',x:0,y:.96,width:3,height:.22},traversal:{activation:'click',kind:'climb',height:.4,endpoints:[{x:1.5,y:2.85},{x:1.5,y:.15}]}};
  if(!map.elevations)map.elevations=Array((map.width+1)*(map.height+1)).fill(0);
  if(shapeRidgeTerrain(map,prop)){map.props.push(prop);ridge=prop;break;}
  map.elevations=prior;
 }
 if(!ridge)return source;
 for(const point of candidates){
  const footprint={x:point.x,y:point.y,width:1,height:1};
  if(!clearFootprint(map,footprint))continue;
  map.props.push({id:'showcase-branch',kind:'decoration',art:'editor-branches',...footprint,collision:{shape:'rect',x:.08,y:.4,width:.84,height:.18},traversal:{activation:'auto',kind:'vault',height:.28,style:'branch'}});
  break;
 }
 for(const point of candidates){
  const footprint={x:point.x,y:point.y,width:3,height:1};
  if(!clearFootprint(map,footprint))continue;
  map.props.push({id:'showcase-fence',kind:'decoration',art:'editor-fence',...footprint,collision:{shape:'rect',x:0,y:.42,width:3,height:.16},traversal:{activation:'click',kind:'vault',height:.55,endpoints:[{x:1.5,y:-.45},{x:1.5,y:1.45}]}});
  return map;
 }
 return source;
}
