import {artTerrainSelection} from './map-art-layout.js';

const resources=new Map();
const abortError=()=>Object.assign(new Error('Map art loading cancelled.'),{name:'AbortError'});
function acquire(url,doc){
  let resource=resources.get(url);
  if(!resource){
    const image=new doc.defaultView.Image();image.crossOrigin='anonymous';image.decoding='async';
    resource={image,references:0,loaded:false,settled:false,cancel:null};
    resource.promise=new Promise((resolve,reject)=>{
      const finish=error=>{if(resource.settled)return;resource.settled=true;image.onload=image.onerror=null;if(error)reject(error);else{resource.loaded=true;resolve(image);}};
      image.onload=()=>{if(image.naturalWidth&&image.naturalHeight)finish();else finish(Error(`Map image is empty: ${url}`));};
      image.onerror=()=>finish(Error(`Unable to load map image: ${url}`));
      resource.cancel=()=>{finish(abortError());image.removeAttribute('src');};image.src=url;
    });
    resource.promise.catch(()=>{});resources.set(url,resource);
  }
  resource.references++;
  return{resource,release(){if(--resource.references===0){if(!resource.settled)resource.cancel();resources.delete(url);}}};
}

/** One decoded image per URL shared by mounted maps; no art requests for unthemed maps. */
export function loadMapArt(map,{document,onUpdate=()=>{},onError=()=>{}}){
  let disposed=false,patterns=new WeakMap();const handles=new Map(),pending=[];
  const referenced=new Set([...Object.values(map.art?.props||{}).flat(),...Object.values(map.art?.terrain||{})]);
  for(const[id,definition]of Object.entries(map.art?.images||{})){
    if(!referenced.has(id))continue;
    const url=new URL(definition.src,document.baseURI).href,handle=acquire(url,document);handles.set(id,handle);
    pending.push(handle.resource.promise.then(()=>{if(!disposed)onUpdate();},error=>{if(!disposed&&error.name!=='AbortError'){onError(error);onUpdate();}}));
  }
  const ready=Promise.all(pending).then(()=>{if(disposed)throw abortError();});ready.catch(()=>{});
  return{
    ready,
    image(id){const resource=handles.get(id)?.resource;return !disposed&&resource?.loaded?resource.image:null;},
    pattern(ctx,id){const image=this.image(id);if(!image)return null;let cache=patterns.get(ctx);if(!cache){cache=new Map();patterns.set(ctx,cache);}if(!cache.has(id)){const pattern=ctx.createPattern(image,'repeat'),definition=map.art.images[id];if(!pattern)return null;pattern.setTransform({a:definition.width/(64*image.naturalWidth),d:definition.height/(64*image.naturalHeight),b:0,c:0,e:0,f:0});cache.set(id,pattern);}return cache.get(id);},
    stats(){let loaded=0,failed=0;for(const{resource}of handles.values()){if(resource.loaded)loaded++;else if(resource.settled)failed++;}return{requested:handles.size,loaded,failed};},
    dispose(){if(disposed)return;disposed=true;for(const handle of handles.values())handle.release();handles.clear();patterns=new WeakMap();}
  };
}

/** Texture coordinates live on the map ground plane, independent of camera and viewport. */
export function drawMapTerrainTexture(ctx,map,tile,art){
  const selected=artTerrainSelection(map,tile.terrain),pattern=selected&&art.pattern(ctx,selected.id);if(!pattern)return false;
  ctx.save();ctx.transform(map.tileSize.width/2,map.tileSize.height/2,-map.tileSize.width/2,map.tileSize.height/2,0,0);
  const select=value=>{const selection=artTerrainSelection(map,value);return selection&&art.pattern(ctx,selection.id);},grass=select(0);
  if(!grass){ctx.fillStyle=pattern;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);ctx.restore();return true;}
  ctx.fillStyle=grass;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);
  // Eight local samples support both rounded outer bends and concave corner infill.
  const terrain=(dx,dy)=>{const x=tile.x+dx,y=tile.y+dy;return x<0||y<0||x>=map.width||y>=map.height?-1:map.terrain[y*map.width+x];};
  const neighbors=[terrain(0,-1),terrain(1,0),terrain(0,1),terrain(-1,0)],diagonals=[terrain(-1,-1),terrain(1,-1),terrain(1,1),terrain(-1,1)];
  const layer=(texture,belongs,road=false)=>{
    if(!texture)return;const own=belongs(tile.terrain),edges=neighbors.map(belongs),corners=diagonals.map(belongs),radius=road ? .30 : .48;
    if(!own&&!edges.some((edge,i)=>edge&&edges[(i+1)%4]))return;
    ctx.save();ctx.translate(tile.x,tile.y);ctx.beginPath();
    if(own){
      const inset=road ? .045 : 0,left=edges[3]?-.06:inset,right=edges[1]?1.06:1-inset,top=edges[0]?-.06:inset,bottom=edges[2]?1.06:1-inset;
      const tl=!edges[0]&&!edges[3]?radius:0,tr=!edges[0]&&!edges[1]?radius:0,br=!edges[1]&&!edges[2]?radius:0,bl=!edges[2]&&!edges[3]?radius:0;
      const wobble=road?(((Math.imul(tile.x+31,73856093)^Math.imul(tile.y+17,19349663))>>>0)%101/100-.5)*.045:0;
      ctx.moveTo(left+tl,top);ctx.quadraticCurveTo((left+right)/2,top+(edges[0]?0:wobble),right-tr,top);ctx.quadraticCurveTo(right,top,right,top+tr);
      ctx.quadraticCurveTo(right-(edges[1]?0:wobble),(top+bottom)/2,right,bottom-br);ctx.quadraticCurveTo(right,bottom,right-br,bottom);
      ctx.quadraticCurveTo((left+right)/2,bottom-(edges[2]?0:wobble),left+bl,bottom);ctx.quadraticCurveTo(left,bottom,left,bottom-bl);
      ctx.quadraticCurveTo(left+(edges[3]?0:wobble),(top+bottom)/2,left,top+tl);ctx.quadraticCurveTo(left,top,left+tl,top);ctx.closePath();
    }else{
      // Each patch stays inside its tile. Shared-edge endpoints meet the neighboring mask.
      const patches=[[0,0,1,1,0,3],[1,0,-1,1,0,1],[1,1,-1,-1,1,2],[0,1,1,-1,2,3]];
      patches.forEach(([x,y,sx,sy,a,b],i)=>{if(!edges[a]||!edges[b]||!corners[i])return;ctx.moveTo(x,y);ctx.lineTo(x+sx*radius,y);ctx.quadraticCurveTo(x,y,x,y+sy*radius);ctx.closePath();});
    }
    ctx.clip();ctx.translate(-tile.x,-tile.y);ctx.fillStyle=texture;ctx.fillRect(tile.x-.06,tile.y-.06,1.12,1.12);ctx.restore();
  };
  const sand=select(3);layer(sand,value=>value===2||value===3);layer(select(2),value=>value===2);layer(select(1),value=>value===1,true);
  // A configured terrain without neighboring layers still keeps its own texture.
  if(tile.terrain===3&&!sand){ctx.fillStyle=pattern;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);}
  ctx.restore();return true;
}
