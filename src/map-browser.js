import {assertMap, projectMap, unprojectMap} from './map.js';
import {MapController} from './map-runtime.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shade=(x,y)=>((Math.imul(x+17,73856093)^Math.imul(y+31,19349663))>>>0)%5;
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,points,color,width=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
const grass=['#719769','#769b6d','#7b9e70','#73986a','#789c6e'];
function tile(ctx,map,tile){const p=projectMap(map,{x:tile.x+.5,y:tile.y+.5}),w=map.tileSize.width/2,h=map.tileSize.height/2,n=shade(tile.x,tile.y);polygon(ctx,[[p.x,p.y-h],[p.x+w,p.y],[p.x,p.y+h],[p.x-w,p.y]],tile.terrain===2?['#527f91','#548294','#598698','#568496','#517e90'][n]:tile.terrain===1?['#c6b994','#cabc98','#c3b58f','#c9bc97','#ccbf9b'][n]:tile.terrain===3?'#d6c793':grass[n]);if(tile.terrain===2){line(ctx,[[p.x-w*.22,p.y],[p.x+w*.2,p.y]],'#719dab',1);}else if(tile.terrain===0&&n===0){line(ctx,[[p.x-3,p.y+2],[p.x-4,p.y-1],[p.x-2,p.y+1],[p.x,p.y-2]],'#608357',1);}}
function propCenter(p){return{x:p.x+p.width/2,y:p.y+p.height/2};}
function drawProp(ctx,map,p,state){const q=projectMap(map,propCenter(p)),s=map.tileSize.width/64;ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);ellipse(ctx,5,2,p.kind==='house'?38:18,p.kind==='house'?12:6,'#344e4433');
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
function drawActor(ctx,map,a,definition,reduced){const p=projectMap(map,{x:a.x,y:a.y}),s=map.tileSize.width/64,phase=Number(a.phase)||0,walking=a.walking&&!reduced,step=walking?Math.sin(phase):0,bob=walking?Math.abs(Math.cos(phase))*1.8:0;
  const facing=a.facing,angle=typeof facing==='number'?facing:typeof facing==='object'?Math.atan2(facing.y,facing.x):0,dx=Math.cos(angle)-Math.sin(angle),dy=Math.cos(angle)+Math.sin(angle),side=dx<0?-1:1,back=dy<-.2;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);ellipse(ctx,1,1,9,3,'#213d3d38');
  line(ctx,[[-3,-12],[-4-step*3,-5],[-4-step*4,0]],'#364652',4);line(ctx,[[3,-12],[4+step*3,-5],[4+step*4,0]],'#42535b',4);line(ctx,[[-5-step*4,0],[-2-step*4,0]],'#283b40',3);line(ctx,[[3+step*4,0],[7+step*4,0]],'#283b40',3);
  ctx.translate(0,-bob);const color=definition?.color||'#8a597b';
  line(ctx,[[-5,-23],[-8,-17+step*3],[-7,-12+step*4]],'#d6ab7e',3.5);
  polygon(ctx,[[-5,-27],[5,-27],[7,-12],[-7,-12]],color,'#444846');polygon(ctx,[[-5,-25],[-1,-25],[-2,-12],[-7,-12]],'#ffffff18');
  if(back){polygon(ctx,[[-5,-25],[4,-24],[5,-15],[-5,-16]],'#b18b55','#6c664c');line(ctx,[[-4,-24],[3,-23]],'#d1b176',2);}else{line(ctx,[[-4,-25],[4,-15]],'#d2ae73',2);}
  line(ctx,[[5,-23],[8,-17-step*3],[8,-12-step*4]],'#e2b88b',3.5);
  ellipse(ctx,side*.6,-31,6,7,'#e5bf90');polygon(ctx,[[-6,-34],[-3,-39],[4,-38],[7,-33],[3,-33],[0,-35],[-5,-31]],'#534b3f');
  if(!back){ellipse(ctx,side*3,-31,1,1.3,'#37433e');line(ctx,[[side*3,-27],[side*4,-27]],'#a76d54',1);}else{polygon(ctx,[[-6,-34],[5,-35],[5,-28],[-4,-27]],'#534b3f');}
  ctx.restore();
}

