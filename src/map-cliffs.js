const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cache=new WeakMap();

function data(map){
 const terraces=map.terraces||[];
 let value=cache.get(map);
 if(value?.terraces===terraces&&value.width===map.width&&value.height===map.height)return value;
 const offsets=new Uint8Array(map.width*map.height);
 for(const terrace of map.terraces||[])for(let y=terrace.y;y<terrace.y+terrace.height;y++)for(let x=terrace.x;x<terrace.x+terrace.width;x++){
  const i=y*map.width+x;offsets[i]=Math.max(offsets[i],terrace.heightOffset);
 }
 const edges=[],at=(x,y)=>x<0||y<0||x>=map.width||y>=map.height?0:offsets[y*map.width+x],definitions=[['north',0,-1,0,0,1,0],['east',1,0,1,0,1,1],['south',0,1,1,1,0,1],['west',-1,0,0,1,0,0]];
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)for(const [edge,dx,dy,ax,ay,bx,by]of definitions){const high=at(x,y),low=at(x+dx,y+dy);if(high>low)edges.push({x,y,edge,high,low,a:{x:x+ax,y:y+ay},b:{x:x+bx,y:y+by}});}
 value={terraces,width:map.width,height:map.height,offsets,edges,levels:[...new Set(offsets)].sort((a,b)=>a-b)};cache.set(map,value);return value;
}

export function terrainHeightOffset(map,point){
 if(!map.terraces?.length)return 0;
 const x=clamp(Math.floor(point.x),0,map.width-1),y=clamp(Math.floor(point.y),0,map.height-1);
 return data(map).offsets[y*map.width+x];
}

export function terraceLevels(map){return data(map).levels;}

function smoothHeight(map,point){
 if(!map.elevations)return 0;
 const px=clamp(point.x,0,map.width),py=clamp(point.y,0,map.height),x=Math.min(map.width-1,Math.floor(px)),y=Math.min(map.height-1,Math.floor(py));
 const fx=px-x,fy=py-y,stride=map.width+1,i=y*stride+x,h=map.elevations;
 return fx>=fy?h[i]+(h[i+1]-h[i])*fx+(h[i+stride+1]-h[i+1])*fy:h[i]+(h[i+stride+1]-h[i+stride])*fx+(h[i+stride]-h[i])*fy;
}

export function terrainTileCorners(map,x,y){
 const z=terrainHeightOffset(map,{x:x+.5,y:y+.5});
 return [
  {x,y,z:smoothHeight(map,{x,y})+z},{x:x+1,y,z:smoothHeight(map,{x:x+1,y})+z},
  {x:x+1,y:y+1,z:smoothHeight(map,{x:x+1,y:y+1})+z},{x,y:y+1,z:smoothHeight(map,{x,y:y+1})+z},
 ];
}

/** One vertical face per high-side cell edge. Bounds use cell coordinates and are optional. */
export function cliffFaces(map,bounds={x:0,y:0,width:map.width,height:map.height}){
 const result=[],minX=clamp(Math.floor(bounds.x),0,map.width),minY=clamp(Math.floor(bounds.y),0,map.height),maxX=clamp(Math.ceil(bounds.x+bounds.width),0,map.width),maxY=clamp(Math.ceil(bounds.y+bounds.height),0,map.height);
 for(const {x,y,edge,high,low,a,b}of data(map).edges){if(x<minX||y<minY||x>=maxX||y>=maxY)continue;
  result.push({x,y,edge,heightOffset:high,neighborHeightOffset:low,top:[{...a,z:smoothHeight(map,a)+high},{...b,z:smoothHeight(map,b)+high}],bottom:[{...a,z:smoothHeight(map,a)+low},{...b,z:smoothHeight(map,b)+low}]});}
 return result;
}

const project=(map,p)=>({x:(p.x-p.y)*map.tileSize.width/2,y:(p.x+p.y)*map.tileSize.height/2-p.z*map.tileSize.height});
const insideQuad=(p,vertices)=>{let sign=0;for(let i=0;i<4;i++){const a=vertices[i],b=vertices[(i+1)%4],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(cross)<1e-7)continue;const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;}return true;};

/** Returns the adjacent lower ground point when a projected pixel hits a cliff wall. */
export function cliffGroundPick(map,p){
 if(!map.terraces?.length)return null;
 let best=null;
 for(const face of cliffFaces(map)){if(face.edge!=='east'&&face.edge!=='south')continue;const projected=[project(map,face.top[0]),project(map,face.top[1]),project(map,face.bottom[1]),project(map,face.bottom[0])];if(!insideQuad(p,projected))continue;
  const a=projected[3],b=projected[2],t=Math.abs(b.x-a.x)>1e-8?clamp((p.x-a.x)/(b.x-a.x),0,1):.5,wa=face.bottom[0],wb=face.bottom[1],depth=wa.x+wa.y+(wb.x+wb.y-wa.x-wa.y)*t;
  if(best&&best.depth>=depth)continue;
  const direction=face.edge==='east'?[1,0]:[0,1],clearance=(map.navigation?.radius??0)+.02,point={x:wa.x+(wb.x-wa.x)*t+direction[0]*clearance,y:wa.y+(wb.y-wa.y)*t+direction[1]*clearance};
  Object.defineProperty(point,'depth',{value:depth,enumerable:false});best=point;
 }
 return best;
}

/** Cliff edges behave as walls, including an actor radius overhanging an edge. */
export function segmentCrossesCliff(map,a,b,radius=0){
 if(!map.terraces?.length)return false;
 const times=[0,1],dx=b.x-a.x,dy=b.y-a.y;
 if(Math.abs(dx)>1e-12)for(let x=Math.floor(Math.min(a.x,b.x))+1;x<=Math.floor(Math.max(a.x,b.x));x++){const t=(x-a.x)/dx;if(t>0&&t<1)times.push(t);}
 if(Math.abs(dy)>1e-12)for(let y=Math.floor(Math.min(a.y,b.y))+1;y<=Math.floor(Math.max(a.y,b.y));y++){const t=(y-a.y)/dy;if(t>0&&t<1)times.push(t);}
 times.sort((p,q)=>p-q);const boundaryCount=times.length;for(let i=0;i+1<boundaryCount;i++)times.push((times[i]+times[i+1])/2);
 const probes=radius>0?[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[radius*.707,radius*.707],[-radius*.707,radius*.707],[radius*.707,-radius*.707],[-radius*.707,-radius*.707]]:[[0,0]];
 let expected;
 for(const t of times)for(const [ox,oy]of probes){const level=terrainHeightOffset(map,{x:a.x+dx*t+ox,y:a.y+dy*t+oy});if(expected===undefined)expected=level;else if(level!==expected)return true;}
 return false;
}
