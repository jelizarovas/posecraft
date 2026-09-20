import {fenceCollisionParts} from './map-fence.js';
import {segmentCrossesCliff} from './map-cliffs.js';

/** Continuous collision queries use authored ground shapes, never sprite extents. */
export function segmentHitsRect(a,b,left,top,right,bottom){
 let low=0,high=1;
 for(const [start,delta,min,max]of [[a.x,b.x-a.x,left,right],[a.y,b.y-a.y,top,bottom]]){
  if(Math.abs(delta)<1e-10){if(start<min||start>max)return false;}
  else{let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return false;}
 }return true;
}
export function segmentPointDistance(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}

export function propBlocksMovement(prop){return prop.fence?prop.collision?.shape!=='none':prop.collision?.shape!=='none'&&(prop.kind!=='decoration'||prop.collision!==undefined);}

/** Normalized world-space parts. An omitted collision keeps the legacy full-footprint rectangle. */
export function propCollisionParts(prop){
 if(prop.fence&&prop.collision===undefined)return fenceCollisionParts(prop);
 if(!propBlocksMovement(prop))return [];
 const collision=prop.collision;
 if(!collision)return[{shape:'rect',x:prop.x,y:prop.y,width:prop.width,height:prop.height}];
 const world=part=>part.shape==='circle'
  ?{shape:'circle',x:prop.x+(part.x??prop.width/2),y:prop.y+(part.y??prop.height/2),radius:part.radius}
  :{shape:'rect',x:prop.x+part.x,y:prop.y+part.y,width:part.width,height:part.height};
 if(collision.shape==='compound')return collision.parts.map(world);
 return[world(collision)];
}

export function propHitsSegment(prop,a,b,radius=0){
 for(const part of propCollisionParts(prop)){
  if(part.shape==='circle'){
   if(segmentPointDistance(a,b,part)<part.radius+radius)return true;
  }else if(segmentHitsRect(a,b,part.x-radius,part.y-radius,part.x+part.width+radius,part.y+part.height+radius))return true;
 }
 return false;
}

/** True when the center of a coarse pathfinding cell lies in an authored shape. */
export function propBlocksCell(prop,x,y){return propHitsSegment(prop,{x:x+.5,y:y+.5},{x:x+.5,y:y+.5});}
export function continuousSegmentClear(index,a,b,radius=.12,{allowVault=false,ignoreProp=null,ignoreCliffs=false}={}){
 const map=index.map;
 if([a,b].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<radius||p.y<radius||p.x>map.width-radius||p.y>map.height-radius))return false;
 if(!ignoreCliffs&&segmentCrossesCliff(map,a,b,radius))return false;
 // Linear traversal with neighboring cells, followed by exact segment tests.
 // A long diagonal never scans the area of its bounding rectangle.
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*2)),cells=new Set(),props=new Set();
 for(let i=0;i<=steps;i++){
  const x=Math.floor(a.x+(b.x-a.x)*i/steps),y=Math.floor(a.y+(b.y-a.y)*i/steps);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=x+dx,cy=y+dy;if(cx<0||cy<0||cx>=map.width||cy>=map.height)continue;
   const id=cy*map.width+cx;if(cells.has(id))continue;cells.add(id);
   if(map.terrain[id]===2&&segmentHitsRect(a,b,cx-radius,cy-radius,cx+1+radius,cy+1+radius))return false;
   for(const prop of index.propsAt(cx,cy)){
    if(props.has(prop.id))continue;props.add(prop.id);
    if(prop.id===ignoreProp||(allowVault&&prop.traversal?.kind==='vault'&&(prop.traversal.activation??'auto')==='auto'))continue;
    if(propHitsSegment(prop,a,b,radius))return false;
   }
  }
 }return true;
}
