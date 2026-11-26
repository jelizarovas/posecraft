import {fenceRenderParts} from './map-fence.js';
import {mapPropArtBounds} from './map-depth.js';
import {mapPropShadowGeometry} from './map-ground-shadow.js';
import {orderMapScenery} from './map-scenery-depth.js';

const MIB=1024*1024,HARD_LIMIT=16*MIB;

const gap=(a,b)=>Math.hypot(Math.max(0,b.x-a.x-a.width,a.x-b.x-b.width),Math.max(0,b.y-a.y-a.height,a.y-b.y-b.height));
function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function rasterTier(scale){return scale>6?8:scale>3?4:scale>1.5?2:scale>.55?1:.5;}
function union(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
function propBounds(map,prop){const art=mapPropArtBounds(map,prop),shadow=mapPropShadowGeometry(map,prop);return shadow?union(art,shadow.bounds):art;}

/** Retained projected-world scenery. Camera movement only composites cached chunks. */
export function createMapSceneryChunks(map,doc,{drawShadow,drawProp,prepare,extraProps=[],fixedScale}){
  const CELL=fixedScale?128:256;
  const buckets=new Map(),descriptors=new Map(),cache=new Map(),staging=new Map(),latest=new Map(),coarse=new Map();
  let pixels=0,stagingPixels=0,coarsePixels=0,maxPixels=2*MIB,detailBudget=maxPixels-Math.min(MIB/2,maxPixels/8),rasterScale=1,deferredScale=null,builds=0,pending=false,plan=[],ring=[],ringPixels=0,ringStalled=false,ringKey='',prefetched=0,planPixels=0,disposed=false,buildMs=0,fallbackDraws=0,lodReuses=0,coarseDraws=0,staleDraws=0,missingDraws=0,lastObjects=Object.create(null);
  const props=[...map.props,...extraProps].map((prop,order)=>{
    const artBounds=prop.cliffBounds??mapPropArtBounds(map,prop);
    const shadowBounds=prop.cliffBounds?null:mapPropShadowGeometry(map,prop)?.bounds??null;
    const bounds=shadowBounds?union(artBounds,shadowBounds):artBounds;
    return{prop,order,artBounds,shadowBounds,bounds,depth:prop.x+prop.width+prop.y+prop.height};
  }).sort((a,b)=>a.depth-b.depth||a.order-b.order);
  const entries=orderMapScenery(props.flatMap(entry=>entry.prop.fence?[{...entry,shadow:true,draw:false},...fenceRenderParts(map,entry.prop).map(part=>({...entry,artBounds:part.bounds,bounds:part.bounds,depth:part.depth,part,draw:true,shadow:false}))]:[{...entry,depth:entry.prop.kind==='tree'||entry.prop.occlusion?.mode==='low-foliage'?entry.prop.x+entry.prop.width/2+entry.prop.y+entry.prop.height/2:entry.depth,shadow:true,draw:true}]));
  let worldBounds=null;
  for(const entry of entries){
    const b=entry.bounds;worldBounds=worldBounds?{x:Math.min(worldBounds.x,b.x),y:Math.min(worldBounds.y,b.y),width:Math.max(worldBounds.x+worldBounds.width,b.x+b.width)-Math.min(worldBounds.x,b.x),height:Math.max(worldBounds.y+worldBounds.height,b.y+b.height)-Math.min(worldBounds.y,b.y)}:{...b};
    const x0=Math.floor(b.x/CELL),x1=Math.floor((b.x+b.width-1e-6)/CELL),y0=Math.floor(b.y/CELL),y1=Math.floor((b.y+b.height-1e-6)/CELL);
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const id=`${cx}:${cy}`,list=buckets.get(id)||[];list.push(entry);buckets.set(id,list);}
  }
  function descriptor(cx,cy){
    const id=`${cx}:${cy}`;if(descriptors.has(id))return descriptors.get(id);
    const x=cx*CELL,y=cy*CELL,rect={x,y,width:CELL,height:CELL},raw=buckets.get(id)||[];
    const shadowEntries=raw.filter(e=>e.shadow&&e.shadowBounds&&intersects(e.shadowBounds,rect));
    const drawEntries=raw.filter(e=>e.draw&&intersects(e.artBounds,rect));
    const value={id,x,y,width:CELL,height:CELL,entries:raw,shadowEntries,drawEntries};descriptors.set(id,value);return value;
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
    const w=CELL/4,canvas=doc.createElement('canvas');canvas.width=canvas.height=w;
    const ctx=canvas.getContext('2d');ctx.setTransform(.25,0,0,.25,-d.x*.25,-d.y*.25);
    for(const entry of d.shadowEntries)drawShadow(ctx,entry.prop);
    for(const entry of d.drawEntries)drawProp(ctx,entry.prop,objects[entry.prop.id],entry.part);
    return saveCoarse(canvas,d.latestKey);
  }
  function release(entry,keep=true){if(keep)preserve(entry);pixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;cache.delete(entry.key);if(latest.get(entry.latestKey)===entry)latest.delete(entry.latestKey);}
  /** Builds a chunk, resuming across calls until `deadline`; null while unfinished. */
  function build(d,key,latestKey,objects,deadline=Infinity){
    const started=performance.now();let job=staging.get(key);
    if(!job){
      const w=Math.max(1,Math.ceil(d.width*rasterScale)),h=Math.max(1,Math.ceil(d.height*rasterScale));
      const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d'),previous=latest.get(latestKey);
      job={canvas,ctx,cursor:0,pixels:w*h};stagingPixels+=job.pixels;
      if(previous&&previous.canvas.width>=w){ctx.drawImage(previous.canvas,0,0,w,h);lodReuses++;job.cursor=Infinity;}
      else ctx.setTransform(rasterScale,0,0,rasterScale,-d.x*rasterScale,-d.y*rasterScale);
    }
    // One chunk can hold costly cliff faces and first-use shadow stamps, so
    // background builds yield between props instead of blocking a frame.
    const shadows=d.shadowEntries.length,total=shadows+d.drawEntries.length;
    for(let drawn=0;job.cursor<total;drawn++){
      if(drawn&&performance.now()>=deadline)break;
      const i=job.cursor++;
      if(i<shadows)drawShadow(job.ctx,d.shadowEntries[i].prop);
      else{const entry=d.drawEntries[i-shadows];drawProp(job.ctx,entry.prop,objects[entry.prop.id],entry.part);}
    }
    buildMs+=performance.now()-started;
    if(job.cursor<total){staging.set(key,job);return null;}
    staging.delete(key);stagingPixels-=job.pixels;
    const value={...d,key,latestKey,canvas:job.canvas,pixels:job.pixels};cache.set(key,value);latest.set(latestKey,value);pixels+=value.pixels;builds++;return value;
  }
  // Asks for every prop's reduced artwork; a chunk waits until all are decoded.
  function prepared(d,objects){
    if(!prepare)return true;let ready=true;
    for(const entry of d.shadowEntries)if(!prepare(entry.prop,objects[entry.prop.id],rasterScale,true))ready=false;
    for(const entry of d.drawEntries)if(!prepare(entry.prop,objects[entry.prop.id],rasterScale,false))ready=false;
    return ready;
  }
  function dropStaging(keep){for(const [key,job] of staging)if(!keep.has(key)){stagingPixels-=job.pixels;job.canvas.width=job.canvas.height=1;staging.delete(key);}}
  function chooseTier(scale){
    if(fixedScale)return fixedScale;
    let next=rasterTier(scale);
    if(rasterScale===8&&scale>=5.4)next=8;
    else if(rasterScale===4&&scale>=2.6&&scale<=6.6)next=4;
    else if(rasterScale===2&&scale>=1.3&&scale<=3.3)next=2;
    else if(rasterScale===1&&scale>=.5&&scale<=1.75)next=1;
    else if(rasterScale===.5&&scale<=.72)next=.5;
    return next;
  }
  function evict(pinned){
    if(pixels>detailBudget){
      const visibleLatest=new Set();
      for(const d of plan){const prev=latest.get(d.latestKey);if(prev)visibleLatest.add(prev);}
      // Prefetched chunks outlive everything except the view, farthest first.
      const ahead=new Set(ring.map(d=>d.key));
      for(const entry of [...cache.values()]){if(pixels<=detailBudget)break;if(!pinned.has(entry.key)&&!ahead.has(entry.key)&&!visibleLatest.has(entry))release(entry);}
      for(let i=ring.length-1;i>=0&&pixels>detailBudget;i--){const entry=cache.get(ring[i].key);if(entry&&!pinned.has(entry.key))release(entry);}
      for(const entry of [...cache.values()]){if(pixels<=detailBudget)break;if(!pinned.has(entry.key))release(entry);}
    }
    while(coarsePixels>Math.min(MIB/2,maxPixels/8))releaseCoarse(coarse.values().next().value);
  }
  function cells(rect){const list=[];for(let cy=Math.floor(rect.y/CELL);cy<=Math.floor((rect.y+rect.height-1e-6)/CELL);cy++)for(let cx=Math.floor(rect.x/CELL);cx<=Math.floor((rect.x+rect.width-1e-6)/CELL);cx++){const id=`${cx}:${cy}`;if(!buckets.has(id))continue;const d=descriptor(cx,cy);if(intersects(d,rect))list.push(d);}return list;}
  function keyed(d,objects){const state=stateKey(d,objects),latestKey=`${d.id}@${state}`;return{...d,state,latestKey,key:`${latestKey}@${rasterScale}`};}
  function configure(rect,scale,viewportPixels,objects,freezeLod,prefetch){
    const list=cells(rect);
    maxPixels=fixedScale?12*MIB:Math.max(2*MIB,Math.min(8*MIB,Math.max(0,viewportPixels)*4));detailBudget=maxPixels-Math.min(MIB/2,maxPixels/8);
    let desired=chooseTier(scale);const cost=s=>list.length*CELL*CELL*s*s;while(desired>1/8&&cost(desired)>detailBudget)desired/=2;
    if(plan.length&&desired>rasterScale&&cost(desired)>detailBudget*.65)desired=rasterScale;
    let next=desired;
    if(!fixedScale&&freezeLod&&plan.length){
      deferredScale=desired!==rasterScale?desired:null;
      next=rasterScale;
    }else{
      deferredScale=null;
    }
    rasterScale=next;planPixels=cost(next);
    plan=list.map(d=>keyed(d,objects));
    ring=[];ringPixels=0;
    if(prefetch){
      // Cells just outside the view are built ahead of time, nearest to the
      // direction of travel first, so panning never reveals missing scenery.
      const shown=new Set(list.map(d=>d.id)),cellPixels=CELL*CELL*rasterScale*rasterScale;
      const allowance=Math.max(0,Math.min(Math.max(0,viewportPixels)*(fixedScale?2:3),HARD_LIMIT-maxPixels));
      const near=cells(prefetch).filter(d=>!shown.has(d.id)).map(d=>({d,distance:gap(d,prefetch.focus)})).sort((a,b)=>a.distance-b.distance);
      for(const {d} of near){if(ringPixels+cellPixels>allowance)break;ringPixels+=cellPixels;ring.push(keyed(d,objects));}
      maxPixels+=ringPixels;detailBudget+=ringPixels;
    }
    const nextRingKey=ring.map(d=>d.key).join(',');if(nextRingKey!==ringKey){ringKey=nextRingKey;ringStalled=false;}
    if(staging.size)dropStaging(new Set([...plan,...ring].map(d=>d.key)));
  }
  // Prefetch that no longer fits waits for the view to move instead of retrying.
  function needsWork(){return plan.some(d=>!cache.has(d.key))||!ringStalled&&ring.some(d=>!cache.has(d.key));}
  function work(budgetMs=4){
    if(disposed||deferredScale!==null)return{visualProgress:false,pending};
    const started=performance.now();let visualProgress=false,waiting=false,progressed=false;
    const pinned=new Set(plan.map(d=>d.key)),visibleMissing=plan.some(d=>!cache.has(d.key));
    // Visible cells first; prefetch only once the view itself is complete.
    for(const d of visibleMissing?plan:ring){
      if(cache.has(d.key))continue;
      if(performance.now()-started>=budgetMs)break;
      if(!visibleMissing&&!staging.has(d.key)&&pixels+stagingPixels+CELL*CELL*rasterScale*rasterScale>detailBudget){ringStalled=true;break;}
      const previous=latest.get(d.latestKey);
      if(!staging.has(d.key)&&!(previous&&previous.canvas.width>=Math.ceil(d.width*rasterScale))&&!prepared(d,lastObjects)){waiting=true;continue;}
      const value=build(d,d.key,d.latestKey,lastObjects,started+budgetMs);progressed=true;
      if(!value)break;
      if(previous&&previous.canvas.width>CELL*rasterScale)release(previous);
      if(visibleMissing)visualProgress=true;else{prefetched++;pinned.add(d.key);}
      if(pixels>detailBudget)evict(pinned);
    }
    if(visualProgress)evict(pinned);
    const missing=needsWork();
    // `pending` describes the last drawn frame; finished chunks count once shown.
    if(plan.some(d=>!cache.has(d.key))||deferredScale!==null)pending=true;
    return{visualProgress,pending:missing,waiting:waiting&&!progressed};
  }
  return{
    draw(ctx,rect,objects=Object.create(null),{scale=1,viewportPixels=0,budgetMs=3,budget,freezeLod=false,prefetch}={}){
      if(disposed)return false;lastObjects=objects;configure(rect,scale,viewportPixels,objects,freezeLod,prefetch);
      const started=performance.now(),pinned=new Set(plan.map(d=>d.key));
      const hasTime=budget?()=>budget.hasTime():()=>performance.now()-started<budgetMs;
      const hasFallbackTime=budget?()=>budget.hasTime():()=>performance.now()-started<Math.max(4,budgetMs);
      pending=false;
      for(const d of plan){
        let entry=cache.get(d.key);
        if(!entry){
          const previous=latest.get(d.latestKey);
          if(!freezeLod&&previous&&previous.canvas.width>CELL*rasterScale&&hasFallbackTime()){entry=build(d,d.key,d.latestKey,objects);release(previous);}
          else if(!freezeLod&&hasTime()&&(staging.has(d.key)||prepared(d,objects)))entry=build(d,d.key,d.latestKey,objects);
        }
        if(!entry){entry=latest.get(d.latestKey)??coarse.get(d.latestKey);if(entry&&coarse.get(d.latestKey)===entry)coarseDraws++;pending=true;}
        if(entry){if(cache.has(entry.key)){cache.delete(entry.key);cache.set(entry.key,entry);}ctx.drawImage(entry.canvas,d.x,d.y,d.width,d.height);if(entry.key!==d.key)staleDraws++;}
        // Scenery never pops in from nothing: a cheap coarse image stands in until
        // the detailed chunk is ready, whatever the remaining frame budget.
        else if(!freezeLod){const preview=coldCoarse(d,objects);ctx.drawImage(preview.canvas,d.x,d.y,d.width,d.height);fallbackDraws++;staleDraws++;}
        else missingDraws++;
      }
      evict(pinned);
      if(deferredScale!==null)pending=true;
      return true;
    },
    work,
    needsBackgroundWork(){return !disposed&&deferredScale===null&&needsWork();},
    drawList:props.map(entry=>({type:'prop',item:entry.prop,depth:entry.depth})),
    worldBounds:worldBounds||{x:0,y:0,width:1,height:1},
    stats(){return{chunks:cache.size,pixels:pixels+stagingPixels+coarsePixels,staging:staging.size,detailPixels:pixels,coarsePixels,coarseChunks:coarse.size,maxPixels,rasterScale,builds,pending,visibleChunks:plan.length,workingSetPixels:planPixels,buildMs,fallbackDraws,lodReuses,coarseDraws,prefetched,prefetchChunks:ring.length,prefetchPixels:ringPixels,staleDraws,missingDraws};},
    clear(){dropStaging(new Set());for(const entry of [...cache.values()])release(entry,false);for(const entry of [...coarse.values()])releaseCoarse(entry);descriptors.clear();plan=[];ring=[];ringPixels=0;planPixels=0;deferredScale=null;pending=true;},
    dispose(){if(disposed)return;this.clear();disposed=true;}
  };
}
