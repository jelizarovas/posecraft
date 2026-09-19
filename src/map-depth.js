import {projectMap} from './map.js';

/** A point beyond either camera-facing edge is in front of the solid footprint. */
export function mapPropOccludesActor(prop,actor){
  if(actor.x>=prop.x+prop.width||actor.y>=prop.y+prop.height)return false;
  return actor.x<prop.x||actor.y<prop.y;
}

export function mapPropArtBounds(map,prop){
  const s=map.tileSize.width/64,p=projectMap(map,{x:prop.x+prop.width/2,y:prop.y+prop.height/2});
  if(prop.kind==='house'){
    const halfWidth=(prop.width+prop.height)*map.tileSize.width/4,halfHeight=(prop.width+prop.height)*map.tileSize.height/4;
    return{x:p.x-halfWidth-8*s,y:p.y-halfHeight-57*s,width:2*halfWidth+16*s,height:2*halfHeight+61*s};
  }
  const extents=prop.kind==='tree'?[-28,-72,56,76]:prop.kind==='rock'?[-22,-24,44,30]:[-16,-37,32,46];
  return{x:p.x+extents[0]*s,y:p.y+extents[1]*s,width:extents[2]*s,height:extents[3]*s};
}

export function mapActorArtBounds(map,actor){const s=map.tileSize.width/64,p=projectMap(map,actor);return{x:p.x-24*s,y:p.y-52*s,width:48*s,height:62*s};}
export function rectanglesOverlap(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}

/** Index only props already selected for this viewport; clip buckets to the viewport. */
export class MapOcclusionIndex{
  constructor(map,props,viewport){
    this.buckets=new Map();this.entries=new Map();this.size=128;this.viewport=viewport;
    for(const prop of props){const bounds=mapPropArtBounds(map,prop);this.entries.set(prop.id,{prop,bounds});this.cells(bounds,(x,y)=>{const key=`${x},${y}`,bucket=this.buckets.get(key)||[];bucket.push(prop.id);this.buckets.set(key,bucket);});}
  }
  cells(bounds,visit){const v=this.viewport,left=Math.max(v.x,bounds.x),top=Math.max(v.y,bounds.y),right=Math.min(v.x+v.width,bounds.x+bounds.width),bottom=Math.min(v.y+v.height,bounds.y+bounds.height);if(right<=left||bottom<=top)return;for(let y=Math.floor(top/this.size);y<=Math.floor(bottom/this.size);y++)for(let x=Math.floor(left/this.size);x<=Math.floor(right/this.size);x++)visit(x,y);}
  foreground(actor,bounds){const ids=new Set();this.cells(bounds,(x,y)=>{for(const id of this.buckets.get(`${x},${y}`)||[])ids.add(id);});const props=[];for(const id of ids){const entry=this.entries.get(id);if(rectanglesOverlap(bounds,entry.bounds)&&mapPropOccludesActor(entry.prop,actor))props.push(entry.prop);}return{props,candidates:ids.size};}
}
