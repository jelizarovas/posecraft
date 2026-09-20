import {terrainTileCorners,terrainHeightOffset} from './map-cliffs.js';
import {projectMap} from './map.js';
import {artTerrainSelection} from './map-art-layout.js';
import {createMapTerrainPainter} from './map-terrain.js';

const CELLS=8,MIB=1024*1024,COLORS=['#65804c','#baa781','#376a71','#c4b78e'],PREVIEW_SCALE=.25;

/** World-space terrain chunks. Camera motion only composites completed surfaces. */
export function createMapTerrainChunks(map,doc,art,fallback,{onUpdate}={}){
  const painter=createMapTerrainPainter(map,doc,art),cache=new Map(),byId=new Map(),staging=new Map(),descriptors=new Map();
  const scheduler=doc.defaultView||globalThis;
  let pixels=0,maxPixels=4*MIB,rasterScale=1,builds=0,completed=0,pending=false,lastTiles=null,lastViewKey='',plan=[],planPixels=0,disposed=false,targetViewportPixels=0,workHandle=0,workSlices=0,buildMs=0,swaps=0,resamples=0,previewBuilds=0;
  function cancelWork(){if(!workHandle)return;scheduler.clearTimeout(workHandle);workHandle=0;}
  function destroy(entry){pixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;}
  function remember(entry){cache.set(entry.key,entry);let levels=byId.get(entry.id);if(!levels){levels=new Map();byId.set(entry.id,levels);}levels.set(entry.scale,entry);}
  function release(entry){destroy(entry);cache.delete(entry.key);const levels=byId.get(entry.id);if(levels){levels.delete(entry.scale);if(!levels.size)byId.delete(entry.id);}}
  function descriptor(cx,cy,level=0){
    const id=`${cx}:${cy}:${level}`;if(descriptors.has(id))return descriptors.get(id);
    const x=cx*CELLS,y=cy*CELLS,right=Math.min(map.width,x+CELLS),bottom=Math.min(map.height,y+CELLS),points=[],tiles=[];
    for(let gy=y;gy<bottom;gy++)for(let gx=x;gx<right;gx++)if(terrainHeightOffset(map,{x:gx+.5,y:gy+.5})===level){tiles.push({x:gx,y:gy,terrain:map.terrain[gy*map.width+gx]});points.push(...terrainTileCorners(map,gx,gy).map(p=>projectMap(map,p)));}
    tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
    const left=Math.floor(Math.min(...points.map(p=>p.x)))-2,top=Math.floor(Math.min(...points.map(p=>p.y)))-2;
    const width=Math.ceil(Math.max(...points.map(p=>p.x)))-left+2,height=Math.ceil(Math.max(...points.map(p=>p.y)))-top+2;
    const result={id,x,y,left,top,width,height,tiles,depth:level*100000+x+y};descriptors.set(id,result);return result;
  }
  function flat(ctx,tile){const points=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=COLORS[tile.terrain];ctx.fill();}
  function surface(d,scale){
    const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.ceil(d.width*scale));canvas.height=Math.max(1,Math.ceil(d.height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.setTransform(scale,0,0,scale,-d.left*scale,-d.top*scale);
    const entry={...d,key:`${d.id}@${scale}`,scale,canvas,ctx,cursor:0,pixels:canvas.width*canvas.height,complete:false};pixels+=entry.pixels;return entry;
  }
  function texturedPreview(d){
    const entry=surface(d,Math.min(PREVIEW_SCALE,rasterScale));
    function triangle(image,a,b,c,first){
      const center={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3},points=[a,b,c].map(p=>{const dx=p.x-center.x,dy=p.y-center.y,n=Math.hypot(dx,dy)||1;return{x:p.x+dx/n,y:p.y+dy/n};}),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
      entry.ctx.save();entry.ctx.beginPath();points.forEach((p,i)=>i?entry.ctx.lineTo(p.x,p.y):entry.ctx.moveTo(p.x,p.y));entry.ctx.closePath();entry.ctx.clip();
      if(first)entry.ctx.transform((b.x-a.x)/w,(b.y-a.y)/w,(c.x-b.x)/h,(c.y-b.y)/h,a.x,a.y);
      else entry.ctx.transform((b.x-c.x)/w,(b.y-c.y)/w,(c.x-a.x)/h,(c.y-a.y)/h,a.x,a.y);
      entry.ctx.drawImage(image,0,0,w,h);entry.ctx.restore();
    }
    for(const tile of d.tiles){
      const selected=artTerrainSelection(map,tile.terrain,tile.y*map.width+tile.x),image=selected&&art.image(selected.id);
      // An opaque undercoat survives low-resolution resampling at diamond edges.
      flat(entry.ctx,tile);if(!image)continue;
      const p=terrainTileCorners(map,tile.x,tile.y).map(point=>projectMap(map,point));triangle(image,p[0],p[1],p[2],true);triangle(image,p[0],p[2],p[3],false);
    }
    entry.cursor=d.tiles.length;entry.complete=true;remember(entry);previewBuilds++;builds++;return entry;
  }
  function resample(d,source,scale){
    const entry=surface(d,scale);entry.ctx.setTransform(1,0,0,1,0,0);entry.ctx.drawImage(source.canvas,0,0,source.canvas.width,source.canvas.height,0,0,entry.canvas.width,entry.canvas.height);entry.cursor=d.tiles.length;entry.complete=true;remember(entry);resamples++;builds++;return entry;
  }
  function candidates(id){return [...(byId.get(id)?.values()||[])].sort((a,b)=>b.scale-a.scale);}
  function front(d){return cache.get(d.key)||candidates(d.id)[0]||null;}
  function chooseScale(scale,list){
    let next=scale>2.5?4:scale>1.25?2:1;
    if(rasterScale===4&&scale>=2.2)next=4;else if(rasterScale===2&&scale>=1&&scale<=2.8)next=2;else if(rasterScale===1&&scale<=1.5)next=1;
    const cost=s=>list.reduce((sum,d)=>sum+Math.ceil(d.width*s)*Math.ceil(d.height*s),0);
    // An upgrade needs both the complete front and its replacement until the
    // atomic swap. Account for those fronts before selecting a tier.
    const fallbackCost=()=>list.reduce((sum,d)=>{
      if(cache.has(`${d.id}@${next}`))return sum;
      const old=candidates(d.id)[0];
      // Lower-detail fronts must coexist with an upgrade until its atomic
      // swap. Higher-detail fronts are immediately downsampled and released.
      if(old)return sum+(old.scale<next?old.pixels:0);
      const preview=Math.min(PREVIEW_SCALE,next);return sum+Math.ceil(d.width*preview)*Math.ceil(d.height*preview);
    },0);
    while(cost(next)+fallbackCost()>maxPixels&&next>1/64)next/=2;return next;
  }
  function trim(){
    const protectedEntries=new Set();for(const d of plan){const shown=front(d);if(shown)protectedEntries.add(shown);const work=staging.get(d.id);if(work)protectedEntries.add(work);}
    for(const entry of [...cache.values()])if(pixels>maxPixels&&!protectedEntries.has(entry))release(entry);
  }
  function configure(tiles,scale,viewportPixels,view){
    const budget=Math.max(4*MIB,Math.min(12*MIB,Math.max(0,viewportPixels)*(scale>2.5?8:5)));
    let viewKey='',clip=null;if(view){const unit=64,x=Math.floor(view.x/unit)*unit,y=Math.floor(view.y/unit)*unit,right=Math.ceil((view.x+view.width)/unit)*unit,bottom=Math.ceil((view.y+view.height)/unit)*unit;clip={x,y,width:right-x,height:bottom-y};viewKey=`${x}:${y}:${right}:${bottom}`;}
    const wanted=new Map();for(const tile of tiles){const cx=Math.floor(tile.x/CELLS),cy=Math.floor(tile.y/CELLS),level=terrainHeightOffset(map,{x:tile.x+.5,y:tile.y+.5}),id=`${cx}:${cy}:${level}`;if(!wanted.has(id))wanted.set(id,descriptor(cx,cy,level));}
    const list=[...wanted.values()].filter(d=>!clip||d.left<clip.x+clip.width&&d.left+d.width>clip.x&&d.top<clip.y+clip.height&&d.top+d.height>clip.y).sort((a,b)=>a.depth-b.depth);
    maxPixels=budget;const next=chooseScale(scale,list);if(lastTiles===tiles&&lastViewKey===viewKey&&rasterScale===next&&plan.length===list.length){trim();return;}
    lastTiles=tiles;lastViewKey=viewKey;rasterScale=next;plan=list.map(d=>({...d,key:`${d.id}@${rasterScale}`}));plan.requestedScale=scale;planPixels=plan.reduce((sum,d)=>sum+Math.ceil(d.width*rasterScale)*Math.ceil(d.height*rasterScale),0);
    const visible=new Set(plan.map(d=>d.id));for(const [id,entry] of staging)if(!visible.has(id)||entry.scale!==rasterScale){destroy(entry);staging.delete(id);}
    for(const d of plan){if(cache.has(d.key))continue;const old=candidates(d.id)[0];if(old&&old.scale>rasterScale)resample(d,old,rasterScale);else if(!old)texturedPreview(d);}
    trim();
  }
  function allocate(d){
    const needed=Math.max(1,Math.ceil(d.width*rasterScale))*Math.max(1,Math.ceil(d.height*rasterScale)),fronts=new Set(plan.map(front).filter(Boolean));
    for(const entry of [...cache.values()])if(pixels+needed>maxPixels&&!fronts.has(entry))release(entry);
    if(pixels+needed>maxPixels)return null;
    const entry=surface(d,rasterScale);staging.set(d.id,entry);builds++;return entry;
  }
  function needsWork(){return plan.some(d=>!cache.has(d.key));}
  function work(budgetMs){
    if(disposed)return;const started=performance.now();let progressed=false;painter.beginFrame(rasterScale,Math.min(targetViewportPixels,2*MIB));
    for(const d of plan){
      if(cache.has(d.key)||performance.now()-started>=budgetMs)continue;let entry=staging.get(d.id);if(!entry)entry=allocate(d);if(!entry)continue;
      while(entry.cursor<entry.tiles.length&&performance.now()-started<budgetMs){const tile=entry.tiles[entry.cursor],result=painter.drawReady(entry.ctx,tile,{direct:true});if(result===null)break;if(result===false){if(fallback)fallback(entry.ctx,tile);else flat(entry.ctx,tile);}entry.cursor++;progressed=true;}
      if(entry.cursor===entry.tiles.length){entry.complete=true;staging.delete(d.id);remember(entry);completed++;swaps++;progressed=true;trim();}
    }
    buildMs+=performance.now()-started;workSlices++;pending=needsWork();if(progressed)onUpdate?.();if(pending)scheduleWork();
  }
  function scheduleWork(){if(disposed||workHandle||!pending)return;workHandle=scheduler.setTimeout(()=>{workHandle=0;work(3);},0);}
  return{
    draw(ctx,tiles,{scale=1,viewportPixels=0,view}={}){
      if(disposed)return false;configure(tiles,scale,viewportPixels,view);targetViewportPixels=Math.max(0,viewportPixels);pending=false;
      for(const d of plan){const entry=front(d);if(entry)ctx.drawImage(entry.canvas,d.left,d.top,d.width,d.height);if(!cache.has(d.key))pending=true;}
      scheduleWork();return true;
    },
    stats(){const inner=painter.stats();return{tiles:cache.size,chunks:cache.size,pixels,materials:inner.materials,builds,completed,pending,maxPixels,rasterScale,tilePixels:inner.pixels,tileBuilds:inner.builds,visibleChunks:plan.length,workingSetPixels:planPixels,workSlices,buildMs,staging:staging.size,swaps,resamples,previewBuilds};},
    clear(){cancelWork();for(const entry of cache.values())destroy(entry);for(const entry of staging.values())destroy(entry);cache.clear();byId.clear();staging.clear();descriptors.clear();plan=[];lastTiles=null;lastViewKey='';planPixels=0;pending=false;painter.clear();},
    dispose(){if(disposed)return;this.clear();painter.dispose();disposed=true;}
  };
}
