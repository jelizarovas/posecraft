import {fenceRenderParts} from './map-fence.js';
import {mapPropArtBounds} from './map-depth.js';
import {mapPropShadowGeometry} from './map-ground-shadow.js';
import {orderMapScenery} from './map-scenery-depth.js';

const CELL=128,MIB=1024*1024;

function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function rasterTier(scale){return scale>6?8:scale>3?4:scale>1.5?2:1;}
function union(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
function propBounds(map,prop){const art=mapPropArtBounds(map,prop),shadow=mapPropShadowGeometry(map,prop);return shadow?union(art,shadow.bounds):art;}

/** Retained projected-world scenery. Camera movement only composites cached chunks. */
export function createMapSceneryChunks(map,doc,{drawShadow,drawProp,extraProps=[]}){
  const buckets=new Map(),descriptors=new Map(),cache=new Map(),latest=new Map(),coarse=new Map();
  let pixels=0,coarsePixels=0,maxPixels=2*MIB,rasterScale=1,builds=0,pending=false,plan=[],planPixels=0,disposed=false,buildMs=0,fallbackDraws=0,lodReuses=0,coarseDraws=0;
  const props=[...map.props,...extraProps].map((prop,order)=>({prop,order,bounds:prop.cliffBounds??propBounds(map,prop),depth:prop.x+prop.width+prop.y+prop.height})).sort((a,b)=>a.depth-b.depth||a.order-b.order);
  const entries=orderMapScenery(props.flatMap(entry=>entry.prop.fence?[{...entry,shadow:true,draw:false},...fenceRenderParts(map,entry.prop).map(part=>({...entry,bounds:part.bounds,depth:part.depth,part,draw:true,shadow:false}))]:[{...entry,depth:entry.prop.kind==='tree'||entry.prop.occlusion?.mode==='low-foliage'?entry.prop.x+entry.prop.width/2+entry.prop.y+entry.prop.height/2:entry.depth,shadow:true,draw:true}]));
  let worldBounds=null;
  for(const entry of entries){
    const b=entry.bounds;worldBounds=worldBounds?{x:Math.min(worldBounds.x,b.x),y:Math.min(worldBounds.y,b.y),width:Math.max(worldBounds.x+worldBounds.width,b.x+b.width)-Math.min(worldBounds.x,b.x),height:Math.max(worldBounds.y+worldBounds.height,b.y+b.height)-Math.min(worldBounds.y,b.y)}:{...b};
    const x0=Math.floor(b.x/CELL),x1=Math.floor((b.x+b.width-1e-6)/CELL),y0=Math.floor(b.y/CELL),y1=Math.floor((b.y+b.height-1e-6)/CELL);
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const id=`${cx}:${cy}`,list=buckets.get(id)||[];list.push(entry);buckets.set(id,list);}
  }
  function descriptor(cx,cy){
    const id=`${cx}:${cy}`;if(descriptors.has(id))return descriptors.get(id);
    const value={id,x:cx*CELL,y:cy*CELL,width:CELL,height:CELL,entries:buckets.get(id)||[]};descriptors.set(id,value);return value;
  }
  function stateKey(d,objects){let key='';for(const {prop}of d.entries)if(Object.hasOwn(objects,prop.id))key+=prop.id+':'+JSON.stringify(objects[prop.id])+';';return key;}
  function releaseCoarse(entry){coarsePixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;coarse.delete(entry.latestKey);}
  function saveCoarse(canvas,latestKey){
    const saved={canvas,latestKey,pixels:canvas.width*canvas.height};coarse.set(latestKey,saved);coarsePixels+=saved.pixels;
    while(coarsePixels>Math.min(MIB/2,maxPixels/8))releaseCoarse(coarse.values().next().value);
    return saved;
  }
  function preserve(entry){
    const previous=coarse.get(entry.latestKey);if(previous){coarse.delete(entry.latestKey);coarse.set(entry.latestKey,previous);return;}
    const canvas=doc.createElement('canvas');canvas.width=canvas.height=CELL/4;
    canvas.getContext('2d').drawImage(entry.canvas,0,0,canvas.width,canvas.height);
    saveCoarse(canvas,entry.latestKey);
  }
  function coldCoarse(d,objects){
    const canvas=doc.createElement('canvas');canvas.width=canvas.height=CELL/4;
    const ctx=canvas.getContext('2d');ctx.setTransform(.25,0,0,.25,-d.x*.25,-d.y*.25);
    for(const entry of d.entries)if(entry.shadow)drawShadow(ctx,entry.prop);
    for(const entry of d.entries)if(entry.draw)drawProp(ctx,entry.prop,objects[entry.prop.id],entry.part);
    return saveCoarse(canvas,d.latestKey);
  }
  function release(entry,keep=true){if(keep)preserve(entry);pixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;cache.delete(entry.key);if(latest.get(entry.latestKey)===entry)latest.delete(entry.latestKey);}
  function build(d,key,latestKey,objects){
    const started=performance.now(),canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.ceil(d.width*rasterScale));canvas.height=Math.max(1,Math.ceil(d.height*rasterScale));
    const ctx=canvas.getContext('2d'),previous=latest.get(latestKey);
    if(previous&&previous.canvas.width>=canvas.width){ctx.drawImage(previous.canvas,0,0,canvas.width,canvas.height);lodReuses++;}
    else{ctx.setTransform(rasterScale,0,0,rasterScale,-d.x*rasterScale,-d.y*rasterScale);
      for(const entry of d.entries)if(entry.shadow)drawShadow(ctx,entry.prop);
      for(const entry of d.entries)if(entry.draw)drawProp(ctx,entry.prop,objects[entry.prop.id],entry.part);
    }
    const value={...d,key,latestKey,canvas,pixels:canvas.width*canvas.height};cache.set(key,value);latest.set(latestKey,value);pixels+=value.pixels;builds++;buildMs+=performance.now()-started;return value;
  }
  function configure(rect,scale,viewportPixels,objects){
    const list=[];for(let cy=Math.floor(rect.y/CELL);cy<=Math.floor((rect.y+rect.height-1e-6)/CELL);cy++)for(let cx=Math.floor(rect.x/CELL);cx<=Math.floor((rect.x+rect.width-1e-6)/CELL);cx++){const id=`${cx}:${cy}`;if(!buckets.has(id))continue;const d=descriptor(cx,cy);if(intersects(d,rect))list.push(d);}
    maxPixels=Math.max(2*MIB,Math.min(8*MIB,Math.max(0,viewportPixels)*4));const detailBudget=maxPixels-Math.min(MIB/2,maxPixels/8);let next=rasterTier(scale);const cost=s=>list.length*CELL*CELL*s*s;while(next>1/8&&cost(next)>detailBudget)next/=2;
    if(plan.length&&next>rasterScale&&cost(next)>detailBudget*.65)next=rasterScale;
    rasterScale=next;planPixels=cost(next);
    plan=list.map(d=>{const state=stateKey(d,objects),latestKey=`${d.id}@${state}`;return{...d,state,latestKey,key:`${latestKey}@${rasterScale}`};});
    const pinned=new Set(plan.map(d=>d.key));
    // Downsample completed detail before eviction. Zooming out never needs to
    // reconstruct the same props just to display fewer pixels.
    for(const d of plan)if(!cache.has(d.key)){const previous=latest.get(d.latestKey);if(previous&&previous.canvas.width>CELL*rasterScale){build(d,d.key,d.latestKey,objects);release(previous);}}
    const missingPixels=plan.filter(d=>!cache.has(d.key)).length*CELL*CELL*rasterScale*rasterScale;
    for(const entry of [...cache.values()])if(!pinned.has(entry.key)&&pixels+missingPixels>detailBudget)release(entry);
    while(coarsePixels>Math.min(MIB/2,maxPixels/8))releaseCoarse(coarse.values().next().value);
  }
  return{
    draw(ctx,rect,objects=Object.create(null),{scale=1,viewportPixels=0,budgetMs=3}={}){
      if(disposed)return false;configure(rect,scale,viewportPixels,objects);const started=performance.now();pending=false;
      for(const d of plan){
        let entry=cache.get(d.key);
        if(!entry&&performance.now()-started<budgetMs)entry=build(d,d.key,d.latestKey,objects);
        if(!entry){entry=latest.get(d.latestKey)??coarse.get(d.latestKey);if(entry&&coarse.get(d.latestKey)===entry)coarseDraws++;pending=true;}
        if(entry){if(cache.has(entry.key)){cache.delete(entry.key);cache.set(entry.key,entry);}ctx.drawImage(entry.canvas,d.x,d.y,d.width,d.height);}
        else{const preview=coldCoarse(d,objects);ctx.drawImage(preview.canvas,d.x,d.y,d.width,d.height);fallbackDraws++;}
      }
      return true;
    },
    drawList:props.map(entry=>({type:'prop',item:entry.prop,depth:entry.depth})),
    worldBounds:worldBounds||{x:0,y:0,width:1,height:1},
    stats(){return{chunks:cache.size,pixels:pixels+coarsePixels,detailPixels:pixels,coarsePixels,coarseChunks:coarse.size,maxPixels,rasterScale,builds,pending,visibleChunks:plan.length,workingSetPixels:planPixels,buildMs,fallbackDraws,lodReuses,coarseDraws};},
    clear(){for(const entry of [...cache.values()])release(entry,false);for(const entry of [...coarse.values()])releaseCoarse(entry);descriptors.clear();plan=[];planPixels=0;pending=false;},
    dispose(){if(disposed)return;this.clear();disposed=true;}
  };
}
