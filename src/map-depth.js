import {projectMap} from './map.js';
import {artPropSelection, mapImageBounds, groundHeight} from './map-art-layout.js';
import {propCollisionParts} from './map-collision.js';
import {isMapFence,mapFenceBounds} from './map-fence.js';
import {terrainHeightOffset,terrainTileCorners} from './map-cliffs.js';

/** A point beyond either camera-facing edge is in front of the solid footprint. */
export function mapPropOccludesActor(prop,actor,map){
  if(prop.cliffTop){
    const actorZ=(actor.z??(map?groundHeight(map,actor):0))+(actor.lift??0),delta=prop.cliffHeight-actorZ;
    if(delta<=.05)return false;
    const rayX=actor.x+delta,rayY=actor.y+delta;
    return rayX>=prop.x&&rayX<=prop.x+1&&rayY>=prop.y&&rayY<=prop.y+1;
  }
  if(prop.cliffFace){
    const face=prop.cliffFace,[a,b]=face.top;
    if((actor.z??(map?groundHeight(map,actor):0))>=Math.min(a.z,b.z)-.05)return false;
    const distance=face.edge==='south'?a.y-actor.y:a.x-actor.x;
    if(distance<=0)return false;
    const along=face.edge==='south'?actor.x+distance:actor.y+distance;
    const lo=face.edge==='south'?Math.min(a.x,b.x):Math.min(a.y,b.y),hi=face.edge==='south'?Math.max(a.x,b.x):Math.max(a.y,b.y);
    return along>=lo&&along<=hi;
  }
  if(actor.lift>0&&actor.vaultId===prop.id)return false;
  if(prop.occlusion?.mode==='ground')return false;
  // Crops and other low foliage are walk-through cover. Their artwork only
  // belongs in front while the actor stands in the planted footprint; using
  // the usual center-depth rule makes the same plants flicker behind a walker.
  if(prop.occlusion?.mode==='low-foliage')return actor.x>=prop.x&&actor.x<=prop.x+prop.width&&actor.y>=prop.y&&actor.y<=prop.y+prop.height;
  const parts=propCollisionParts(prop);
  // Walkable artwork still has visual depth (crops, for example). Small round
  // props keep center depth so a tree's canopy can cover more than its trunk.
  if(!parts.length)return actor.x+actor.y<prop.x+prop.width/2+prop.y+prop.height/2;
  return parts.some(part=>{
    if(part.shape==='circle')return actor.x+actor.y<part.x+part.y;
    // Cast toward the isometric camera in ground space. A distant piece of a
    // compound prop must not mask the actor through a gap or past its near edge.
    const enter=Math.max(0,part.x-actor.x,part.y-actor.y);
    const exit=Math.min(part.x+part.width-actor.x,part.y+part.height-actor.y);
    return exit>1e-7&&enter<=exit+1e-7;
  });
}

export function mapPropArtBounds(map,prop){
  if(prop.cliffBounds)return prop.cliffBounds;
  if(isMapFence(prop))return mapFenceBounds(map,prop);
  const fallback=mapPropFallbackBounds(map,prop),selected=artPropSelection(map,prop);if(!selected)return fallback;
  const image=mapImageBounds(map,{x:prop.x+prop.width/2,y:prop.y+prop.height/2},selected.image),x=Math.min(fallback.x,image.x),y=Math.min(fallback.y,image.y);
  return{x,y,width:Math.max(fallback.x+fallback.width,image.x+image.width)-x,height:Math.max(fallback.y+fallback.height,image.y+image.height)-y};
}
function mapPropFallbackBounds(map,prop){
  const s=map.tileSize.width/64,p=projectMap(map,{x:prop.x+prop.width/2,y:prop.y+prop.height/2});
  if(prop.kind==='house'){
    const halfWidth=(prop.width+prop.height)*map.tileSize.width/4,halfHeight=(prop.width+prop.height)*map.tileSize.height/4;
    return{x:p.x-halfWidth-8*s,y:p.y-halfHeight-57*s,width:2*halfWidth+16*s,height:2*halfHeight+61*s};
  }
  const extents=prop.kind==='tree'?[-28,-72,56,76]:prop.kind==='rock'?[-22,-24,44,30]:[-16,-37,32,46];
  return{x:p.x+extents[0]*s,y:p.y+extents[1]*s,width:extents[2]*s,height:extents[3]*s};
}