/** Mount a viewport-sized map. Offscreen tiles and props never enter the draw list. */
export function mountMap(element,map,{onEvent,onError,execution='worker',autoplay=true,reducedMotion='system'}={}){
  if(!element?.appendChild)throw new TypeError('mountMap needs a DOM element.');
  assertMap(map);
  if(execution!=='worker'&&execution!=='main')throw TypeError('Map execution must be main or worker.');
  const doc=element.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),status=doc.createElement('div');
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',`${map.name||'Adventure map'}. Click to move or interact. Drag to pan, scroll to zoom, arrow keys to pan, Enter to return to your character.`);
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline-offset:-3px;';status.style.cssText='position:absolute;left:12px;bottom:10px;padding:5px 8px;border-radius:6px;color:#eaf0df;background:#263b3bcc;font:11px/1.4 system-ui;pointer-events:none;';status.setAttribute('role','status');
  const originalPosition=element.style.position;if(!originalPosition||originalPosition==='static')element.style.position='relative';element.append(canvas,status);
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){canvas.remove();status.remove();element.style.position=originalPosition;throw Error('Canvas 2D is unavailable.');}
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)'),reduced=()=>reducedMotion==='system'?!!media?.matches:!!reducedMotion;
  let disposed=false,playing=autoplay,visible=true,dirty=true,raf=0,last=null,width=1,height=1,zoom=1,drawnFrames=0,drawList=[],lastStats={};
  let camera=projectMap(map,map.actors[0]?{x:map.actors[0].x,y:map.actors[0].y}:{x:map.width/2,y:map.height/2});
  const report=error=>{if(error?.name!=='AbortError')onError?.(error);};
  const controller=new MapController(map,{execution,onError:report,onEvent:event=>{dirty=true;schedule();onEvent?.(event);}});
  map=controller.map;
  const definitions=new Map(map.actors.map(a=>[a.id,a]));
  const index=controller.index;
  function toWorld(x,y){return{x:(x-width/2)/zoom+camera.x,y:(y-height/2)/zoom+camera.y};}
  function screenToMap(x,y){return unprojectMap(map,toWorld(x,y));}
  function mapToScreen(point){const p=projectMap(map,point);return{x:(p.x-camera.x)*zoom+width/2,y:(p.y-camera.y)*zoom+height/2};}
  function render(now=0){const rect={x:camera.x-width/(2*zoom),y:camera.y-height/(2*zoom),width:width/zoom,height:height/zoom},view=index.visible(rect,64/zoom),frame=controller.visibleFrame(rect,view.props),dpr=Math.min(win.devicePixelRatio||1,2);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#dae4d4';ctx.fillRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
    for(const t of view.tiles)tile(ctx,map,t);
    if(frame.routeSegments?.length){ctx.save();ctx.setLineDash([3/zoom,6/zoom]);for(const segment of frame.routeSegments){const a=projectMap(map,segment.from),b=projectMap(map,segment.to);line(ctx,[[a.x,a.y],[b.x,b.y]],'#fff3ba',2/zoom);}ctx.restore();}
    const actorScale=map.tileSize.width/64;
    const actors=frame.actors.filter(a=>{const p=projectMap(map,{x:a.x,y:a.y});return p.x>rect.x-20*actorScale&&p.x<rect.x+rect.width+20*actorScale&&p.y>rect.y-8*actorScale&&p.y<rect.y+rect.height+44*actorScale;});
    drawList=[...view.props.map(p=>({type:'prop',item:p,depth:projectMap(map,{x:p.x+p.width,y:p.y+p.height}).y})),...actors.map(a=>({type:'actor',item:a,depth:projectMap(map,{x:a.x,y:a.y}).y}))].sort((a,b)=>a.depth-b.depth||(a.type==='prop'?-1:1));
    for(const entry of drawList)if(entry.type==='prop')drawProp(ctx,map,entry.item,frame.objects?.[entry.item.id]);else drawActor(ctx,map,entry.item,definitions.get(entry.item.id),reduced());
    drawnFrames++;lastStats={visibleTiles:view.tiles.length,visibleProps:view.props.length,visibleActors:actors.length,candidateActors:frame.candidateActors,candidateRouteSegments:frame.candidateRouteSegments,totalTiles:map.width*map.height,totalProps:map.props.length,drawnFrames,backingWidth:canvas.width,backingHeight:canvas.height,camera:{...camera,zoom},...view.stats};
    const statusText=`${view.tiles.length.toLocaleString()} / ${(map.width*map.height).toLocaleString()} tiles · ${view.props.length} / ${map.props.length} props in view`;if(status.textContent!==statusText)status.textContent=statusText;
    dirty=false;
  }
  function schedule(){if(!disposed&&!raf&&visible&&!doc.hidden&&dirty)raf=win.requestAnimationFrame(tick);}
  function tick(now){raf=0;if(disposed||!visible||doc.hidden){last=null;return;}const dt=last===null?0:Math.min((now-last)/1000,.05);last=now;if(playing&&controller.isMoving){controller.advance(dt);dirty=true;}if(dirty)render(now);if(playing&&controller.isMoving)dirty=true;schedule();if(!raf)last=null;}
  function invalidate(){dirty=true;schedule();}
  function resize(){const r=element.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(win.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);invalidate();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=null;if(!visible){win.cancelAnimationFrame(raf);raf=0;}else invalidate();});intersection.observe(element);
  const visibility=()=>{last=null;if(doc.hidden){win.cancelAnimationFrame(raf);raf=0;}else invalidate();};doc.addEventListener('visibilitychange',visibility);media?.addEventListener('change',invalidate);
  function moveTo(actorId,target,options){if(disposed)return Promise.reject(Error('Map view is disposed.'));dirty=true;schedule();try{return Promise.resolve(controller.moveTo(actorId,target,options)).finally(invalidate);}catch(error){return Promise.reject(error);}}
  const pointers=new Map();let gesture=null;
  const local=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  function pointerDown(e){if(e.button!==0&&e.pointerType!=='touch')return;canvas.focus({preventScroll:true});const p=local(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);gesture={point:p,start:p,camera:{...camera},moved:pointers.size>1};if(pointers.size===2){const [a,b]=[...pointers.values()];gesture.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,world:toWorld((a.x+b.x)/2,(a.y+b.y)/2)};}}
  function pointerMove(e){if(!pointers.has(e.pointerId)||!gesture)return;const p=local(e);pointers.set(e.pointerId,p);if(pointers.size===2&&gesture.pinch){const[a,b]=[...pointers.values()],pinch=gesture.pinch;zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),.45,2.5);camera={x:pinch.world.x-((a.x+b.x)/2-width/2)/zoom,y:pinch.world.y-((a.y+b.y)/2-height/2)/zoom};gesture.moved=true;}else{const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>4)gesture.moved=true;camera={x:gesture.camera.x-dx/zoom,y:gesture.camera.y-dy/zoom};}invalidate();}
  function hitProp(point){const world=toWorld(point.x,point.y),s=map.tileSize.width/64;for(const entry of [...drawList].reverse()){if(entry.type!=='prop')continue;const p=entry.item,q=projectMap(map,propCenter(p)),half=p.kind==='house'?map.tileSize.width*(p.width+p.height)/4:25*s,top=p.kind==='tree'?72*s:p.kind==='house'?110*s:34*s;if(world.x>=q.x-half&&world.x<=q.x+half&&world.y<=q.y+8*s&&world.y>=q.y-top)return p;}return null;}
  function pointerUp(e){if(!pointers.has(e.pointerId))return;const click=gesture&&!gesture.moved&&pointers.size===1&&e.type==='pointerup',p=local(e);pointers.delete(e.pointerId);if(click&&map.actors[0]){const prop=hitProp(p),target=screenToMap(p.x,p.y);moveTo(map.actors[0].id,prop?.id||{x:Math.floor(target.x),y:Math.floor(target.y)}).catch(report);}if(pointers.size){const point=[...pointers.values()][0];gesture={point,start:point,camera:{...camera},moved:true};}else gesture=null;}
  function wheel(e){e.preventDefault();const p=local(e),before=toWorld(p.x,p.y);zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.45,2.5);camera={x:before.x-(p.x-width/2)/zoom,y:before.y-(p.y-height/2)/zoom};invalidate();}
  function focusActor(id){const actor=controller.actorPosition(id);if(!actor)throw Error(`Unknown map actor: ${id}`);camera=projectMap(map,{x:actor.x,y:actor.y});invalidate();}
  function keydown(e){const amount=(e.shiftKey?120:40)/zoom;if(e.key==='ArrowLeft')camera.x-=amount;else if(e.key==='ArrowRight')camera.x+=amount;else if(e.key==='ArrowUp')camera.y-=amount;else if(e.key==='ArrowDown')camera.y+=amount;else if(e.key==='Enter'&&map.actors[0])focusActor(map.actors[0].id);else if(e.key==='+'||e.key==='=')zoom=clamp(zoom*1.15,.45,2.5);else if(e.key==='-')zoom=clamp(zoom/1.15,.45,2.5);else return;e.preventDefault();invalidate();}
  const listeners={pointerdown:pointerDown,pointermove:pointerMove,pointerup:pointerUp,pointercancel:pointerUp,lostpointercapture:pointerUp,keydown};for(const [name,listener]of Object.entries(listeners))canvas.addEventListener(name,listener);canvas.addEventListener('wheel',wheel,{passive:false});resize();
  return{controller,moveTo,screenToMap,mapToScreen,panTo(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw TypeError('Map coordinates must be finite.');camera=projectMap(map,{x,y});invalidate();},zoomTo(value){if(!Number.isFinite(value))throw TypeError('Zoom must be finite.');zoom=clamp(value,.45,2.5);invalidate();},focusActor,snapshot:()=>({format:'posecraft-map-view-state',version:1,camera:{...camera,zoom},scene:controller.snapshot()}),async restore(state){if(state?.format!=='posecraft-map-view-state'||state.version!==1||!state.camera||!Number.isFinite(state.camera.x)||!Number.isFinite(state.camera.y)||!Number.isFinite(state.camera.zoom)||state.camera.zoom<.45||state.camera.zoom>2.5)throw TypeError('Invalid map view snapshot.');await controller.restore(state.scene);camera={x:state.camera.x,y:state.camera.y};zoom=state.camera.zoom;invalidate();},play(){playing=true;last=null;invalidate();},pause(){playing=false;last=null;win.cancelAnimationFrame(raf);raf=0;if(dirty)schedule();},stats:()=>({...lastStats}),dispose(){if(disposed)return;disposed=true;win.cancelAnimationFrame(raf);resizeObserver.disconnect();intersection.disconnect();doc.removeEventListener('visibilitychange',visibility);media?.removeEventListener('change',invalidate);for(const[name,listener]of Object.entries(listeners))canvas.removeEventListener(name,listener);canvas.removeEventListener('wheel',wheel);controller.dispose();canvas.remove();status.remove();element.style.position=originalPosition;}};
}
