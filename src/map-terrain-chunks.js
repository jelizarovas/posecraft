import {terrainTileCorners,terrainHeightOffset} from './map-cliffs.js';
import {projectMap} from './map.js';
import {artTerrainSelection} from './map-art-layout.js';
import {createMapTerrainPainter} from './map-terrain.js';

const CELLS=8,MIB=1024*1024,HARD_LIMIT=20*MIB,COLORS=['#65804c','#baa781','#376a71','#c4b78e'],PREVIEW_SCALE=.25;

/** World-space terrain chunks. Camera motion only composites completed surfaces. */
export function createMapTerrainChunks(map,doc,art,fallback,{onUpdate,externalWork=false}={}){
  const painter=createMapTerrainPainter(map,doc,art,{materialLimit:2048}),cache=new Map(),byId=new Map(),staging=new Map(),descriptors=new Map();
  const scheduler=doc.defaultView||globalThis;
  const terraceOffsets=map.terraces?.length?(()=>{const offsets=new Uint8Array(map.width*map.height);for(const t of map.terraces)for(let y=t.y;y<t.y+t.height;y++)for(let x=t.x;x<t.x+t.width;x++){const i=y*map.width+x;if(t.heightOffset>offsets[i])offsets[i]=t.heightOffset;}return offsets;})():null;
  let pixels=0,maxPixels=4*MIB,rasterScale=1,deferredScale=null,builds=0,completed=0,pending=false,lastTiles=null,lastViewKey='',lastList=[],plan=[],ring=[],ringKey='',ringBase=0,ringPixels=0,ringStalled=false,allDescriptors=null,planPixels=0,disposed=false,targetViewportPixels=0,workHandle=0,workSlices=0,buildMs=0,swaps=0,resamples=0,previewBuilds=0,prefetched=0,staleDraws=0,missingDraws=0,lastUpdateAt=0,pendingVisualUpdate=false;
  const workChannel=!externalWork&&typeof scheduler.MessageChannel==='function'?new scheduler.MessageChannel():null;
  let workScheduled=false;
  function cancelWork(){workScheduled=false;if(!workHandle)return;scheduler.clearTimeout(workHandle);workHandle=0;}
  function destroy(entry){pixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;}
  function remember(entry){cache.set(entry.key,entry);let levels=byId.get(entry.id);if(!levels){levels=new Map();byId.set(entry.id,levels);}levels.set(entry.scale,entry);}
  function release(entry){destroy(entry);cache.delete(entry.key);const levels=byId.get(entry.id);if(levels){levels.delete(entry.scale);if(!levels.size)byId.delete(entry.id);}}
  function descriptor(cx,cy,level=0){
    const id=`${cx}:${cy}:${level}`;if(descriptors.has(id))return descriptors.get(id);
    const x=cx*CELLS,y=cy*CELLS,right=Math.min(map.width,x+CELLS),bottom=Math.min(map.height,y+CELLS),tiles=[];
    const halfW=map.tileSize.width/2,halfH=map.tileSize.height/2,th=map.tileSize.height,elev=map.elevations,stride=map.width+1,w=map.width;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const counts=[0,0,0,0];
    for(let gy=y;gy<bottom;gy++)for(let gx=x;gx<right;gx++){
      const h=terraceOffsets?terraceOffsets[gy*w+gx]:0;
      if(h!==level)continue;
      const terrain=map.terrain[gy*w+gx];counts[terrain]++;
      tiles.push({x:gx,y:gy,terrain});
      const lx=(gx-gy-1)*halfW,rx=(gx-gy+1)*halfW;
      if(lx<minX)minX=lx;if(rx>maxX)maxX=rx;
      const base=(gx+gy)*halfH-h*th;
      let a=base,b=base+halfH,c=base+th,d=base+halfH;
      if(elev){const idx=gy*stride+gx;a-=elev[idx]*th;b-=elev[idx+1]*th;c-=elev[idx+stride+1]*th;d-=elev[idx+stride]*th;}
      const ty=Math.min(a,b,c,d),by=Math.max(a,b,c,d);
      if(ty<minY)minY=ty;if(by>maxY)maxY=by;
    }
    tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
    let dominant=0;for(let k=1;k<4;k++)if(counts[k]>counts[dominant])dominant=k;
    const corner=(gx,gy)=>{const h=(elev?elev[gy*stride+gx]:0)+level;return{x:(gx-gy)*halfW,y:(gx+gy)*halfH-h*th};};
    const quad=[corner(x,y),corner(right,y),corner(right,bottom),corner(x,bottom)];
    const left=Math.floor(minX)-2,top=Math.floor(minY)-2;
    const width=Math.ceil(maxX)-left+2,height=Math.ceil(maxY)-top+2;
    const result={id,x,y,left,top,width,height,tiles,dominant,quad,depth:level*100000+x+y};descriptors.set(id,result);return result;
  }
  function everyDescriptor(){
    if(allDescriptors)return allDescriptors;allDescriptors=[];
    for(let cy=0;cy*CELLS<map.height;cy++)for(let cx=0;cx*CELLS<map.width;cx++){
      const levels=new Set();
      for(let gy=cy*CELLS;gy<Math.min(map.height,cy*CELLS+CELLS);gy++)for(let gx=cx*CELLS;gx<Math.min(map.width,cx*CELLS+CELLS);gx++)levels.add(terraceOffsets?terraceOffsets[gy*map.width+gx]:0);
      for(const level of levels)allDescriptors.push(descriptor(cx,cy,level));
    }
    return allDescriptors;
  }
  const overlaps=(d,r)=>d.left<r.x+r.width&&d.left+d.width>r.x&&d.top<r.y+r.height&&d.top+d.height>r.y;
  const gap=(d,r)=>Math.hypot(Math.max(0,r.x-d.left-d.width,d.left-r.x-r.width),Math.max(0,r.y-d.top-d.height,d.top-r.y-r.height));
  function flat(ctx,tile){const points=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=COLORS[tile.terrain];ctx.fill();}
  function drawFlatChunk(ctx,d){
    const q=d.quad;
    ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);ctx.lineTo(q[2].x,q[2].y);ctx.lineTo(q[3].x,q[3].y);ctx.closePath();
    ctx.fillStyle=COLORS[d.dominant];ctx.fill();
  }
  function surface(d,scale){
    const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.ceil(d.width*scale));canvas.height=Math.max(1,Math.ceil(d.height*scale));
    const ctx=canvas.getContext('2d');ctx.setTransform(scale,0,0,scale,-d.left*scale,-d.top*scale);
    const entry={...d,key:`${d.id}@${scale}`,scale,canvas,ctx,cursor:0,pixels:canvas.width*canvas.height,complete:false};pixels+=entry.pixels;return entry;
  }
  function texturedPreview(d){
    const entry=surface(d,Math.min(PREVIEW_SCALE,rasterScale));
    function triangle(image,a,b,c,first){
      const center={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3},points=[a,b,c].map(p=>{const dx=p.x-center.x,dy=p.y-center.y,n=Math.hypot(dx,dy)||1;return{x:p.x+dx/n,y:p.y+dy/n};}),iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
      entry.ctx.save();entry.ctx.beginPath();points.forEach((p,i)=>i?entry.ctx.lineTo(p.x,p.y):entry.ctx.moveTo(p.x,p.y));entry.ctx.closePath();entry.ctx.clip();
      if(first)entry.ctx.transform((b.x-a.x)/iw,(b.y-a.y)/iw,(c.x-b.x)/ih,(c.y-b.y)/ih,a.x,a.y);
      else entry.ctx.transform((b.x-c.x)/iw,(b.y-c.y)/iw,(c.x-a.x)/ih,(c.y-a.y)/ih,a.x,a.y);
      entry.ctx.drawImage(image,0,0,iw,ih);entry.ctx.restore();
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
    let next=scale>2.5?4:scale>1.25?2:scale>.55?1:.5;
    if(rasterScale===4&&scale>=2.2)next=4;else if(rasterScale===2&&scale>=1&&scale<=2.8)next=2;else if(rasterScale===1&&scale>=.5&&scale<=1.5)next=1;else if(rasterScale===.5&&scale<=.72)next=.5;
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
    if(pixels<=maxPixels)return;
    const protectedEntries=new Set();for(const d of plan){const shown=front(d);if(shown)protectedEntries.add(shown);const work=staging.get(d.id);if(work)protectedEntries.add(work);}
    // Off-screen prefetch goes before anything visible, farthest first.
    const ringEntries=[];for(const d of ring){const entry=cache.get(d.key);if(entry&&!protectedEntries.has(entry))ringEntries.push(entry);}
    const ringSet=new Set(ringEntries);
    for(const entry of [...cache.values()])if(pixels>maxPixels&&!protectedEntries.has(entry)&&!ringSet.has(entry))release(entry);
    for(const entry of ringEntries.reverse())if(pixels>maxPixels)release(entry);
  }
  function configure(tiles,scale,viewportPixels,view,freezeLod,prefetch){
    const budget=Math.max(4*MIB,Math.min(12*MIB,Math.max(0,viewportPixels)*(scale>2.5?8:5)));
    let viewKey='',clip=null;if(view){const unit=64,x=Math.floor(view.x/unit)*unit,y=Math.floor(view.y/unit)*unit,right=Math.ceil((view.x+view.width)/unit)*unit,bottom=Math.ceil((view.y+view.height)/unit)*unit;clip={x,y,width:right-x,height:bottom-y};viewKey=`${x}:${y}:${right}:${bottom}`;}
    let listChanged=false;
    if(view&&prefetch){
      if(lastViewKey!==viewKey||lastTiles!==null){lastList=everyDescriptor().filter(d=>overlaps(d,clip)).sort((a,b)=>a.depth-b.depth);lastViewKey=viewKey;lastTiles=null;listChanged=true;}
    }else if(lastTiles!==tiles||lastViewKey!==viewKey){
      const wanted=new Map(),w=map.width;
      for(let i=0;i<tiles.length;i++){
        const tile=tiles[i],cx=tile.x>>3,cy=tile.y>>3,level=terraceOffsets?terraceOffsets[tile.y*w+tile.x]:0,key=cx|(cy<<8)|(level<<16);
        if(!wanted.has(key))wanted.set(key,descriptor(cx,cy,level));
      }
      lastList=[...wanted.values()].filter(d=>!clip||d.left<clip.x+clip.width&&d.left+d.width>clip.x&&d.top<clip.y+clip.height&&d.top+d.height>clip.y).sort((a,b)=>a.depth-b.depth);
      lastTiles=tiles;lastViewKey=viewKey;listChanged=true;
    }
    // Tier selection only counts what is on screen; prefetch fits around it.
    maxPixels=budget;
    const desired=chooseScale(scale,lastList);
    const area=prefetch&&view?{x:Math.floor(prefetch.x/64)*64,y:Math.floor(prefetch.y/64)*64,right:Math.ceil((prefetch.x+prefetch.width)/64)*64,bottom:Math.ceil((prefetch.y+prefetch.height)/64)*64,focus:prefetch.focus,fx:Math.round(prefetch.focus.x/64),fy:Math.round(prefetch.focus.y/64)}:null;
    const nextRingKey=area?`${area.x}:${area.y}:${area.right}:${area.bottom}:${area.fx}:${area.fy}`:'';
    let next=desired;
    if(freezeLod&&plan.length){
      deferredScale=desired!==rasterScale?desired:null;
      next=rasterScale;
    }else{
      deferredScale=null;
    }
    if(!listChanged&&rasterScale===next&&plan.length===lastList.length&&ringKey===nextRingKey&&ringBase===budget){maxPixels=budget+ringPixels;trim();return;}
    rasterScale=next;plan=lastList.map(d=>({...d,key:`${d.id}@${rasterScale}`}));plan.requestedScale=scale;planPixels=plan.reduce((sum,d)=>sum+Math.ceil(d.width*rasterScale)*Math.ceil(d.height*rasterScale),0);
    ringKey=nextRingKey;ringBase=budget;ring=[];ringPixels=0;ringStalled=false;
    if(area){
      // Chunks just outside the view are rendered ahead of time, nearest to the
      // direction of travel first, so panning composites finished terrain.
      const shown=new Set(plan.map(d=>d.id)),rect={x:area.x,y:area.y,width:area.right-area.x,height:area.bottom-area.y};
      const ringBudget=Math.max(0,Math.min(Math.max(0,viewportPixels)*4,HARD_LIMIT-budget));
      const near=everyDescriptor().filter(d=>!shown.has(d.id)&&overlaps(d,rect)).map(d=>({d,distance:gap(d,area.focus)})).sort((a,b)=>a.distance-b.distance);
      for(const {d} of near){const cost=Math.ceil(d.width*rasterScale)*Math.ceil(d.height*rasterScale);if(ringPixels+cost>ringBudget)break;ringPixels+=cost;ring.push({...d,key:`${d.id}@${rasterScale}`});}
    }
    maxPixels=budget+ringPixels;
    const kept=new Set([...plan,...ring].map(d=>d.id));for(const [id,entry] of staging)if(!kept.has(id)||entry.scale!==rasterScale){destroy(entry);staging.delete(id);}
    trim();
  }
  function allocate(d,prefetching=false){
    const needed=Math.max(1,Math.ceil(d.width*rasterScale))*Math.max(1,Math.ceil(d.height*rasterScale));
    if(pixels+needed>maxPixels){
      const fronts=new Set(plan.map(front).filter(Boolean)),ahead=ring.map(d=>cache.get(d.key)).filter(Boolean),aheadSet=new Set(ahead);
      for(const entry of [...cache.values()])if(pixels+needed>maxPixels&&!fronts.has(entry)&&!aheadSet.has(entry))release(entry);
      if(!prefetching)for(const entry of ahead.reverse())if(pixels+needed>maxPixels&&!fronts.has(entry))release(entry);
      if(pixels+needed>maxPixels)return null;
    }
    const entry=surface(d,rasterScale);staging.set(d.id,entry);builds++;return entry;
  }
  // Prefetch that no longer fits waits for the view to move instead of retrying.
  function needsWork(){return plan.some(d=>!cache.has(d.key))||!ringStalled&&ring.some(d=>!cache.has(d.key));}
  function work(budgetMs=4){
    if(disposed||deferredScale!==null)return{visualProgress:false,pending};
    const started=performance.now();let visualProgress=false;painter.beginFrame(rasterScale,Math.min(targetViewportPixels,2*MIB));
    const batch=[],shown=new Set(plan.map(d=>d.id)),visibleMissing=plan.some(d=>!cache.has(d.key));
    // Visible chunks first; prefetch only once the view itself is complete.
    for(const d of visibleMissing?plan:ring){
      if(cache.has(d.key))continue;
      if(performance.now()-started>=budgetMs)break;
      const old=candidates(d.id)[0];
      if(old&&old.scale>rasterScale){resample(d,old,rasterScale);if(shown.has(d.id))visualProgress=true;continue;}
      let entry=staging.get(d.id);if(!entry)entry=allocate(d,!shown.has(d.id));if(!entry){if(!visibleMissing){ringStalled=true;break;}continue;}
      batch.push(entry);
      if(batch.length>=(visibleMissing?12:2))break;
    }
    if(batch.length){
      painter.drawChunks(batch,budgetMs,started,fallback,terraceOffsets);
      for(const entry of batch){
        if(entry.cursor===entry.tiles.length){entry.complete=true;staging.delete(entry.id);remember(entry);completed++;swaps++;if(shown.has(entry.id))visualProgress=true;else prefetched++;}
      }
    }
    if(visualProgress)trim();
    buildMs+=performance.now()-started;workSlices++;
    const missing=needsWork();
    // `pending` describes the last drawn frame; finished chunks count once shown.
    if(plan.some(d=>!cache.has(d.key))||deferredScale!==null)pending=true;
    if(!externalWork){
      if(visualProgress)pendingVisualUpdate=true;
      const now=performance.now();
      if(pendingVisualUpdate&&(!missing||now-lastUpdateAt>=100)){pendingVisualUpdate=false;lastUpdateAt=now;onUpdate?.();}
      if(missing)scheduleWork();
    }
    return{visualProgress,pending:missing};
  }
  if(workChannel)workChannel.port1.onmessage=()=>{if(!workScheduled)return;workScheduled=false;work(4);};
  function scheduleWork(){
    if(disposed||externalWork||workScheduled||workHandle||deferredScale!==null||!pending)return;
    if(workChannel){workScheduled=true;workChannel.port2.postMessage(null);}
    else workHandle=scheduler.setTimeout(()=>{workHandle=0;work(4);},0);
  }
  return{
    draw(ctx,tiles,{scale=1,viewportPixels=0,view,prefetch,freezeLod=false,budget,budgetMs}={}){
      if(disposed)return false;configure(tiles,scale,viewportPixels,view,freezeLod,prefetch);targetViewportPixels=Math.max(0,viewportPixels);
      const started=performance.now();let syncOps=0;
      const hasTime=budget?()=>budget.hasTime():budgetMs!==undefined?()=>performance.now()-started<budgetMs:()=>syncOps<16;
      let synced=false;pending=false;
      for(const d of plan){
        let entry=cache.get(d.key);
        if(!entry){
          const old=candidates(d.id)[0];
          if(!freezeLod&&old&&old.scale>rasterScale&&hasTime()){entry=resample(d,old,rasterScale);synced=true;syncOps++;}
          // A textured preview is cheap; flat colour is only for zoom gestures.
          else if(!old&&!freezeLod){entry=texturedPreview(d);synced=true;syncOps++;}
          else entry=old||null;
        }
        if(entry){ctx.drawImage(entry.canvas,d.left,d.top,d.width,d.height);if(entry.key!==d.key||entry.scale<PREVIEW_SCALE*1.01&&rasterScale>PREVIEW_SCALE)staleDraws++;}
        else{drawFlatChunk(ctx,d);missingDraws++;}
        if(!cache.has(d.key))pending=true;
      }
      if(synced)trim();
      const missing=pending;
      if(deferredScale!==null)pending=true;
      if(!externalWork&&missing&&deferredScale===null)scheduleWork();
      return true;
    },
    work,
    needsBackgroundWork(){return !disposed&&deferredScale===null&&needsWork();},
    stats(){const inner=painter.stats();return{tiles:cache.size,chunks:cache.size,pixels,materials:inner.materials,builds,completed,pending,maxPixels,rasterScale,tilePixels:inner.pixels,tileBuilds:inner.builds,visibleChunks:plan.length,workingSetPixels:planPixels,workSlices,buildMs,staging:staging.size,swaps,resamples,previewBuilds,prefetched,prefetchChunks:ring.length,prefetchPixels:ringPixels,staleDraws,missingDraws};},
    clear(){cancelWork();for(const entry of cache.values())destroy(entry);for(const entry of staging.values())destroy(entry);cache.clear();byId.clear();staging.clear();descriptors.clear();allDescriptors=null;plan=[];ring=[];ringKey='';ringPixels=0;lastList=[];lastTiles=null;lastViewKey='';deferredScale=null;planPixels=0;pending=true;pendingVisualUpdate=false;painter.clear();},
    dispose(){if(disposed)return;this.clear();workChannel?.port1.close();workChannel?.port2.close();painter.dispose();disposed=true;pending=false;}
  };
}
