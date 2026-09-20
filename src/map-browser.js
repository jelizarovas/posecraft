import {drawMapPropShadow} from './map-ground-shadow.js';
import {createMapTerrainChunks} from './map-terrain-chunks.js';
import {createMapSceneryChunks} from './map-scenery-chunks.js';
import {assertMap, projectMap, unprojectMap} from './map.js';
import {MapController} from './map-runtime.js';
import {drawMapRoute} from './map-route-overlay.js';
import {drawMapActor} from './map-character.js';
import {MapOcclusionIndex, mapActorArtBounds as baseActorBounds} from './map-depth.js';
import {drawMapNpc,npcActorBounds} from './map-npc-renderer.js';
import {mapPropArtBounds} from './map-depth.js';
import {artPropSelection, mapImageBounds} from './map-art-layout.js';
import {loadMapArt, drawMapTerrainTexture} from './map-art.js';
import {drawMapFence,isMapFence} from './map-fence.js';
import {traceMapCropCover} from './map-crop-cover.js';
import {continuousSegmentClear} from './map-collision.js';
import {cliffDrawProps,drawCliffFace,drawCliffWater,drawRiverWater,cliffSceneryMasks,clipCliffScenery} from './map-cliff-renderer.js';
import {createMapBirdLife,drawMapBirds,mapBirdWakeDelay} from './map-birds.js';
import {terrainTileCorners} from './map-cliffs.js';
import {createMapGpu} from './map-gpu.js';
import {drawGpuRoute,drawGpuRiver} from './map-gpu-effects.js';
import {createMapGpuTerrain} from './map-gpu-terrain.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shade=(x,y)=>((Math.imul(x+17,73856093)^Math.imul(y+31,19349663))>>>0)%5;
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,points,color,width=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
const grass=['#719769','#769b6d','#7b9e70','#73986a','#789c6e'];
function tile(ctx,map,tile,art){if(drawMapTerrainTexture(ctx,map,tile,art))return;const p=projectMap(map,{x:tile.x+.5,y:tile.y+.5}),w=map.tileSize.width/2,h=map.tileSize.height/2,n=shade(tile.x,tile.y);polygon(ctx,terrainTileCorners(map,tile.x,tile.y).map(p=>{const q=projectMap(map,p);return[q.x,q.y];}),tile.terrain===2?['#527f91','#548294','#598698','#568496','#517e90'][n]:tile.terrain===1?['#c6b994','#cabc98','#c3b58f','#c9bc97','#ccbf9b'][n]:tile.terrain===3?'#d6c793':grass[n]);if(tile.terrain===2){line(ctx,[[p.x-w*.22,p.y],[p.x+w*.2,p.y]],'#719dab',1);}else if(tile.terrain===0&&n===0){line(ctx,[[p.x-3,p.y+2],[p.x-4,p.y-1],[p.x-2,p.y+1],[p.x,p.y-2]],'#608357',1);}}
function propCenter(p){return{x:p.x+p.width/2,y:p.y+p.height/2};}
function drawProp(ctx,map,p,state,{shadow=true,art,fencePart,terrainClipped=false}={}){
  if(p.cliffTop){polygon(ctx,p.cliffPoints.map(p=>[p.x,p.y]),'#000');return;}
  if(!terrainClipped&&!p.cliffFace&&map.terraces?.length){const masks=cliffSceneryMasks(map,p);if(masks.length){ctx.save();clipCliffScenery(ctx,masks);drawProp(ctx,map,p,state,{shadow,art,fencePart,terrainClipped:true});ctx.restore();return;}}
if(p.cliffFace){drawCliffFace(ctx,map,p,art);return;}if(isMapFence(p)){drawMapFence(ctx,map,p,art,fencePart);return;}const selected=artPropSelection(map,p,state),image=selected&&art?.image(selected.id);if(image){const bounds=mapImageBounds(map,propCenter(p),selected.image);ctx.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height);return;}const q=projectMap(map,propCenter(p)),s=map.tileSize.width/64;ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);if(shadow)ellipse(ctx,5,2,p.kind==='house'?38:18,p.kind==='house'?12:6,'#344e4433');
  if(p.kind==='tree'){
    polygon(ctx,[[-4,0],[-5,-35],[4,-36],[6,0]],'#745640');line(ctx,[[0,-10],[0,-34],[13,-43]],'#a07b50',2);
    polygon(ctx,[[-26,-34],[-18,-49],[-15,-59],[-5,-69],[6,-66],[16,-54],[22,-40],[17,-28],[2,-25],[-15,-27]],'#355c49','#2e5342');
    polygon(ctx,[[-23,-38],[-17,-51],[-11,-60],[-4,-67],[6,-63],[8,-50],[18,-40],[7,-32],[-9,-34]],'#4f7c56');
    polygon(ctx,[[-17,-47],[-11,-59],[-4,-65],[3,-61],[2,-48],[-7,-43]],'#6a925f');
  }else if(p.kind==='rock'){
    polygon(ctx,[[-18,-2],[-15,-15],[-4,-22],[12,-17],[20,-3],[7,4]],'#737e77','#596a62');polygon(ctx,[[-15,-15],[-4,-22],[12,-17],[3,-9]],'#a5afa0');polygon(ctx,[[3,-9],[12,-17],[20,-3],[7,4]],'#65746e');
  }else if(p.kind==='chest'){
    polygon(ctx,[[-13,-14],[0,-19],[14,-12],[14,0],[0,6],[-13,-1]],'#96602e','#533e2d');polygon(ctx,[[0,-12],[14,-17],[14,0],[0,6]],'#704b2c');
    polygon(ctx,state?.opened?[[-13,-18],[-13,-30],[0,-35],[14,-28],[14,-17],[0,-12]]:[[-13,-14],[-12,-21],[0,-26],[13,-19],[14,-12],[0,-7]],state?.opened?'#be9451':'#c08e43','#63472e');
    line(ctx,[[-8,-19],[-8,-2]],'#e7c97b',3);line(ctx,[[7,-17],[7,2]],'#d5b267',3);polygon(ctx,[[-2,-12],[2,-11],[2,-6],[-2,-7]],'#f3d58a');
    if(state?.opened){ellipse(ctx,-1,-15,8,3,'#f9da77');}
  }else if(p.kind==='house'){
    const w=map.tileSize.width/2/s,h=map.tileSize.height/2/s,wx=p.width*w/2,wy=p.height*w/2,hx=p.width*h/2,hy=p.height*h/2;
    const a=[-wx+wy,-hx-hy],b=[wx+wy,hx-hy],c=[wx-wy,hx+hy],d=[-wx-wy,-hx+hy],up=36;
    polygon(ctx,[[d[0],d[1]-up],[c[0],c[1]-up],c,d],'#ddc9a0','#796f55');polygon(ctx,[[c[0],c[1]-up],[b[0],b[1]-up],b,c],'#b5a483','#796f55');
    const apexL=[a[0],a[1]-up-19],apexR=[b[0],b[1]-up-19];
    polygon(ctx,[[d[0]-4,d[1]-up],apexL,apexR,[c[0]+3,c[1]-up]],'#a95b48','#654a3c');polygon(ctx,[apexR,[b[0]+4,b[1]-up],[c[0]+3,c[1]-up]],'#774b40','#654a3c');
    for(let i=1;i<4;i++){const t=i/4;line(ctx,[[d[0]+(apexL[0]-d[0])*t,d[1]-up+(apexL[1]-d[1]+up)*t],[c[0]+(apexR[0]-c[0])*t,c[1]-up+(apexR[1]-c[1]+up)*t]],'#bc7058',1);}
    const doorX=(d[0]+c[0])*.5,doorY=(d[1]+c[1])*.5;polygon(ctx,[[doorX-6,doorY-24],[doorX+6,doorY-18],[doorX+6,doorY+3],[doorX-6,doorY-3]],state?.opened?'#3a4c43':'#725740','#584b38');ellipse(ctx,doorX+3,doorY-8,1,1,'#dec888');
    polygon(ctx,[[b[0]-17,b[1]-27],[b[0]-6,b[1]-32],[b[0]-6,b[1]-20],[b[0]-17,b[1]-15]],'#8ac1bf','#675e4b');
  }
  ctx.restore();
}
/** Mount a viewport-sized map. Offscreen tiles and props never enter the draw list. */
export function mountMap(element,map,{onEvent,onError,execution='worker',autoplay=true,reducedMotion='system',followOnMove=false,onCameraChange,renderer='canvas2d'}={}){
  if(!element?.appendChild)throw new TypeError('mountMap needs a DOM element.');
  assertMap(map);
  if(execution!=='worker'&&execution!=='main')throw TypeError('Map execution must be main or worker.');
  if(!['canvas2d','webgl2','auto'].includes(renderer))throw TypeError('Map renderer must be canvas2d, webgl2 or auto.');
  const doc=element.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),status=doc.createElement('div');
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',`${map.name||'Adventure map'}. Click to move or interact. Double-tap or Shift-click to run. Hold or Alt-click to face a point. Drag to pan, scroll to zoom, arrow keys to pan, Enter to return to your character.`);
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline-offset:-3px;';status.style.cssText='position:absolute;left:12px;bottom:10px;padding:5px 8px;border-radius:6px;color:#eaf0df;background:#263b3bcc;font:11px/1.4 system-ui;pointer-events:none;';status.setAttribute('role','status');status.className='map-stats';
  const originalPosition=element.style.position;if(win.getComputedStyle(element).position==='static')element.style.position='relative';element.append(canvas,status);
  const ctx=canvas.getContext('2d',{alpha:renderer!=='canvas2d'});if(!ctx){canvas.remove();status.remove();element.style.position=originalPosition;throw Error('Canvas 2D is unavailable.');}
  const gpuCanvas=doc.createElement('canvas');gpuCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';gpuCanvas.setAttribute('aria-hidden','true');
  let gpu=null,rendererFallback=null;
  if(renderer!=='canvas2d')try{gpu=createMapGpu(gpuCanvas,{onLost:()=>useCanvasFallback('WebGL context lost')});if(!gpu)rendererFallback='WebGL2 unavailable';}catch(error){rendererFallback=error.message;}
  if(gpu){element.insertBefore(gpuCanvas,canvas);canvas.style.position='relative';}
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)'),reduced=()=>reducedMotion==='system'?!!media?.matches:!!reducedMotion;
  const pixelRatio=()=>Math.min(win.devicePixelRatio||1,2,Math.sqrt(4*1024*1024/(width*height)));
  let disposed=false,playing=autoplay,visible=true,dirty=true,raf=0,last=null,width=1,height=1,zoom=1,drawnFrames=0,lastStats={};
  let camera=projectMap(map,map.actors[0]?{x:map.actors[0].x,y:map.actors[0].y}:{x:map.width/2,y:map.height/2});
  let trackedActor=null,following=false;
  const cameraTracking=()=>({actor:trackedActor,following});
  const report=error=>{if(error?.name!=='AbortError')onError?.(error);};
  const controller=new MapController(map,{execution,onError:report,onEvent:event=>{if(followOnMove&&event.actor===map.actors[0]?.id&&(event.type==='map.move.started'||event.type==='map.turn.started'))followActor(event.actor);dirty=true;schedule();onEvent?.(event);}});
  map=controller.map;
  const definitions=new Map(map.actors.map(a=>[a.id,a]));
  const cliffs=cliffDrawProps(map),birds=createMapBirdLife(map);
  const presentations=new Map();let animationTime=0,visibleNpcAnimation=false,birdWakeTimer=0;
  const actorBounds=actor=>npcActorBounds(map,actor,definitions.get(actor.id),presentations.get(actor.id))||baseActorBounds(map,actor);
  function drawActor(context,actor,{shadow=true}={}){
    const definition=definitions.get(actor.id),state=presentations.get(actor.id);
    const presentation=state?{...state,time:animationTime,age:Math.max(0,animationTime-state.since)}:undefined;
    if(!drawMapNpc(context,map,actor,definition,reduced(),{shadow,art,presentation,drawBase:drawMapActor}))drawMapActor(context,map,actor,definition,reduced(),{shadow,art});
  }
  function setActorPresentation(id,state){
    if(!definitions.has(id))throw Error(`Unknown map actor: ${id}`);
    if(state===null)presentations.delete(id);
    else{if(!state||typeof state.action!=='string'||state.action.length>64)throw TypeError('Actor presentation requires an action');presentations.set(id,{...structuredClone(state),since:win.performance.now()/1000});}
    invalidate();
  }
  const index=controller.index;
  let artRevision=0,terrain,scenery;
  const terrainArtIds=new Set([...Object.values(map.art?.terrain??{}),...Object.values(map.groundPaint??{})]);
  const sceneryArtIds=new Set([...Object.values(map.art?.props??{}).flat(),...map.props.flatMap(p=>p.art?[p.art]:[]),'cliff-rock','farm-fence-timber']);
  for(const id of [...sceneryArtIds]){const opened=map.art?.images[id]?.opened;if(opened)sceneryArtIds.add(opened);}
  const art=loadMapArt(map,{document:doc,onUpdate:id=>{artRevision++;if(terrainArtIds.has(id))terrain?.clear();if(sceneryArtIds.has(id))scenery?.clear();invalidate();},onError:report});
  function createLayers(){
    terrain=gpu?createMapGpuTerrain(map,doc,art,{onUpdate:()=>invalidate()}):createMapTerrainChunks(map,doc,art,(ctx,t)=>tile(ctx,map,t,art),{onUpdate:()=>invalidate()});
    scenery=createMapSceneryChunks(map,doc,{fixedScale:gpu?2:undefined,extraProps:cliffs,drawShadow:(ctx,p)=>drawMapPropShadow(ctx,map,p,art),drawProp:(ctx,p,state,fencePart)=>drawProp(ctx,map,p,state,{art,shadow:false,fencePart})});
  }
  createLayers();
  function useCanvasFallback(reason){
    if(!gpu)return;rendererFallback=reason;gpu.dispose();gpu=null;gpuCanvas.remove();terrain.dispose();scenery.dispose();createLayers();invalidate();
  }
  const drawList=scenery.drawList,cachedOcclusion=new MapOcclusionIndex(map,[...map.props,...cliffs],scenery.worldBounds);
  let cachedView=null,cachedViewRect=null,latestRect=null,viewQueries=0,pickActors=[];
  const scratch=Array.from({length:4},()=>{const canvas=doc.createElement('canvas');canvas.width=canvas.height=1;return{canvas,ctx:canvas.getContext('2d')};});
  function drawMaskedActor(actor,foreground,bounds,dpr,objects){
    const left=Math.max(0,Math.floor(((bounds.x-camera.x)*zoom+width/2)*dpr)),top=Math.max(0,Math.floor(((bounds.y-camera.y)*zoom+height/2)*dpr));
    const right=Math.min(canvas.width,Math.ceil(((bounds.x+bounds.width-camera.x)*zoom+width/2)*dpr)),bottom=Math.min(canvas.height,Math.ceil(((bounds.y+bounds.height-camera.y)*zoom+height/2)*dpr));
    if(right<=left||bottom<=top)return 0;
    for(const buffer of scratch){if(buffer.canvas.width!==right-left)buffer.canvas.width=right-left;if(buffer.canvas.height!==bottom-top)buffer.canvas.height=bottom-top;buffer.ctx.setTransform(1,0,0,1,0,0);buffer.ctx.globalCompositeOperation='source-over';buffer.ctx.clearRect(0,0,right-left,bottom-top);buffer.ctx.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*(width/2-camera.x*zoom)-left,dpr*(height/2-camera.y*zoom)-top);}
    const [body,mask,silhouette,reveal]=scratch;
    drawActor(body.ctx,actor);
    drawActor(silhouette.ctx,actor,{shadow:false});
    for(const prop of foreground.silhouetteProps)drawProp(mask.ctx,map,prop,objects?.[prop.id],{shadow:false,art});
    for(const buffer of scratch)buffer.ctx.setTransform(1,0,0,1,0,0);
    reveal.ctx.drawImage(mask.canvas,0,0);
    for(const prop of foreground.props)if(prop.occlusion?.mode==='low-foliage'){
      // Cover follows irregular stalk tips and the artwork's alpha. Tall
      // crops retain a locator silhouette; ankle-high plants do not need it.
      const fraction=prop.occlusion.lowerBodyFraction??.5,base=projectMap(map,actor).y-(actor.lift||0)*map.tileSize.height;
      const standingHeight=art.standingHeight(actor.id)*(definitions.get(actor.id)?.appearance?.scale??1);
      const cut=base-standingHeight*fraction*map.tileSize.width/64;
      for(const buffer of fraction>=.3?[mask,reveal]:[mask]){
        buffer.ctx.save();buffer.ctx.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*(width/2-camera.x*zoom)-left,dpr*(height/2-camera.y*zoom)-top);
        traceMapCropCover(buffer.ctx,bounds,cut,map.tileSize.width/64);buffer.ctx.clip();drawProp(buffer.ctx,map,prop,objects?.[prop.id],{shadow:false,art});buffer.ctx.restore();
      }
    }
    silhouette.ctx.globalCompositeOperation='source-in';silhouette.ctx.fillStyle='#e7f4c5';silhouette.ctx.fillRect(0,0,right-left,bottom-top);
    silhouette.ctx.globalCompositeOperation='destination-in';silhouette.ctx.drawImage(reveal.canvas,0,0);
    body.ctx.globalCompositeOperation='destination-out';body.ctx.drawImage(mask.canvas,0,0);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(body.canvas,left,top);ctx.globalAlpha=.66;ctx.drawImage(silhouette.canvas,left,top);ctx.restore();
    return (right-left)*(bottom-top)*scratch.length;
  }
  function toWorld(x,y){return{x:(x-width/2)/zoom+camera.x,y:(y-height/2)/zoom+camera.y};}
  function screenToMap(x,y){return unprojectMap(map,toWorld(x,y));}
  function mapToScreen(point){const p=projectMap(map,point);return{x:(p.x-camera.x)*zoom+width/2,y:(p.y-camera.y)*zoom+height/2};}
  function render(now=0){const paintStart=performance.now(),rect={x:camera.x-width/(2*zoom),y:camera.y-height/(2*zoom),width:width/zoom,height:height/zoom},dpr=pixelRatio();latestRect=rect;
    const contains=cachedViewRect&&rect.x>=cachedViewRect.x&&rect.y>=cachedViewRect.y&&rect.x+rect.width<=cachedViewRect.x+cachedViewRect.width&&rect.y+rect.height<=cachedViewRect.y+cachedViewRect.height;
    if(!contains){const padX=Math.max(48/zoom,rect.width*.35),padY=Math.max(48/zoom,rect.height*.35);cachedViewRect={x:rect.x-padX,y:rect.y-padY,width:rect.width+padX*2,height:rect.height+padY*2};cachedView=index.visible(cachedViewRect,0);viewQueries++;}
    const view=cachedView,frame=controller.visibleFrame(rect,view.props,{routeActor:map.actors[0]?.id??null});
    ctx.setTransform(1,0,0,1,0,0);if(gpu)ctx.clearRect(0,0,canvas.width,canvas.height);else{ctx.fillStyle='#dae4d4';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*(width/2-camera.x*zoom),dpr*(height/2-camera.y*zoom));
    let animatedRiver;
    if(gpu)try{
      gpu.begin({width,height,dpr,camera,zoom});
      terrain.draw(gpu,view.tiles,{scale:dpr*zoom,viewportPixels:canvas.width*canvas.height,view:rect});
      animatedRiver=drawGpuRiver(gpu,map,view.tiles,rect,now/1000,{reduced:reduced()});drawGpuRoute(gpu,map,frame,rect,{zoom,time:now,reduced:reduced()});
      scenery.draw(gpu,rect,frame.objects,{scale:dpr*zoom,viewportPixels:canvas.width*canvas.height});gpu.end();
    }catch(error){useCanvasFallback(error.message);return render(now);}
    else{
      terrain.draw(ctx,view.tiles,{scale:dpr*zoom,viewportPixels:canvas.width*canvas.height,view:rect});
      animatedRiver=drawRiverWater(ctx,map,view.tiles,rect,now/1000,{reduced:reduced()});drawMapRoute(ctx,map,frame,rect,{zoom,time:now,reduced:reduced()});
      scenery.draw(ctx,rect,frame.objects,{scale:dpr*zoom,viewportPixels:canvas.width*canvas.height});
    }
    animationTime=now/1000;
    const actors=frame.actors.filter(a=>{const bounds=actorBounds(a);return bounds.x<rect.x+rect.width&&bounds.x+bounds.width>rect.x&&bounds.y<rect.y+rect.height&&bounds.y+bounds.height>rect.y;});
    visibleNpcAnimation=!reduced()&&actors.some(a=>{const action=presentations.get(a.id)?.action;return action&&action!=='idle'&&definitions.get(a.id)?.appearance;});
    const animatedFalls=drawCliffWater(ctx,map,cliffs,rect,now/1000,{reduced:reduced(),art});
    const occlusion=cachedOcclusion;let occlusionCandidates=0,maskedActors=0,scratchPixels=0;
    actors.sort((a,b)=>a.x+a.y-b.x-b.y);
    pickActors=actors;
    for(const actor of actors){const bounds=actorBounds(actor),foreground=occlusion.foreground(actor,bounds);occlusionCandidates+=foreground.candidates;if(foreground.props.length){scratchPixels=Math.max(scratchPixels,drawMaskedActor(actor,foreground,bounds,dpr,frame.objects));maskedActors++;}else drawActor(ctx,actor);}
    const animatedBirds=drawMapBirds(ctx,map,birds,now/1000,rect,{reduced:reduced()});
    win.clearTimeout(birdWakeTimer);birdWakeTimer=0;
    if(playing&&!animatedBirds){const delay=mapBirdWakeDelay(map,birds,now/1000,rect,{reduced:reduced()});if(delay>0)birdWakeTimer=win.setTimeout(()=>{birdWakeTimer=0;invalidate();},delay);}
    visibleNpcAnimation ||= !reduced()&&(animatedFalls>0||animatedRiver>0||animatedBirds);
    const terrainCache=terrain.stats(),sceneryCache=scenery.stats();drawnFrames++;lastStats={renderer:gpu?'webgl2':'canvas2d',rendererFallback,gpu:gpu?.stats()??null,visibleTiles:view.tiles.length,visibleProps:view.props.length,visibleActors:actors.length,candidateActors:frame.candidateActors,candidateRouteSegments:frame.candidateRouteSegments,occlusionCandidates,maskedActors,scratchPixels,art:art.stats(),totalTiles:map.width*map.height,totalProps:map.props.length,drawnFrames,terrainBuilds:terrainCache.builds,sceneryBuilds:sceneryCache.builds,viewQueries,terrainCache,sceneryCache,paintMs:performance.now()-paintStart,backingWidth:canvas.width,backingHeight:canvas.height,camera:{...camera,zoom,tracking:cameraTracking()},...view.stats};
    const statusText=`${view.tiles.length.toLocaleString()} / ${(map.width*map.height).toLocaleString()} tiles · ${view.props.length} / ${map.props.length} props in view`;if(status.textContent!==statusText)status.textContent=statusText;
    // Terrain work schedules its own bounded tasks and invalidates on progress.
    // Repainting an unchanged pending chunk only competes with that work.
    dirty=sceneryCache.pending||(playing&&visibleNpcAnimation);
  }
  function schedule(){if(!disposed&&!raf&&visible&&!doc.hidden&&dirty)raf=win.requestAnimationFrame(tick);}
  function tick(now){raf=0;if(disposed||!visible||doc.hidden){last=null;return;}const dt=last===null?0:Math.min((now-last)/1000,.05);last=now;if(playing&&controller.isMoving){controller.advance(dt);dirty=true;}const cameraMoving=updateCamera(dt||1/60);if(cameraMoving)dirty=true;if(dirty)render(now);if(playing&&controller.isMoving||cameraMoving)dirty=true;schedule();if(!raf)last=null;}
  function invalidate(){dirty=true;schedule();}
  function resize(){const r=element.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=pixelRatio();const nextWidth=Math.round(width*dpr),nextHeight=Math.round(height*dpr);if(canvas.width!==nextWidth)canvas.width=nextWidth;if(canvas.height!==nextHeight)canvas.height=nextHeight;cachedViewRect=null;invalidate();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=null;if(!visible){win.cancelAnimationFrame(raf);raf=0;}else invalidate();});intersection.observe(element);
  const visibility=()=>{last=null;if(doc.hidden){win.cancelAnimationFrame(raf);raf=0;}else invalidate();};doc.addEventListener('visibilitychange',visibility);media?.addEventListener('change',invalidate);
  function moveTo(actorId,target,options){if(disposed)return Promise.reject(Error('Map view is disposed.'));dirty=true;schedule();try{return Promise.resolve(controller.moveTo(actorId,target,options)).finally(invalidate);}catch(error){return Promise.reject(error);}}
  const pointers=new Map();let gesture=null,lastTap=null;
  const local=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  function pointerDown(e){if(e.button!==0&&e.pointerType!=='touch')return;canvas.focus({preventScroll:true});const p=local(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);gesture={time:performance.now(),point:p,start:p,camera:{...camera},moved:pointers.size>1};if(pointers.size===2){lastTap=null;const [a,b]=[...pointers.values()];gesture.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,world:toWorld((a.x+b.x)/2,(a.y+b.y)/2)};}}
  function pointerMove(e){if(!pointers.has(e.pointerId)||!gesture)return;const p=local(e);pointers.set(e.pointerId,p);if(pointers.size===2&&gesture.pinch){const[a,b]=[...pointers.values()],pinch=gesture.pinch;zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),.45,5);cachedViewRect=null;camera={x:pinch.world.x-((a.x+b.x)/2-width/2)/zoom,y:pinch.world.y-((a.y+b.y)/2-height/2)/zoom};gesture.moved=true;lastTap=null;stopFollowing();}else{const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>4){gesture.moved=true;lastTap=null;stopFollowing();}if(!gesture.moved)return;camera={x:gesture.camera.x-dx/zoom,y:gesture.camera.y-dy/zoom};}invalidate();}
  const hitCanvas=doc.createElement('canvas');hitCanvas.width=hitCanvas.height=1;const hitContext=hitCanvas.getContext('2d',{willReadFrequently:true});
  function hitsDrawing(world,draw){
    if(!hitContext)return false;
    hitContext.setTransform(1,0,0,1,0,0);hitContext.clearRect(0,0,1,1);
    hitContext.save();hitContext.setTransform(zoom,0,0,zoom,.5-world.x*zoom,.5-world.y*zoom);
    draw(hitContext);hitContext.restore();return hitContext.getImageData(0,0,1,1).data[3]>=24;
  }
  function hitAnimal(point){
    const world=toWorld(point.x,point.y);
    for(let i=pickActors.length-1;i>=0;i--){
      const actor=pickActors[i];if(definitions.get(actor.id)?.appearance?.kind!=='livestock')continue;
      const bounds=actorBounds(actor);
      if(world.x<bounds.x||world.x>=bounds.x+bounds.width||world.y<bounds.y||world.y>=bounds.y+bounds.height)continue;
      if(hitsDrawing(world,context=>{
        drawActor(context,actor,{shadow:false});context.globalCompositeOperation='destination-out';
        for(const prop of cachedOcclusion.foreground(actor,bounds).props)drawProp(context,map,prop,controller.objects[prop.id],{shadow:false,art});
      }))return actor;
    }return null;
  }
  function animalApproach(animal,player){
    const radius=map.navigation?.radius??.12,heading=Math.atan2(player.y-animal.y,player.x-animal.x);
    const distance=definitions.get(animal.id)?.npc?.species==='chicken'?.4:.7;
    const candidates=Array.from({length:16},(_,i)=>{const angle=heading+Math.ceil(i/2)*(i%2?1:-1)*Math.PI/8;return{x:animal.x+Math.cos(angle)*distance,y:animal.y+Math.sin(angle)*distance};});
    // Stay on the animal's side of a rail, even when the player is outside its pen.
    return candidates.find(p=>continuousSegmentClear(index,animal,p,radius))??{x:animal.x,y:animal.y};
  }
  function hitProp(point){const world=toWorld(point.x,point.y),visited=new Set();for(let i=drawList.length-1;i>=0;i--){const entry=drawList[i];
    if(entry.item.cliffFace)continue;
    if(visited.has(entry.item.id))continue;visited.add(entry.item.id);
    // Scenery overhang must not steal ground destinations behind it. Its
    // footprint still blocks navigation; only interactive props capture clicks.
    if(entry.item.traversal?.activation!=='click'&&(entry.item.kind==='tree'||entry.item.kind==='rock'||entry.item.traversal||entry.item.kind==='decoration'&&(!entry.item.collision||entry.item.collision.shape==='none')))continue;
    const selected=artPropSelection(map,entry.item,controller.objects[entry.item.id]),image=selected&&art.image(selected.id);
    const bounds=image?mapImageBounds(map,propCenter(entry.item),selected.image):mapPropArtBounds(map,entry.item);
    if(world.x<bounds.x||world.x>=bounds.x+bounds.width||world.y<bounds.y||world.y>=bounds.y+bounds.height)continue;
    // Connected fences have no source image. Their rectangular bounds contain
    // grass and animals, so sample the actual rails/posts before capturing a tap.
    if(isMapFence(entry.item)){
      if(hitsDrawing(world,context=>drawMapFence(context,map,entry.item,art)))return entry.item;
      continue;
    }
    if(image&&hitContext){
      const x=Math.floor((world.x-bounds.x)/bounds.width*image.naturalWidth),y=Math.floor((world.y-bounds.y)/bounds.height*image.naturalHeight);
      hitContext.clearRect(0,0,1,1);hitContext.drawImage(image,x,y,1,1,0,0,1,1);
      if(hitContext.getImageData(0,0,1,1).data[3]<24){
        // Small gaps between fence rails should not make a phone tap miss the
        // crossing. Keep ordinary scenery's exact alpha picking unchanged.
        let nearby=false;
        if(entry.item.traversal?.activation==='click'){
          const rx=9/zoom/bounds.width*image.naturalWidth,ry=9/zoom/bounds.height*image.naturalHeight;
          for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-.7,-.7],[.7,.7],[-.7,.7],[.7,-.7]]){
            hitContext.clearRect(0,0,1,1);hitContext.drawImage(image,x+dx*rx,y+dy*ry,1,1,0,0,1,1);
            if(hitContext.getImageData(0,0,1,1).data[3]>=24){nearby=true;break;}
          }
        }
        if(!nearby)continue;
      }
    }
    return entry.item;
  }return null;}
  function pointerUp(e){if(!pointers.has(e.pointerId))return;if(e.type==='pointercancel'||e.type==='lostpointercapture')lastTap=null;const click=gesture&&!gesture.moved&&pointers.size===1&&e.type==='pointerup',p=local(e);pointers.delete(e.pointerId);if(click&&map.actors[0]){const actor=controller.actorPosition(map.actors[0].id),now=performance.now(),doubleTap=lastTap&&now-lastTap.time<340&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<28,run=e.shiftKey||doubleTap||actor.gait==='run';const animal=hitAnimal(p),prop=animal?null:hitProp(p),target=animal?animalApproach(animal,actor):screenToMap(p.x,p.y),destination=doubleTap?lastTap.target:prop?.id||(map.navigation?.mode==='continuous'?target:{x:Math.floor(target.x),y:Math.floor(target.y)});lastTap=run?null:{...p,time:now,target:destination};const turn=e.altKey||now-gesture.time>=400||(!prop&&!run&&map.navigation?.mode==='continuous'&&Math.hypot(target.x-actor.x,target.y-actor.y)<.3);(turn?controller.faceTo(actor.id,target):moveTo(actor.id,destination,{gait:run?'run':'walk'})).catch(report);}if(pointers.size){const point=[...pointers.values()][0];gesture={point,start:point,camera:{...camera},moved:true};}else gesture=null;}
  function wheel(e){e.preventDefault();const p=following?{x:width/2,y:height/2}:local(e),before=toWorld(p.x,p.y);zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.45,5);cachedViewRect=null;camera={x:before.x-(p.x-width/2)/zoom,y:before.y-(p.y-height/2)/zoom};invalidate();}
  function notifyCamera(){try{onCameraChange?.(cameraTracking());}catch(error){report(error);}}
  function followActor(id){controller.actorPosition(id);trackedActor=id;following=true;notifyCamera();invalidate();}
  function stopFollowing(){if(!following)return;following=false;notifyCamera();invalidate();}
  function updateCamera(dt){
    if(!following||!trackedActor||pointers.size)return false;
    const actor=controller.actorPosition(trackedActor),target=projectMap(map,actor);
    target.y-=18*map.tileSize.width/64;
    const dx=target.x-camera.x,dy=target.y-camera.y,distance=Math.hypot(dx,dy)*zoom;
    if(distance<.01)return false;
    const amount=reduced()||distance<.25?1:1-Math.exp(-10*dt);
    camera={x:camera.x+dx*amount,y:camera.y+dy*amount};return true;
  }
  function focusActor(id){const actor=controller.actorPosition(id);if(!actor)throw Error(`Unknown map actor: ${id}`);stopFollowing();camera=projectMap(map,{x:actor.x,y:actor.y});invalidate();}
  function keydown(e){if(e.key.startsWith('Arrow'))stopFollowing();const amount=(e.shiftKey?120:40)/zoom;if(e.key==='ArrowLeft')camera.x-=amount;else if(e.key==='ArrowRight')camera.x+=amount;else if(e.key==='ArrowUp')camera.y-=amount;else if(e.key==='ArrowDown')camera.y+=amount;else if(e.key==='Enter'&&map.actors[0])followActor(trackedActor||map.actors[0].id);else if(e.key==='+'||e.key==='='){zoom=clamp(zoom*1.15,.45,5);cachedViewRect=null;}else if(e.key==='-'){zoom=clamp(zoom/1.15,.45,5);cachedViewRect=null;}else return;e.preventDefault();invalidate();}
  const listeners={pointerdown:pointerDown,pointermove:pointerMove,pointerup:pointerUp,pointercancel:pointerUp,lostpointercapture:pointerUp,keydown};for(const [name,listener]of Object.entries(listeners))canvas.addEventListener(name,listener);canvas.addEventListener('wheel',wheel,{passive:false});resize();
  return{controller,ready:art.ready,setActorPresentation,moveTo,screenToMap,mapToScreen,panTo(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw TypeError('Map coordinates must be finite.');stopFollowing();camera=projectMap(map,{x,y});invalidate();},zoomTo(value){if(!Number.isFinite(value))throw TypeError('Map zoom must be finite.');zoom=clamp(value,.45,5);cachedViewRect=null;invalidate();},focusActor,followActor,stopFollowing,cameraTracking,snapshot:()=>({format:'posecraft-map-view-state',version:1,camera:{...camera,zoom,tracking:cameraTracking()},scene:controller.snapshot()}),async restore(state){if(state?.format!=='posecraft-map-view-state'||state.version!==1||!state.camera||!Number.isFinite(state.camera.x)||!Number.isFinite(state.camera.y)||!Number.isFinite(state.camera.zoom)||state.camera.zoom<.45||state.camera.zoom>5)throw TypeError('Invalid map view snapshot.');const tracking=state.camera.tracking;if(tracking!==undefined&&(!tracking||typeof tracking.following!=='boolean'||tracking.actor!==null&&!definitions.has(tracking.actor)||tracking.following&&tracking.actor===null))throw TypeError('Invalid camera tracking state.');await controller.restore(state.scene);trackedActor=tracking?.actor??null;following=tracking?.following??false;notifyCamera();camera={x:state.camera.x,y:state.camera.y};zoom=state.camera.zoom;cachedViewRect=null;scenery.clear();invalidate();},play(){playing=true;last=null;invalidate();},pause(){playing=false;last=null;win.cancelAnimationFrame(raf);raf=0;if(dirty)schedule();},stats:()=>{const actual=latestRect&&index.visible(latestRect,0);if(!Object.hasOwn(lastStats,'scratchPixels'))return{scratchPixels:0,backingWidth:canvas.width,backingHeight:canvas.height,...actual?.stats};return{...lastStats,cachedTiles:lastStats.visibleTiles,cachedProps:lastStats.visibleProps,visibleTiles:actual.tiles.length,visibleProps:actual.props.length,...actual.stats};},dispose(){if(disposed)return;disposed=true;win.cancelAnimationFrame(raf);raf=0;resizeObserver.disconnect();intersection.disconnect();doc.removeEventListener('visibilitychange',visibility);media?.removeEventListener('change',invalidate);for(const[name,listener]of Object.entries(listeners))canvas.removeEventListener(name,listener);canvas.removeEventListener('wheel',wheel);win.clearTimeout(birdWakeTimer);gpu?.dispose();gpuCanvas.remove();controller.dispose();birds.dispose();art.dispose();terrain.dispose();scenery.dispose();for(const buffer of scratch)buffer.canvas.width=buffer.canvas.height=1;canvas.width=canvas.height=1;canvas.remove();status.remove();element.style.position=originalPosition;}};
}