export function mapActorArtBounds(map,actor){
 const s=map.tileSize.width/64,p=projectMap(map,actor),bounds={x:p.x-32*s,y:p.y-74*s-(actor.lift||0)*map.tileSize.height,width:64*s,height:94*s+(actor.lift||0)*map.tileSize.height};
 if(actor.supportContact){
  // The hand-anchored image can extend away from the logical actor origin.
  // Include both ends of that adjustment in culling and occlusion buffers.
  const contact=projectMap(map,actor.supportContact),clip=map.art?.actors?.[actor.id]?.vault,spec=clip&&map.art.images[clip.image],w=(spec?.width??64)*s,h=(spec?.height??90)*s;
  const x=Math.min(bounds.x,contact.x-w),y=Math.min(bounds.y,contact.y-h),right=Math.max(bounds.x+bounds.width,contact.x+w),bottom=Math.max(bounds.y+bounds.height,contact.y+h);
  return{x,y,width:right-x,height:bottom-y};
 }
 return bounds;
}
export function rectanglesOverlap(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}

const cliffTopCache=new WeakMap();
export function createCliffTopProps(map){
 const cached=cliffTopCache.get(map);if(cached?.terraces===map.terraces&&cached?.elevations===map.elevations&&cached?.tileSize===map.tileSize)return cached.props;
 const result=[],seen=new Set();
 for(const terrace of map.terraces||[])for(let y=terrace.y;y<terrace.y+terrace.height;y++)for(let x=terrace.x;x<terrace.x+terrace.width;x++){
  const id=y*map.width+x;if(seen.has(id)||terrainHeightOffset(map,{x:x+.5,y:y+.5})<=0)continue;seen.add(id);
  const corners=terrainTileCorners(map,x,y),points=corners.map(point=>projectMap(map,point)),left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y)),cliffBounds={x:left,y:top,width:right-left,height:bottom-top};
  result.push({id:`@cliff-top-${x}-${y}`,kind:'decoration',x,y,width:1,height:1,cliffTop:true,cliffPoints:points,cliffBounds,cliffHeight:groundHeight(map,{x:x+.5,y:y+.5})});
 }
 cliffTopCache.set(map,{terraces:map.terraces,elevations:map.elevations,tileSize:map.tileSize,props:result});return result;
}

/** Index only props already selected for this viewport; clip buckets to the viewport. */
export class MapOcclusionIndex{
  constructor(map,props,viewport){this.map=map;
    this.buckets=new Map();this.entries=new Map();this.size=128;this.viewport=viewport;
    for(const prop of [...props,...createCliffTopProps(map).filter(prop=>rectanglesOverlap(prop.cliffBounds,viewport))]){const bounds=mapPropArtBounds(map,prop);this.entries.set(prop.id,{prop,bounds});this.cells(bounds,(x,y)=>{const key=`${x},${y}`,bucket=this.buckets.get(key)||[];bucket.push(prop.id);this.buckets.set(key,bucket);});}
  }
  cells(bounds,visit){const v=this.viewport,left=Math.max(v.x,bounds.x),top=Math.max(v.y,bounds.y),right=Math.min(v.x+v.width,bounds.x+bounds.width),bottom=Math.min(v.y+v.height,bounds.y+bounds.height);if(right<=left||bottom<=top)return;for(let y=Math.floor(top/this.size);y<=Math.floor(bottom/this.size);y++)for(let x=Math.floor(left/this.size);x<=Math.floor(right/this.size);x++)visit(x,y);}
  foreground(actor,bounds){const ids=new Set();this.cells(bounds,(x,y)=>{for(const id of this.buckets.get(`${x},${y}`)||[])ids.add(id);});const props=[],silhouetteProps=[];for(const id of ids){const entry=this.entries.get(id);if(rectanglesOverlap(bounds,entry.bounds)&&mapPropOccludesActor(entry.prop,actor,this.map)){props.push(entry.prop);if(entry.prop.occlusion?.mode!=='low-foliage')silhouetteProps.push(entry.prop);}}return{props,silhouetteProps,candidates:ids.size};}
}
