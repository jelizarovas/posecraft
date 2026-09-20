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
  let disposed=false,patterns=new WeakMap();const handles=new Map(),pending=[],standingHeights=new Map();
  // Action sheets can be large once decoded. Only maps with the corresponding
  // crossings need the extra hand-vault and climbing artwork.
  const vault=map.props.some(p=>p.traversal?.kind==='vault'&&(p.traversal.style==='branch'||p.traversal.activation==='click'));
  const climb=map.props.some(p=>p.traversal?.kind==='climb');
  const actorImages=Object.values(map.art?.actors||{}).flatMap(clips=>Object.entries(clips).filter(([name])=>name==='vault'?vault:name==='climbUp'||name==='climbDown'?climb:true).map(([,clip])=>clip.image));
  const fenceImages=map.props.some(prop=>prop.fence)&&map.art?.images?.['farm-fence-timber']?['farm-fence-timber']:[];
  const referenced=new Set([...Object.values(map.art?.props||{}).flat(),...Object.values(map.art?.terrain||{}),...Object.values(map.groundPaint||{}),...map.props.flatMap(prop=>prop.art?[prop.art]:[]),...map.actors.flatMap(actor=>actor.appearance?.image?[actor.appearance.image]:[]),...actorImages,...fenceImages]);
  for(const id of [...referenced]){const opened=map.art?.images[id]?.opened;if(opened)referenced.add(opened);}
  if(map.terraces?.length&&map.art?.images?.['cliff-rock'])referenced.add('cliff-rock');
  for(const[id,definition]of Object.entries(map.art?.images||{})){
    if(!referenced.has(id))continue;
    const url=new URL(definition.src,document.baseURI).href,handle=acquire(url,document);handles.set(id,handle);
    pending.push(handle.resource.promise.then(()=>{if(!disposed)onUpdate(id);},error=>{if(!disposed&&error.name!=='AbortError'){onError(error);onUpdate(id);}}));
  }
  const ready=Promise.all(pending).then(()=>{if(disposed)throw abortError();});ready.catch(()=>{});
  return{
    ready,
    image(id){const resource=handles.get(id)?.resource;return !disposed&&resource?.loaded?resource.image:null;},
    standingHeight(actorId){
      const appearance=map.actors.find(actor=>actor.id===actorId)?.appearance;
      if(appearance?.kind==='livestock'){const image=map.art.images[appearance.image];return image.height*image.anchorY;}
      const clip=map.art?.actors?.[actorId]?.idle,spec=clip&&map.art.images[clip.image];
      if(!spec)return 36;
      const image=this.image(clip.image),fallback=spec.height*spec.anchorY;
      if(!image)return fallback;
      const key=[clip.image,clip.frameWidth,clip.frameHeight,spec.height,spec.anchorY].join(':');
      if(standingHeights.has(key))return standingHeights.get(key);
      const canvas=document.createElement('canvas');canvas.width=clip.frameWidth;canvas.height=clip.frameHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});let top=clip.frameHeight;
      try{
        // First idle frame in each direction; transparent sprite padding is
        // not part of the character's height. Shared sheets are scanned once.
        for(let direction=0;direction<clip.directions;direction++){
          ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,direction*clip.frameHeight,clip.frameWidth,clip.frameHeight,0,0,canvas.width,canvas.height);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          for(let y=0;y<top;y++){let found=false;for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>=128){found=true;break;}if(found){top=y;break;}}
        }
      }catch{top=0;}
      canvas.width=canvas.height=1;
      const height=top<clip.frameHeight?Math.max(1,(spec.anchorY-top/clip.frameHeight)*spec.height):fallback;
      standingHeights.set(key,height);return height;
    },
    pattern(ctx,id){const image=this.image(id);if(!image)return null;let cache=patterns.get(ctx);if(!cache){cache=new Map();patterns.set(ctx,cache);}if(!cache.has(id)){const pattern=ctx.createPattern(image,'repeat'),definition=map.art.images[id];if(!pattern)return null;pattern.setTransform({a:definition.width/(64*image.naturalWidth),d:definition.height/(64*image.naturalHeight),b:0,c:0,e:0,f:0});cache.set(id,pattern);}return cache.get(id);},
    stats(){let loaded=0,failed=0;for(const{resource}of handles.values()){if(resource.loaded)loaded++;else if(resource.settled)failed++;}return{requested:handles.size,loaded,failed};},
    dispose(){if(disposed)return;disposed=true;for(const handle of handles.values())handle.release();handles.clear();patterns=new WeakMap();}
  };
}

/** Texture coordinates live on the map ground plane, independent of camera and viewport. */
export function drawMapTerrainTexture(ctx,map,tile,art){
  const tileIndex=tile.y*map.width+tile.x,selected=artTerrainSelection(map,tile.terrain,tileIndex),pattern=selected&&art.pattern(ctx,selected.id);if(!pattern)return false;
  ctx.save();ctx.transform(map.tileSize.width/2,map.tileSize.height/2,-map.tileSize.width/2,map.tileSize.height/2,0,0);
  const select=value=>{const selection=artTerrainSelection(map,value);return selection&&art.pattern(ctx,selection.id);},grass=select(0);
  if(!grass){ctx.fillStyle=pattern;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);ctx.restore();return true;}
  ctx.fillStyle=grass;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);
  // Eight local samples support both rounded outer bends and concave corner infill.
  const terrain=(dx,dy)=>{const x=tile.x+dx,y=tile.y+dy;return x<0||y<0||x>=map.width||y>=map.height?-1:map.terrain[y*map.width+x];};
  const neighbors=[terrain(0,-1),terrain(1,0),terrain(0,1),terrain(-1,0)],diagonals=[terrain(-1,-1),terrain(1,-1),terrain(1,1),terrain(-1,1)];
  const layer=(texture,belongs,road=false,state)=>{
    if(!texture)return;const own=state?.own??belongs(tile.terrain),edges=state?.edges??neighbors.map(belongs),corners=state?.corners??diagonals.map(belongs),radius=road ? .30 : .48;
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
  const paintAt=(dx,dy)=>{const x=tile.x+dx,y=tile.y+dy;if(x<0||y<0||x>=map.width||y>=map.height)return null;const index=y*map.width+x;return{terrain:map.terrain[index],id:map.groundPaint?.[index]};};
  const around=[paintAt(0,-1),paintAt(1,0),paintAt(0,1),paintAt(-1,0)],cornerPaint=[paintAt(-1,-1),paintAt(1,-1),paintAt(1,1),paintAt(-1,1)];
  const ids=new Set([paintAt(0,0),...around,...cornerPaint].filter(p=>p?.id&&p.terrain===tile.terrain).map(p=>p.id));
  for(const id of [...ids].sort())layer(art.pattern(ctx,id),()=>false,false,{own:paintAt(0,0)?.id===id,edges:around.map(p=>p?.terrain===tile.terrain&&p.id===id),corners:cornerPaint.map(p=>p?.terrain===tile.terrain&&p.id===id)});
  // A configured terrain without neighboring layers still keeps its own texture.
  if(tile.terrain===3&&!sand){ctx.fillStyle=pattern;ctx.fillRect(tile.x-.006,tile.y-.006,1.012,1.012);}
  ctx.restore();return true;
}
